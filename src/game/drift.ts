// Release polish: open drum drift (docs/14 item 8). On a cylinder level with no obstacles the
// drum runs a current along u: DRIFT_BASE u/s always, rising to
// DRIFT_BURST (BURST_FACTOR x the base) for BURST_HOLD s every GAP_MIN to GAP_MAX s (start to
// start), ramping in and out over BURST_RAMP s on either side of the hold. Every speed is scaled by
// the difficulty driftScale. Direction and gaps are hashed from the level seed (hash01, never a
// PRNG). Telegraph (R2): 'sim:driftBurst' { inSec: DRIFT_WARN, dir } and bus 'sfx' 'spawn'
// DRIFT_WARN s before each burst ramp starts. Off open drums the state is inactive and stepWorld
// never calls stepDrift. No allocation.
// R3 (Ryan: "the drum does not actually spin faster or create any challenge"): moving everything
// together gave no relative motion, so the drift is now a current. The ship (while in play) takes
// the full speed, player bullets DRIFT_BULLET_SHARE of it and every other entity only
// DRIFT_ENEMY_SHARE. In a burst the ship must fight the current while the field slides past it.
// The camera follows the ship, so the drum still reads as turning with the flow.
import { bus } from '../core/events';
import { hash01 } from '../core/rng';
import type { LevelDef } from '../levelgen/leveldef';
import { STYLE_ORBIT } from './bullets';
import { difficultyOf } from './difficulty';
import type { World } from './world';

export const DRIFT_BASE = 40;
/** R2: a burst is this many times the base drift. */
export const BURST_FACTOR = 4;
export const DRIFT_BURST = DRIFT_BASE * BURST_FACTOR;
/** R2: full burst speed lasts 1.5 s (was 1.2 s with 0.3 s ramps, too soft to notice). */
export const BURST_HOLD = 1.5;
export const BURST_RAMP = 0.15;
/** Whole burst window: ramp in, hold, ramp out. */
export const BURST_LEN = BURST_RAMP + BURST_HOLD + BURST_RAMP;
export const GAP_MIN = 9;
export const GAP_MAX = 14;
/** Seconds before a burst ramp starts that the telegraph cue is emitted. */
export const DRIFT_WARN = 0.6;

/** R3: share of the drift speed every non ship entity takes (enemies lag the current). */
export const DRIFT_ENEMY_SHARE = 0.25;
/** R3: share of the drift speed player bullets take (orbit blades follow the ship and are skipped). */
export const DRIFT_BULLET_SHARE = 0.5;

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
  /** Free Play drift option (docs/14): 1 low (today), 2 high. Off clears active instead. */
  scale: number;
}

/** Pure: true when the level drifts (cylinder surface, no obstacles). */
export function isOpenDrum(level: LevelDef): boolean {
  // T3: the level 8 drum taste carries noDrift (Foundry), so it never drifts.
  return level.surface === 'cylinder' && level.arena.obstacles.length === 0 && level.noDrift !== true;
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
    scale: 1,
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

/** Reused 'sim:driftBurst' payload. */
const burstFx: { inSec: number; dir: 1 | -1 } = { inSec: DRIFT_WARN, dir: 1 };

/** Free Play drift scale (docs/14): off none, low 1 (today), high 2. */
export const FREE_PLAY_DRIFT_HIGH = 2;

/**
 * Apply the Free Play drift option to a world's drift state. Drum only: off an open drum the state
 * stays inactive whatever the option. off stops it, low leaves it as today, high doubles every speed.
 */
export function applyDriftOption(d: DriftState, option: 'off' | 'low' | 'high'): void {
  if (option === 'off') d.active = false;
  d.scale = option === 'high' ? FREE_PLAY_DRIFT_HIGH : 1;
}

/** Called by stepWorld after every move, before the wrap: shift the ship, bullets and entities along u. */
export function stepDrift(w: World, dt: number): void {
  const d = w.drift;
  const t = w.time;
  advanceBursts(d, t);
  if (!d.warned && t >= d.burstAt - DRIFT_WARN) {
    d.warned = true;
    burstFx.dir = d.dir < 0 ? -1 : 1;
    bus.emit('sim:driftBurst', burstFx);
    bus.emit('sfx', 'spawn');
  }
  const speed = driftSpeedAt(t - d.burstAt) * difficultyOf(w).driftScale * d.scale;
  d.speed = speed;
  const dx = d.dir * speed * dt;
  if (w.ship.active && w.alive[0] === 1) w.x[0] = (w.x[0] ?? 0) + dx;
  const ex = dx * DRIFT_ENEMY_SHARE;
  for (let id = 1; id < w.cap; id++) {
    if (w.alive[id] !== 1) continue;
    w.x[id] = (w.x[id] ?? 0) + ex;
  }
  const p = w.bullets;
  const bx = dx * DRIFT_BULLET_SHARE;
  for (let b = 0; b < p.cap; b++) {
    if (p.alive[b] !== 1 || p.style[b] === STYLE_ORBIT) continue;
    p.x[b] = (p.x[b] ?? 0) + bx;
  }
}
