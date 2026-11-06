// Seeded level generator, docs/02-level-generator.md sections 5 to 10. Pure and deterministic:
// no Date, no Math.random, no DOM. Every random draw comes from a mulberry32 stream seeded from
// deriveSeed(runSeed, levelIndex) through one salt per stage, so one stage's draw count never
// shifts another's. Draw order inside each stage is fixed: never reorder draws without a
// GENERATOR_VERSION bump.
import { deriveSeed, fmix32, mulberry32, rngInt, rngPick, streamSeed } from '../core/rng';
import type { Rng } from '../core/rng';
import {
  ARENA_SHAPES,
  BANDS,
  DEFAULT_GEN_CONFIG,
  DRONE_KINDS,
  ENDLESS_ARENA,
  ENDLESS_BAND4_SEGMENT,
  ENDLESS_BUDGET_PER_SEGMENT,
  ENDLESS_SEGMENT_SEC,
  ENEMY_BASE,
  ENEMY_GEOMS,
  ENEMY_KINDS,
  GENERATOR_VERSION,
  GENERATOR_VERSION_V2,
  GENERATOR_VERSION_V3,
  GENERATOR_VERSION_V4,
  GENERATOR_VERSION_V5,
  GENERATOR_VERSION_V6,
  GENERATOR_VERSION_V7,
  GENERATOR_VERSION_V8,
  LEVELDEF_VERSION,
  LONG_BANDS,
  LONG_BREATHER_SEC,
  LONG_CALM_SEC,
  LONG_MIN_REPEAT_SEC,
  LONG_SCHEDULE_PAD_SEC,
  MAX_RETRIES,
  SUPER_KINDS,
  bandOf,
  deepFreeze,
  effectiveIndexOf,
  expandSpawns,
  forEachSpawn,
  longBandParams,
  round1,
  round2,
  r3BandParams,
  r3ObjectiveTable,
  runsR1,
  runsR3,
  segmentSeed,
  speedScaleFor,
} from './leveldef';
import type {
  ArenaDef,
  Band,
  BandParams,
  BossSpec,
  EndlessDef,
  EndlessSegmentDef,
  EnemyKind,
  GenConfig,
  GravityWellDef,
  HazardDef,
  LevelDef,
  LongBandParams,
  ObjectiveDef,
  Obstacle,
  RosterEntry,
  SpawnEntry,
  SpawnPattern,
  SpawnerDef,
  Vec2,
  WaveDef,
  WaveSchedule,
} from './leveldef';
import {
  ARENA_MAX_ASPECT,
  ARENA_MAX_WIDTH,
  ARENA_MIN_ASPECT,
  BOMBS,
  ENTRY_EDGE_MARGIN,
  ENTRY_OBSTACLE_CLEAR,
  ENTRY_SPAWN_CLEAR,
  FIRST_WAVE_SEC,
  HEX_ASPECT,
  HEX_COS30,
  KILL_RATE,
  LIVES,
  MAX_EST_SEC,
  OBSTACLE_EDGE_GAP,
  OBSTACLE_PAIR_GAP,
  OBSTACLE_SPAWN_CLEAR,
  PAR_MIN,
  PAR_STEP,
  SPAWNER_EDGE,
  SPAWNER_OBSTACLE,
  SPAWNER_SPAWN_WIDTH_FRACTION,
  SPAWNER_WELL,
  WELL_EDGE,
  WELL_OBSTACLE,
  WELL_PAIR,
  WELL_SPAWN_FLOOR,
  WELL_SPAWN_WIDTH_FRACTION,
  inscribedRadius,
  insideArena,
  isArenaConnected,
  obstacleCorners,
  obstacleGap,
  obstaclePointDistance,
  validateLevel,
  FREE_PLAY_SNAKES_PER_SEGMENT,
  FREE_PLAY_SNAKE_FROM_SEGMENT,
} from './validate';
import { BOSS_LEVEL_AT_SEC, BOSS_LONG_LEVEL_AT_SEC, BOSS_R3_LEVEL_AT_SEC, BOSS_V5_LEVEL_AT_SEC, bossForLevel, bossForSegment, bossHazards } from './boss';
import { R3_COLLECT_RATE, bossLevelPar, destroyCountFor, inBreather, pulseAt, wholeLevelPar } from './pacing';
import type { PulseShape } from './pacing';
import {
  CYLINDER_CHANCE,
  R1_CYLINDER_CHANCE,
  SURFACE_SALT,
  canonX,
  cylDist,
  cylFarthest,
  cylObstacleDistance,
  cylinderEligible,
  cylinderWidth,
  insideRims,
  roundCanonX,
} from './cylinder';
import type { SurfaceKind } from '../core/surface';
import { applyDrumPattern, pickDrumPattern } from './drum';
import type { DrumPattern } from './drum';
import { ALL_ENEMY_KINDS, V2_ENEMY_SALT, V2_SPAWN_UNIT, isV2Kind, planV2Roster, swapGroupKind, v2GroupCount } from './v2enemies';
import { LEAVER_SALT, LEAVER_SPAWN_COST, leaverGroupCount, leaverJoins, leaverLevelWeight, leaverOn, leaverSegmentWeight, leaverSwapChance, rosterWithLeaver } from './leaver';

/** Stage salts, docs/02 section 2. */
export const SALT = {
  arena: 0xa511e9b3,
  roster: 0x63d83595,
  loadout: 0x2545f491,
  objective: 0x1b873593,
  waves: 0xcc9e2d51,
  hazards: 0x27d4eb2f,
} as const;

/** Mixed into the level seed for re-derive k >= 1. ASCII "RTRY". */
export const RETRY_SALT = 0x52545259;

// Tuning constants, docs/02 sections 6 to 9.
const OBSTACLE_THICK = 24;
const OBSTACLE_MIN_LEN = 160;
const OBSTACLE_MAX_LEN_FRACTION = 0.3;
const OBSTACLE_ATTEMPTS = 40;
const SPAWN_COST: Record<EnemyKind, number> = {
  grunt: 1,
  wanderer: 1,
  pinwheel: 1,
  weaver: 2,
  dart: 4,
  snake: 6,
  // V2 kinds: 1 unit each (docs/11 section 6.2). The v1 wave pass never sees them; the v2 stage
  // spends a substituted group's whole budget at this cost.
  charger: V2_SPAWN_UNIT,
  bulwark: V2_SPAWN_UNIT,
  blink: V2_SPAWN_UNIT,
  swirl: V2_SPAWN_UNIT,
  sower: V2_SPAWN_UNIT,
  splime: V2_SPAWN_UNIT,
  // Leaver: the Weaver's cost. Only the Leaver stage and Free Play rosters name it.
  leaver: LEAVER_SPAWN_COST,
};
const SNAKE_WINDOW_SEC = 30;
const GROUP_START_STEP_SEC = 0.5;
const ENTRY_STEP_SEC = 0.15;
/** Largest in-group spread: with group start at most 1.0 s, offsets stay under W6's 5 s. */
const MAX_GROUP_SPREAD_SEC = 3.5;
const EDGE_INSET = 60;
const EDGE_SPREAD = 40;
const CORNER_INSET = 80;
const ROUND_CORNER_DIAG = 0.7071068;
const POLAR_CORNER_FRACTION = 0.85;
const CLUSTER_JITTER = 40;
/** Cluster anchors sit further in so jittered darts keep W4's 40 u edge margin. */
const CLUSTER_INSET = EDGE_INSET + CLUSTER_JITTER;
const POINT_REDRAWS = 20;
const FALLBACK_RING_RADIUS = 300;
const RING_RADIUS_MIN = 260;
const RING_RADIUS_MAX = 340;
const WELL_ATTEMPTS = 60;
const SPAWNER_ATTEMPTS = 40;
const GEOM_RATE_PER_KILL = 0.1; // docs/02 section 8 step 6: mAvg = 1 + 0.1 x gAvg x K
const PAR_SCALE = 0.5;
const TARGET_FRACTION = 0.8;
const ENDLESS_EXTRA_LIFE_EVERY = 100_000;
const ENDLESS_EXTRA_BOMB_EVERY = 150_000;
const ENDLESS_MAX_LIVES = 9;
const ENDLESS_MAX_BOMBS = 9;

const OBJECTIVE_KINDS = ['scoreInTime', 'survive', 'destroy'] as const;
const SPAWN_ORIGIN: Readonly<Vec2> = Object.freeze({ x: 0, y: 0 });

// Draw helpers over a core Rng.

const range = (r: Rng, lo: number, hi: number): number => lo + (hi - lo) * r();
const intStep = (r: Rng, lo: number, hi: number, step: number): number => lo + step * rngInt(r, 0, Math.floor((hi - lo) / step));
const chance = (r: Rng, p: number): boolean => r() < p;
// "+ 0" turns -0 into 0: JSON drops the sign and J1 compares with Object.is.
const roundTo = (v: number, step: number): number => Math.round(v / step) * step + 0;
const r1 = (v: number): number => round1(v) + 0;
const stream = (seed: number, salt: number): Rng => mulberry32(streamSeed(seed, salt));

function weightedKey<K extends string>(r: Rng, keys: readonly K[], weights: Readonly<Record<K, number>>): K {
  return rngPick(r, keys, keys.map((k) => weights[k]));
}

/** Weighted pick restricted to allowed keys. No draw when nothing allowed has weight. */
function pickAllowed<K extends string>(r: Rng, keys: readonly K[], weights: Readonly<Record<K, number>>, allowed: readonly K[], fallback: K): K {
  const ws = keys.map((k) => (allowed.includes(k) ? weights[k] : 0));
  if (ws.reduce((a, b) => a + b, 0) <= 0) return allowed[0] ?? fallback;
  return rngPick(r, keys, ws);
}

