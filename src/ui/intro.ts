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
// R5 (Ryan, build 64a20eb, intro 3.8): "minor clustering and developer information". Top to
// bottom, blocks at least 20 px apart in a card padded 24 px: title; Goal and Victory; Star targets
// with the cap; New enemies; Difficulty chips and Start; then a collapsed Details row (ui/details.ts)
// with the loadout and the seed, closed whenever the card is shown.
// R6 (Ryan, gate R5, intro 3.75): the title is "Level 12" only, the arena type and size move into
// Details; Goal and Victory sit in a two column label grid, labels left and statements right, one
// baseline per row; the chips carry no "Difficulty" label; par and the star targets follow the
// difficulty (core/stars.ts targetsFor).
// Start card (Ryan's device check on ab5e14d, 2026-11-10, the "focused stack"): the card had become
// crowded. Top to bottom, more padding: "LEVEL 6" small; the Mission type as the headline in a
// neon pixel frame; one plain goal line; the three star targets in one compact row; "New:" with
// enemy icons only (the story briefings introduce enemies); the difficulty chips; Start (primary,
// larger) beside Return to Menu; a collapsed Details row with the victory text, the star cap, the
// new enemies' short notes, loadout, arena and seed. Start and Return to Menu stick to the bottom
// of the card when it scrolls (cover screen, small phones), so both are always visible.
// The gate is pure and ticks on sim time, so a pause during Ready freezes it.
import { DIFFICULTIES, DIFFICULTY, type Difficulty } from '../core/difficulty';
import { INSANE_STARS, STAR_CAP, targetsFor, type ParScaleTable } from '../core/stars';
import { objectiveFor } from '../game/difficulty';
import { DETONATE_RADIUS, HOMING_RADIUS, SUPER_DURATION, TURBO_DURATION, TURBO_PIERCE, TURBO_SCALE, TURBO_SPEED_SCALE } from '../game/supers';
import type { BossSpec, DroneKind, LevelDef, ObjectiveDef, SuperKind } from '../levelgen/leveldef';
import { bossName } from './boss';
import { createDetails } from './details';
import { button, createScreen, el, type Screen } from './dom';
import { foeLines, iconCanvas, type FoeKind, type FoeLine } from './enemyIntro';
import { formatClock, formatCompact } from './format';
import { DIFFICULTY_ROW_LABEL, difficultyButtonStates, difficultyLabel } from './settings';
import { layoutPixels, runsPath, SHADOW_CELLS, VECTOR_CLASS, VECTOR_HOST_CLASS, setVectorText, type CellRun, type VectorTone } from './vectorFont';
import { bus } from '../core/events';
import { attachScrollbar } from './scrollbar';

/** Seconds the Endless and Free Play "Ready" text holds the sim. */
export const INTRO_SEC = 1.5;
export const READY_TEXT = 'Ready';
export const START_LABEL = 'Start';
export const MENU_LABEL = 'Return to Menu';

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
  if (def.surface === 'trough') return 'Trough';
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
export const ARENA_LABEL = 'Arena';
export const TROUGH_HINT = 'The ground slopes. Your ship slides toward the valley.';
export const HINT_LABEL = 'Surface';
export const NEW_LABEL = 'New:';
export const STAR_CAP_LABEL = 'Star cap';

/** The four Adventure mission types (Ryan 2026-11-10), each drawn in its own palette tone. */
export type MissionKind = 'rush' | 'hold' | 'seek' | 'guardian';

export interface Mission {
  readonly kind: MissionKind;
  /** The headline in the pixel font. */
  readonly label: string;
  /** Pixel font tone: colours come from the palette at the saturation applyNeon set. */
  readonly tone: VectorTone;
}

export const MISSIONS: Readonly<Record<MissionKind, Mission>> = {
  rush: { kind: 'rush', label: 'RUSH & SCORE', tone: 'yellow' },
  hold: { kind: 'hold', label: 'HOLD OUT', tone: 'cyan' },
  seek: { kind: 'seek', label: 'SEEK & DESTROY', tone: 'red' },
  guardian: { kind: 'guardian', label: 'GUARDIAN', tone: 'magenta' },
};

