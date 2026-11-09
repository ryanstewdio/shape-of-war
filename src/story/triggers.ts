// Story trigger rules (docs/19 "Scene rules"). Pure: no DOM, no storage, no PRNG.
// Level start, in this order: the opening (once), up to two briefings for kinds new to the run
// (the newFoes rule of src/ui/enemyIntro.ts, roster order, the rest deferred to the next levels),
// one combo briefing when both kinds share the level and both are briefed, then the guardian
// intro on a boss level. A boss win adds the freeing scene before the results. Every trigger plays
// once per save (the seen map), Adventure only: Endless and Free Play show none.
import type { BossId } from '../levelgen/leveldef';
import type { FoeKind } from '../ui/enemyIntro';
import { COMBOS, OPENING_ID, bossId, comboId, foeId, freedId, SCENE_IDS, sceneById } from './scenes';

export type StoryMode = 'adventure' | 'endless' | 'freeplay';

/** Most kind briefings before one level. */
export const MAX_BRIEFINGS = 2;

export interface LevelStartInput {
  readonly mode: StoryMode;
  /** 1 based Adventure level about to start. */
  readonly levelIndex: number;
  /**
   * The kinds in play on levels 1 to levelIndex of this run, index 0 is level 1 (levelFoes of each
   * level, roster order then wells and spawners). The last entry is the level about to start.
   */
  readonly foesByLevel: readonly (readonly FoeKind[])[];
  /** The boss of the level about to start, if any. */
  readonly boss?: BossId;
  /** Trigger ids already shown on this save. */
  readonly seen: Readonly<Record<string, number>>;
}

const has = (id: string): boolean => sceneById(id) !== undefined;

/** Pure: the kinds of level i (0 based) that no earlier level put in play, in level order. */
function freshAt(foesByLevel: readonly (readonly FoeKind[])[], i: number): FoeKind[] {
  const earlier = new Set<FoeKind>();
  for (let j = 0; j < i; j++) for (const k of foesByLevel[j] ?? []) earlier.add(k);
  const out: FoeKind[] = [];
  for (const k of foesByLevel[i] ?? []) if (!earlier.has(k) && !out.includes(k)) out.push(k);
  return out;
}

/**
 * Pure: the briefing queue at the start of the last level in foesByLevel. Earlier levels are walked
 * as if each showed its first two queued kinds; what did not fit carries over, so a level with more
 * than two new kinds defers the rest to the next level, in roster order.
 */
export function briefingQueue(foesByLevel: readonly (readonly FoeKind[])[]): FoeKind[] {
  let queue: FoeKind[] = [];
  const last = foesByLevel.length - 1;
  for (let i = 0; i <= last; i++) {
    for (const k of freshAt(foesByLevel, i)) if (has(foeId(k)) && !queue.includes(k)) queue.push(k);
    if (i < last) queue = queue.slice(MAX_BRIEFINGS);
  }
  return queue;
}

/** Pure: the trigger ids to play before an Adventure level starts, in play order. */
export function levelStartScenes(input: LevelStartInput): string[] {
  if (input.mode !== 'adventure') return [];
  const seen = input.seen;
  const unseen = (id: string): boolean => seen[id] === undefined && has(id);
  const out: string[] = [];
  if (unseen(OPENING_ID)) out.push(OPENING_ID);
  const briefed = briefingQueue(input.foesByLevel)
    .map(foeId)
    .filter(unseen)
    .slice(0, MAX_BRIEFINGS);
  out.push(...briefed);
  const here = input.foesByLevel[input.foesByLevel.length - 1] ?? [];
  const known = (k: FoeKind): boolean => seen[foeId(k)] !== undefined || briefed.includes(foeId(k));
  const combo = COMBOS.find(([a, b]) => here.includes(a) && here.includes(b) && known(a) && known(b) && unseen(comboId(a, b)));
  if (combo !== undefined) out.push(comboId(combo[0], combo[1]));
  if (input.boss !== undefined && unseen(bossId(input.boss))) out.push(bossId(input.boss));
  return out;
}

/** Pure: the trigger ids to play after a boss level win, before the results. */
export function bossWinScenes(mode: StoryMode, boss: BossId | undefined, seen: Readonly<Record<string, number>>): string[] {
  if (mode !== 'adventure' || boss === undefined) return [];
  const id = freedId(boss);
  return seen[id] === undefined && has(id) ? [id] : [];
}

/** Pure: the scenes first shown on `level`, in bible order, for "Replay story". */
export function replayScenes(seen: Readonly<Record<string, number>>, level: number): string[] {
  return SCENE_IDS.filter((id) => seen[id] === level);
}

/** Pure: every level that has a scene to replay. */
export function storyLevels(seen: Readonly<Record<string, number>>): Set<number> {
  const out = new Set<number>();
  for (const id of SCENE_IDS) {
    const lvl = seen[id];
    if (lvl !== undefined) out.add(lvl);
  }
  return out;
}