// Arena, docs/02 section 6.

/** Draws: shape, height, aspect (rect family) or none, corner radius (roundRect), then obstacles. */
export function generateArena(r: Rng, band: Band): ArenaDef {
  const b = BANDS[band];
  const shape = weightedKey(r, ARENA_SHAPES, b.shapeWeights);
  const height = intStep(r, b.arenaHeight.min, b.arenaHeight.max, 20);
  let width: number;
  if (shape === 'circle') {
    width = height;
  } else if (shape === 'hexagon') {
    width = round1(height * HEX_ASPECT);
  } else {
    width = Math.min(ARENA_MAX_WIDTH, roundTo(height * range(r, b.aspect.min, b.aspect.max), 20));
    // Rounding up to 20 can overshoot A1's 1.8 aspect at the top of band 4.
    while (width / height > ARENA_MAX_ASPECT) width -= 20;
  }
  const cornerRadius = shape === 'roundRect' ? round1(range(r, 0.15, 0.3) * height) : 0;
  const base: ArenaDef = { shape, width, height, cornerRadius, obstacles: [], spawnPoint: { x: 0, y: 0 } };
  if (shape !== 'rectObstacles') return base;
  const obstacles = placeObstacles(r, base, rngInt(r, b.obstacleCount.min, b.obstacleCount.max));
  return obstacles.length === 0 ? { ...base, shape: 'rect' } : { ...base, obstacles };
}

/**
 * D13 cylinder arena, on the arena stream of a cylinder level only (flat levels never reach it).
 * Draws: shape among rect and rectObstacles (band weights), height, aspect, then obstacles. The
 * width snaps to a multiple of 64 u inside the size bounds before any obstacle is placed.
 * Obstacles keep the flat placement rules, so none crosses the u seam.
 */
export function generateCylinderArena(r: Rng, band: Band): ArenaDef {
  const b = BANDS[band];
  const shapes = ['rect', 'rectObstacles'] as const;
  const shape = rngPick(r, shapes, shapes.map((k) => b.shapeWeights[k]));
  const height = intStep(r, b.arenaHeight.min, b.arenaHeight.max, 20);
  const raw = roundTo(height * range(r, b.aspect.min, b.aspect.max), 20);
  const width = cylinderWidth(raw, height, ARENA_MAX_WIDTH, ARENA_MIN_ASPECT, ARENA_MAX_ASPECT);
  const base: ArenaDef = { shape, width, height, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };
  if (shape !== 'rectObstacles') return base;
  const obstacles = placeObstacles(r, base, rngInt(r, b.obstacleCount.min, b.obstacleCount.max));
  return obstacles.length === 0 ? { ...base, shape: 'rect' } : { ...base, obstacles };
}

/**
 * D13 surface draw: one draw from mulberry32(deriveSeed(seed, SURFACE_SALT)), its own stream, so
 * no other stage moves. Flag off, levels 1 to 10 and boss levels: 'flat' with no draw. seed is the
 * level seed (not the retry seed), so a re-derive keeps the surface.
 */
export function pickSurface(seed: number, levelIndex: number, cfg: GenConfig): SurfaceKind {
  if (!cfg.enableCylinder || !cylinderEligible(levelIndex)) return 'flat';
  return chance(mulberry32(deriveSeed(seed, SURFACE_SALT)), runsR1(cfg) ? R1_CYLINDER_CHANCE : CYLINDER_CHANCE) ? 'cylinder' : 'flat';
}

/**
 * The surface stream positioned after its cylinder draw, with the drum pattern drawn next. Null
 * for a flat level (no draw beyond pickSurface's). Layout draws continue on the returned stream.
 */
function drumDraw(seed: number, levelIndex: number, cfg: GenConfig): { pattern: DrumPattern; r: Rng } | null {
  if (pickSurface(seed, levelIndex, cfg) !== 'cylinder') return null;
  const r = mulberry32(deriveSeed(seed, SURFACE_SALT));
  r();
  return { pattern: pickDrumPattern(r), r };
}

/** Drum layout of level n (seed is the level seed): a DrumPattern on a cylinder level, else null. */
export function drumPatternFor(seed: number, levelIndex: number, cfg: GenConfig = DEFAULT_GEN_CONFIG): DrumPattern | null {
  return drumDraw(seed, levelIndex, cfg)?.pattern ?? null;
}

/**
 * Cylinder arena of a level: the C0 arena from the arena stream (height, width, open drum
 * obstacles), then the drum pattern laid out from the surface stream. seed is the level seed, so a
 * re-derive keeps the pattern and its draws while the arena stream redraws the size.
 */
function cylinderArena(seed: number, levelIndex: number, cfg: GenConfig, arenaRng: Rng, band: Band): ArenaDef {
  const base = generateCylinderArena(arenaRng, band);
  const d = drumDraw(seed, levelIndex, cfg);
  // Release polish: ring membranes ride on the long level flag, drawn after every ring draw.
  // R1: an open drum drops the C0 bars, so it really has no barriers.
  return d === null ? base : applyDrumPattern(base, d.pattern, d.r, cfg.enableLongLevels === true, runsR1(cfg));
}

/** docs/02 section 6.2. Per attempt draws: orientation, length, cx, cy. Stops at the first exhausted obstacle. */
export function placeObstacles(r: Rng, arena: ArenaDef, count: number): Obstacle[] {
  const placed: Obstacle[] = [];
  const hw = arena.width / 2;
  const hh = arena.height / 2;
  for (let i = 0; i < count; i++) {
    let done = false;
    for (let a = 0; a < OBSTACLE_ATTEMPTS && !done; a++) {
      const horizontal = chance(r, 0.5);
      const len = roundTo(range(r, OBSTACLE_MIN_LEN, OBSTACLE_MAX_LEN_FRACTION * arena.width), 10);
      const o: Obstacle = {
        cx: roundTo(range(r, -hw, hw), 10),
        cy: roundTo(range(r, -hh, hh), 10),
        w: horizontal ? len : OBSTACLE_THICK,
        h: horizontal ? OBSTACLE_THICK : len,
      };
      if (!obstacleCorners(o).every((p) => insideArena(arena, p, OBSTACLE_EDGE_GAP))) continue;
      if (obstaclePointDistance(o, arena.spawnPoint) < OBSTACLE_SPAWN_CLEAR) continue;
      if (placed.some((p) => obstacleGap(o, p) < OBSTACLE_PAIR_GAP)) continue;
      if (!isArenaConnected({ ...arena, obstacles: [...placed, o] })) continue;
      placed.push(o);
      done = true;
    }
    if (!done) break;
  }
  return placed;
}

// Roster and loadout, docs/02 section 5 steps 3 to 5.

/** Draws: size, then one weighted pick per non grunt slot. Sorted by ENEMY_KINDS order. */
export function generateRoster(r: Rng, band: Band, cfg: GenConfig): RosterEntry[] {
  const w = BANDS[band].rosterWeights;
  const size = BANDS[band].rosterSize;
  const eligible = ENEMY_KINDS.filter((k) => w[k] > 0 && (k !== 'snake' || cfg.enableSnake));
  const want = Math.min(rngInt(r, size.min, size.max), eligible.length);
  const chosen = new Set<EnemyKind>(['grunt']);
  let pool = eligible.filter((k) => k !== 'grunt');
  while (chosen.size < want && pool.length > 0) {
    const k = rngPick(r, pool, pool.map((p) => w[p]));
    chosen.add(k);
    pool = pool.filter((p) => p !== k);
  }
  return ENEMY_KINDS.filter((k) => chosen.has(k)).map((kind) => ({ kind, weight: w[kind] }));
}

// Objective, docs/02 table 4.3. scoreInTime target is filled after par.

/** Draws: kind, then its one parameter. */
export function generateObjective(r: Rng, b: BandParams): ObjectiveDef {
  const kind = weightedKey(r, OBJECTIVE_KINDS, b.objectiveWeights);
  switch (kind) {
    case 'survive':
      return { kind, durationSec: intStep(r, b.surviveSec.min, b.surviveSec.max, 5) };
    case 'destroy':
      return { kind, count: intStep(r, b.destroyCount.min, b.destroyCount.max, 5) };
    case 'scoreInTime':
      return { kind, target: PAR_MIN, timeLimitSec: intStep(r, b.scoreTimeSec.min, b.scoreTimeSec.max, 15) };
  }
}

/**
 * Long level objective (release polish). Draws: kind (band weights), then its one parameter from
 * LONG_BANDS. destroy draws its target clear second; the count is filled from the waves later
 * (destroyCountFor), so clearSec is returned beside a placeholder count of 0.
 */
export function generateLongObjective(r: Rng, b: BandParams, l: LongBandParams): { objective: ObjectiveDef; clearSec: number } {
  const kind = weightedKey(r, OBJECTIVE_KINDS, b.objectiveWeights);
  switch (kind) {
    case 'survive': {
      const durationSec = intStep(r, l.surviveSec.min, l.surviveSec.max, 5);
      return { objective: { kind, durationSec }, clearSec: durationSec };
    }
    case 'destroy':
      return { objective: { kind, count: 0 }, clearSec: intStep(r, l.destroySec.min, l.destroySec.max, 5) };
    case 'scoreInTime': {
      const timeLimitSec = intStep(r, l.scoreTimeSec.min, l.scoreTimeSec.max, 15);
      return { objective: { kind, target: PAR_MIN, timeLimitSec }, clearSec: timeLimitSec };
    }
  }
}

