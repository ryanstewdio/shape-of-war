// Release polish contract stub (Fable, 2026-11-02): the difficulty choice. Ledger stores and shows
// the setting, Forge applies it to the simulation, Swarm scales bosses with it. Starting values;
// Forge and Swarm may tune the numbers but not the names or the shape. Pure data, no PRNG.
export type Difficulty = 'easy' | 'normal' | 'hard' | 'insane';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'insane'];

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
  /** R1 stub: multiplier on boss minion counts (Swarm). */
  readonly addScale: number;
  /** R1 stub: multiplier on open drum drift speed (Forge). */
  readonly driftScale: number;
  /** R5 stub: multiplier on the level's maxLiveEnemies cap, so Insane peaks reach Free Play Swarm density (Forge). */
  readonly liveCapScale: number;
  /** R6 stub: multiplier on par and the three star targets for this difficulty (Foundry calibrates, Ledger applies). */
  readonly parScale: number;
}

export const DIFFICULTY: Readonly<Record<Difficulty, DifficultyTable>> = Object.freeze({
  easy: { enemySpeed: 0.8, enemyHp: 0.75, spawnRate: 0.87, bossScale: 0.55, extraLives: 2, addScale: 0.75, driftScale: 0.7, liveCapScale: 0.9, parScale: 0.8 },
  normal: { enemySpeed: 1, enemyHp: 1, spawnRate: 1, bossScale: 1, extraLives: 0, addScale: 1, driftScale: 1, liveCapScale: 1, parScale: 1 },
  hard: { enemySpeed: 1.15, enemyHp: 1.3, spawnRate: 1.15, bossScale: 1.35, extraLives: -1, addScale: 1.25, driftScale: 1.3, liveCapScale: 1.15, parScale: 1.15 },
  // T3 (Ryan): Easy bossScale 0.65 to 0.55, so the early bosses are softer on Easy.
  // R1 (Ryan): Insane is 20 percent harder than Hard. R5 (Ryan): spawn density steps of about 15 percent.
  // R6 (Foundry): parScale is the scripted strong run's mean score over Normal's on levels 1 to 40
  // of seeds 1 and 1000 (tests/game/parCalibration.test.ts): easy 0.808, hard 1.165, insane 1.317.
  insane: { enemySpeed: 1.38, enemyHp: 1.56, spawnRate: 1.32, bossScale: 1.62, extraLives: -1, addScale: 1.6, driftScale: 1.6, liveCapScale: 1.6, parScale: 1.3 },
});
