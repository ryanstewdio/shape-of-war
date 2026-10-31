// Battle polish (Ryan rated the battle tracks 3 of 5: players should "become accustomed to the type
// of battle when they hear the change"). Pure rules, no Web Audio, no PRNG; index.ts schedules:
// - the intro hit: one bar of chord stabs on the cross fade (join) bar, its own pattern per track;
// - intensity by phase: each phase opens the master lowpass a step and adds a drum layer;
// - the exposed window: drums duck 6 dB and the hook (the lead) lifts;
// - the defeat chord: the battle track's tonic major (the level tune returns two bars later);
// - weapon and drone cues on 'fx:weaponCombine', 'fx:weaponExpire', 'fx:droneArm' and
//   'fx:droneExpire': short phrases in the key of the track playing, rate limited.
import { chordToneMidi, STEPS_PER_BAR, type Harmony, type Key } from './harmony';
import type { Layer } from './track';
import type { Tune } from './tunes';

// ---------------------------------------------------------------------------------------
// Intro hit

/** Intro stabs are voiced from the chord root nearest A3. */
export const INTRO_BASE = 57;
/** Gain of one intro voice. */
export const INTRO_GAIN = 0.11;

export interface IntroNote {
  /** Step inside the join bar, 0 to 15. */
  readonly step: number;
  readonly midi: number;
  readonly durSteps: number;
  readonly vel: number;
}

