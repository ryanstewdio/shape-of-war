// Pond ripple sounds (Tester 3: "a sound when an arena ripple happens so the player is alerted").
// 'sim:rippleWarn' plays a short rising retro alert RIPPLE_WARN_SEC before the wave; 'sim:ripple'
// plays a low watery bloop with a falling tail, louder with strength. Pure parameters plus the
// event controller; no Web Audio here, so tests run in node. rippleSynth.ts makes the sound.
// The existing cues do not pan by position, so neither does this one.
import type { Bus } from '../core/events';

/** Warn alert: six rising square steps, Hz. A stepped climb, unlike the drift burst's smooth sine. */
export const WARN_STEPS: readonly number[] = [330, 415, 523, 659, 831, 1047];
export const WARN_STEP_SEC = 0.125;
/** Total alert length, seconds (0.75, inside the 0.6 to 0.9 s brief). */
export const WARN_SEC = WARN_STEPS.length * WARN_STEP_SEC;
export const WARN_GAIN = 0.05;

/** Splash bloop: a sine that jumps up then falls, Hz and seconds. */
export const SPLASH_F_PEAK = 300;
export const SPLASH_F_END = 70;
export const SPLASH_SEC = 0.4;
/** Tail: low passed noise that falls in cutoff, Hz and seconds. */
export const SPLASH_TAIL_SEC = 0.5;
export const SPLASH_TAIL_F0 = 900;
export const SPLASH_TAIL_F1 = 160;
/** Splash level at strength 0 and at strength 1 (gain rises between them). */
export const SPLASH_GAIN_MIN = 0.06;
export const SPLASH_GAIN_MAX = 0.16;
/** Tail noise level as a share of the splash gain. */
export const SPLASH_TAIL_SHARE = 0.4;

/** Pure: the warn note frequency at `elapsed` seconds, held on the last step after the end. */
export function warnHzAt(elapsed: number): number {
  const i = Math.floor((Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0) / WARN_STEP_SEC);
  return WARN_STEPS[Math.min(WARN_STEPS.length - 1, i)] ?? WARN_STEPS[0] ?? 440;
}

/** Pure: splash gain for a strength; strength is clamped to 0..1 and a bad value counts as 0. */
export function splashGain(strength: number): number {
  const k = Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : 0;
  return SPLASH_GAIN_MIN + (SPLASH_GAIN_MAX - SPLASH_GAIN_MIN) * k;
}

/** What the controller needs from the sound side. Each call is silent when audio is not available. */
export interface RippleBackend {
  playWarn(): void;
  playSplash(gain: number): void;
}

export interface RippleController {
  dispose(): void;
}

/** Wire 'sim:rippleWarn' and 'sim:ripple' on `b` to `backend`. Payload objects are reused: fields are read here. */
export function installRippleSfx(b: Bus, backend: RippleBackend): RippleController {
  const offs = [
    b.on('sim:rippleWarn', () => backend.playWarn()),
    b.on('sim:ripple', (p) => backend.playSplash(splashGain(p.strength))),
  ];
  return {
    dispose: () => {
      for (const off of offs) off();
    },
  };
}
