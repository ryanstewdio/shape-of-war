// Pure tilt projection (docs/12 Wave V3-G, design items 3 and 5). No pixi.js import, no PRNG, no
// allocation in the per frame functions.
// The arena plane is tilted about its horizontal centre line by T degrees and seen through a
// perspective camera. Arena axes: origin at the centre, +x right, +y down (screen), z is the lift
// out of the floor toward the viewer (lattice kills raise it, wells pull it negative).
// Rotation about the x axis: yr = y cos T minus z sin T (a raised point moves up the screen), and
// the depth from the arena centre is d = minus (y sin T plus z cos T), so the far wall (top, y < 0)
// is deeper, smaller and higher than the near wall. The docs/12 formula writes the same rotation in
// y up axes; only the depth sign is flipped to keep the far wall at the top of the screen.
// Screen position is (x, yr) times f, f = D / (D + d), focal distance D = FOCAL_MUL x arena height.
// The denominator is floored at MIN_DEN_FRAC x D so no input gives a NaN or a flipped point.
// Tilt 0 is the identity on x and y for any z (the off path never projects at all).
import { fitArena, FIT_MARGIN, type Fit, type PlayRect } from './layout';
import type { TiltLevel } from './tilt';

/** Tilt per level in degrees (docs/12 design item 2: low 12, high 22). */
export const TILT_DEG: Readonly<Record<TiltLevel, number>> = { off: 0, low: 12, high: 22 };
/** Focal distance as a multiple of the arena height (docs/12 design item 3). */
export const FOCAL_MUL = 2.5;
/** Floor on D + d as a fraction of D: keeps f at or under 1 / MIN_DEN_FRAC. */
export const MIN_DEN_FRAC = 0.1;
/** Largest accepted tilt in degrees; inputs are clamped to [0, MAX_TILT_DEG]. */
export const MAX_TILT_DEG = 89;

export interface Camera {
  /** False at tilt 0: project is the identity and the renderer takes the off path. */
  readonly on: boolean;
  readonly deg: number;
  readonly cos: number;
  readonly sin: number;
  /** Focal distance D in arena units. */
  readonly focal: number;
}

/** Projected point: screen position in arena units and the depth scale f. */
export interface Projected {
  x: number;
  y: number;
  s: number;
}

/** The local linearisation of the projection at a point (a pixi Matrix shape). */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

/** Pure: a camera for a tilt in degrees over an arena of height arenaH. */
export function makeCamera(deg: number, arenaH: number): Camera {
  const t = Number.isFinite(deg) ? Math.min(MAX_TILT_DEG, Math.max(0, deg)) : 0;
  const h = Number.isFinite(arenaH) && arenaH > 0 ? arenaH : 1;
  if (t === 0) return { on: false, deg: 0, cos: 1, sin: 0, focal: FOCAL_MUL * h };
  const r = (t * Math.PI) / 180;
  return { on: true, deg: t, cos: Math.cos(r), sin: Math.sin(r), focal: FOCAL_MUL * h };
}

/** Pure: the camera for a tilt level. */
export function cameraFor(level: TiltLevel, arenaH: number): Camera {
  return makeCamera(TILT_DEG[level], arenaH);
}

/** Pure: the depth scale f at (y, z), the denominator floored. */
export function depthScale(y: number, z: number, cam: Camera): number {
  if (!cam.on) return 1;
  const den = cam.focal - y * cam.sin - z * cam.cos;
  const lo = cam.focal * MIN_DEN_FRAC;
  return cam.focal / (den > lo ? den : lo);
}

/** Project (x, y, z) into out. Writes only out; no allocation. */
export function project(x: number, y: number, z: number, cam: Camera, out: Projected): Projected {
  if (!cam.on) {
    out.x = x;
    out.y = y;
    out.s = 1;
    return out;
  }
  const f = depthScale(y, z, cam);
  out.x = x * f;
  out.y = (y * cam.cos - z * cam.sin) * f;
  out.s = f;
  return out;
}

/**
 * Project node positions in place: pos holds count (x, y) pairs, z holds count lifts (or null for
 * a flat field). The lattice calls this after writing positions; no allocation.
 */
