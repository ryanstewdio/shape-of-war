// Release polish: the run's difficulty (docs/14 item 6). createGame stores GameOptions.difficulty on
// the world (default normal); every rule reads the table through difficultyOf. Normal multiplies
// by 1 and adds 0 everywhere, so a normal run is bit identical to the build before this module.
import { DIFFICULTY, type DifficultyTable } from '../core/difficulty';
import type { LevelDef } from '../levelgen/leveldef';
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
