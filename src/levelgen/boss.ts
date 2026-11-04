// V3 boss schedule (docs/12 wave V3-A "Design: the boss schedule", docs/13 SPEC 3.3 and 3.4).
// Pure table lookups: no PRNG, no Date, no DOM. The generator draws nothing new for a boss, so a
// boss level differs from its v2.1 self only by the boss field, the version and the hazard step.
import type { BossId, BossSpec, BossTier, HazardDef } from './leveldef';

/** A level is a boss level when levelIndex % BOSS_EVERY === 0 (levels 5, 10, 15 and so on). */
export const BOSS_EVERY = 5;
/** An Endless segment carries a boss when it is a positive multiple of this (3:00, 6:00, 9:00). */
export const BOSS_SEGMENT_EVERY = 6;
/** Wave clock second of the boss entrance on an Adventure level. */
export const BOSS_LEVEL_AT_SEC = 20;
/**
 * Release gate R2: wave clock second of the boss entrance on a long level built with the R1
 * pacing (the default config, GENERATOR_VERSION_V7). Ryan found 240 s a little long.
 */
export const BOSS_LONG_LEVEL_AT_SEC = 200;
/**
 * Release polish (docs/14 item 7): the boss entrance on a version 5 long level (enableLongLevels
 * on, enableR1Pacing off). At least 4 minutes of regular waves come first.
 */
export const BOSS_V5_LEVEL_AT_SEC = 240;
/**
 * Release gate R3: the boss entrance on a version 8 level (the default config). Two minutes of
 * dense waves, then a fight of about BOSS_FIGHT_SEC: about 5 minutes in all.
 */
export const BOSS_R3_LEVEL_AT_SEC = 120;
/** Expected seconds of a boss fight (Ryan, R3: "about 3 minutes", accepted). Par counts the waves of this window. */
export const BOSS_FIGHT_SEC = 180;
/** Share of par the game pays as the boss kill bonus (src/game/scoring.ts BOSS_BONUS_SHARE), copied to keep levelgen standalone. */
export const BOSS_BONUS_SHARE = 0.25;
/** Seconds after the segment start of the boss entrance in Endless. */
export const BOSS_SEGMENT_AT_SEC = 10;
/** Index in BOSS_SCHEDULE that every pass after the first restarts from (ember, the first tier 2 boss). */
export const BOSS_LOOP_FROM = 3;
/** Extra hit point multiplier per completed pass of the list. */
export const BOSS_HP_PER_PASS = 0.25;
/** Most gravity wells a boss level keeps (rule 12). */
export const BOSS_MAX_WELLS = 1;

export interface BossScheduleRow {
  levelIndex: number;
  id: BossId;
  tier: BossTier;
}

/** The plan table, pass 1. Ryan changes one number here, nowhere else. */
export const BOSS_SCHEDULE: readonly Readonly<BossScheduleRow>[] = Object.freeze([
  Object.freeze<BossScheduleRow>({ levelIndex: 5, id: 'warden', tier: 1 }),
  Object.freeze<BossScheduleRow>({ levelIndex: 10, id: 'brood', tier: 1 }),
  Object.freeze<BossScheduleRow>({ levelIndex: 15, id: 'spindle', tier: 1 }),
  Object.freeze<BossScheduleRow>({ levelIndex: 20, id: 'ember', tier: 2 }),
  Object.freeze<BossScheduleRow>({ levelIndex: 25, id: 'mirage', tier: 2 }),
  Object.freeze<BossScheduleRow>({ levelIndex: 30, id: 'gravitas', tier: 2 }),
  Object.freeze<BossScheduleRow>({ levelIndex: 35, id: 'bastion', tier: 3 }),
  Object.freeze<BossScheduleRow>({ levelIndex: 40, id: 'tempest', tier: 3 }),
  Object.freeze<BossScheduleRow>({ levelIndex: 45, id: 'twins', tier: 3 }),
  Object.freeze<BossScheduleRow>({ levelIndex: 50, id: 'prism', tier: 4 }),
]);

/** Tier of a boss id from the schedule table, or null for an id the table does not name. */
export function bossTierOf(id: string): BossTier | null {
  const row = BOSS_SCHEDULE.find((r) => r.id === id);
  return row === undefined ? null : row.tier;
}

/**
 * Boss number j (1 based) to its spec. j 1 to 10 is pass 1 (warden to prism, hpMul 1). From j 11
 * the list loops from ember in passes of seven: j 11 to 17 is pass 2 (hpMul 1.25), 18 to 24 pass 3
 * (1.5), and each pass adds 0.25.
 */
