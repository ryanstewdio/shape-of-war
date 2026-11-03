// Level intro card and Endless "Ready" text (B7, docs/01 section 10). The card shows the level
// number, objective, par and star thresholds, drone and super, boss and difficulty; it holds the sim for 1.5 s and a
// tap skips it. Endless gets a 1.5 s "Ready" text instead, which does not take touches, so the
// thumbs can settle on the sticks. The gate is pure and ticks on sim time, so a pause during the
// intro freezes it.
import { DIFFICULTIES, type Difficulty } from '../core/difficulty';
import type { BossSpec, DroneKind, LevelDef, SuperKind } from '../levelgen/leveldef';
import { bossName } from './boss';
import { button, createScreen, el, type Screen } from './dom';
import { DIFFICULTY_ROW_LABEL, difficultyButtonStates, difficultyLabel } from './settings';
import { formatInt } from './format';
import type { Mode } from './flow';
import { objectiveText } from './objective';

/** Seconds the intro card or the Ready text holds the sim. */
export const INTRO_SEC = 1.5;
export const READY_TEXT = 'Ready';

export interface IntroGate {
  readonly kind: 'card' | 'ready' | 'none';
  /** Seconds left. */
  readonly left: number;
}

export const NO_INTRO: IntroGate = { kind: 'none', left: 0 };

/** Pure: the gate at the start of a run: card for Adventure, Ready for Endless. */
export function armIntro(mode: Mode, sec = INTRO_SEC): IntroGate {
  return { kind: mode === 'endless' ? 'ready' : 'card', left: Math.max(0, sec) };
}

/** Pure: true while the intro holds the sim. */
export function introActive(g: IntroGate): boolean {
  return g.kind !== 'none' && g.left > 0;
}

/** Pure: advance by `dt` seconds of sim time. Ends as NO_INTRO. */
export function tickIntro(g: IntroGate, dt: number): IntroGate {
  if (!introActive(g)) return NO_INTRO;
  const left = g.left - Math.max(0, dt);
  return left > 1e-6 ? { kind: g.kind, left } : NO_INTRO; // epsilon: float sums of the fixed step
}

/** Pure: a tap skips the card. The Ready text is not skippable (it takes no touches). */
export function skipIntro(g: IntroGate): IntroGate {
  return g.kind === 'card' ? NO_INTRO : g;
}

/**
 * Pure (R1): a tap on the card's Difficulty selector holds the card until the player taps the card
 * to start, so the choice is never cut off by the 1.5 s timer. Only an active card can be held.
 */
export function holdIntro(g: IntroGate): IntroGate {
  return g.kind === 'card' && introActive(g) ? { kind: 'card', left: Number.POSITIVE_INFINITY } : g;
}

/** Pure: true while a held card waits for a tap. */
export function introHeld(g: IntroGate): boolean {
  return g.kind === 'card' && g.left === Number.POSITIVE_INFINITY;
}

export const INTRO_SKIP_HINT = 'tap to skip';
export const INTRO_HELD_HINT = 'tap to start';

