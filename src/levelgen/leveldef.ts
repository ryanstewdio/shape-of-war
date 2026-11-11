// Contract stub (docs/05-build-plan.md "Contract stubs"). Types are copied exactly from
// docs/02-level-generator.md section 3. Foundry owns this file from W1 and may grow it additively.
import type { SurfaceKind } from '../core/surface';
import type { FreePlayBosses, FreePlayDensity, FreePlaySize, FreePlayWells } from '../core/freeplayConfig';

export const LEVELDEF_VERSION = 1;
/** Generator version of every def the v1 algorithm alone produced (flag off, or band 1). */
export const GENERATOR_VERSION = 1;
/**
 * Generator version of a def the v2 enemy stage ran on (GenConfig.enableV2Enemies on and band 2
 * or higher, or an EndlessDef built with the flag on). Carried in the existing generatorVersion
 * field, so LEVELDEF_VERSION and the field shape are unchanged.
 */
export const GENERATOR_VERSION_V2 = 2;
/**
 * V3 contract stub (docs/12 V3-W0). Generator version that marks only boss levels (a def that
 * carries a BossSpec). Every other def keeps GENERATOR_VERSION or GENERATOR_VERSION_V2.
 */
export const GENERATOR_VERSION_V3 = 3;
/**
 * D13 phase C0. Generator version that marks only cylinder levels (surface 'cylinder'). Boss
 * levels are always flat, so it never meets GENERATOR_VERSION_V3; every flat def keeps its version.
 */
export const GENERATOR_VERSION_V4 = 4;
/**
 * Release polish (docs/14 items 7 and 9). Generator version of every def built with
 * GenConfig.enableLongLevels on: the long objective tables (LONG_BANDS), the paced waves, the boss
 * entrance at BOSS_LONG_LEVEL_AT_SEC and ring membranes. It replaces versions 1 to 4 on such a def
 * (boss and cylinder are read from the boss and surface fields). Flag off: versions 1 to 4 as before.
 */
export const GENERATOR_VERSION_V5 = 5;
/**
 * Release gate R1 pacing. Generator version of every non boss def built with enableLongLevels and
 * enableR1Pacing both on: whole level par with stars at 1, 1.25 and 1.5 par, volatile waves with no
 * dead air, 40 percent drums and truly open open drums. It replaces version 5 on such a def; boss
 * levels stay version 5. Either flag off: versions 1 to 5 as before, byte for byte.
 */
export const GENERATOR_VERSION_V6 = 6;
/**
 * Release gate R2. Generator version of a boss level built with enableLongLevels and
 * enableR1Pacing both on (the default config): the R1 waves before the boss, the boss entrance at
 * BOSS_LONG_LEVEL_AT_SEC (200 s), the version 5 par and stars. Also the version of every Free Play
 * EndlessDef (freePlayLevel). Versions 1 to 6 are unchanged, byte for byte.
 */
export const GENERATOR_VERSION_V7 = 7;
/**
 * Release gate R3. Generator version of every level (boss or not) built with enableLongLevels,
 * enableR1Pacing and enableR3Length all on (the default config): non boss objectives sized for
 * about 3.5 minutes (R3_BANDS), the boss entrance at BOSS_R3_LEVEL_AT_SEC (120 s), whole level par
 * on every level (boss levels count the fight waves and the boss bonus) and stars at 1, 1.25 and
 * 1.5 par. Versions 1 to 7 are unchanged, byte for byte (V6_GEN_CONFIG builds versions 6 and 7).
 */
export const GENERATOR_VERSION_V8 = 8;
/**
 * Tester 3 (wave T3). Generator version of every level built with the version 8 config plus
 * GenConfig.enableT3 (the default config): Brood first and Warden second with the first fight at
 * FIRST_FIGHT_HP_MUL, and level 8 a gentle open drum with no drift. No ripples (they start in the sim when a super nova well is destroyed). Versions 1 to 8 are unchanged, byte for byte (V8_GEN_CONFIG builds 8).
 */
export const GENERATOR_VERSION_V9 = 9;
/**
 * Tester Tom par ramp (Ryan, 2026-11-09). Generator version of every level built with the version 9
 * config plus GenConfig.enableParRamp (the default config): par from V10_COLLECT_RATE (a quarter of
 * the geoms collected, pacing.ts) and the gentler early ramp (PAR_RAMP_SCALE on the wave budget and
 * the live cap, levels 1 to 14). Versions 1 to 9 are unchanged, byte for byte (V9_GEN_CONFIG builds 9).
 */
export const GENERATOR_VERSION_V10 = 10;
/**
 * Short levels (Ryan, 2026-11-10). Generator version of every level built with the version 10
 * config plus GenConfig.enableShortLevels (the default config): level 1 about 90 s, levels 2 to 4
 * ramping, from level 5 each non boss level drawing 120 to 180 s (SHORT_LENGTHS, short.ts), the
 * boss entrance at BOSS_SHORT_LEVEL_AT_SEC, regular score races and a beat every minute with a
 * final rush. Versions 1 to 10 are unchanged, byte for byte (V10_GEN_CONFIG builds 10).
 */
export const GENERATOR_VERSION_V11 = 11;
/**
 * Trough wave (Ryan, 2026-11-10). Generator version of a trough level only (surface 'trough'):
 * the version 11 config plus GenConfig.enableTrough draws some non boss levels from
 * TROUGH_MIN_LEVEL as a valley arena (trough.ts). Every other level keeps version 11, and versions
 * 1 to 11 are unchanged, byte for byte (V11_GEN_CONFIG builds 11 everywhere). A trough Free Play
 * def carries it too. A version 12 level plays every version 11 rule.
 */
export const GENERATOR_VERSION_V12 = 12;
/**
 * Boss arenas (Ryan, 2026-11-11). Generator version of an Adventure guardian level from
 * BOSS_ARENA_FROM_LEVEL (level 10 and every later guardian level, loops included) built with the
 * version 12 config plus GenConfig.enableBossArenas (the default config): the arena grows to at
 * least the Free Play medium size of its kind, and Spindle's to the large size (bossArena.ts).
 * Every other level keeps its version, and versions 1 to 12 are unchanged, byte for byte
 * (V12_GEN_CONFIG builds 12). A version 13 level plays every version 11 rule.
 */
