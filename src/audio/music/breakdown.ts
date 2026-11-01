// The space breakdown timeline (mix v3.5). Pure, no Web Audio, no PRNG.
//
// Why it was not heard on device (M1, build 75f2b76): the breakdown was a section of the loop
// form (bars 8 to 11 of a drive tune, 8 to 15 of a space piece), so it first arrived 14 to 19 s
// into a level. That early, threat is low and the kick (threat 0.2 and up) and hat (0.32 and up)
// are not playing yet, so "the drums drop" dropped nothing; the held bass kept going; and the pad
// and its long echo returned through the threat lowpass, about 450 to 900 Hz at low threat, at the
// pad's normal level. The next one came a whole loop later (35 to 50 s on), often after a runtime
// fill (a lift change) had already turned a breakdown bar back into a full bar.
//
// Now the breakdown is placed by play time, not by the form: the first one starts between 30 and
// 45 s into a level tune, then one every 90 to 120 s, each 4 bars on a 4 bar phrase line. The
// section in the loop that used to hold it plays a 16th note arpeggio section instead. Battle
// tracks never break down.
import { hash01 } from '../../core/rng';
import { SECTION_BARS } from './compose';
import { STEPS_PER_BAR } from './harmony';
import type { Tune } from './tunes';

/** The first breakdown starts at or after this many seconds of play ... */
export const BREAK_FIRST_MIN_SEC = 30;
/** ... and no later than this. */
export const BREAK_FIRST_MAX_SEC = 45;
/** Seconds from one breakdown start to the next: at least ... */
export const BREAK_GAP_MIN_SEC = 90;
/** ... and at most. */
export const BREAK_GAP_MAX_SEC = 120;
/** Bars in one breakdown. */
export const BREAK_BARS = SECTION_BARS;

const SALT_FIRST = 0x5b0a;
const SALT_GAP = 0x5b1b;

/** Pure: seconds in one 4 bar section of a tune. */
export function sectionSec(t: Tune): number {
  return t.stepSec * STEPS_PER_BAR * SECTION_BARS;
}

/** Pure: true for a tune that takes breakdowns: a level tune with a form. */
export function hasBreakdowns(t: Tune): boolean {
  return t.form !== undefined && t.battle !== true;
}

/**
 * Pure: the hashed target of the first breakdown, seconds. The start is the first section line at
 * or after it, so the target range is kept a section short of the window's end.
 */
function firstTarget(seed: number, t: Tune): number {
  const span = Math.max(0, BREAK_FIRST_MAX_SEC - BREAK_FIRST_MIN_SEC - sectionSec(t));
  return BREAK_FIRST_MIN_SEC + span * hash01((seed >>> 0) ^ SALT_FIRST, t.bpm);
}

/** Pure: the hashed target gap after the k-th breakdown, seconds. */
function gapTarget(seed: number, t: Tune, k: number): number {
  const span = Math.max(0, BREAK_GAP_MAX_SEC - BREAK_GAP_MIN_SEC - sectionSec(t));
  return BREAK_GAP_MIN_SEC + span * hash01((seed >>> 0) ^ SALT_GAP, t.bpm * 977 + k);
}

/** Pure: the section index (4 bar block from the tune's start) of the k-th breakdown, or -1. */
export function breakdownSection(seed: number, t: Tune, k: number): number {
  if (!hasBreakdowns(t) || k < 0) return -1;
  const sec = sectionSec(t);
  let s = Math.ceil(firstTarget(seed, t) / sec - 1e-9);
  for (let i = 0; i < k; i++) s += Math.ceil(gapTarget(seed, t, i) / sec - 1e-9);
  return s;
}

/**
 * Pure: true when a bar (counted from the start of the tune, 0 based) is inside a breakdown.
 * No allocation: walks the breakdown starts until one passes the bar.
 */
export function isBreakdownBar(seed: number, t: Tune, bar: number): boolean {
  if (!hasBreakdowns(t) || bar < 0) return false;
  const target = Math.floor(Math.trunc(bar) / SECTION_BARS);
  const sec = sectionSec(t);
  let s = Math.ceil(firstTarget(seed, t) / sec - 1e-9);
  for (let k = 0; s <= target; k++) {
    if (s === target) return true;
    s += Math.ceil(gapTarget(seed, t, k) / sec - 1e-9);
  }
  return false;
}

/** Pure: the start times (seconds from the tune's start) of the first `count` breakdowns. */
export function breakdownStarts(seed: number, t: Tune, count: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const s = breakdownSection(seed, t, k);
    if (s < 0) break;
    out.push(s * sectionSec(t));
  }
  return out;
}