/** Pure: the mission type of an Adventure level. A boss level is a Guardian whatever its objective. */
export function missionFor(def: { objective: ObjectiveDef; boss?: BossSpec }): Mission {
  if (def.boss !== undefined) return MISSIONS.guardian;
  switch (def.objective.kind) {
    case 'scoreInTime':
      return MISSIONS.rush;
    case 'survive':
      return MISSIONS.hold;
    case 'destroy':
      return MISSIONS.seek;
  }
}

export interface IntroCard {
  /** "Level 6" or "Endless" (R6: the arena moved into Details). */
  title: string;
  /** The mission type headline, null on Endless (its card keeps its current text). */
  mission: Mission | null;
  /** The arena type and size for the Details row ("Circle 900 x 900"), '' when unknown. */
  arena: string;
  /** The goal in one plain sentence, no label ("Destroy 530 enemies before your lives run out"). */
  goal: string;
  /** What counts as a win, no label. */
  victory: string;
  /** Three labelled star targets ("1 star" over "2.1M"), [] in Endless. */
  stars: LabelledValue[];
  /** The difficulty cap on stars ("Normal: up to 2 stars"), '' in Endless. */
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
  if (def.boss !== undefined) return `Survive until ${bossName(def.boss.id)} arrives, then defeat it (${formatClock(def.boss.atSec)})`;
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
  if (def.boss !== undefined) return `${bossName(def.boss.id)} destroyed, with a life left`;
  const base = objectivePhrase(def.objective);
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

/** Pure: the difficulty cap on stars ("Normal: up to 2 stars"; Insane adds the 4th star for a win). */
export function starCapLine(d: Difficulty): string {
  const cap = STAR_CAP[d];
  const head = `${DIFFICULTY_NAMES[d]}: up to ${cap} ${cap === 1 ? 'star' : 'stars'}`;
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

export const TURBO_NUMBERS: TurboNumbers = { fire: TURBO_SCALE, speed: TURBO_SPEED_SCALE, pierce: TURBO_PIERCE, durationSec: TURBO_DURATION }; // R3: Turbo has its own 10 s duration

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

/** Pure: the arena type and size ("Circle 900 x 900", "Drum 1800 x 800"), '' when unknown. */
export function arenaDetail(def: { arena?: LevelDef['arena']; surface?: LevelDef['surface'] }): string {
  const name = arenaName(def);
  if (name === '') return '';
  const a = def.arena;
  if (a === undefined || !(a.width > 0) || !(a.height > 0)) return name;
  return `${name} ${Math.round(a.width)} x ${Math.round(a.height)}`;
}

/** Pure: "Label: value". */
export function labelled(v: LabelledValue): string {
  return `${v.label}: ${v.value}`;
}

export interface IntroExtra {
  /** Kinds first met on this level (enemyIntro.newFoes). */
  newFoes?: readonly FoeKind[];
  /** Run seed text, no label. */
  seed?: string;
  /** Par reward armed for this level, '' for none. */
  reward?: string;
}

/**
 * Pure: intro card text for an Adventure level. R6: the star targets are the level's own times
 * the difficulty's parScale (`table` is DIFFICULTY outside tests); so is a scoreInTime goal.
 */
export function introCard(
  levelIndex: number,
  def: Pick<LevelDef, 'objective' | 'stars' | 'drone' | 'superType'> & { par?: number; difficultyPar?: LevelDef['difficultyPar']; boss?: BossSpec; arena?: LevelDef['arena']; surface?: LevelDef['surface'] },
  difficulty: Difficulty = 'normal',
  extra: IntroExtra = {},
  table: ParScaleTable = DIFFICULTY,
): IntroCard {
  // Tester 1: the goal reads the target the sim plays (createGame scales it the same way).
  const goal: GoalDef = { ...(def.boss === undefined ? {} : { boss: def.boss }), objective: objectiveFor(def.objective, difficulty, table, def.difficultyPar?.[difficulty]?.goal) };
  return {
    title: `Level ${Math.max(1, Math.floor(levelIndex))}`,
    mission: missionFor(goal),
    arena: arenaDetail(def),
    goal: goalSentence(goal),
    victory: victorySentence(goal),
    stars: starTargets(targetsFor({ par: def.par ?? 0, stars: def.stars, ...(def.difficultyPar === undefined ? {} : { difficultyPar: def.difficultyPar }) }, difficulty, table).stars),
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
    title: 'Endless',
    mission: null,
    arena: arenaDetail(def),
    goal: ENDLESS_GOAL,
    victory: ENDLESS_VICTORY,
    stars: [],
    starCap: '',
    // Ryan (polish r9): no New enemies block on the Endless card, the How to guide covers them.
    enemies: [],
    loadout: def.drone === undefined || def.superType === undefined ? [] : loadoutItems(def.drone, def.superType),
    seed: extra.seed ?? '',
    difficulty: difficultyIntroLine(difficulty),
    choice: difficulty,
  };
}

/**
 * Pure: the Details row of a card, top to bottom: Victory, the star cap, the new enemies' short
 * notes ("Grunt chaser"), the loadout rows, "Arena Circle 900 x 900", then "Seed 12345".
 */
export function introDetails(
  c: Pick<IntroCard, 'loadout' | 'seed'> & { arena?: string; victory?: string; starCap?: string; enemies?: readonly FoeLine[] },
): LabelledValue[] {
  const out: LabelledValue[] = [];
  if (c.victory !== undefined && c.victory !== '') out.push({ label: VICTORY_LABEL, value: c.victory });
  if (c.starCap !== undefined && c.starCap !== '') out.push({ label: STAR_CAP_LABEL, value: c.starCap });
  for (const f of c.enemies ?? []) out.push({ label: f.name, value: f.type });
  out.push(...c.loadout);
  if (c.arena !== undefined && c.arena !== '') out.push({ label: ARENA_LABEL, value: c.arena });
  if (c.arena !== undefined && c.arena.startsWith('Trough')) out.push({ label: HINT_LABEL, value: TROUGH_HINT });
  if (c.seed !== '') out.push({ label: SEED_LABEL, value: c.seed });
  return out;
}

/** Cells of space between the mission text and its frame, and the frame's thickness. */
export const FRAME_PAD_X = 3;
export const FRAME_PAD_Y = 2;
export const FRAME_CELLS = 1;

/** Pure: a pixel frame around `text`, in cells: the frame runs, the text runs inside it, the size. */
export function framedPixels(text: string): { d: string; viewBox: string; wCells: number; hCells: number } {
  const L = layoutPixels(text);
  const inset = FRAME_CELLS + FRAME_PAD_X;
  const top = FRAME_CELLS + FRAME_PAD_Y;
  const w = L.width + 2 * inset;
  const h = 7 + 2 * top;
  const runs: CellRun[] = L.runs.map(([x, y, n]) => [x + inset, y + top, n]);
  for (let t = 0; t < FRAME_CELLS; t++) {
    runs.push([0, t, w], [0, h - 1 - t, w]);
    for (let y = FRAME_CELLS; y < h - FRAME_CELLS; y++) runs.push([t, y, 1], [w - 1 - t, y, 1]);
  }
  const wCells = w + SHADOW_CELLS;
  const hCells = h + SHADOW_CELLS;
  return { d: runsPath(runs), viewBox: `0 0 ${wCells} ${hCells}`, wCells, hCells };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * DOM edge: the mission headline, its text and frame drawn as one pixel font SVG, so the shared
 * pixel stylesheet (vectorFont, fed by applyNeon) colours and glows both in the mission's tone.
 */
function setFramedText(host: HTMLElement, m: Mission): void {
  const box = framedPixels(m.label);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `${VECTOR_CLASS} ${VECTOR_CLASS}-${m.tone}`);
  svg.setAttribute('viewBox', box.viewBox);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('style', `--sow-cw: ${box.wCells}; --sow-ch: ${box.hCells}`);
  svg.setAttribute('data-vec', m.label);
  const shadow = document.createElementNS(SVG_NS, 'path');
  shadow.setAttribute('class', `${VECTOR_CLASS}-sh`);
  shadow.setAttribute('d', box.d);
  shadow.setAttribute('transform', `translate(${SHADOW_CELLS} ${SHADOW_CELLS})`);
  const fg = document.createElementNS(SVG_NS, 'path');
  fg.setAttribute('class', `${VECTOR_CLASS}-fg`);
  fg.setAttribute('d', box.d);
  svg.append(shadow, fg);
  const sr = document.createElement('span');
  sr.className = 'sow-sr';
  sr.textContent = m.label;
  host.classList.add(VECTOR_HOST_CLASS);
  host.setAttribute('aria-label', m.label);
  host.setAttribute('data-mission', m.kind);
  host.replaceChildren(svg, sr);
}

/**
 * The start card's own rules, injected once beside the shared sheet. More padding than R5; Start and
 * Return to Menu stick to the bottom of the card when it scrolls, so both stay on screen.
 */
export const INTRO_CSS = `
.sow-card.sow-intro.sow-focus { --sow-intro-pad: clamp(20px, 4.5vmin, 36px);
  padding: var(--sow-intro-pad) clamp(22px, 5vmin, 40px); gap: clamp(10px, 2.2vmin, 18px); width: min(600px, 100%); }
.sow-intro.sow-focus .sow-title.sow-kicker { font-size: 16px; opacity: 0.85; }
.sow-intro-mission { font-size: clamp(20px, 4.2vmin, 30px); line-height: 1; padding: 2px 0; }
.sow-intro-goal { font-size: clamp(15px, 3.4vmin, 20px); font-weight: 700; }
.sow-intro-stars { display: flex; justify-content: center; gap: 8px; width: 100%; }
.sow-intro-star { display: flex; align-items: baseline; gap: 6px; padding: 4px 10px; border-radius: 8px;
  border: 1px solid hsla(55, 95%, 62%, 0.4); white-space: nowrap; }
.sow-intro-star .sow-col-label { font-size: 12px; opacity: 0.75; }
.sow-intro-star .sow-col-value { font-size: clamp(15px, 3.4vmin, 19px); font-weight: 700; color: hsl(55, 95%, 70%); }
.sow-intro-new { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; }
.sow-intro-icons { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.sow-intro-foe { display: inline-flex; }
.sow-intro-new-label { font-size: 13px; letter-spacing: 0.08em; opacity: 0.75; }
.sow-intro-actions { display: flex; gap: 10px; width: 100%; position: sticky; bottom: calc(-1 * var(--sow-intro-pad));
  z-index: 1; padding: 6px 0; background: rgba(2, 6, 16, 0.94); }
.sow-intro-actions .sow-btn.sow-big { min-height: 56px; }
.sow-intro-actions .sow-btn.sow-big.sow-intro-start { flex: 1.4 1 0; min-height: 64px; font-size: 26px; }
.sow-intro-actions .sow-btn.sow-big.sow-intro-menu { flex: 1 1 0; }
@media (max-width: 440px) {
  .sow-intro-actions { flex-wrap: wrap; }
  .sow-intro-actions .sow-btn.sow-big.sow-intro-start, .sow-intro-actions .sow-btn.sow-big.sow-intro-menu { flex: 1 1 100%; }
}
@media (max-height: 520px) {
  .sow-card.sow-intro.sow-focus { --sow-intro-pad: 10px; gap: 6px; }
  .sow-intro-mission { font-size: 20px; padding: 0; }
  .sow-intro-actions { padding: 2px 0; }
  .sow-intro-actions .sow-btn.sow-big.sow-intro-start { min-height: 60px; }
  .sow-intro .sow-btn.sow-big.sow-details-toggle { min-height: 44px; }
}
`;

export const INTRO_STYLE_ID = 'sow-intro-style';

/** DOM edge: add INTRO_CSS once. Skipped where the document has no head (node tests). */
function ensureIntroStyle(): void {
  const doc = typeof document === 'undefined' ? undefined : (document as Partial<Document>);
  if (doc?.head === undefined || doc.getElementById === undefined || doc.createElement === undefined) return;
  if (doc.getElementById(INTRO_STYLE_ID) !== null) return;
  const st = doc.createElement('style');
  st.id = INTRO_STYLE_ID;
  st.textContent = INTRO_CSS;
  doc.head.append(st);
}

export interface IntroScreen extends Screen {
  showCard(card: IntroCard): void;
  showReady(): void;
}

function mark(e: HTMLElement, name: string): void {
  e.setAttribute('data-intro', name);
}

/**
 * DOM edge. `onStart` fires on Start, `onMenu` on Return to Menu (back to the main menu without
 * starting the level). `onDifficulty` fires on a chip tap (Easy, Normal, Hard, Insane). A tap
 * anywhere else on the card does nothing: only Start and Return to Menu leave it.
 */
export function createIntroScreen(
  parent: HTMLElement,
  onStart: () => void,
  onDifficulty: (d: Difficulty) => void = () => undefined,
  onMenu: () => void = () => undefined,
): IntroScreen {
  ensureIntroStyle();
  const s = createScreen(parent);
  s.root.classList.add('sow-card-screen');
  const card = el('div', 'sow-card sow-intro');
  const head = el('div', 'sow-title');
  mark(head, 'title');
  const mission = el('div', 'sow-intro-mission');
  mark(mission, 'mission');
  // One plain goal line; the victory text moved into Details.
  const goal = el('div', 'sow-block');
  mark(goal, 'goal');
  const goalText = el('div', 'sow-intro-goal sow-goal');
  mark(goalText, 'objective');
  goal.append(goalText);
  const stars = el('div', 'sow-intro-stars');
  mark(stars, 'stars');
  stars.setAttribute('aria-label', STARS_LABEL);
  const foes = el('div', 'sow-intro-new');
  mark(foes, 'enemies');
  foes.setAttribute('aria-label', ENEMIES_LABEL);
  const foeIcons = el('div', 'sow-intro-icons');
  foes.append(el('span', 'sow-intro-new-label', NEW_LABEL), foeIcons);
  const diff = el('div', 'sow-chips');
  mark(diff, 'difficulty');
  diff.setAttribute('role', 'group');
  diff.setAttribute('aria-label', DIFFICULTY_ROW_LABEL);
  let choice: Difficulty = 'normal';
  const markChips = (): void => {
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
      markChips();
      onDifficulty(d);
    });
    b.classList.add('sow-chip');
    if (d === 'insane') b.classList.add('sow-chip-insane');
    return b;
  });
  diff.append(...chips); // R6: the chips alone, no "Difficulty" label
  const play = el('div', 'sow-intro-actions');
  mark(play, 'play');
  const start = button(START_LABEL, onStart);
  start.classList.add('sow-big', 'sow-intro-start');
  setVectorText(start, START_LABEL, { tone: 'white' });
  mark(start, 'start');
  const menu = button(MENU_LABEL, onMenu);
  menu.classList.add('sow-big', 'sow-intro-menu');
  setVectorText(menu, MENU_LABEL, { tone: 'white' });
  mark(menu, 'menu');
  play.append(start, menu);
  const details = createDetails('data-intro');
  card.append(head, mission, goal, stars, foes, diff, play, details.root);
  s.root.append(card);
  attachScrollbar(card, bus);
  let shown = { mission: false, stars: false, foes: false, details: false };
  const show = (ready: boolean): void => {
    const vis = (e: HTMLElement, on: boolean): void => {
      e.style.display = on ? '' : 'none';
    };
    vis(mission, !ready && shown.mission);
    vis(goal, !ready);
    vis(stars, !ready && shown.stars);
    vis(foes, !ready && shown.foes);
    vis(diff, !ready);
    vis(play, !ready);
    vis(start, !ready);
    vis(menu, !ready);
    vis(details.root, !ready && shown.details);
    card.classList.toggle('sow-card-bare', ready);
    card.classList.toggle('sow-focus', !ready);
    head.classList.toggle('sow-kicker', !ready);
    s.root.style.pointerEvents = ready ? 'none' : 'auto';
    s.root.style.background = ready ? 'transparent' : 'rgba(2, 4, 12, 0.55)';
    s.show();
  };
  return {
    ...s,
    showCard(c) {
      setVectorText(head, c.title);
      if (c.mission !== null) setFramedText(mission, c.mission);
      else mission.replaceChildren();
      goalText.textContent = c.goal;
      stars.replaceChildren(
        ...c.stars.map((v) => {
          const col = el('div', 'sow-intro-star');
          col.append(el('span', 'sow-col-label', v.label), el('span', 'sow-col-value', v.value));
          return col;
        }),
      );
      foeIcons.replaceChildren(
        ...c.enemies.map((f) => {
          const icon = el('span', 'sow-intro-foe');
          icon.setAttribute('data-foe-row', f.kind);
          icon.setAttribute('role', 'img');
          icon.setAttribute('aria-label', f.name);
          icon.append(iconCanvas(f.kind));
          return icon;
        }),
      );
      const items = introDetails(c);
      details.fill(items);
      shown = { mission: c.mission !== null, stars: c.stars.length > 0, foes: c.enemies.length > 0, details: items.length > 0 };
      choice = c.choice;
      markChips();
      show(false);
      card.scrollTop = 0;
    },
    showReady() {
      setVectorText(head, READY_TEXT);
      show(true);
    },
  };
}
