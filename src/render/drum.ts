// Pure drum view for cylinder levels (D13 phase C1). No pixi.js import, no PRNG, no allocation in
// the per frame functions.
// A cylinder level wraps u with period W (the arena width, centred on 0); v is bounded by the rims
// at plus or minus H/2. The renderer draws it as a vertical neon drum seen from the front:
// - the camera centre camU follows the ship's u the short way round (followCamU, time constant
//   DRUM_TAU), so the ship stays near the horizontal centre of the front face;
// - a point at u sits at angle phi = 2 pi (u minus camU) / W around the drum axis (vertical, along
//   v). With the screen radius rs = W / 2 the front face spans the arena width: screen x is
//   rs sin phi and the depth behind the front is rs (1 minus cos phi);
// - the depth feeds the tilt projection of project.ts as a negative lift, through a camera that is
//   always on (drumCamera), so the back is smaller by perspective even at tilt off, and the tilt
//   setting still leans the drum when it is on;
// - abs(phi) up to 90 degrees is the front half, drawn normally; the back half is seen through the
//   glass at BACK_ALPHA and mirrored (x runs the other way there, and shapes flip).
// Screen axes stay the arena axes (screen right is plus u at the front), so input never changes.
// A lift z (lattice kills) pushes a point radially out of the drum.
import { wrapCoord, wrapDelta } from '../core/surface';
import { fitArena, FIT_MARGIN, type Fit, type PlayRect } from './layout';
import { FOCAL_MUL, MAX_TILT_DEG, MIN_DEN_FRAC, type Affine, type Box, type Camera } from './project';

/** Camera follow time constant in seconds. */
export const DRUM_TAU = 0.12;
/** Alpha multiplier for the back half, seen through the glass. */
export const BACK_ALPHA = 0.25;
/** Lattice texture u that samples the front (opaque) and back (BACK_ALPHA) texel. */
export const FRONT_TEX_U = 0.25;
export const BACK_TEX_U = 0.75;
/**
 * Screen radius as a fraction of W / 2. At 1 the front face (half the circumference, W / 2 of u)
 * spans the arena width, so the front centre shows u at pi screen units per arena unit while v
 * stays at 1 (the brief's fill rule). Lower it if that reads too fast on the device.
 */
export const FACE_FILL = 1;
/** Samples per full turn for rims, rings and the fit. */
export const RING_STEPS = 96;

export interface Drum {
  readonly width: number;
  readonly height: number;
  /** Screen radius: FACE_FILL x W / 2, so the front face spans the arena width. */
  readonly rs: number;
  /** 2 pi / W: radians per arena unit of u. */
  readonly k: number;
  /** Projection camera, always on. */
  cam: Camera;
  /** Camera centre u, canonical in [-W/2, W/2). */
  camU: number;
}

/** A drum projected point: screen position, depth scale, alpha multiplier and mirror sign. */
export interface DrumPoint {
  x: number;
  y: number;
  s: number;
  /** 1 on the front half, BACK_ALPHA on the back. */
  a: number;
  /** 1 on the front half, -1 on the back (shapes mirror there). */
  m: number;
}

/** Pure: a camera like makeCamera but always on, so perspective applies at tilt 0 too. */
export function drumCamera(deg: number, arenaH: number): Camera {
  const t = Number.isFinite(deg) ? Math.min(MAX_TILT_DEG, Math.max(0, deg)) : 0;
  const h = Number.isFinite(arenaH) && arenaH > 0 ? arenaH : 1;
  const r = (t * Math.PI) / 180;
  return { on: true, deg: t, cos: Math.cos(r), sin: Math.sin(r), focal: FOCAL_MUL * h };
}

/** Pure: a drum for an arena of width W (the u period) and height H, at a tilt in degrees. */
export function makeDrum(width: number, height: number, tiltDeg: number): Drum {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  return { width: w, height: h, rs: (FACE_FILL * w) / 2, k: (2 * Math.PI) / w, cam: drumCamera(tiltDeg, h), camU: 0 };
}

/** Pure: the drum angle of u for a camera centre, in [-pi, pi). */
export function drumPhi(u: number, camU: number, width: number): number {
  return (wrapDelta(u - camU, width) * 2 * Math.PI) / width;
}

/**
 * Pure: one step of the camera follow. Moves camU toward target the short way (through the seam
 * when that is shorter) by 1 minus exp(-dt / DRUM_TAU) of the gap; result canonical.
 */
export function followCamU(camU: number, target: number, dt: number, width: number): number {
  if (!(dt > 0) || !Number.isFinite(target)) return camU;
  const k = 1 - Math.exp(-dt / DRUM_TAU);
  return wrapCoord(camU + wrapDelta(target - camU, width) * k, width);
}

/**
 * Pure: render interpolation on an axis of period L (0 for an unwrapped axis). Wrapped, prev may
 * sit across the seam: the step is the short way and the result may lie just outside the
 * canonical range, which the drum projection accepts. L 0 is exactly prev + (cur - prev) a.
 */
