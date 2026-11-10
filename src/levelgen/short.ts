// Short levels (version 11, Ryan 2026-11-10). Tester: "3.5 minute levels are too long, especially
// level 1, and repetitive." Ryan ruled: level 1 about 90 s, rising to 2 to 3 minutes after level 4;
// match time varies from level to level; some levels are a race to score a target before time runs
// out; each minute brings something new. Pure: no Date, no DOM, no Math.random. Every draw here is
// a mulberry32 stream on its own salt, so no draw of an older stage moves.
import { fmix32, mulberry32, rngPick, streamSeed } from '../core/rng';
import type { Rng } from '../core/rng';
import { BANDS, LONG_BANDS, LONG_BREATHER_SEC, LONG_CALM_SEC, R3_BANDS, R3_MEAN_LEVEL_SEC, bandOf, levelSeed } from './leveldef';
import type { Band, LongBandParams, ObjectiveDef } from './leveldef';
import type { PulseShape } from './pacing';
import { BOSS_R3_LEVEL_AT_SEC, bossForLevel } from './boss';

/**
 * The one length table, seconds of objective time on a non boss version 11 level. early: levels 1
 * to 4 in order (level 1 about 90 s, then a 15 s step each level). late: from level 5 each non boss
 * level draws one of these (shortLevelSec), never the same as the level before it.
 */
export const SHORT_LENGTHS = Object.freeze({
  early: Object.freeze([90, 105, 120, 135]) as readonly number[],
  late: Object.freeze([120, 135, 150, 165, 180]) as readonly number[],
});

/** Mean of SHORT_LENGTHS.late (150 s): the typical level from level 5. */
export const SHORT_LATE_MEAN_SEC = SHORT_LENGTHS.late.reduce((a, b) => a + b, 0) / SHORT_LENGTHS.late.length;

/** Salt of the per level length draw. ASCII "SLEN". */
export const SHORT_LENGTH_SALT = 0x534c454e;
/** Salt of the per level objective kind draw. ASCII "SOBJ". */
export const SHORT_KIND_SALT = 0x534f424a;
/** Salt of the minute beat type draws (on the attempt seed). ASCII "SBTT". */
export const SHORT_BEAT_SALT = 0x53425454;
/** Salt of the formation kind and pattern draws (on the attempt seed). ASCII "SFRM". */
export const SHORT_FORMATION_SALT = 0x5346524d;

const round5 = (v: number): number => Math.round(v / 5) * 5;

/**
 * Boss entrance on a version 11 level: the version 10 entrance (BOSS_R3_LEVEL_AT_SEC, 120 s) scaled
 * by the same shortening as the levels around it (SHORT_LATE_MEAN_SEC / R3_MEAN_LEVEL_SEC, 150 / 210),
 * on the 5 s grid: 85 s at every boss level (5, 10, 15, 20 and on). The fight itself is unchanged.
 */
export const BOSS_SHORT_LEVEL_AT_SEC = round5((BOSS_R3_LEVEL_AT_SEC * SHORT_LATE_MEAN_SEC) / R3_MEAN_LEVEL_SEC);

/** Index into SHORT_LENGTHS.late of level n (n from 5): a hashed draw that skips the previous level's index. */
function lateIndex(runSeed: number, levelIndex: number): number {
  const k = SHORT_LENGTHS.late.length;
  let prev = -1;
  let idx = 0;
  for (let n = 5; n <= levelIndex; n++) {
    const h = fmix32((levelSeed(runSeed, n) ^ SHORT_LENGTH_SALT) >>> 0);
    idx = h % k;
    if (idx === prev) idx = (idx + 1 + ((h >>> 8) % (k - 1))) % k;
    prev = idx;
  }
  return idx;
}

/**
 * Objective seconds of level n of a run on version 11: SHORT_LENGTHS.early for levels 1 to 4, else
 * the level's draw from SHORT_LENGTHS.late. Pure in (runSeed, n): a retry keeps the length.
 */
