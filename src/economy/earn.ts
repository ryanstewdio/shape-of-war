// Gem earn rules (docs/16 Economy principles). Pure data and functions, no PRNG, no storage.
// Every award carries a stable id. The ledger applies an id once, so replaying a result, or
// earning the same star again on another attempt, pays nothing (no farming).
import type { Difficulty } from '../core/difficulty';
import { INSANE_STARS, STAR_CAP } from '../core/stars';

/** The run modes that report a result. Mirrors Mode in src/ui/flow.ts without importing UI. */
export type EarnMode = 'adventure' | 'endless' | 'freeplay';

export interface EndlessMilestone {
  /** Score a single Endless run must reach. */
  readonly score: number;
  readonly gems: number;
}

/** Placeholder values from docs/16, tuned later. */
export interface EarnTable {
  /** Gems for each star newly reached on a level (the first star and each further one). */
  readonly perStar: number;
  /** Gems for the first clear of a boss level. */
  readonly bossFirstClear: number;
  /** Endless milestones, ascending by score, each paid once. */
  readonly endlessMilestones: readonly EndlessMilestone[];
  /** Free Play pays nothing: custom setups could be farmed. */
  readonly freePlay: number;
}

export const EARN_TABLE: EarnTable = Object.freeze({
  perStar: 5,
  bossFirstClear: 50,
  endlessMilestones: Object.freeze([
    { score: 10_000, gems: 10 },
    { score: 25_000, gems: 20 },
    { score: 50_000, gems: 30 },
    { score: 100_000, gems: 50 },
    { score: 250_000, gems: 70 },
    { score: 500_000, gems: 85 },
    { score: 1_000_000, gems: 100 },
  ]),
  freePlay: 0,
});

/** A finished run as the results flow knows it. */
export interface ResultEvent {
  readonly mode: EarnMode;
  /** Adventure level index (0 based). Ignored outside Adventure. */
  readonly levelIndex: number;
  readonly difficulty: Difficulty;
  /** Best stars stored for the level before this run. */
  readonly starsBefore: number;
  /** Best stars stored for the level after this run (already merged with starsBefore). */
  readonly starsAfter: number;
  /** True when the level is a boss level. */
  readonly bossLevel: boolean;
  /** True when the run was won. */
  readonly success: boolean;
  readonly score: number;
}

export type AwardSource = 'star' | 'bossClear' | 'endlessMilestone';

export interface GemAward {
  /** Stable id: the same achievement always yields the same id. */
  readonly id: string;
  readonly source: AwardSource;
  readonly gems: number;
}

/** Pure: id of the n th star (1 based) on a level. */
export function starAwardId(levelIndex: number, n: number): string {
  return `earn:star:${levelIndex}:${n}`;
}

/** Pure: id of the first clear of a boss level. */
export function bossAwardId(levelIndex: number): string {
  return `earn:boss:${levelIndex}`;
}

/** Pure: id of an Endless milestone by its score threshold. */
export function milestoneAwardId(score: number): string {
  return `earn:endless:${score}`;
}

/** Pure: the most stars a run on `d` can hold. */
export function starCeiling(d: Difficulty): number {
  return d === 'insane' ? INSANE_STARS : (STAR_CAP[d] ?? STAR_CAP.normal);
}

function wholeStars(v: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(0, Math.floor(v))) : 0;
}

function validLevel(i: number): boolean {
  return Number.isInteger(i) && i >= 0;
}

function adventureAwards(e: ResultEvent, t: EarnTable): GemAward[] {
  if (!validLevel(e.levelIndex)) return [];
  const out: GemAward[] = [];
  const before = wholeStars(e.starsBefore, INSANE_STARS);
  // A run can only lift the stored best up to what its own difficulty can award.
  const after = Math.max(before, wholeStars(e.starsAfter, Math.max(before, starCeiling(e.difficulty))));
  for (let n = before + 1; n <= after; n++) {
    if (t.perStar > 0) out.push({ id: starAwardId(e.levelIndex, n), source: 'star', gems: t.perStar });
  }
  if (e.bossLevel && e.success && t.bossFirstClear > 0) {
    out.push({ id: bossAwardId(e.levelIndex), source: 'bossClear', gems: t.bossFirstClear });
  }
  return out;
}

function endlessAwards(e: ResultEvent, t: EarnTable): GemAward[] {
  if (!Number.isFinite(e.score)) return [];
  return t.endlessMilestones
    .filter((m) => m.gems > 0 && e.score >= m.score)
    .map((m) => ({ id: milestoneAwardId(m.score), source: 'endlessMilestone' as const, gems: m.gems }));
}

/**
 * Pure: every award a result could pay. `claimed` holds ids already paid (the ledger's entry ids);
 * those are left out, so the result is what this run newly earns. The ledger also refuses repeats.
 */
export function awardsFor(
  e: ResultEvent,
  claimed: ReadonlySet<string> = new Set(),
  t: EarnTable = EARN_TABLE,
): GemAward[] {
  let all: GemAward[];
  switch (e.mode) {
    case 'adventure':
      all = adventureAwards(e, t);
      break;
    case 'endless':
      all = endlessAwards(e, t);
      break;
    case 'freeplay':
      all = [];
      break;
  }
  return all.filter((a) => !claimed.has(a.id));
}

/** Pure: total gems in a list of awards. */
export function totalGems(awards: readonly GemAward[]): number {
  return awards.reduce((s, a) => s + a.gems, 0);
}