export function interpWrap(prev: number, cur: number, alpha: number, period: number): number {
  if (!(period > 0)) return prev + (cur - prev) * alpha;
  return prev + wrapDelta(cur - prev, period) * alpha;
}

/** Pure: the image of u nearest ref (ref plus the short offset). Keeps a polyline continuous. */
export function unwrapNear(ref: number, u: number, period: number): number {
  if (!(period > 0)) return u;
  return ref + wrapDelta(u - ref, period);
}

/** Project a drum angle phi, height v and radial lift z into out. No allocation. */
export function projectPhi(phi: number, v: number, z: number, d: Drum, out: DrumPoint): DrumPoint {
  const c = Math.cos(phi);
  const r = d.rs + z;
  const x = r * Math.sin(phi);
  // Lift toward the viewer is minus the depth behind the front face.
  const lift = r * c - d.rs;
  const cam = d.cam;
  const D = cam.focal;
  const den = D - v * cam.sin - lift * cam.cos;
  const lo = D * MIN_DEN_FRAC;
  const f = D / (den > lo ? den : lo);
  out.x = x * f;
  out.y = (v * cam.cos - lift * cam.sin) * f;
  out.s = f;
  const front = c >= -1e-12;
  out.a = front ? 1 : BACK_ALPHA;
  out.m = front ? 1 : -1;
  return out;
}

/** Project arena (u, v) with radial lift z through the drum into out. No allocation. */
export function drumProject(u: number, v: number, z: number, d: Drum, out: DrumPoint): DrumPoint {
  return projectPhi(drumPhi(u, d.camU, d.width), v, z, d, out);
}

const pa: DrumPoint = { x: 0, y: 0, s: 1, a: 1, m: 1 };
const pb: DrumPoint = { x: 0, y: 0, s: 1, a: 1, m: 1 };
const pc: DrumPoint = { x: 0, y: 0, s: 1, a: 1, m: 1 };
/** Finite difference step for the linearisation, arena units. */
const JAC_H = 1;

/**
 * The drum projection linearised at (u, v), as a matrix for a Graphics drawn in arena units:
 * screen(q) is about P(p) + J (q - p). Exact at p. Returns the alpha multiplier at p (the back
 * half mirrors through J itself, since x runs the other way there). No allocation.
 */
export function drumAffineAt(u: number, v: number, d: Drum, out: Affine): number {
  drumProject(u, v, 0, d, pa);
  drumProject(u + JAC_H, v, 0, d, pb);
  drumProject(u, v + JAC_H, 0, d, pc);
  out.a = (pb.x - pa.x) / JAC_H;
  out.b = (pb.y - pa.y) / JAC_H;
  out.c = (pc.x - pa.x) / JAC_H;
  out.d = (pc.y - pa.y) / JAC_H;
  out.tx = pa.x - out.a * u - out.c * v;
  out.ty = pa.y - out.b * u - out.d * v;
  return pa.a;
}

/**
 * Project node positions in place for the drum: pos holds count (u, v) pairs, z holds count lifts
 * (or null). With uv given, each node's u texture coordinate selects the front or back texel, so
 * one line mesh draws the back half through the glass. No allocation.
 */
export function drumProjectNodes(pos: Float32Array, z: Float32Array | null, count: number, d: Drum, uv: Float32Array | null): void {
  const n = Math.min(count, pos.length >> 1);
  for (let i = 0; i < n; i++) {
    drumProject(pos[2 * i] ?? 0, pos[2 * i + 1] ?? 0, z ? (z[i] ?? 0) : 0, d, pa);
    pos[2 * i] = pa.x;
    pos[2 * i + 1] = pa.y;
    if (uv) {
      uv[2 * i] = pa.a === 1 ? FRONT_TEX_U : BACK_TEX_U;
      uv[2 * i + 1] = 0.5;
    }
  }
}

/**
 * Pure: a ring of the drum at height v (a rim at plus or minus H/2), split into its front arc
 * (abs(phi) up to 90 degrees) and back arc, flat [x, y, ...] screen lists. A ring does not depend
 * on camU, so these are built on tilt, arena or resize only. Allocates.
 */
export function ringArcs(d: Drum, v: number, steps: number = RING_STEPS): { front: number[]; back: number[] } {
  const half = Math.max(2, Math.round(steps / 2));
  const p: DrumPoint = { x: 0, y: 0, s: 1, a: 1, m: 1 };
  const front: number[] = [];
  const back: number[] = [];
  for (let i = 0; i <= half; i++) {
    const t = -Math.PI / 2 + (i / half) * Math.PI;
    projectPhi(t, v, 0, d, p);
    front.push(p.x, p.y);
    projectPhi(t + Math.PI, v, 0, d, p);
    back.push(p.x, p.y);
  }
  return { front, back };
}

