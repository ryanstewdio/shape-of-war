// Release polish: open drum drift (docs/14 item 8). On a cylinder level with no obstacles every
// live entity and the ship (while in play) drift along u: DRIFT_BASE u/s always, rising to
// DRIFT_BURST for BURST_HOLD s every GAP_MIN to GAP_MAX s (start to start), ramping in and out over
// BURST_RAMP s on either side of the hold. Direction and gaps are hashed from the level seed
// (hash01, never a PRNG). Telegraph: bus 'sfx' 'spawn' DRIFT_WARN s before each burst ramp starts.
// Off open drums the state is inactive and stepWorld never calls stepDrift. No allocation.
import { bus } from '../core/events';
import { hash01 } from '../core/rng';
import type { LevelDef } from '../levelgen/leveldef';
import { difficultyOf } from './difficulty';
import type { World } from './world';

export const DRIFT_BASE = 40;
export const DRIFT_BURST = 160;
export const BURST_HOLD = 1.2;
export const BURST_RAMP = 0.3;
/** Whole burst window: ramp in, hold, ramp out. */
export const BURST_LEN = BURST_RAMP + BURST_HOLD + BURST_RAMP;
export const GAP_MIN = 9;
export const GAP_MAX = 14;
/** Seconds before a burst ramp starts that the telegraph cue is emitted. */
export const DRIFT_WARN = 0.6;

const SALT_DIR = 0x64726674;
const SALT_GAP = 0x62727374;

export interface DriftState {
  /** True on a cylinder level with no obstacles. */
  active: boolean;
  /** Drift direction along u: 1 or -1, fixed per level. */
  dir: number;
  seed: number;
  /** Index of the next (or current) burst, 0 based. */
  k: number;
  /** Sim time (w.time) the burst k ramp starts. */
  burstAt: number;
  /** True once burst k has been telegraphed. */
  warned: boolean;
  /** Drift speed of the latest step, u/s (render and HUD may read it). */
  speed: number;
}

/** Pure: true when the level drifts (cylinder surface, no obstacles). */
export function isOpenDrum(level: LevelDef): boolean {
  return level.surface === 'cylinder' && level.arena.obstacles.length === 0;
}

/** Pure: drift direction for a seed, 1 or -1. */
export function driftDir(seed: number): number {
  return hash01(seed >>> 0, SALT_DIR) < 0.5 ? -1 : 1;
}

/** Pure: seconds from burst k - 1 start to burst k start (burst 0: from level start), in [GAP_MIN, GAP_MAX). */
export function burstGap(seed: number, k: number): number {
  return GAP_MIN + (GAP_MAX - GAP_MIN) * hash01((seed ^ SALT_GAP) >>> 0, k);
}

/** Pure: burst weight 0 to 1 at s seconds after a burst ramp starts. */
export function burstWeight(s: number): number {
  if (s <= 0 || s >= BURST_LEN) return 0;
  if (s < BURST_RAMP) return s / BURST_RAMP;
  if (s <= BURST_RAMP + BURST_HOLD) return 1;
  return (BURST_LEN - s) / BURST_RAMP;
}

/** Pure: drift speed (u/s, unsigned) at s seconds after a burst ramp starts. */
export function driftSpeedAt(s: number): number {
  return DRIFT_BASE + (DRIFT_BURST - DRIFT_BASE) * burstWeight(s);
}

export function createDrift(level: LevelDef): DriftState {
  const seed = level.seed >>> 0;
  return {
    active: isOpenDrum(level),
    dir: driftDir(seed),
    seed,
    k: 0,
    burstAt: burstGap(seed, 0),
    warned: false,
    speed: 0,
  };
}

/** Advance the burst schedule to sim time t (pure on the state object, no bus). */
export function advanceBursts(d: DriftState, t: number): void {
  while (t >= d.burstAt + BURST_LEN) {
    d.k++;
    d.burstAt += burstGap(d.seed, d.k);
    d.warned = false;
  }
}

/** Called by stepWorld after every move, before the wrap: shift every live entity along u. */
export function stepDrift(w: World, dt: number): void {
  const d = w.drift;
  const t = w.time;
  advanceBursts(d, t);
  if (!d.warned && t >= d.burstAt - DRIFT_WARN) {
    d.warned = true;
    bus.emit('sfx', 'spawn');
  }
  const speed = driftSpeedAt(t - d.burstAt) * difficultyOf(w).driftScale;
  d.speed = speed;
  const dx = d.dir * speed * dt;
  const start = w.ship.active ? 0 : 1;
  for (let id = start; id < w.cap; id++) {
    if (w.alive[id] !== 1) continue;
    w.x[id] = (w.x[id] ?? 0) + dx;
  }
}
