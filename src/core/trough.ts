// Trough ("half drum") profile: Morpheus contract stub for the trough wave (Ryan 2026-11-10).
// A valley across the width: the floor is the vertical centre line u = 0, the ground rises toward the
// left and right edges (u = plus or minus W/2), gentle at the bottom and steep at the rim. Shared by
// the sim pull (Forge), the projection (Glow) and the level rules (Foundry). Pure, no PRNG, no DOM.

/** First Adventure level that may be a trough (Ryan). */
export const TROUGH_MIN_LEVEL = 24;
/** Rim height as a share of the arena width (render depth; the sim uses the slope only). */
export const TROUGH_DEPTH_SHARE = 0.32;
/** Profile exponent: height grows as |x|^p, so the bottom is flat and the rim steep. */
export const TROUGH_POWER = 2.6;

/** Normalised position across the width, clamped to [-1, 1]. u is centred on 0. */
export function troughX(u: number, width: number): number {
  const x = (2 * u) / width;
  return x < -1 ? -1 : x > 1 ? 1 : x;
}

/** Height of the ground at u, 0 at the floor and depth at the rims (arena units). */
export function troughHeight(u: number, width: number): number {
  const x = Math.abs(troughX(u, width));
  return TROUGH_DEPTH_SHARE * width * Math.pow(x, TROUGH_POWER);
}

/**
 * Slope of the ground at u (dh/du, dimensionless): 0 at the floor, largest at the rims, sign
 * points uphill (positive on the right half). Gravity pulls toward minus this sign.
 */
export function troughSlope(u: number, width: number): number {
  const x = troughX(u, width);
  const ax = Math.abs(x);
  if (ax === 0) return 0;
  const d = 2 * TROUGH_DEPTH_SHARE * TROUGH_POWER * Math.pow(ax, TROUGH_POWER - 1);
  return x > 0 ? d : -d;
}
