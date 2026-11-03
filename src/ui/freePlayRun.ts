// R3 (Ryan, build a4d6be6): "Free Play ended as soon as it started". The run build, the snapshot
// the fallback end check reads and the Free Play result live here so main.ts and a test drive the
// same code. The sim runs the Free Play EndlessDef through createEndlessGame; the UI reads a
// LevelDef built by endlessLevel from the same Free Play segments, whose survive objective never
// comes due, so only the sim's lives rule (game:over in endless mode) ends the run.
import type { Difficulty } from '../core/difficulty';
import type { FreePlayConfig, FreePlayLength } from '../core/freeplayConfig';
import type { SpaceLevelSetting } from '../core/settings';
import { createEndlessGame, gameState, objectiveClock, type GameOptions } from '../game/game';
import { scoreOf } from '../game/scoring';
import type { World } from '../game/world';
import { levelHash } from '../levelgen/generator';
import { freePlayLevel, freePlaySegment, type FreePlayOptions } from '../levelgen/freeplay';
import type { EndlessDef, LevelDef } from '../levelgen/leveldef';
import { endlessLevel } from './endless';
import { formatClock } from './format';
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

/**
 * Free Play options (docs/14). Foundry adds FreePlayOptions.config and Forge adds
 * GameOptions.freePlay in parallel branches; until both land these typed shapes carry the config,
 * and once they do the intersections collapse to the real fields.
 */
export type FreePlayLevelOptions = FreePlayOptions & { readonly config: FreePlayConfig };
export type FreePlayGameOptions = Omit<GameOptions, 'mode'> & { freePlay?: FreePlayConfig };

/** Pure: the options freePlayLevel gets for a choice and seed. */
export function freePlayLevelOptions(choice: FreePlayChoice, seed: number): FreePlayLevelOptions {
  return { arena: choice.arena, barriers: choice.barriers, seed, config: choice.config };
}

/** Pure: the world options with the choice's config as GameOptions.freePlay. */
export function freePlayGameOptions(choice: FreePlayChoice, opts: Omit<GameOptions, 'mode'> = {}): FreePlayGameOptions {
  return { ...opts, freePlay: choice.config };
}

/** Build a Free Play run: the def from the choice and seed, the sim world and the UI level. */
export function buildFreePlayRun(choice: FreePlayChoice, seed: number, opts: Omit<GameOptions, 'mode'> = {}): FreePlayRun {
  const levelOpts: FreePlayOptions = freePlayLevelOptions(choice, seed);
  const def = freePlayLevel(levelOpts);
  const gameOpts: Omit<GameOptions, 'mode'> = freePlayGameOptions(choice, opts);
  const world = createEndlessGame(def, (seg) => freePlaySegment(def, seg), gameOpts); // spawns follow the chosen arena
  return { def, level: freePlayUiLevel(def, seed), world, hash: levelHash(def) };
}

/**
 * Pure: the HUD line of a Free Play run. Endless shows the run clock; a score attack shows the
 * time left ("Free Play  Circle  2:41 left"), read from the chosen length and the sim clock.
 */
export function freePlayLine(arena: string, length: FreePlayLength, timeSec: number): string {
  if (length === 'endless') return `Free Play  ${arena}  ${formatClock(timeSec)}`;
  return `Free Play  ${arena}  ${formatClock(Math.max(0, length - timeSec))} left`;
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
  /** The run length chosen; a timed length shows as "Score attack 5:00" on the results. */
  length?: FreePlayLength;
  /** True when the sim ended the run as won (a score attack whose clock ran out). */
  won?: boolean;
}

/** Pure: the Free Play result: score and time, no stars, no par, no best. */
export function freePlayResult(e: FreePlayEnd): LevelResult {
  return {
    mode: 'freeplay',
    levelIndex: 1,
    score: e.score,
    stars: 0,
    success: e.won === true,
    difficulty: e.difficulty,
    par: 0,
    best: 0,
    newBest: false,
    hash: e.hash,
    space: e.space,
    timeSec: e.timeSec,
    arena: e.arena,
    ...(e.length === undefined || e.length === 'endless' ? {} : { scoreAttackSec: e.length }),
  };
}
