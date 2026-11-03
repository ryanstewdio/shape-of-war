// Long level pacing and duration estimates (release polish, docs/14 item 7). Pure: no PRNG, no
// Date, no DOM. The generator reads pulseAt and destroyCountFor; tests and the validator read the
// estimates. A competent player kills KILL_RATE of the spawns (the par model), so a destroy clear
// lands on the spawn numbered ceil(count / KILL_RATE).
import { ENEMY_BASE, ENEMY_GEOMS, R1_STAR_MULS, expandSpawns, forEachSpawn } from './leveldef';
import type { EnemyKind, LevelDef, ObjectiveDef, WaveSchedule } from './leveldef';
import { KILL_RATE, MAX_EST_SEC, PAR_MIN, PAR_STEP } from './validate';
import { BOSS_BONUS_SHARE, BOSS_FIGHT_SEC } from './boss';

export interface PulseShape {
  /** Seconds of calmer opening. */
  calmSec: number;
  /** Seconds from one peak to the next. */
  peakEverySec: number;
  /** Seconds of breather right after each peak. */
  breatherSec: number;
}

/** Multipliers on the ramped wave budget and the wave interval at one moment. */
export interface Pulse {
  budget: number;
  interval: number;
}

export const CALM_BUDGET = 0.7;
export const CALM_INTERVAL = 1.25;
export const BUILD_BUDGET_LOW = 0.85;
export const BUILD_BUDGET_PEAK = 1.3;
export const BREATHER_BUDGET = 0.45;
export const BREATHER_INTERVAL = 1.6;

/**
 * Intensity at wave clock t. First calmSec: calm. Then repeating cycles of peakEverySec: a build
 * from BUILD_BUDGET_LOW to BUILD_BUDGET_PEAK, the peak, then breatherSec of breather.
 */
export function pulseAt(s: PulseShape, t: number): Pulse {
  if (t < s.calmSec) return { budget: CALM_BUDGET, interval: CALM_INTERVAL };
  const build = s.peakEverySec - s.breatherSec;
  const phase = (t - s.calmSec) % s.peakEverySec;
  if (phase >= build) return { budget: BREATHER_BUDGET, interval: BREATHER_INTERVAL };
  return { budget: BUILD_BUDGET_LOW + ((BUILD_BUDGET_PEAK - BUILD_BUDGET_LOW) * phase) / build, interval: 1 };
}

/** True during a breather (the last breatherSec of each cycle after the calm opening). */
export function inBreather(s: PulseShape, t: number): boolean {
  if (t < s.calmSec) return false;
  return (t - s.calmSec) % s.peakEverySec >= s.peakEverySec - s.breatherSec;
}

/** Number of spawns with t < tSec. */
export function spawnsBefore(w: WaveSchedule, tSec: number): number {
  let n = 0;
  forEachSpawn(w, tSec, () => {
    n++;
  });
  return n;
}

/** Spawns a competent player must see to destroy count enemies (as computePar and W9). */
export const spawnsNeeded = (count: number, killRate: number = KILL_RATE): number => Math.ceil(count / killRate);

/**
 * Least multiple of 5 destroy count whose clear needs a spawn at or after clearSec: more spawns
 * needed than come before clearSec.
 */
export function destroyCountFor(w: WaveSchedule, clearSec: number, killRate: number = KILL_RATE): number {
  const before = spawnsBefore(w, clearSec);
  let c = Math.max(5, 5 * Math.floor((before * killRate) / 5));
  while (spawnsNeeded(c, killRate) <= before) c += 5;
  return c;
}

/** Expected clear second of a destroy count: the time of the needed spawn, or MAX_EST_SEC if it never comes. */
export function destroyClearSec(w: WaveSchedule, count: number, killRate: number = KILL_RATE): number {
  const need = spawnsNeeded(count, killRate);
  const all = expandSpawns(w, MAX_EST_SEC);
  const s = all[need - 1];
  return s === undefined ? MAX_EST_SEC : s.t;
}