/** Pure: the screen bounds of the whole drum (both rims, all the way round). */
export function drumBounds(d: Drum): Box {
  const p: DrumPoint = { x: 0, y: 0, s: 1, a: 1, m: 1 };
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const v of [-d.height / 2, d.height / 2]) {
    for (let i = 0; i < RING_STEPS; i++) {
      projectPhi((i / RING_STEPS) * 2 * Math.PI - Math.PI, v, 0, d, p);
      if (p.x < box.minX) box.minX = p.x;
      if (p.x > box.maxX) box.maxX = p.x;
      if (p.y < box.minY) box.minY = p.y;
      if (p.y > box.maxY) box.maxY = p.y;
    }
  }
  return box;
}

/** Pure: the letterbox fit for the drum, the whole drum visible and centred in the safe rect. */
export function fitDrum(d: Drum, rect: PlayRect, margin: number = FIT_MARGIN): Fit {
  const b = drumBounds(d);
  if (!(b.maxX > b.minX) || !(b.maxY > b.minY)) return fitArena(d.width, d.height, rect, margin);
  const w = Math.max(1, rect.w * (1 - 2 * margin));
  const h = Math.max(1, rect.h * (1 - 2 * margin));
  const scale = Math.min(w / (b.maxX - b.minX), h / (b.maxY - b.minY));
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { scale, x: rect.x + rect.w / 2 - cx * scale, y: rect.y + rect.h / 2 - cy * scale };
}

/**
 * Pure: the low tier drum grid for the current camU, flat segment list [x0, y0, x1, y1, ...] split
 * into front and back. u lines every spacing units (straight on screen: a line along the axis
 * stays a line under perspective); v rings come from ringArcs and are static. Allocates (low tier
 * only, see the hand off).
 */
export function drumULines(d: Drum, spacing: number, front: number[], back: number[]): void {
  front.length = 0;
  back.length = 0;
  const s = spacing > 0 ? spacing : d.width;
  const n = Math.max(1, Math.round(d.width / s));
  const step = d.width / n;
  const hh = d.height / 2;
  const p: DrumPoint = pa;
  for (let i = 0; i < n; i++) {
    const u = -d.width / 2 + i * step;
    drumProject(u, -hh, 0, d, p);
    const list = p.a === 1 ? front : back;
    list.push(p.x, p.y);
    drumProject(u, hh, 0, d, p);
    list.push(p.x, p.y);
  }
}

/**
 * Pure: an axis aligned rectangle in arena units (an obstacle) projected onto the drum as a flat
 * segment list [x0, y0, x1, y1, ...], each segment in front or back by its midpoint. Edges along u
 * are cut every W / RING_STEPS so they bend round the drum; edges along v stay one segment (a line
 * along the axis is a line on screen). The lists are cleared first and reused (no allocation once
 * they have grown).
 */
export function drumRectSegs(d: Drum, x0: number, y0: number, w: number, h: number, front: number[], back: number[]): void {
  front.length = 0;
  back.length = 0;
  drumRectSegsInto(d, x0, y0, w, h, front, back);
}

/** As drumRectSegs, appending to the lists instead of clearing them (every obstacle into one pair). */
export function drumRectSegsInto(d: Drum, x0: number, y0: number, w: number, h: number, front: number[], back: number[]): void {
  const n = Math.max(1, Math.ceil((w * RING_STEPS) / d.width));
  const x1 = x0 + w;
  const y1 = y0 + h;
  for (let i = 0; i < n; i++) {
    const ua = x0 + (w * i) / n;
    const ub = x0 + (w * (i + 1)) / n;
    seg(d, ua, y0, ub, y0, front, back);
    seg(d, ua, y1, ub, y1, front, back);
  }
  seg(d, x0, y0, x0, y1, front, back);
  seg(d, x1, y0, x1, y1, front, back);
}

function seg(d: Drum, ua: number, va: number, ub: number, vb: number, front: number[], back: number[]): void {
  drumProject((ua + ub) / 2, (va + vb) / 2, 0, d, pc);
  const list = pc.a === 1 ? front : back;
  drumProject(ua, va, 0, d, pa);
  drumProject(ub, vb, 0, d, pb);
  list.push(pa.x, pa.y, pb.x, pb.y);
}

/**
 * G10 perf: camera u bucket for caching what the drum draws of static geometry (obstacle outlines,
 * the low tier u lines). While camU stays inside one bucket the cached drawing is kept; the error
 * is at most one bucket of u, about pi x DRUM_CAM_BUCKET_U screen units at the front centre.
 */
export const DRUM_CAM_BUCKET_U = 0.25;

/** Pure: the bucket index of a camera u. */
export function drumCamBucket(camU: number, bucket: number = DRUM_CAM_BUCKET_U): number {
  return Math.round(camU / (bucket > 0 ? bucket : DRUM_CAM_BUCKET_U));
}
