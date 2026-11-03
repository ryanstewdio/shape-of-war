// R2 Free Play: a main menu item that opens this options screen. Difficulty (four), arena
// (rectangle, circle, drum) and barriers on or off; Start builds the run with freePlayLevel and
// createEndlessGame (main.ts), with space physics from the difficulty. No stars and no bests;
// the results show score and time. The choices persist for the session only (no storage key).
import { DIFFICULTIES, type Difficulty } from '../core/difficulty';
import type { FreePlayArena } from '../levelgen/freeplay';
import { button, createScreen, el, type Screen } from './dom';
import { DIFFICULTY_ROW_LABEL, difficultyLabel } from './settings';

export const FREE_PLAY_TITLE = 'Free Play';
export const ARENA_ROW_LABEL = 'Arena';
export const BARRIERS_ROW_LABEL = 'Barriers';
export const FREE_PLAY_ARENAS: readonly FreePlayArena[] = ['rect', 'circle', 'drum'];

export interface FreePlayChoice {
  readonly difficulty: Difficulty;
  readonly arena: FreePlayArena;
  readonly barriers: boolean;
}

export const DEFAULT_FREE_PLAY: FreePlayChoice = { difficulty: 'normal', arena: 'rect', barriers: false };

const ARENA_LABELS: Readonly<Record<FreePlayArena, string>> = { rect: 'Rectangle', circle: 'Circle', drum: 'Drum' };

/** Pure: the label on one arena button. */
export function arenaLabel(a: FreePlayArena): string {
  return ARENA_LABELS[a];
}

/** Pure: the text on a barriers button. */
export function barriersLabel(on: boolean): string {
  return on ? 'On' : 'Off';
}

/** Pure: one line summary, also the Start button's accessible name. */
export function freePlaySummary(c: FreePlayChoice): string {
  return `${difficultyLabel(c.difficulty)}, ${arenaLabel(c.arena)} arena, barriers ${c.barriers ? 'on' : 'off'}`;
}

export interface FreePlayActions {
  start(choice: FreePlayChoice): void;
  back(): void;
}

export interface FreePlayScreen extends Screen {
  /** Open with this choice marked (main.ts passes the last one, with the last card difficulty). */
  open(choice: FreePlayChoice): void;
  current(): FreePlayChoice;
}

function choiceRow<T>(label: string, values: readonly T[], text: (v: T) => string, pick: (v: T) => void): { row: HTMLDivElement; mark(v: T): void } {
  const row = el('div', 'sow-choice');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', label);
  const buttons = values.map((v) => button(text(v), () => pick(v)));
  const btns = el('div', 'sow-choice-btns');
  btns.append(...buttons);
  row.append(el('div', 'sow-choice-label', label), btns);
  return {
    row,
    mark(cur) {
      values.forEach((v, i) => {
        const b = buttons[i];
        if (b === undefined) return;
        b.classList.toggle('sow-on', v === cur);
        b.setAttribute('aria-pressed', String(v === cur));
      });
    },
  };
}

export function createFreePlayScreen(parent: HTMLElement, actions: FreePlayActions): FreePlayScreen {
  const s = createScreen(parent);
  s.root.classList.add('sow-card-screen');
  const card = el('div', 'sow-card');
  const title = el('div', 'sow-title', FREE_PLAY_TITLE);
  const note = el('div', 'sow-small', 'Endless waves in the arena you choose. No stars, no bests.');
  let choice: FreePlayChoice = DEFAULT_FREE_PLAY;
  const paint = (): void => {
    diff.mark(choice.difficulty);
    arena.mark(choice.arena);
    barriers.mark(choice.barriers);
    start.setAttribute('aria-label', `Start: ${freePlaySummary(choice)}`);
  };
  const set = (patch: Partial<FreePlayChoice>): void => {
    choice = { ...choice, ...patch };
    paint();
  };
  const diff = choiceRow(DIFFICULTY_ROW_LABEL, DIFFICULTIES, difficultyLabel, (d) => set({ difficulty: d }));
  const arena = choiceRow(ARENA_ROW_LABEL, FREE_PLAY_ARENAS, arenaLabel, (a) => set({ arena: a }));
  const barriers = choiceRow(BARRIERS_ROW_LABEL, [true, false], barriersLabel, (b) => set({ barriers: b }));
  const start = button('Start', () => actions.start(choice));
  start.classList.add('sow-big');
  const back = button('Back', actions.back);
  back.classList.add('sow-big');
  const row = el('div', 'sow-row');
  row.append(start, back);
  card.append(title, note, diff.row, arena.row, barriers.row, row);
  s.root.append(card);
  paint();
  return {
    ...s,
    open(c) {
      choice = c;
      paint();
      s.show();
    },
    current: () => choice,
  };
}
