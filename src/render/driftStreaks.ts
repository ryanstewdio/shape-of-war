// R2 drift burst streaks (glow-r2-membrane). On sim:driftBurst the open drum shows speed streaks
// sweeping across its front face in the burst direction: a sparser, slower set for the telegraph
// (inSec seconds), then a dense fast set for the burst window, so the burst is unmistakable.
// Pure: streak positions are functions of the slot, the integrated travel and the level (hash01,
// never the PRNG). The renderer projects them through the drum. No pixi, no allocation per frame.
import { BURST_LEN, BURST_RAMP, burstWeight } from '../game/drift';
import { hash01 } from './color';

/** Streak slots drawn during the telegraph and at the burst peak. */
export const STREAK_TELE = 12;
export const STREAK_MAX = 36;
/** Travel speed in face sweeps per second: telegraph, and burst base plus peak extra. */
export const STREAK_TELE_SPEED = 0.45;
export const STREAK_BURST_SPEED = 0.7;
export const STREAK_BURST_EXTRA = 1.5;
/** Streak length in radians of drum angle at full level. */
export const STREAK_LEN = 0.55;
/** Half span of drum angle a streak travels across (a little past the front face edges). */
export const STREAK_FACE = Math.PI / 2 + 0.4;
/** Telegraph level range (rises across the telegraph) and burst level floor. */
export const STREAK_TELE_LO = 0.3;
export const STREAK_TELE_HI = 0.6;
export const STREAK_BURST_LO = 0.55;

export interface DriftStreakState {
  /** Seconds since the last sim:driftBurst; Infinity when none. */
  age: number;
  /** Telegraph length of that event, seconds. */
  inSec: number;
  /** Burst direction along u: 1 or -1. */
  dir: number;
  /** Integrated travel in face sweeps (keeps streaks continuous when the speed changes). */
  travel: number;
}

export interface StreakFrame {
  /** 0 when nothing is drawn, else 0 to 1. */
  level: number;
  /** Streak slots to draw this frame. */
  count: number;
  /** True in the burst window, false in the telegraph. */
  burst: boolean;
}

export interface StreakSeg {
  /** Tail and head drum angles (radians, camera relative), clamped to the front face. */
  phi0: number;
  phi1: number;
  /** Arena v of the streak. */
  v: number;
  /** Alpha 0 to 1 (0 means skip). */
  alpha: number;
}

export function createDriftStreaks(): DriftStreakState {
  return { age: Number.POSITIVE_INFINITY, inSec: 0, dir: 1, travel: 0 };
}

/** sim:driftBurst: start the telegraph. */
export function driftBurstEvent(s: DriftStreakState, inSec: number, dir: number): void {
  s.age = 0;
  s.inSec = Number.isFinite(inSec) && inSec > 0 ? inSec : 0;
  s.dir = dir < 0 ? -1 : 1;
}

/** Pure: level, slot count and phase at age seconds after an event with this telegraph length. */
export function streakLevel(age: number, inSec: number, out: StreakFrame): StreakFrame {
  out.level = 0;
  out.count = 0;
  out.burst = false;
  if (!(age >= 0) || !Number.isFinite(age)) return out;
  if (age < inSec) {
    out.level = STREAK_TELE_LO + (STREAK_TELE_HI - STREAK_TELE_LO) * (age / inSec);
    out.count = STREAK_TELE;
    return out;
  }
  const s = age - inSec;
  if (s >= BURST_LEN) return out;
  // The ramp in starts near the telegraph level, so the hand over does not blink; the ramp out fades.
  const w = burstWeight(s);
  out.level = STREAK_BURST_LO + (1 - STREAK_BURST_LO) * w;
  if (s > BURST_LEN - BURST_RAMP) out.level *= w;
  out.count = Math.round(STREAK_TELE + (STREAK_MAX - STREAK_TELE) * w);
  out.burst = true;
  return out;
}

/** Advance the state dt seconds and fill out with this frame's level. */
export function driftStreakFrame(s: DriftStreakState, dt: number, out: StreakFrame): StreakFrame {
  const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
  if (Number.isFinite(s.age)) s.age += d;
  streakLevel(s.age, s.inSec, out);
  if (out.level <= 0) {
    if (Number.isFinite(s.age) && s.age > s.inSec + BURST_LEN) s.age = Number.POSITIVE_INFINITY;
    return out;
  }
  const speed = out.burst ? STREAK_BURST_SPEED + STREAK_BURST_EXTRA * burstWeight(s.age - s.inSec) : STREAK_TELE_SPEED;
  s.travel += speed * d;
  return out;
}

function frac(x: number): number {
  return x - Math.floor(x);
}

/**
 * Pure: streak slot k for travel, direction dir, frame level and drum half height vHalf. The head
 * leads in the burst direction (plus u is plus phi); the tail trails it by the streak length.
 */
export function streakAt(k: number, travel: number, dir: number, level: number, vHalf: number, out: StreakSeg): StreakSeg {
  const h1 = hash01(k * 3 + 1);
  const h2 = hash01(k * 3 + 2);
  const h3 = hash01(k * 3 + 3);
  const d = dir < 0 ? -1 : 1;
  out.v = (h1 * 2 - 1) * vHalf * 0.94;
  const p = frac(h2 + d * travel * (0.7 + 0.6 * h3));
  const head = -STREAK_FACE + p * 2 * STREAK_FACE;
  const len = STREAK_LEN * (0.6 + 0.8 * h3) * (0.5 + 0.5 * level);
  const tail = head - d * len;
  const lim = Math.PI / 2;
  const a = Math.max(-lim, Math.min(lim, tail));
  const b = Math.max(-lim, Math.min(lim, head));
  out.phi0 = a;
  out.phi1 = b;
  if (Math.abs(b - a) < 1e-3) {
    out.alpha = 0;
    return out;
  }
  // Fade toward the face edges, where the drum turns away.
  const mid = Math.cos((a + b) / 2);
  out.alpha = level * (0.55 + 0.45 * h1) * (mid > 0 ? Math.sqrt(mid) : 0);
  return out;
}
