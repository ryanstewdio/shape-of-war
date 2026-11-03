// Level intro card (B7, docs/01 section 10), redesigned in R2.
// R2 (Ryan): difficulty is chosen at the start of every Adventure level and every Endless run. The
// card holds the sim with no timer until the player taps Start; the four difficulty chips sit on
// the card with the last choice preselected, and a chip tap rebuilds the world at that difficulty
// (main.ts). Endless then shows a 1.5 s "Ready" text so the thumbs can settle on the sticks; Free
// Play chooses its difficulty on its own options screen and goes straight to Ready.
// Card layout, top to bottom: a title line (level number and arena), the objective in one
// sentence, the difficulty chips, the three star marks as numbers, kit and boss in small print,
// and the Start button. The gate is pure and ticks on sim time, so a pause during Ready freezes it.
import { DIFFICULTIES, type Difficulty } from '../core/difficulty';
import type { BossSpec, DroneKind, LevelDef, SuperKind } from '../levelgen/leveldef';
import { bossName } from './boss';
import { button, createScreen, el, type Screen } from './dom';
import { formatInt } from './format';
import { objectiveText } from './objective';
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

export interface IntroCard {
  /** "Level 6  Circle arena" or "Endless  Rectangle arena". */
  title: string;
  /** The objective in one sentence. */
  objective: string;
  /** The three star marks as numbers, '' in Endless. */
  stars: string;
  /** Kit line: drone and super. '' in Endless. */
  kit: string;
  /** "Boss: <name>" on a boss level, '' otherwise (docs/13 section 9). */
  boss: string;
  /** "Difficulty: Normal" (docs/14 item 6). */
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

/** Pure: the objective as one sentence. */
export function objectiveSentence(def: Pick<LevelDef, 'objective'> & { boss?: BossSpec }): string {
  const base = objectiveText(def.objective);
  return def.boss === undefined ? `${base}.` : `${base}, then defeat the boss.`;
}

/** Pure: "★ 1,000   ★★ 1,250   ★★★ 1,500" from LevelDef.stars. */
export function starMarksLine(stars: readonly [number, number, number]): string {
  const [s1, s2, s3] = stars;
  return `★ ${formatInt(s1)}   ★★ ${formatInt(s2)}   ★★★ ${formatInt(s3)}`;
}

/** Pure: "Level 6  Circle arena", or just "Level 6" when the arena is unknown. */
export function titleLine(head: string, arena: string): string {
  return arena === '' ? head : `${head}  ${arena} arena`;
}

/** Pure: intro card text for an Adventure level. */
export function introCard(
  levelIndex: number,
  def: Pick<LevelDef, 'objective' | 'par' | 'stars' | 'drone' | 'superType'> & { boss?: BossSpec; arena?: LevelDef['arena']; surface?: LevelDef['surface'] },
  difficulty: Difficulty = 'normal',
): IntroCard {
  return {
    title: titleLine(`Level ${Math.max(1, Math.floor(levelIndex))}`, arenaName(def)),
    objective: objectiveSentence(def),
    stars: starMarksLine(def.stars),
    kit: `${droneName(def.drone)}   ${superName(def.superType)}`,
    boss: bossIntroLine(def.boss),
    difficulty: difficultyIntroLine(difficulty),
    choice: difficulty,
  };
}

/** Pure: intro card text for an Endless run. */
export function endlessIntroCard(def: { arena?: LevelDef['arena']; surface?: LevelDef['surface'] }, difficulty: Difficulty = 'normal'): IntroCard {
  return {
    title: titleLine('Endless', arenaName(def)),
    objective: 'Survive as long as you can. Score is all that counts.',
    stars: '',
    kit: '',
    boss: '',
    difficulty: difficultyIntroLine(difficulty),
    choice: difficulty,
  };
}

export interface IntroScreen extends Screen {
  showCard(card: IntroCard): void;
  showReady(): void;
}

/**
 * DOM edge. `onStart` fires on the Start button. `onDifficulty` fires on a chip tap (Easy, Normal,
 * Hard, Insane). A tap anywhere else on the card does nothing: only Start leaves it.
 */
export function createIntroScreen(parent: HTMLElement, onStart: () => void, onDifficulty: (d: Difficulty) => void = () => undefined): IntroScreen {
  const s = createScreen(parent);
  s.root.classList.add('sow-card-screen');
  const card = el('div', 'sow-card');
  const head = el('div', 'sow-title');
  head.setAttribute('data-intro', 'title');
  const objective = el('div', 'sow-card-line');
  objective.setAttribute('data-intro', 'objective');
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
  const stars = el('div', 'sow-stars sow-card-stars');
  stars.setAttribute('data-intro', 'stars');
  const kit = el('div', 'sow-small');
  const boss = el('div', 'sow-card-line');
  boss.style.fontWeight = '700';
  boss.setAttribute('data-intro', 'boss');
  const start = button(START_LABEL, onStart);
  start.classList.add('sow-big');
  start.setAttribute('data-intro', 'start');
  card.append(head, objective, diff, stars, kit, boss, start);
  s.root.append(card);
  const show = (ready: boolean): void => {
    for (const e of [objective, diff, stars, kit, start]) e.style.display = ready ? 'none' : '';
    if (!ready) {
      stars.style.display = stars.textContent === '' ? 'none' : '';
      kit.style.display = kit.textContent === '' ? 'none' : '';
    }
    boss.style.display = ready || boss.textContent === '' ? 'none' : '';
    card.classList.toggle('sow-card-bare', ready);
    s.root.style.pointerEvents = ready ? 'none' : 'auto';
    s.root.style.background = ready ? 'transparent' : 'rgba(2, 4, 12, 0.55)';
    s.show();
  };
  return {
    ...s,
    showCard(c) {
      head.textContent = c.title;
      objective.textContent = c.objective;
      stars.textContent = c.stars;
      kit.textContent = c.kit;
      boss.textContent = c.boss;
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