export const GENERATOR_VERSION_V13 = 13;

/**
 * Version 6 star thresholds as multiples of par, each rounded to the 500 grid: a strong player
 * who plays the full level lands between par and 1.5 x par (versions 1 to 5: 1, 2 and 4).
 */
export const R1_STAR_MULS: readonly [number, number, number] = [1, 1.25, 1.5];

/** True when a def carries the long level pacing (version 5 to 11). */
export const isLongVersion = (v: number): boolean =>
  v === GENERATOR_VERSION_V5 || v === GENERATOR_VERSION_V6 || v === GENERATOR_VERSION_V7 || isR3Version(v);

/** True when a def carries the R3 tables (version 8 to 11; version 11 swaps in the short lengths). */
export const isR3Version = (v: number): boolean => v === GENERATOR_VERSION_V8 || isT3Version(v);

/** True when a def carries the Tester 3 boss order and drum taste (version 9, 10 or 11). */
export const isT3Version = (v: number): boolean => v === GENERATOR_VERSION_V9 || hasParRamp(v);

/** True when a def carries the Tester Tom par ramp (version 10, 11 or 12). */
export const hasParRamp = (v: number): boolean => v === GENERATOR_VERSION_V10 || isShortVersion(v);

/** True when a def carries the short levels (version 11, 12 on a trough level or 13 on a guardian level). */
export const isShortVersion = (v: number): boolean => v === GENERATOR_VERSION_V11 || v === GENERATOR_VERSION_V12 || v === GENERATOR_VERSION_V13;

/**
 * Tester Tom par ramp (version 10): multiplier on the wave budget and on maxLiveEnemies of level n,
 * index n - 1, for levels 1 to 14. Linear from 0.75 at level 1 to 1.0 at level 15 (0.75 + 0.25 x
 * (n - 1) / 14, two decimals). Level 15 and up, and every older version, play at 1.
 */
export const PAR_RAMP_SCALE: readonly number[] = Object.freeze([0.75, 0.77, 0.79, 0.8, 0.82, 0.84, 0.86, 0.88, 0.89, 0.91, 0.93, 0.95, 0.96, 0.98]);

/** Pure: the version 10 ramp multiplier of level n (1 from level 15, and for any n outside the table). */
export function parRampScale(levelIndex: number): number {
  return PAR_RAMP_SCALE[levelIndex - 1] ?? 1;
}

/** Pure: maxLiveEnemies of a level: the band value, times the ramp on a version 10 or 11 level. */
export function levelMaxLive(band: Band, levelIndex: number, generatorVersion: number): number {
  const base = BANDS[band].maxLiveEnemies;
  return hasParRamp(generatorVersion) ? Math.round(base * parRampScale(levelIndex)) : base;
}

/** True when a def's stars sit at R1_STAR_MULS x par (version 6, 8 to 11); else 1, 2 and 4 x par. */
export const hasR1Stars = (v: number): boolean => v === GENERATOR_VERSION_V6 || isR3Version(v);

/** V3 boss ids, in schedule order (docs/13). A BossView id is the index in this list. */
export const BOSS_IDS = ['warden', 'brood', 'spindle', 'ember', 'mirage', 'gravitas', 'bastion', 'tempest', 'twins', 'prism'] as const;
export type BossId = (typeof BOSS_IDS)[number];
/** Boss tier, 1 (weakest) to 4 (Prism). */
export type BossTier = 1 | 2 | 3 | 4;
/** The boss of a level or an Endless segment. A pure table lookup: the generator draws nothing new. */
export interface BossSpec {
  id: BossId;
  tier: BossTier;
  /** Seconds on the wave clock at which the entrance starts (20 for a level, 10 into a segment). */
  atSec: number;
  /** Hit point multiplier: 1 plus 0.25 per completed pass of the list. */
  hpMul: number;
}

export type Band = 1 | 2 | 3 | 4;
export type ArenaShape = 'rect' | 'roundRect' | 'circle' | 'hexagon' | 'rectObstacles';
export type EnemyKind =
  | 'grunt'
  | 'wanderer'
  | 'weaver'
  | 'pinwheel'
  | 'dart'
  | 'snake'
  // V2 kinds (docs/10-v2-plan.md wave V2-C). Mine and Slime are hazards, never an EnemyKind.
  | 'charger'
  | 'bulwark'
  | 'blink'
  | 'swirl'
  | 'sower'
  | 'splime'
  // Leaver (Ryan's enemy, forge-leaver): a Weaver that splits into six shards on death. Joins
  // Adventure from level 21 and Endless from 3 minutes through its own stage (leaver.ts).
  | 'leaver';
export type DroneKind = 'attack' | 'collect' | 'ram';
export type SuperKind = 'homing' | 'detonate' | 'turbo';
export type SpawnPattern = 'edges' | 'corners' | 'ring' | 'cluster';

export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned wall. Centre and full size in arena units. */
export interface Obstacle {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /**
   * Release polish contract stub (Fable): a membrane bar blocks the ship and player bullets but lets
   * enemies squeeze through slowly (Forge). Absent means a solid wall, so existing levels are unchanged.
   */
  membrane?: true;
}

export interface ArenaDef {
  shape: ArenaShape;
  /** Bounding box, centred on (0, 0). Circle: width === height === diameter. Hexagon: flat top, width = 2 x circumradius. */
  width: number;
  height: number;
  /** roundRect only, else 0. */
  cornerRadius: number;
  /** rectObstacles only, else []. 1 to 3 entries. */
  obstacles: Obstacle[];
  /** Always { x: 0, y: 0 }. Stored so the validator and sim agree explicitly. */
  spawnPoint: Vec2;
}

export interface RosterEntry {
  kind: EnemyKind;
  weight: number;
}

export type ObjectiveDef =
  | { kind: 'scoreInTime'; target: number; timeLimitSec: number }
  | { kind: 'survive'; durationSec: number }
  | { kind: 'destroy'; count: number };

/** One enemy spawn. Either at a fixed arena point or on a ring around the ship's position at telegraph start. */
export interface SpawnEntry {
  kind: EnemyKind;
  /** Seconds after the wave's atSec. */
  tOffsetSec: number;
  mode: 'fixed' | 'ring';
  /** fixed: arena coordinates. ring: unused, 0. */
  x: number;
  y: number;
  /** ring: integer degrees and radius in u. fixed: 0. */
  angleDeg: number;
  radius: number;
  /** Integer degrees. Initial heading for wanderer and pinwheel; ignored by seekers. */
  headingDeg: number;
}

