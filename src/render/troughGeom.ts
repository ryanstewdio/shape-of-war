// Pure trough view geometry (trough wave, Ryan 2026-11-10). No pixi.js import, no PRNG.
// A trough level is drawn through the drum module's trough projection (drum.ts makeTroughDrum):
// every arena point (u, v) sits on the shared profile of src/core/trough.ts, recessed so the rims
// stay in the arena plane and the floor lies TROUGH_DEPTH_SHARE x W behind it. Nothing turns, so
// everything here is built on arena, tilt, fit or neon change only (allocates; never per frame).
// - the arena outline and the low tier grid are resampled along u so they bend with the valley;
// - the slope shade is a set of vertical bands filled in the grid colour, alpha rising with the
//   profile slope, so steep ground near the rims reads as steep on every effects tier.
import { troughSlope } from '../core/trough';
import { troughProject, type Drum, type DrumPoint } from './drum';

/** Sample spacing along u for outlines and grid lines on a trough, arena units. */
export const TROUGH_SAMPLE_U = 16;
/** Vertical shade bands across the arena width. */
export const TROUGH_SHADE_BANDS = 64;
/** Shade band alpha at the rim (steepest ground); the floor band is 0. */
export const TROUGH_SHADE_MAX = 0.2;

/** Pure: steepness at u, 0 on the floor to 1 at the rim (abs slope over the rim slope). */
export function troughSteep(u: number, width: number): number {
  const rim = Math.abs(troughSlope(width / 2, width));
  if (!(rim > 0)) return 0;
  const s = Math.abs(troughSlope(u, width)) / rim;
  return s > 1 ? 1 : s;
}

/** Pure: shade alpha for a band centred on u. */
export function troughShadeAlpha(u: number, width: number): number {
  return TROUGH_SHADE_MAX * troughSteep(u, width);
}

/**
 * Pure: the v span of a closed polygon (flat [x, y, ...] in arena units) on the vertical line at
 * u, as [min, max], or null when the line misses it. Exact for convex outlines (every arena shape).
 */
export function polySpanAt(poly: readonly number[], u: number): [number, number] | null {
  const n = poly.length >> 1;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = poly[2 * i] ?? 0;
    const y0 = poly[2 * i + 1] ?? 0;
    const x1 = poly[2 * j] ?? 0;
    const y1 = poly[2 * j + 1] ?? 0;
    const a = Math.min(x0, x1);
    const b = Math.max(x0, x1);
    if (u < a || u > b) continue;
    if (a === b) {
      lo = Math.min(lo, y0, y1);
      hi = Math.max(hi, y0, y1);
      continue;
    }
    const y = y0 + ((u - x0) / (x1 - x0)) * (y1 - y0);
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return lo <= hi ? [lo, hi] : null;
}

const pt: DrumPoint = { x: 0, y: 0, s: 1, a: 1, m: 1 };

/** Append the screen image of the segment (x0, y0) to (x1, y1) as a polyline, without its first point. */
function pushSampled(d: Drum, x0: number, y0: number, x1: number, y1: number, step: number, out: number[]): void {
  const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / (step > 0 ? step : TROUGH_SAMPLE_U)));
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    troughProject(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0, d, pt);
    out.push(pt.x, pt.y);
  }
}

/**
 * Pure: a closed arena polygon (flat, arena units) as a closed screen polyline on the trough, each
 * edge cut about every step of u (edges along v stay one segment: a line of constant u is straight
 * under the projection). The first point is repeated at the end. Allocates.
 */
export function troughOutline(d: Drum, poly: readonly number[], step: number = TROUGH_SAMPLE_U): number[] {
  const n = poly.length >> 1;
  const out: number[] = [];
  if (n < 2) return out;
  troughProject(poly[0] ?? 0, poly[1] ?? 0, 0, d, pt);
  out.push(pt.x, pt.y);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    pushSampled(d, poly[2 * i] ?? 0, poly[2 * i + 1] ?? 0, poly[2 * j] ?? 0, poly[2 * j + 1] ?? 0, step, out);
  }
  return out;
}

/**
 * Pure: flat grid segments [x0, y0, x1, y1, ...] (arena units, clipped to the arena) projected
 * onto the trough as screen segments, each cut about every step of u so it bends with the valley.
 * Clears out first. Allocates as out grows.
 */
export function troughGridSegs(d: Drum, segs: readonly number[], out: number[], step: number = TROUGH_SAMPLE_U): void {
  out.length = 0;
  const s = step > 0 ? step : TROUGH_SAMPLE_U;
  for (let i = 0; i + 3 < segs.length; i += 4) {
    const x0 = segs[i] ?? 0;
    const y0 = segs[i + 1] ?? 0;
    const x1 = segs[i + 2] ?? 0;
    const y1 = segs[i + 3] ?? 0;
    const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / s));
    troughProject(x0, y0, 0, d, pt);
    let px = pt.x;
    let py = pt.y;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      troughProject(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0, d, pt);
      out.push(px, py, pt.x, pt.y);
      px = pt.x;
      py = pt.y;
    }
  }
}

export interface ShadeBand {
  /** Screen quad [x, y] x 4: top left, top right, bottom right, bottom left. */
  readonly pts: number[];
  readonly alpha: number;
}

/**
 * Pure: the slope shade as vertical bands across the arena outline poly (arena units), each a
 * screen quad with the shade alpha of its centre. Bands that would show nothing, or that the
 * outline does not cover at both ends, are left out. Allocates.
 */
export function troughShadeBands(d: Drum, poly: readonly number[], bands: number = TROUGH_SHADE_BANDS): ShadeBand[] {
  const n = Math.max(1, Math.round(bands));
  const out: ShadeBand[] = [];
  const w = d.width;
  for (let i = 0; i < n; i++) {
    const u0 = -w / 2 + (i / n) * w;
    const u1 = -w / 2 + ((i + 1) / n) * w;
    const alpha = troughShadeAlpha((u0 + u1) / 2, w);
    if (!(alpha > 0.002)) continue;
    const s0 = polySpanAt(poly, u0);
    const s1 = polySpanAt(poly, u1);
    if (!s0 || !s1) continue;
    const pts: number[] = [];
    troughProject(u0, s0[0], 0, d, pt);
    pts.push(pt.x, pt.y);
    troughProject(u1, s1[0], 0, d, pt);
    pts.push(pt.x, pt.y);
    troughProject(u1, s1[1], 0, d, pt);
    pts.push(pt.x, pt.y);
    troughProject(u0, s0[1], 0, d, pt);
    pts.push(pt.x, pt.y);
    out.push({ pts, alpha });
  }
  return out;
}

/**
 * Pure: the ?trough=1 dev knob (behind ?dev=1 like every knob; main.ts strips it otherwise).
 * Render only: draws any non cylinder level as a trough so the view can be checked on device
 * before trough levels are generated. The sim is untouched (no pull).
 */
export function parseTroughKnob(search: string): boolean {
  return new URLSearchParams(search).get('trough') === '1';
}