function title(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function droneName(d: DroneKind): string {
  return `${title(d)} drone`;
}

export function superName(s: SuperKind): string {
  return `${title(s)} super`;
}

export interface IntroCard {
  title: string;
  objective: string;
  par: string;
  kit: string;
  /** "Boss: <name>" on a boss level, '' otherwise (docs/13 section 9). */
  boss: string;
  /** "Difficulty: Normal" (docs/14 item 6). */
  difficulty: string;
  /** R1: the difficulty marked on the card's four way selector. */
  choice: Difficulty;
}

const DIFFICULTY_NAMES: Readonly<Record<Difficulty, string>> = { easy: 'Easy', normal: 'Normal', hard: 'Hard', insane: 'Insane' };

/** Pure: the difficulty line on the intro card. */
export function difficultyIntroLine(d: Difficulty): string {
  return `Difficulty: ${DIFFICULTY_NAMES[d]}`;
}

/** Pure: "Boss: <name>" for a level that carries a boss, '' for every other level. */
export function bossIntroLine(boss: BossSpec | undefined): string {
  return boss === undefined ? '' : `Boss: ${bossName(boss.id)}`;
}

/** Pure: intro card text for an Adventure level. */
export function introCard(
  levelIndex: number,
  def: Pick<LevelDef, 'objective' | 'par' | 'stars' | 'drone' | 'superType'> & { boss?: BossSpec },
  difficulty: Difficulty = 'normal',
): IntroCard {
  const [s1, s2, s3] = def.stars;
  return {
    title: `Level ${Math.max(1, Math.floor(levelIndex))}`,
    objective: objectiveText(def.objective),
    par: `Par ${formatInt(def.par)}   ★ ${formatInt(s1)}  ★★ ${formatInt(s2)}  ★★★ ${formatInt(s3)}`,
    kit: `${droneName(def.drone)}   ${superName(def.superType)}`,
    boss: bossIntroLine(def.boss),
    difficulty: difficultyIntroLine(difficulty),
    choice: difficulty,
  };
}

export interface IntroScreen extends Screen {
  /** `held`: the card waits for a tap (after a Difficulty change); the hint reads "tap to start". */
  showCard(card: IntroCard, held?: boolean): void;
  showReady(): void;
}

/**
 * DOM edge. `onSkip` fires on a tap on the card. `onDifficulty` fires on a tap on the card's
 * Difficulty selector (Easy, Normal, Hard, Insane); a selector tap never skips the card.
 */
export function createIntroScreen(
  parent: HTMLElement,
  onSkip: () => void,
  onDifficulty: (d: Difficulty) => void = () => undefined,
): IntroScreen {
  const s = createScreen(parent);
  s.root.style.background = 'rgba(2, 4, 12, 0.45)';
  const head = el('div', 'sow-title');
  const objective = el('div', 'sow-sub');
  objective.style.fontSize = '20px';
  const par = el('div', 'sow-sub');
  const kit = el('div', 'sow-sub');
  const boss = el('div', 'sow-sub');
  boss.style.fontWeight = '700';
  boss.setAttribute('data-intro', 'boss');
  // R1: the Difficulty line is a four way selector, the same row shape as the Settings row.
  const diff = el('div', 'sow-choice');
  diff.setAttribute('data-intro', 'difficulty');
  diff.setAttribute('role', 'group');
  diff.setAttribute('aria-label', DIFFICULTY_ROW_LABEL);
  diff.style.width = 'min(520px, 90%)';
  let choice: Difficulty = 'normal';
  const mark = (): void => {
    difficultyButtonStates(choice).forEach((st, i) => {
      const b = diffButtons[i];
      if (b === undefined) return;
      b.classList.toggle('sow-on', st.selected);
      b.setAttribute('aria-pressed', String(st.selected));
    });
  };
  const diffButtons = DIFFICULTIES.map((d) =>
    button(difficultyLabel(d), () => {
      choice = d;
      mark();
      onDifficulty(d);
    }),
  );
  const diffBtns = el('div', 'sow-choice-btns');
  diffBtns.append(...diffButtons);
  diff.append(el('div', 'sow-choice-label', DIFFICULTY_ROW_LABEL), diffBtns);
  const hint = el('div', 'sow-small', INTRO_SKIP_HINT);
  s.root.append(head, objective, par, kit, boss, diff, hint);
  let armed = -1;
  s.root.addEventListener('pointerdown', (e) => {
    armed = e.pointerId;
  });
  s.root.addEventListener('pointerup', (e) => {
    if (armed !== e.pointerId) return;
    armed = -1;
    onSkip();
  });
  const show = (ready: boolean): void => {
    for (const e of [objective, par, kit, diff, hint]) e.style.display = ready ? 'none' : '';
    boss.style.display = ready || boss.textContent === '' ? 'none' : '';
    s.root.style.pointerEvents = ready ? 'none' : 'auto';
    s.root.style.background = ready ? 'transparent' : 'rgba(2, 4, 12, 0.45)';
    s.show();
  };
  return {
    ...s,
    showCard(card, held = false) {
      head.textContent = card.title;
      objective.textContent = card.objective;
      par.textContent = card.par;
      kit.textContent = card.kit;
      boss.textContent = card.boss;
      choice = card.choice;
      mark();
      hint.textContent = held ? INTRO_HELD_HINT : INTRO_SKIP_HINT;
      show(false);
    },
    showReady() {
      head.textContent = READY_TEXT;
      show(true);
    },
  };
}