export function shortLevelSec(runSeed: number, levelIndex: number): number {
  if (levelIndex < 1) return SHORT_LENGTHS.early[0] ?? 90;
  if (levelIndex <= SHORT_LENGTHS.early.length) return SHORT_LENGTHS.early[levelIndex - 1] ?? 90;
  return SHORT_LENGTHS.late[lateIndex(runSeed >>> 0, levelIndex)] ?? SHORT_LATE_MEAN_SEC;
}

/** Version 11 length scale against the version 10 mean: the R3 ramp and pulse are stretched by it. */
export const shortScale = (lengthSec: number): number => lengthSec / R3_MEAN_LEVEL_SEC;

/**
 * Objective table of a non boss version 11 level of lengthSec: every objective at exactly lengthSec
 * (destroy: the clear second) and the R3 ramp stretched by shortScale, so the version 10 spawn
 * ramp plays out over the shorter level. One build per level: after the calm opening the pulse
 * climbs to its peak at the end, and its only breather falls in the schedule pad after the clock,
 * so the load rises to the finish (R5) and the minute beats bring the change of pace.
 */
export function shortObjectiveTable(band: Band, lengthSec: number): LongBandParams {
  const sc = shortScale(lengthSec);
  const one = { min: lengthSec, max: lengthSec };
  return { surviveSec: one, destroySec: one, scoreTimeSec: one, rampSec: Math.round(R3_BANDS[band].rampSec * sc), peakEverySec: lengthSec - shortCalmSec(sc) + LONG_BREATHER_SEC };
}

/** Version 11 boss level scale: the shorter entrance over the version 10 one (85 / 120). */
export const SHORT_BOSS_SCALE = BOSS_SHORT_LEVEL_AT_SEC / BOSS_R3_LEVEL_AT_SEC;

/**
 * Objective table of a version 11 boss level: the version 10 one (LONG_BANDS objectives, which only
 * hold the level after the fight) with the R3 ramp shortened by SHORT_BOSS_SCALE. Peaks keep their
 * spacing, so the fight's pulse is the version 10 one.
 */
export function shortBossTable(band: Band): LongBandParams {
  return { ...LONG_BANDS[band], rampSec: Math.round(R3_BANDS[band].rampSec * SHORT_BOSS_SCALE) };
}

/** Calm opening of a version 11 level: LONG_CALM_SEC times the scale, whole seconds. */
export const shortCalmSec = (scale: number): number => Math.round(LONG_CALM_SEC * scale);

/** Pulse of a version 11 level: the calm opening scaled (by the length, or SHORT_BOSS_SCALE on a boss level), the table's peaks, the same breather. */
export function shortPulse(table: LongBandParams, calmScale: number): PulseShape {
  return { calmSec: shortCalmSec(calmScale), peakEverySec: table.peakEverySec, breatherSec: LONG_BREATHER_SEC };
}

/** First level whose score races count toward the SHORT_RACE_EVERY rule. */
export const SHORT_RACE_FROM_LEVEL = 3;
/** At least one scoreInTime level in every this many consecutive non boss levels from SHORT_RACE_FROM_LEVEL. */
export const SHORT_RACE_EVERY = 4;

const KINDS = ['scoreInTime', 'survive', 'destroy'] as const;

/**
 * Objective kind of non boss level n on version 11. Each level draws a kind with its band weights
 * (BANDS[band].objectiveWeights) from its own hashed stream; from SHORT_RACE_FROM_LEVEL a level is
 * forced to scoreInTime when the SHORT_RACE_EVERY - 1 non boss levels before it (from that level on)
 * held no race, so every run of SHORT_RACE_EVERY non boss levels holds at least one. Boss levels
 * are skipped (bosses: whether the config has them). Pure in (runSeed, n, bosses).
 */
