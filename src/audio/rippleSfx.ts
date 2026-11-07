// Pond ripple sound. A ripple starts only when a super nova gravity well is destroyed, so the
// cue follows that explosion. There is no warning sound: 'sim:ripple' plays one short wave cue,
// a deep thump then a watery whoosh that sweeps down for about 1.5 s, a little louder with
// strength. Pure parameters plus the event controller; no Web Audio here, so tests run in node.
// rippleSynth.ts makes the sound. The existing cues do not pan by position, so neither does this one.
import type { Bus } from '../core/events';

/** Thump: a low sine that drops fast, Hz and seconds. */
export const THUMP_F_START = 70;
export const THUMP_F_END = 50;
export const THUMP_SEC = 0.35;
/** Whoosh: band passed noise whose centre sweeps down, Hz. Starts just after the thump. */
export const WHOOSH_DELAY_SEC = 0.12;
export const WHOOSH_SEC = 1.5;
export const WHOOSH_F0 = 1800;
export const WHOOSH_F1 = 220;
export const WHOOSH_Q = 1.2;
/** Total cue length, seconds (about 1.5 s of whoosh, matching the wave). */
export const RIPPLE_SEC = WHOOSH_SEC;
/**
 * Thump level at strength 0 and at strength 1 (gain rises between them). The max is capped at
 * the loudest boss voice peak (0.22, bossRumble and bossDeath noise in cues.ts).
 */
export const RIPPLE_GAIN_MIN = 0.2;
export const RIPPLE_GAIN_MAX = 0.22;
/** Whoosh level as a share of the thump gain. */
export const WHOOSH_SHARE = 0.7;

/** Pure: ripple gain for a strength; strength is clamped to 0..1 and a bad value counts as 0. */
export function rippleGain(strength: number): number {
  const k = Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : 0;
  return RIPPLE_GAIN_MIN + (RIPPLE_GAIN_MAX - RIPPLE_GAIN_MIN) * k;
}

/** What the controller needs from the sound side. Each call is silent when audio is not available. */
export interface RippleBackend {
  playRipple(gain: number): void;
}

export interface RippleController {
  dispose(): void;
}

/** Wire 'sim:ripple' on `b` to `backend`. Payload objects are reused: fields are read here. */
export function installRippleSfx(b: Bus, backend: RippleBackend): RippleController {
  const off = b.on('sim:ripple', (p) => backend.playRipple(rippleGain(p.strength)));
  return { dispose: off };
}
