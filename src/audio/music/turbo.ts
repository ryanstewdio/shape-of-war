// Turbo music layer (R3, Ryan: "Turbo must have its own music and sound effects while it is
// active"). Pure: lifecycle, envelope, budget and the note pattern. No Web Audio here; the engine
// plays the parts (engine.ts playTurbo) and index.ts wires 'fx:turbo'.
//
// On 'fx:turbo' active the sfx side plays a 0.4 s ignition sweep (src/audio/turboSfx.ts); the layer
// joins once it ends: double time over the current tune, a sixteenth arpeggio of the chord in a
// bright pulse lead (two notes per bed step), a pumping bass on every bed step and a light hat on
// the off of each step. The bed ducks 30 percent while the layer sounds. On the end the layer fades
// out over 0.3 s. One layer only: a second active while it runs extends it, an active inside the
// fade restarts it cleanly.
//
// Every pitch is a chord tone of the bar's harmony; the contour and the bass figure of a bar are a
// pure function of (seed, bar) on the stateless hash01.
import { hash01 } from '../../core/rng';
import { chordToneMidi, type Harmony } from './harmony';

/** Seconds of the ignition sweep; the layer joins after it. */
export const TURBO_IGNITION_SEC = 0.4;
/** Seconds the layer takes to fade out after Turbo ends. */
export const TURBO_FADE_SEC = 0.3;
/** Share the base tune ducks while the layer sounds. */
export const TURBO_DUCK = 0.3;
/** Layer part gains at full level. Their sum is TURBO_TOTAL. */
export const TURBO_GAINS = Object.freeze({ arp: 0.085, bass: 0.1, hat: 0.03 });
export const TURBO_TOTAL = TURBO_GAINS.arp + TURBO_GAINS.bass + TURBO_GAINS.hat;
/** Arp notes per bed step (double time). */
export const TURBO_ARP_PER_STEP = 2;
/** Steps per beat: a layer chunk never crosses a beat (so never a bar or a tempo change). */
export const TURBO_CHUNK_STEPS = 4;
/** Duty of the arp's pulse lead. */
export const TURBO_ARP_DUTY = 0.25;
/** Share of a note's slot each part sounds. */
export const TURBO_ARP_GATE = 0.8;
export const TURBO_BASS_GATE = 0.85;
/** Hat length, seconds. */
export const TURBO_HAT_SEC = 0.03;
/** Salt of the turbo pattern hash, apart from every other music hash. */
const SALT = 0x7b0f;
/** The bass roots sit nearest this far under the tune root (about two octaves and a third). */
export const TURBO_BASS_DROP = 27;

/**
 * Arp contours: chord degrees for the eight double time sixteenths of a beat (0 root, 1 third,
 * 2 fifth, 3 the root an octave up). Original figures.
 */
export const TURBO_CONTOURS: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 3, 2, 1],
  [0, 2, 1, 3, 2, 4, 3, 5],
  [3, 2, 1, 0, 1, 2, 4, 3],
  [0, 1, 2, 1, 3, 2, 4, 5],
];
/** Pumping bass figures: chord degrees per bed step of a beat (from the low root). */
export const TURBO_BASS_FIGURES: readonly (readonly number[])[] = [
  [0, 0, 3, 0],
  [0, 3, 0, 2],
  [0, 0, 2, 3],
];
/** Hat velocity per bed step of a beat: the off of the beat's third step is accented. */
export const TURBO_HAT_VEL: readonly number[] = [0.55, 0.7, 1, 0.7];

/** The layer state: when Turbo last started, and when it ended (null while it runs). */
export interface TurboLife {
  readonly startAt: number;
  readonly endAt: number | null;
}

/** Pure: true while Turbo is on (started, not ended). */
export function turboOn(life: TurboLife | null): boolean {
  return life !== null && life.endAt === null;
}

/**
 * Pure: 'fx:turbo' active at audio time `now`. While Turbo runs it extends (the same life, so
 * nothing restarts or stacks); otherwise, including inside the fade, a fresh life starts.
 */
export function turboStart(life: TurboLife | null, now: number): TurboLife {
  if (life !== null && life.endAt === null) return life;
  return { startAt: now, endAt: null };
}

/** Pure: 'fx:turbo' inactive at `now`. A no op unless Turbo runs. */
export function turboEnd(life: TurboLife | null, now: number): TurboLife | null {
  if (life === null || life.endAt !== null) return life;
  return { startAt: life.startAt, endAt: Math.max(life.startAt, now) };
}

/** Pure: the life, or null once its fade is over by `now`. */
export function turboPrune(life: TurboLife | null, now: number): TurboLife | null {
  if (life === null || life.endAt === null) return life;
  return now >= life.endAt + TURBO_FADE_SEC ? null : life;
}

/**
 * Pure: the layer level at audio time t, 0 to 1: rising through the ignition, 1 while Turbo
 * runs, then a linear fade over TURBO_FADE_SEC after the end.
 */
export function turboEnvAt(life: TurboLife | null, t: number): number {
  if (life === null || !(t >= life.startAt)) return 0;
  const rise = Math.min(1, (t - life.startAt) / TURBO_IGNITION_SEC);
  if (life.endAt === null || t < life.endAt) return rise;
  const fade = 1 - (t - life.endAt) / TURBO_FADE_SEC;
  return fade > 0 ? rise * fade : 0;
}

