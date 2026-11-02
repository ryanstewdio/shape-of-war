// Release polish contract stub (Fable): read the run's difficulty from a world. Forge replaces the
// body so it returns the table chosen in GameOptions.difficulty; until then every run is normal.
import { DIFFICULTY, type DifficultyTable } from '../core/difficulty';
import type { World } from './world';

/** The difficulty table of this run (normal until Forge wires GameOptions.difficulty). */
export function difficultyOf(_w: World): DifficultyTable {
  return DIFFICULTY.normal;
}
