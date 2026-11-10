// Objective evaluation for the HUD and the results screen (docs/01 section 8). Pure.
// Swarm owns objective tracking in the sim and emits game:over; main.ts uses objectiveStatus as
// a fallback end check and goalMet to decide success, since game:over carries no success flag.
// V3-A: on a boss level the sim holds the level until the boss dies (docs/13 boss rule 9), so the
// fallback check skips success there (fallbackStatus), the sim's verdict decides the win
// (levelSuccess) and the label reads "Defeat the boss" while the hold lasts (objectiveProgress).
import type { BossSpec, ObjectiveDef } from '../levelgen/leveldef';
import { bossName } from './boss';
import { formatClock, formatCompact, formatInt } from './format';

export interface ObjectiveSnapshot {
  elapsedSec: number;
  score: number;
  kills: number;
  /** Lives left, or null if the sim does not expose lives yet. */
  lives: number | null;
}

export type ObjectiveStatus = 'running' | 'success' | 'failure';

/** Pure: the objective target is reached (ignores lives). */
export function goalMet(obj: ObjectiveDef, s: ObjectiveSnapshot): boolean {
  switch (obj.kind) {
    case 'scoreInTime':
      return s.score >= obj.target;
    case 'survive':
      return s.elapsedSec >= obj.durationSec;
    case 'destroy':
      return s.kills >= obj.count;
  }
}

/** Pure: level state for a snapshot. Success wins a tie with a timeout on the same step. */
export function objectiveStatus(obj: ObjectiveDef, s: ObjectiveSnapshot): ObjectiveStatus {
  const out = s.lives !== null && s.lives <= 0;
  if (obj.kind === 'survive') {
    if (out) return 'failure';
    return goalMet(obj, s) ? 'success' : 'running';
  }
  if (obj.kind === 'scoreInTime') {
    // Glue (docs/01 section 8): the level runs its full timer; target is the win line at the end.
    if (out) return 'failure';
    if (s.elapsedSec < obj.timeLimitSec) return 'running';
    return goalMet(obj, s) ? 'success' : 'failure';
  }
  if (goalMet(obj, s)) return 'success';
  if (out) return 'failure';
  return 'running';
}

/** Survive label: hud-clock moved the time left out of the bar into the HUD clock (clockView). */
export const SURVIVE_LABEL = 'Survive';

/** What the objective label reads while the level holds for a living boss (docs/13 boss rule 9, section 8). */
export const HOLD_LABEL = 'Defeat the boss';

/**
 * Pure: the objective's success test passes while a boss lives, so the sim holds the level until
 * the boss dies (docs/13 boss rule 9). The test is objectiveStatus, so it carries the same lives
 * rule: no hold once the lives are gone, that is a loss.
 */
export function bossHolds(obj: ObjectiveDef, s: ObjectiveSnapshot, bossAlive: boolean): boolean {
  return bossAlive && objectiveStatus(obj, s) === 'success';
}

/**
 * Pure: the level state main.ts may act on as a fallback end check. On a boss level only the sim
 * says when the objective is won (it holds for the boss and completes on the boss's death), so a
 * success from the snapshot is read as still running there; a failure still ends the level.
 */
export function fallbackStatus(obj: ObjectiveDef, s: ObjectiveSnapshot, bossLevel: boolean): ObjectiveStatus {
  const status = objectiveStatus(obj, s);
  // Boss level: only the sim ends it (boss death wins, all lives lost fails); the objective is score only.
  if (bossLevel) return s.lives !== null && s.lives <= 0 ? 'failure' : 'running';
  return status;
}

/** The sim's verdict (GameState.outcome), copied here so this module stays free of src/game. */
export type SimOutcome = 'running' | 'won' | 'lost';

/**
 * Pure: did the player win, for the results screen. game:over carries no success flag.
 * R2 (P0): the sim's verdict decides whenever it has one ('won' or 'lost'); its lives rule is the
 * same on every objective, so losing every life is never a win. goalMet alone ignored lives, which
 * let a score objective whose target was met early report a win after the last life was lost.
 * Only when the fallback check ends the level before the sim does ('running') is the snapshot read,
 * through objectiveStatus, which applies the same lives rule. A boss level never wins on the
 * snapshot: only the sim says when the boss died.
 */
export function levelSuccess(obj: ObjectiveDef, s: ObjectiveSnapshot, outcome: SimOutcome, bossLevel: boolean): boolean {
  if (outcome !== 'running') return outcome === 'won';
  if (bossLevel) return false;
  return objectiveStatus(obj, s) === 'success';
}

export interface ObjectiveProgress {
  label: string;
  /** 0 to 1, bar fill: progress toward the objective the player must complete, never a timer on a score or destroy objective. */
  fraction: number;
  /**
   * R2: the thin star line under the bar, score toward the third star threshold, 0 to 1. null when
   * the run has no stars (Endless, Free Play) or no thresholds were given. Absent reads as null.
   */
  stars?: number | null;
  /** R2: where the first and second star thresholds sit on the star line, 0 to 1. Empty with no line. */
  starMarks?: number[];
}

