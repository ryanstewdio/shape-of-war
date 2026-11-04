// Release gate R2: Free Play. An Endless style run where the player picks the arena (rect,
// circle or a cylinder drum) and whether it has barriers. The waves are the normal Endless
// segments and roster; only the spawn points are laid out on the chosen arena (freePlaySegment).
// Pure and deterministic: every draw comes from one stream seeded from o.seed, re-derived with
// attemptSeed on a failed validation, and the attempt count is recorded in freePlay.retries.
//
// Free Play options (docs/14), the level side: an optional FreePlayConfig picks the enemy kinds,
// density, bosses, wells and arena size. Without one the run is today's Free Play, byte for byte.
// With one the def stores its level side in freePlay.options, which freePlaySegment reads.
import { mulberry32, rngInt, rngPick, streamSeed } from '../core/rng';
import type { Rng } from '../core/rng';
import type { FreePlayConfig, FreePlaySize } from '../core/freeplayConfig';
import { freePlayBossFor } from './boss';
import { canonX, cylDist, cylObstacleDistance, insideRims } from './cylinder';
import { applyDrumPattern } from './drum';
import { attemptSeed, endlessSegmentOn, generateEndless, placeObstacles } from './generator';
import type { SegmentTweaks } from './generator';
import { BANDS, DEFAULT_GEN_CONFIG, GENERATOR_VERSION_V7, MAX_RETRIES, bandOf, deepFreeze, effectiveIndexOf } from './leveldef';
import type { ArenaDef, EndlessDef, EndlessSegmentDef, FreePlayArena, FreePlayInfo, FreePlayLevelOptions, GenConfig, RosterEntry, Vec2 } from './leveldef';
import { ALL_ENEMY_KINDS } from './v2enemies';
import {
  FREE_PLAY_DENSITY_SCALE,
  FREE_PLAY_WELL_PAIR,
  FREE_PLAY_WELL_SPAWN_CLEAR,
  MAX_OBSTACLES,
  WELL_EDGE,
  WELL_OBSTACLE,
  freePlayArenaSize,
  freePlayMaxLive,
  freePlaySnakeAllowed,
  freePlayWellRange,
  insideArena,
  obstaclePointDistance,
  validateFreePlay,
} from './validate';

export type { FreePlayArena } from './leveldef';

export interface FreePlayOptions {
  readonly arena: FreePlayArena;
  /** Obstacles on (rect and circle: pillars; drum: rings or pillars). */
  readonly barriers: boolean;
  readonly seed: number;
  /** Free Play options (docs/14). Absent: today's Free Play. Only the level side is read here. */
  readonly config?: FreePlayConfig;
}

/** Salt of the Free Play wells stream. ASCII "FPWL". */
export const FREE_PLAY_WELLS_SALT = 0x4650574c;
/** Placement tries per well. */
export const FREE_PLAY_WELL_ATTEMPTS = 60;
/**
 * Wells 'many': the game's arrival gaps times this (more often). Read by the game side
 * (src/game/wellArrival.ts) from def.freePlay.options.wells; levelgen only exports it.
 */
export const FREE_PLAY_ARRIVAL_GAP_SCALE = 0.5;

/** Salt of the Free Play arena stream. ASCII "FREE". */
export const FREE_PLAY_SALT = 0x46524545;
/** Drum size: the Endless arena, whose width 1600 is 25 x 64. */
export const FREE_PLAY_DRUM: Readonly<{ width: number; height: number }> = Object.freeze({ width: 1600, height: 1000 });
/** Fewest barriers on a rect or circle with barriers on (the most is MAX_OBSTACLES). */
export const FREE_PLAY_MIN_OBSTACLES = 2;
/** Drum barrier layouts, equally likely. */
export const FREE_PLAY_DRUM_PATTERNS = ['rings', 'pillars'] as const;

function baseArena(kind: FreePlayArena, sizeOpt: FreePlaySize): ArenaDef {
  const size = freePlayArenaSize(kind, sizeOpt);
  return { shape: kind === 'circle' ? 'circle' : 'rect', width: size.width, height: size.height, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };
}

