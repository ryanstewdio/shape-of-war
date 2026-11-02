// Drum attachment pen (G9 cylinder fixes). On a cylinder level the tilt scene pass used to map the
// shared well layer, the nova snake core and the chainsaw with one projection linearised at the
// centre of each Graphics' bounds. That transform stretches u by pi at the front (the drum face
// shows u at pi screen units per arena unit) and is anchored wherever the bounds happen to centre,
// so glints, motes and the snake core slid off their owners as the drum turned, and the saw grew
// about three times wider and drifted off the surface.
// The pen fixes that at draw time. Every point is written relative to an owner (a well, a snake
// segment, the ship): the owner goes through the drum mapping from its current wrapped position
// (drumProject, which takes the short delta from the camera u), and the offset from the owner is
// scaled by the owner's depth scale and mirrored on the back half, exactly as the entity views
// (billboards) are. So a layer attached to an owner draws where the owner draws, at the size the
// owner draws, every frame. With no drum (flat or tilted levels) the pen is the identity and the
// Graphics keep going through the tilt scene pass as before.
// No pixi.js import: it draws into anything with the Graphics path methods it uses. No PRNG. No
// allocation per call: style objects are scratch, reused.
import { wrapDelta } from '../core/surface';
import { BACK_ALPHA, drumProject, type Drum, type DrumPoint } from './drum';

export type PenCap = 'round' | 'butt' | 'square';
export type PenJoin = 'round' | 'miter' | 'bevel';

export interface PenFill {
  color: number;
  alpha: number;
}

export interface PenStroke {
  width: number;
  color: number;
  alpha: number;
  cap?: PenCap;
  join?: PenJoin;
}

/** The Graphics path methods the pen draws with (pixi's Graphics satisfies it). */
export interface PathSink {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  circle(x: number, y: number, r: number): unknown;
  closePath(): unknown;
  fill(style: PenFill): unknown;
  stroke(style: PenStroke): unknown;
}

export interface DrumPen {
  /** The drum this frame, or null for the identity (flat and tilted levels). */
  drum: Drum | null;
  /** The sink this pen writes into. */
  sink: PathSink | null;
  /** Owner in arena units, and its drum image: screen position, depth scale, alpha and mirror. */
  readonly own: DrumPoint;
  ownU: number;
  ownV: number;
  /** Largest alpha multiplier of the owners in the current path (front wins), reset on fill or stroke. */
  pathA: number;
  /** Depth scale of the first owner in the current path (stroke widths follow it). */
  pathS: number;
  readonly fillStyle: PenFill;
  readonly strokeStyle: PenStroke;
}

export function createDrumPen(): DrumPen {
  return {
    drum: null,
    sink: null,
    own: { x: 0, y: 0, s: 1, a: 1, m: 1 },
    ownU: 0,
    ownV: 0,
    pathA: -1,
    pathS: -1,
    fillStyle: { color: 0xffffff, alpha: 1 },
    strokeStyle: { width: 1, color: 0xffffff, alpha: 1, cap: 'butt', join: 'miter' },
  };
}

export interface PenTrace {
  /** Projected points, x and y interleaved. */
  pts: Float64Array;
  /** 1 when the point is on the front half. */
  front: Uint8Array;
  n: number;
  /** Depth scale of the first front point and of the first back point (-1 when there is none). */
  sFront: number;
  sBack: number;
}

export function createPenTrace(cap: number = 64): PenTrace {
  const c = Math.max(4, cap | 0);
  return { pts: new Float64Array(c * 2), front: new Uint8Array(c), n: 0, sFront: -1, sBack: -1 };
}

function traceGrow(t: PenTrace): void {
  const pts = new Float64Array(t.pts.length * 2);
  pts.set(t.pts);
  const front = new Uint8Array(t.front.length * 2);
  front.set(t.front);
  t.pts = pts;
  t.front = front;
}

/** Point the pen at a sink for this frame's drum (null for flat). Clears the path bookkeeping. */
export function penBegin(p: DrumPen, sink: PathSink, drum: Drum | null): DrumPen {
  p.sink = sink;
  p.drum = drum;
  p.pathA = -1;
  p.pathS = -1;
  return p;
}

