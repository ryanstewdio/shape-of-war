// Fury fixes looks (glow-fury-fixes, Ryan 2026-11-12): the Brood pincer telegraph and the Gravitas
// shelter pool. Swarm writes the view fields and spawns the pools; an absent field reads as off.
// Brood pincer: while view.pincerAim is 0 or more both pincer Broodlings flash white at about 6 Hz and
// a thin hot green aim line runs from each to its drive point, brightening as the aim runs out; while
// view.pincerDrive is true a short streak trails each driving Broodling (none on Low).
// Gravitas pool (HazardType.Pool, w.a 5): a violet dashed ring at w.radius with a faint fill and specks
// rising slowly inside, dimming over its last GRAVITAS_POOL.fadeSec. Never lethal, so it never takes
// the telegraph form or the lethal flash.
// Pure maths, no pixi, no PRNG (the specks are placed by a fixed hash of their index), no allocation.
import { BROOD_FRENZY, GRAVITAS_POOL } from '../game/bosses/table';
import type { EffectsTier } from './effects';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Brood pincer -----------------------------------------------------------------------------------

/** White flash rate of the aiming pincer Broodlings (Hz) and the share of each cycle drawn white. */
export const PINCER_FLASH_HZ = 6;
export const PINCER_FLASH_DUTY = 0.5;
/** Aim line alpha at the start of the aim and as it runs out, its width (arena units) and white mix. */
export const PINCER_LINE_A0 = 0.35;
export const PINCER_LINE_A1 = 1;
export const PINCER_LINE_W = 1.6;
export const PINCER_LINE_WHITE = 0.35;
/** Drive streak length (arena units), width and alpha at its head. */
export const PINCER_STREAK_U = 48;
export const PINCER_STREAK_W = 3;
export const PINCER_STREAK_A = 0.7;

/** Pure: true while a pincer aims (pincerAim 0 or more; absent, negative or not finite is off). */
export function pincerAimOn(aim: number | undefined): boolean {
  return aim !== undefined && Number.isFinite(aim) && aim >= 0;
}

/** Pure: true while the pincer drives (absent reads as off). */
export function pincerDriveOn(drive: boolean | undefined): boolean {
  return drive === true;
}

/** Pure: true when entity id i is one of the two pincer Broodlings (ids of -1 or absent never match). */
export function isPincerId(i: number, a: number | undefined, b: number | undefined): boolean {
  return i >= 0 && (i === a || i === b);
}

/** Pure: true on the white half of the about 6 Hz pincer flash at timeSec. */
export function pincerFlash(timeSec: number): boolean {
  const c = fin(timeSec, 0) * PINCER_FLASH_HZ;
  return c - Math.floor(c) < PINCER_FLASH_DUTY;
}

/** Pure: aim line alpha from the seconds of aim left: dim at the start, full as it runs out. */
export function pincerLineAlpha(aimLeft: number): number {
  const span = BROOD_FRENZY.aimSec > 0 ? BROOD_FRENZY.aimSec : 1;
  const k = 1 - clamp01(fin(aimLeft, 0) / span);
  return PINCER_LINE_A0 + (PINCER_LINE_A1 - PINCER_LINE_A0) * k;
}

/** Pure: true when the streak shows (driving, and never on Low). */
export function pincerStreakOn(drive: boolean | undefined, tier: EffectsTier): boolean {
  return pincerDriveOn(drive) && tier !== 'low';
}

/**
 * Pure: the unit direction a streak trails in, written to out: against the drawn move (mx, my) this
 * frame, or, when the Broodling barely moved, away from its drive point (dx, dy relative to it).
 * Writes (0, 0) when neither gives a direction.
 */
