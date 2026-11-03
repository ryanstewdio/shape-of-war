// R3 Turbo numbers (Ryan: "Turbo needs to be longer and more valuable") and the kill extension.
// Kept apart from supers.ts so combat.ts can extend a running Turbo without an import cycle.
import type { GameState } from './state';

/** Base Turbo duration, s (was the shared 5 s super duration). */
export const TURBO_DURATION = 10;
/** Fire rate multiplier while Turbo runs (was 2). */
export const TURBO_SCALE = 2.5;
/** Speed cap multiplier while Turbo runs (was 1.25). */
export const TURBO_SPEED_SCALE = 1.35;
/** Enemies a Turbo bullet passes through before it stops on the next (was 1). */
export const TURBO_PIERCE = 2;
/** Seconds each scored kill during Turbo adds. */
export const TURBO_KILL_BONUS = 0.25;
/** Cap on the total Turbo duration, base plus every kill extension, s. */
export const TURBO_MAX_TOTAL = 15;

/**
 * A scored kill: extend a running Turbo by TURBO_KILL_BONUS, never past TURBO_MAX_TOTAL in all.
 * Returns the seconds added.
 */
export function turboKill(g: GameState): number {
  if (g.superActive !== 'turbo' || g.superTimer <= 0) return 0;
  const add = Math.min(TURBO_KILL_BONUS, Math.max(0, TURBO_MAX_TOTAL - g.turboTotal));
  if (add <= 0) return 0;
  g.turboTotal += add;
  g.superTimer += add;
  return add;
}