export function bossOfNumber(j: number, atSec: number): BossSpec | null {
  if (!Number.isInteger(j) || j < 1) return null;
  const n = BOSS_SCHEDULE.length;
  let row: Readonly<BossScheduleRow> | undefined;
  let pass: number;
  if (j <= n) {
    row = BOSS_SCHEDULE[j - 1];
    pass = 1;
  } else {
    const loopLen = n - BOSS_LOOP_FROM;
    const m = j - n - 1;
    row = BOSS_SCHEDULE[BOSS_LOOP_FROM + (m % loopLen)];
    pass = 2 + Math.floor(m / loopLen);
  }
  if (row === undefined) return null;
  return { id: row.id, tier: row.tier, atSec, hpMul: 1 + BOSS_HP_PER_PASS * (pass - 1) };
}

/** The boss of Adventure level n, or null when n is not a boss level (a positive multiple of 5). atSec: the entrance second. */
export function bossForLevel(levelIndex: number, atSec: number = BOSS_LEVEL_AT_SEC): BossSpec | null {
  if (!Number.isInteger(levelIndex) || levelIndex < BOSS_EVERY || levelIndex % BOSS_EVERY !== 0) return null;
  return bossOfNumber(levelIndex / BOSS_EVERY, atSec);
}

/** The boss of Endless segment s (0 based), or null unless s is a positive multiple of 6. */
export function bossForSegment(segment: number): BossSpec | null {
  if (!Number.isInteger(segment) || segment < BOSS_SEGMENT_EVERY || segment % BOSS_SEGMENT_EVERY !== 0) return null;
  return bossOfNumber(segment / BOSS_SEGMENT_EVERY, BOSS_SEGMENT_AT_SEC);
}

/** Rule 12 post step on a boss level: no spawners, wells beyond the first removed. Pure, keeps order. */
export function bossHazards(h: HazardDef): HazardDef {
  return { wells: h.wells.slice(0, BOSS_MAX_WELLS), spawners: [] };
}

/** True when two specs name the same boss (id, tier, entrance second and hit point multiplier). */
export function sameBoss(a: BossSpec, b: BossSpec): boolean {
  return a.id === b.id && a.tier === b.tier && a.atSec === b.atSec && a.hpMul === b.hpMul;
}

/**
 * R5 (Ryan, build 405facc: "Bosses should appear within 2 minutes, then if endless appear again
 * after 5 minutes"): Free Play boss segments. The first is FREE_PLAY_BOSS_FIRST_SEGMENT (entrance
 * at 3 x 30 + 10 = 100 s on the wave clock), then one every FREE_PLAY_BOSS_EVERY_SEGMENTS (300 s
 * after the previous entrance: 400 s, 700 s and so on). The plain Endless ladder (bossForSegment,
 * every 180 s) is unchanged.
 */
export const FREE_PLAY_BOSS_FIRST_SEGMENT = 3;
export const FREE_PLAY_BOSS_EVERY_SEGMENTS = 10;
/**
 * Bosses a drum keeps. Every boss steers through steer.ts, which wraps across the u seam since
 * V3-H C0, but these two also centre every attack on their own body (Warden's rings, Brood's
 * charge lane and pods), so nothing they make is laid out on the flat arena centre or its walls.
 */
export const FREE_PLAY_DRUM_BOSSES: readonly BossId[] = Object.freeze<BossId[]>(['warden', 'brood']);

/** Boss number (1 based) of Free Play segment s, or null when s carries no boss. */
export function freePlayBossNumber(segment: number): number | null {
  if (!Number.isInteger(segment) || segment < FREE_PLAY_BOSS_FIRST_SEGMENT) return null;
  const k = segment - FREE_PLAY_BOSS_FIRST_SEGMENT;
  return k % FREE_PLAY_BOSS_EVERY_SEGMENTS === 0 ? 1 + k / FREE_PLAY_BOSS_EVERY_SEGMENTS : null;
}

/**
 * Free Play options (docs/14): the boss of segment s. 'off': none. 'every3': the tier ladder
 * (bossOfNumber) on the Free Play cadence. A BossId: that boss each time, its hit point multiplier
 * from the ladder's pass at the same boss number. A drum keeps only FREE_PLAY_DRUM_BOSSES: the
 * ladder alternates them, and a chosen boss outside them fights as Warden. Pure, no draw.
 */
export function freePlayBossFor(bosses: 'off' | 'every3' | BossId, segment: number, cylinder: boolean): BossSpec | null {
  if (bosses === 'off') return null;
  const j = freePlayBossNumber(segment);
  const ladder = j === null ? null : bossOfNumber(j, BOSS_SEGMENT_AT_SEC);
  if (j === null || ladder === null) return null;
  let id: BossId;
  if (bosses === 'every3') id = cylinder ? (FREE_PLAY_DRUM_BOSSES[(j - 1) % FREE_PLAY_DRUM_BOSSES.length] ?? 'warden') : ladder.id;
  else id = cylinder && !FREE_PLAY_DRUM_BOSSES.includes(bosses) ? 'warden' : bosses;
  const tier = bossTierOf(id);
  return tier === null ? null : { id, tier, atSec: ladder.atSec, hpMul: ladder.hpMul };
}