/**
 * Set the owner at arena (u, v): through the drum mapping when there is a drum (from the owner's
 * current position, the short way from the camera u), the identity otherwise. No allocation.
 */
export function penOwner(p: DrumPen, u: number, v: number): DrumPen {
  p.ownU = u;
  p.ownV = v;
  const o = p.own;
  if (p.drum) drumProject(u, v, 0, p.drum, o);
  else {
    o.x = u;
    o.y = v;
    o.s = 1;
    o.a = 1;
    o.m = 1;
  }
  if (o.a > p.pathA) p.pathA = o.a;
  if (p.pathS < 0) p.pathS = o.s;
  return p;
}

/**
 * Pure: screen x of arena x attached to the current owner (offset scaled by depth, mirrored on the
 * back). On the drum the offset is the short wrapped delta, so a point across the seam from its
 * owner still sits next to it.
 */
export function penX(p: DrumPen, x: number): number {
  const dx = p.drum ? wrapDelta(x - p.ownU, p.drum.width) : x - p.ownU;
  return p.own.x + dx * p.own.s * p.own.m;
}

/** Pure: screen y of arena y attached to the current owner. */
export function penY(p: DrumPen, y: number): number {
  return p.own.y + (y - p.ownV) * p.own.s;
}

export function penMoveTo(p: DrumPen, x: number, y: number): void {
  p.sink?.moveTo(penX(p, x), penY(p, y));
}

export function penLineTo(p: DrumPen, x: number, y: number): void {
  p.sink?.lineTo(penX(p, x), penY(p, y));
}

/** A circle round (x, y) attached to the owner: centre attached, radius scaled by the owner's depth. */
export function penCircle(p: DrumPen, x: number, y: number, r: number): void {
  p.sink?.circle(penX(p, x), penY(p, y), r * p.own.s);
}

/** A polyline point that is its own owner (a snake segment, a trail point): each one through the drum. */
export function penOwnerMoveTo(p: DrumPen, u: number, v: number): void {
  penOwner(p, u, v);
  p.sink?.moveTo(p.own.x, p.own.y);
}

export function penOwnerLineTo(p: DrumPen, u: number, v: number): void {
  penOwner(p, u, v);
  p.sink?.lineTo(p.own.x, p.own.y);
}

export function penClose(p: DrumPen): void {
  p.sink?.closePath();
}

function pathAlpha(p: DrumPen): number {
  return p.pathA >= 0 ? p.pathA : p.own.a;
}

function pathScale(p: DrumPen): number {
  return p.pathS >= 0 ? p.pathS : p.own.s;
}

/** Fill the current path; the alpha takes the back half dimming of its owners. */
export function penFill(p: DrumPen, color: number, alpha: number): void {
  const f = p.fillStyle;
  f.color = color;
  f.alpha = alpha * pathAlpha(p);
  p.sink?.fill(f);
  p.pathA = -1;
  p.pathS = -1;
}

/** Stroke the current path; the width follows the depth scale of its first owner, the alpha the dimming. */
export function penStroke(p: DrumPen, width: number, color: number, alpha: number, cap: PenCap = 'butt', join: PenJoin = 'miter'): void {
  const s = p.strokeStyle;
  s.width = width * pathScale(p);
  s.color = color;
  s.alpha = alpha * pathAlpha(p);
  s.cap = cap;
  s.join = join;
  p.sink?.stroke(s);
  p.pathA = -1;
  p.pathS = -1;
}

// G10 drum lines. A free form line on the drum (a Charger lane, a shock ring, a wall flash) is a
// line on the surface, not a shape attached to one owner: the drum stretches u by up to pi at the
// front and bends it round the back, so one linearised transform per Graphics sent the lanes off
// the drum as it turned. A trace samples the line every DRUM_SAMPLE_U along its length, puts each
// sample through drumProject (each sample is its own owner) and remembers which half it is on.
// It is then stroked as front runs at the given alpha and back runs at BACK_ALPHA of it, the back
// runs skipped when they would show below BACK_CULL_A. With no drum a trace holds the two end
// points exactly, so flat and tilted levels draw what they drew before.
// No allocation once a trace has grown to the longest line it is asked to hold.

