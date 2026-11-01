// GW3: nova snakes. A snake that crawled out of a gravity well (matched to its 'sim:wellSpawn'
// emergence by wellArrive.ts emergeTrack) is tracked for its whole life and drawn with a white core
// line down its body and a faint shimmer running along it, so it reads as different from a normal
// snake. Pure state and maths only (no pixi.js, no PRNG); the renderer owns the Graphics.
// GW4: the shimmer dots are replaced by NOVA_SNAKE_GLINTS gem glints (gemGlint.ts) travelling down
// the body, each popping in and out with its own prismatic hue and white hot centre.

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
/** GW4: gem glints travelling along the body at any time (3 to 5), and their peak arm length (u). */
export const NOVA_SNAKE_GLINTS = 4;
export const NOVA_SNAKE_GLINT_SIZE = 7;

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
