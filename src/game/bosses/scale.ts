// R1 difficulty scales for bosses (Ryan: Insane bosses use their abilities faster and bring more
// minions). Cadence and hit points already scale with bossScale (applyBossScaling in core.ts).
// This module adds the minion count scale (addScale) and the Insane telegraph cut. Pure, no PRNG,
// no allocation. Normal multiplies by 1 everywhere, so a Normal fight is unchanged.
import type { Difficulty } from '../../core/difficulty';
import { scaledCount } from '../difficulty';
import { hazardTelegraph } from './kit';
import { HORNET_CAP, MAX_HORNETS } from './table';
import type { BossState } from './state';

/** Insane bosses telegraph this share of the tier telegraph (15 percent shorter). */
export const INSANE_TELEGRAPH_SCALE = 0.85;

/** Pure: the telegraph scale for a difficulty: INSANE_TELEGRAPH_SCALE on Insane, else 1. */
export function telegraphScaleFor(difficulty: Difficulty): number {
  return difficulty === 'insane' ? INSANE_TELEGRAPH_SCALE : 1;
}

/**
 * Pure: a minion count n scaled by addScale, rounded, never below 1 (for n of at least 1) and never
 * above cap. A bad scale reads as 1, so addScale 1 returns n (clamped to cap).
 */
export function minionCount(n: number, addScale: number, cap: number): number {
  if (!(n >= 1)) return 0;
  const scale = Number.isFinite(addScale) && addScale > 0 ? addScale : 1;
  const k = scaledCount(n, scale);
  return k > cap ? cap : k;
}

/** The telegraph seconds of boss bs: the tier telegraph times its teleScale. */
export function bossTele(bs: BossState): number {
  return hazardTelegraph(bs.row.tier) * bs.teleScale;
}

/** Pure: live Hornets allowed at addScale: HORNET_CAP scaled, within the MAX_HORNETS pool. */
export function hornetCap(addScale: number): number {
  return minionCount(HORNET_CAP, addScale, MAX_HORNETS);
}
