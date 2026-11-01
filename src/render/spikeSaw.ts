// Look GW2: the orbit chainsaw. Each style 3 orbit spike is a sharp triangle centred on its sim
// position (x, y), pointing along its orbit tangent (vx, vy), whose length follows
// BulletPool.spikeLen (SPIKE_REST at rest, up to SPIKE_MAX while it saws). While stretched it gets a
// hot white edge and a motion smear of SPIKE_GHOSTS ghost copies rotated back round the ship against
// the spin, so it reads as a chainsaw tooth. Pure maths only; the renderer owns the Graphics.

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** Spike length at rest and fully stretched (weapons SPIKE_LEN and SPIKE_LEN x SPIKE_STRETCH). */
export const SPIKE_REST = 24;
export const SPIKE_MAX = 60;
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