function frac(a: number, b: number): number {
  return b > 0 ? Math.max(0, Math.min(1, a / b)) : 1;
}

/** Pure: the star line and its marks for a score and the level's three thresholds. */
export function starLine(score: number, thresholds: readonly [number, number, number] | undefined): Pick<ObjectiveProgress, 'stars' | 'starMarks'> {
  if (thresholds === undefined) return { stars: null, starMarks: [] };
  const top = thresholds[2];
  return { stars: frac(score, top), starMarks: [frac(thresholds[0], top), frac(thresholds[1], top)] };
}

/** The boss of a boss level and how much of its health is left (0 to 1, 1 before it is hurt). */
export interface BossBarInput {
  spec: BossSpec;
  hpFraction: number;
}

/**
 * Pure: the HUD bar on a boss level (Survive, then beat the boss). Before the entrance
 * (elapsed < atSec) the bar fills with time toward atSec and reads "BOSS IN m:ss"; from the
 * entrance it shows the boss health draining and reads the boss name. No kill or score count.
 */
export function bossObjectiveProgress(
  boss: BossBarInput,
  s: ObjectiveSnapshot,
  thresholds?: readonly [number, number, number],
): ObjectiveProgress {
  const line = starLine(s.score, thresholds);
  const at = boss.spec.atSec;
  if (s.elapsedSec < at) return { label: `BOSS IN ${formatClock(at - s.elapsedSec)}`, fraction: frac(s.elapsedSec, at), ...line };
  return { label: bossName(boss.spec.id), fraction: Math.max(0, Math.min(1, boss.hpFraction)), ...line };
}

/**
 * Pure: HUD label and bar fill. R2: the bar shows progress toward what the player must complete
 * ("Survive", "Destroy 312 / 530", "Score 1.2M / 3.3M"); a score objective fills with
 * the score only, a destroy objective with kills only. `thresholds` (LevelDef.stars) adds the thin
 * star line. While the level holds for a living boss the label reads "Defeat the boss" and the bar
 * is full.
 */
export function objectiveProgress(
  obj: ObjectiveDef,
  s: ObjectiveSnapshot,
  bossAlive = false,
  thresholds?: readonly [number, number, number],
  boss?: BossBarInput,
): ObjectiveProgress {
  if (boss !== undefined) return bossObjectiveProgress(boss, s, thresholds);
  const line = starLine(s.score, thresholds);
  if (bossHolds(obj, s, bossAlive)) return { label: HOLD_LABEL, fraction: 1, ...line };
  switch (obj.kind) {
    case 'scoreInTime':
      return {
        label: `Score ${formatCompact(s.score)} / ${formatCompact(obj.target)}`,
        fraction: frac(s.score, obj.target),
        ...line,
      };
    case 'survive':
      return { label: SURVIVE_LABEL, fraction: frac(s.elapsedSec, obj.durationSec), ...line };
    case 'destroy':
      return { label: `Destroy ${formatInt(Math.min(s.kills, obj.count))} / ${formatInt(obj.count)}`, fraction: frac(s.kills, obj.count), ...line };
  }
}

/** Pure: one line description for menus and results. */
export function objectiveText(obj: ObjectiveDef): string {
  switch (obj.kind) {
    case 'scoreInTime':
      return `Score ${formatInt(obj.target)} in ${formatClock(obj.timeLimitSec)}`;
    case 'survive':
      return `Survive ${formatClock(obj.durationSec)}`;
    case 'destroy':
      return `Destroy ${obj.count} enemies`;
  }
}

// ---- HUD clock (hud-clock) ----------------------------------------------------------------
// The clock left the objective bar: once a score target was reached the bar was full and the time
// left was hard to read. Timed objectives (scoreInTime, survive) count down in a framed pixel
// clock that warns at 1:00, 0:30 and every second from 0:10. Ryan (device check on ab5e14d,
// 2026-11-10): destroy and boss levels show no clock at all; they used to count up from 0:00.
// Endless and Free Play keep their clock in the level line.

export type ClockMode = 'countdown' | 'elapsed' | 'hidden';
/** calm: more than a minute left (or time played). minute: 1:00 or less. half: 0:30 or less. final: 0:10 or less. */
export type ClockTier = 'calm' | 'minute' | 'half' | 'final';
/** Palette tones of the clock (vectorFont VECTOR_TONES keys). */
export type ClockTone = 'cyan' | 'white' | 'yellow' | 'orange' | 'red';
/** Digit size: small for time played, normal for a countdown, large from 0:10. */
export type ClockSize = 'small' | 'normal' | 'large';