const objectiveTimeSec = (o: ObjectiveDef): number | null =>
  o.kind === 'survive' ? o.durationSec : o.kind === 'scoreInTime' ? o.timeLimitSec : null;

// Spawn points, docs/02 section 7.1.

function spawnPointOk(arena: ArenaDef, p: Vec2, cyl: boolean): boolean {
  if (cyl) {
    const W = arena.width;
    if (!insideRims(arena, p, ENTRY_EDGE_MARGIN)) return false;
    if (cylDist(p, arena.spawnPoint, W) < ENTRY_SPAWN_CLEAR) return false;
    return arena.obstacles.every((o) => cylObstacleDistance(o, p, W) >= ENTRY_OBSTACLE_CLEAR);
  }
  if (!insideArena(arena, p, ENTRY_EDGE_MARGIN)) return false;
  if (Math.hypot(p.x - arena.spawnPoint.x, p.y - arena.spawnPoint.y) < ENTRY_SPAWN_CLEAR) return false;
  return arena.obstacles.every((o) => obstaclePointDistance(o, p) >= ENTRY_OBSTACLE_CLEAR);
}

const isPolar = (arena: ArenaDef): boolean => arena.shape === 'circle' || arena.shape === 'hexagon';

interface EdgeAnchor {
  p: Vec2;
  /** Unit tangent along the edge. */
  tx: number;
  ty: number;
}

/**
 * Draws: side and position (rect family) or one integer angle (circle, hexagon). Cylinder: rim
 * (top or bottom) and u placed in [0, W), canonicalised; there are no side walls.
 */
function edgeAnchor(r: Rng, arena: ArenaDef, inset: number, cyl: boolean): EdgeAnchor {
  if (cyl) {
    const side = rngInt(r, 0, 1);
    const u = range(r, 0, arena.width);
    const hh = arena.height / 2 - inset;
    return { p: { x: canonX(u - arena.width / 2, arena.width), y: side === 0 ? -hh : hh }, tx: 1, ty: 0 };
  }
  if (isPolar(arena)) {
    const deg = rngInt(r, 0, 359);
    const rad = (deg * Math.PI) / 180;
    const d = inscribedRadius(arena) - inset;
    return { p: { x: d * Math.cos(rad), y: d * Math.sin(rad) }, tx: -Math.sin(rad), ty: Math.cos(rad) };
  }
  const side = rngInt(r, 0, 3);
  const along = range(r, -1, 1);
  const hw = arena.width / 2 - inset;
  const hh = arena.height / 2 - inset;
  if (side < 2) return { p: { x: along * hw, y: side === 0 ? -hh : hh }, tx: 1, ty: 0 };
  return { p: { x: side === 2 ? -hw : hw, y: along * hh }, tx: 0, ty: 1 };
}

/** Four corner spawn points, order (-,-), (+,-), (+,+), (-,+). */
function cornerPoints(arena: ArenaDef): Vec2[] {
  const sx = [-1, 1, 1, -1];
  const sy = [-1, -1, 1, 1];
  let ox: number;
  let oy: number;
  if (isPolar(arena)) {
    // 0.85 of the inscribed radius at 45 degrees: 0.85 x circumradius would leave a hexagon.
    ox = oy = POLAR_CORNER_FRACTION * inscribedRadius(arena) * ROUND_CORNER_DIAG;
  } else if (arena.shape === 'roundRect') {
    // On the corner circle's diagonal, CORNER_INSET in from the rounded wall.
    const rc = arena.cornerRadius;
    ox = arena.width / 2 - rc + (rc - CORNER_INSET) * ROUND_CORNER_DIAG;
    oy = arena.height / 2 - rc + (rc - CORNER_INSET) * ROUND_CORNER_DIAG;
  } else {
    ox = arena.width / 2 - CORNER_INSET;
    oy = arena.height / 2 - CORNER_INSET;
  }
  return sx.map((s, i) => ({ x: r1(s * ox), y: r1((sy[i] ?? 1) * oy) }));
}

const roundPoint = (p: Vec2): Vec2 => ({ x: r1(p.x), y: r1(p.y) });
/** Cylinder: canonical u rounded to 0.1, in the arena range [-W/2, W/2). */
const roundCylPoint = (p: Vec2, width: number): Vec2 => ({ x: roundCanonX(p.x, width), y: r1(p.y) });
const roundAt = (p: Vec2, arena: ArenaDef, cyl: boolean): Vec2 => (cyl ? roundCylPoint(p, arena.width) : roundPoint(p));

/** One fresh candidate for a redraw. Draws as edgeAnchor, or one corner index. */
function redrawPoint(r: Rng, arena: ArenaDef, pattern: SpawnPattern, cyl: boolean): Vec2 {
  if (pattern === 'corners') return cornerPoints(arena)[rngInt(r, 0, 3)] ?? SPAWN_ORIGIN;
  return roundAt(edgeAnchor(r, arena, pattern === 'cluster' ? CLUSTER_INSET : EDGE_INSET, cyl).p, arena, cyl);
}

type Placement = { mode: 'fixed'; p: Vec2 } | { mode: 'ring'; angleDeg: number; radius: number };

/** Valid candidate as is; else up to POINT_REDRAWS redraws; else a ring spawn at 300 u. */
function settle(r: Rng, arena: ArenaDef, pattern: SpawnPattern, candidate: Vec2, cyl: boolean): Placement {
  if (spawnPointOk(arena, candidate, cyl)) return { mode: 'fixed', p: candidate };
  for (let i = 0; i < POINT_REDRAWS; i++) {
    const p = redrawPoint(r, arena, pattern, cyl);
    if (spawnPointOk(arena, p, cyl)) return { mode: 'fixed', p };
  }
  return { mode: 'ring', angleDeg: rngInt(r, 0, 359), radius: FALLBACK_RING_RADIUS };
}

/**
 * Per group draws: pattern geometry first, then per entry any redraws and the heading. cyl: the
 * arena is a cylinder, so edge and cluster points sit on the rims and wrap in u.
 */
function emitGroup(r: Rng, arena: ArenaDef, kind: EnemyKind, count: number, pattern: SpawnPattern, startSec: number, cyl = false): SpawnEntry[] {
  const step = count > 1 ? Math.min(ENTRY_STEP_SEC, MAX_GROUP_SPREAD_SEC / (count - 1)) : 0;
  const placements: Placement[] = [];
  if (pattern === 'ring') {
    const radius = intStep(r, RING_RADIUS_MIN, RING_RADIUS_MAX, 10);
    const start = rngInt(r, 0, 359);
    const stepDeg = Math.round(360 / count);
    for (let k = 0; k < count; k++) placements.push({ mode: 'ring', angleDeg: (start + k * stepDeg) % 360, radius });
  } else if (pattern === 'corners') {
    const corners = cornerPoints(arena);
    const start = rngInt(r, 0, 3);
    for (let k = 0; k < count; k++) placements.push(settle(r, arena, pattern, corners[(start + k) % 4] ?? SPAWN_ORIGIN, cyl));
  } else if (pattern === 'edges') {
    const a = edgeAnchor(r, arena, EDGE_INSET, cyl);
    for (let k = 0; k < count; k++) {
      const off = (k - (count - 1) / 2) * EDGE_SPREAD;
      placements.push(settle(r, arena, pattern, roundAt({ x: a.p.x + a.tx * off, y: a.p.y + a.ty * off }, arena, cyl), cyl));
    }
  } else {
    const a = edgeAnchor(r, arena, CLUSTER_INSET, cyl);
    for (let k = 0; k < count; k++) {
      const jx = range(r, -CLUSTER_JITTER, CLUSTER_JITTER);
      const jy = range(r, -CLUSTER_JITTER, CLUSTER_JITTER);
      placements.push(settle(r, arena, pattern, roundAt({ x: a.p.x + jx, y: a.p.y + jy }, arena, cyl), cyl));
    }
  }
  return placements.map((pl, k) => ({
    kind,
    tOffsetSec: round2(startSec + k * step),
    mode: pl.mode,
    x: pl.mode === 'fixed' ? pl.p.x : 0,
    y: pl.mode === 'fixed' ? pl.p.y : 0,
    angleDeg: pl.mode === 'ring' ? pl.angleDeg : 0,
    radius: pl.mode === 'ring' ? pl.radius : 0,
    headingDeg: kind === 'wanderer' || kind === 'pinwheel' ? rngInt(r, 0, 359) : 0,
  }));
}

/** docs/02 section 7 step 6. Draws one pick for kinds with a choice. */
function patternFor(r: Rng, kind: EnemyKind): SpawnPattern {
  switch (kind) {
    case 'grunt':
      return rngPick(r, ['edges', 'corners', 'ring'] as const);
    case 'wanderer':
      return rngPick(r, ['corners', 'edges'] as const);
    case 'weaver':
      return rngPick(r, ['ring', 'edges'] as const);
    case 'pinwheel':
      return 'edges';
    case 'dart':
      return 'cluster';
    case 'snake':
      return 'corners';
    // V2 kinds: only the v2 enemy stage reaches these, on its own stream.
    case 'charger':
      return rngPick(r, ['edges', 'corners'] as const);
    case 'bulwark':
      return 'edges';
    case 'blink':
      return rngPick(r, ['ring', 'edges'] as const);
    case 'swirl':
      return 'ring';
    case 'sower':
      return rngPick(r, ['edges', 'corners'] as const);
    case 'splime':
      return rngPick(r, ['corners', 'edges'] as const);
    // Leaver: the Weaver's patterns. Only the Leaver stage and Free Play rosters reach it.
    case 'leaver':
      return rngPick(r, ['ring', 'edges'] as const);
  }
}

