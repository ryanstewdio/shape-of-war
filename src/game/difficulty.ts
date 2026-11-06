// Release polish: the run's difficulty (docs/14 item 6). createGame stores GameOptions.difficulty on
// the world (default normal); every rule reads the table through difficultyOf. Normal multiplies
// by 1 and adds 0 everywhere, so a normal run is bit identical to the build before this module.
import { DIFFICULTY, type Difficulty, type DifficultyTable } from '../core/difficulty';
import { parScaleFor, scaleTarget, type ParScaleTable } from '../core/stars';
import type { LevelDef, ObjectiveDef } from '../levelgen/leveldef';
import type { World } from './world';

/** The difficulty table of this run (GameOptions.difficulty, normal by default). */
export function difficultyOf(w: World): DifficultyTable {
  return DIFFICULTY[w.difficulty];
}

/**
 * Pure: a wave's spawn count n scaled by rate, rounded, at least 1 when n is at least 1.
 * Rate 1 returns n unchanged.
 */
export function scaledCount(n: number, rate: number): number {
  if (n <= 0) return 0;
  const k = Math.round(n * rate);
  return k < 1 ? 1 : k;
}

/** Pure: enemy hit points hp scaled by mult, rounded, at least 1. Mult 1 returns hp unchanged. */
export function scaledHp(hp: number, mult: number): number {
  if (mult === 1) return hp;
  const k = Math.round(hp * mult);
  return k < 1 ? 1 : k;
}

/** Pure: starting lives for a level's lives plus the table's extraLives, at least 1. */
export function startingLives(lives: number, extra: number): number {
  const n = lives + extra;
  return n < 1 ? 1 : n;
}

/**
 * Pure: a level's maxLiveEnemies cap scaled by liveCapScale, rounded, at least 1 and at most cap
 * (ENTITY_CAP). Scale 1 returns max unchanged.
 */
export function scaledLiveCap(max: number, scale: number, cap: number): number {
  if (scale === 1) return max;
  const k = Math.round(max * scale);
  return Math.max(1, Math.min(cap, k));
}

/**
 * Pure: level with waves.maxLiveEnemies scaled by liveCapScale (scaledLiveCap). Returns the same
 * object when the cap is unchanged (always on Normal), else a shallow copy; the input is never mutated.
 */
export function levelWithLiveCap(level: LevelDef, scale: number, cap: number): LevelDef {
  const max = level.waves.maxLiveEnemies;
  const next = scaledLiveCap(max, scale, cap);
  if (next === max) return level;
  return { ...level, waves: { ...level.waves, maxLiveEnemies: next } };
}

/**
 * Pure: the objective a run on difficulty d plays. A scoreInTime target scales by parScale exactly
 * as par and the star targets do (core/stars.ts scaleTarget), so it never passes the 1 star line.
 * Every other objective, and every objective on Normal, is returned as the same object.
 */
export function objectiveFor(o: ObjectiveDef, d: Difficulty, table: ParScaleTable = DIFFICULTY): ObjectiveDef {
  if (o.kind !== 'scoreInTime') return o;
  const target = scaleTarget(o.target, parScaleFor(d, table));
  return target === o.target ? o : { ...o, target };
}

/**
 * Pure: level with its objective for difficulty d (objectiveFor). Returns the same object when the
 * objective is unchanged (always on Normal), else a shallow copy; the input is never mutated.
 */
export function levelWithTarget(level: LevelDef, d: Difficulty, table: ParScaleTable = DIFFICULTY): LevelDef {
  const objective = objectiveFor(level.objective, d, table);
  return objective === level.objective ? level : { ...level, objective };
}
