// Title and menu themes (music v3.6, three themes since G6). Ryan: "we will want 2 to 4 menu theme
// songs total so it does not lose value or begin to annoy users". Three original compositions in
// the 1980 to 2000 console idiom, each with its own hook, mode, tempo and lead, all in the same
// calm spacey register. Each theme loops A, B, C (8 bars each, 24 bar loop), so the hook comes
// back every 24 bars, not every 8:
//   A, the hook: the theme's lead over pads, a pulsing bass and a soft kick and hat.
//   B, the answer: a second lead colour, a lighter beat (one kick a bar, no hat).
//   C, the calm: long notes on a soft lead, wind under the pads, a long echo, no drums.
// They quote no existing game theme.
//
//   0 Aurora: E lydian, 100 BPM, 25 percent pulse lead. The raised fourth (A#) floats.
//   1 Tide:   D dorian, 88 BPM, triangle lead. The raised sixth (B over Dm) glows.
//   2 Orbit:  A mixolydian, 112 BPM, filtered saw lead in eighths. The flat seventh (G) drifts.
//
// Rotation: a new theme each time the app boots or the player comes back to the menu from a
// level, in the fixed order 0, 1, 2, 0, ... The last theme played goes to an injected store
// (MenuThemeStore), so a fresh boot picks the next one and never repeats the last.
//
// Pure parts first (the scores, the step tables, the rotation and the screen lifecycle), then
// the player that owns one music engine on the shared audio graph. Every voice goes through the
// engine, so the tone stage applies to the themes as it does to the level tunes. No PRNG.
import { contourSignature, fx, modeScale, type ModeName, type NoteFx } from './compose';
import { createMusicEngine, type MusicContext, type MusicEngine, type NodeLike } from './engine';
import { inChord, inScale, triad, type Harmony, type Key } from './harmony';
import { musicMasterGain } from './intensity';
import { createScheduler, TICK_MS, type PlannedNote, type Scheduler, type Timer } from './scheduler';
import type { Layer } from './track';
import { bassRoot, padVoicing, type BedTimbre } from './tunes';

const STEPS = 16;
/** Bars in one section (A, B or C). */
export const MENU_SECTION_BARS = 8;
/** Bars in one loop of a theme: A, B, C. */
export const MENU_FORM_BARS = MENU_SECTION_BARS * 3;
/** Fade in on start, seconds. */
export const MENU_FADE_IN_SEC = 1.2;
/** Fade out when play starts, seconds (brief: 0.6 s). */
export const MENU_FADE_OUT_SEC = 0.6;
/** Master low pass of the themes: soft highs on earbuds and the phone speaker. */
export const MENU_CUTOFF_HZ = 2600;
/** How often the player retries while the audio is still locked (title before the first touch), ms. */
export const MENU_RETRY_MS = 250;

export type MenuSection = 'A' | 'B' | 'C';

/** One lead cell: [step, MIDI, length in steps, slide flag]. */
type Cell = readonly [number, number, number, number?];
type Bar = readonly Cell[];

/** Lead colour of one section: how a cell becomes a NoteFx. */
interface LeadColour {
  readonly duty: number;
  readonly wave?: OscillatorType;
  readonly bell: boolean;
  readonly vibrato: number;
  readonly echo: 0 | 1 | 2;
}

export interface MenuThemeDef {
  readonly id: string;
  readonly name: string;
  readonly mode: ModeName;
  readonly bpm: number;
  readonly key: Key;
  readonly bed: BedTimbre;
  /** Lead colour per section; A is the theme's own lead. */
  readonly lead: Readonly<Record<MenuSection, LeadColour>>;
  /** The lead line, one entry per score bar (A, B, C). */
  readonly bars: readonly Bar[];
}

const pulse = (duty: number, vibrato: number, echo: 0 | 1 | 2): LeadColour => ({ duty, bell: false, vibrato, echo });
const wave = (w: OscillatorType, vibrato: number, echo: 0 | 1 | 2): LeadColour => ({ duty: 0, wave: w, bell: false, vibrato, echo });
const BELL: LeadColour = { duty: 0, bell: true, vibrato: 0, echo: 2 };

// ---------------------------------------------------------------------------------------
// 0 Aurora, E lydian, 100 BPM.

