// Soft time warnings for the HUD clock: a gentle low chime at 60 and 30 seconds, and a quiet low
// tick per second for the last 5. Ledger emits 'ui:timeWarn' { secondsLeft }; this maps it to cues.
// Pure parameters plus the event controller; no Web Audio here, so tests run in node.
// timeWarnSynth.ts supplies the backend that makes sound.
import type { Bus } from '../core/events';

/** One soft oscillator note, scheduled `at` seconds after the cue starts. */
export interface Beep {
  at: number;
  hz: number;
  dur: number;
  gain: number;
  /** Rounded waveforms only. */
  wave: 'sine' | 'triangle';
  /** Seconds of linear fade in, so there is no click. */
  attack: number;
}

/** Peak level of the 60 and 30 second chimes. Quiet, well below the boss cues (0.2). */
export const CHIME_GAIN = 0.04;
/** Peak level of the countdown ticks 5 and 4. */
export const TICK_GAIN = 0.025;
/** Peak level of ticks 3, 2, 1: barely louder. */
export const TICK_GAIN_LOUD = 0.032;
/** Pitch of the 60 second chime, Hz (about A4). */
export const CHIME_60_HZ = 330;
/** Pitch of the 30 second chime, Hz (about A4). */
export const CHIME_30_HZ = 440;
/** Pitch of the tick at 5 seconds left, Hz (A3). */
export const TICK_BASE_HZ = 220;
/** First second of the countdown. Anything above is ignored. */
export const COUNTDOWN_FROM = 5;
/** Semitones the tick rises per second counted down (220 Hz to about 330 Hz by 1). */
export const TICK_STEP_SEMITONES = 1.75;

/** Pure: tick pitch for 5 down to 1 seconds left; strictly rising as the count falls. */
export function tickHzFor(secondsLeft: number): number {
  const s = Math.min(COUNTDOWN_FROM, Math.max(1, Math.round(secondsLeft)));
  return TICK_BASE_HZ * Math.pow(2, ((COUNTDOWN_FROM - s) * TICK_STEP_SEMITONES) / 12);
}

/** Pure: the notes for a secondsLeft value, or an empty list when it is not a warning point. */
export function beepsFor(secondsLeft: number): readonly Beep[] {
  if (!Number.isFinite(secondsLeft)) return [];
  const s = Math.round(secondsLeft);
  if (s === 60) {
    return [{ at: 0, hz: CHIME_60_HZ, dur: 0.45, gain: CHIME_GAIN, wave: 'sine', attack: 0.02 }];
  }
  if (s === 30) {
    return [{ at: 0, hz: CHIME_30_HZ, dur: 0.4, gain: CHIME_GAIN, wave: 'triangle', attack: 0.02 }];
  }
  if (s >= 1 && s <= COUNTDOWN_FROM) {
    const gain = s <= 3 ? TICK_GAIN_LOUD : TICK_GAIN;
    return [{ at: 0, hz: tickHzFor(s), dur: 0.07, gain, wave: 'sine', attack: 0.01 }];
  }
  return [];
}

/** What the controller needs from the sound side. A no-op when audio is not running. */
export interface TimeWarnBackend {
  play(beeps: readonly Beep[]): void;
}

export interface TimeWarnController {
  dispose(): void;
}

/** Wire 'ui:timeWarn' on `b` to `backend`. */
export function installTimeWarnSfx(b: Bus, backend: TimeWarnBackend): TimeWarnController {
  const off = b.on('ui:timeWarn', (p) => {
    const beeps = beepsFor(p.secondsLeft);
    if (beeps.length > 0) backend.play(beeps);
  });
  return { dispose: off };
}
