// Fury tune looks (glow-fury-tune, Ryan 2026-11-12). Swarm writes the sim; an absent field reads as off.
// Mirage aimed lane: a Lane hazard with w.vy above 0 telegraphs for w.vy seconds (hazardFx.ts
// laneTelegraphSec) and reads a little brighter and whiter than the other lanes while it telegraphs.
// Straight shots: a player bullet with BulletPool.straight 1 (fired from inside a Gravitas pool) takes a
// violet white tint so the player learns pool shots fly true.
// Ship in a pool: while view.shipInPool is true the ship carries a violet halo, the drift cue
// (glow-fury-orbs: brighter, with a hot core glow, and shown after the stage 2 split too).
// Pure maths, no pixi, no PRNG, no allocation. Colours come from palette keys passed in by the caller.
import type { EffectsTier } from './effects';
import { mixRgb } from './mapFx';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

// Aimed lane -------------------------------------------------------------------------------------

/** Alpha gain on the aimed lane while it telegraphs (capped at 1) and the white mixed into its tint. */
export const AIMED_LANE_GAIN = 1.35;
export const AIMED_LANE_WHITE = 0.25;

/** Pure: true for a lane carrying its own telegraph (w.vy above 0, Mirage's aimed lane). */
export function laneAimed(vy: number): boolean {
  return Number.isFinite(vy) && vy > 0;
}

/** Pure: telegraph alpha of a lane, lifted on the aimed lane while it telegraphs. Lethal is untouched. */
export function aimedLaneAlpha(alpha: number, aimed: boolean, lethal: boolean): number {
  const a = fin(alpha, 0);
  if (!aimed || lethal) return a;
  return Math.min(1, a * AIMED_LANE_GAIN);
}

/** Pure: tint of a lane, whitened a little on the aimed lane while it telegraphs. */
export function aimedLaneTint(tint: number, aimed: boolean, lethal: boolean): number {
  return aimed && !lethal ? mixRgb(tint, 0xffffff, AIMED_LANE_WHITE) : tint;
}

// Straight shots ---------------------------------------------------------------------------------

/** White mixed into violet for a straight shot (high, so it reads violet white, not boss violet). */
export const STRAIGHT_WHITE = 0.55;

/** Pure: true when a bullet was fired from a pool (straight array absent or 0 is off). */
export function bulletStraight(straight: Uint8Array | undefined, i: number): boolean {
  return straight !== undefined && straight[i] === 1;
}

/** Pure: the violet white tint of a straight shot from the palette violet. */
export function straightTint(violet: number): number {
  return mixRgb(violet, 0xffffff, STRAIGHT_WHITE);
}

/** Pure: the tint a player bullet is drawn with: its weapon tint, or violet white when straight. */
export function bulletTint(base: number, straight: boolean, violet: number): number {
  return straight ? straightTint(violet) : base;
}

// Ship in a pool ---------------------------------------------------------------------------------

/**
 * Halo size as a multiple of the ship radius, its base alpha and the slow breathe (Hz, depth).
 * glow-fury-orbs (Ryan 2026-11-13, the halo was not seen): alpha 0.22 to 0.5, shallower breathe.
 */
export const POOL_HALO_SCALE = 3.2;
export const POOL_HALO_A = 0.5;
export const POOL_HALO_HZ = 0.6;
export const POOL_HALO_BREATHE = 0.18;
/** The thin ring at the halo edge (standard and high only), as a share of the halo radius. */
export const POOL_HALO_RING = 0.62;
export const POOL_HALO_RING_A = 0.75;
export const POOL_HALO_RING_W = 1.8;
/**
 * glow-fury-orbs: a smaller, hotter violet glow hugging the ship on every tier (Low too, so Low reads
 * clearly with two sprites and no ring), as a share of the halo radius, its alpha and white mix.
 */
export const POOL_HALO_CORE = 0.45;
export const POOL_HALO_CORE_A = 0.55;
export const POOL_HALO_CORE_WHITE = 0.3;
/** Seconds for the halo to fade in on entering a pool and out on leaving it. */
export const POOL_HALO_EASE = 0.2;

/** Pure: true while the halo shows (in a pool and the ship is alive; absent reads as off). */
export function shipPoolHaloOn(inPool: boolean | undefined, shipLive: boolean): boolean {
  return inPool === true && shipLive;
}

/** Pure: step the halo's 0 to 1 strength toward on or off over POOL_HALO_EASE seconds. */
export function stepPoolHalo(k: number, on: boolean, dt: number): number {
  const d = Math.max(0, fin(dt, 0)) / POOL_HALO_EASE;
  const v = fin(k, 0) + (on ? d : -d);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Pure: halo alpha from its strength k and the render clock: a faint slow breathe, 0 when k is 0. */
export function poolHaloAlpha(k: number, timeSec: number): number {
  const s = fin(k, 0);
  if (!(s > 0)) return 0;
  const b = 1 - POOL_HALO_BREATHE * 0.5 * (1 + Math.sin(fin(timeSec, 0) * POOL_HALO_HZ * Math.PI * 2));
  return POOL_HALO_A * Math.min(1, s) * b;
}

/** Pure: the edge ring alpha that goes with a halo alpha (same breathe and ease). */
export function poolHaloRingAlpha(haloAlpha: number): number {
  return POOL_HALO_RING_A * Math.max(0, fin(haloAlpha, 0)) / POOL_HALO_A;
}

/** Pure: whether the halo draws its edge ring (one glow sprite only on Low). */
export function poolHaloRing(tier: EffectsTier): boolean {
  return tier !== 'low';
}

/** Pure (glow-fury-orbs): the inner core glow alpha that goes with a halo alpha (same breathe and ease). */
export function poolHaloCoreAlpha(haloAlpha: number): number {
  return POOL_HALO_CORE_A * Math.max(0, fin(haloAlpha, 0)) / POOL_HALO_A;
}

/** Pure (glow-fury-orbs): the core glow tint, the palette violet a little toward white. */
export function poolHaloCoreTint(violet: number): number {
  return mixRgb(violet, 0xffffff, POOL_HALO_CORE_WHITE);
}
