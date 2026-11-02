// Pure pseudo 3D volume for the tilt (G6 tilt-depth: "more 3D rounding on all objects"). No pixi.js
// import, no PRNG. Off never reaches this code: the depth is 0 and the renderer draws nothing.
// Every neon shape gets an extruded copy of its outline offset toward the viewer's down direction
// (screen +y in the projected world) by a depth proportional to its drawn radius and the tilt
// (VOLUME_DEPTH of the radius at the high tilt, scaled by sin T / sin(high) below it), joined to the
// top outline by edge lines at the vertices. The side faces and edges draw at SIDE_ALPHA, darker
// toward the base by alpha only (never black paint); the top outline (the entity view itself) stays
// at full brightness, and a lighter thin stroke picks out the edges facing up. Round shapes
// (circles, wells, Splime) get the two tangent edges, a rim ellipse and a top highlight arc.
// Outlines are taken once per visual slot from the shape spec and kept (volumeShapeOf); the per
// frame helpers write into caller scratch and allocate nothing.
import { TILT_DEG, type Camera } from './project';
import type { PaletteKey } from './neon';
import type { ShapePrim, ShapeSpec } from './shapeSpecs';

/** Depth as a share of the drawn radius at the high tilt. */
export const VOLUME_DEPTH = 0.25;
/** Side faces and edges: the 40 percent alpha of the brief, and the lower (base) share of it. */
export const SIDE_ALPHA = 0.4;
export const BASE_ALPHA = 0.22;
/** Side face fills (upper and lower band): lower again so the slab reads as glass, not paint. */
export const FACE_TOP_ALPHA = 0.16;
export const FACE_BASE_ALPHA = 0.07;
/** Highlight: mix toward white and its alpha. */
export const HI_MIX = 0.55;
export const HI_ALPHA = 0.6;
/** No volume colour is darker than this HSL lightness. */
export const MIN_LIGHTNESS = 0.3;
/** Outline points kept per shape (longer outlines are resampled). */
export const OUTLINE_MAX = 24;
/** Rim ellipse height as a share of the radius (round shapes). */
export const RIM_SQUASH = 0.3;
/** Most volumes drawn in one frame (a boss fight sits well under it). */
export const VOLUME_MAX = 120;
/** Circle sampling for round shapes. */
export const ROUND_STEPS = 16;

const SIN_HIGH = Math.sin((TILT_DEG.high * Math.PI) / 180);

/** Pure: 0 at off, sin T / sin(high tilt) on (1 at high, about 0.54 at low), capped at 1.5. */
export function tiltDepthK(cam: Camera): number {
  if (!cam.on) return 0;
  const k = cam.sin / SIN_HIGH;
  return k > 1.5 ? 1.5 : k < 0 ? 0 : k;
}

/** Pure: extrusion depth (arena units) for a drawn radius under cam. 0 at off. */
export function extrudeDepth(radius: number, cam: Camera): number {
  if (!(radius > 0)) return 0;
  return VOLUME_DEPTH * radius * tiltDepthK(cam);
}

/** Pure: the extrusion offset for a drawn radius: straight down the screen (x 0, y depth). */
export function extrudeOffset(radius: number, cam: Camera, out: { x: number; y: number }): { x: number; y: number } {
  out.x = 0;
  out.y = extrudeDepth(radius, cam);
  return out;
}

export interface VolumeShape {
  /** Outline points in shape units (closed), x y pairs. */
  readonly pts: Float32Array;
  readonly n: number;
  /** Round: tangent edges, a rim ellipse and a highlight arc instead of vertex edges. */
  readonly round: boolean;
  /** Outline extent from the origin. */
  readonly r: number;
  /** Baked colour of the outline's layer (null: white, coloured by the view tint). */
  readonly colour: PaletteKey | null;
  /** Core stroke width of the outline's layer. */
  readonly width: number;
}

function primPoints(p: ShapePrim): number[] {
  switch (p.t) {
    case 'poly':
    case 'line':
      return [...p.pts];
    case 'rect':
      return [-p.w / 2, -p.h / 2, p.w / 2, -p.h / 2, p.w / 2, p.h / 2, -p.w / 2, p.h / 2];
    case 'circle': {
      const out: number[] = [];
      for (let i = 0; i < ROUND_STEPS; i++) {
        const a = (i / ROUND_STEPS) * Math.PI * 2;
        out.push(Math.cos(a) * p.r, Math.sin(a) * p.r);
      }
      return out;
    }
    case 'regularPoly': {
      // Same vertex placement as pixi's regularPoly: first vertex straight up, then rotated.
      const out: number[] = [];
      const sides = Math.max(3, p.sides | 0);
      const start = -Math.PI / 2 + p.rot;
      for (let i = 0; i < sides; i++) {
        const a = start - (i * Math.PI * 2) / sides;
        out.push(Math.cos(a) * p.r, Math.sin(a) * p.r);
      }
      return out;
    }
  }
}

function extent(pts: readonly number[]): number {
  let m = 0;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const d = Math.hypot(pts[i] ?? 0, pts[i + 1] ?? 0);
    if (d > m) m = d;
  }
  return m;
}

/** Pure: convex hull (monotone chain) of x y pairs, as x y pairs. */
export function hull(pts: readonly number[]): number[] {
  const p: [number, number][] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) p.push([pts[i] ?? 0, pts[i + 1] ?? 0]);
  p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p.flat();
  const cross = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2] as [number, number], lower[lower.length - 1] as [number, number], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i] as [number, number];
    while (upper.length >= 2 && cross(upper[upper.length - 2] as [number, number], upper[upper.length - 1] as [number, number], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper).flat();
}

