// R1 (Ryan): stars include the relative difficulty. The score stars (scoring.stars: par, 2 x par,
// 4 x par) are computed as before, then capped by the difficulty the level was played on: Easy at
// most 1, Normal at most 2, Hard at most 3. Completing a level on Insane gives 4 stars outright.
// R2 (P0): a failed attempt earns 0 stars on every difficulty, whatever the score. Pure, no PRNG.
// R6 (Ryan, gate R5): par and the three star targets follow the run's difficulty. Every place that
// shows or scores them reads targetsFor, which multiplies the level's own numbers by
// DIFFICULTY[d].parScale (Foundry calibrates the values).
// Guardian par (version 14, Ryan 2026-11-11): a guardian level carries its own par and stars per
// difficulty (LevelDef.difficultyPar); targetsFor reads that entry when present and falls back to
// par x parScale when absent.
import { DIFFICULTY, type Difficulty, type DifficultyTable } from './difficulty';

/** The level's par and its three star targets. */
export interface ParTargets {
  readonly par: number;
  readonly stars: readonly [number, number, number];
}

/** Per difficulty targets a level may carry (LevelDef.difficultyPar, version 14 guardian levels). */
export type DifficultyTargets = Readonly<Partial<Record<Difficulty, ParTargets>>>;

/** What targetsFor reads from a level: par, stars and, when present, the per difficulty targets. */
export interface LevelTargets extends ParTargets {
  readonly difficultyPar?: DifficultyTargets;
}

/** Only the field targetsFor reads, so tests can pass a stubbed table. */
export type ParScaleTable = Readonly<Record<Difficulty, Pick<DifficultyTable, 'parScale'>>>;

/** Pure: the par multiplier for a difficulty; 1 when the entry is missing or not a positive number. */
export function parScaleFor(d: Difficulty, table: ParScaleTable = DIFFICULTY): number {
  const v = table[d]?.parScale;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 1;
}

/** Pure: one target scaled and rounded to a whole point. Non positive or non finite stays as given. */
export function scaleTarget(v: number, scale: number): number {
  return Number.isFinite(v) && v > 0 ? Math.max(1, Math.round(v * scale)) : v;
}

/** Pure: true when e is a usable entry: a positive finite par and three finite stars. */
export function isTargetEntry(e: ParTargets | undefined): e is ParTargets {
  return e !== undefined && Number.isFinite(e.par) && e.par > 0 && Array.isArray(e.stars) && e.stars.length === 3 && e.stars.every((v) => Number.isFinite(v));
}

/**
 * Pure: par and the three star targets for a run on difficulty `d`: the level's own entry for d
 * when it carries a usable one (version 14 guardian levels), else par and stars x parScale.
 */
export function targetsFor(level: LevelTargets, d: Difficulty, table: ParScaleTable = DIFFICULTY): ParTargets {
  const own = level.difficultyPar?.[d];
  if (isTargetEntry(own)) {
    const [a, b, c] = own.stars;
    return { par: own.par, stars: [a, b, c] };
  }
  const k = parScaleFor(d, table);
  const [a, b, c] = level.stars;
  return { par: scaleTarget(level.par, k), stars: [scaleTarget(a, k), scaleTarget(b, k), scaleTarget(c, k)] };
}

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
  if (!success) return 0;
  if (difficulty === 'insane') return INSANE_STARS;
  const raw = Number.isFinite(scoreStars) ? Math.max(0, Math.floor(scoreStars)) : 0;
  return asStarCount(Math.min(raw, STAR_CAP[difficulty] ?? STAR_CAP.normal));
}
