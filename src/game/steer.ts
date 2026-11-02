// Small steering helpers shared by enemy step functions. No allocation.
// V3-H C0: every vector between two points goes through the world surface (delta), and every
// confined move goes through confineOn, so on a cylinder these helpers seek across the u seam,
// ignore the u walls and wrap the result. Flat is bit identical to the raw arithmetic.
import { wrapAngle } from '../core/math';
import { hash01 } from '../core/rng';
import type { Surface } from '../core/surface';
import { confineOn, createConfineResult } from './arena';
import { membraneMove } from './membrane';
import type { World } from './world';

const res = createConfineResult();
/** Scratch for surface deltas. Read both fields before the next delta call. */
const d2 = { x: 0, y: 0 };

/** Move id to (nx, ny), confined to the arena and obstacles (slides along walls; enemies squeeze through membranes). */
export function moveTo(w: World, id: number, nx: number, ny: number): void {
  const r = w.membranes ? membraneMove(w, id, nx, ny, res) : confineOn(w.surface, w.level.arena, nx, ny, w.radius[id] ?? 0, res);
  w.x[id] = r.x;
  w.y[id] = r.y;
}

/** Move in a straight line toward the ship at speed (u/s). Returns the heading used. */
export function seekShip(w: World, id: number, speed: number, dt: number): number {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const t = targetOf(w, id); // the ship, or a live decoy in range (wave D)
  w.surface.delta(x, y, w.x[t] ?? 0, w.y[t] ?? 0, d2);
  const dx = d2.x;
  const dy = d2.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) return w.rot[id] ?? 0;
  const step = Math.min(d, speed * dt);
  moveTo(w, id, x + (dx / d) * step, y + (dy / d) * step);
  return Math.atan2(dy, dx);
}

/** Turn angle cur toward target by at most maxDelta radians. */
export function turnToward(cur: number, target: number, maxDelta: number): number {
  const diff = wrapAngle(target - cur);
  if (diff > maxDelta) return wrapAngle(cur + maxDelta);
  if (diff < -maxDelta) return wrapAngle(cur - maxDelta);
  return wrapAngle(target);
}

/** Live decoy per world (a detached drone, wave D), absent or -1 for none. Set only by drones.ts. */
const decoys = new WeakMap<World, number>();

/** Decoy lure range (docs/13 "Drone pickups" rule 5): an entity this close to a live decoy chases it. */
export const DECOY_LURE_RANGE = 640;

/** Set (id above 0) or clear (-1) the world's live decoy. drones.ts owns the calls. */
export function setDecoy(w: World, id: number): void {
  if (id > 0) decoys.set(w, id);
  else decoys.delete(w);
}

/**
 * The entity id that enemy and boss code chases or aims at: the live decoy when there is one and
 * entity id is within DECOY_LURE_RANGE of it, otherwise the ship (id 0). A pure function of
 * positions. With no decoy live it returns 0 for every entity, so every v2 golden is unchanged.
 */
export function targetOf(w: World, id: number): number {
  const d = decoys.get(w);
  if (d === undefined || d <= 0 || w.alive[d] !== 1) return 0;
  w.surface.delta(w.x[id] ?? 0, w.y[id] ?? 0, w.x[d] ?? 0, w.y[d] ?? 0, d2);
  const dx = d2.x;
  const dy = d2.y;
  return dx * dx + dy * dy <= DECOY_LURE_RANGE * DECOY_LURE_RANGE ? d : 0;
}

/** Angle from entity a to entity b (boss code takes every vector between entities from here). */
export function angleBetween(w: World, a: number, b: number): number {
  w.surface.delta(w.x[a] ?? 0, w.y[a] ?? 0, w.x[b] ?? 0, w.y[b] ?? 0, d2);
  return Math.atan2(d2.y, d2.x);
}

/** Distance between entities a and b. */
export function distBetween(w: World, a: number, b: number): number {
  w.surface.delta(w.x[a] ?? 0, w.y[a] ?? 0, w.x[b] ?? 0, w.y[b] ?? 0, d2);
  const dx = d2.x;
  const dy = d2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Move id toward the point (tx, ty) by at most maxStep, confined. Returns the distance left before the move. */
export function stepToward(w: World, id: number, tx: number, ty: number, maxStep: number): number {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  w.surface.delta(x, y, tx, ty, d2);
  const dx = d2.x;
  const dy = d2.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) return 0;
  const s = Math.min(d, maxStep);
  moveTo(w, id, x + (dx / d) * s, y + (dy / d) * s);
  return d;
}

/** Angle from id to the ship. */
export function angleToShip(w: World, id: number): number {
  const t = targetOf(w, id); // the ship, or a live decoy in range (wave D)
  w.surface.delta(w.x[id] ?? 0, w.y[id] ?? 0, w.x[t] ?? 0, w.y[t] ?? 0, d2);
  return Math.atan2(d2.y, d2.x);
}

/** Move along heading at speed, confined to the arena. */
export function moveHeading(w: World, id: number, heading: number, speed: number, dt: number): void {
  moveTo(w, id, (w.x[id] ?? 0) + Math.cos(heading) * speed * dt, (w.y[id] ?? 0) + Math.sin(heading) * speed * dt);
}

export const DEG = Math.PI / 180;

/** Like moveTo, but returns true when the arena or an obstacle stopped the move (a wall hit). */
export function moveToHit(w: World, id: number, nx: number, ny: number): boolean {
  const r = w.membranes ? membraneMove(w, id, nx, ny, res) : confineOn(w.surface, w.level.arena, nx, ny, w.radius[id] ?? 0, res);
  w.x[id] = r.x;
  w.y[id] = r.y;
  return r.hit;
}

/** Distance from id to the ship. */
export function distToShip(w: World, id: number): number {
  const t = targetOf(w, id); // the ship, or a live decoy in range (wave D)
  w.surface.delta(w.x[id] ?? 0, w.y[id] ?? 0, w.x[t] ?? 0, w.y[t] ?? 0, d2);
  const dx = d2.x;
  const dy = d2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Wrap a phase timer t into [0, period). */
export function wrapPhase(t: number, period: number): number {
  if (t < period) return t;
  const r = t % period;
  return r < 0 ? r + period : r;
}

/**
 * Stable per entity variation in [0, 1) from the level seed, the entity id and a counter.
 * Stateless (hash01), so it never advances a PRNG.
 */
export function entityHash(w: World, id: number, n: number): number {
  return hash01((w.level.seed ^ Math.imul(id + 1, 0x85ebca6b)) >>> 0, n);
}

/**
 * True when a point at (px, py) lies inside the arc of +-halfArc radians around heading, seen from
 * (x, y). Pass the world surface so the test sees across the u seam (C1: bulwark and mirage); with
 * no surface the offset is the flat one.
 */
export function inFrontArc(
  x: number,
  y: number,
  heading: number,
  px: number,
  py: number,
  halfArc: number,
  surface?: Surface,
): boolean {
  let dx: number;
  let dy: number;
  if (surface !== undefined) {
    surface.delta(x, y, px, py, d2);
    dx = d2.x;
    dy = d2.y;
  } else {
    dx = px - x; // flat offset; C1 callers pass the surface
    dy = py - y;
  }
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-9) return true;
  return (Math.cos(heading) * dx + Math.sin(heading) * dy) / d >= Math.cos(halfArc);
}