/** Sample spacing along a surface line on the drum, arena units. */
export const DRUM_SAMPLE_U = 24;
/** Back half runs whose final alpha would fall below this are not drawn at all. */
export const BACK_CULL_A = 0.05;
/** Sample count bounds for a sampled ring on the drum. */
export const RING_MIN_STEPS = 16;
export const RING_MAX_STEPS = 96;

/** Pure: true when a back half run stroked at alpha would show below BACK_CULL_A. */
export function backCulled(alpha: number): boolean {
  return alpha * BACK_ALPHA < BACK_CULL_A;
}


export function traceReset(t: PenTrace): PenTrace {
  t.n = 0;
  t.sFront = -1;
  t.sBack = -1;
  return t;
}

/** Append arena (u, v): through the drum when the pen has one (its own owner), as is otherwise. */
export function tracePoint(p: DrumPen, t: PenTrace, u: number, v: number): void {
  if (t.n >= t.front.length) traceGrow(t);
  const i = t.n;
  let x = u;
  let y = v;
  let s = 1;
  let f = 1;
  if (p.drum) {
    const o = drumProject(u, v, 0, p.drum, p.own);
    x = o.x;
    y = o.y;
    s = o.s;
    f = o.a === 1 ? 1 : 0;
  }
  t.pts[2 * i] = x;
  t.pts[2 * i + 1] = y;
  t.front[i] = f;
  if (f === 1) {
    if (t.sFront < 0) t.sFront = s;
  } else if (t.sBack < 0) t.sBack = s;
  t.n = i + 1;
}

/**
 * Append a ray on the surface: from (x, y) along the unit heading (dx, dy), distances d0 to d1.
 * On the drum it is sampled every step from d0 (and at d1), so it bends round the drum; flat it
 * is its two end points.
 */
export function traceRay(p: DrumPen, t: PenTrace, x: number, y: number, dx: number, dy: number, d0: number, d1: number, step: number = DRUM_SAMPLE_U): void {
  tracePoint(p, t, x + dx * d0, y + dy * d0);
  if (p.drum && step > 0) {
    const dir = d1 >= d0 ? 1 : -1;
    for (let d = d0 + dir * step; (d1 - d) * dir > 1e-9; d += dir * step) tracePoint(p, t, x + dx * d, y + dy * d);
  }
  tracePoint(p, t, x + dx * d1, y + dy * d1);
}

/**
 * Append a surface segment from (x0, y0) to (x1, y1). On the drum the offset is the short wrapped
 * delta (surface.delta on a cylinder), so a segment drawn across the seam stays short.
 */
export function traceLine(p: DrumPen, t: PenTrace, x0: number, y0: number, x1: number, y1: number, step: number = DRUM_SAMPLE_U): void {
  const dx = p.drum ? wrapDelta(x1 - x0, p.drum.width) : x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) {
    tracePoint(p, t, x0, y0);
    tracePoint(p, t, x0, y0);
    return;
  }
  traceRay(p, t, x0, y0, dx / len, dy / len, 0, len, step);
}

/**
 * Pure: samples for a closed ring of radius r on the drum at the given spacing, a multiple of 4 so
 * the ring has a sample at every quarter turn and is symmetric about its owner.
 */
export function ringSteps(r: number, step: number = DRUM_SAMPLE_U): number {
  const n = Math.ceil((2 * Math.PI * Math.max(0, r)) / (step > 0 ? step : DRUM_SAMPLE_U));
  return Math.min(RING_MAX_STEPS, Math.max(RING_MIN_STEPS, Math.ceil(n / 4) * 4));
}

