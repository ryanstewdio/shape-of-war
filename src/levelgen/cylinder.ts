// Cylinder surface for the generator and validator (D13, phase C0; docs/09 section 2.5).
// Pure: no PRNG, no Date, no DOM. The arena is centred on (0, 0) as on the flat surface, but u
// (x) wraps with period arena.width: there are no left or right walls, only the two rims at
// y = -height / 2 and y = +height / 2. Positions are stored canonical, x in [-W/2, W/2).
import { bossForLevel } from './boss';
import { round1 } from './leveldef';
import type { ArenaDef, Obstacle, Vec2 } from './leveldef';

/** Salt of the surface stream, mulberry32(deriveSeed(seed, SURFACE_SALT)). ASCII "SURF". */
export const SURFACE_SALT = 0x53555246;
/** A cylinder arena's width (the u period) is a multiple of this. */
export const CYLINDER_WIDTH_STEP = 64;
/** Levels below this are always flat. */
export const CYLINDER_MIN_LEVEL = 11;
/** Share of eligible levels (11 and up, not a boss level) drawn as cylinder. */
export const CYLINDER_CHANCE = 0.35;

/** True when level n may be a cylinder: 11 and up and not a boss level (boss levels stay flat). */
export function cylinderEligible(levelIndex: number): boolean {
  return Number.isInteger(levelIndex) && levelIndex >= CYLINDER_MIN_LEVEL && bossForLevel(levelIndex) === null;
}

/**
 * Snap a rect width to a multiple of CYLINDER_WIDTH_STEP: nearest first, then step inward until
 * it fits maxWidth and the aspect bounds against height. Deterministic, no draw.
 */
export function cylinderWidth(width: number, height: number, maxWidth: number, minAspect: number, maxAspect: number): number {
  const step = CYLINDER_WIDTH_STEP;
  let w = Math.round(width / step) * step;
  while (w > step && (w > maxWidth || w / height > maxAspect)) w -= step;
  while (w / height < minAspect && w + step <= maxWidth) w += step;
  return w;
}

/** Canonical u: x shifted by whole periods into [-W/2, W/2). */
export function canonX(x: number, width: number): number {
  const h = width / 2;
  let v = x;
  while (v >= h) v -= width;
  while (v < -h) v += width;
  return v + 0;
}

/** Canonical u rounded to 0.1, still in [-W/2, W/2) (W/2 itself wraps to -W/2). */
export function roundCanonX(x: number, width: number): number {
  const v = round1(canonX(x, width)) + 0;
  return v >= width / 2 ? v - width : v;
}

/** Shortest signed u difference, in [-W/2, W/2]. */
export function wrapDx(dx: number, width: number): number {
  return dx - width * Math.round(dx / width);
}

/** Shortest distance between two points on the cylinder. */
export function cylDist(a: Vec2, b: Vec2, width: number): number {
  return Math.hypot(wrapDx(b.x - a.x, width), b.y - a.y);
}

/** obstaclePointDistance with the u difference wrapped. */
export function cylObstacleDistance(o: Obstacle, p: Vec2, width: number): number {
  const dx = Math.max(Math.abs(wrapDx(p.x - o.cx, width)) - o.w / 2, 0);
  const dy = Math.max(Math.abs(p.y - o.cy) - o.h / 2, 0);
  return Math.hypot(dx, dy);
}

const EPS = 1e-6;

/** insideArena for a cylinder: the margin applies to the rims only; x must be canonical. */
export function insideRims(arena: ArenaDef, p: Vec2, margin: number): boolean {
  const h = arena.width / 2;
  return p.x >= -h && p.x < h && Math.abs(p.y) <= arena.height / 2 - margin + EPS;
}

/** Farthest wrapped distance from the centre a point can be while margin in from both rims. */
export function cylFarthest(arena: ArenaDef, margin: number): number {
  return Math.hypot(arena.width / 2, arena.height / 2 - margin);
}