export interface WaveDef {
  index: number;
  atSec: number;
  pattern: SpawnPattern;
  entries: SpawnEntry[];
}

export interface WaveSchedule {
  maxLiveEnemies: number;
  /** Ramp metadata, informational for debugging and par. The sim reads only waves and loop fields. */
  intervalStartSec: number;
  intervalEndSec: number;
  rampSec: number;
  rampExponent: number;
  budgetStart: number;
  budgetEnd: number;
  waves: WaveDef[];
  /** After the last wave, repeat waves[loopFromIndex..] shifted by loopPeriodSec per repeat. */
  loopFromIndex: number;
  loopPeriodSec: number;
}

export interface GravityWellDef {
  x: number;
  y: number;
}

export interface SpawnerDef {
  x: number;
  y: number;
  spawnAtSec: number;
  emitEverySec: number;
  dartsPerEmit: number;
}

export interface HazardDef {
  wells: GravityWellDef[]; // 0 to 3
  spawners: SpawnerDef[]; // 0 to 2
}

export interface LevelDef {
  version: typeof LEVELDEF_VERSION;
  generatorVersion: number;
  runSeed: number;
  levelIndex: number;
  seed: number;
  band: Band;
  arena: ArenaDef;
  roster: RosterEntry[]; // 3 to 6, distinct kinds, always contains grunt
  speedScale: number; // 1.00 to 1.40, 2 decimals
  drone: DroneKind;
  superType: SuperKind;
  lives: number; // 3
  bombs: number; // 3
  objective: ObjectiveDef;
  waves: WaveSchedule;
  hazards: HazardDef;
  par: number; // multiple of 500, at least 1000
  stars: [number, number, number]; // [par, 2 x par, 4 x par]
  /**
   * W2, v2 hook (SPEC 3.3, docs/09 section 5). 'flat' or, since D13 phase C0, 'cylinder' (u wraps
   * with period arena.width). Optional in the type only so hand built defs elsewhere still compile;
   * generateLevel always emits it and validateLevel (V1) rejects a missing or other value.
   */
  surface?: SurfaceKind;
  /**
   * W2: deterministic re-derive count (0 to MAX_RETRIES) the generator needed before the def
   * passed validateLevel. Optional in the type for the same reason as surface; checked by J5.
   */
  retries?: number;
  /** V3 stub (docs/13): present only on a boss level. Absent on every other level and when GenConfig.enableBosses is off. */
  boss?: BossSpec;
  /**
   * Tester 3 drum taste (wave T3): true only on the version 9 level 8 open drum, which must not
   * drift (Forge: isOpenDrum is false when this is set). Absent on every other level.
   */
  noDrift?: true;
}

/** W2: most deterministic re-derives generateLevel makes after the first attempt. */
export const MAX_RETRIES = 8;

// Additions by Foundry (W1). Everything below follows docs/02-level-generator.md sections 3, 4, 10.

export interface EndlessSegmentDef {
  version: typeof LEVELDEF_VERSION;
  generatorVersion: number;
  endlessSeed: number;
  segment: number; // 0-based
  seed: number;
  effectiveIndex: number;
  band: Band;
  roster: RosterEntry[];
  speedScale: number;
  /** Waves with atSec relative to segment start, all atSec < 30. loopFromIndex = -1, loopPeriodSec = 0. */
  waves: WaveSchedule;
  /** V3 stub (docs/13): present only on a boss segment (a positive multiple of 6). Absent otherwise. */
  boss?: BossSpec;
}

export interface GenConfig {
  /** Scope cut switches (SPEC 8 cut order). Defaults: all true, all drones and supers. */
  enableSnake: boolean;
  enableSpawner: boolean;
  drones: DroneKind[];
  supers: SuperKind[];
  /**
   * V2 enemies (docs/11 section 6.3). On: bands 2 and up run the v2 enemy stage and report
   * GENERATOR_VERSION_V2. Off: output is byte identical to v1. Default on.
   */
  enableV2Enemies: boolean;
  /**
   * V3 bosses (docs/13). On: boss levels carry a BossSpec and report GENERATOR_VERSION_V3. Off:
   * output is byte identical to v2.1. Default on. Read by generateLevel and generateEndlessSegment
   * through the schedule in boss.ts (V3-A).
   */
  enableBosses: boolean;
  /**
   * D13 cylinder surface (phase C0). On: levels 11 and up that are not boss levels are drawn
   * cylinder 35 percent of the time from their own stream and report GENERATOR_VERSION_V4. Off:
   * output is byte identical to v3. Default on. Endless stays flat either way.
   */
  enableCylinder: boolean;
  /**
   * Release polish (docs/14 items 7 and 9). On: levels use LONG_BANDS objectives (at least 5
   * minutes), paced waves, the boss entrance at 240 s, ring membranes, and report
   * GENERATOR_VERSION_V5. Optional so older literals compile; only true turns it on, so absent or
   * false is byte identical to the generator before it. Default on. Endless never reads it.
   */
  enableLongLevels?: boolean;
  /**
   * Release gate R1. On together with enableLongLevels: whole level par and 1, 1.25, 1.5 par
   * stars, volatile waves without dead air, cylinder levels 40 percent of eligible levels and open
   * drums without barriers; reports GENERATOR_VERSION_V6 (R2: boss levels get the R1 waves before a 200 s entrance and report
   * GENERATOR_VERSION_V7). Optional; only true turns it on, so
   * absent or false is byte identical to version 5. Default on. Endless never reads it.
   */
  enableR1Pacing?: boolean;
  /**
   * Release gate R3. On together with enableLongLevels and enableR1Pacing: non boss levels about
   * 3.5 minutes (R3_BANDS), the boss at 120 s, whole level par on boss levels too; reports
   * GENERATOR_VERSION_V8. Optional; only true turns it on, so absent or false builds versions 6
   * and 7 byte for byte. Default on. Endless and Free Play never read it.
   */
  enableR3Length?: boolean;
  /**
   * Leaver (forge-leaver). On together with enableV2Enemies: Adventure levels from LEAVER_FROM_LEVEL
   * and Endless segments from LEAVER_FROM_SEGMENT run the Leaver stage (leaver.ts) on its own
   * stream, and the Endless catalogue lists the Leaver. Optional; only true turns it on, so absent
   * or false is byte identical to the generator before it. A level the stage leaves alone is byte
   * identical either way. Default on.
   */
  enableLeaver?: boolean;
  /**
   * Tester 3 (wave T3). On together with the version 8 flags: the T3 boss order and first fight
   * hit points and the level 8 drum taste; reports GENERATOR_VERSION_V9. Optional;
   * only true turns it on, so absent or false builds version 8 byte for byte. Default on. Endless
   * and Free Play never read it.
   */
  enableT3?: boolean;
  /**
   * Tester Tom par ramp (Ryan, 2026-11-09). On together with the version 9 flags: par from
   * V10_COLLECT_RATE and the PAR_RAMP_SCALE early ramp; reports GENERATOR_VERSION_V10. Optional;
   * only true turns it on, so absent or false builds version 9 byte for byte. Default on. Endless
   * and Free Play never read it.
   */
  enableParRamp?: boolean;
  /**
   * Short levels (Ryan, 2026-11-10). On together with the version 10 flags: the SHORT_LENGTHS
   * level lengths, the shorter boss entrance, regular score races and the minute beats (short.ts);
   * reports GENERATOR_VERSION_V11. Optional; only true turns it on, so absent or false builds
   * version 10 byte for byte. Default on. Endless and Free Play never read it. Older V*_GEN_CONFIG
   * literals inherit true but never meet it: runsShort needs enableParRamp too.
   */
  enableShortLevels?: boolean;
  /**
   * Trough wave (Ryan, 2026-11-10). On together with the version 11 config: some non boss levels
   * from TROUGH_MIN_LEVEL that are not drums are drawn as troughs (trough.ts, own stream, never two
   * in a row) and report GENERATOR_VERSION_V12. Optional; only true turns it on, so absent or false
   * builds version 11 byte for byte. Default on. Endless never reads it.
   */
  enableTrough?: boolean;
  /**
   * Boss arenas (Ryan, 2026-11-11). On together with the version 12 config: Adventure guardian
   * levels from BOSS_ARENA_FROM_LEVEL grow their arena (bossArena.ts) and report
   * GENERATOR_VERSION_V13. Optional; only true turns it on, so absent or false builds version 12
   * byte for byte. Default on. Endless and Free Play never read it.
   */
  enableBossArenas?: boolean;
}

