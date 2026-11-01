// GW4 crystal shimmer: gem glints. A glint is a small sharp 4 point star flare that pops in and
// out like light catching a facet: it lives GLINT_LIFE_MIN to GLINT_LIFE_MAX seconds, flares fast
// and decays, and its hue runs through the prismatic ring over its life while its centre stays white
// hot. Glints come in slots: slot k of a seed has a fixed life (hashed from the seed and k) and
// restarts the moment it ends, so a set of n slots always shows n glints, each at a fresh hashed
// spot every cycle. Everything is a pure function of the seed, the slot and the draw clock (hash01,
// never the PRNG). Shared by the nova whirlpools and the nova snakes; the renderer owns the Graphics.
import { hash01 } from './color';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** A glint's life range in seconds. */
export const GLINT_LIFE_MIN = 0.15;
export const GLINT_LIFE_MAX = 0.4;
/** Share of the life spent flaring up; the rest decays. */
export const GLINT_RISE = 0.22;
/** Inner (valley) radius of the star as a share of its arm length: small means sharp. */
export const GLINT_WAIST = 0.16;
/** Points in the star outline (4 arms, 4 valleys). */
export const GLINT_STAR_PTS = 8;
/** Share of the star arm drawn as the white hot centre star. */
export const GLINT_CORE = 0.42;

export interface Glint {
  /** Life phase 0 to 1. */
  p: number;
  /** Flare 0 to 1 (0 at birth and death). */
  flare: number;
  /** Prismatic hue share 0 to 1 (indexes the palette hue ring), sliding over the life. */
  hue: number;
  /** Two hashed shares for where this cycle's glint sits (the caller maps them to a spot). */
  a: number;
  b: number;
  /** Star rotation (rad). */
  rot: number;
  /** Cycle number of this slot (changes every pop). */
  cycle: number;
}

export function createGlint(): Glint {
  return { p: 0, flare: 0, hue: 0, a: 0, b: 0, rot: 0, cycle: 0 };
}

/** Pure: the fixed life (s) of slot k of seed, within GLINT_LIFE_MIN to GLINT_LIFE_MAX. */
export function glintLife(seed: number, k: number): number {
  return GLINT_LIFE_MIN + (GLINT_LIFE_MAX - GLINT_LIFE_MIN) * hash01(((seed | 0) * 7349 + (k | 0) * 211 + 5) | 0);
}

/** Pure: flare envelope at life phase p: a quick rise to 1, then a sharp decay to 0. */
export function glintFlare(p: number): number {
  const c = fin(p, 1);
  if (c <= 0 || c >= 1) return 0;
  const v = c < GLINT_RISE ? c / GLINT_RISE : (1 - c) / (1 - GLINT_RISE);
  return v * v * (3 - 2 * v);
}

/**
 * Pure: slot k of seed at timeSec, written into out. The slot restarts the moment its life ends, so
 * it is always alive; each cycle hashes a new spot (a, b), rotation and starting hue. Allocates nothing.
 */
export function glintAt(seed: number, k: number, timeSec: number, out: Glint): Glint {
  const life = glintLife(seed, k);
  const off = hash01(((seed | 0) * 4513 + (k | 0) * 97 + 11) | 0) * life;
  const local = fin(timeSec, 0) / life + off / life;
  const cycle = Math.floor(local);
  const p = local - cycle;
  const h = ((seed | 0) * 9176 + (k | 0) * 1543 + cycle * 31) | 0;
  out.p = p;
  out.flare = glintFlare(p);
  const h0 = hash01(h + 3);
  // The hue runs half way round the ring over one life: a prismatic sweep, white centre on top.
  const hu = h0 + 0.5 * p;
  out.hue = hu - Math.floor(hu);
  out.a = hash01(h + 1);
  out.b = hash01(h + 2);
  out.rot = hash01(h + 4) * (Math.PI / 2);
  out.cycle = cycle;
  return out;
}

/** Pure: glints alive at any time for n slots (every slot is always alive). */
export function glintsAlive(n: number): number {
  return Math.max(0, n | 0);
}

/**
 * Pure: a 4 point star at (x, y) with arm length size, turned by rot, written into out
 * (GLINT_STAR_PTS x, y pairs: arm, valley, arm, valley ...). Allocates nothing.
 */
export function glintStar(x: number, y: number, size: number, rot: number, out: Float32Array): Float32Array {
  const s = Math.max(0, fin(size, 0));
  const r0 = fin(rot, 0);
  for (let i = 0; i < GLINT_STAR_PTS; i++) {
    const a = r0 + (i * Math.PI) / 4;
    const r = i % 2 === 0 ? s : s * GLINT_WAIST;
    out[i * 2] = fin(x, 0) + Math.cos(a) * r;
    out[i * 2 + 1] = fin(y, 0) + Math.sin(a) * r;
  }
  return out;
}

/** Pure: the drawn arm length of a glint of peak size at its flare (pops out from nothing). */
export function glintSize(peak: number, flare: number): number {
  const f = Math.max(0, Math.min(1, fin(flare, 0)));
  return Math.max(0, fin(peak, 0)) * (0.25 + 0.75 * f);
}