// V2 enemy stage, docs/10 wave V2-C. See v2enemies.ts for the mechanism.

/**
 * Runs on its own stream after every v1 draw. Swaps the roster, then walks the v1 groups in
 * order: a swapped group is re-emitted (pattern, positions) from the v2 stream at 1 unit per
 * enemy, at the same wave and group start time; a kept group keeps its v1 entries untouched.
 * groups is a side output (no draw): the output groups, for the Leaver stage.
 */
export function applyV2Enemies(
  r: Rng,
  band: Band,
  arena: ArenaDef,
  roster: readonly RosterEntry[],
  list: { waves: readonly WaveDef[]; groups: readonly GroupRec[] },
  cyl = false,
): { roster: RosterEntry[]; waves: WaveDef[]; groups: GroupRec[] } {
  const plan = planV2Roster(r, band, roster, list.groups);
  const entries: SpawnEntry[][] = list.waves.map(() => []);
  const firstPattern: (SpawnPattern | null)[] = list.waves.map(() => null);
  const groups: GroupRec[] = [];
  for (const g of list.groups) {
    const src = list.waves[g.wave];
    const out = entries[g.wave];
    if (src === undefined || out === undefined) continue;
    const kind = swapGroupKind(r, plan, g.kind);
    const first = out.length;
    if (kind === null) {
      out.push(...src.entries.slice(g.first, g.first + g.count));
      groups.push({ ...g, first, count: out.length - first });
      continue;
    }
    const pattern = patternFor(r, kind);
    if (g.first === 0) firstPattern[g.wave] = pattern;
    out.push(...emitGroup(r, arena, kind, v2GroupCount(g.units), pattern, g.startSec, cyl));
    groups.push({ ...g, kind, first, count: out.length - first });
  }
  const waves = list.waves.map((w, i) => ({ ...w, pattern: firstPattern[i] ?? w.pattern, entries: entries[i] ?? [] }));
  return { roster: plan.roster, waves, groups };
}

/**
 * Leaver stage (leaver.ts), on its own stream after the v2 stage. Draws: the join uniform; when
 * the Leaver joins, per group one uniform, and for a swapped group its pattern and emitGroup.
 * Returns null when the Leaver does not join or no group swapped: the caller keeps its def as is.
 */
export function applyLeaver(
  r: Rng,
  weight: number,
  arena: ArenaDef,
  roster: readonly RosterEntry[],
  list: { waves: readonly WaveDef[]; groups: readonly GroupRec[] },
  cyl = false,
): { roster: RosterEntry[]; waves: WaveDef[] } | null {
  if (!(weight > 0) || roster.some((e) => e.kind === 'leaver') || !leaverJoins(r)) return null;
  const swap = leaverSwapChance(roster, weight);
  const entries: SpawnEntry[][] = list.waves.map((w) => [...w.entries]);
  const firstPattern: (SpawnPattern | null)[] = list.waves.map(() => null);
  // Walk back to front per wave, so a replaced range never shifts a later group's indices.
  const swapped: { g: GroupRec; pattern: SpawnPattern; out: SpawnEntry[] }[] = [];
  for (const g of list.groups) {
    if (list.waves[g.wave] === undefined || !(r() < swap)) continue;
    const pattern = patternFor(r, 'leaver');
    swapped.push({ g, pattern, out: emitGroup(r, arena, 'leaver', leaverGroupCount(g.count), pattern, g.startSec, cyl) });
  }
  if (swapped.length === 0) return null;
  for (let i = swapped.length - 1; i >= 0; i--) {
    const s = swapped[i];
    const dst = s === undefined ? undefined : entries[s.g.wave];
    if (s === undefined || dst === undefined) continue;
    dst.splice(s.g.first, s.g.count, ...s.out);
    if (s.g.first === 0) firstPattern[s.g.wave] = s.pattern;
  }
  const waves = list.waves.map((w, i) => ({ ...w, pattern: firstPattern[i] ?? w.pattern, entries: entries[i] ?? [] }));
  return { roster: rosterWithLeaver(roster, weight), waves };
}

const runsV2 = (cfg: GenConfig, band: Band): boolean => cfg.enableV2Enemies && band >= 2;

// Waves, docs/02 section 7.

interface WaveRun {
  arena: ArenaDef;
  roster: readonly RosterEntry[];
  b: BandParams;
  tStart: number;
  /** Waves start while t < tEnd. */
  tEnd: number;
  /** Added to t before the ramp lookup (Endless segments). */
  rampOffsetSec: number;
  /** Bands 3 and 4 in Endless play at the end of the ramp. */
  fullRamp: boolean;
  /** Extra spawn units per wave (Endless band 4 escalation). */
  budgetBonus: number;
  /** D13: the arena is a cylinder (wrapped spawn points). Absent means flat. */
  cylinder?: boolean;
  /** Release polish: intensity pulses (calm opening, peaks, breathers). Absent means the plain ramp. */
  pulse?: PulseShape;
  /**
   * R1 pacing: the stream the wave flavours and interval jitter are drawn from (needs pulse).
   * Absent means the version 5 waves, with no extra draw on the wave stream.
   */
  volatile?: Rng;
  /**
   * Release gate R2: waves at or after this second skip the R1 plan (no volatile draw) and play
   * the version 5 interval and budget, so a boss fight keeps its version 5 wave tuning. Absent
   * means the R1 plan runs to tEnd.
   */
  volatileUntilSec?: number;
  /**
   * Free Play density: each wave's budget times this, rounded, at least 1. Absent means 1 (no
   * change to any draw).
   */
  budgetScale?: number;
  /**
   * R5 late lift: waves at or after fromSec, outside a breather, have their budget times budget,
 * rounded, at least 1.
   * Applied before the R1 plan, so no draw before fromSec moves. Absent means no lift.
   */
  late?: { readonly fromSec: number; readonly budget: number };
}

/**
 * R5 (Ryan, build 405facc: "near the end of the 3 minute Free Play match the load increased; I like
 * it"). Free Play's final third spawns about 1.37x its middle third (the Endless ramp). Adventure
 * version 8 non boss levels in bands 2 to 4 already reach 1.27x to 2.3x, but band 1 (levels 1 to 4)
 * finishes its ramp at 120 s and stayed flat (0.95x to 1.0x). These levels lift their wave budget
 * by R5_LATE_BUDGET from R5_LATE_FROM of the clear time, breathers excepted.
 */
export const R5_LATE_FROM = 2 / 3;
export const R5_LATE_BUDGET = 1.4;
export const R5_LATE_BANDS: readonly Band[] = Object.freeze<Band[]>([1]);

/**
 * Kind a snake group falls back to when the snake cap is full: grunt when the roster has it (every
 * generated roster does), else the cheapest other roster kind, else null (the group stays empty).
 * Free Play rosters may lack grunt.
 */
export function snakeFallbackKind(roster: readonly RosterEntry[]): EnemyKind | null {
  if (roster.some((e) => e.kind === 'grunt')) return 'grunt';
  let best: EnemyKind | null = null;
  for (const e of roster) if (e.kind !== 'snake' && (best === null || SPAWN_COST[e.kind] < SPAWN_COST[best])) best = e.kind;
  return best;
}

/** Roster entries affordable at gb units; when none is (a Free Play roster), the cheapest entry alone. */
function affordable(roster: readonly RosterEntry[], gb: number): readonly RosterEntry[] {
  const fits = roster.filter((e) => SPAWN_COST[e.kind] <= gb);
  if (fits.length > 0 || roster.length === 0) return fits;
  let best = roster[0] as RosterEntry;
  for (const e of roster) if (SPAWN_COST[e.kind] < SPAWN_COST[best.kind]) best = e;
  return [best];
}

// R1 pacing (release gate R1): shorter, jittered wave intervals so the arena never empties, and
// wave flavours for volatility. Read only when WaveRun.volatile is set.

/** Salt of the R1 flavour stream. ASCII "R1PA". */
export const R1_SALT = 0x52315041;
/** R1 interval: the version 5 interval times this, times a jitter, clamped to the min and max. */
export const R1_INTERVAL_SCALE = 0.5;
export const R1_JITTER_MIN = 0.75;
export const R1_JITTER_MAX = 1.25;
export const R1_MIN_INTERVAL_SEC = 1.2;
export const R1_MAX_INTERVAL_SEC = 2.8;
/** Spawn rate over version 5 at the same moment (before flavours; the flavour mix adds about 20 percent). */
export const R1_RATE_BOOST = 1;
/** Least enemies in a wave other than a lull. */
export const R1_MIN_WAVE = 3;
/** Seconds from a lull to the next wave. */
export const R1_LULL_NEXT_SEC = 2.6;
export const R1_FLAVOURS = ['normal', 'surge', 'swarm'] as const;
export type R1Flavour = (typeof R1_FLAVOURS)[number] | 'lull';
export const R1_FLAVOUR_WEIGHTS: Readonly<Record<(typeof R1_FLAVOURS)[number], number>> = Object.freeze({ normal: 55, surge: 20, swarm: 25 });
/** Budget multiplier per flavour: a surge is 2.5 x a normal wave, a swarm 1.75 x (the lull is 1 enemy). */
export const R1_FLAVOUR_BUDGET: Readonly<Record<R1Flavour, number>> = Object.freeze({ normal: 0.8, surge: 2, swarm: 1.4, lull: 0 });

/** Swarm kind of a roster: darts when present and affordable, else grunts (always present). */
export function swarmKind(roster: readonly RosterEntry[], budget: number): EnemyKind {
  return roster.some((e) => e.kind === 'dart') && budget >= SPAWN_COST.dart ? 'dart' : 'grunt';
}

