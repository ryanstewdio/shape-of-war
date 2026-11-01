// Look GW2: the orbit chainsaw. Each style 3 orbit spike is a sharp triangle centred on its sim
// position (x, y), pointing along its orbit tangent (vx, vy), whose length follows
// BulletPool.spikeLen (SPIKE_REST at rest, up to SPIKE_MAX while it saws). While stretched it gets a
// hot white edge and a motion smear of SPIKE_GHOSTS ghost copies rotated back round the ship against
// the spin, so it reads as a chainsaw tooth. Pure maths only; the renderer owns the Graphics.
// GW3: the saw is a bar that bends out toward the aim (Forge places the spikes and gives vx, vy as
// the track tangent). Each tooth lies along its tangent with length spikeLen; the ghost smear is no
// longer drawn (it read as a white backdrop behind the ship). While the saw level is above 0 a faint
// bright chain line runs through consecutive teeth of each ring, sorted by phase (sawChain).
import { SPIKE_LEN, SPIKE_STRETCH } from '../game/weapons';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** Spike length at rest and fully stretched (weapons SPIKE_LEN and SPIKE_LEN x SPIKE_STRETCH). */
export const SPIKE_REST = SPIKE_LEN;
export const SPIKE_MAX = SPIKE_LEN * SPIKE_STRETCH;
/** Half width of the triangle base at rest; a stretched tooth narrows to SPIKE_THIN of that. */
export const SPIKE_HALF = 5;
export const SPIKE_THIN = 0.7;
/** Ghost copies behind the spin, and the angle (rad round the ship) between copies at full stretch. */
export const SPIKE_GHOSTS = 2;
export const SPIKE_GHOST_STEP = 0.14;
/** Ghost alphas (multiplied by the stretch share). */
export const SPIKE_GHOST_ALPHA: readonly number[] = [0.42, 0.2];

/** Pure: stretch share 0 (rest) to 1 (full saw) of a spike of length len. */
export function spikeStretch(len: number): number {
  return Math.max(0, Math.min(1, (fin(len, SPIKE_REST) - SPIKE_REST) / (SPIKE_MAX - SPIKE_REST)));
}

/** Pure: drawn length: spikeLen itself, or SPIKE_REST when the sim gave 0 or junk. */
export function spikeDrawLen(len: number): number {
  const l = fin(len, 0);
  return l > 0 ? l : SPIKE_REST;
}

/** Pure: half width of the base at a stretch share. */
export function spikeHalfWidth(stretch: number): number {
  return SPIKE_HALF * (1 - (1 - SPIKE_THIN) * Math.max(0, Math.min(1, fin(stretch, 0))));
}

/**
 * Pure: the triangle of a spike centred on (x, y) along the tangent (vx, vy), length len, base half
 * width half, written into out as tip x, y, then the two base corners. A zero tangent points +x.
 */
export function spikeTriangle(x: number, y: number, vx: number, vy: number, len: number, half: number, out: Float32Array): Float32Array {
  const m = Math.hypot(vx, vy);
  const tx = m > 1e-9 ? vx / m : 1;
  const ty = m > 1e-9 ? vy / m : 0;
  const h = len / 2;
  const bx = x - tx * h;
  const by = y - ty * h;
  out[0] = x + tx * h;
  out[1] = y + ty * h;
  out[2] = bx - ty * half;
  out[3] = by + tx * half;
  out[4] = bx + ty * half;
  out[5] = by - tx * half;
  return out;
}

/** Pure: spin sign of a spike at (x, y) moving (vx, vy) round the ship at (sx, sy): 1, -1 or 0. */
export function spikeSpin(sx: number, sy: number, x: number, y: number, vx: number, vy: number): number {
  const c = (x - sx) * vy - (y - sy) * vx;
  return c > 1e-9 ? 1 : c < -1e-9 ? -1 : 0;
}

export interface SpikePose {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Pure: ghost copy k (1 based) of a spike: its position and tangent rotated round the ship at
 * (sx, sy) back against the spin by k x SPIKE_GHOST_STEP x stretch.
 */
export function spikeGhost(sx: number, sy: number, x: number, y: number, vx: number, vy: number, k: number, stretch: number, out: SpikePose): SpikePose {
  const a = -spikeSpin(sx, sy, x, y, vx, vy) * k * SPIKE_GHOST_STEP * Math.max(0, Math.min(1, fin(stretch, 0)));
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - sx;
  const dy = y - sy;
  out.x = sx + dx * c - dy * s;
  out.y = sy + dx * s + dy * c;
  out.vx = vx * c - vy * s;
  out.vy = vx * s + vy * c;
  return out;
}

// Chain line (GW3)

/** Teeth per ring the chain scratch holds (the sim has at most 4 per ring, MAX_HITTERS 8 in all). */
export const SAW_CHAIN_MAX = 8;
/**
 * The chain stays open (no closing segment) when the widest phase gap between neighbouring teeth
 * exceeds this many even spacings: a bar bent toward the aim, not a full ring.
 */
export const SAW_CHAIN_OPEN = 1.5;

function wrap2pi(a: number): number {
  const t = Math.PI * 2;
  const v = fin(a, 0) % t;
  return v < 0 ? v + t : v;
}

/**
 * Pure: chain order of n teeth with phases ph (rad, any real), written into order as tooth indices
 * sorted by phase. When the teeth bunch up (widest gap past SAW_CHAIN_OPEN even spacings) the order
 * starts just after the widest gap and the chain is open. Returns the segments to draw: n for a
 * closed ring (the last joins the first), n - 1 for an open bar, 0 for fewer than two teeth.
 * Allocates nothing.
 */
export function sawChain(ph: Float32Array, n: number, order: Int32Array): number {
  const m = Math.max(0, Math.min(n | 0, ph.length, order.length));
  for (let i = 0; i < m; i++) order[i] = i;
  // Insertion sort by wrapped phase (m is tiny).
  for (let i = 1; i < m; i++) {
    const v = order[i] ?? 0;
    const pv = wrap2pi(ph[v] ?? 0);
    let j = i - 1;
    while (j >= 0 && wrap2pi(ph[order[j] ?? 0] ?? 0) > pv) {
      order[j + 1] = order[j] ?? 0;
      j--;
    }
    order[j + 1] = v;
  }
  if (m < 2) return 0;
  let widest = -1;
  let at = 0;
  for (let i = 0; i < m; i++) {
    const a = wrap2pi(ph[order[i] ?? 0] ?? 0);
    const b = i + 1 < m ? wrap2pi(ph[order[i + 1] ?? 0] ?? 0) : wrap2pi(ph[order[0] ?? 0] ?? 0) + Math.PI * 2;
    if (b - a > widest) {
      widest = b - a;
      at = i;
    }
  }
  if (widest <= (SAW_CHAIN_OPEN * Math.PI * 2) / m) return m;
  // Rotate so the chain starts just after the widest gap.
  const s = (at + 1) % m;
  for (let r = 0; r < s; r++) {
    const first = order[0] ?? 0;
    for (let i = 0; i < m - 1; i++) order[i] = order[i + 1] ?? 0;
    order[m - 1] = first;
  }
  return m - 1;
}

/** Pure: chain line alpha at saw level (0 hides it; faint, rising with the level). */
export function sawChainAlpha(level: number): number {
  const l = Math.max(0, Math.min(1, fin(level, 0)));
  return l > 0 ? 0.2 + 0.35 * l : 0;
}