export function pincerStreakDir(mx: number, my: number, dx: number, dy: number, out: { x: number; y: number }): { x: number; y: number } {
  const ax = fin(mx, 0);
  const ay = fin(my, 0);
  const m = Math.sqrt(ax * ax + ay * ay);
  if (m > 1e-3) {
    out.x = -ax / m;
    out.y = -ay / m;
    return out;
  }
  const bx = fin(dx, 0);
  const by = fin(dy, 0);
  const d = Math.sqrt(bx * bx + by * by);
  if (d > 1e-3) {
    out.x = -bx / d;
    out.y = -by / d;
    return out;
  }
  out.x = 0;
  out.y = 0;
  return out;
}

// Gravitas pool ----------------------------------------------------------------------------------

/** Ring alpha, fill alpha (a soft disc), speck alpha and the ring width share of the hazard line. */
export const POOL_RING_A = 0.6;
export const POOL_FILL_A = 0.1;
export const POOL_SPECK_A = 0.55;
export const POOL_RING_W = 0.8;
/** Dashes: target dash and gap length (arena units), count bounds, slow turn (rad/s). */
export const POOL_DASH_U = 18;
export const POOL_GAP_U = 12;
export const POOL_DASHES_MIN = 8;
export const POOL_DASHES_MAX = 20;
export const POOL_TURN = 0.25;
/** Fade in seconds at the start of its life. */
export const POOL_FADE_IN = 0.3;
/** Specks per pool by tier, their rise speed (radius shares per second), size and spread share. */
export const POOL_SPECKS: Readonly<Record<EffectsTier, number>> = { low: 3, standard: 8, high: 12 };
export const POOL_RISE = 0.18;
export const POOL_SPECK_SIZE = 4;
export const POOL_SPREAD = 0.8;

/**
 * Pure: the pool's brightness 0 to 1 from its age and full life (w.t and w.vx): fades in over
 * POOL_FADE_IN, then dims to 0 over its last GRAVITAS_POOL.fadeSec. A missing life reads as no fade.
 */
export function poolFade(age: number, life: number): number {
  const a = Math.max(0, fin(age, 0));
  const inK = clamp01(a / POOL_FADE_IN);
  const l = fin(life, 0);
  if (!(l > 0)) return inK;
  const fade = GRAVITAS_POOL.fadeSec > 0 ? GRAVITAS_POOL.fadeSec : 1;
  return inK * clamp01((l - a) / fade);
}

/** Pure: dash count round a pool of radius r (one dash and gap every POOL_DASH_U + POOL_GAP_U). */
export function poolDashes(r: number): number {
  if (!(r > 0)) return 0;
  const n = Math.round((2 * Math.PI * r) / (POOL_DASH_U + POOL_GAP_U));
  return Math.max(POOL_DASHES_MIN, Math.min(POOL_DASHES_MAX, n));
}

/** Pure: specks drawn per pool for the effects tier. */
export function poolSpeckCount(t: EffectsTier): number {
  return POOL_SPECKS[t];
}

/** Pure: a fixed 0 to 1 hash of an integer (speck placement, never the PRNG). */
export function speckHash(k: number, salt: number): number {
  const s = Math.sin((k + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Pure: speck k of a pool of radius r at age t, written to out as an offset from the pool centre and
 * an alpha share: each rises from the bottom to the top of the chord at its own across offset, slowly,
 * fading in and out at the ends. Screen up is minus y.
 */
export function poolSpeck(k: number, r: number, age: number, out: { x: number; y: number; a: number }): { x: number; y: number; a: number } {
  const R = Math.max(0, fin(r, 0)) * POOL_SPREAD;
  const u = speckHash(k, 1) * 2 - 1;
  const hh = R * Math.sqrt(Math.max(0, 1 - u * u));
  const rate = POOL_RISE * (0.7 + 0.6 * speckHash(k, 2));
  const c = Math.max(0, fin(age, 0)) * rate + speckHash(k, 3);
  const p = c - Math.floor(c);
  out.x = u * R;
  out.y = hh - 2 * hh * p;
  out.a = Math.sin(Math.PI * p);
  return out;
}