/** Lull kind: the costliest roster kind that comes one at a time (no dart packs; snake only with room). */
export function lullKind(roster: readonly RosterEntry[], snakeRoom: boolean): EnemyKind {
  let best: EnemyKind = 'grunt';
  for (const e of roster) {
    if (e.kind === 'dart' || (e.kind === 'snake' && !snakeRoom)) continue;
    if (SPAWN_COST[e.kind] > SPAWN_COST[best]) best = e.kind;
  }
  return best;
}

interface R1Wave {
  flavour: R1Flavour;
  budget: number;
  /** Seconds to the next wave. */
  interval: number;
}

/**
 * R1 plan of one wave. Draws (volatile stream): flavour, then the interval jitter; none for the
 * lull (the first wave of a breather). The budget is rescaled to the shorter interval.
 */
function r1Wave(v: Rng, budget: number, oldInterval: number, lull: boolean): R1Wave {
  if (lull) {
    return { flavour: 'lull', budget: 1, interval: R1_LULL_NEXT_SEC };
  }
  const flavour = weightedKey(v, R1_FLAVOURS, R1_FLAVOUR_WEIGHTS);
  const jitter = range(v, R1_JITTER_MIN, R1_JITTER_MAX);
  const interval = round1(Math.min(R1_MAX_INTERVAL_SEC, Math.max(R1_MIN_INTERVAL_SEC, oldInterval * R1_INTERVAL_SCALE * jitter)));
  const scaled = (budget * interval * R1_RATE_BOOST) / oldInterval;
  return { flavour, budget: Math.max(R1_MIN_WAVE, Math.round(scaled * R1_FLAVOUR_BUDGET[flavour])), interval };
}

function rampU(run: WaveRun, t: number): number {
  if (run.fullRamp) return 1;
  return Math.pow(Math.min(1, (t + run.rampOffsetSec) / run.b.rampSec), run.b.rampExponent);
}

/**
 * One spawn group of the v1 wave pass, recorded for the v2 enemy stage. Not part of the output:
 * the LevelDef holds only the entries. units is the group's spawn budget (gb).
 */
export interface GroupRec {
  wave: number;
  /** Index of the group's first entry in its wave, and how many entries it has. */
  first: number;
  count: number;
  kind: EnemyKind;
  units: number;
  startSec: number;
}

/** Per wave draws: group count, then per group kind, count draws (snake none, dart 5 to 8 per pack), pattern, emitGroup. */
export function generateWaveList(r: Rng, run: WaveRun): WaveDef[] {
  return generateWaveGroups(r, run).waves;
}

/** generateWaveList plus the group records. Same draws, same waves: the records are a side output. */
export function generateWaveGroups(r: Rng, run: WaveRun): { waves: WaveDef[]; groups: GroupRec[] } {
  const { b, roster } = run;
  const waves: WaveDef[] = [];
  const groups: GroupRec[] = [];
  const snakeTimes: number[] = [];
  let wasBreather = false;
  for (let t = run.tStart, i = 0; t < run.tEnd; i++) {
    const u = rampU(run, t);
    const ramped = Math.round(b.budgetStart + (b.budgetEnd - b.budgetStart) * u) + run.budgetBonus;
    const pulse = run.pulse === undefined ? null : pulseAt(run.pulse, t);
    const step = b.intervalStartSec + (b.intervalEndSec - b.intervalStartSec) * u;
    const oldInterval = pulse === null ? step : step * pulse.interval;
    let budget = pulse === null ? ramped : Math.max(1, Math.round(ramped * pulse.budget));
    if (run.budgetScale !== undefined) budget = Math.max(1, Math.round(budget * run.budgetScale));
    // R1: the first wave of each breather is a lull; every other wave draws a flavour.
    const breather = run.pulse !== undefined && inBreather(run.pulse, t);
    // R5 late lift: breathers keep their dip, so the final third still breathes after each peak.
    if (run.late !== undefined && t >= run.late.fromSec && !breather) budget = Math.max(1, Math.round(budget * run.late.budget));
    const volatileOn = run.volatile !== undefined && (run.volatileUntilSec === undefined || t < run.volatileUntilSec);
    const plan = run.volatile === undefined || !volatileOn ? null : r1Wave(run.volatile, budget, oldInterval, breather && !wasBreather);
    wasBreather = breather;
    if (plan !== null) budget = plan.budget;
    const snakeRoom = (): number => b.maxLiveSnakes - snakeTimes.filter((s) => s > t - SNAKE_WINDOW_SEC).length;
    if (plan?.flavour === 'lull') {
      const kind = lullKind(roster, snakeRoom() > 0);
      if (kind === 'snake') snakeTimes.push(t);
      const pattern = patternFor(r, kind);
      const emitted = emitGroup(r, run.arena, kind, 1, pattern, 0, run.cylinder === true);
      groups.push({ wave: i, first: 0, count: emitted.length, kind, units: 1, startSec: 0 });
      waves.push({ index: i, atSec: t, pattern, entries: emitted });
      t = round1(t + plan.interval);
      continue;
    }
    let nGroups = rngInt(r, b.groupsPerWave.min, b.groupsPerWave.max);
    while (nGroups > budget) nGroups--;
    const share = Math.floor(budget / nGroups);
    const entries: SpawnEntry[] = [];
    let first: SpawnPattern | null = null;
    for (let g = 0; g < nGroups; g++) {
      const gb = share + (g === 0 ? budget - share * nGroups : 0);
      const fits = affordable(roster, gb);
      let kind = rngPick(
        r,
        fits.map((e) => e.kind),
        fits.map((e) => e.weight),
      );
      // R1 swarm: every group of the wave is the roster's small fast kind.
      if (plan?.flavour === 'swarm') kind = swarmKind(roster, gb);
      let count = 0;
      let noKind = false;
      if (kind === 'snake') {
        const room = b.maxLiveSnakes - snakeTimes.filter((s) => s > t - SNAKE_WINDOW_SEC).length;
        // Free Play: a snake only roster has no fallback, so the group stays empty.
        const fallback = room <= 0 ? snakeFallbackKind(roster) : null;
        if (room <= 0 && fallback !== null) kind = fallback;
        else if (room <= 0) noKind = true;
        else {
          count = Math.min(Math.max(1, Math.floor(gb / SPAWN_COST.snake)), room);
          for (let k = 0; k < count; k++) snakeTimes.push(t);
        }
      }
      // Units of the group: gb, or one of the kind when a Free Play roster can afford nothing.
      const units = Math.max(gb, SPAWN_COST[kind]);
      if (noKind) {
        count = 0;
      } else if (kind === 'dart') {
        for (let p = 0; p < Math.floor(units / SPAWN_COST.dart); p++) count += rngInt(r, 5, 8);
      } else if (kind !== 'snake') {
        count = Math.floor(units / SPAWN_COST[kind]);
      }
      const pattern = patternFor(r, kind);
      first ??= pattern;
      const emitted = emitGroup(r, run.arena, kind, count, pattern, g * GROUP_START_STEP_SEC, run.cylinder === true);
      groups.push({ wave: i, first: entries.length, count: emitted.length, kind, units: gb, startSec: g * GROUP_START_STEP_SEC });
      entries.push(...emitted);
    }
    // R1: a wave too small to keep the arena busy (one weaver, one snake) gets grunts to R1_MIN_WAVE.
    if (plan !== null && entries.length < R1_MIN_WAVE) {
      const fill = R1_MIN_WAVE - entries.length;
      const startSec = nGroups * GROUP_START_STEP_SEC;
      const pattern = patternFor(r, 'grunt');
      first ??= pattern;
      const emitted = emitGroup(r, run.arena, 'grunt', fill, pattern, startSec, run.cylinder === true);
      groups.push({ wave: i, first: entries.length, count: emitted.length, kind: 'grunt', units: fill, startSec });
      entries.push(...emitted);
    }
    waves.push({ index: i, atSec: t, pattern: first ?? 'edges', entries });
    t = round1(t + (plan !== null ? plan.interval : oldInterval));
  }
  return { waves, groups };
}

function scheduleOf(b: BandParams, waves: WaveDef[], loopFromIndex: number, loopPeriodSec: number, budgetBonus = 0): WaveSchedule {
  return {
    maxLiveEnemies: b.maxLiveEnemies,
    intervalStartSec: b.intervalStartSec,
    intervalEndSec: b.intervalEndSec,
    rampSec: b.rampSec,
    rampExponent: b.rampExponent,
    budgetStart: b.budgetStart,
    budgetEnd: b.budgetEnd + budgetBonus,
    waves,
    loopFromIndex,
    loopPeriodSec,
  };
}

/** docs/02 section 7 step 3: loop the hard second half of the schedule. */
function loopFields(waves: readonly WaveDef[], scheduleSec: number, intervalEndSec: number, minPeriodSec = 0): { from: number; period: number } {
  const found = waves.findIndex((w) => w.atSec >= 0.5 * scheduleSec);
  const from = found >= 0 ? found : waves.length - 1;
  const last = waves[waves.length - 1];
  const start = waves[from];
  const period = last !== undefined && start !== undefined ? round1(last.atSec + intervalEndSec - start.atSec) : intervalEndSec;
  return { from, period: Math.max(period, intervalEndSec, minPeriodSec) };
}

// Hazards, docs/02 section 9.