/** Expected seconds to meet an objective: its clock for survive and scoreInTime, the clear time for destroy. */
export function objectiveSec(o: ObjectiveDef, w: WaveSchedule): number {
  if (o.kind === 'survive') return o.durationSec;
  if (o.kind === 'scoreInTime') return o.timeLimitSec;
  return destroyClearSec(w, o.count);
}

export interface DurationEstimate {
  /** Expected seconds of regular play: the objective time, cut at the boss entrance on a boss level. */
  wavesSec: number;
  /** True on a boss level (the boss fight follows wavesSec). */
  boss: boolean;
}

/**
 * Expected duration of a level for a competent player. A boss enters at its atSec or when the
 * objective is met (the hold), whichever is first, so a boss level's waves last the lesser.
 */
export function estimateDuration(def: Pick<LevelDef, 'objective' | 'waves' | 'boss'>): DurationEstimate {
  const t = objectiveSec(def.objective, def.waves);
  if (def.boss === undefined) return { wavesSec: t, boss: false };
  return { wavesSec: Math.min(t, def.boss.atSec), boss: true };
}

// R1 whole level par. The legacy par (computePar) scaled the multiplier from a 0.1 geom rate and
// halved the result, which on a 5 minute level put a strong full run at 6x par. This one walks the
// spawns in time order over the expected duration: a competent player kills KILL_RATE of each
// spawn, scoring base x multiplier, and collects R1_COLLECT_RATE of the geoms the kills drop,
// each geom adding 1 to the multiplier (capped as the sim caps it). par is the total.

/** Geoms a competent player collects per geom dropped. Calibrated on Ryan's R1 level 6 run. */
export const R1_COLLECT_RATE = 0.45;
/** The sim's multiplier cap (src/game/scoring.ts MULTIPLIER_CAP), copied to keep levelgen standalone. */
export const R1_MULTIPLIER_CAP = 999;
const toParGrid = (v: number): number => Math.max(PAR_MIN, Math.round(v / PAR_STEP) * PAR_STEP);

/**
 * Expected whole level score of a competent player: spawns before the objective time (survive,
 * scoreInTime) or the first ceil(count / KILL_RATE) spawns (destroy), in time order.
 */
export function wholeLevelScore(w: WaveSchedule, o: ObjectiveDef, killRate: number = KILL_RATE, collectRate: number = R1_COLLECT_RATE): number {
  const all = expandSpawns(w, o.kind === 'destroy' ? MAX_EST_SEC : o.kind === 'survive' ? o.durationSec : o.timeLimitSec);
  const n = o.kind === 'destroy' ? Math.min(all.length, spawnsNeeded(o.count, killRate)) : all.length;
  return scoreOfFirst(all, n, killRate, collectRate);
}

/** The R1 formula over the first n spawns of a time sorted list. */
function scoreOfFirst(all: readonly { kind: EnemyKind }[], n: number, killRate: number, collectRate: number): number {
  let score = 0;
  let geoms = 0;
  for (let i = 0; i < n; i++) {
    const s = all[i];
    if (s === undefined) continue;
    score += killRate * ENEMY_BASE[s.kind] * Math.min(R1_MULTIPLIER_CAP, 1 + collectRate * geoms);
    geoms += killRate * ENEMY_GEOMS[s.kind];
  }
  return score;
}

/** The R1 formula over every spawn before tSec (a boss level's waves before and during the fight). */
export function scoreUntil(w: WaveSchedule, tSec: number, killRate: number = KILL_RATE, collectRate: number = R1_COLLECT_RATE): number {
  const all = expandSpawns(w, tSec);
  return scoreOfFirst(all, all.length, killRate, collectRate);
}

/** R1 par (on the 500 grid, at least PAR_MIN) and its stars at R1_STAR_MULS x par, each on the grid. */
export function wholeLevelPar(w: WaveSchedule, o: ObjectiveDef, collectRate: number = R1_COLLECT_RATE): { par: number; stars: [number, number, number] } {
  const par = toParGrid(wholeLevelScore(w, o, KILL_RATE, collectRate));
  return { par, stars: r1Stars(par) };
}