/** Append a closed ring on the surface round (cx, cy), sampled about every step (closed: n + 1 points). */
export function traceRing(p: DrumPen, t: PenTrace, cx: number, cy: number, r: number, step: number = DRUM_SAMPLE_U): void {
  const n = ringSteps(r, step);
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * 2 * Math.PI;
    tracePoint(p, t, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
}

/** Append an arc on the surface round (cx, cy) from a0 to a1, sampled about every step. */
export function traceArc(p: DrumPen, t: PenTrace, cx: number, cy: number, r: number, a0: number, a1: number, step: number = DRUM_SAMPLE_U): void {
  const n = Math.max(2, Math.min(RING_MAX_STEPS, Math.ceil((Math.abs(a1 - a0) * Math.max(0, r)) / (step > 0 ? step : DRUM_SAMPLE_U))));
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    tracePoint(p, t, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
}

/**
 * Write the runs of one half (front 1, back 0) as subpaths. A segment belongs to a half when
 * either end is on it, so the two halves meet at the rim. Returns true when anything was written.
 */
function emitRuns(sink: PathSink, t: PenTrace, half: number): boolean {
  let any = false;
  let open = false;
  for (let i = 1; i < t.n; i++) {
    if (t.front[i - 1] !== half && t.front[i] !== half) {
      open = false;
      continue;
    }
    if (!open) {
      sink.moveTo(t.pts[2 * i - 2] ?? 0, t.pts[2 * i - 1] ?? 0);
      open = true;
    }
    sink.lineTo(t.pts[2 * i] ?? 0, t.pts[2 * i + 1] ?? 0);
    any = true;
  }
  return any;
}

/**
 * Stroke a trace: front runs at alpha, back runs at BACK_ALPHA of it (skipped below BACK_CULL_A),
 * each with the width scaled by the depth of its first point. Flat: one stroke, exactly as before.
 */
export function penStrokeTrace(p: DrumPen, t: PenTrace, width: number, color: number, alpha: number, cap: PenCap = 'butt', join: PenJoin = 'miter'): void {
  const sink = p.sink;
  if (!sink || t.n < 2) return;
  const s = p.strokeStyle;
  s.color = color;
  s.cap = cap;
  s.join = join;
  if (t.sFront >= 0 && emitRuns(sink, t, 1)) {
    s.width = width * t.sFront;
    s.alpha = alpha;
    sink.stroke(s);
  }
  if (t.sBack >= 0 && !backCulled(alpha) && emitRuns(sink, t, 0)) {
    s.width = width * t.sBack;
    s.alpha = alpha * BACK_ALPHA;
    sink.stroke(s);
  }
  p.pathA = -1;
  p.pathS = -1;
}

/** Fill a trace as one closed polygon, dimmed to the back alpha only when no point is on the front. */
export function penFillTrace(p: DrumPen, t: PenTrace, color: number, alpha: number): void {
  const sink = p.sink;
  if (!sink || t.n < 3) return;
  const a = t.sFront >= 0 ? alpha : alpha * BACK_ALPHA;
  if (t.sFront < 0 && a < BACK_CULL_A) return;
  sink.moveTo(t.pts[0] ?? 0, t.pts[1] ?? 0);
  for (let i = 1; i < t.n; i++) sink.lineTo(t.pts[2 * i] ?? 0, t.pts[2 * i + 1] ?? 0);
  sink.closePath();
  const f = p.fillStyle;
  f.color = color;
  f.alpha = a;
  sink.fill(f);
  p.pathA = -1;
  p.pathS = -1;
}

/** A 2D affine (same fields as project.ts Affine) for a layer drawn round one owner. */
export interface PenAffine {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

/**
 * The current owner's billboard transform as a matrix: arena (x, y) maps to the owner's screen
 * point plus the offset scaled by its depth and mirrored on the back, exactly penX and penY without
 * the seam wrap. For a layer whose every point sits round one owner (the boss identity layers), so
 * the whole Graphics follows that owner with no per point work. Returns the owner's alpha.
 */
export function penOwnerMatrix(p: DrumPen, out: PenAffine): number {
  const o = p.own;
  const sx = o.s * o.m;
  out.a = sx;
  out.b = 0;
  out.c = 0;
  out.d = o.s;
  out.tx = o.x - p.ownU * sx;
  out.ty = o.y - p.ownV * o.s;
  return o.a;
}