/** Farthest distance from the centre a point can be while inside the arena with margin. */
function farthestInside(arena: ArenaDef, margin: number): number {
  const hw = arena.width / 2 - margin;
  const hh = arena.height / 2 - margin;
  switch (arena.shape) {
    case 'circle':
      return arena.width / 2 - margin;
    case 'hexagon':
      return (HEX_COS30 * (arena.width / 2) - margin) / HEX_COS30;
    case 'roundRect': {
      const rc = arena.cornerRadius;
      if (rc <= margin) return Math.hypot(hw, hh);
      return Math.hypot(arena.width / 2 - rc, arena.height / 2 - rc) + rc - margin;
    }
    default:
      return Math.hypot(hw, hh);
  }
}

function randomPoint(r: Rng, arena: ArenaDef, cyl: boolean): Vec2 {
  if (cyl) {
    // u placed in [0, W) then canonicalised to the arena range; v between the rims.
    const u = range(r, 0, arena.width);
    return { x: roundCanonX(u - arena.width / 2, arena.width), y: r1(range(r, -arena.height / 2, arena.height / 2)) };
  }
  return { x: r1(range(r, -arena.width / 2, arena.width / 2)), y: r1(range(r, -arena.height / 2, arena.height / 2)) };
}

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Draws: well count (always), well positions, then if enabled spawner count, positions, and one
 * spawnAtSec per placed spawner. Feasibility pre-check uses the farthest inside point rather
 * than the inscribed radius, so rect arenas can reach their corners (circle and hexagon in band 2
 * still get none, as docs/02 section 9.1 expects).
 */
export function generateHazards(r: Rng, arena: ArenaDef, b: BandParams, cfg: GenConfig, objective: ObjectiveDef, cyl = false): HazardDef {
  // Cylinder: wrapped distances, and the edge margin applies to the rims only.
  const W = arena.width;
  const d2 = cyl ? (a: Vec2, c: Vec2): number => cylDist(a, c, W) : dist;
  const inside = cyl ? (p: Vec2, m: number): boolean => insideRims(arena, p, m) : (p: Vec2, m: number): boolean => insideArena(arena, p, m);
  const obsDist = cyl ? (o: Obstacle, p: Vec2): number => cylObstacleDistance(o, p, W) : obstaclePointDistance;
  const wells: GravityWellDef[] = [];
  const nWells = rngInt(r, b.wells.min, b.wells.max);
  const wellMin = Math.max(WELL_SPAWN_WIDTH_FRACTION * arena.width, WELL_SPAWN_FLOOR);
  if ((cyl ? cylFarthest(arena, WELL_EDGE) : farthestInside(arena, WELL_EDGE)) >= wellMin) {
    for (let i = 0; i < nWells; i++) {
      let placed = false;
      for (let a = 0; a < WELL_ATTEMPTS && !placed; a++) {
        const p = randomPoint(r, arena, cyl);
        if (d2(p, arena.spawnPoint) < wellMin) continue;
        if (!inside(p, WELL_EDGE)) continue;
        if (arena.obstacles.some((o) => obsDist(o, p) < WELL_OBSTACLE)) continue;
        if (wells.some((w) => d2(w, p) < WELL_PAIR)) continue;
        wells.push(p);
        placed = true;
      }
      if (!placed) break;
    }
  }
  const spawners: SpawnerDef[] = [];
  if (cfg.enableSpawner) {
    const n = rngInt(r, b.spawners.min, b.spawners.max);
    const spawnerMin = SPAWNER_SPAWN_WIDTH_FRACTION * arena.width;
    for (let i = 0; i < n; i++) {
      let p: Vec2 | null = null;
      for (let a = 0; a < SPAWNER_ATTEMPTS && p === null; a++) {
        const c = randomPoint(r, arena, cyl);
        if (!inside(c, SPAWNER_EDGE)) continue;
        if (d2(c, arena.spawnPoint) < spawnerMin) continue;
        if (wells.some((w) => d2(w, c) < SPAWNER_WELL)) continue;
        if (arena.obstacles.some((o) => obsDist(o, c) < SPAWNER_OBSTACLE)) continue;
        if (spawners.some((s) => d2(s, c) < SPAWNER_WELL)) continue;
        p = c;
      }
      if (p === null) break;
      let spawnAtSec = intStep(r, b.spawnerAtSec.min, b.spawnerAtSec.max, 5);
      if (objective.kind === 'survive' && objective.durationSec < spawnAtSec + 10) spawnAtSec = Math.max(5, objective.durationSec - 20);
      spawners.push({ x: p.x, y: p.y, spawnAtSec, emitEverySec: b.spawnerEmitEverySec, dartsPerEmit: b.spawnerDartsPerEmit });
    }
  }
  return { wells, spawners };
}

// Par, docs/02 section 8.

/** Returns par and, for scoreInTime, the target. Pure arithmetic on the expanded schedule. */
export function computePar(waves: WaveSchedule, objective: ObjectiveDef): { par: number; target: number } {
  // ENEMY_BASE and ENEMY_GEOMS are integers, so the sums are exact in any order: only the destroy
  // cut (the first need spawns by time) needs the sorted list.
  let n = 0;
  let baseTotal = 0;
  let geomTotal = 0;
  const add = (kind: EnemyKind): void => {
    n++;
    baseTotal += ENEMY_BASE[kind];
    geomTotal += ENEMY_GEOMS[kind];
  };
  if (objective.kind === 'destroy') {
    const need = Math.ceil(objective.count / KILL_RATE);
    let total = 0;
    forEachSpawn(waves, MAX_EST_SEC, () => {
      total++;
    });
    if (need >= total) {
      // Every spawn is in the cut, so no sort is needed.
      forEachSpawn(waves, MAX_EST_SEC, (_t, kind) => add(kind));
    } else {
      const all = expandSpawns(waves, MAX_EST_SEC);
      for (let i = 0; i < need; i++) {
        const s = all[i];
        if (s !== undefined) add(s.kind);
      }
    }
  } else {
    const T = objective.kind === 'survive' ? objective.durationSec : objective.timeLimitSec;
    forEachSpawn(waves, MAX_EST_SEC, (t, kind) => {
      if (t < T) add(kind);
    });
  }
  let par = PAR_MIN;
  if (n > 0) {
    const gAvg = geomTotal / n;
    const K = objective.kind === 'destroy' ? objective.count : KILL_RATE * n;
    const baseSum = objective.kind === 'destroy' ? (baseTotal * objective.count) / n : KILL_RATE * baseTotal;
    const mAvg = 1 + GEOM_RATE_PER_KILL * gAvg * K;
    par = Math.max(PAR_MIN, Math.round((baseSum * mAvg * PAR_SCALE) / PAR_STEP) * PAR_STEP);
  }
  const target = Math.min(par, Math.max(PAR_MIN, Math.round((TARGET_FRACTION * par) / PAR_STEP) * PAR_STEP));
  return { par, target };
}

// Assembly.

/** Seed every stage stream derives from on attempt k. Attempt 0 is the level seed itself. */
export function attemptSeed(seed: number, attempt: number): number {
  return attempt === 0 ? seed >>> 0 : fmix32((seed ^ Math.imul(RETRY_SALT, attempt)) >>> 0);
}

