// Trough depth cues (glow trough-depth, Ryan's device check 2026-11-10). Pure, no pixi.js import,
// no PRNG, no allocation in the per point functions.
// The valley read as a valley, but climbing the slope needed more of a 3D feel and the rims were not
// visibly brighter. Two cues, both render only (the sim's hit areas never change):
// - depth scale: everything drawn on a trough (ship, enemies, bullets, geoms, pickups, effects)
//   grows with the ground height under it, 1 on the floor to TROUGH_DEPTH_SCALE at the rim, as if
//   the slope rose toward the camera. It rides on the drum point's depth scale (drum.ts
//   troughProject), so billboards, particles and drum pen marks all take it with no extra pass;
// - rim light: grid lines and the arena outline get wider and brighter with height, so the bowl
//   reads at a glance. Line alpha is a fixed multiplier under the grid layer alpha (applyNeon's
//   gridAlpha stays the only brightness knob), floor lines at TROUGH_FLOOR_LINE_ALPHA rising to 1.
// Static lines are cut into TROUGH_RIM_BUCKETS height buckets, one stroke per bucket, so the cost is
// a handful of extra stroke calls on arena, tilt, fit or neon change and nothing per frame.
import { TROUGH_POWER, troughX } from '../core/trough';

/** Depth scale at the rim (1 on the floor): drawn objects grow by this much at the top of the slope. */
export const TROUGH_DEPTH_SCALE = 1.35;
/** Grid line alpha multiplier on the floor (1 at the rim). */
export const TROUGH_FLOOR_LINE_ALPHA = 0.5;
/** Grid line width multiplier at the rim (1 on the floor). */
export const TROUGH_RIM_LINE_WIDTH = 2.2;
/** Outline pass width multiplier at the rim (1 on the floor). */
export const TROUGH_RIM_WALL_WIDTH = 1.7;
/** Outline pass alpha multiplier at the rim (1 on the floor), capped at 1 per pass. */
export const TROUGH_RIM_WALL_ALPHA = 1.8;
/** Height buckets for static rim lines: one stroke each. */
export const TROUGH_RIM_BUCKETS = 6;

/**
 * Pure: the ground height at u as a share of the rim height, 0 on the floor to 1 at the rims.
 * Exactly troughHeight(u, W) / (TROUGH_DEPTH_SHARE x W).
 */
export function troughHeightFrac(u: number, width: number): number {
  if (!(width > 0)) return 0;
  return Math.pow(Math.abs(troughX(u, width)), TROUGH_POWER);
}

/** Pure: the depth scale for a height share t (0 floor, 1 rim), clamped. */
export function depthScaleAt(t: number): number {
  const c = t > 0 ? (t < 1 ? t : 1) : 0;
  return 1 + (TROUGH_DEPTH_SCALE - 1) * c;
}

/** Pure: the depth scale of a drawn object at u on a trough of width W. */
export function troughDepthScale(u: number, width: number): number {
  return depthScaleAt(troughHeightFrac(u, width));
}

/** Pure: grid line alpha multiplier at height share t (floor TROUGH_FLOOR_LINE_ALPHA, rim 1). */
export function rimLineAlpha(t: number): number {
  const c = t > 0 ? (t < 1 ? t : 1) : 0;
  return TROUGH_FLOOR_LINE_ALPHA + (1 - TROUGH_FLOOR_LINE_ALPHA) * c;
}

/** Pure: grid line width multiplier at height share t (floor 1, rim TROUGH_RIM_LINE_WIDTH). */
export function rimLineWidth(t: number): number {
  const c = t > 0 ? (t < 1 ? t : 1) : 0;
  return 1 + (TROUGH_RIM_LINE_WIDTH - 1) * c;
}

/** Pure: outline pass width multiplier at height share t. */
export function rimWallWidth(t: number): number {
  const c = t > 0 ? (t < 1 ? t : 1) : 0;
  return 1 + (TROUGH_RIM_WALL_WIDTH - 1) * c;
}

/** Pure: outline pass alpha at height share t for a pass of base alpha a, capped at 1. */
export function rimWallAlpha(a: number, t: number): number {
  const c = t > 0 ? (t < 1 ? t : 1) : 0;
  const v = a * (1 + (TROUGH_RIM_WALL_ALPHA - 1) * c);
  return v < 1 ? v : 1;
}

/** Pure: the bucket of a height share t, 0 to buckets - 1. */
export function rimBucket(t: number, buckets: number = TROUGH_RIM_BUCKETS): number {
  const n = Math.max(1, Math.round(buckets));
  const c = t > 0 ? (t < 1 ? t : 1) : 0;
  const b = Math.floor(c * n);
  return b < n ? b : n - 1;
}

/** Pure: the representative height share of a bucket (its centre). */
export function rimBucketT(b: number, buckets: number = TROUGH_RIM_BUCKETS): number {
  const n = Math.max(1, Math.round(buckets));
  return (b + 0.5) / n;
}

/** Pure: the u that samples line alpha a from a linear two texel texture (floor texel, white texel). */
export function rimTexU(t: number): number {
  const c = t > 0 ? (t < 1 ? t : 1) : 0;
  return 0.25 + 0.5 * c;
}
