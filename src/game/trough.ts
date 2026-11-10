// Trough wave (Ryan 2026-11-10): the "half drum" valley. On a level whose surface is 'trough' the
// ship alone feels a pull along u toward the valley floor (u = 0), proportional to the shared profile
// slope (src/core/trough.ts): near zero at the bottom, strongest at the rims. Like the drum drift it
// is a current, a position shift each step, so the ship can still climb to a rim and fight there but
// must keep thrusting. Scaled by the difficulty driftScale. Enemies, bullets, geoms and pickups are
// untouched. The shift goes through confineOn, so the rim walls and obstacles stay solid and nothing
// wraps. Off a trough stepWorld never calls stepTrough, so every other level stays bit identical.
// Deterministic: no PRNG, no allocation.
import { troughSlope } from '../core/trough';
import type { FreePlayConfig } from '../core/freeplayConfig';
import type { LevelDef } from '../levelgen/leveldef';
import { confineOn, createConfineResult } from './arena';
import { difficultyOf } from './difficulty';
import { SHIP_ID, SHIP_RADIUS } from './ship';
import type { World } from './world';

/**
 * Pull speed (u/s) per unit of profile slope at normal difficulty. The rim slope is
 * 2 x TROUGH_DEPTH_SHARE x TROUGH_POWER (about 1.66), so the rim pull is about 160 u/s, the drum
 * burst speed, well under SHIP_SPEED (420) even at insane (x 1.6).
 */
export const TROUGH_PULL = 96;

/** Pure: true when the level plays on the trough surface. */
export function isTrough(level: LevelDef): boolean {
  return level.surface === 'trough';
}

/**
 * Pure: signed pull velocity along u (u/s) at position u on a trough of the given width, for a
 * difficulty scale. Points downhill, toward u = 0: negative on the right half, positive on the left.
 */
export function troughPullAt(u: number, width: number, scale: number): number {
  const s = troughSlope(u, width);
  return s === 0 ? 0 : -s * TROUGH_PULL * scale;
}

/**
 * Free Play (docs/14): the level with the config's surface. 'trough' turns a flat arena into a
 * trough (a drum keeps its cylinder); 'flat' or absent returns the level unchanged. A copy when it
 * changes anything; the caller's level is untouched.
 */
export function freePlaySurfaceRules(level: LevelDef, fp: FreePlayConfig): LevelDef {
  if (fp.surface !== 'trough') return level;
  const kind = level.surface ?? 'flat';
  if (kind !== 'flat') return level;
  return { ...level, surface: 'trough' };
}

const res = createConfineResult();

/** Called by stepWorld on a trough level after the ship and bullets move: pull the ship downhill. */
export function stepTrough(w: World, dt: number): void {
  if (!w.ship.active || w.alive[SHIP_ID] !== 1) return;
  const x = w.x[SHIP_ID] ?? 0;
  const vx = troughPullAt(x, w.surface.width, difficultyOf(w).driftScale);
  if (vx === 0) return;
  const c = confineOn(w.surface, w.level.arena, x + vx * dt, w.y[SHIP_ID] ?? 0, SHIP_RADIUS, res);
  w.x[SHIP_ID] = c.x;
  w.y[SHIP_ID] = c.y;
}