export function projectNodes(pos: Float32Array, z: Float32Array | null, count: number, cam: Camera): void {
  if (!cam.on) return;
  const c = cam.cos;
  const s = cam.sin;
  const D = cam.focal;
  const lo = D * MIN_DEN_FRAC;
  const n = Math.min(count, pos.length >> 1);
  for (let i = 0; i < n; i++) {
    const x = pos[2 * i] ?? 0;
    const y = pos[2 * i + 1] ?? 0;
    const h = z ? (z[i] ?? 0) : 0;
    const den = D - y * s - h * c;
    const f = D / (den > lo ? den : lo);
    pos[2 * i] = x * f;
    pos[2 * i + 1] = (y * c - h * s) * f;
  }
}

/**
 * The projection of the floor (z = 0) linearised at (px, py), as a matrix for a Graphics drawn in
 * arena units: screen(q) is about P(p) + J (q - p). Exact at p, lines stay lines. Used only for
 * the free form effect layers whose geometry is rebuilt every frame.
 */
export function affineAt(px: number, py: number, cam: Camera, out: Affine): Affine {
  if (!cam.on) {
    out.a = 1;
    out.b = 0;
    out.c = 0;
    out.d = 1;
    out.tx = 0;
    out.ty = 0;
    return out;
  }
  const D = cam.focal;
  const den = D - py * cam.sin;
  const lo = D * MIN_DEN_FRAC;
  const clamped = !(den > lo);
  const f = D / (clamped ? lo : den);
  const fy = clamped ? 0 : (f * f * cam.sin) / D;
  out.a = f;
  out.b = 0;
  out.c = px * fy;
  out.d = cam.cos * (f + py * fy);
  out.tx = -px * py * fy;
  out.ty = -cam.cos * py * py * fy;
  return out;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Pure: the screen bounds of the projected arena rectangle. The projection maps the floor by a
 * homography, so the rectangle becomes a quad whose bounds are its four corners; circle and
 * hexagon arenas lie inside their box, so these bounds hold them too.
 */
export function projectedBounds(arenaW: number, arenaH: number, cam: Camera): Box {
  const hw = Math.max(1, arenaW) / 2;
  const hh = Math.max(1, arenaH) / 2;
  const p: Projected = { x: 0, y: 0, s: 1 };
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of [
    [-hw, -hh],
    [hw, -hh],
    [-hw, hh],
    [hw, hh],
  ] as const) {
    project(x, y, 0, cam, p);
    if (p.x < box.minX) box.minX = p.x;
    if (p.x > box.maxX) box.maxX = p.x;
    if (p.y < box.minY) box.minY = p.y;
    if (p.y > box.maxY) box.maxY = p.y;
  }
  return box;
}

/**
 * Pure: the letterbox fit from the projected arena bounds (docs/01 section 2.3: the whole arena is
 * visible). Off returns fitArena unchanged. On, the world container is offset so the projected
 * box is centred in the safe rect, since a tilted arena is not centred on its own origin.
 */
export function fitProjected(arenaW: number, arenaH: number, rect: PlayRect, cam: Camera, margin: number = FIT_MARGIN): Fit {
  if (!cam.on) return fitArena(arenaW, arenaH, rect, margin);
  const b = projectedBounds(arenaW, arenaH, cam);
  const w = Math.max(1, rect.w * (1 - 2 * margin));
  const h = Math.max(1, rect.h * (1 - 2 * margin));
  const scale = Math.min(w / Math.max(1, b.maxX - b.minX), h / Math.max(1, b.maxY - b.minY));
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { scale, x: rect.x + rect.w / 2 - cx * scale, y: rect.y + rect.h / 2 - cy * scale };
}

/**
 * Pure: the ?tilt=low|high URL knob (a dev and device check knob like ?bloomRes, read once at
 * renderer boot). Null when absent or not a level; Ledger's setting calls setTilt after it.
 */
export function parseTiltKnob(search: string): TiltLevel | null {
  const v = new URLSearchParams(search).get('tilt');
  return v === 'off' || v === 'low' || v === 'high' ? v : null;
}
