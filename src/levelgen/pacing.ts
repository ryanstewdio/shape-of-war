// Long level pacing and duration estimates (release polish, docs/14 item 7). Pure: no PRNG, no
// Date, no DOM. The generator reads pulseAt and destroyCountFor; tests and the validator read the
// estimates. A competent player kills KILL_RATE of the spawns (the par model), so a destroy clear
// lands on the spawn numbered ceil(count / KILL_RATE).
import { expandSpawns, forEachSpawn } from './leveldef';
import type { LevelDef, ObjectiveDef, WaveSchedule } from './leveldef';
import { KILL_RATE, MAX_EST_SEC } from './validate';

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

/**
 * Shortest gap between two plays of the same wave before tEndSec: the loop period once a looped
 * copy starts before tEndSec, else Infinity (every wave plays once).
 */
export function nearestRepeatSec(w: WaveSchedule, tEndSec: number): number {
  const start = w.waves[w.loopFromIndex];
  if (w.loopFromIndex < 0 || w.loopPeriodSec <= 0 || start === undefined) return Infinity;
  return start.atSec + w.loopPeriodSec < tEndSec ? w.loopPeriodSec : Infinity;
}