function resample(pts: readonly number[], max: number): number[] {
  const n = pts.length >> 1;
  if (n <= max) return [...pts];
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    const j = Math.floor((i * n) / max);
    out.push(pts[j * 2] ?? 0, pts[j * 2 + 1] ?? 0);
  }
  return out;
}

function isRound(prim: ShapePrim, pts: readonly number[]): boolean {
  if (prim.t === 'circle') return true;
  const n = pts.length >> 1;
  if (n < 12) return false;
  let lo = Infinity;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(pts[i * 2] ?? 0, pts[i * 2 + 1] ?? 0);
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  return lo > 0 && hi / lo < 1.4;
}

/**
 * Pure: the volume outline of a shape: its largest closed outline (or, with core, its filled
 * core: the gravity well), or the convex hull of every point for line only shapes. Null when the
 * shape has no geometry. Called once per visual slot.
 */
export function volumeShapeOf(spec: ShapeSpec, core = false): VolumeShape | null {
  let best: { prim: ShapePrim; pts: number[]; r: number; colour: PaletteKey | null; width: number } | null = null;
  const all: number[] = [];
  for (const l of spec.layers) {
    if (l.width <= 0 && l.fill <= 0) continue;
    for (const prim of l.prims) {
      const pts = primPoints(prim);
      for (const v of pts) all.push(v);
      if (prim.t === 'line') continue;
      if (core && l.fill < 0.5) continue;
      const r = extent(pts);
      if (!best || r > best.r) best = { prim, pts, r, colour: l.colour, width: l.width > 0 ? l.width : 1.5 };
    }
  }
  if (!best) {
    const h = hull(all);
    if (h.length < 6) return null;
    const first = spec.layers.find((l) => l.width > 0);
    return { pts: Float32Array.from(resample(h, OUTLINE_MAX)), n: Math.min(OUTLINE_MAX, h.length >> 1), round: false, r: extent(h), colour: first?.colour ?? null, width: first?.width ?? 1.5 };
  }
  const round = isRound(best.prim, best.pts);
  const pts = round ? primPoints({ t: 'circle', r: best.r }) : resample(best.pts, OUTLINE_MAX);
  return { pts: Float32Array.from(pts), n: pts.length >> 1, round, r: best.r, colour: best.colour, width: best.width };
}

/**
 * Pure: place a shape: top outline into out[0 .. 2n), base outline (top plus depth down the screen)
 * into out[2n .. 4n). (cx, cy) is the projected centre, k the drawn scale, rot the rotation.
 * Returns n (0 when out is too small). Allocates nothing.
 */
export function placeVolume(shape: VolumeShape, cx: number, cy: number, k: number, rot: number, depth: number, out: Float32Array): number {
  const n = shape.n;
  if (out.length < n * 4) return 0;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const x = shape.pts[i * 2] ?? 0;
    const y = shape.pts[i * 2 + 1] ?? 0;
    const tx = cx + k * (x * c - y * s);
    const ty = cy + k * (x * s + y * c);
    out[i * 2] = tx;
    out[i * 2 + 1] = ty;
    out[(n + i) * 2] = tx;
    out[(n + i) * 2 + 1] = ty + depth;
  }
  return n;
}

/**
 * Pure: per edge i (point i to i + 1) of the placed top outline: 1 when its outward normal points
 * down the screen (a side face the viewer sees), 2 when it points up (the highlight edge), 0 when
 * it is edge on. Works for either winding. Allocates nothing.
 */
export function edgeFacing(top: Float32Array, n: number, out: Uint8Array): void {
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += (top[i * 2] ?? 0) * (top[j * 2 + 1] ?? 0) - (top[j * 2] ?? 0) * (top[i * 2 + 1] ?? 0);
  }
  const sign = area >= 0 ? 1 : -1;
  for (let i = 0; i < n && i < out.length; i++) {
    const j = (i + 1) % n;
    const dx = (top[j * 2] ?? 0) - (top[i * 2] ?? 0);
    const dy = (top[j * 2 + 1] ?? 0) - (top[i * 2 + 1] ?? 0);
    // Outward normal: (dy, -dx) for a positive area, flipped otherwise; its y is -dx x sign.
    const ny = -dx * sign;
    const len = Math.hypot(dx, dy);
    out[i] = len < 1e-9 ? 0 : ny > 0.05 * len ? 1 : ny < -0.05 * len ? 2 : 0;
  }
}

/** Pure: HSL lightness of a 0xRRGGBB colour, 0 to 1. */
export function lightness(rgb: number): number {
  const r = ((rgb >> 16) & 255) / 255;
  const g = ((rgb >> 8) & 255) / 255;
  const b = (rgb & 255) / 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

function mixWhite(rgb: number, t: number): number {
  const m = (v: number): number => Math.round(v + (255 - v) * t);
  return (m((rgb >> 16) & 255) << 16) | (m((rgb >> 8) & 255) << 8) | m(rgb & 255);
}

/** Pure: the colour lifted toward white just enough to reach MIN_LIGHTNESS (unchanged above it). */
export function liftLightness(rgb: number): number {
  const c = rgb & 0xffffff;
  const l = lightness(c);
  if (l >= MIN_LIGHTNESS) return c;
  // Mixing toward white by t moves the lightness to l + t (1 - l); a hair over for rounding.
  return mixWhite(c, Math.min(1, (MIN_LIGHTNESS - l) / (1 - l) + 0.01));
}

export interface VolumeColours {
  side: number;
  hi: number;
}

/** Pure: the side and highlight colours for a body colour. Both at or over MIN_LIGHTNESS. */
export function volumeColours(rgb: number, out: VolumeColours): VolumeColours {
  out.side = liftLightness(rgb);
  out.hi = liftLightness(mixWhite(rgb & 0xffffff, HI_MIX));
  return out;
}
