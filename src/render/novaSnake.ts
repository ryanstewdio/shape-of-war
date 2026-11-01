// GW3: nova snakes. A snake that crawled out of a gravity well (matched to its 'sim:wellSpawn'
// emergence by wellArrive.ts emergeTrack) is tracked for its whole life and drawn with a white core
// line down its body and a faint shimmer running along it, so it reads as different from a normal
// snake. Pure state and maths only (no pixi.js, no PRNG); the renderer owns the Graphics.
// GW4: the shimmer dots are replaced by NOVA_SNAKE_GLINTS gem glints (gemGlint.ts) travelling down
// the body, each popping in and out with its own prismatic hue and white hot centre.
// GW5: the glints become a ribbon: NOVA_SNAKE_GLINTS glints orbit the head and body in a loose helix
// (novaRibbonAt) and drift back along the path, and while the snake is within NOVA_STREAM_RANGE of its
// well NOVA_STREAM_GLINTS glints flow from the whirlpool to the head on a clockwise bent path
// (novaStreamAt), so the snake reads as carrying the whirlpool's sparkle.
import { hash01 } from './color';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** Nova snake heads tracked at once (the sim caps live snakes well under this). */
export const NOVA_SNAKE_TRACK = 16;
/** Shimmer dots running along the body, their speed (body lengths per second) and the glow beat (Hz). */
export const NOVA_SNAKE_DOTS = 3;
export const NOVA_SNAKE_SHIMMER_HZ = 0.9;
export const NOVA_SNAKE_GLOW_HZ = 1.7;
/** White core line width and alpha, and the faint shimmer band width. */
export const NOVA_SNAKE_CORE_W = 2;
export const NOVA_SNAKE_CORE_A = 0.85;
export const NOVA_SNAKE_GLOW_W = 7;
/** GW5: ribbon glints orbiting each nova snake (6 to 10), and their peak arm length (u). */
export const NOVA_SNAKE_GLINTS = 8;
export const NOVA_SNAKE_GLINT_SIZE = 7;
/** GW5 helix: radius at the head (u), its taper to the tail (share), orbit turns per second, helix turns along the body. */
export const NOVA_SNAKE_ORBIT_R = 14;
export const NOVA_SNAKE_ORBIT_TAPER = 0.45;
export const NOVA_SNAKE_ORBIT_HZ = 1.1;
export const NOVA_SNAKE_HELIX_TURNS = 2.5;
/** GW5 helix: the in line squash of the orbit (the loose helix seen from above) and the ribbon drift (body lengths per second). */
export const NOVA_SNAKE_ORBIT_SQUASH = 0.35;
export const NOVA_SNAKE_RIBBON_HZ = 0.35;
/** GW5 helix: the largest distance (u) a ribbon glint sits from the body line. */
export const NOVA_SNAKE_ORBIT_MAX = NOVA_SNAKE_ORBIT_R * 1.15 * Math.hypot(1, NOVA_SNAKE_ORBIT_SQUASH);
/** GW5 stream: glints flowing from the whirlpool to the snake, the range (u), trips per second, bend and wobble. */
export const NOVA_STREAM_GLINTS = 6;
export const NOVA_STREAM_RANGE = 250;
export const NOVA_STREAM_HZ = 0.9;
export const NOVA_STREAM_BEND = 0.28;
export const NOVA_STREAM_WOBBLE = 8;
export const NOVA_STREAM_GLINT_SIZE = 6;
/** GW5: glints one nova snake draws at most (ribbon plus stream). */
export const NOVA_SNAKE_GLINTS_MAX = NOVA_SNAKE_GLINTS + NOVA_STREAM_GLINTS;

/** Pure: glints a nova snake draws this frame: the ribbon, plus the stream while near its well. */
export function novaSnakeGlintCount(nearWell: boolean): number {
  return NOVA_SNAKE_GLINTS + (nearWell ? NOVA_STREAM_GLINTS : 0);
}

/**
 * Pure: share along the body (0 head, 1 tail) of glint k at timeSec for head hash h: the glints are
 * spread evenly down the body and travel tailward at NOVA_SNAKE_SHIMMER_HZ body lengths per second.
 */
export function novaSnakeGlintShare(timeSec: number, h: number, k: number): number {
  const p = fin(timeSec, 0) * NOVA_SNAKE_SHIMMER_HZ + (k | 0) / NOVA_SNAKE_GLINTS + fin(h, 0);
  return p - Math.floor(p);
}

export interface NovaSnakeState {
  /** Entity index of each tracked head, -1 for a free slot. */
  readonly head: Int32Array;
  /** The head's seconds alive (w.t) when last seen: a smaller value means the index was reused. */
  readonly t: Float64Array;
}