function buildLevel(runSeed: number, levelIndex: number, seed: number, attempt: number, cfg: GenConfig): LevelDef {
  const s = attemptSeed(seed, attempt);
  const band = bandOf(levelIndex);
  // Release polish: the long tables replace the objective ranges and the ramp; nothing else moves.
  const long = cfg.enableLongLevels === true;
  // Release gate R1: whole level par, volatile waves, more and truly open drums (version 6).
  const r1 = r1LevelOf(levelIndex, cfg);
  // Release gate R2: boss levels take the R1 waves before the boss (par, stars and the fight stay version 5).
  const r1Waves = runsR1(cfg);
  // Release gate R3: 3.5 minute non boss levels, the boss at 120 s, whole level par everywhere (version 8).
  const r3 = runsR3(cfg);
  const bossLevel = cfg.enableBosses && bossForLevel(levelIndex) !== null;
  const objTable = r3 ? r3ObjectiveTable(band, bossLevel) : LONG_BANDS[band];
  const b = r3 ? r3BandParams(band, bossLevel) : long ? longBandParams(band) : BANDS[band];
  // D13: the surface stream is separate, so drawing it here moves no draw of any flat level.
  const surface = pickSurface(seed, levelIndex, cfg);
  const cyl = surface === 'cylinder';
  const arena = cyl ? cylinderArena(seed, levelIndex, cfg, stream(s, SALT.arena), band) : generateArena(stream(s, SALT.arena), band);
  const v1Roster = generateRoster(stream(s, SALT.roster), band, cfg);
  const loadout = stream(s, SALT.loadout);
  const drone = pickAllowed(loadout, DRONE_KINDS, b.droneWeights, cfg.drones, 'attack');
  const superType = pickAllowed(loadout, SUPER_KINDS, b.superWeights, cfg.supers, 'turbo');
  const longObjective = long ? generateLongObjective(stream(s, SALT.objective), b, objTable) : null;
  let objective = longObjective === null ? generateObjective(stream(s, SALT.objective), b) : longObjective.objective;
  const timed = longObjective === null ? objectiveTimeSec(objective) : longObjective.clearSec;
  const scheduleSec =
    longObjective !== null ? longObjective.clearSec + LONG_SCHEDULE_PAD_SEC : timed === null ? b.scheduleSec : Math.max(b.scheduleSec, timed + 10);
  const v1List = generateWaveGroups(stream(s, SALT.waves), {
    arena,
    roster: v1Roster,
    b,
    tStart: FIRST_WAVE_SEC,
    tEnd: scheduleSec,
    rampOffsetSec: 0,
    fullRamp: false,
    budgetBonus: 0,
    cylinder: cyl,
    ...(long ? { pulse: longPulse(LONG_BANDS[band]) } : {}),
    ...(r3 && !bossLevel && longObjective !== null && R5_LATE_BANDS.includes(band) ? { late: { fromSec: round1(longObjective.clearSec * R5_LATE_FROM), budget: R5_LATE_BUDGET } } : {}),
    // R2 boss level: the R1 plan stops at the entrance, so the fight keeps the version 5 waves.
    ...(r1Waves ? { volatile: stream(s, R1_SALT), ...(bossLevel ? { volatileUntilSec: bossLevelAtSec(cfg) } : {}) } : {}),
  });
  const v2 = runsV2(cfg, band);
  // The v2 stage only rewrites kinds and entries; atSec is untouched, so the loop fields match v1.
  const staged = v2 ? applyV2Enemies(stream(s, V2_ENEMY_SALT), band, arena, v1Roster, v1List, cyl) : { roster: v1Roster, waves: v1List.waves, groups: v1List.groups };
  // Leaver stage: levels from LEAVER_FROM_LEVEL, own stream; null keeps the staged def byte for byte.
  const lw = leaverLevelWeight(levelIndex, band, cfg);
  const leaver = lw > 0 ? applyLeaver(stream(s, LEAVER_SALT), lw, arena, staged.roster, staged, cyl) : null;
  const { roster, waves: list } = leaver ?? staged;
  const loop = loopFields(list, scheduleSec, b.intervalEndSec, long ? LONG_MIN_REPEAT_SEC : 0);
  const waves = scheduleOf(b, list, loop.from, loop.period);
  if (longObjective !== null && objective.kind === 'destroy') objective = { kind: 'destroy', count: destroyCountFor(waves, longObjective.clearSec) };
  const hazards = generateHazards(stream(s, SALT.hazards), arena, b, cfg, objective, cyl);
  const whole = r3
    ? bossLevel
      ? bossLevelPar(waves, objective, bossLevelAtSec(cfg))
      : wholeLevelPar(waves, objective, R3_COLLECT_RATE)
    : r1
      ? wholeLevelPar(waves, objective)
      : null;
  const legacy = whole === null ? computePar(waves, objective) : null;
  const par = whole?.par ?? legacy?.par ?? PAR_MIN;
  if (objective.kind === 'scoreInTime') {
    // Tester 1: whole level par (R1 and later) takes the goal at WHOLE_TARGET_FRACTION x par, so the
    // goal sits near the 1 star line. Legacy configs (V1 to V5) keep their old targets.
    const target = whole !== null ? wholeLevelTarget(par) : long ? scaledTarget(waves, objective.timeLimitSec, BANDS[band].scoreTimeSec.max, par) : (legacy?.target ?? PAR_MIN);
    objective = { ...objective, target };
  }
  const def: LevelDef = {
    version: LEVELDEF_VERSION,
    // D13: a cylinder level reports GENERATOR_VERSION_V4; every flat level keeps its v3 version.
    // Release polish: every long level reports GENERATOR_VERSION_V5 instead; R1: version 6.
    generatorVersion: r3 ? GENERATOR_VERSION_V8 : r1 ? GENERATOR_VERSION_V6 : long ? GENERATOR_VERSION_V5 : cyl ? GENERATOR_VERSION_V4 : v2 ? GENERATOR_VERSION_V2 : GENERATOR_VERSION,
    runSeed,
    levelIndex,
    seed,
    band,
    arena,
    roster,
    speedScale: speedScaleFor(levelIndex),
    drone,
    superType,
    lives: LIVES,
    bombs: BOMBS,
    objective,
    waves,
    hazards,
    par,
    stars: whole === null ? [par, 2 * par, 4 * par] : whole.stars,
    surface,
    retries: attempt,
  };
  return withLevelBoss(def, cfg);
}

/**
 * V3 boss post step (docs/13 SPEC 3.3 rules 4 and 5). Flag off or not a boss level: the def as
 * is, so its v2.1 bytes and hash hold. Boss level with the flag on: the boss field (appended last,
 * so every other key keeps its place), GENERATOR_VERSION_V3, and rule 12 on the hazards. No draw.
 */
export function withLevelBoss(def: LevelDef, cfg: GenConfig): LevelDef {
  const long = cfg.enableLongLevels === true;
  const boss = cfg.enableBosses ? bossForLevel(def.levelIndex, bossLevelAtSec(cfg)) : null;
  if (boss === null) return def;
  // Release gate R2: a boss level built with the R1 config has the R1 waves and the 200 s entrance
  // (version 7); with the R1 pacing off it keeps version 5 (long) or 3.
  // Release gate R3: version 8 with the R3 length on.
  const generatorVersion = runsR3(cfg) ? GENERATOR_VERSION_V8 : runsR1(cfg) ? GENERATOR_VERSION_V7 : long ? GENERATOR_VERSION_V5 : GENERATOR_VERSION_V3;
  return { ...def, generatorVersion, hazards: bossHazards(def.hazards), boss };
}

/** Boss entrance second on a level of this config: 120 s (R3), 200 s (R1 config), 240 s (long levels), else 20 s. */
export function bossLevelAtSec(cfg: Readonly<GenConfig>): number {
  if (runsR3(cfg)) return BOSS_R3_LEVEL_AT_SEC;
  if (runsR1(cfg)) return BOSS_LONG_LEVEL_AT_SEC;
  return cfg.enableLongLevels === true ? BOSS_V5_LEVEL_AT_SEC : BOSS_LEVEL_AT_SEC;
}

/**
 * True when level n is a version 6 level: the config runs the R1 pacing and the level is not a
 * boss level. Release gate R2: boss levels of that config take the R1 waves as well, but keep the
 * version 5 par, stars and fight tuning, and report version 7 (withLevelBoss). Release gate R3:
 * with enableR3Length on as well every level is version 8 instead (buildLevel reads runsR3 first).
 */
export function r1LevelOf(levelIndex: number, cfg: GenConfig): boolean {
  return runsR1(cfg) && !(cfg.enableBosses && bossForLevel(levelIndex, BOSS_LONG_LEVEL_AT_SEC) !== null);
}

/** Pulse shape of a long level in a band. */
export function longPulse(l: LongBandParams): PulseShape {
  return { calmSec: LONG_CALM_SEC, peakEverySec: l.peakEverySec, breatherSec: LONG_BREATHER_SEC };
}

/** Tester 1: the scoreInTime goal as a share of a whole level par (Normal). */
export const WHOLE_TARGET_FRACTION = 0.6;

/** Whole level scoreInTime target: WHOLE_TARGET_FRACTION x par on the PAR_STEP grid, at least PAR_MIN, at most par. */
export function wholeLevelTarget(par: number): number {
  return Math.min(par, Math.max(PAR_MIN, Math.round((WHOLE_TARGET_FRACTION * par) / PAR_STEP) * PAR_STEP));
}

/**
 * Long scoreInTime target: the target the same waves give over the band's legacy time limit
 * (refSec), scaled by timeLimitSec / refSec (the current score per second), on the PAR_STEP grid,
 * at least PAR_MIN and at most par.
 */
export function scaledTarget(waves: WaveSchedule, timeLimitSec: number, refSec: number, par: number): number {
  const ref = computePar(waves, { kind: 'scoreInTime', target: PAR_MIN, timeLimitSec: refSec }).target;
  const scaled = Math.round((ref * timeLimitSec) / refSec / PAR_STEP) * PAR_STEP;
  return Math.min(par, Math.max(PAR_MIN, scaled));
}

/**
 * Level n of a run. Seed is deriveSeed(runSeed, levelIndex) (=== levelSeed). If an attempt fails
 * validateLevel, re-derive with attemptSeed(seed, k) for k = 1 to MAX_RETRIES and record k in
 * retries. If every attempt fails, the last one is returned (a slightly off level beats a crash).
 */
export function generateLevel(runSeed: number, levelIndex: number, cfg: GenConfig = DEFAULT_GEN_CONFIG): LevelDef {
  return generateLevelChecked(runSeed, levelIndex, cfg, (d) => validateLevel(d, cfg).ok);
}

/** generateLevel with the acceptance test injected, so tests can drive the retry path. */
export function generateLevelChecked(runSeed: number, levelIndex: number, cfg: GenConfig, accept: (def: LevelDef) => boolean): LevelDef {
  const rs = runSeed >>> 0;
  const seed = deriveSeed(rs, levelIndex);
  let def = buildLevel(rs, levelIndex, seed, 0, cfg);
  for (let k = 1; k <= MAX_RETRIES && !accept(def); k++) def = buildLevel(rs, levelIndex, seed, k, cfg);
  return deepFreeze(def);
}

// Endless, docs/02 section 10 and docs/01 section 2.2.

/** Extra spawn units per wave in segment s: 0 before band 4, then +1 per segment without bound. */
export function endlessBudgetBonus(segment: number): number {
  return Math.max(0, segment - ENDLESS_BAND4_SEGMENT) * ENDLESS_BUDGET_PER_SEGMENT;
}

/**
 * Free Play options on a segment (freeplay.ts). Every field absent leaves the segment as
 * endlessSegmentOn makes it without tweaks.
 */
export interface SegmentTweaks {
  /** Explicit roster (the chosen enemy kinds); replaces the drawn roster and skips the v2 stage. */
  readonly roster?: readonly RosterEntry[];
  /** Wave budget multiplier (density). */
  readonly budgetScale?: number;
  /** maxLiveEnemies override (Swarm density). */
  readonly maxLiveEnemies?: number;
  /** The segment's boss, or null for none; replaces bossForSegment. */
  readonly boss?: BossSpec | null;
  /** R5 Free Play snakes: the snake is allowed, with this roster weight (withFreePlaySnakes). */
  readonly snakeWeight?: number;
}