const E = {
  e: triad('E', 'I', 4, 4),
  fs: triad('F#', 'II', 6, 4),
  csm: triad('C#m', 'vi', 1, 3),
  gsm: triad('G#m', 'iii', 8, 3),
  b: triad('B', 'V', 11, 4),
};

const AURORA: MenuThemeDef = {
  id: 'aurora',
  name: 'Aurora',
  mode: 'lydian',
  bpm: 100,
  key: {
    tonic: 4,
    scale: modeScale(4, 'lydian'),
    bars: [
      E.e, E.fs, E.csm, E.gsm, E.e, E.fs, E.csm, E.b,
      E.csm, E.gsm, E.fs, E.e, E.csm, E.gsm, E.fs, E.b,
      E.e, E.e, E.csm, E.csm, E.fs, E.fs, E.b, E.b,
    ],
  },
  bed: { bass: 'triangle', pad: 'sawtooth', arp: 'square', padDetune: 14 },
  lead: { A: pulse(0.25, 14, 1), B: pulse(0.125, 10, 2), C: BELL },
  bars: [
    // A: a rising B E G# call that leans on the lydian A# on its return (bar 5), answered by a
    // falling F# chord line and a cadence on B.
    [[0, 71, 2], [2, 76, 2], [4, 80, 6], [10, 78, 2], [12, 76, 4]],
    [[0, 78, 3], [3, 73, 1], [4, 70, 4], [8, 73, 2], [10, 78, 6]],
    [[0, 80, 4], [4, 76, 2], [6, 73, 2], [8, 76, 8, 1]],
    [[0, 75, 6], [6, 71, 2], [8, 75, 2], [10, 78, 2], [12, 80, 4]],
    [[0, 71, 2], [2, 76, 2], [4, 80, 6], [10, 82, 2], [12, 83, 4]],
    [[0, 82, 4], [4, 78, 4], [8, 73, 4], [12, 70, 4]],
    [[0, 68, 2], [2, 73, 2], [4, 76, 4], [8, 80, 2], [10, 76, 2], [12, 73, 4]],
    [[0, 75, 8, 1], [8, 71, 8]],
    // B: a thin pulse that climbs out of C#m in long dotted steps.
    [[0, 73, 6], [6, 75, 2], [8, 76, 6], [14, 78, 2]],
    [[0, 80, 4], [4, 75, 4], [8, 71, 8]],
    [[0, 78, 6], [6, 80, 2], [8, 82, 6], [14, 80, 2]],
    [[0, 80, 8], [8, 76, 4], [12, 71, 4]],
    [[0, 73, 6], [6, 75, 2], [8, 76, 4], [12, 80, 4]],
    [[0, 83, 4], [4, 80, 4], [8, 75, 8]],
    [[0, 82, 4], [4, 78, 4], [8, 73, 6], [14, 75, 2]],
    [[0, 71, 8, 1], [8, 75, 8]],
    // C: long bell notes with space between them.
    [[4, 76, 12]],
    [[0, 80, 6], [6, 78, 2], [8, 76, 8]],
    [[4, 73, 8], [12, 76, 4]],
    [[0, 68, 16]],
    [[4, 70, 4], [8, 73, 4], [12, 78, 4]],
    [[0, 78, 6], [8, 73, 8]],
    [[4, 75, 12]],
    [[0, 71, 8]],
  ],
};

// ---------------------------------------------------------------------------------------
// 1 Tide, D dorian, 88 BPM.

const D = {
  dm: triad('Dm', 'i', 2, 3),
  em: triad('Em', 'ii', 4, 3),
  f: triad('F', 'III', 5, 4),
  g: triad('G', 'IV', 7, 4),
  am: triad('Am', 'v', 9, 3),
  c: triad('C', 'VII', 0, 4),
};

