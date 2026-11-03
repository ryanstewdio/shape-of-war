// Swirl (docs/10 wave C): orbits the ship at 0.6 rad/s (direction from the entity hash) while
// closing 20 u/s from the 240 u orbit radius. Outside the orbit radius it spirals in at 144 u/s
// radial with 144 u/s tangential. At 90 u it commits to a straight dive at 300 u/s along the
// heading to the ship at that moment; a wall or DIVE_MAX_SEC ends the dive and it orbits again.
// State: w.t is seconds into the dive (0 while orbiting), w.rot the travel heading (locked
// during the dive). Render contract: position and rotation only.
import { enemySpeedScale } from '../state';
import { entityHash, moveTo, moveToHit, targetOf } from '../steer';
import { Kind, type World } from '../world';
import type { EnemyDef } from './types';

export const def: EnemyDef = { kind: Kind.Swirl, radius: 12, speed: 144, value: 80, colour: 'swirl', hp: 1, geoms: 1 };

export const ORBIT_RADIUS = 240;
export const ANGULAR_SPEED = 0.6;
export const CLOSE_SPEED = 20;
/** Radial speed while outside ORBIT_RADIUS. */
export const APPROACH_SPEED = 144;
export const DIVE_RADIUS = 90;
export const DIVE_SPEED = 300;
export const DIVE_MAX_SEC = 1.5;

/** +1 counter clockwise or -1 clockwise, fixed per entity. */
export function orbitDir(w: World, id: number): number {
  return entityHash(w, id, 0) < 0.5 ? 1 : -1;
}

/** Pure: angular speed (rad/s) at distance d: 0.6 inside the orbit radius, 144 u/s tangential outside. */
export function angularSpeed(d: number): number {
  if (d <= ORBIT_RADIUS) return ANGULAR_SPEED;
  return (ANGULAR_SPEED * ORBIT_RADIUS) / d;
}

/** True while diving. */
export function isDiving(w: World, id: number): boolean {
  return (w.t[id] ?? 0) > 0;
}

function dive(w: World, id: number, dt: number, scale: number): void {
  const h = w.rot[id] ?? 0;
  const s = DIVE_SPEED * scale * dt;
  const hit = moveToHit(w, id, (w.x[id] ?? 0) + Math.cos(h) * s, (w.y[id] ?? 0) + Math.sin(h) * s);
  const t = (w.t[id] ?? 0) + dt;
  w.t[id] = hit || t >= DIVE_MAX_SEC ? 0 : t;
}

/** Scratch for surface deltas. */
const sd = { x: 0, y: 0 };

export function step(w: World, id: number, dt: number): void {
  // R2: the dive is the attack and keeps its speed; an enraged Swirl approaches and orbits faster.
  const base = enemySpeedScale(w);
  const scale = enemySpeedScale(w, id);
  if (isDiving(w, id)) {
    dive(w, id, dt, base);
    return;
  }
  // The orbit centre is the target (ship or live decoy), reached through surface.delta so it is
  // the short way round on a cylinder. Orbiting the ship while measuring to a decoy bunched Swirls.
  const x0 = w.x[id] ?? 0;
  const y0 = w.y[id] ?? 0;
  const t = targetOf(w, id);
  w.surface.delta(x0, y0, w.x[t] ?? 0, w.y[t] ?? 0, sd);
  const tx = sd.x;
  const ty = sd.y;
  const d = Math.sqrt(tx * tx + ty * ty);
  if (d <= DIVE_RADIUS) {
    w.rot[id] = Math.atan2(ty, tx);
    w.t[id] = 1e-6;
    dive(w, id, dt, base);
    return;
  }
  const theta = Math.atan2(ty, tx) + Math.PI; // target to swirl
  const radial = (d > ORBIT_RADIUS ? APPROACH_SPEED : CLOSE_SPEED) * scale * dt;
  // No clamp at DIVE_RADIUS: the next step sees d under it and commits.
  const nd = d - radial > 0 ? d - radial : 0;
  const nth = theta + orbitDir(w, id) * angularSpeed(d) * scale * dt;
  // Centre in the swirl's own frame (unwrapped next to it), so moveTo wraps or confines the result.
  const cx = x0 + tx;
  const cy = y0 + ty;
  moveTo(w, id, cx + Math.cos(nth) * nd, cy + Math.sin(nth) * nd);
  w.surface.delta(x0, y0, w.x[id] ?? 0, w.y[id] ?? 0, sd);
  const mx = sd.x;
  const my = sd.y;
  if (mx * mx + my * my > 1e-12) w.rot[id] = Math.atan2(my, mx);
}
