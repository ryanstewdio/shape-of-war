// Boss shot tick: a short soft tick when a shot lands on a guardian ('sim:bossHit' landed true),
// and a duller, quieter thunk when it is blocked (landed false). Each is rate limited and extra
// hits are dropped. Pure parameters plus the event controller; no Web Audio here, so tests run
// in node. bossTickSynth.ts makes the sound through the sfx master (effects volume and mute).
import type { Bus } from '../core/events';
import { createWindowLimiter, type RateLimiter } from './cues';

export interface BossTickParams {
  /** Start and end frequency of the sine sweep, Hz. */
  readonly f0: number;
  readonly f1: number;
  /** Length in seconds. */
  readonly dur: number;
  /** Peak level. */
  readonly gain: number;
  /** Low pass cutoff, Hz. */
  readonly cutoff: number;
}

/** Landed: a short soft tick, under 40 ms, far below the ripple (0.2 minimum) and the boss music. */
export const TICK_LANDED: BossTickParams = { f0: 1500, f1: 900, dur: 0.03, gain: 0.035, cutoff: 3500 };
/** Blocked: duller, lower and quieter. */
export const TICK_BLOCKED: BossTickParams = { f0: 320, f1: 180, dur: 0.05, gain: 0.02, cutoff: 700 };
/** Strict caps: at most this many plays inside any one second. */
export const LANDED_PER_SEC = 12;
export const BLOCKED_PER_SEC = 6;

/** What the controller needs from the sound side. Silent when audio is not available. */
export interface BossTickBackend {
  play(p: BossTickParams): void;
}

export interface BossTickController {
  dispose(): void;
}

/** Wire 'sim:bossHit' on `b` to `backend`. `now` is a clock in seconds (injectable for tests). */
export function installBossTick(b: Bus, backend: BossTickBackend, now: () => number = defaultNow): BossTickController {
  const landed: RateLimiter = createWindowLimiter(LANDED_PER_SEC);
  const blocked: RateLimiter = createWindowLimiter(BLOCKED_PER_SEC);
  const off = b.on('sim:bossHit', (p) => {
    const t = now();
    if (p.landed) {
      if (landed.allow(t)) backend.play(TICK_LANDED);
    } else if (blocked.allow(t)) {
      backend.play(TICK_BLOCKED);
    }
  });
  return { dispose: off };
}

function defaultNow(): number {
  return performance.now() / 1000;
}