const TIDE: MenuThemeDef = {
  id: 'tide',
  name: 'Tide',
  mode: 'dorian',
  bpm: 88,
  key: {
    tonic: 2,
    scale: modeScale(2, 'dorian'),
    bars: [
      D.dm, D.c, D.dm, D.g, D.dm, D.c, D.f, D.g,
      D.am, D.em, D.f, D.c, D.am, D.em, D.f, D.g,
      D.dm, D.dm, D.f, D.f, D.c, D.c, D.g, D.g,
    ],
  },
  bed: { bass: 'sine', pad: 'triangle', arp: 'square', padDetune: 9 },
  lead: { A: wave('triangle', 18, 2), B: pulse(0.5, 8, 1), C: BELL },
  bars: [
    // A: a dotted D F A swell that rises to the dorian B on the G chord, then sinks back.
    [[0, 74, 3], [3, 77, 3], [6, 81, 2], [8, 81, 6], [14, 79, 2]],
    [[0, 76, 6], [6, 74, 2], [8, 72, 8]],
    [[0, 74, 3], [3, 77, 3], [6, 79, 2], [8, 81, 8]],
    [[0, 83, 6, 1], [6, 81, 2], [8, 79, 4], [12, 74, 4]],
    [[0, 74, 3], [3, 77, 3], [6, 81, 2], [8, 81, 4], [12, 77, 4]],
    [[0, 79, 4], [4, 76, 4], [8, 72, 4], [12, 76, 4]],
    [[0, 77, 6], [6, 79, 2], [8, 81, 4], [12, 84, 4]],
    [[0, 83, 8, 1], [8, 79, 8]],
    // B: an offbeat answer that leans in on step 2 of each minor bar.
    [[2, 72, 2], [4, 76, 4], [8, 69, 6], [14, 71, 2]],
    [[0, 71, 4], [4, 67, 4], [8, 76, 6], [14, 74, 2]],
    [[2, 72, 2], [4, 77, 4], [8, 81, 6], [14, 79, 2]],
    [[0, 76, 8], [8, 72, 4], [12, 79, 4]],
    [[2, 72, 2], [4, 76, 4], [8, 81, 6], [14, 79, 2]],
    [[0, 79, 4], [4, 76, 4], [8, 71, 8]],
    [[0, 72, 4], [4, 77, 2], [6, 79, 2], [8, 81, 8]],
    [[0, 79, 6], [6, 77, 2], [8, 74, 8]],
    // C: slow bell tones over the tonic, the third and the seventh.
    [[4, 77, 12]],
    [[0, 81, 8], [8, 74, 8]],
    [[4, 72, 8], [12, 77, 4]],
    [[0, 81, 16]],
    [[4, 76, 4], [8, 79, 8]],
    [[0, 72, 12]],
    [[4, 74, 12]],
    [[0, 79, 8]],
  ],
};

// ---------------------------------------------------------------------------------------
// 2 Orbit, A mixolydian, 112 BPM.

const A = {
  a: triad('A', 'I', 9, 4),
  bm: triad('Bm', 'ii', 11, 3),
  d: triad('D', 'IV', 2, 4),
  em: triad('Em', 'v', 4, 3),
  fsm: triad('F#m', 'vi', 6, 3),
  g: triad('G', 'VII', 7, 4),
};

const ORBIT: MenuThemeDef = {
  id: 'orbit',
  name: 'Orbit',
  mode: 'mixolydian',
  bpm: 112,
  key: {
    tonic: 9,
    scale: modeScale(9, 'mixolydian'),
    bars: [
      A.a, A.g, A.d, A.a, A.fsm, A.g, A.em, A.a,
      A.d, A.bm, A.g, A.a, A.d, A.bm, A.em, A.g,
      A.a, A.a, A.d, A.d, A.g, A.g, A.a, A.a,
    ],
  },
  bed: { bass: 'triangle', pad: 'sawtooth', arp: 'square', padDetune: 20 },
  lead: { A: wave('sawtooth', 10, 1), B: pulse(0.25, 12, 2), C: wave('triangle', 0, 2) },
  bars: [
    // A: orbiting eighths that circle each chord and land on the flat seventh G.
    [[0, 76, 2], [2, 81, 2], [4, 76, 2], [6, 73, 2], [8, 76, 4], [12, 69, 4]],
    [[0, 79, 2], [2, 83, 2], [4, 79, 2], [6, 74, 2], [8, 79, 6], [14, 78, 2]],
    [[0, 78, 2], [2, 81, 2], [4, 78, 2], [6, 74, 2], [8, 81, 4], [12, 78, 4]],
    [[0, 76, 8, 1], [8, 73, 4], [12, 69, 4]],
    [[0, 73, 2], [2, 78, 2], [4, 81, 2], [6, 78, 2], [8, 73, 4], [12, 78, 4]],
    [[0, 79, 2], [2, 83, 2], [4, 74, 2], [6, 79, 2], [8, 83, 6], [14, 81, 2]],
    [[0, 79, 4], [4, 76, 2], [6, 74, 2], [8, 71, 4], [12, 76, 4]],
    [[0, 73, 8, 1], [8, 69, 8]],
    // B: a slower pulse line that rests on each chord's top.
    [[0, 74, 6], [6, 78, 2], [8, 81, 8]],
    [[0, 83, 4], [4, 78, 6], [10, 76, 2], [12, 74, 4]],
    [[0, 79, 6], [6, 81, 2], [8, 83, 8]],
    [[0, 81, 4], [4, 76, 8], [12, 73, 4]],
    [[0, 74, 6], [6, 76, 2], [8, 78, 8]],
    [[0, 78, 4], [4, 74, 6], [10, 73, 2], [12, 71, 4]],
    [[0, 71, 6], [6, 74, 2], [8, 76, 8]],
    [[0, 79, 8], [8, 74, 8]],
    // C: soft triangle tones on and between the beats.
    [[0, 76, 8], [8, 81, 8]],
    [[4, 73, 12]],
    [[0, 78, 12]],
    [[4, 74, 4], [8, 81, 8]],
    [[0, 79, 8], [8, 83, 8]],
    [[4, 74, 12]],
    [[0, 76, 12]],
    [[4, 69, 8]],
  ],
};