export const DEFAULT_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({
  enableSnake: true,
  enableSpawner: true,
  drones: ['attack', 'collect', 'ram'],
  supers: ['homing', 'detonate', 'turbo'],
  enableV2Enemies: true,
  enableBosses: true,
  enableCylinder: true,
  enableLongLevels: true,
  enableR1Pacing: true,
  enableR3Length: true,
  enableLeaver: true,
  enableT3: true,
  enableParRamp: true,
  enableShortLevels: true,
  enableTrough: true,
  enableBossArenas: true,
});

/** DEFAULT_GEN_CONFIG with the v2 enemies, bosses and cylinder off: the v1 generator, byte for byte. */
export const V1_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({
  ...DEFAULT_GEN_CONFIG,
  enableV2Enemies: false,
  enableBosses: false,
  enableCylinder: false,
  enableLongLevels: false,
  enableR1Pacing: false,
  enableR3Length: false,
  enableLeaver: false,
  enableT3: false,
  enableParRamp: false,
});

/** DEFAULT_GEN_CONFIG with the bosses and cylinder off: the v2.1 generator (v2 enemies on), byte for byte. */
export const V2_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({
  ...DEFAULT_GEN_CONFIG,
  enableBosses: false,
  enableCylinder: false,
  enableLongLevels: false,
  enableR1Pacing: false,
  enableR3Length: false,
  enableLeaver: false,
  enableT3: false,
  enableParRamp: false,
});

/** DEFAULT_GEN_CONFIG with the cylinder off: the v3 generator (v2 enemies and bosses on), byte for byte. */
export const V3_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({
  ...DEFAULT_GEN_CONFIG,
  enableCylinder: false,
  enableLongLevels: false,
  enableR1Pacing: false,
  enableR3Length: false,
  enableLeaver: false,
  enableT3: false,
  enableParRamp: false,
});

/** DEFAULT_GEN_CONFIG with the long levels off: the v4 generator (cylinder drums on), byte for byte. */
export const V4_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({ ...DEFAULT_GEN_CONFIG, enableLongLevels: false, enableR1Pacing: false, enableR3Length: false, enableLeaver: false, enableT3: false, enableParRamp: false });

/** DEFAULT_GEN_CONFIG with the R1 pacing off: the v5 generator (long levels on), byte for byte. */
export const V5_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({ ...DEFAULT_GEN_CONFIG, enableR1Pacing: false, enableR3Length: false, enableLeaver: false, enableT3: false, enableParRamp: false });

/** DEFAULT_GEN_CONFIG with the R3 length off: the R2 generator (versions 6 and 7), byte for byte. */
export const V6_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({ ...DEFAULT_GEN_CONFIG, enableR3Length: false, enableLeaver: false, enableT3: false, enableParRamp: false });

/** DEFAULT_GEN_CONFIG with the T3 changes off: the version 8 generator (Leaver on), byte for byte. */
export const V8_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({ ...DEFAULT_GEN_CONFIG, enableT3: false, enableParRamp: false });

/** DEFAULT_GEN_CONFIG with the par ramp off: the version 9 generator (T3 on), byte for byte. */
export const V9_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({ ...DEFAULT_GEN_CONFIG, enableParRamp: false });

/** DEFAULT_GEN_CONFIG with the short levels off: the version 10 generator (par ramp on), byte for byte. */
export const V10_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({ ...DEFAULT_GEN_CONFIG, enableShortLevels: false });

/** DEFAULT_GEN_CONFIG with the troughs off: the version 11 generator (short levels on), byte for byte. */
export const V11_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({ ...DEFAULT_GEN_CONFIG, enableTrough: false });

/** DEFAULT_GEN_CONFIG with the boss arenas off: the version 12 generator (troughs on), byte for byte. */
export const V12_GEN_CONFIG: Readonly<GenConfig> = Object.freeze<GenConfig>({ ...DEFAULT_GEN_CONFIG, enableBossArenas: false });