/** Pure: true when layer notes start at audio time t: after the ignition, before the fade ends. */
export function turboLayerAt(life: TurboLife | null, t: number): boolean {
  if (life === null || !(t >= life.startAt + TURBO_IGNITION_SEC - 1e-9)) return false;
  return life.endAt === null || t < life.endAt + TURBO_FADE_SEC;
}

/** Pure: the base tune's gain factor at layer level `env`: 1 off, 0.7 at full level. */
export function turboDuck(env: number): number {
  const e = Math.min(1, Math.max(0, Number.isFinite(env) ? env : 0));
  return 1 - TURBO_DUCK * e;
}

export interface TurboBudget {
  /** Replaces the layer budget's bed scale (duck included). */
  readonly bedScale: number;
  /** Multiplies every turbo part gain. */
  readonly turboScale: number;
}

/**
 * Pure: the bed and turbo scales so bed + turbo stays inside `room` (what the layer budget leaves
 * the bed, lifecycle.ts layerMix), with the bed ducked by turboDuck on top. The turbo layer
 * shrinks only when the room cannot hold it at all; the bed gives way first.
 */
export function turboBudget(bedSum: number, bedScale: number, room: number, env: number): TurboBudget {
  const e = Math.min(1, Math.max(0, Number.isFinite(env) ? env : 0));
  const r = Math.max(0, Number.isFinite(room) ? room : 0);
  if (e === 0) return { bedScale, turboScale: 1 };
  const turboScale = Math.min(1, r / TURBO_TOTAL);
  const cap = Math.max(0, r - TURBO_TOTAL * turboScale * e);
  const fit = bedSum > 0 ? Math.min(bedScale, cap / bedSum) : bedScale;
  return { bedScale: fit * turboDuck(e), turboScale };
}

export type TurboPart = 'arp' | 'bass' | 'hat';

/** One hit of a part: seconds after the chunk time, a length, a pitch (null for the hat), a velocity. */
export interface TurboHit {
  readonly at: number;
  readonly dur: number;
  readonly midi: number | null;
  readonly vel: number;
}

/** One part of a chunk: every hit plays on one voice. */
export interface TurboPartNotes {
  readonly part: TurboPart;
  readonly hits: readonly TurboHit[];
}

/** Pure: the arp contour index of a bar. */
export function turboContourOf(seed: number, bar: number): number {
  return Math.floor(hash01((seed ^ SALT) >>> 0, bar) * TURBO_CONTOURS.length) % TURBO_CONTOURS.length;
}

/** Pure: the bass figure index of a bar. */
export function turboBassOf(seed: number, bar: number): number {
  return Math.floor(hash01((seed ^ (SALT * 3)) >>> 0, bar + 0x51) * TURBO_BASS_FIGURES.length) % TURBO_BASS_FIGURES.length;
}

/** Pure: steps of the chunk that starts at bar step `inBar`: to the end of its beat. */
export function turboChunkSteps(inBar: number): number {
  const k = ((Math.trunc(inBar) % TURBO_CHUNK_STEPS) + TURBO_CHUNK_STEPS) % TURBO_CHUNK_STEPS;
  return TURBO_CHUNK_STEPS - k;
}

/**
 * Pure: the three parts of a chunk from bar step `inBar` for `steps` bed steps of `stepSec`, in
 * harmony `h` (one chord: a chunk never leaves its beat). `root` is the tune root (near A4): the
 * arp sits from it up, the bass about two octaves below. JSON serialisable.
 */
export function turboChunk(seed: number, bar: number, inBar: number, steps: number, stepSec: number, h: Harmony, root: number): TurboPartNotes[] {
  const contour = TURBO_CONTOURS[turboContourOf(seed, bar)] ?? TURBO_CONTOURS[0] ?? [];
  const figure = TURBO_BASS_FIGURES[turboBassOf(seed, bar)] ?? TURBO_BASS_FIGURES[0] ?? [];
  const arp: TurboHit[] = [];
  const bass: TurboHit[] = [];
  const hat: TurboHit[] = [];
  const unit = stepSec / TURBO_ARP_PER_STEP;
  for (let k = 0; k < steps; k++) {
    const inBeat = (inBar + k) % TURBO_CHUNK_STEPS;
    const at = k * stepSec;
    for (let j = 0; j < TURBO_ARP_PER_STEP; j++) {
      const deg = contour[(inBeat * TURBO_ARP_PER_STEP + j) % contour.length] ?? 0;
      arp.push({ at: at + j * unit, dur: unit * TURBO_ARP_GATE, midi: chordToneMidi(h, deg, root), vel: j === 0 ? 1 : 0.8 });
    }
    bass.push({ at, dur: stepSec * TURBO_BASS_GATE, midi: chordToneMidi(h, figure[inBeat] ?? 0, root - TURBO_BASS_DROP), vel: inBeat === 0 ? 1 : 0.8 });
    hat.push({ at: at + unit, dur: Math.min(TURBO_HAT_SEC, unit * 0.9), midi: null, vel: TURBO_HAT_VEL[inBeat] ?? 0.7 });
  }
  return [
    { part: 'arp', hits: arp },
    { part: 'bass', hits: bass },
    { part: 'hat', hits: hat },
  ];
}

/** Pure: seconds a part's voice lasts from the chunk time (the end of its last hit). */
export function turboPartLength(p: TurboPartNotes): number {
  let end = 0;
  for (const h of p.hits) end = Math.max(end, h.at + h.dur);
  return end;
}
