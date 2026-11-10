// Time warning beeps for the HUD clock (Ryan: warn at 1 minute, 30 seconds and the last 10).
// Ledger emits 'ui:timeWarn' { secondsLeft }; this maps it to a short square wave pattern.
// Pure parameters plus the event controller; no Web Audio here, so tests run in node.
// timeWarnSynth.ts supplies the backend that makes sound.
import type { Bus } from '../core/events';

/** One square wave beep, scheduled `at` seconds after the cue starts. */
export interface Beep {
  at: number;
  hz: number;
  dur: number;
  gain: number;
}

/** Normal peak level: clear over gameplay, below the boss cues (0.2). */
export const WARN_GAIN = 0.08;
/** Louder peak for the final 3, 2, 1. Still under the boss cues. */
export const WARN_GAIN_LOUD = 0.11;
/** Pitch of the 60 second beeps, Hz (A5). */
export const BEEP_60_HZ = 880;
/** Pitch of the 30 second beeps, Hz (a minor third up, C6). */
export const BEEP_30_HZ = 1046.5;
/** Pitch of the tick at 10 seconds left, Hz (A4). */
export const TICK_BASE_HZ = 440;
/** Semitones the tick rises per second counted down. */
export const TICK_STEP_SEMITONES = 2;

/** Pure: tick pitch for 10 down to 1 seconds left; strictly rising as the count falls. */
export function tickHzFor(secondsLeft: number): number {
  const s = Math.min(10, Math.max(1, Math.round(secondsLeft)));
  return TICK_BASE_HZ * Math.pow(2, ((10 - s) * TICK_STEP_SEMITONES) / 12);
}

/** Pure: the beeps for a secondsLeft value, or an empty list when it is not a warning point. */
export function beepsFor(secondsLeft: number): readonly Beep[] {
  if (!Number.isFinite(secondsLeft)) return [];
  const s = Math.round(secondsLeft);
  if (s === 60) {
    return [
      { at: 0, hz: BEEP_60_HZ, dur: 0.09, gain: WARN_GAIN },
      { at: 0.16, hz: BEEP_60_HZ, dur: 0.09, gain: WARN_GAIN },
    ];
  }
  if (s === 30) {
    return [0, 0.1, 0.2].map((at) => ({ at, hz: BEEP_30_HZ, dur: 0.06, gain: WARN_GAIN }));
  }
  if (s >= 1 && s <= 10) {
    return [{ at: 0, hz: tickHzFor(s), dur: 0.05, gain: s <= 3 ? WARN_GAIN_LOUD : WARN_GAIN }];
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
