// R3 (Ryan, build a4d6be6): "Free Play ended as soon as it started". The run build, the snapshot
// the fallback end check reads and the Free Play result live here so main.ts and a test drive the
// same code. The sim runs the Free Play EndlessDef through createEndlessGame; the UI reads a
// LevelDef built by endlessLevel from the same Free Play segments, whose survive objective never
// comes due, so only the sim's lives rule (game:over in endless mode) ends the run.
import type { Difficulty } from '../core/difficulty';
import type { SpaceLevelSetting } from '../core/settings';
import { createEndlessGame, gameState, objectiveClock, type GameOptions } from '../game/game';
import { scoreOf } from '../game/scoring';
import type { World } from '../game/world';
import { levelHash } from '../levelgen/generator';
import { freePlayLevel, freePlaySegment } from '../levelgen/freeplay';
import type { EndlessDef, LevelDef } from '../levelgen/leveldef';
import { endlessLevel } from './endless';
import type { LevelResult } from './flow';
import type { FreePlayChoice } from './freePlay';
import type { ObjectiveSnapshot } from './objective';

export interface FreePlayRun {
  /** The Free Play EndlessDef the sim runs. */
  readonly def: EndlessDef;
  /** The LevelDef the UI reads (objective, arena, end check). */
  readonly level: LevelDef;
  readonly world: World;
  readonly hash: string;
}

/** Pure: the UI level for a Free Play def, its waves laid out from the Free Play segments. */
export function freePlayUiLevel(def: EndlessDef, seed: number): LevelDef {
  return endlessLevel({ generateEndless: () => def, generateEndlessSegment: (_seed, seg) => freePlaySegment(def, seg) }, seed);
}

/** Build a Free Play run: the def from the choice and seed, the sim world and the UI level. */
export function buildFreePlayRun(choice: FreePlayChoice, seed: number, opts: Omit<GameOptions, 'mode'> = {}): FreePlayRun {
  const def = freePlayLevel({ arena: choice.arena, barriers: choice.barriers, seed });
  const world = createEndlessGame(def, (seg) => freePlaySegment(def, seg), opts); // spawns follow the chosen arena
  return { def, level: freePlayUiLevel(def, seed), world, hash: levelHash(def) };
}

/** The objective snapshot of a world: the wave clock, score, kills and lives (B16). */
export function snapshotOf(w: World): ObjectiveSnapshot {
  const s = scoreOf(w);
  const lives = gameState(w).lives;
  return { elapsedSec: objectiveClock(w), score: s.score, kills: s.kills, lives: Number.isFinite(lives) ? lives : null };
}

export interface FreePlayEnd {
  score: number;
  difficulty: Difficulty;
  hash: string;
  space: SpaceLevelSetting;
  timeSec: number;
  arena: string;
}

/** Pure: the Free Play result: score and time, no stars, no par, no best. */
export function freePlayResult(e: FreePlayEnd): LevelResult {
  return {
    mode: 'freeplay',
    levelIndex: 1,
    score: e.score,
    stars: 0,
    success: false,
    difficulty: e.difficulty,
    par: 0,
    best: 0,
    newBest: false,
    hash: e.hash,
    space: e.space,
    timeSec: e.timeSec,
    arena: e.arena,
  };
}
