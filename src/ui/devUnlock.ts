// Dev only: unlock every Adventure level on the stored seed. Stars and scores are not touched.
import { unlockLevel } from '../core/settings';

export const ADVENTURE_LEVELS = 50;
export const UNLOCK_ALL_LABEL = 'Unlock all levels';
export const UNLOCK_ALL_CONFIRM = 'Tap again: unlock levels 1 to 50';
export const UNLOCK_ALL_DONE = 'Levels 1 to 50 unlocked';

/** Raise the unlocked index to ADVENTURE_LEVELS (never lowers it). Returns the stored value. */
export function unlockAllLevels(unlock: (index: number) => number = unlockLevel): number {
  return unlock(ADVENTURE_LEVELS);
}
