// Release polish contract stub (Fable, 2026-11-02): the difficulty choice. Ledger stores and shows
// the setting, Forge applies it to the simulation, Swarm scales bosses with it. Starting values;
// Forge and Swarm may tune the numbers but not the names or the shape. Pure data, no PRNG.
export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export interface DifficultyTable {
  /** Multiplier on enemy move speed. */
  readonly enemySpeed: number;
  /** Multiplier on enemy hit points. */
  readonly enemyHp: number;
  /** Multiplier on wave spawn counts. */
  readonly spawnRate: number;
  /** Multiplier on boss hit points and attack cadence (Swarm applies both). */
  readonly bossScale: number;
  /** Extra lives added to the level's starting lives (may be negative). */
  readonly extraLives: number;
}

export const DIFFICULTY: Readonly<Record<Difficulty, DifficultyTable>> = Object.freeze({
  easy: { enemySpeed: 0.8, enemyHp: 0.75, spawnRate: 0.75, bossScale: 0.65, extraLives: 2 },
  normal: { enemySpeed: 1, enemyHp: 1, spawnRate: 1, bossScale: 1, extraLives: 0 },
  hard: { enemySpeed: 1.15, enemyHp: 1.3, spawnRate: 1.25, bossScale: 1.35, extraLives: -1 },
});
