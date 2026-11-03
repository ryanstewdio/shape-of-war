// Level intro card (B7, docs/01 section 10), redesigned in R2 and again in R3.
// R2 (Ryan): difficulty is chosen at the start of every Adventure level and every Endless run. The
// card holds the sim with no timer until the player taps Start; the four difficulty chips sit on
// the card with the last choice preselected, and a chip tap rebuilds the world at that difficulty
// (main.ts). Endless then shows a 1.5 s "Ready" text so the thumbs can settle on the sticks; Free
// Play chooses its difficulty on its own options screen and goes straight to Ready.
// R3 (Ryan, build a4d6be6): the card must state the goal and the victory condition, introduce new
// enemies by icon, name and type, and say what the super does. Layout, top to bottom, each block
// apart by at least 16 px in a card padded 20 px: title (level and arena); Goal and Victory; the
// difficulty chips and Start; Star targets as three labelled columns with the difficulty cap; New
// enemies; Loadout (drone, super with its real numbers, reward); the run seed, small and labelled.
// The gate is pure and ticks on sim time, so a pause during Ready freezes it.
import { DIFFICULTIES, type Difficulty } from '../core/difficulty';
import { INSANE_STARS, STAR_CAP } from '../core/stars';
import { DETONATE_RADIUS, HOMING_RADIUS, SUPER_DURATION, TURBO_PIERCE, TURBO_SCALE, TURBO_SPEED_SCALE } from '../game/supers';
import type { BossSpec, DroneKind, LevelDef, ObjectiveDef, SuperKind } from '../levelgen/leveldef';
import { bossName } from './boss';
import { button, createScreen, el, type Screen } from './dom';
import { foeLines, iconCanvas, type FoeKind, type FoeLine } from './enemyIntro';
import { formatClock, formatCompact } from './format';
import { DIFFICULTY_ROW_LABEL, difficultyButtonStates, difficultyLabel } from './settings';

/** Seconds the Endless and Free Play "Ready" text holds the sim. */
export const INTRO_SEC = 1.5;
export const READY_TEXT = 'Ready';
export const START_LABEL = 'Start';

/** Which run an intro is for. Matches flow Mode. */
export type IntroMode = 'adventure' | 'endless' | 'freeplay';

export interface IntroGate {
  /** 'card' waits for Start with no timer; 'ready' counts down; 'none' lets the sim step. */
  readonly kind: 'card' | 'ready' | 'none';
  /** Seconds left; Infinity on a card. */
  readonly left: number;
}

export const NO_INTRO: IntroGate = { kind: 'none', left: 0 };

/** Pure: the gate at the start of a run. Adventure and Endless wait on the card; Free Play goes to Ready. */
export function armIntro(mode: IntroMode): IntroGate {
  return mode === 'freeplay' ? readyGate() : { kind: 'card', left: Number.POSITIVE_INFINITY };
}

function readyGate(sec = INTRO_SEC): IntroGate {
  return { kind: 'ready', left: Math.max(0, sec) };
}

/** Pure: true while the intro holds the sim. */
export function introActive(g: IntroGate): boolean {
  return g.kind !== 'none' && g.left > 0;
}

/** Pure: advance by `dt` seconds of sim time. A card never times out. Ready ends as NO_INTRO. */
export function tickIntro(g: IntroGate, dt: number): IntroGate {
  if (!introActive(g)) return NO_INTRO;
  if (g.kind === 'card') return g;
  const left = g.left - Math.max(0, dt);
  return left > 1e-6 ? { kind: g.kind, left } : NO_INTRO; // epsilon: float sums of the fixed step
}

/** Pure: the Start button. Adventure plays at once; Endless shows Ready first. Only a card starts. */
export function startIntro(g: IntroGate, mode: IntroMode): IntroGate {
  if (g.kind !== 'card' || !introActive(g)) return g;
  return mode === 'adventure' ? NO_INTRO : readyGate();
}

