// Turbo sound effects (R3, Ryan: "Turbo must have its own music and sound effects while it is
// active"): a rising ignition sweep on the start, a subtle engine hum looping while Turbo runs and
// a falling power down sweep on the end. Pure parameters plus the event controller; no Web Audio
// here, so tests run in node. turboSynth.ts supplies the backend that makes sound. The music
// layer is separate (music/turbo.ts) and follows the same event.
//
// One instance only: one hum, one sweep at a time. An active while the hum runs (an extension or
// a retrigger) restarts the ignition sweep and keeps the hum; nothing stacks.
import type { Bus } from '../core/events';

/** Ignition: a rising sweep, seconds and Hz (the music layer joins when it ends). */
export const IGNITION_SEC = 0.4;
export const IGNITION_F0 = 110;
export const IGNITION_F1 = 880;
export const IGNITION_GAIN = 0.075;
/** Ignition whoosh: band passed noise rising with the sweep, Hz (under the 7 kHz noise limit). */
export const IGNITION_NOISE_F0 = 500;
export const IGNITION_NOISE_F1 = 4200;
export const IGNITION_NOISE_GAIN = 0.035;
/** Power down: a falling sweep, seconds and Hz. */
export const POWER_DOWN_SEC = 0.45;
export const POWER_DOWN_F0 = 640;
export const POWER_DOWN_F1 = 70;
export const POWER_DOWN_GAIN = 0.07;
export const POWER_DOWN_NOISE_F0 = 2400;
export const POWER_DOWN_NOISE_F1 = 220;
export const POWER_DOWN_NOISE_GAIN = 0.025;
/** Engine hum: two detuned saws through a low pass, with a slow throb. Subtle: under the music. */
export const HUM_HZ = 55;
export const HUM_DETUNE_CENTS = 9;
export const HUM_LP_HZ = 300;
export const HUM_THROB_HZ = 7;
/** Throb depth: the hum swings between 1 - depth and 1 of its level. */
export const HUM_THROB_DEPTH = 0.3;
export const HUM_GAIN = 0.03;
export const HUM_RAMP_IN = 0.3;
/** The hum fades out with the music layer's fade. */
export const HUM_RELEASE = 0.3;
/** Fade when play is left or paused (no power down). */
export const TURBO_RESET_FADE = 0.08;
/** Fade of a sweep cut by the next one. */
export const SWEEP_CUT_SEC = 0.03;

export type TurboSweep = 'ignition' | 'powerDown';

/** Pure: a sweep's length and pitch path, Hz. */
export function sweepParams(kind: TurboSweep): { readonly dur: number; readonly f0: number; readonly f1: number; readonly gain: number } {
  return kind === 'ignition'
    ? { dur: IGNITION_SEC, f0: IGNITION_F0, f1: IGNITION_F1, gain: IGNITION_GAIN }
    : { dur: POWER_DOWN_SEC, f0: POWER_DOWN_F0, f1: POWER_DOWN_F1, gain: POWER_DOWN_GAIN };
}

/** Pure: a sweep's noise band path, Hz. */
export function sweepNoise(kind: TurboSweep): { readonly f0: number; readonly f1: number; readonly gain: number } {
  return kind === 'ignition'
    ? { f0: IGNITION_NOISE_F0, f1: IGNITION_NOISE_F1, gain: IGNITION_NOISE_GAIN }
    : { f0: POWER_DOWN_NOISE_F0, f1: POWER_DOWN_NOISE_F1, gain: POWER_DOWN_NOISE_GAIN };
}

/** Pure: the sweep pitch at `elapsed` seconds, an exponential glide from f0 to f1, held after. */
export function sweepHzAt(kind: TurboSweep, elapsed: number): number {
  const p = sweepParams(kind);
  const k = Math.min(1, Math.max(0, Number.isFinite(elapsed) ? elapsed / p.dur : 0));
  return p.f0 * Math.pow(p.f1 / p.f0, k);
}

/**
 * Pure: the sweep level at `elapsed` seconds, 0 to its gain. The ignition swells toward its top
 * and lets go fast at the end; the power down starts loud and dies away.
 */
export function sweepGainAt(kind: TurboSweep, elapsed: number): number {
  const p = sweepParams(kind);
  if (!(elapsed >= 0) || elapsed > p.dur) return 0;
  const k = elapsed / p.dur;
  if (kind === 'ignition') return p.gain * (k < 0.85 ? 0.3 + 0.7 * (k / 0.85) : (1 - k) / 0.15);
  return p.gain * (1 - k) * (1 - k);
}

/** Pure: the two detuned hum frequencies, Hz. */
export function humPair(): readonly [number, number] {
  const k = Math.pow(2, HUM_DETUNE_CENTS / 1200);
  return [HUM_HZ / k, HUM_HZ * k];
}

/** Pure: the hum's throb factor at time t: between 1 - HUM_THROB_DEPTH and 1. */
export function humThrobAt(t: number): number {
  const s = Math.sin(2 * Math.PI * HUM_THROB_HZ * (Number.isFinite(t) ? t : 0));
  return 1 - HUM_THROB_DEPTH * (0.5 + 0.5 * s);
}

/** A running sound. stop is idempotent. */
export interface TurboHandle {
  stop(releaseSec: number): void;
}

/** What the controller needs from the sound side. Returns null when audio is not available (or the volume is 0). */
export interface TurboBackend {
  startHum(): TurboHandle | null;
  playSweep(kind: TurboSweep): TurboHandle | null;
}

export interface TurboController {
  /** True while Turbo is on, as the controller saw it. */
  active(): boolean;
  /** Live hums (0 or 1). */
  humCount(): number;
  dispose(): void;
}

/** Wire 'fx:turbo' on `b` to `backend`. The payload object is reused by the sim: the flag is read here. */
export function installTurboSfx(b: Bus, backend: TurboBackend): TurboController {
  let on = false;
  let hum: TurboHandle | null = null;
  let sweep: TurboHandle | null = null;

  const stopHum = (release: number): void => {
    hum?.stop(release);
    hum = null;
  };
  const playSweep = (kind: TurboSweep): void => {
    sweep?.stop(SWEEP_CUT_SEC);
    sweep = backend.playSweep(kind);
  };
  /** Leave play: everything stops quietly, no power down. */
  const reset = (): void => {
    on = false;
    stopHum(TURBO_RESET_FADE);
    sweep?.stop(TURBO_RESET_FADE);
    sweep = null;
  };

  const offs = [
    b.on('fx:turbo', (p) => {
      if (p.active === true) {
        on = true;
        playSweep('ignition');
        if (hum === null) hum = backend.startHum();
        return;
      }
      if (!on) return;
      on = false;
      stopHum(HUM_RELEASE);
      playSweep('powerDown');
    }),
    // Pause silences the hum; resume brings it back while Turbo is still on.
    b.on('game:pause', () => stopHum(TURBO_RESET_FADE)),
    b.on('game:resume', () => {
      if (on && hum === null) hum = backend.startHum();
    }),
    b.on('game:start', reset),
    b.on('game:quit', reset),
    b.on('game:over', reset),
    // Settings may open over a paused run: the hum stops as on pause. Any other screen leaves play.
    b.on('ui:screen', (p) => {
      if (p.screen === 'settings') stopHum(TURBO_RESET_FADE);
      else if (p.screen !== 'play') reset();
    }),
  ];
  return {
    active: () => on,
    humCount: () => (hum === null ? 0 : 1),
    dispose: () => {
      reset();
      for (const off of offs) off();
    },
  };
}