/** Every menu theme, in rotation order. */
export const MENU_THEMES: readonly MenuThemeDef[] = [AURORA, TIDE, ORBIT];

/** Pure: a theme by index, clamped into range (0 for anything odd). */
export function menuTheme(index: number): MenuThemeDef {
  const i = Number.isInteger(index) && index >= 0 && index < MENU_THEMES.length ? index : 0;
  return MENU_THEMES[i] ?? AURORA;
}

/** Pure: seconds per sixteenth step of a theme. */
export function menuStepSec(index: number): number {
  return 60 / menuTheme(index).bpm / 4;
}

// ---------------------------------------------------------------------------------------
// Rotation (pure).

/** Pure: the theme after `last` in the fixed order; the first theme when nothing was played. */
export function nextMenuTheme(last: number | null, count = MENU_THEMES.length): number {
  if (last === null || count <= 0) return 0;
  return (((last + 1) % count) + count) % count;
}

/** Pure: a stored theme index, or null when missing or not a valid index. */
export function parseMenuTheme(raw: string | null, count = MENU_THEMES.length): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n < count ? n : null;
}

/**
 * Where the last theme played is kept. Storage access lives only in src/core/settings.ts (the
 * tests/qa storage audit), so main.ts passes a store backed by it; audio never names a key.
 */
export interface MenuThemeStore {
  /** The stored raw value, or null. */
  load(): string | null;
  save(raw: string): void;
}

/** A store that only lasts for this page load: the default until main.ts wires persistence. */
export function memoryMenuStore(): MenuThemeStore {
  let v: string | null = null;
  return {
    load: () => v,
    save: (raw) => {
      v = raw;
    },
  };
}

/** The session default, shared across music reinstalls so the rotation still advances. */
const SESSION_STORE: MenuThemeStore = memoryMenuStore();

// ---------------------------------------------------------------------------------------
// Scores (pure).

/** One note of a theme, ready for the engine once timed. */
export interface MenuNote {
  readonly step: number;
  readonly layer: Layer;
  readonly midi: number;
  readonly durSteps: number;
  readonly vel: number;
  readonly fx?: NoteFx;
}

/** Gain per layer at full music volume (the bed mix of a calm level). */
export const MENU_LAYER_GAIN: Readonly<Record<Layer, number>> = { pad: 0.17, bass: 0.16, arp: 0.12, kick: 0.12, hat: 0.04, perc: 0 };

/** Pure: the score bar (0 to 23) of a bar since the theme started: A, B, C, then again. */
export function menuScoreBar(bar: number): number {
  const b = Math.max(0, Math.trunc(bar));
  return b % MENU_FORM_BARS;
}

/** Pure: the section of a score bar. */
export function menuSection(scoreBar: number): MenuSection {
  const sb = menuScoreBar(scoreBar);
  return sb < MENU_SECTION_BARS ? 'A' : sb < MENU_SECTION_BARS * 2 ? 'B' : 'C';
}

/** Pure: true on a hook bar of the score. */
export function isHookBar(scoreBar: number): boolean {
  return menuSection(scoreBar) === 'A';
}