export interface ClockView {
  mode: ClockMode;
  text: string;
  tier: ClockTier;
  tone: ClockTone;
  size: ClockSize;
  /** Whole seconds left as the clock shows them (rounded up), null unless counting down. */
  shownLeft: number | null;
}

/** Warning lines in whole seconds left: yellow at 60, orange at 30, red with a pulse a second from 10. */
export const CLOCK_MINUTE = 60;
export const CLOCK_HALF = 30;
export const CLOCK_FINAL = 10;

export const CLOCK_HIDDEN: Readonly<ClockView> = { mode: 'hidden', text: '', tier: 'calm', tone: 'cyan', size: 'normal', shownLeft: null };

/** Pure: the warning tier for whole seconds left as shown. */
export function clockTier(shownLeft: number): ClockTier {
  if (shownLeft <= CLOCK_FINAL) return 'final';
  if (shownLeft <= CLOCK_HALF) return 'half';
  if (shownLeft <= CLOCK_MINUTE) return 'minute';
  return 'calm';
}

const TIER_TONE: Readonly<Record<ClockTier, ClockTone>> = { calm: 'cyan', minute: 'yellow', half: 'orange', final: 'red' };

/** Pure: palette tone of a countdown tier. */
export function tierTone(t: ClockTier): ClockTone {
  return TIER_TONE[t];
}

/** Pure: the time limit of a timed objective in seconds, null for destroy. */
export function timeLimitOf(obj: ObjectiveDef): number | null {
  if (obj.kind === 'scoreInTime') return obj.timeLimitSec;
  if (obj.kind === 'survive') return obj.durationSec;
  return null;
}

/** Pure: whole seconds left as the clock shows them (rounded up, never below 0). */
export function shownSeconds(sec: number): number {
  return Number.isFinite(sec) ? Math.max(0, Math.ceil(sec)) : 0;
}

/** Pure: true when an Adventure level shows the HUD clock: a timed objective on a level with no boss. */
export function clockShown(obj: ObjectiveDef, bossLevel: boolean): boolean {
  return !bossLevel && timeLimitOf(obj) !== null;
}

/**
 * Pure: the HUD clock for an Adventure level. Only timed missions (scoreInTime, survive) show it,
 * counting down; destroy and boss levels (the sim, not a timer, ends a boss level) get CLOCK_HIDDEN.
 */
export function clockView(obj: ObjectiveDef, elapsedSec: number, bossLevel: boolean): ClockView {
  const limit = timeLimitOf(obj);
  if (limit === null || bossLevel) return CLOCK_HIDDEN;
  const left = shownSeconds(limit - elapsedSec);
  const tier = clockTier(left);
  return { mode: 'countdown', text: formatClock(left), tier, tone: tierTone(tier), size: tier === 'final' ? 'large' : 'normal', shownLeft: left };
}

/** Pure: true for a whole second that raises 'ui:timeWarn': 60, 30, and 10 down to 1. */
export function isWarnSecond(s: number): boolean {
  return s === CLOCK_MINUTE || s === CLOCK_HALF || (Number.isInteger(s) && s >= 1 && s <= CLOCK_FINAL);
}

/** Memory of the warning emitter: the last shown seconds it saw and the last second it warned for. */
export interface WarnState {
  prev: number | null;
  lastWarned: number | null;
}

export const WARN_START: Readonly<WarnState> = { prev: null, lastWarned: null };

/**
 * Pure: feed the clock's shown seconds left (null when not counting down) and get the warning to
 * emit, if any. A warning fires when the shown seconds cross a warning second going down (shown at
 * or below it, previous above it). Paused time does not move the sim clock, so the same value
 * arriving again emits nothing. Two warning seconds crossed in one call (a long frame) emit only the
 * lower one, so the warnings never come in a burst, and a second is never warned twice: a value
 * at or above the last warned second (a clock that went back up) only moves the memory.
 * The first value of a run sets the memory and warns for nothing, so a level that starts under a
 * minute does not warn for 60.
 */
export function warnStep(st: Readonly<WarnState>, shownLeft: number | null): { state: WarnState; warn: number | null } {
  if (shownLeft === null) return { state: { prev: null, lastWarned: st.lastWarned }, warn: null };
  const prev = st.prev;
  if (prev === null || shownLeft >= prev) return { state: { prev: shownLeft, lastWarned: st.lastWarned }, warn: null };
  let warn: number | null = null;
  for (let s = prev - 1; s >= shownLeft; s--) {
    if (isWarnSecond(s) && (st.lastWarned === null || s < st.lastWarned)) warn = s;
  }
  return { state: { prev: shownLeft, lastWarned: warn ?? st.lastWarned }, warn };
}

/**
 * Length of one clock pulse in ms. Each warning starts one pulse, so the clock pulses at most once a
 * second (the brief caps flashing at 3 a second).
 */
export const CLOCK_PULSE_MS = 360;