export function createNovaSnakeState(): NovaSnakeState {
  return { head: new Int32Array(NOVA_SNAKE_TRACK).fill(-1), t: new Float64Array(NOVA_SNAKE_TRACK) };
}

export function resetNovaSnakeState(s: NovaSnakeState): void {
  s.head.fill(-1);
  s.t.fill(0);
}

/** Track head entity i (seconds alive t) as a nova snake. Returns its slot, or -1 when full. */
export function novaSnakeMark(s: NovaSnakeState, i: number, t: number): number {
  if (!Number.isInteger(i) || i < 0) return -1;
  let free = -1;
  for (let k = 0; k < NOVA_SNAKE_TRACK; k++) {
    if (s.head[k] === i) {
      s.t[k] = fin(t, 0);
      return k;
    }
    if (free < 0 && s.head[k] === -1) free = k;
  }
  if (free < 0) return -1;
  s.head[free] = i;
  s.t[free] = fin(t, 0);
  return free;
}

/** Pure: true when head entity i is a tracked nova snake. */
export function novaSnakeHas(s: NovaSnakeState, i: number): boolean {
  for (let k = 0; k < NOVA_SNAKE_TRACK; k++) if (s.head[k] === i) return true;
  return false;
}

/** Pure: tracked heads. */
export function novaSnakeCount(s: NovaSnakeState): number {
  let n = 0;
  for (let k = 0; k < NOVA_SNAKE_TRACK; k++) if ((s.head[k] ?? -1) >= 0) n++;
  return n;
}

/**
 * Once per frame: drop every tracked head that died, changed kind, or whose seconds alive went
 * backwards (its index was reused by a new entity). alive, kind and t are the world arrays.
 */
export function novaSnakeSweep(s: NovaSnakeState, alive: Uint8Array, kind: ArrayLike<number>, t: ArrayLike<number>, headKind: number): void {
  for (let k = 0; k < NOVA_SNAKE_TRACK; k++) {
    const i = s.head[k] ?? -1;
    if (i < 0) continue;
    const now = t[i] ?? 0;
    if (alive[i] !== 1 || kind[i] !== headKind || now < (s.t[k] ?? 0) - 1e-6) {
      s.head[k] = -1;
      s.t[k] = 0;
      continue;
    }
    s.t[k] = now;
  }
}

/** Pure: share along the body (0 head, 1 tail) of shimmer dot d at timeSec for the head hash h. */
export function novaSnakeDot(timeSec: number, h: number, d: number): number {
  const p = fin(timeSec, 0) * NOVA_SNAKE_SHIMMER_HZ + d / NOVA_SNAKE_DOTS + fin(h, 0);
  return p - Math.floor(p);
}

/** Pure: shimmer dot alpha at body share p: fades in at the head and out at the tail, at most 0.7. */
export function novaSnakeDotAlpha(p: number): number {
  const c = Math.max(0, Math.min(1, fin(p, 0)));
  return 0.7 * Math.sin(Math.PI * c);
}

/** Pure: the faint shimmer band alpha along the body at timeSec for head hash h (0.08 to 0.2). */
export function novaSnakeGlow(timeSec: number, h: number): number {
  return 0.14 + 0.06 * Math.sin(fin(timeSec, 0) * NOVA_SNAKE_GLOW_HZ * Math.PI * 2 + fin(h, 0) * 6.283);
}

/**
 * Pure: the point at share p (0 first, 1 last) along a polyline of n points (x, y pairs in pts),
 * by point index, written into out. Allocates nothing.
 */