// Release gate R3 (version 8): whole level par on boss levels too. A boss level's waves play from
// the start to the end of the fight (the entrance plus BOSS_FIGHT_SEC), or to the objective time if
// that comes first (the hold stops the waves). The boss kill pays BOSS_BONUS_SHARE of par on top,
// so par P solves P = S + share x P: P = S / (1 - share).

/** Geoms collected per geom dropped in the version 8 par. Calibrated on the scripted strong run. */
export const R3_COLLECT_RATE = 0.5;

/** Seconds of waves a boss level plays for a competent player: to the end of the fight or the hold. */
export function bossWavesSec(w: WaveSchedule, o: ObjectiveDef, atSec: number): number {
  return Math.min(objectiveSec(o, w), atSec + BOSS_FIGHT_SEC);
}

/** Version 8 boss level par: the waves before and during the fight plus the boss bonus, on the grid. */
export function bossLevelPar(w: WaveSchedule, o: ObjectiveDef, atSec: number, collectRate: number = R3_COLLECT_RATE): { par: number; stars: [number, number, number] } {
  const par = toParGrid(scoreUntil(w, bossWavesSec(w, o, atSec), KILL_RATE, collectRate) / (1 - BOSS_BONUS_SHARE));
  return { par, stars: r1Stars(par) };
}

/** Stars of an R1 par. */
export function r1Stars(par: number): [number, number, number] {
  return [toParGrid(par * R1_STAR_MULS[0]), toParGrid(par * R1_STAR_MULS[1]), toParGrid(par * R1_STAR_MULS[2])];
}

/** R1 dead air model: seconds an enemy stays alive (0.6 s telegraph plus a strong player's kill time). */
export const DEAD_AIR_LIVE_SEC = 2;
/** R1: fewer live enemies than this counts as dead air. */
export const DEAD_AIR_MIN_LIVE = 3;
/** R1: dead air is not checked in the first seconds of a level. */
export const DEAD_AIR_FROM_SEC = 10;
/** R1: longest dead air allowed anywhere, and the longest allowed as a breather right after a peak. */
export const DEAD_AIR_MAX_SEC = 3;
export const DEAD_AIR_BREATHER_SEC = 4;

export interface DeadAirGap {
  startSec: number;
  lenSec: number;
}

/**
 * Stretches of [fromSec, toSec) with fewer than minLive enemies alive, when every spawn lives
 * liveSec from its spawn time (the dead air model). Pure; allocates, so test and generation time only.
 */
export function deadAirGaps(
  w: WaveSchedule,
  fromSec: number,
  toSec: number,
  liveSec: number = DEAD_AIR_LIVE_SEC,
  minLive: number = DEAD_AIR_MIN_LIVE,
): DeadAirGap[] {
  const ev: Array<[number, number]> = [];
  forEachSpawn(w, toSec, (t) => {
    if (t + liveSec > fromSec) ev.push([t, 1], [t + liveSec, -1]);
  });
  // Deaths sort before births at the same instant, so back to back lives do not overlap.
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const gaps: DeadAirGap[] = [];
  let live = 0;
  let gapStart: number | null = fromSec;
  for (const [t, d] of ev) {
    const at = Math.min(Math.max(t, fromSec), toSec);
    live += d;
    if (live >= minLive && gapStart !== null) {
      if (at > gapStart) gaps.push({ startSec: gapStart, lenSec: at - gapStart });
      gapStart = null;
    } else if (live < minLive && gapStart === null) {
      gapStart = at;
    }
  }
  if (gapStart !== null && toSec > gapStart) gaps.push({ startSec: gapStart, lenSec: toSec - gapStart });
  return gaps;
}

/**
 * Shortest gap between two plays of the same wave before tEndSec: the loop period once a looped
 * copy starts before tEndSec, else Infinity (every wave plays once).
 */
export function nearestRepeatSec(w: WaveSchedule, tEndSec: number): number {
  const start = w.waves[w.loopFromIndex];
  if (w.loopFromIndex < 0 || w.loopPeriodSec <= 0 || start === undefined) return Infinity;
  return start.atSec + w.loopPeriodSec < tEndSec ? w.loopPeriodSec : Infinity;
}