/**
 * The arena of one attempt. Draws: none with barriers off. Rect and circle: the count, then the
 * flat placement (placeObstacles). Drum: the pattern, then its layout (drum.ts, no membranes).
 */
export function freePlayArena(r: Rng, kind: FreePlayArena, barriers: boolean, size: FreePlaySize = 'medium'): { arena: ArenaDef; drumPattern: FreePlayInfo['drumPattern'] } {
  const base = baseArena(kind, size);
  if (!barriers) return { arena: base, drumPattern: null };
  if (kind === 'drum') {
    const pattern = rngPick(r, FREE_PLAY_DRUM_PATTERNS);
    return { arena: applyDrumPattern(base, pattern, r, false, true), drumPattern: pattern };
  }
  const obstacles = placeObstacles(r, base, rngInt(r, FREE_PLAY_MIN_OBSTACLES, MAX_OBSTACLES));
  return { arena: { ...base, shape: kind === 'rect' ? 'rectObstacles' : 'circle', obstacles }, drumPattern: null };
}

/**
 * The level side of a config, as stored on the def: chosen kinds in ALL_ENEMY_KINDS order, kept
 * only when the run's catalogue has them (a GenConfig may cut snakes or the v2 kinds).
 */
export function levelOptionsOf(config: FreePlayConfig, catalogue: readonly RosterEntry[]): FreePlayLevelOptions {
  const have = new Set(catalogue.map((e) => e.kind));
  const enemies = ALL_ENEMY_KINDS.filter((k) => config.enemies.includes(k) && have.has(k));
  return { enemies, density: config.density, bosses: config.bosses, wells: config.wells, size: config.size };
}

/**
 * Free Play wells: range.min to range.max wells (freePlayWellRange: 'normal' 1 to 2, 'many' 2 to
 * 4). Draws: the count, then per well up to FREE_PLAY_WELL_ATTEMPTS points (u then v on a drum, x
 * then y flat); stops at the first well with no valid point. The rules are validate.ts FP4.
 */
export function placeFreePlayWells(r: Rng, arena: ArenaDef, cyl: boolean, range: Readonly<{ min: number; max: number }>): Vec2[] {
  const W = arena.width;
  const H = arena.height;
  const dist = (a: Vec2, b: Vec2): number => (cyl ? cylDist(a, b, W) : Math.hypot(a.x - b.x, a.y - b.y));
  const inside = (p: Vec2): boolean => (cyl ? insideRims(arena, p, WELL_EDGE) : insideArena(arena, p, WELL_EDGE));
  const obstacle = (p: Vec2): number => Math.min(Infinity, ...arena.obstacles.map((o) => (cyl ? cylObstacleDistance(o, p, W) : obstaclePointDistance(o, p))));
  const r1 = (v: number): number => Math.round(v * 10) / 10 + 0;
  const wells: Vec2[] = [];
  const n = rngInt(r, range.min, range.max);
  for (let i = 0; i < n; i++) {
    let placed = false;
    for (let a = 0; a < FREE_PLAY_WELL_ATTEMPTS && !placed; a++) {
      const x = W * r() - W / 2;
      const y = H * r() - H / 2;
      const p = { x: cyl ? r1(canonX(r1(x), W)) : r1(x), y: r1(y) };
      if (!inside(p) || dist(p, arena.spawnPoint) < FREE_PLAY_WELL_SPAWN_CLEAR || obstacle(p) < WELL_OBSTACLE) continue;
      if (wells.some((w) => dist(w, p) < FREE_PLAY_WELL_PAIR)) continue;
      wells.push(p);
      placed = true;
    }
    if (!placed) break;
  }
  return wells;
}

