// Pure membrane bar styling (R2 glow-r2-membrane). An Obstacle with membrane true blocks the ship and
// its bullets but lets enemies squeeze through. It draws with the exact ring bar style of a solid
// obstacle (same passes, colour and glow, drawn by the same wall and drum obstacle code) but broken
// into segments with small regular openings. While an enemy overlaps the bar, the section within
// MEMBRANE_GLOW_RADIUS of it glows red. No pixi import, no PRNG, no allocation in the per frame helpers.
import type { ArenaDef, Obstacle } from '../levelgen/leveldef';

/** Share of the bar length left open, split evenly between the openings. */
export const MEMBRANE_OPEN_SHARE = 0.1;
/** Target segment pitch in arena units; the count rounds to it. */
export const MEMBRANE_SEG_TARGET = 90;
/** Arena units along the bar either side of an overlapping enemy that glow red. */
export const MEMBRANE_GLOW_RADIUS = 60;
/** Red glow fade in and fade out, seconds for the full range. */
export const MEMBRANE_GLOW_IN = 0.1;
export const MEMBRANE_GLOW_OUT = 0.4;
/** Target glow cell length in arena units, and the cell cap per bar. */
export const MEMBRANE_CELL = 15;
export const MEMBRANE_MAX_CELLS = 128;
/** Glow levels are quantised to this many steps so equal neighbours merge into one stroke. */
export const MEMBRANE_GLOW_STEPS = 8;

export type ObstacleStyle = 'membrane' | 'solid';

/** Pure: which style an obstacle takes. */
export function obstacleStyle(o: Obstacle): ObstacleStyle {
  return o.membrane === true ? 'membrane' : 'solid';
}

/** Pure: the solid obstacles of an arena. */
export function solidObstacles(a: ArenaDef): Obstacle[] {
  return a.obstacles.filter((o) => o.membrane !== true);
}

/** Pure: the membrane obstacles of an arena. */
export function membraneObstacles(a: ArenaDef): Obstacle[] {
  return a.obstacles.filter((o) => o.membrane === true);
}

/** Pure: true when the bar runs along y (its long axis). */
export function isVertical(o: Obstacle): boolean {
  return o.h >= o.w;
}

/** Pure: number of segments for a bar of this length: at least two, so there is always an opening. */
export function membraneSegmentCount(len: number): number {
  if (!(len > 0)) return 2;
  return Math.max(2, Math.round(len / MEMBRANE_SEG_TARGET));
}

/**
 * Pure: segment intervals along a bar from s0 of length len, written as [a0, b0, a1, b1, ...] into
 * out. n segments and n - 1 equal openings that together take MEMBRANE_OPEN_SHARE of the length;
 * the ends are closed. Returns the segment count.
 */
export function membraneSegments(s0: number, len: number, out: number[]): number {
  const n = membraneSegmentCount(len);
  const gap = (MEMBRANE_OPEN_SHARE * len) / (n - 1);
  const seg = ((1 - MEMBRANE_OPEN_SHARE) * len) / n;
  out.length = 0;
  for (let k = 0; k < n; k++) {
    const a = s0 + k * (seg + gap);
    out.push(a, a + seg);
  }
  return n;
}

/** Pure: the closed rectangles one membrane bar draws as (the solid ring bar outline per segment). */
export function membraneSegmentRects(o: Obstacle): Obstacle[] {
  const vertical = isVertical(o);
  const len = vertical ? o.h : o.w;
  const s0 = (vertical ? o.cy : o.cx) - len / 2;
  const iv: number[] = [];
  const n = membraneSegments(s0, len, iv);
  const out: Obstacle[] = [];
  for (let k = 0; k < n; k++) {
    const a = iv[2 * k] ?? 0;
    const b = iv[2 * k + 1] ?? 0;
    const mid = (a + b) / 2;
    const l = b - a;
    out.push(vertical ? { cx: o.cx, cy: mid, w: o.w, h: l } : { cx: mid, cy: o.cy, w: l, h: o.h });
  }
  return out;
}

const rectCache = new WeakMap<ArenaDef, Obstacle[]>();

/**
 * Pure (cached per arena object): every rectangle the barrier outline code strokes. Solid obstacles
 * as they are, membrane bars as their segment rectangles, so both share one drawing path and style.
 */
export function barrierRects(a: ArenaDef): Obstacle[] {
  const hit = rectCache.get(a);
  if (hit) return hit;
  const out: Obstacle[] = [];
  for (const o of a.obstacles) {
    if (o.membrane === true) out.push(...membraneSegmentRects(o));
    else out.push(o);
  }
  rectCache.set(a, out);
  return out;
}

/** Pure: does a circle overlap an obstacle rectangle? */
export function circleOverlapsObstacle(o: Obstacle, x: number, y: number, r: number): boolean {
  const dx = Math.abs(x - o.cx) - o.w / 2;
  const dy = Math.abs(y - o.cy) - o.h / 2;
  const ox = dx > 0 ? dx : 0;
  const oy = dy > 0 ? dy : 0;
  return ox * ox + oy * oy <= r * r;
}

/** Pure: glow cells along a bar of this length. */
export function membraneCellCount(len: number): number {
  if (!(len > 0)) return 1;
  return Math.max(1, Math.min(MEMBRANE_MAX_CELLS, Math.ceil(len / MEMBRANE_CELL)));
}

/**
 * Pure: mark (set to 1) the cells of one bar whose centre lies within radius of the hit position.
 * hitS is measured from the bar start; the bar's cells start at offset in target.
 */
export function markGlowCells(target: Uint8Array, offset: number, cells: number, len: number, hitS: number, radius: number = MEMBRANE_GLOW_RADIUS): void {
  const cl = len / cells;
  const lo = Math.max(0, Math.ceil((hitS - radius) / cl - 0.5));
  const hi = Math.min(cells - 1, Math.floor((hitS + radius) / cl - 0.5));
  for (let c = lo; c <= hi; c++) target[offset + c] = 1;
}

/** Pure: a cell glow level after dt seconds, rising over MEMBRANE_GLOW_IN while lit and falling over MEMBRANE_GLOW_OUT. */
export function stepGlow(level: number, dt: number, lit: boolean): number {
  if (lit) {
    const up = level + dt / MEMBRANE_GLOW_IN;
    return up < 1 ? up : 1;
  }
  const down = level - dt / MEMBRANE_GLOW_OUT;
  return down > 0 ? down : 0;
}

/** Pure: a glow level quantised to MEMBRANE_GLOW_STEPS steps (0 means not drawn). */
export function glowStep(level: number): number {
  return Math.round(Math.max(0, Math.min(1, level)) * MEMBRANE_GLOW_STEPS);
}
