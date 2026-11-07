// Tester 3 pond ripples (wave T3, version 9). Sudden ring waves, like a stone thrown into a still
// pond, on flat non boss levels from RIPPLE_MIN_LEVEL that are not circle arenas. Every draw comes
// from its own stream (RIPPLE_SALT), drawn after every other stage, so no other draw moves. The
// sim (Forge) turns each RippleEvent into a push; par ignores ripples (a hazard, not a score source).
import type { Rng } from '../core/rng';
import { round1, round2 } from './leveldef';
import type { ArenaDef, RippleEvent, Vec2 } from './leveldef';

/** Salt of the ripple stream. ASCII "RIPL". */
export const RIPPLE_SALT = 0x5249504c;
/** First level that may carry ripples. */
export const RIPPLE_MIN_LEVEL = 12;
/** Level from which ripples are at full strength. */
export const RIPPLE_FULL_LEVEL = 40;
/** Share of eligible levels that carry ripples. */
export const RIPPLE_CHANCE = 0.5;
/** Wave clock second range of the first ripple. */
export const RIPPLE_FIRST_MIN_SEC = 40;
export const RIPPLE_FIRST_MAX_SEC = 70;
/** Seconds from one ripple to the next. */
export const RIPPLE_GAP_MIN_SEC = 25;
export const RIPPLE_GAP_MAX_SEC = 45;
/** Least distance from an epicentre to any wall or obstacle, arena units. */
export const RIPPLE_CLEAR = 150;
/** Strength at RIPPLE_MIN_LEVEL and at RIPPLE_FULL_LEVEL and beyond. */
export const RIPPLE_MIN_STRENGTH = 0.3;
export const RIPPLE_MAX_STRENGTH = 1;
/** Contract range of RippleEvent.strength (leveldef.ts). */
export const RIPPLE_STRENGTH_FLOOR = 0.2;
/** Epicentre draws per ripple before that ripple is left out (its time still advances). */
export const RIPPLE_POINT_ATTEMPTS = 30;

const range = (r: Rng, lo: number, hi: number): number => lo + (hi - lo) * r();

/** Strength of every ripple on level n: 0.3 at level 12, rising linearly to 1 at level 40. */
export function rippleStrength(levelIndex: number): number {
  const u = (levelIndex - RIPPLE_MIN_LEVEL) / (RIPPLE_FULL_LEVEL - RIPPLE_MIN_LEVEL);
  return round2(Math.min(RIPPLE_MAX_STRENGTH, Math.max(RIPPLE_MIN_STRENGTH, RIPPLE_MIN_STRENGTH + (RIPPLE_MAX_STRENGTH - RIPPLE_MIN_STRENGTH) * u)));
}

/** True when a version 9 level may carry ripples: level 12 or later, flat, no boss, not a circle arena. */
export function rippleEligible(levelIndex: number, flat: boolean, boss: boolean, arena: Readonly<ArenaDef>): boolean {
  return Number.isInteger(levelIndex) && levelIndex >= RIPPLE_MIN_LEVEL && flat && !boss && arena.shape !== 'circle';
}

/**
 * Ripples of one eligible level, sorted by atSec, or null when the level carries none. Draws: the
 * share uniform; then per ripple its time (first 40 to 70 s, then 25 to 45 s on) and up to
 * RIPPLE_POINT_ATTEMPTS epicentre pairs (x, y). clear(p) says a rounded point keeps RIPPLE_CLEAR
 * from every wall and obstacle. Ripples start while atSec < endSec. Pure apart from the stream.
 */
export function generateRipples(r: Rng, arena: Readonly<ArenaDef>, levelIndex: number, endSec: number, clear: (p: Vec2) => boolean): RippleEvent[] | null {
  if (!(r() < RIPPLE_CHANCE)) return null;
  const strength = rippleStrength(levelIndex);
  const hw = Math.max(0, arena.width / 2 - RIPPLE_CLEAR);
  const hh = Math.max(0, arena.height / 2 - RIPPLE_CLEAR);
  const out: RippleEvent[] = [];
  let t = round1(range(r, RIPPLE_FIRST_MIN_SEC, RIPPLE_FIRST_MAX_SEC));
  while (t < endSec) {
    for (let a = 0; a < RIPPLE_POINT_ATTEMPTS; a++) {
      const p = { x: round1(range(r, -hw, hw)) + 0, y: round1(range(r, -hh, hh)) + 0 };
      if (!clear(p)) continue;
      out.push({ atSec: t, x: p.x, y: p.y, strength });
      break;
    }
    t = round1(t + round1(range(r, RIPPLE_GAP_MIN_SEC, RIPPLE_GAP_MAX_SEC)));
  }
  return out.length === 0 ? null : out;
}