function buildFreePlay(o: FreePlayOptions, attempt: number, cfg: GenConfig): EndlessDef {
  const seed = o.seed >>> 0;
  const s = attemptSeed(seed, attempt);
  const endless = generateEndless(seed, cfg);
  const options = o.config === undefined ? null : levelOptionsOf(o.config, endless.roster);
  const { arena, drumPattern } = freePlayArena(mulberry32(streamSeed(s, FREE_PLAY_SALT)), o.arena, o.barriers, options?.size ?? 'medium');
  const cyl = o.arena === 'drum';
  const range = options === null ? null : freePlayWellRange(options.wells);
  const wells = range === null ? [] : placeFreePlayWells(mulberry32(streamSeed(s, FREE_PLAY_WELLS_SALT)), arena, cyl, range);
  const freePlay: FreePlayInfo = { arena: o.arena, barriers: o.barriers, drumPattern, retries: attempt, ...(options === null ? {} : { options }) };
  return {
    ...endless,
    generatorVersion: GENERATOR_VERSION_V7,
    surface: cyl ? 'cylinder' : 'flat',
    arena,
    roster: endless.roster.map((e) => ({ ...e })),
    hazards: { wells, spawners: [] },
    freePlay,
  };
}

/**
 * The Free Play run for these options: an Endless run (createEndlessGame) on the chosen arena,
 * version 7. Re-derives with attemptSeed(seed, k), k 1 to MAX_RETRIES, until validateFreePlay
 * passes; the last attempt is returned if none does. Waves: freePlaySegment(def, s).
 */
export function freePlayLevel(o: FreePlayOptions, cfg: GenConfig = DEFAULT_GEN_CONFIG): EndlessDef {
  let def = buildFreePlay(o, 0, cfg);
  for (let k = 1; k <= MAX_RETRIES && !validateFreePlay(def).ok; k++) def = buildFreePlay(o, k, cfg);
  return deepFreeze(def);
}

/**
 * Segment s of a Free Play run: the normal Endless segment (roster, budget, ramp, boss) with the
 * spawn points laid out on the def's arena, wrapped on a drum. On the plain rect it equals
 * generateEndlessSegment(def.endlessSeed, s). Wiring passes (s) => freePlaySegment(def, s).
 */
export function freePlaySegment(def: EndlessDef, segment: number, cfg: GenConfig = DEFAULT_GEN_CONFIG): EndlessSegmentDef {
  const cyl = def.surface === 'cylinder';
  const options = def.freePlay?.options;
  if (options === undefined) return endlessSegmentOn(def.endlessSeed, segment, cfg, def.arena, cyl);
  return endlessSegmentOn(def.endlessSeed, segment, cfg, def.arena, cyl, segmentTweaks(def, options, segment, cfg));
}

/**
 * The options as segment tweaks. Enemies: the chosen kinds with their catalogue weights (none
 * chosen: the drawn roster and v2 stage). Density: the wave budget scale, Swarm also raising
 * maxLiveEnemies. Bosses: freePlayBossFor, none with the boss flag off. Snakes (R5): with the
 * snake allowed by the enemy toggles, whatever the wells, the snake floor (withFreePlaySnakes). No draw.
 */
export function segmentTweaks(def: EndlessDef, options: FreePlayLevelOptions, segment: number, cfg: GenConfig = DEFAULT_GEN_CONFIG): SegmentTweaks {
  const weight = (k: string): number => def.roster.find((e) => e.kind === k)?.weight ?? 1;
  const band = bandOf(effectiveIndexOf(segment));
  return {
    ...(options.enemies.length > 0 ? { roster: options.enemies.map((kind) => ({ kind, weight: weight(kind) })) } : {}),
    ...(options.density !== 'normal' ? { budgetScale: FREE_PLAY_DENSITY_SCALE[options.density] } : {}),
    ...(options.density === 'swarm' ? { maxLiveEnemies: freePlayMaxLive(BANDS[band].maxLiveEnemies, 'swarm') } : {}),
    boss: cfg.enableBosses ? freePlayBossFor(options.bosses, segment, def.surface === 'cylinder') : null,
    ...(freePlaySnakeAllowed(options, def.roster) ? { snakeWeight: weight('snake') } : {}),
  };
}