/** True when a config builds R1 paced levels (long levels and R1 pacing both on). */
export const runsR1 = (cfg: Readonly<GenConfig>): boolean => cfg.enableLongLevels === true && cfg.enableR1Pacing === true;

/** True when a config builds R3 length levels (version 8): the R1 config plus enableR3Length. */
export const runsR3 = (cfg: Readonly<GenConfig>): boolean => runsR1(cfg) && cfg.enableR3Length === true;

/** True when a config builds Tester 3 levels (version 9): the R3 config plus enableT3. */
export const runsT3 = (cfg: Readonly<GenConfig>): boolean => runsR3(cfg) && cfg.enableT3 === true;

/** True when a config builds par ramp levels (version 10): the T3 config plus enableParRamp. */
export const runsParRamp = (cfg: Readonly<GenConfig>): boolean => runsT3(cfg) && cfg.enableParRamp === true;

/** True when a config builds short levels (version 11): the par ramp config plus enableShortLevels. */
export const runsShort = (cfg: Readonly<GenConfig>): boolean => runsParRamp(cfg) && cfg.enableShortLevels === true;

/** True when a config may build trough levels (version 12): the short levels config plus enableTrough. */
export const runsTrough = (cfg: Readonly<GenConfig>): boolean => runsShort(cfg) && cfg.enableTrough === true;

/** True when a config builds boss arenas (version 13): the trough config plus enableBossArenas. */
export const runsBossArenas = (cfg: Readonly<GenConfig>): boolean => runsTrough(cfg) && cfg.enableBossArenas === true;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export const ENEMY_KINDS: readonly EnemyKind[] = ['grunt', 'wanderer', 'weaver', 'pinwheel', 'dart', 'snake'];
/**
 * The six kinds the v2 enemy stage draws from (v2enemies.ts). The Leaver is not one of them: it
 * has its own stage, so adding it moved no v2 draw.
 */
export const V2_STAGE_KINDS: readonly EnemyKind[] = ['charger', 'bulwark', 'blink', 'swirl', 'sower', 'splime'];
/**
 * V2 enemy names: the v2 stage kinds, then the Leaver. Deliberately not part of ENEMY_KINDS, so v1
 * generator loops never see them. The Free Play toggles and the catalogue order read this list.
 */
export const V2_ENEMY_KINDS: readonly EnemyKind[] = [...V2_STAGE_KINDS, 'leaver'];
export const ARENA_SHAPES: readonly ArenaShape[] = ['rect', 'roundRect', 'circle', 'hexagon', 'rectObstacles'];
export const DRONE_KINDS: readonly DroneKind[] = ['attack', 'collect', 'ram'];
export const SUPER_KINDS: readonly SuperKind[] = ['homing', 'detonate', 'turbo'];
export const SPAWN_PATTERNS: readonly SpawnPattern[] = ['edges', 'corners', 'ring', 'cluster'];

export const ENEMY_BASE: Record<EnemyKind, number> = {
  grunt: 50,
  wanderer: 10,
  weaver: 100,
  pinwheel: 25,
  dart: 30,
  snake: 200,
  // V2 values, docs/11 section 6.2.
  charger: 120,
  bulwark: 150,
  blink: 130,
  swirl: 80,
  sower: 180,
  splime: 140,
  // Leaver: as the Weaver. Each of its shards scores a quarter of this in the sim (not a roster kind).
  leaver: 100,
};

export const ENEMY_GEOMS: Record<EnemyKind, number> = {
  grunt: 1,
  wanderer: 1,
  weaver: 2,
  pinwheel: 1,
  dart: 1,
  snake: 4,
  // V2 values, docs/11 section 6.2.
  charger: 2,
  bulwark: 3,
  blink: 2,
  swirl: 1,
  sower: 3,
  splime: 2,
  leaver: 2,
};

/** Shared by par calculation and sim loop handling. Expands loops up to tEnd. Sorted by t. */
export function expandSpawns(w: WaveSchedule, tEndSec: number): { t: number; kind: EnemyKind }[] {
  const out: { t: number; kind: EnemyKind }[] = [];
  forEachSpawn(w, tEndSec, (t, kind) => {
    out.push({ t, kind });
  });
  return out.sort((a, b) => a.t - b.t);
}

/**
 * Visits every spawn expandSpawns would return, in schedule order (not sorted by t), without
 * allocating. Same arithmetic as expandSpawns, which is built on it. Stops early when visit
 * returns true; returns true if it stopped early.
 */
export function forEachSpawn(w: WaveSchedule, tEndSec: number, visit: (t: number, kind: EnemyKind) => boolean | void): boolean {
  const waves = w.waves;
  const walk = (wave: WaveDef, shift: number): boolean => {
    const entries = wave.entries;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e === undefined) continue;
      const t = wave.atSec + shift + e.tOffsetSec;
      if (t < tEndSec && visit(t, e.kind) === true) return true;
    }
    return false;
  };
  for (let i = 0; i < waves.length; i++) {
    const wave = waves[i];
    if (wave !== undefined && walk(wave, 0)) return true;
  }
  const loopStart = waves[w.loopFromIndex];
  if (w.loopFromIndex >= 0 && w.loopPeriodSec > 0 && loopStart !== undefined) {
    for (let k = 1; ; k++) {
      const shift = k * w.loopPeriodSec;
      if (loopStart.atSec + shift >= tEndSec) break;
      for (let i = w.loopFromIndex; i < waves.length; i++) {
        const wave = waves[i];
        if (wave !== undefined && walk(wave, shift)) return true;
      }
    }
  }
  return false;
}

// Seeds. Copies of the docs/02 section 2 integer mixers, so the validator can check J4 without
// depending on the PRNG module. Pure integer maths, no randomness.

