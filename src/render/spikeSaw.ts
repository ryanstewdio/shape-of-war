// Look GW2: the orbit chainsaw. Each style 3 orbit spike is a sharp triangle centred on its sim
// position (x, y), pointing along its orbit tangent (vx, vy), whose length follows
// BulletPool.spikeLen (SPIKE_REST at rest, up to SPIKE_MAX while it saws). While stretched it gets a
// hot white edge and a motion smear of SPIKE_GHOSTS ghost copies rotated back round the ship against
// the spin, so it reads as a chainsaw tooth. Pure maths only; the renderer owns the Graphics.
// GW3: the saw is a bar that bends out toward the aim (Forge places the spikes and gives vx, vy as
// the track tangent). Each tooth lies along its tangent with length spikeLen; the ghost smear is no
// longer drawn (it read as a white backdrop behind the ship). While the saw level is above 0 a chain
// line runs through consecutive teeth of each ring, sorted by phase (sawChain).
// GW4: the near white chain line closed round the ship (the remaining white backdrop) is gone. The
// bar is a glowing outline in the weapon hue along the chain line, teeth are metallic triangles in
// the weapon hue with a white tip (toothTip), SPIKE_GHOSTS motion blur copies slide back along the
// track (sawTrackGhost), and saw hits throw 2 to 4 sparks at the tooth (sawSparkCount, nearTooth).
import { SAW_SPIKE_MAX, SPIKE_LEN } from '../game/weapons';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** Spike length at rest and fully stretched (weapons SPIKE_LEN and SPIKE_LEN x SPIKE_STRETCH). */
export const SPIKE_REST = SPIKE_LEN;
export const SPIKE_MAX = SAW_SPIKE_MAX; // GW3 glue: bar teeth top out at 40 u
/** Half width of the triangle base at rest; a stretched tooth narrows to SPIKE_THIN of that. */
export const SPIKE_HALF = 5;
export const SPIKE_THIN = 0.7;
/** GW4 motion blur: ghost copies along the track behind each tooth, the gap (u) between copies at full saw, and their alphas (x the saw level). */
export const SPIKE_GHOSTS = 2;
export const SPIKE_GHOST_GAP = 9;
export const SPIKE_GHOST_ALPHA: readonly number[] = [0.38, 0.17];
/** GW4 tooth tip: the front share of a tooth drawn white hot. */
export const SPIKE_TIP = 0.32;
/** GW4 bar outline: glow and line widths (u) in the weapon hue. */
export const SAW_BAR_GLOW_W = 7;
export const SAW_BAR_LINE_W = 1.8;
/** GW4 hit sparks at the bar: 2 to 4 per hit. */
export const SAW_SPARKS_MIN = 2;
export const SAW_SPARKS_MAX = 4;

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

export interface SpikePose {
  x: number;
  y: number;
}

/**
 * Pure: motion blur ghost k (1 based) of a tooth at (x, y) moving along the unit track direction
 * (vx, vy): the same tooth slid back along the track (not turned round the ship) by k x
 * SPIKE_GHOST_GAP x level. A zero direction slides along -x.
 */
export function sawTrackGhost(x: number, y: number, vx: number, vy: number, k: number, level: number, out: SpikePose): SpikePose {
  const m = Math.hypot(fin(vx, 0), fin(vy, 0));
  const tx = m > 1e-9 ? vx / m : 1;
  const ty = m > 1e-9 ? vy / m : 0;
  const d = Math.max(0, fin(k, 0)) * SPIKE_GHOST_GAP * Math.max(0, Math.min(1, fin(level, 0)));
  out.x = fin(x, 0) - tx * d;
  out.y = fin(y, 0) - ty * d;
  return out;
}

/**
 * Pure: the white hot tip of a tooth triangle tri (tip, base, base as from spikeTriangle), written
 * into out as a smaller triangle: the tip and the points SPIKE_TIP of the way down each side.
 */
export function toothTip(tri: Float32Array, out: Float32Array): Float32Array {
  const tx = tri[0] ?? 0;
  const ty = tri[1] ?? 0;
  out[0] = tx;
  out[1] = ty;
  out[2] = tx + ((tri[2] ?? 0) - tx) * SPIKE_TIP;
  out[3] = ty + ((tri[3] ?? 0) - ty) * SPIKE_TIP;
  out[4] = tx + ((tri[4] ?? 0) - tx) * SPIKE_TIP;
  out[5] = ty + ((tri[5] ?? 0) - ty) * SPIKE_TIP;
  return out;
}

/** Pure: sparks for saw hit number seq: 2 to 4, cycling. */
export function sawSparkCount(seq: number): number {
  const n = SAW_SPARKS_MAX - SAW_SPARKS_MIN + 1;
  return SAW_SPARKS_MIN + ((((seq | 0) % n) + n) % n);
}

/** A saw hit counts as on the bar within this many u of a tooth centre. */
export const SAW_SPARK_REACH = 34;

/**
 * Pure: true when a hit at (hx, hy) lands within reach u of any of the count teeth stored in xs, ys
 * from index from. Allocates nothing.
 */
export function nearTooth(hx: number, hy: number, xs: Float32Array, ys: Float32Array, from: number, count: number, reach: number): boolean {
  const r2 = reach * reach;
  const f = Math.max(0, from | 0);
  const m = Math.max(f, Math.min(f + (count | 0), xs.length, ys.length));
  for (let i = f; i < m; i++) {
    const dx = hx - (xs[i] ?? 0);
    const dy = hy - (ys[i] ?? 0);
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
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
