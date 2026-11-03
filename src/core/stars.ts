// R1 (Ryan): stars include the relative difficulty. The score stars (scoring.stars: par, 2 x par,
// 4 x par) are computed as before, then capped by the difficulty the level was played on: Easy at
// most 1, Normal at most 2, Hard at most 3. Completing a level on Insane gives 4 stars outright; a
// failed Insane attempt keeps the Hard cap. Pure, no PRNG.
import type { Difficulty } from './difficulty';

export type StarCount = 0 | 1 | 2 | 3 | 4;

/** The most stars a run on each difficulty can earn from score alone. */
export const STAR_CAP: Readonly<Record<Difficulty, 1 | 2 | 3>> = Object.freeze({ easy: 1, normal: 2, hard: 3, insane: 3 });

/** Stars for completing a level on Insane, whatever the score. */
export const INSANE_STARS = 4;

/** Pure: an exact star count 0..4. Anything else gives 0. */
export function asStarCount(v: unknown): StarCount {
  return v === 1 || v === 2 || v === 3 || v === 4 ? v : 0;
}

/** Pure: the stars a finished Adventure attempt earns. `scoreStars` is scoring.stars(score, par). */
export function awardStars(scoreStars: number, difficulty: Difficulty, success: boolean): StarCount {
  if (difficulty === 'insane' && success) return INSANE_STARS;
  const raw = Number.isFinite(scoreStars) ? Math.max(0, Math.floor(scoreStars)) : 0;
  return asStarCount(Math.min(raw, STAR_CAP[difficulty] ?? STAR_CAP.normal));
}
