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
import { drumProject, type Drum, type DrumPoint } from './drum';

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
