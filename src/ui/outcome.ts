// R2 (P0): the verdict, stars and saved best of a finished Adventure attempt, in one place, so the
// rule "losing every life is a failure with 0 stars and nothing saved" is testable against the
// real sim. main.ts calls settleAdventure from its game:over handler with the world's snapshot and
// the sim's own outcome.
import type { Difficulty } from '../core/difficulty';
import { loadAdventureScores, recordAdventureScore, type StorageLike } from '../core/settings';
import { awardStars, type StarCount } from '../core/stars';
import type { ObjectiveDef } from '../levelgen/leveldef';
import { levelSuccess, type ObjectiveSnapshot, type SimOutcome } from './objective';

export interface AdventureEndInput {
  readonly levelIndex: number;
  readonly objective: ObjectiveDef;
  readonly snapshot: ObjectiveSnapshot;
  /** GameState.outcome when game:over fired. */
  readonly outcome: SimOutcome;
  readonly bossLevel: boolean;
  readonly score: number;
  /** The score stars from game:over (level thresholds, before the difficulty cap). */
  readonly scoreStars: number;
  readonly difficulty: Difficulty;
  /** A typed seed or Free Play: nothing is saved and nothing unlocks. */
  readonly sessionOnly: boolean;
}

export interface AdventureEnd {
  readonly success: boolean;
  readonly stars: StarCount;
  readonly best: number;
  readonly newBest: boolean;
  /** True when the attempt was written to sow.scores.adventure. */
  readonly saved: boolean;
}

/** Pure: the verdict and stars, no storage. A failure is always 0 stars. */
export function judgeAdventure(i: Pick<AdventureEndInput, 'objective' | 'snapshot' | 'outcome' | 'bossLevel' | 'scoreStars' | 'difficulty'>): {
  success: boolean;
  stars: StarCount;
} {
  const success = levelSuccess(i.objective, i.snapshot, i.outcome, i.bossLevel);
  return { success, stars: success ? awardStars(i.scoreStars, i.difficulty, true) : 0 };
}

/** The stored best score for a level, 0 when none. */
export function storedBest(index: number, storage?: StorageLike | null): number {
  return loadAdventureScores(storage)[String(Math.floor(index))]?.best ?? 0;
}

/**
 * Edge (storage): judge the attempt and save it only on a success. A failed attempt leaves the
 * table untouched, so it can never become a best or carry stars.
 */
export function settleAdventure(i: AdventureEndInput, storage?: StorageLike | null): AdventureEnd {
  const { success, stars } = judgeAdventure(i);
  if (!success || i.sessionOnly) {
    const prev = i.sessionOnly ? i.score : storedBest(i.levelIndex, storage);
    return { success, stars, best: prev, newBest: false, saved: false };
  }
  const rec = recordAdventureScore(i.levelIndex, i.score, stars, storage, i.difficulty);
  return { success, stars, best: rec.best, newBest: rec.newBest, saved: true };
}