/** murmur3 finaliser: avalanche a 32-bit integer. */
export function fmix32(h: number): number {
  h >>>= 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** SPEC 3.2: level n seed is derived from the run seed plus n. */
export function levelSeed(runSeed: number, levelIndex: number): number {
  return fmix32((runSeed + levelIndex) >>> 0);
}

/** docs/02 section 10: seed of Endless segment s. The constant is ASCII "ENDL". */
export function segmentSeed(endlessSeed: number, segment: number): number {
  return fmix32(((endlessSeed ^ 0x454e444c) + segment) >>> 0);
}

export const round1 = (v: number): number => Math.round(v * 10) / 10;
export const round2 = (v: number): number => Math.round(v * 100) / 100;

// Band tables, docs/02 section 4. Changing any value changes generator output: bump GENERATOR_VERSION.

/** 1 for n 1 to 5 (and anything below 1), 2 for 6 to 15, 3 for 16 to 30, 4 for 31 and above. */
export function bandOf(levelIndex: number): Band {
  if (levelIndex <= 5) return 1;
  if (levelIndex <= 15) return 2;
  if (levelIndex <= 30) return 3;
  return 4;
}

export interface IntRange {
  min: number;
  max: number;
}

export interface BandParams {
  arenaHeight: IntRange; // step 20
  aspect: IntRange;
  shapeWeights: Record<ArenaShape, number>;
  obstacleCount: IntRange;
  rosterSize: IntRange;
  rosterWeights: Record<EnemyKind, number>;
  droneWeights: Record<DroneKind, number>;
  superWeights: Record<SuperKind, number>;
  objectiveWeights: Record<ObjectiveDef['kind'], number>;
  surviveSec: IntRange; // step 5
  destroyCount: IntRange; // step 5
  scoreTimeSec: IntRange; // step 15
  intervalStartSec: number;
  intervalEndSec: number;
  rampSec: number;
  rampExponent: number;
  budgetStart: number;
  budgetEnd: number;
  groupsPerWave: IntRange;
  maxLiveEnemies: number;
  scheduleSec: number;
  maxLiveSnakes: number;
  wells: IntRange;
  spawners: IntRange;
  spawnerAtSec: IntRange; // step 5, 0 to 0 when the band has no spawners
  spawnerEmitEverySec: number;
  spawnerDartsPerEmit: number;
}

const NO_SPAWNERS = {
  spawners: { min: 0, max: 0 },
  spawnerAtSec: { min: 0, max: 0 },
  spawnerEmitEverySec: 0,
  spawnerDartsPerEmit: 0,
} as const;

/**
 * V2 target shares, docs/11 section 6.3, as roster weights out of 100. Only the v2 enemy stage
 * reads these: the v1 roster and wave passes walk ENEMY_KINDS, which holds no v2 kind, so v1
 * output is byte identical. The validator reads them for band eligibility.
 */
const V2_WEIGHTS = {
  1: { charger: 0, bulwark: 0, blink: 0, swirl: 0, sower: 0, splime: 0 },
  2: { charger: 12, bulwark: 0, blink: 0, swirl: 10, sower: 0, splime: 8 },
  3: { charger: 16, bulwark: 12, blink: 10, swirl: 12, sower: 0, splime: 10 },
  4: { charger: 18, bulwark: 16, blink: 14, swirl: 12, sower: 10, splime: 10 },
} as const;

/**
 * Leaver roster weight per band: the Weaver's (20 in band 3, 18 in band 4). Bands 1 and 2 are 0;
 * the Leaver stage (leaver.ts) reads these, and Adventure gates it further to LEAVER_FROM_LEVEL.
 * Endless segments from LEAVER_FROM_SEGMENT (band 2 by index) use LEAVER_ENDLESS_WEIGHT.
 */
export const LEAVER_WEIGHTS: Readonly<Record<Band, number>> = { 1: 0, 2: 0, 3: 20, 4: 18 };
/** First Adventure level that may hold a Leaver (band 3 starts at 16). */
export const LEAVER_FROM_LEVEL = 21;
/** First Endless segment that may hold a Leaver: 30 s segments, so 3 minutes in. */
export const LEAVER_FROM_SEGMENT = 6;
/** Leaver roster weight in an Endless segment before band 3 (the Weaver's band 2 weight). */
export const LEAVER_ENDLESS_WEIGHT = 20;

export const BANDS: Readonly<Record<Band, BandParams>> = {
  1: {
    arenaHeight: { min: 700, max: 760 },
    aspect: { min: 1.3, max: 1.5 },
    shapeWeights: { rect: 40, roundRect: 30, circle: 15, hexagon: 15, rectObstacles: 0 },
    obstacleCount: { min: 0, max: 0 },
    rosterSize: { min: 3, max: 3 },
    rosterWeights: { grunt: 40, wanderer: 35, weaver: 0, pinwheel: 25, dart: 0, snake: 0, ...V2_WEIGHTS[1], leaver: LEAVER_WEIGHTS[1] },
    droneWeights: { attack: 100, collect: 0, ram: 0 },
    superWeights: { homing: 34, detonate: 0, turbo: 66 },
    objectiveWeights: { scoreInTime: 20, survive: 40, destroy: 40 },
    surviveSec: { min: 45, max: 60 },
    destroyCount: { min: 30, max: 50 },
    scoreTimeSec: { min: 60, max: 60 },
    intervalStartSec: 6.0,
    intervalEndSec: 4.0,
    rampSec: 60,
    rampExponent: 1.0,
    budgetStart: 3,
    budgetEnd: 8,
    groupsPerWave: { min: 1, max: 2 },
    maxLiveEnemies: 60,
    scheduleSec: 120,
    maxLiveSnakes: 0,
    wells: { min: 0, max: 0 },
    ...NO_SPAWNERS,
  },
  2: {
    arenaHeight: { min: 760, max: 880 },
    aspect: { min: 1.3, max: 1.6 },
    shapeWeights: { rect: 25, roundRect: 25, circle: 15, hexagon: 15, rectObstacles: 20 },
    obstacleCount: { min: 1, max: 1 },
    rosterSize: { min: 3, max: 4 },
    rosterWeights: { grunt: 30, wanderer: 20, weaver: 20, pinwheel: 15, dart: 15, snake: 0, ...V2_WEIGHTS[2], leaver: LEAVER_WEIGHTS[2] },
    droneWeights: { attack: 50, collect: 30, ram: 20 },
    superWeights: { homing: 34, detonate: 33, turbo: 33 },
    objectiveWeights: { scoreInTime: 34, survive: 33, destroy: 33 },
    surviveSec: { min: 60, max: 90 },
    destroyCount: { min: 60, max: 100 },
    scoreTimeSec: { min: 75, max: 90 },
    intervalStartSec: 5.0,
    intervalEndSec: 3.0,
    rampSec: 90,
    rampExponent: 1.2,
    budgetStart: 5,
    budgetEnd: 12,
    groupsPerWave: { min: 1, max: 3 },
    maxLiveEnemies: 90,
    scheduleSec: 150,
    maxLiveSnakes: 0,
    wells: { min: 0, max: 1 },
    ...NO_SPAWNERS,
  },
  3: {
    arenaHeight: { min: 860, max: 1000 },
    aspect: { min: 1.35, max: 1.7 },
    shapeWeights: { rect: 15, roundRect: 15, circle: 15, hexagon: 20, rectObstacles: 35 },
    obstacleCount: { min: 1, max: 2 },
    rosterSize: { min: 4, max: 5 },
    rosterWeights: { grunt: 25, wanderer: 12, weaver: 20, pinwheel: 10, dart: 18, snake: 15, ...V2_WEIGHTS[3], leaver: LEAVER_WEIGHTS[3] },
    droneWeights: { attack: 34, collect: 33, ram: 33 },
    superWeights: { homing: 34, detonate: 33, turbo: 33 },
    objectiveWeights: { scoreInTime: 34, survive: 33, destroy: 33 },
    surviveSec: { min: 75, max: 105 },
    destroyCount: { min: 100, max: 150 },
    scoreTimeSec: { min: 90, max: 105 },
    intervalStartSec: 4.5,
    intervalEndSec: 2.5,
    rampSec: 120,
    rampExponent: 1.4,
    budgetStart: 6,
    budgetEnd: 16,
    groupsPerWave: { min: 1, max: 3 },
    maxLiveEnemies: 120,
    scheduleSec: 180,
    maxLiveSnakes: 2,
    wells: { min: 1, max: 2 },
    spawners: { min: 0, max: 1 },
    spawnerAtSec: { min: 20, max: 40 },
    spawnerEmitEverySec: 6.0,
    spawnerDartsPerEmit: 5,
  },
  4: {
    arenaHeight: { min: 940, max: 1100 },
    aspect: { min: 1.4, max: 1.8 },
    shapeWeights: { rect: 10, roundRect: 10, circle: 15, hexagon: 20, rectObstacles: 45 },
    obstacleCount: { min: 1, max: 3 },
    rosterSize: { min: 5, max: 6 },
    rosterWeights: { grunt: 20, wanderer: 8, weaver: 18, pinwheel: 8, dart: 20, snake: 16, ...V2_WEIGHTS[4], leaver: LEAVER_WEIGHTS[4] },
    droneWeights: { attack: 34, collect: 33, ram: 33 },
    superWeights: { homing: 34, detonate: 33, turbo: 33 },
    objectiveWeights: { scoreInTime: 34, survive: 33, destroy: 33 },
    surviveSec: { min: 90, max: 120 },
    destroyCount: { min: 150, max: 220 },
    scoreTimeSec: { min: 105, max: 120 },
    intervalStartSec: 4.0,
    intervalEndSec: 2.0,
    rampSec: 120,
    rampExponent: 1.6,
    budgetStart: 8,
    budgetEnd: 20,
    groupsPerWave: { min: 1, max: 3 },
    maxLiveEnemies: 160,
    scheduleSec: 180,
    maxLiveSnakes: 3,
    wells: { min: 1, max: 3 },
    spawners: { min: 1, max: 2 },
    spawnerAtSec: { min: 10, max: 30 },
    spawnerEmitEverySec: 5.0,
    spawnerDartsPerEmit: 5,
  },
};

// Long level tables (release polish, docs/14 item 7). Read only with GenConfig.enableLongLevels on.

/** Least expected play time of a non boss level, s. */
export const LONG_MIN_LEVEL_SEC = 300;
/** Least gap between two plays of the same wave (the loop period floor), s. */
export const LONG_MIN_REPEAT_SEC = 90;
/** Calmer opening: seconds at reduced budget before the first build. */
export const LONG_CALM_SEC = 60;
/** Breather after each peak, s. */
export const LONG_BREATHER_SEC = 10;
/** Waves keep coming this long past the objective time before the loop takes over, s. */
export const LONG_SCHEDULE_PAD_SEC = 10;

export interface LongBandParams {
  surviveSec: IntRange; // step 5
  /** Destroy: target clear time; the count is sized from the waves so the clear takes this long. Step 5. */
  destroySec: IntRange;
  scoreTimeSec: IntRange; // step 15
  /** Budget and interval ramp length over the longer level. */
  rampSec: number;
  /** Seconds from one intensity peak to the next, 60 to 90. */
  peakEverySec: number;
}

export const LONG_BANDS: Readonly<Record<Band, LongBandParams>> = {
  1: { surviveSec: { min: 300, max: 300 }, destroySec: { min: 300, max: 300 }, scoreTimeSec: { min: 300, max: 300 }, rampSec: 180, peakEverySec: 90 },
  2: { surviveSec: { min: 300, max: 330 }, destroySec: { min: 300, max: 330 }, scoreTimeSec: { min: 300, max: 330 }, rampSec: 210, peakEverySec: 80 },
  3: { surviveSec: { min: 300, max: 345 }, destroySec: { min: 300, max: 345 }, scoreTimeSec: { min: 300, max: 345 }, rampSec: 240, peakEverySec: 75 },
  4: { surviveSec: { min: 315, max: 360 }, destroySec: { min: 315, max: 360 }, scoreTimeSec: { min: 315, max: 360 }, rampSec: 240, peakEverySec: 60 },
};

/** BANDS[band] with the long objective ranges and ramp. destroyCount is unused on a long level. */
export function longBandParams(band: Band): BandParams {
  const l = LONG_BANDS[band];
  return { ...BANDS[band], surviveSec: l.surviveSec, scoreTimeSec: l.scoreTimeSec, rampSec: l.rampSec };
}

// Release gate R3 tables (version 8). Ryan: "5 minute required play on the same level is too long.
// Average level play should be 3.5 minutes." Non boss objectives sit at 200 to 230 s (mean about
// 212 s); the ramp is shortened to match, so the level still reaches full intensity. Peaks keep the
// LONG_BANDS spacing, so the v6 pulse (calm, builds, breathers, lulls) is unchanged.

/** Target mean expected play of a non boss version 8 level, s. */
export const R3_MEAN_LEVEL_SEC = 210;
/** Least and most objective seconds of a non boss version 8 level. */
export const R3_MIN_LEVEL_SEC = 200;
export const R3_MAX_LEVEL_SEC = 230;

export const R3_BANDS: Readonly<Record<Band, LongBandParams>> = {
  1: { surviveSec: { min: 200, max: 210 }, destroySec: { min: 200, max: 210 }, scoreTimeSec: { min: 200, max: 215 }, rampSec: 120, peakEverySec: 90 },
  2: { surviveSec: { min: 200, max: 215 }, destroySec: { min: 200, max: 215 }, scoreTimeSec: { min: 200, max: 215 }, rampSec: 140, peakEverySec: 80 },
  3: { surviveSec: { min: 200, max: 220 }, destroySec: { min: 205, max: 220 }, scoreTimeSec: { min: 200, max: 230 }, rampSec: 160, peakEverySec: 75 },
  4: { surviveSec: { min: 205, max: 225 }, destroySec: { min: 205, max: 225 }, scoreTimeSec: { min: 200, max: 230 }, rampSec: 160, peakEverySec: 60 },
};

/**
 * Objective table of a version 8 level: R3_BANDS on a non boss level, LONG_BANDS on a boss level
 * (its 300 s and longer objective only holds the level after the 3 minute fight), with the R3 ramp.
 */
export function r3ObjectiveTable(band: Band, boss: boolean): LongBandParams {
  return boss ? { ...LONG_BANDS[band], rampSec: R3_BANDS[band].rampSec } : R3_BANDS[band];
}

/** BANDS[band] with the version 8 objective ranges and ramp. */
export function r3BandParams(band: Band, boss: boolean): BandParams {
  const l = r3ObjectiveTable(band, boss);
  return { ...BANDS[band], surviveSec: l.surviveSec, scoreTimeSec: l.scoreTimeSec, rampSec: l.rampSec };
}

/** docs/02 table 4.2, rounded to 2 decimals. */
export function speedScaleFor(levelIndex: number): number {
  const band = bandOf(levelIndex);
  if (band === 1) return 1.0;
  if (band === 2) return 1.05;
  if (band === 3) return 1.1;
  return round2(Math.min(1.4, 1.2 + 0.005 * (levelIndex - 31)));
}

/** docs/02 section 10: Endless segment s plays as level 1 + 2s. */
export function effectiveIndexOf(segment: number): number {
  return 1 + 2 * segment;
}

export const ENDLESS_SEGMENT_SEC = 30;

/** docs/01 section 2.2: fixed Endless arena. Not generated. */
export const ENDLESS_ARENA: Readonly<ArenaDef> = Object.freeze({
  shape: 'rect',
  width: 1600,
  height: 1000,
  cornerRadius: 0,
  obstacles: [],
  spawnPoint: { x: 0, y: 0 },
});

// W2: Endless game definition (docs/01 section 2.2, docs/05 W2 task 2). Waves are not stored here
// because the ramp is unbounded: Ledger asks generateEndlessSegment(endlessSeed, s) for segment s.

/** Extra spawn units per segment once Endless reaches band 4 (segment 15 onward). No upper bound. */
export const ENDLESS_BUDGET_PER_SEGMENT = 1;
/** First segment whose effective index is in band 4: 1 + 2 x 15 = 31. */
export const ENDLESS_BAND4_SEGMENT = 15;

export interface EndlessDef {
  version: typeof LEVELDEF_VERSION;
  generatorVersion: number;
  mode: 'endless';
  endlessSeed: number;
  surface: SurfaceKind;
  /** Fixed 1600 x 1000 rect, ENDLESS_ARENA. */
  arena: ArenaDef;
  /** Full catalogue the segments ramp through, with band 4 weights (minus GenConfig cuts). */
  roster: RosterEntry[];
  drone: 'attack';
  superType: 'turbo';
  lives: number; // 3 at start
  bombs: number; // 3 at start
  extraLifeEvery: number; // 100000 points
  extraBombEvery: number; // 150000 points
  maxLives: number; // 9
  maxBombs: number; // 9
  objective: { kind: 'none' };
  hazards: HazardDef; // always empty in v1
  segmentSec: number; // ENDLESS_SEGMENT_SEC
  /** Spawn units added per segment from ENDLESS_BAND4_SEGMENT onward: the unbounded ramp. */
  budgetPerSegment: number;
  band4Segment: number;
  /** Release gate R2: present only on a Free Play def (freePlayLevel). Absent on plain Endless. */
  freePlay?: FreePlayInfo;
}

/** Release gate R2: the Free Play arena choice. */
export type FreePlayArena = 'rect' | 'circle' | 'drum';

/** What a Free Play def was built from, plus its deterministic re-derive count. */
export interface FreePlayInfo {
  arena: FreePlayArena;
  barriers: boolean;
  /** Drum with barriers: the layout drawn ('rings' or 'pillars'); null otherwise. */
  drumPattern: 'rings' | 'pillars' | null;
  /** Re-derives (0 to MAX_RETRIES) before the def passed validateFreePlay. */
  retries: number;
  /**
   * Free Play options (docs/14): the level side of the FreePlayConfig the def was built from.
   * Absent when no config was passed (today's Free Play, byte for byte).
   */
  options?: FreePlayLevelOptions;
}

/** The level side of a FreePlayConfig, as stored on the def (freeplay.ts levelOptionsOf). */
export interface FreePlayLevelOptions {
  /** Chosen kinds in ALL_ENEMY_KINDS order, only kinds the run's catalogue has; empty: the normal roster. */
  enemies: EnemyKind[];
  density: FreePlayDensity;
  bosses: FreePlayBosses;
  wells: FreePlayWells;
  size: FreePlaySize;
  /** Trough wave: present only as 'trough' (a trough arena, version 12); absent is flat, so older defs keep their bytes. */
  surface?: 'trough';
}

/** Recursive Object.freeze. Returns its argument. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    // Same members as Object.values (own enumerable string keys).
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec);
    for (let i = 0; i < keys.length; i++) {
      const v = rec[keys[i] ?? ''];
      // Primitives need no call: freezing only ever applies to objects.
      if (typeof v === 'object' && v !== null) deepFreeze(v);
    }
  }
  return value;
}