/** Pure: the chord of a score bar of a theme. */
export function menuChord(scoreBar: number, theme = 0): Harmony {
  const k = menuTheme(theme).key;
  return k.bars[menuScoreBar(scoreBar)] ?? k.bars[0] ?? E.e;
}

function colourOf(c: LeadColour, dur: number, slideFrom: number | null): NoteFx {
  if (c.bell) return fx({ bell: true, echo: c.echo });
  const base: Partial<NoteFx> = { duty: c.duty, vibrato: dur >= 4 ? c.vibrato : 0, echo: c.echo, slideFrom };
  return fx(c.wave === undefined ? base : { ...base, wave: c.wave });
}

function leadOf(cells: Bar, colour: LeadColour): MenuNote[] {
  const out: MenuNote[] = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c === undefined) continue;
    const [step, midi, dur, slide] = c;
    const prev = i > 0 ? cells[i - 1] : undefined;
    const from = slide === 1 && prev !== undefined ? prev[1] : null;
    out.push({ step, layer: 'arp', midi, durSteps: dur, vel: step % 4 === 0 || dur >= 4 ? 0.95 : 0.75, fx: colourOf(colour, dur, from) });
  }
  return out;
}

/** Pure: every note of one score bar of a theme, sorted by step. */
export function menuBarNotes(scoreBar: number, theme = 0): MenuNote[] {
  const def = menuTheme(theme);
  const sb = menuScoreBar(scoreBar);
  const sec = menuSection(sb);
  const h = menuChord(sb, theme);
  const notes: MenuNote[] = [];
  // A and B pads ring with a long echo; C pads add wind under the lowest voice.
  padVoicing(h).forEach((m, i) => notes.push({ step: 0, layer: 'pad', midi: m, durSteps: STEPS, vel: 1, fx: fx({ echo: 2, wind: sec === 'C' && i === 0 }) }));
  const root = bassRoot(h);
  if (sec === 'A') {
    notes.push({ step: 0, layer: 'bass', midi: root, durSteps: 6, vel: 1 });
    notes.push({ step: 8, layer: 'bass', midi: root, durSteps: 6, vel: 0.85 });
    notes.push({ step: 0, layer: 'kick', midi: 0, durSteps: 1, vel: 0.7 });
    notes.push({ step: 8, layer: 'kick', midi: 0, durSteps: 1, vel: 0.55 });
    notes.push({ step: 4, layer: 'hat', midi: 0, durSteps: 1, vel: 0.8 });
    notes.push({ step: 12, layer: 'hat', midi: 0, durSteps: 1, vel: 0.8 });
  } else if (sec === 'B') {
    notes.push({ step: 0, layer: 'bass', midi: root, durSteps: 10, vel: 0.9 });
    notes.push({ step: 10, layer: 'bass', midi: root, durSteps: 6, vel: 0.7 });
    notes.push({ step: 0, layer: 'kick', midi: 0, durSteps: 1, vel: 0.5 });
  } else {
    notes.push({ step: 0, layer: 'bass', midi: root, durSteps: 14, vel: 0.8 });
  }
  notes.push(...leadOf(def.bars[sb] ?? [], def.lead[sec]));
  return notes.sort((a, b) => a.step - b.step);
}

/** Every theme's score bar notes per step, built once at load (no allocation while a theme plays). */
const STEP_TABLES: readonly (readonly (readonly (readonly MenuNote[])[])[])[] = MENU_THEMES.map((_, t) =>
  Array.from({ length: MENU_FORM_BARS }, (_u, sb) => {
    const notes = menuBarNotes(sb, t);
    return Array.from({ length: STEPS }, (_v, s) => notes.filter((n) => n.step === s));
  }),
);

const NONE: readonly MenuNote[] = [];

/** Pure: the notes of a theme that start at an absolute step since the theme started. */
export function menuNotesAt(step: number, theme = 0): readonly MenuNote[] {
  const s = Math.max(0, Math.trunc(step));
  return STEP_TABLES[theme]?.[menuScoreBar(Math.floor(s / STEPS))]?.[s % STEPS] ?? NONE;
}

/** Pure: true when every lead note of a theme is in its key, and on a chord tone on each beat. */
export function menuLeadFits(theme = 0): boolean {
  const def = menuTheme(theme);
  for (let sb = 0; sb < MENU_FORM_BARS; sb++) {
    for (const n of menuBarNotes(sb, theme)) {
      if (n.layer !== 'arp') continue;
      if (!inScale(n.midi, def.key)) return false;
      if (n.step % 4 === 0 && !inChord(n.midi, menuChord(sb, theme))) return false;
    }
  }
  return true;
}

