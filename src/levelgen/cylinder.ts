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

/** Most obstacles a cylinder rectObstacles arena may carry (drum layouts, phase C2). */
export const CYLINDER_MAX_OBSTACLES = 10;

/** obstacleGap with the u difference wrapped: 0 when the boxes touch or overlap. */
export function cylObstacleGap(a: Obstacle, b: Obstacle, width: number): number {
  const dx = Math.max(Math.abs(wrapDx(a.cx - b.cx, width)) - (a.w + b.w) / 2, 0);
  const dy = Math.max(Math.abs(a.cy - b.cy) - (a.h + b.h) / 2, 0);
  return Math.hypot(dx, dy);
}

/**
 * True when a and b are the two halves of one bar cut at the u seam: same row and thickness, one
 * ends at +W/2 and the other starts at -W/2. Such a pair is one continuous wall on the drum.
 */
export function seamJoined(a: Obstacle, b: Obstacle, width: number): boolean {
  if (Math.abs(a.cy - b.cy) > EPS || Math.abs(a.h - b.h) > EPS) return false;
  const h = width / 2;
  const endsAtSeam = (o: Obstacle): boolean => Math.abs(o.cx + o.w / 2 - h) < EPS;
  const startsAtSeam = (o: Obstacle): boolean => Math.abs(o.cx - o.w / 2 + h) < EPS;
  return (endsAtSeam(a) && startsAtSeam(b)) || (endsAtSeam(b) && startsAtSeam(a));
}

/** Result of a wrapped grid flood fill over a cylinder arena. */
export interface DrumFlood {
  /** Grid columns (W / cell) and rows (floor(H / cell)). */
  nx: number;
  ny: number;
  /** Cells inside the rims and clear of every obstacle. */
  walkable: number;
  /** Walkable cells reached from the spawn cell. */
  reached: number;
  /** A reached cell in the outermost walkable row at each rim. */
  top: boolean;
  bottom: boolean;
}

/** True when (x, y) lies inside obstacle o grown by c on every side, u wrapped. */
function inGrown(o: Obstacle, x: number, y: number, c: number, width: number, extraX: number, extraY: number): boolean {
  return Math.abs(wrapDx(x - o.cx, width)) < o.w / 2 + c + extraX && Math.abs(y - o.cy) < o.h / 2 + c + extraY;
}

/**
 * Flood fill on a cell grid that wraps in u (cell must divide the width). A cell is walkable when
 * its centre is clearance in from both rims and outside every obstacle grown by clearance (a
 * rectangle, so it never sees a gap the ship could not use). Two neighbour cells link only when
 * the segment between their centres misses every grown obstacle, so a thin wall between rows
 * still blocks. Pure, allocates two typed arrays per call.
 */
export function drumFlood(arena: ArenaDef, cell: number, clearance: number): DrumFlood {
  const W = arena.width;
  const nx = Math.round(W / cell);
  const ny = Math.floor(arena.height / cell);
  const empty: DrumFlood = { nx, ny, walkable: 0, reached: 0, top: false, bottom: false };
  if (!(nx > 0 && ny > 0) || Math.abs(nx * cell - W) > EPS || nx * ny > 1_000_000) return empty;
  const x0 = -W / 2;
  const y0 = -(ny * cell) / 2;
  const rim = arena.height / 2 - clearance;
  const obs = arena.obstacles;
  const cx = (i: number): number => x0 + (i + 0.5) * cell;
  const cy = (j: number): number => y0 + (j + 0.5) * cell;
  const walk = new Uint8Array(nx * ny);
  let walkable = 0;
  for (let j = 0; j < ny; j++) {
    const y = cy(j);
    if (Math.abs(y) > rim + EPS) continue;
    for (let i = 0; i < nx; i++) {
      const x = cx(i);
      if (obs.some((o) => inGrown(o, x, y, clearance, W, 0, 0))) continue;
      walk[j * nx + i] = 1;
      walkable++;
    }
  }
  const si = Math.min(nx - 1, Math.max(0, Math.floor((arena.spawnPoint.x - x0) / cell)));
  const sj = Math.min(ny - 1, Math.max(0, Math.floor((arena.spawnPoint.y - y0) / cell)));
  const start = sj * nx + si;
  if (walk[start] !== 1) return { ...empty, walkable };
  const seen = new Uint8Array(nx * ny);
  const queue = new Int32Array(walkable);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  const half = cell / 2;
  // Segment from cell k toward neighbour n: blocked when its midpoint, widened by half a cell along
  // the step, falls inside a grown obstacle.
  const link = (n: number, horizontal: boolean, mx: number, my: number): void => {
    if (seen[n] === 1 || walk[n] !== 1) return;
    const ex = horizontal ? half : 0;
    const ey = horizontal ? 0 : half;
    if (obs.some((o) => inGrown(o, mx, my, clearance, W, ex, ey))) return;
    seen[n] = 1;
    queue[tail++] = n;
  };
  while (head < tail) {
    const k = queue[head++] ?? 0;
    const i = k % nx;
    const j = (k - i) / nx;
    const x = cx(i);
    const y = cy(j);
    link(j * nx + ((i + 1) % nx), true, x + half, y);
    link(j * nx + ((i + nx - 1) % nx), true, x - half, y);
    if (j + 1 < ny) link(k + nx, false, x, y + half);
    if (j > 0) link(k - nx, false, x, y - half);
  }
  // The rim rows are the outermost rows holding any walkable cell.
  const rowWalkable = (j: number): boolean => walk.subarray(j * nx, (j + 1) * nx).includes(1);
  const rowReached = (j: number): boolean => seen.subarray(j * nx, (j + 1) * nx).includes(1);
  let jt = ny - 1;
  while (jt > 0 && !rowWalkable(jt)) jt--;
  let jb = 0;
  while (jb < ny - 1 && !rowWalkable(jb)) jb++;
  const top = rowReached(jt);
  const bottom = rowReached(jb);
  return { nx, ny, walkable, reached: tail, top, bottom };
}

/** A6 on a cylinder: every walkable cell is reached from spawn and both rims are reached. */
export function drumConnected(arena: ArenaDef, cell: number, clearance: number): boolean {
  const f = drumFlood(arena, cell, clearance);
  return f.walkable > 0 && f.reached === f.walkable && f.top && f.bottom;
}