/** Pure: the intro hit of a battle track over chord `h` (the join bar's chord). Empty without one. */
export function introNotes(tune: Tune, h: Harmony): IntroNote[] {
  const out: IntroNote[] = [];
  for (const hit of tune.intro ?? []) {
    const dur = Math.max(1, Math.min(hit.dur, STEPS_PER_BAR - hit.step));
    for (const deg of hit.degs) out.push({ step: hit.step, midi: chordToneMidi(h, deg, INTRO_BASE), durSteps: dur, vel: hit.vel });
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Intensity by phase

/** Master lowpass factor per boss phase (index 0 is phase 1; the last entry holds). */
export const PHASE_CUTOFF_MUL: readonly number[] = [1, 1.2, 1.45, 1.75];

/** Pure: the lowpass factor for a boss phase. */
export function phaseCutoffMul(phase: number): number {
  const i = Math.max(0, Math.min(PHASE_CUTOFF_MUL.length - 1, Math.trunc(phase) - 1));
  return PHASE_CUTOFF_MUL[i] ?? 1;
}

export interface LayerHit {
  readonly layer: Extract<Layer, 'hat' | 'perc'>;
  readonly step: number;
  readonly vel: number;
}

/**
 * The drum layer each phase adds, per bar: phase 2 accents the off beat hats, phase 3 adds clap
 * ghosts, phase 4 one more. Claps sit in steps 4 to 14 (they decay before the bar line and keep
 * clear of the pad change), like every tune's claps.
 */
export const PHASE_LAYERS: readonly (readonly LayerHit[])[] = [
  [],
  [
    { layer: 'hat', step: 2, vel: 1 },
    { layer: 'hat', step: 6, vel: 1 },
    { layer: 'hat', step: 10, vel: 1 },
    { layer: 'hat', step: 14, vel: 1 },
  ],
  [
    { layer: 'perc', step: 5, vel: 0.45 },
    { layer: 'perc', step: 11, vel: 0.45 },
  ],
  [{ layer: 'perc', step: 13, vel: 0.5 }],
];

/** Pure: every added drum hit at a phase (all earlier phases' layers too). */
export function phaseLayer(phase: number): LayerHit[] {
  const out: LayerHit[] = [];
  const n = Math.max(0, Math.min(PHASE_LAYERS.length, Math.trunc(phase)));
  for (let i = 0; i < n; i++) out.push(...(PHASE_LAYERS[i] ?? []));
  return out;
}

// ---------------------------------------------------------------------------------------
// The exposed window

/** 6 dB down: drum gain factor while the window is open. */
export const WINDOW_DRUM_DUCK = 0.5;
/** The hook (the lead, the arp layer) lifts by this factor while the window is open. */
export const WINDOW_HOOK_LIFT = 1.4;

/** Pure: the gain factor of a bed layer with the window open or shut. */
export function windowGain(layer: Layer, open: boolean): number {
  if (!open) return 1;
  if (layer === 'kick' || layer === 'perc' || layer === 'hat') return WINDOW_DRUM_DUCK;
  if (layer === 'arp') return WINDOW_HOOK_LIFT;
  return 1;
}

// ---------------------------------------------------------------------------------------
// Defeat

/** Pure: the MIDI root of the defeat chord: the track's tonic nearest A4 (69). */
export function defeatRoot(tonic: number): number {
  const off = (((Math.trunc(tonic) - 9) % 12) + 12) % 12;
  return off > 6 ? 69 + off - 12 : 69 + off;
}

// ---------------------------------------------------------------------------------------
// Weapon and drone cues

export type CueKind = 'combine' | 'expire' | 'droneArm' | 'droneExpire';
export const CUE_KINDS: readonly CueKind[] = ['combine', 'expire', 'droneArm', 'droneExpire'];

export interface CueShape {
  /** Scale degrees from the tonic, in order of play. */
  readonly degs: readonly number[];
  /** Seconds between note starts and each note's length. */
  readonly gapSec: number;
  readonly durSec: number;
  readonly gain: number;
  /** Octaves above the C5 octave the tonic is taken from. */
  readonly octave: number;
}

/**
 * The upgrade is a rising root, third and fifth; the expiry a short fall from the fifth to the
 * third. The drone variants are lighter: an octave higher, quicker and softer.
 */
export const CUE_SHAPES: Readonly<Record<CueKind, CueShape>> = {
  combine: { degs: [0, 2, 4], gapSec: 0.08, durSec: 0.12, gain: 0.12, octave: 0 },
  expire: { degs: [4, 2], gapSec: 0.1, durSec: 0.14, gain: 0.1, octave: 0 },
  droneArm: { degs: [0, 2, 4], gapSec: 0.05, durSec: 0.07, gain: 0.07, octave: 1 },
  droneExpire: { degs: [4, 2], gapSec: 0.06, durSec: 0.08, gain: 0.06, octave: 1 },
};

/** A cue of a kind plays at most once per this many seconds; extra ones are dropped. */
export const CUE_MIN_GAP_SEC = 0.3;

export interface CueNote {
  /** Seconds after the cue starts. */
  readonly at: number;
  readonly midi: number;
  readonly dur: number;
  readonly gain: number;
}

/** Pure: MIDI of scale degree `deg` of `key`, counted from the tonic in the octave from C5 (72) up. */
export function keyDegreeMidi(key: Key, deg: number, octave = 0): number {
  const n = key.scale.length;
  const d = Math.trunc(deg);
  const oct = Math.floor(d / n);
  const pc = key.scale[d - oct * n] ?? key.tonic;
  const base = 72 + ((key.tonic % 12) + 12) % 12 + 12 * octave;
  return base + oct * 12 + ((pc - key.tonic + 12) % 12);
}

/** Pure: the notes of a cue in a key. */
export function cueNotes(kind: CueKind, key: Key): CueNote[] {
  const sh = CUE_SHAPES[kind];
  return sh.degs.map((d, i) => ({ at: i * sh.gapSec, midi: keyDegreeMidi(key, d, sh.octave), dur: sh.durSec, gain: sh.gain }));
}

/** Pure: true when a cue may play at `now` after its last one at `last` (null for never). */
export function cueAllowed(last: number | null, now: number): boolean {
  return last === null || now - last >= CUE_MIN_GAP_SEC - 1e-9;
}

/** Pure: the cue kind of a bus event name, or null for any other name. */
export function cueKindOf(event: string): CueKind | null {
  if (event === 'fx:weaponCombine') return 'combine';
  if (event === 'fx:weaponExpire') return 'expire';
  if (event === 'fx:droneArm') return 'droneArm';
  if (event === 'fx:droneExpire') return 'droneExpire';
  return null;
}