/** Pure: the lead pitches of a theme's section, in order (the variety test's contour input). */
export function menuSectionPitches(theme: number, sec: MenuSection): number[] {
  const first = sec === 'A' ? 0 : sec === 'B' ? MENU_SECTION_BARS : MENU_SECTION_BARS * 2;
  const out: number[] = [];
  for (let sb = first; sb < first + MENU_SECTION_BARS; sb++) for (const n of menuBarNotes(sb, theme)) if (n.layer === 'arp') out.push(n.midi);
  return out;
}

/** Pure: a theme's hook signature: lead contour and rhythm of section A. */
export function menuHookSignature(theme: number): string {
  const def = menuTheme(theme);
  const rhythm = def.bars
    .slice(0, MENU_SECTION_BARS)
    .map((b) => b.map((c) => `${c[0]}:${c[2]}`).join(','))
    .join('|');
  return `${contourSignature(menuSectionPitches(theme, 'A'))}/${rhythm}`;
}

// ---------------------------------------------------------------------------------------
// Screen lifecycle (pure). Title and menu want the theme; settings keeps whatever plays; play
// and results fade it out. 'game:start' counts as play.

export type MenuScreen = 'title' | 'menu' | 'settings' | 'play' | 'results';

/** Pure: whether the theme is wanted after a screen change, from whether it was wanted before. */
export function menuWanted(before: boolean, screen: MenuScreen): boolean {
  if (screen === 'title' || screen === 'menu') return true;
  if (screen === 'settings') return before;
  return false;
}

/** Pure: whether a screen change means the next theme start should pick a new theme (a level ran). */
export function menuRotates(screen: MenuScreen): boolean {
  return screen === 'play' || screen === 'results';
}

// ---------------------------------------------------------------------------------------
// The player.

/** The audio graph the theme plays into (index.ts MusicGraph). */
export interface MenuGraph {
  readonly ctx: MusicContext;
  readonly master: NodeLike;
}

export interface MenuThemeDeps {
  readonly graph: () => MenuGraph | null;
  readonly timer: Timer;
  /** Music volume 0 to 100, read on every start and change. */
  readonly volume: () => number;
  /** Where the last theme played is kept. Default: memory for this page load only. */
  readonly store?: MenuThemeStore | null;
}

export type MenuThemeState = 'off' | 'playing' | 'fading';

export interface MenuThemePlayer {
  /** A 'ui:screen' change. */
  screen(s: MenuScreen): void;
  /** Play starts ('game:start' or a level's music): fade out and stop wanting the theme. */
  leave(): void;
  /** The music volume changed: 0 stops the theme at once, back above 0 restarts it if wanted. */
  volumeChanged(): void;
  /** The tab hid (true) or showed again (false). Hidden stops the theme; showing restarts it from the hook. */
  setHidden(hidden: boolean): void;
  /** Stop at once and forget the screen. */
  stop(): void;
  readonly state: MenuThemeState;
  readonly wanted: boolean;
  /** Engines alive: the playing one plus one still fading. */
  readonly engines: number;
  /** Engines created since the player was made (the tests' no double start check). */
  readonly starts: number;
  /** Index into MENU_THEMES of the theme last started, or -1 before the first start. */
  readonly theme: number;
}

interface Live {
  readonly engine: MusicEngine;
  readonly scheduler: Scheduler;
}

/** Pure: a planned engine note from a theme note at an audio time. */
export function plan(n: MenuNote, time: number, master = 1, stepSec = menuStepSec(0)): PlannedNote {
  const base = { layer: n.layer, midi: n.layer === 'kick' || n.layer === 'hat' ? null : n.midi, time, dur: n.durSteps * stepSec, gain: MENU_LAYER_GAIN[n.layer] * n.vel * master };
  return n.fx === undefined ? base : { ...base, fx: n.fx };
}

function readStored(s: MenuThemeStore | null): string | null {
  try {
    return s?.load() ?? null;
  } catch {
    return null;
  }
}

function writeStored(s: MenuThemeStore | null, theme: number): void {
  try {
    s?.save(String(theme));
  } catch {
    // Blocked storage: the rotation still advances for this session.
  }
}

