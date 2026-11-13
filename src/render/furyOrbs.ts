// Gravitas pool orb look (glow-fury-orbs, Ryan 2026-11-13). Swarm writes the sim: a Kind.BossHazard
// with w.a 6 (HazardType.Orb) flies from Gravitas toward the ship along w.rot, w.radius its radius and
// w.t its age; where it stops the sim removes it and opens a Pool (drawn by planPool, unchanged).
// The orb is never lethal, so it has no telegraph and no lethal form: a small bright violet orb with a
// short trail behind it along w.rot. Pure maths, no pixi, no PRNG, no allocation.
import { clampNum } from './color';
import type { EffectsTier } from './effects';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** Outer glow diameter as a multiple of the orb radius, and its alpha. */
export const ORB_GLOW = 3;
export const ORB_GLOW_A = 0.7;
/** Hot core diameter as a multiple of the orb radius, its alpha and the white mixed into the violet. */
export const ORB_CORE = 1.1;
export const ORB_CORE_A = 1;
export const ORB_CORE_WHITE = 0.55;
/** Trail: puffs behind the orb, spaced by this multiple of the radius, the first puff's size and alpha. */
export const ORB_TRAIL_STEP = 0.85;
export const ORB_TRAIL_SIZE = 2.2;
export const ORB_TRAIL_A = 0.45;
/** Trail puffs per effects tier (Low pays two). */
export const ORB_TRAIL_LOW = 2;
export const ORB_TRAIL_STD = 4;
export const ORB_TRAIL_HIGH = 5;
/** Seconds the orb takes to fade in from its launch, and the quick shimmer (Hz, depth). */
export const ORB_FADE_IN = 0.08;
export const ORB_SHIMMER_HZ = 7;
export const ORB_SHIMMER = 0.12;
/** Radius used when the sim writes none (GRAVITAS_ORB.radius). */
export const ORB_RADIUS_DEFAULT = 14;

/** Pure: the drawn radius of an orb, the sim radius or the default when missing. */
export function orbRadius(r: number): number {
  const v = fin(r, 0);
  return v > 1 ? v : ORB_RADIUS_DEFAULT;
}

/** Pure: trail puff count for a tier. */
export function orbTrailCount(tier: EffectsTier | undefined): number {
  return tier === 'low' ? ORB_TRAIL_LOW : tier === 'high' ? ORB_TRAIL_HIGH : ORB_TRAIL_STD;
}

/** Pure: fade in over ORB_FADE_IN from launch (a NaN age reads as fully in). */
export function orbFadeIn(age: number): number {
  return Number.isFinite(age) ? clampNum(age / ORB_FADE_IN, 0, 1) : 1;
}

/** Pure: the shimmer scale on the render clock, 1 - ORB_SHIMMER to 1. */
export function orbShimmer(timeSec: number): number {
  return 1 - ORB_SHIMMER * 0.5 * (1 + Math.sin(fin(timeSec, 0) * ORB_SHIMMER_HZ * Math.PI * 2));
}

/** Pure: how far behind the orb centre trail puff k (0 nearest) sits, in arena units. */
export function orbTrailDist(k: number, r: number): number {
  return (k + 1) * ORB_TRAIL_STEP * r;
}

/** Pure: size factor of trail puff k of n, shrinking toward the tail (1 at k 0, never below 0.3). */
export function orbTrailScale(k: number, n: number): number {
  if (!(n > 0)) return 0;
  return Math.max(0.3, 1 - k / n);
}

/** Pure: alpha factor of trail puff k of n, fading toward the tail (1 at k 0, 0 past the last). */
export function orbTrailAlpha(k: number, n: number): number {
  if (!(n > 0) || k >= n || k < 0) return 0;
  const f = 1 - k / n;
  return f * f;
}