/** Salt of the Free Play snake stream. ASCII "FPSN". */
export const FREE_PLAY_SNAKE_SALT = 0x4650534e;

/**
 * R5 (Ryan, build 405facc: "Snakes are now not appearing and will not appear if wells is not turned
 * on"). Bands 1 and 2 (the first 4 minutes of a run) have maxLiveSnakes 0 and snake roster weight
 * 0, so only the nova snakes of wells showed. With the snake allowed, a Free Play segment from
 * FREE_PLAY_SNAKE_FROM_SEGMENT holds at least FREE_PLAY_SNAKES_PER_SEGMENT snakes: each missing one
 * is a single 'corners' entry at offset 0 in wave floor((k + 1) n / (need + 1)), placed by
 * emitGroup on its own stream, and the snake joins the roster. Draws: emitGroup per added snake.
 */
export function withFreePlaySnakes(
  r: Rng,
  roster: readonly RosterEntry[],
  waves: readonly WaveDef[],
  arena: ArenaDef,
  cyl: boolean,
  weight: number,
): { roster: RosterEntry[]; waves: WaveDef[] } {
  const have = waves.reduce((n, w) => n + w.entries.filter((e) => e.kind === 'snake').length, 0);
  const need = waves.length === 0 ? 0 : Math.max(0, FREE_PLAY_SNAKES_PER_SEGMENT - have);
  const out = waves.map((w) => ({ ...w, entries: [...w.entries] }));
  for (let k = 0; k < need; k++) {
    const target = out[Math.floor(((k + 1) * out.length) / (need + 1))];
    if (target !== undefined) target.entries.push(...emitGroup(r, arena, 'snake', 1, patternFor(r, 'snake'), 0, cyl));
  }
  const snakes = have + need > 0;
  const kinds = new Set(roster.map((e) => e.kind));
  const next = snakes && !kinds.has('snake') ? ALL_ENEMY_KINDS.filter((k) => kinds.has(k) || k === 'snake').map((kind) => roster.find((e) => e.kind === kind) ?? { kind, weight }) : roster.map((e) => ({ ...e }));
  return { roster: next, waves: out };
}

/** Endless segment s: roster and waves only, atSec relative to segment start, all below 30 s. */
export function generateEndlessSegment(endlessSeed: number, segment: number, cfg: GenConfig = DEFAULT_GEN_CONFIG): EndlessSegmentDef {
  return endlessSegmentOn(endlessSeed, segment, cfg, ENDLESS_ARENA, false);
}

/**
 * Endless segment s with its spawn points laid out on the given arena (cyl: a drum, spawn points
 * on the rims and wrapped in u). Same streams and draw order as generateEndlessSegment; on the
 * fixed Endless arena it is generateEndlessSegment, byte for byte. Release gate R2 Free Play.
 */
export function endlessSegmentOn(endlessSeed: number, segment: number, cfg: GenConfig, arena: Readonly<ArenaDef>, cyl: boolean, tweaks?: SegmentTweaks): EndlessSegmentDef {
  const es = endlessSeed >>> 0;
  const seed = segmentSeed(es, segment);
  const effectiveIndex = effectiveIndexOf(segment);
  const band = bandOf(effectiveIndex);
  const b = BANDS[band];
  const v1Roster = tweaks?.roster?.map((e) => ({ ...e })) ?? generateRoster(stream(seed, SALT.roster), band, cfg);
  const bonus = endlessBudgetBonus(segment);
  const v1List = generateWaveGroups(stream(seed, SALT.waves), {
    arena,
    roster: v1Roster,
    b,
    tStart: segment === 0 ? FIRST_WAVE_SEC : 0,
    tEnd: ENDLESS_SEGMENT_SEC,
    rampOffsetSec: ENDLESS_SEGMENT_SEC * segment,
    fullRamp: band >= 3,
    budgetBonus: bonus,
    ...(cyl ? { cylinder: true } : {}),
    ...(tweaks?.budgetScale !== undefined ? { budgetScale: tweaks.budgetScale } : {}),
  });
  // An explicit roster is final: the v2 stage never swaps its kinds.
  const v2 = tweaks?.roster === undefined && runsV2(cfg, band);
  const v2Staged = v2 ? applyV2Enemies(stream(seed, V2_ENEMY_SALT), band, arena, v1Roster, v1List, cyl) : { roster: v1Roster, waves: v1List.waves, groups: v1List.groups };
  // Leaver stage from LEAVER_FROM_SEGMENT (3 minutes); an explicit (Free Play) roster is final.
  const lw = tweaks?.roster === undefined ? leaverSegmentWeight(segment, band, cfg) : 0;
  const staged = (lw > 0 ? applyLeaver(stream(seed, LEAVER_SALT), lw, arena, v2Staged.roster, v2Staged, cyl) : null) ?? v2Staged;
  const snakeOn = tweaks?.snakeWeight !== undefined && segment >= FREE_PLAY_SNAKE_FROM_SEGMENT;
  const { roster, waves: list } = snakeOn ? withFreePlaySnakes(stream(seed, FREE_PLAY_SNAKE_SALT), staged.roster, staged.waves, arena, cyl, tweaks.snakeWeight ?? 1) : staged;
  const schedule = scheduleOf(b, list, -1, 0, bonus);
  const def: EndlessSegmentDef = {
    version: LEVELDEF_VERSION,
    generatorVersion: v2 || roster.some((e) => isV2Kind(e.kind)) ? GENERATOR_VERSION_V2 : GENERATOR_VERSION,
    endlessSeed: es,
    segment,
    seed,
    effectiveIndex,
    band,
    roster,
    speedScale: speedScaleFor(effectiveIndex),
    waves: tweaks?.maxLiveEnemies !== undefined ? { ...schedule, maxLiveEnemies: tweaks.maxLiveEnemies } : schedule,
  };
  // V3: a boss segment (a positive multiple of 6) carries the boss last and version 3. Endless has
  // no hazards, so rule 12 has nothing to remove. Flag off or any other segment: v2.1 bytes.
  // Free Play options may name the boss instead (tweaks.boss, null for none).
  const boss = tweaks?.boss !== undefined ? tweaks.boss : cfg.enableBosses ? bossForSegment(segment) : null;
  return deepFreeze(boss === null ? def : { ...def, generatorVersion: GENERATOR_VERSION_V3, boss });
}

/**
 * Endless game definition: fixed 1600 x 1000 arena, objective none, Attack drone, Turbo super,
 * the full catalogue roster. Waves come per 30 s segment from generateEndlessSegment, whose
 * budget keeps growing after segment 15 (the unbounded ramp). No PRNG draws here.
 */
export function generateEndless(endlessSeed: number, cfg: GenConfig = DEFAULT_GEN_CONFIG): EndlessDef {
  const w = BANDS[4].rosterWeights;
  // Flag on: the catalogue the segments ramp through includes every band 4 v2 kind.
  // The Leaver is listed only with its stage on (enableLeaver).
  const kinds = cfg.enableV2Enemies ? ALL_ENEMY_KINDS.filter((k) => w[k] > 0 && (k !== 'leaver' || leaverOn(cfg))) : ENEMY_KINDS;
  return deepFreeze({
    version: LEVELDEF_VERSION,
    generatorVersion: cfg.enableV2Enemies ? GENERATOR_VERSION_V2 : GENERATOR_VERSION,
    mode: 'endless',
    endlessSeed: endlessSeed >>> 0,
    surface: 'flat',
    arena: structuredCloneArena(ENDLESS_ARENA),
    roster: kinds.filter((k) => k !== 'snake' || cfg.enableSnake).map((kind) => ({ kind, weight: w[kind] })),
    drone: 'attack',
    superType: 'turbo',
    lives: LIVES,
    bombs: BOMBS,
    extraLifeEvery: ENDLESS_EXTRA_LIFE_EVERY,
    extraBombEvery: ENDLESS_EXTRA_BOMB_EVERY,
    maxLives: ENDLESS_MAX_LIVES,
    maxBombs: ENDLESS_MAX_BOMBS,
    objective: { kind: 'none' },
    hazards: { wells: [], spawners: [] },
    segmentSec: ENDLESS_SEGMENT_SEC,
    budgetPerSegment: ENDLESS_BUDGET_PER_SEGMENT,
    band4Segment: ENDLESS_BAND4_SEGMENT,
  });
}

function structuredCloneArena(a: Readonly<ArenaDef>): ArenaDef {
  return {
    shape: a.shape,
    width: a.width,
    height: a.height,
    cornerRadius: a.cornerRadius,
    obstacles: a.obstacles.map((o) => ({ ...o })),
    spawnPoint: { ...a.spawnPoint },
  };
}

// Hash, for on screen comparison of two devices' levels.

/** JSON with object keys sorted at every depth; undefined members dropped as JSON.stringify does. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : canonicalJson(x))).join(',')}]`;
  if (typeof v === 'object' && v !== null) {
    const rec = v as Record<string, unknown>;
    const keys = Object.keys(rec)
      .filter((k) => rec[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(rec[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** FNV-1a over UTF-16 code units, avalanched with fmix32. Returns a uint32. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return fmix32(h);
}

/** Short stable hash of the canonical JSON: 8 upper case hex digits. */
export function levelHash(def: LevelDef | EndlessDef): string {
  return fnv1a(canonicalJson(def)).toString(16).toUpperCase().padStart(8, '0');
}
