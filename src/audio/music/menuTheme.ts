// Title and menu theme (music v3.6, Ryan: "a menu and title theme"). An original composition in
// the 1980 to 2000 console idiom: an 8 bar hook on a 25 percent pulse lead over spacey pads, a
// triangle bass and a soft kick, then a calmer 8 bar loop on an FM bell with wind under the pads
// and a long echo. E lydian at 100 BPM; the raised fourth (A#) gives the floating space colour.
// It quotes no existing game theme.
//
// Pure parts first (the score, the step table and the screen lifecycle), then the player that
// owns one music engine on the shared audio graph. Every voice goes through the engine, so the
// tone stage (tracking lead low pass, band limited noise, master low pass, limiter and the synth
// master's high shelf) applies to the theme as it does to the level tunes. No PRNG.
import { modeScale, fx, type NoteFx } from './compose';
import { createMusicEngine, type MusicContext, type MusicEngine, type NodeLike } from './engine';
import { inChord, inScale, triad, type Harmony, type Key } from './harmony';
import { musicMasterGain } from './intensity';
import { createScheduler, TICK_MS, type PlannedNote, type Scheduler, type Timer } from './scheduler';
import type { Layer } from './track';
import { bassRoot, padVoicing, type BedTimbre } from './tunes';

export const MENU_BPM = 100;
export const MENU_STEP_SEC = 60 / MENU_BPM / 4;
const STEPS = 16;
/** Bars of the opening hook. */
export const MENU_HOOK_BARS = 8;
/** Bars of the calmer loop that follows the hook and repeats. */
export const MENU_LOOP_BARS = 8;
/** Fade in on start, seconds. */
export const MENU_FADE_IN_SEC = 1.2;
/** Fade out when play starts, seconds (brief: 0.6 s). */
export const MENU_FADE_OUT_SEC = 0.6;
/** Master low pass of the theme: soft highs on earbuds and the phone speaker. */
export const MENU_CUTOFF_HZ = 2600;
/** How often the player retries while the audio is still locked (title before the first touch), ms. */
export const MENU_RETRY_MS = 250;

const E = {
  e: triad('E', 'I', 4, 4),
  fs: triad('F#', 'II', 6, 4),
  csm: triad('C#m', 'vi', 1, 3),
  gsm: triad('G#m', 'iii', 8, 3),
  b: triad('B', 'V', 11, 4),
};

/** The theme's key: E lydian, one chord a bar over hook then loop. */
export const MENU_KEY: Key = {
  tonic: 4,
  scale: modeScale(4, 'lydian'),
  bars: [E.e, E.fs, E.csm, E.gsm, E.e, E.fs, E.csm, E.b, E.e, E.e, E.csm, E.csm, E.fs, E.fs, E.b, E.b],
};

/** The theme's bed waves (the lead's fallback wave is the square of the pulse). */
export const MENU_BED: BedTimbre = { bass: 'triangle', pad: 'sawtooth', arp: 'square', padDetune: 14 };

/** One lead cell: [step, MIDI, length in steps, slide flag]. */
type Cell = readonly [number, number, number, number?];

// The hook: a rising B E G# call that leans on the lydian A# on its return (bar 5), answered
// by a falling F# chord line and a cadence on B.
const HOOK: readonly (readonly Cell[])[] = [
  [[0, 71, 2], [2, 76, 2], [4, 80, 6], [10, 78, 2], [12, 76, 4]],
  [[0, 78, 3], [3, 73, 1], [4, 70, 4], [8, 73, 2], [10, 78, 6]],
  [[0, 80, 4], [4, 76, 2], [6, 73, 2], [8, 76, 8, 1]],
  [[0, 75, 6], [6, 71, 2], [8, 75, 2], [10, 78, 2], [12, 80, 4]],
  [[0, 71, 2], [2, 76, 2], [4, 80, 6], [10, 82, 2], [12, 83, 4]],
  [[0, 82, 4], [4, 78, 4], [8, 73, 4], [12, 70, 4]],
  [[0, 68, 2], [2, 73, 2], [4, 76, 4], [8, 80, 2], [10, 76, 2], [12, 73, 4]],
  [[0, 75, 8, 1], [8, 71, 8]],
];

// The calm loop: long bell notes with space between them.
const CALM: readonly (readonly Cell[])[] = [
  [[4, 76, 12]],
  [[0, 80, 6], [6, 78, 2], [8, 76, 8]],
  [[4, 73, 8], [12, 76, 4]],
  [[0, 68, 16]],
  [[4, 70, 4], [8, 73, 4], [12, 78, 4]],
  [[0, 78, 6], [8, 73, 8]],
  [[4, 75, 12]],
  [[0, 71, 8]],
];

/** One note of the theme, ready for the engine once timed. */
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

/** Pure: the score bar (0 to 15) of a bar since the theme started: the hook once, then the calm loop. */
export function menuScoreBar(bar: number): number {
  const b = Math.max(0, Math.trunc(bar));
  return b < MENU_HOOK_BARS ? b : MENU_HOOK_BARS + ((b - MENU_HOOK_BARS) % MENU_LOOP_BARS);
}

/** Pure: true on a hook bar of the score. */
export function isHookBar(scoreBar: number): boolean {
  return scoreBar < MENU_HOOK_BARS;
}

/** Pure: the chord of a score bar. */
export function menuChord(scoreBar: number): Harmony {
  return MENU_KEY.bars[scoreBar] ?? E.e;
}