export function shortObjectiveKind(runSeed: number, levelIndex: number, bosses: boolean): ObjectiveDef['kind'] {
  let dry = 0;
  let kind: ObjectiveDef['kind'] = 'survive';
  for (let n = 1; n <= levelIndex; n++) {
    if (bosses && bossForLevel(n) !== null) continue;
    const r = mulberry32(streamSeed(levelSeed(runSeed >>> 0, n), SHORT_KIND_SALT));
    const w = BANDS[bandOf(n)].objectiveWeights;
    kind = rngPick(r, KINDS, KINDS.map((k) => w[k]));
    if (n >= SHORT_RACE_FROM_LEVEL && kind !== 'scoreInTime' && dry >= SHORT_RACE_EVERY - 1) kind = 'scoreInTime';
    if (n >= SHORT_RACE_FROM_LEVEL) dry = kind === 'scoreInTime' ? 0 : dry + 1;
  }
  return kind;
}

// Minute beats. Every full minute of a level (60 s, 120 s, ...) brings a beat, drawn from the
// level's own roster: a formation (one group of a roster kind in a pattern the level has not just
// used, on top of the regular waves) or a surge (SHORT_SURGE_SEC of waves at SHORT_SURGE_BUDGET).
// Two beats in a row are never the same type. The last SHORT_RUSH_SEC of a non boss level are a
// final rush (waves at SHORT_RUSH_BUDGET); a minute whose beat would land inside the rush is the
// rush. On a boss level the beats stop SHORT_BOSS_BEAT_GAP_SEC before the entrance and the boss is
// the finale (no rush). Gravity wells already arrive in play on their own clock (src/game
// wellArrival.ts); a minute aligned well beat would need the sim to read it (hand-off Requests).

export type BeatType = 'formation' | 'surge' | 'rush';

export interface BeatSlot {
  type: BeatType;
  atSec: number;
  /** Seconds the beat lasts (a formation is one group: 0). */
  lenSec: number;
}

/** Seconds of a minute beat surge. */
export const SHORT_SURGE_SEC = 10;
/** Wave budget multiplier during a surge. */
export const SHORT_SURGE_BUDGET = 1.5;
/** Seconds of the final rush at the end of a non boss level. */
export const SHORT_RUSH_SEC = 20;
/** Wave budget multiplier during the final rush. */
export const SHORT_RUSH_BUDGET = 1.4;
/** On a boss level, the last minute beat starts at least this long before the entrance. */
export const SHORT_BOSS_BEAT_GAP_SEC = 10;
/** Units of a formation group: the band's budgetEnd (a full strength wave) times the level's ramp. */
export const SHORT_FORMATION_MIN = 4;

/**
 * Beat slots of a version 11 level: one per full minute before the rush (or before the boss
 * entrance less SHORT_BOSS_BEAT_GAP_SEC), then the rush on a non boss level. Draws (beat stream):
 * one per minute beat, formation or surge 50/50 for the first, then each beat is the other type.
 */
export function beatSlots(r: Rng, lengthSec: number, bossAtSec: number | null): BeatSlot[] {
  const until = bossAtSec === null ? lengthSec - SHORT_RUSH_SEC : bossAtSec - SHORT_BOSS_BEAT_GAP_SEC;
  const slots: BeatSlot[] = [];
  let last: BeatType | null = null;
  for (let t = 60; t < until; t += 60) {
    const type: BeatType = last === null ? (r() < 0.5 ? 'formation' : 'surge') : last === 'formation' ? 'surge' : 'formation';
    slots.push({ type, atSec: t, lenSec: type === 'surge' ? SHORT_SURGE_SEC : 0 });
    last = type;
  }
  if (bossAtSec === null) slots.push({ type: 'rush', atSec: lengthSec - SHORT_RUSH_SEC, lenSec: SHORT_RUSH_SEC });
  return slots;
}

/** Budget multiplier of a wave at t from the surge and rush slots (1 outside them). */
export function beatBudgetAt(slots: readonly BeatSlot[], t: number): number {
  for (const s of slots) {
    if (s.type === 'formation') continue;
    if (t >= s.atSec && t < s.atSec + s.lenSec) return s.type === 'surge' ? SHORT_SURGE_BUDGET : SHORT_RUSH_BUDGET;
  }
  return 1;
}