export function polyAt(pts: Float32Array, n: number, p: number, out: { x: number; y: number }): { x: number; y: number } {
  const m = Math.max(0, Math.min(n | 0, Math.floor(pts.length / 2)));
  if (m === 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const v = Math.max(0, Math.min(1, fin(p, 0))) * (m - 1);
  const i = Math.min(m - 2, Math.floor(v));
  if (i < 0) {
    out.x = pts[0] ?? 0;
    out.y = pts[1] ?? 0;
    return out;
  }
  const f = v - i;
  out.x = (pts[i * 2] ?? 0) * (1 - f) + (pts[i * 2 + 2] ?? 0) * f;
  out.y = (pts[i * 2 + 1] ?? 0) * (1 - f) + (pts[i * 2 + 3] ?? 0) * f;
  return out;
}

export interface RibbonPt {
  x: number;
  y: number;
  /** Share along the body (0 head, 1 tail). */
  p: number;
  /** Helix depth -1 (behind the body) to 1 (in front). */
  depth: number;
}

export function createRibbonPt(): RibbonPt {
  return { x: 0, y: 0, p: 0, depth: 0 };
}

const ribA = { x: 0, y: 0 };
const ribB = { x: 0, y: 0 };
const ribC = { x: 0, y: 0 };

/**
 * Pure: ribbon glint k of a nova snake with head hash h at timeSec, about the body polyline pts (n
 * points, head first), written into out. The glint drifts tailward along the body at
 * NOVA_SNAKE_RIBBON_HZ and wraps to the head, and orbits the body line in a loose helix: its side
 * offset is sin(phase) x radius across the body, a squashed cos(phase) along it, the phase turning
 * NOVA_SNAKE_ORBIT_HZ per second and NOVA_SNAKE_HELIX_TURNS along the body, the radius tapering to
 * the tail. Never further than NOVA_SNAKE_ORBIT_MAX from the line. Allocates nothing.
 */
export function novaRibbonAt(pts: Float32Array, n: number, timeSec: number, h: number, k: number, out: RibbonPt): RibbonPt {
  const t = fin(timeSec, 0);
  const hh = fin(h, 0);
  const kk = k | 0;
  const j = hash01((kk * 7703 + Math.floor(hh * 9973) + 29) | 0);
  const q = kk / NOVA_SNAKE_GLINTS + t * NOVA_SNAKE_RIBBON_HZ + hh;
  const p = q - Math.floor(q);
  polyAt(pts, n, p, ribC);
  polyAt(pts, n, Math.max(0, p - 0.05), ribA);
  polyAt(pts, n, Math.min(1, p + 0.05), ribB);
  // Tangent points head to tail; fall back to +x for a degenerate body.
  let tx = ribB.x - ribA.x;
  let ty = ribB.y - ribA.y;
  const tl = Math.hypot(tx, ty);
  if (tl > 1e-6) {
    tx /= tl;
    ty /= tl;
  } else {
    tx = 1;
    ty = 0;
  }
  const ph = Math.PI * 2 * (t * NOVA_SNAKE_ORBIT_HZ + hh + NOVA_SNAKE_HELIX_TURNS * p) + (j - 0.5) * 0.9;
  const R = NOVA_SNAKE_ORBIT_R * (1 - NOVA_SNAKE_ORBIT_TAPER * p) * (0.85 + 0.3 * j);
  const side = Math.sin(ph) * R;
  const along = Math.cos(ph) * R * NOVA_SNAKE_ORBIT_SQUASH;
  out.x = ribC.x - ty * side + tx * along;
  out.y = ribC.y + tx * side + ty * along;
  out.p = p;
  out.depth = Math.cos(ph);
  return out;
}

/** Pure: stream strength 0 to 1 for a head at distance d from its well: full inside 80 percent of the range, 0 at the range. */
export function novaStreamReach(d: number): number {
  const c = fin(d, Number.POSITIVE_INFINITY);
  const r0 = NOVA_STREAM_RANGE * 0.8;
  if (c <= r0) return 1;
  if (c >= NOVA_STREAM_RANGE) return 0;
  const v = (c - r0) / (NOVA_STREAM_RANGE - r0);
  return 1 - v * v * (3 - 2 * v);
}

/**
 * Pure: stream glint k flowing from the well (wx, wy) to the snake head (hx, hy) at timeSec for head
 * hash h, written into out. It travels the whole way NOVA_STREAM_HZ times a second on a quadratic
 * curve bent clockwise on screen (it leaves the whirlpool turning with it) by NOVA_STREAM_BEND of the
 * distance, with a small wobble. Returns its alpha: the reach times a fade in at the well and out at
 * the head; 0 beyond NOVA_STREAM_RANGE. Allocates nothing.
 */
export function novaStreamAt(wx: number, wy: number, hx: number, hy: number, timeSec: number, h: number, k: number, out: { x: number; y: number }): number {
  const ax = fin(wx, 0);
  const ay = fin(wy, 0);
  const bx = fin(hx, ax);
  const by = fin(hy, ay);
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  const t = fin(timeSec, 0);
  const hh = fin(h, 0);
  const q0 = t * NOVA_STREAM_HZ + (k | 0) / NOVA_STREAM_GLINTS + hh;
  const q = q0 - Math.floor(q0);
  // Clockwise perpendicular on a y down screen, unit length.
  const px = d > 1e-6 ? -dy / d : 0;
  const py = d > 1e-6 ? dx / d : 0;
  const bend = NOVA_STREAM_BEND * d;
  const cx = (ax + bx) / 2 + px * bend;
  const cy = (ay + by) / 2 + py * bend;
  const m = 1 - q;
  const wob = NOVA_STREAM_WOBBLE * Math.sin(Math.PI * q) * Math.sin(Math.PI * 2 * (2 * q + t * 1.3) + (k | 0) * 1.7);
  out.x = m * m * ax + 2 * m * q * cx + q * q * bx + px * wob;
  out.y = m * m * ay + 2 * m * q * cy + q * q * by + py * wob;
  return novaStreamReach(d) * Math.sin(Math.PI * q);
}