function leadOf(cells: readonly Cell[], hook: boolean): MenuNote[] {
  const out: MenuNote[] = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c === undefined) continue;
    const [step, midi, dur, slide] = c;
    const prev = i > 0 ? cells[i - 1] : undefined;
    const from = slide === 1 && prev !== undefined ? prev[1] : null;
    const colour = hook ? fx({ duty: 0.25, vibrato: dur >= 4 ? 14 : 0, echo: 1, slideFrom: from }) : fx({ bell: true, echo: 2 });
    out.push({ step, layer: 'arp', midi, durSteps: dur, vel: step % 4 === 0 || dur >= 4 ? 0.95 : 0.75, fx: colour });
  }
  return out;
}

/** Pure: every note of one score bar, sorted by step. */
export function menuBarNotes(scoreBar: number): MenuNote[] {
  const sb = Math.max(0, Math.min(MENU_HOOK_BARS + MENU_LOOP_BARS - 1, Math.trunc(scoreBar)));
  const hook = isHookBar(sb);
  const h = menuChord(sb);
  const notes: MenuNote[] = [];
  const pad = padVoicing(h);
  // Hook pads ring with a long echo; calm pads add wind under the lowest voice.
  pad.forEach((m, i) => notes.push({ step: 0, layer: 'pad', midi: m, durSteps: STEPS, vel: 1, fx: hook ? fx({ echo: 2 }) : fx({ echo: 2, wind: i === 0 }) }));
  const root = bassRoot(h);
  if (hook) {
    notes.push({ step: 0, layer: 'bass', midi: root, durSteps: 6, vel: 1 });
    notes.push({ step: 8, layer: 'bass', midi: root, durSteps: 6, vel: 0.85 });
    notes.push({ step: 0, layer: 'kick', midi: 0, durSteps: 1, vel: 0.7 });
    notes.push({ step: 8, layer: 'kick', midi: 0, durSteps: 1, vel: 0.55 });
    notes.push({ step: 4, layer: 'hat', midi: 0, durSteps: 1, vel: 0.8 });
    notes.push({ step: 12, layer: 'hat', midi: 0, durSteps: 1, vel: 0.8 });
  } else {
    notes.push({ step: 0, layer: 'bass', midi: root, durSteps: 14, vel: 0.8 });
  }
  notes.push(...leadOf((hook ? HOOK[sb] : CALM[sb - MENU_HOOK_BARS]) ?? [], hook));
  return notes.sort((a, b) => a.step - b.step);
}

/** Every score bar's notes per step, built once at load (no allocation while the theme plays). */
const STEP_TABLE: readonly (readonly (readonly MenuNote[])[])[] = Array.from({ length: MENU_HOOK_BARS + MENU_LOOP_BARS }, (_, sb) => {
  const notes = menuBarNotes(sb);
  return Array.from({ length: STEPS }, (_, s) => notes.filter((n) => n.step === s));
});

const NONE: readonly MenuNote[] = [];

/** Pure: the notes that start at an absolute step since the theme started. */
export function menuNotesAt(step: number): readonly MenuNote[] {
  const s = Math.max(0, Math.trunc(step));
  return STEP_TABLE[menuScoreBar(Math.floor(s / STEPS))]?.[s % STEPS] ?? NONE;
}

/** Pure: true when every lead note of the score is in the key, and on a chord tone on each beat. */
export function menuLeadFits(): boolean {
  for (let sb = 0; sb < MENU_HOOK_BARS + MENU_LOOP_BARS; sb++) {
    for (const n of menuBarNotes(sb)) {
      if (n.layer !== 'arp') continue;
      if (!inScale(n.midi, MENU_KEY)) return false;
      if (n.step % 4 === 0 && !inChord(n.midi, menuChord(sb))) return false;
    }
  }
  return true;
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
}

interface Live {
  readonly engine: MusicEngine;
  readonly scheduler: Scheduler;
}

/** Pure: a planned engine note from a theme note at an audio time. */
export function plan(n: MenuNote, time: number, master = 1): PlannedNote {
  const base = { layer: n.layer, midi: n.layer === 'kick' || n.layer === 'hat' ? null : n.midi, time, dur: n.durSteps * MENU_STEP_SEC, gain: MENU_LAYER_GAIN[n.layer] * n.vel * master };
  return n.fx === undefined ? base : { ...base, fx: n.fx };
}

export function createMenuTheme(deps: MenuThemeDeps): MenuThemePlayer {
  let wanted = false;
  let hidden = false;
  let live: Live | null = null;
  let fading: { engine: MusicEngine; cancel: () => void } | null = null;
  let retry: (() => void) | null = null;
  let starts = 0;

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
    const ctx = g.ctx;
    const engine = createMusicEngine(ctx, g.master, 0);
    starts++;
    engine.setStepSec(MENU_STEP_SEC);
    engine.setCutoff(MENU_CUTOFF_HZ);
    engine.fade(musicMasterGain(deps.volume()), MENU_FADE_IN_SEC);
    const scheduler = createScheduler({
      clock: { now: () => ctx.currentTime },
      timer: deps.timer,
      stepSec: MENU_STEP_SEC,
      onStep: (step, time) => {
        if (step % STEPS === 0) engine.setSpace(!isHookBar(menuScoreBar(step / STEPS)), time);
        for (const n of menuNotesAt(step)) engine.play(plan(n, time), MENU_BED);
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
      wanted = menuWanted(wanted, s);
      if (wanted) ensure();
      else fadeOut();
    },
    leave(): void {
      wanted = false;
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
  };
}