export function createMenuTheme(deps: MenuThemeDeps): MenuThemePlayer {
  const storage = deps.store === undefined ? SESSION_STORE : deps.store;
  let wanted = false;
  let hidden = false;
  let live: Live | null = null;
  let fading: { engine: MusicEngine; cancel: () => void } | null = null;
  let retry: (() => void) | null = null;
  let starts = 0;
  // The last theme played, from storage at boot; a new theme is due at boot and after a level.
  let last: number | null = parseMenuTheme(readStored(storage));
  let due = true;
  let theme = -1;

  const disarmRetry = (): void => {
    retry?.();
    retry = null;
  };

  const killFading = (): void => {
    const f = fading;
    if (!f) return;
    fading = null;
    f.cancel();
    f.engine.dispose();
  };

  const killLive = (): void => {
    const l = live;
    if (!l) return;
    live = null;
    l.scheduler.stop();
    l.engine.dispose();
  };

  function pick(): number {
    if (due) {
      due = false;
      theme = nextMenuTheme(last);
      last = theme;
      writeStored(storage, theme);
    }
    return theme;
  }

  function ensure(): void {
    if (!wanted || hidden || deps.volume() <= 0) {
      disarmRetry();
      return;
    }
    if (live) {
      disarmRetry();
      return;
    }
    const g = deps.graph();
    if (!g) {
      // Audio is locked until the first touch: try again shortly.
      if (retry === null) retry = deps.timer.every(ensure, MENU_RETRY_MS);
      return;
    }
    disarmRetry();
    // One instance only: a theme still fading from the last menu visit goes now.
    killFading();
    const t = pick();
    const def = menuTheme(t);
    const stepSec = menuStepSec(t);
    const ctx = g.ctx;
    const engine = createMusicEngine(ctx, g.master, 0);
    starts++;
    engine.setStepSec(stepSec);
    engine.setCutoff(MENU_CUTOFF_HZ);
    engine.fade(musicMasterGain(deps.volume()), MENU_FADE_IN_SEC);
    const scheduler = createScheduler({
      clock: { now: () => ctx.currentTime },
      timer: deps.timer,
      stepSec,
      onStep: (step, time) => {
        if (step % STEPS === 0) engine.setSpace(menuSection(step / STEPS) === 'C', time);
        for (const n of menuNotesAt(step, t)) engine.play(plan(n, time, 1, stepSec), def.bed);
      },
    });
    live = { engine, scheduler };
    scheduler.start();
  }

  function fadeOut(): void {
    disarmRetry();
    const l = live;
    if (!l) return;
    live = null;
    l.scheduler.stop();
    killFading();
    const ctx = (deps.graph() ?? null)?.ctx;
    l.engine.fade(0, MENU_FADE_OUT_SEC);
    if (!ctx) {
      l.engine.dispose();
      return;
    }
    const until = ctx.currentTime + MENU_FADE_OUT_SEC + 0.05;
    const engine = l.engine;
    const cancel = deps.timer.every(() => {
      if (fading?.engine === engine && ctx.currentTime >= until) killFading();
    }, TICK_MS);
    fading = { engine, cancel };
  }

  return {
    screen(s: MenuScreen): void {
      if (menuRotates(s)) due = true;
      wanted = menuWanted(wanted, s);
      if (wanted) ensure();
      else fadeOut();
    },
    leave(): void {
      wanted = false;
      due = true;
      fadeOut();
    },
    volumeChanged(): void {
      if (deps.volume() <= 0) {
        killLive();
        killFading();
        disarmRetry();
        return;
      }
      live?.engine.setMaster(musicMasterGain(deps.volume()));
      ensure();
    },
    setHidden(h: boolean): void {
      hidden = h;
      if (h) {
        killLive();
        killFading();
        disarmRetry();
      } else {
        ensure();
      }
    },
    stop(): void {
      wanted = false;
      disarmRetry();
      killLive();
      killFading();
    },
    get state(): MenuThemeState {
      return live ? 'playing' : fading ? 'fading' : 'off';
    },
    get wanted(): boolean {
      return wanted;
    },
    get engines(): number {
      return (live ? 1 : 0) + (fading ? 1 : 0);
    },
    get starts(): number {
      return starts;
    },
    get theme(): number {
      return theme;
    },
  };
}