function title(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function droneName(d: DroneKind): string {
  return `${title(d)} drone`;
}

export function superName(s: SuperKind): string {
  return `${title(s)} super`;
}

/** Pure: the arena's name for the title line. A cylinder surface reads as a drum. */
export function arenaName(def: { arena?: LevelDef['arena']; surface?: LevelDef['surface'] }): string {
  if (def.surface === 'cylinder') return 'Drum';
  if (def.arena === undefined) return '';
  switch (def.arena.shape) {
    case 'rect':
      return 'Rectangle';
    case 'roundRect':
      return 'Rounded';
    case 'circle':
      return 'Circle';
    case 'hexagon':
      return 'Hexagon';
    case 'rectObstacles':
      return 'Pillars';
  }
}

/** A labelled value: rendered as "<label>: <value>" or as a label over its value. */
export interface LabelledValue {
  readonly label: string;
  readonly value: string;
}

export const GOAL_LABEL = 'Goal';
export const VICTORY_LABEL = 'Victory';
export const STARS_LABEL = 'Star targets';
export const ENEMIES_LABEL = 'New enemies';
export const LOADOUT_LABEL = 'Loadout';
export const SEED_LABEL = 'Seed';

export interface IntroCard {
  /** "Level 6  Circle arena" or "Endless  Rectangle arena". */
  title: string;
  /** The goal in one plain sentence, no label ("Destroy 530 enemies before your lives run out"). */
  goal: string;
  /** What counts as a win, no label. */
  victory: string;
  /** Three labelled star targets ("1 star" over "2.1M"), [] in Endless. */
  stars: LabelledValue[];
  /** The difficulty cap on stars ("Normal: max 2 stars"), '' in Endless. */
  starCap: string;
  /** Kinds this run meets here for the first time. */
  enemies: FoeLine[];
  /** Drone, super (with what it does) and a par reward when one is armed. */
  loadout: LabelledValue[];
  /** The run seed, no label ("12345" or "12345 (typed)"), '' when unknown. */
  seed: string;
  /** "Difficulty: Normal" (docs/14 item 6), the chips' accessible summary. */
  difficulty: string;
  /** The difficulty chip marked on the card. */
  choice: Difficulty;
}

const DIFFICULTY_NAMES: Readonly<Record<Difficulty, string>> = { easy: 'Easy', normal: 'Normal', hard: 'Hard', insane: 'Insane' };

/** Pure: the difficulty line (also the chips' accessible summary). */
export function difficultyIntroLine(d: Difficulty): string {
  return `Difficulty: ${DIFFICULTY_NAMES[d]}`;
}

/** Pure: "Boss: <name>" for a level that carries a boss, '' for every other level. */
export function bossIntroLine(boss: BossSpec | undefined): string {
  return boss === undefined ? '' : `Boss: ${bossName(boss.id)}`;
}

type GoalDef = { objective: ObjectiveDef; boss?: BossSpec };

/** Pure: the goal in one plain sentence (R3 brief wording). */
export function goalSentence(def: GoalDef): string {
  if (def.boss !== undefined) return `Clear the waves, then defeat ${bossName(def.boss.id)}`;
  const o = def.objective;
  switch (o.kind) {
    case 'destroy':
      return `Destroy ${o.count} enemies before your lives run out`;
    case 'survive':
      return `Survive ${formatClock(o.durationSec)}`;
    case 'scoreInTime':
      return `Score ${formatCompact(o.target)} in ${formatClock(o.timeLimitSec)}`;
  }
}

function objectivePhrase(o: ObjectiveDef): string {
  switch (o.kind) {
    case 'destroy':
      return `${o.count} kills`;
    case 'survive':
      return `${formatClock(o.durationSec)} survived`;
    case 'scoreInTime':
      return `${formatCompact(o.target)} points when the ${formatClock(o.timeLimitSec)} clock runs out`;
  }
}

/** Pure: what counts as a win. Every win needs a life left; the sim's lives rule ends a run on 0. */
export function victorySentence(def: GoalDef): string {
  const base = objectivePhrase(def.objective);
  if (def.boss !== undefined) return `${base}, then ${bossName(def.boss.id)} destroyed, with a life left`;
  return `${base.charAt(0).toUpperCase()}${base.slice(1)} with a life left`;
}

/** Kept for menus and older callers: the objective as one sentence with a full stop. */
export function objectiveSentence(def: GoalDef): string {
  return `${goalSentence(def)}.`;
}

/** Pure: the three star targets as labelled columns ("1 star" over "2.1M"). */
export function starTargets(stars: readonly [number, number, number]): LabelledValue[] {
  return stars.map((v, i) => ({ label: i === 0 ? '1 star' : `${i + 1} stars`, value: formatCompact(v) }));
}

/** Pure: the difficulty cap on stars ("Normal: max 2 stars"; Insane adds the 4th star for a win). */
export function starCapLine(d: Difficulty): string {
  const cap = STAR_CAP[d];
  const head = `${DIFFICULTY_NAMES[d]}: max ${cap} ${cap === 1 ? 'star' : 'stars'}`;
  return d === 'insane' ? `${head}, plus a ${INSANE_STARS}th for a win` : head;
}

/** The Turbo numbers the loadout text is built from (src/game/supers.ts). */
export interface TurboNumbers {
  /** Fire rate multiplier. */
  readonly fire: number;
  /** Ship speed cap multiplier. */
  readonly speed: number;
  /** Enemies a shot passes through. */
  readonly pierce: number;
  /** Seconds the super lasts. */
  readonly durationSec: number;
}

export const TURBO_NUMBERS: TurboNumbers = { fire: TURBO_SCALE, speed: TURBO_SPEED_SCALE, pierce: TURBO_PIERCE, durationSec: SUPER_DURATION };

function trimNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Pure: what Turbo does, from its numbers ("doubles fire rate, 25% faster ship, shots pierce 1 enemy, 5 s"). */
export function turboText(n: TurboNumbers = TURBO_NUMBERS): string {
  const parts: string[] = [];
  parts.push(n.fire === 2 ? 'doubles fire rate' : `${trimNum(n.fire)}x fire rate`);
  if (n.speed > 1) parts.push(`${Math.round((n.speed - 1) * 100)}% faster ship`);
  if (n.pierce > 0) parts.push(`shots pierce ${n.pierce} ${n.pierce === 1 ? 'enemy' : 'enemies'}`);
  parts.push(`${trimNum(n.durationSec)} s`);
  return parts.join(', ');
}

/** Pure: what a super does, in brackets after its name on the loadout row. */
export function superDetail(s: SuperKind, turbo: TurboNumbers = TURBO_NUMBERS): string {
  switch (s) {
    case 'turbo':
      return turboText(turbo);
    case 'homing':
      return `shots home on nearby enemies, ${trimNum(SUPER_DURATION)} s`;
    case 'detonate':
      return 'your drone explodes and destroys the enemies around it';
  }
}

/** Pure: the loadout row: "Drone: Attack", "Super: Turbo (...)", and "Reward: ..." when armed. */
export function loadoutItems(drone: DroneKind, superType: SuperKind, reward = '', turbo: TurboNumbers = TURBO_NUMBERS): LabelledValue[] {
  const items: LabelledValue[] = [
    { label: 'Drone', value: title(drone) },
    { label: 'Super', value: `${title(superType)} (${superDetail(superType, turbo)})` },
  ];
  if (reward !== '') items.push({ label: 'Reward', value: reward });
  return items;
}

/** Pure: "Label: value". */
export function labelled(v: LabelledValue): string {
  return `${v.label}: ${v.value}`;
}

/** Pure: "Level 6  Circle arena", or just "Level 6" when the arena is unknown. */
export function titleLine(head: string, arena: string): string {
  return arena === '' ? head : `${head}  ${arena} arena`;
}

export interface IntroExtra {
  /** Kinds first met on this level (enemyIntro.newFoes). */
  newFoes?: readonly FoeKind[];
  /** Run seed text, no label. */
  seed?: string;
  /** Par reward armed for this level, '' for none. */
  reward?: string;
}

/** Pure: intro card text for an Adventure level. */
export function introCard(
  levelIndex: number,
  def: Pick<LevelDef, 'objective' | 'stars' | 'drone' | 'superType'> & { par?: number; boss?: BossSpec; arena?: LevelDef['arena']; surface?: LevelDef['surface'] },
  difficulty: Difficulty = 'normal',
  extra: IntroExtra = {},
): IntroCard {
  return {
    title: titleLine(`Level ${Math.max(1, Math.floor(levelIndex))}`, arenaName(def)),
    goal: goalSentence(def),
    victory: victorySentence(def),
    stars: starTargets(def.stars),
    starCap: starCapLine(difficulty),
    enemies: foeLines(extra.newFoes ?? []),
    loadout: loadoutItems(def.drone, def.superType, extra.reward ?? ''),
    seed: extra.seed ?? '',
    difficulty: difficultyIntroLine(difficulty),
    choice: difficulty,
  };
}

export const ENDLESS_GOAL = 'Survive as long as you can';
export const ENDLESS_VICTORY = 'None: the run ends when your lives run out, and score is all that counts';

/** Pure: intro card text for an Endless run. */
export function endlessIntroCard(
  def: { arena?: LevelDef['arena']; surface?: LevelDef['surface']; drone?: DroneKind; superType?: SuperKind },
  difficulty: Difficulty = 'normal',
  extra: IntroExtra = {},
): IntroCard {
  return {
    title: titleLine('Endless', arenaName(def)),
    goal: ENDLESS_GOAL,
    victory: ENDLESS_VICTORY,
    stars: [],
    starCap: '',
    enemies: foeLines(extra.newFoes ?? []),
    loadout: def.drone === undefined || def.superType === undefined ? [] : loadoutItems(def.drone, def.superType),
    seed: extra.seed ?? '',
    difficulty: difficultyIntroLine(difficulty),
    choice: difficulty,
  };
}

export interface IntroScreen extends Screen {
  showCard(card: IntroCard): void;
  showReady(): void;
}

/** A card block: a small label over its body. */
function block(name: string, label: string): { root: HTMLDivElement; body: HTMLDivElement } {
  const root = el('div', 'sow-block');
  root.setAttribute('data-intro', name);
  const body = el('div', 'sow-block-body');
  root.append(el('div', 'sow-block-label', label), body);
  return { root, body };
}

function kv(v: LabelledValue, cls = 'sow-kv'): HTMLDivElement {
  const row = el('div', cls);
  row.append(el('span', 'sow-k', `${v.label}: `), el('span', 'sow-v', v.value));
  return row;
}

/**
 * DOM edge. `onStart` fires on the Start button. `onDifficulty` fires on a chip tap (Easy, Normal,
 * Hard, Insane). A tap anywhere else on the card does nothing: only Start leaves it.
 */
export function createIntroScreen(parent: HTMLElement, onStart: () => void, onDifficulty: (d: Difficulty) => void = () => undefined): IntroScreen {
  const s = createScreen(parent);
  s.root.classList.add('sow-card-screen');
  const card = el('div', 'sow-card sow-intro');
  const head = el('div', 'sow-title');
  head.setAttribute('data-intro', 'title');
  const goal = block('goal', GOAL_LABEL);
  const goalText = el('div', 'sow-card-line sow-goal');
  goalText.setAttribute('data-intro', 'objective');
  const victory = el('div', 'sow-kv');
  victory.setAttribute('data-intro', 'victory');
  goal.body.append(goalText, victory);
  const play = el('div', 'sow-block sow-play');
  const diff = el('div', 'sow-chips');
  diff.setAttribute('data-intro', 'difficulty');
  diff.setAttribute('role', 'group');
  diff.setAttribute('aria-label', DIFFICULTY_ROW_LABEL);
  let choice: Difficulty = 'normal';
  const mark = (): void => {
    difficultyButtonStates(choice).forEach((st, i) => {
      const b = chips[i];
      if (b === undefined) return;
      b.classList.toggle('sow-on', st.selected);
      b.setAttribute('aria-pressed', String(st.selected));
    });
  };
  const chips = DIFFICULTIES.map((d) => {
    const b = button(difficultyLabel(d), () => {
      choice = d;
      mark();
      onDifficulty(d);
    });
    b.classList.add('sow-chip');
    if (d === 'insane') b.classList.add('sow-chip-insane');
    return b;
  });
  diff.append(...chips);
  const start = button(START_LABEL, onStart);
  start.classList.add('sow-big');
  start.setAttribute('data-intro', 'start');
  play.append(diff, start);
  const stars = block('stars', STARS_LABEL);
  const starCols = el('div', 'sow-cols');
  const starCap = el('div', 'sow-small');
  starCap.setAttribute('data-intro', 'starCap');
  stars.body.append(starCols, starCap);
  const foes = block('enemies', ENEMIES_LABEL);
  const loadout = block('loadout', LOADOUT_LABEL);
  const seed = el('div', 'sow-small sow-seed');
  seed.setAttribute('data-intro', 'seed');
  card.append(head, goal.root, play, stars.root, foes.root, loadout.root, seed);
  s.root.append(card);
  let shown = { stars: false, foes: false, loadout: false, seed: false };
  const show = (ready: boolean): void => {
    goal.root.style.display = ready ? 'none' : '';
    play.style.display = ready ? 'none' : '';
    diff.style.display = ready ? 'none' : '';
    start.style.display = ready ? 'none' : '';
    stars.root.style.display = ready || !shown.stars ? 'none' : '';
    foes.root.style.display = ready || !shown.foes ? 'none' : '';
    loadout.root.style.display = ready || !shown.loadout ? 'none' : '';
    seed.style.display = ready || !shown.seed ? 'none' : '';
    card.classList.toggle('sow-card-bare', ready);
    s.root.style.pointerEvents = ready ? 'none' : 'auto';
    s.root.style.background = ready ? 'transparent' : 'rgba(2, 4, 12, 0.55)';
    s.show();
  };
  return {
    ...s,
    showCard(c) {
      head.textContent = c.title;
      goalText.textContent = c.goal;
      victory.replaceChildren(el('span', 'sow-k', `${VICTORY_LABEL}: `), el('span', 'sow-v', c.victory));
      starCols.replaceChildren(
        ...c.stars.map((v) => {
          const col = el('div', 'sow-col');
          col.append(el('div', 'sow-col-label', v.label), el('div', 'sow-col-value', v.value));
          return col;
        }),
      );
      starCap.textContent = c.starCap;
      foes.body.replaceChildren(
        ...c.enemies.map((f) => {
          const row = el('div', 'sow-foe');
          row.setAttribute('data-foe-row', f.kind);
          row.append(iconCanvas(f.kind), el('span', 'sow-foe-name', f.name), el('span', 'sow-foe-type', f.type));
          return row;
        }),
      );
      loadout.body.replaceChildren(...c.loadout.map((v) => kv(v)));
      seed.textContent = c.seed === '' ? '' : `${SEED_LABEL}: ${c.seed}`;
      shown = { stars: c.stars.length > 0, foes: c.enemies.length > 0, loadout: c.loadout.length > 0, seed: c.seed !== '' };
      choice = c.choice;
      mark();
      show(false);
    },
    showReady() {
      head.textContent = READY_TEXT;
      show(true);
    },
  };
}
