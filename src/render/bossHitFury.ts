// Guardian hit feedback and the generic fury look (glow-fury-two, Ryan 2026-11-11).
// Hit: a landed hit flashes the whole body white for under 0.08 s (the view's hitT, or the
// 'sim:bossHit' event until the sim writes hitT), at most one flash start per BODY_FLASH_GAP so heavy
// fire strobes instead of washing the body out. 'sim:bossHit' throws a few sparks in the guardian
// hue on a landed hit and one small grey spark on a blocked one, each rate capped.
// Fury: every guardian with fury takes the Warden break and enraged colours (wardenFury.ts). Only the
// Warden grows spikes. Spindle's beam arms and Ember's dash sparks turn hot red while enraged.
// Pure maths, no pixi, no PRNG, no allocation.
import { mixRgb } from './mapFx';
import { furyHotRed, furyPulseAlpha, furyRedMix } from './wardenFury';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** Body flash length (s): under the 0.08 s the brief allows. */
export const BODY_FLASH_SEC = 0.07;
/** Shortest time between two flash starts (s): caps the strobe near 5.5 Hz under heavy fire. */
export const BODY_FLASH_GAP = 0.18;
/** Peak white fill alpha over the body, and the outline alpha: the body still reads through. */
export const BODY_FLASH_FILL = 0.8;
export const BODY_FLASH_LINE = 1;
/** Extra glow multiplier at the flash peak. */
export const BODY_FLASH_GLOW = 1.4;
/** Outline width multiplier of the flash (glow-hit-feel: was 1.6). */
export const BODY_FLASH_WIDTH = 2.4;

/** Body flash state: seconds since the last flash start (Infinity before any). */
export interface BodyFlash {
  age: number;
}

/** A fresh flash state (allocates once; call at setup). */
export function createBodyFlash(): BodyFlash {
  return { age: Number.POSITIVE_INFINITY };
}

/** Pure: forget any flash (new level, boss down). */
export function resetBodyFlash(f: BodyFlash): BodyFlash {
  f.age = Number.POSITIVE_INFINITY;
  return f;
}

/** Pure: start a flash now unless one started under BODY_FLASH_GAP ago. True when it started. */
export function triggerBodyFlash(f: BodyFlash, since = 0): boolean {
  const s = Math.max(0, fin(since, 0));
  if (f.age - s < BODY_FLASH_GAP) return false;
  f.age = s;
  return true;
}

/**
 * Pure: advance the flash by dt and, when the view reports hitT (seconds since the last landed hit,
 * -1 before any), start a flash for a fresh hit. Undefined hitT leaves the event path in charge.
 */
export function stepBodyFlash(f: BodyFlash, hitT: number | undefined, dt: number): BodyFlash {
  f.age += Math.max(0, fin(dt, 0));
  if (hitT !== undefined && Number.isFinite(hitT) && hitT >= 0 && hitT < BODY_FLASH_SEC) triggerBodyFlash(f, hitT);
  return f;
}

/** Pure: flash amount 1 at the start falling to 0 at BODY_FLASH_SEC. */
export function bodyFlashAmount(f: BodyFlash): number {
  const a = f.age;
  if (!(a >= 0) || a >= BODY_FLASH_SEC) return 0;
  return 1 - a / BODY_FLASH_SEC;
}

/** Sparks per landed hit (cycles 2, 3, 4 by a sequence, never the PRNG) and per blocked hit. */
export const HIT_SPARKS_MIN = 2;
export const HIT_SPARKS_MAX = 4;
export const BLOCK_SPARKS = 1;
/** Shortest gap between spark bursts (ms): landed and blocked keep separate clocks. */
export const HIT_SPARK_MS = 45;
export const BLOCK_SPARK_MS = 70;
/** Share of white in a landed spark, and the grey a blocked spark is mixed to. */
export const HIT_SPARK_WHITE = 0.45;
/** Landed hit sparks (glow-hit-feel): about twice the size and a little longer lived. */
export const HIT_SPARK_SIZE = 2;
export const HIT_SPARK_LIFE_MUL = 1.3;
export const BLOCK_GREY = 0x8c8c8c;
export const BLOCK_GREY_SHARE = 0.85;

/** Spark rate limiter: last landed and blocked burst times on the draw clock (ms). */
export interface SparkGate {
  landedMs: number;
  blockedMs: number;
}

export function createSparkGate(): SparkGate {
  return { landedMs: Number.NEGATIVE_INFINITY, blockedMs: Number.NEGATIVE_INFINITY };
}

export function resetSparkGate(g: SparkGate): SparkGate {
  g.landedMs = Number.NEGATIVE_INFINITY;
  g.blockedMs = Number.NEGATIVE_INFINITY;
  return g;
}

/** Pure: true when a burst may go now, recording it. A clock that ran backwards resets the gate. */
export function sparkAllow(g: SparkGate, landed: boolean, nowMs: number): boolean {
  const now = fin(nowMs, 0);
  const last = landed ? g.landedMs : g.blockedMs;
  const gap = landed ? HIT_SPARK_MS : BLOCK_SPARK_MS;
  if (now >= last && now - last < gap) return false;
  if (landed) g.landedMs = now;
  else g.blockedMs = now;
  return true;
}

/** Pure: spark count for a hit: landed 2 to 4 by seq, blocked exactly one. */
export function bossHitSparkCount(landed: boolean, seq: number): number {
  if (!landed) return BLOCK_SPARKS;
  const span = HIT_SPARKS_MAX - HIT_SPARKS_MIN + 1;
  const k = ((Math.trunc(fin(seq, 0)) % span) + span) % span;
  return HIT_SPARKS_MIN + k;
}

/** Pure: spark colour: the guardian hue lifted toward white when landed, near grey when blocked. */
export function bossHitSparkColour(landed: boolean, hue: number): number {
  return landed ? mixRgb(hue, 0xffffff, HIT_SPARK_WHITE) : mixRgb(hue, BLOCK_GREY, BLOCK_GREY_SHARE);
}

/** Pure: true when a guardian draws the Warden fury spikes (the Warden only). */
export function furySpikes(bossIdx: number, wardenIdx: number): boolean {
  return bossIdx === wardenIdx;
}

/**
 * Pure: colour of a guardian's attack arms (Spindle beams) in fury: the hue crossing to hot red over
 * the break (no white flash, the body carries that), hot red enraged, the hue with no fury.
 */
export function furyArmTint(stage: number, furyT: number, hue: number, red: number): number {
  if (stage !== 1 && stage !== 2) return hue;
  return mixRgb(hue, furyHotRed(red), furyRedMix(stage, furyT));
}

/** Pure: alpha multiplier of the arms: the enraged slow pulse, else 1. */
export function furyArmAlpha(stage: number, furyT: number): number {
  return furyPulseAlpha(stage, furyT);
}

/** Ember enraged dash: hot red spark trail rate (per second). */
export const EMBER_FURY_SPARK_RATE = 70;

/** Pure: the extra hot red spark trail rate while Ember dashes enraged; 0 otherwise or on Low. */
export function emberFurySparkRate(stage: number, dashing: boolean, low: boolean): number {
  return stage === 2 && dashing && !low ? EMBER_FURY_SPARK_RATE : 0;
}

// glow-hit-feel: the cracks glow brighter and thicker as health falls, and pulse on each landed hit.
/** Crack glow at full health and near death (0 to 1 strength). */
export const CRACK_GLOW_MIN = 0.25;
export const CRACK_GLOW_MAX = 1;
/** Crack pulse length (s) after a landed hit, and its extra strength at the start. */
export const CRACK_PULSE_SEC = 0.25;
export const CRACK_PULSE_BOOST = 0.8;

/** Pure: health share 0 to 1 from hp and maxHp (1 when maxHp is not positive or not finite). */
export function healthShare(hp: number, maxHp: number): number {
  const m = fin(maxHp, 0);
  if (!(m > 0)) return 1;
  return Math.min(1, Math.max(0, fin(hp, m) / m));
}

/** Pure: base crack glow strength: CRACK_GLOW_MIN at full health rising to CRACK_GLOW_MAX at none. */
export function crackGlow(share: number): number {
  const s = Math.min(1, Math.max(0, fin(share, 1)));
  return CRACK_GLOW_MIN + (CRACK_GLOW_MAX - CRACK_GLOW_MIN) * (1 - s);
}

/** Pure: pulse 1 at a landed hit falling to 0 at CRACK_PULSE_SEC; hitT below 0 or unknown is 0. */
export function crackPulse(hitT: number | undefined): number {
  if (hitT === undefined || !Number.isFinite(hitT) || hitT < 0 || hitT >= CRACK_PULSE_SEC) return 0;
  return 1 - hitT / CRACK_PULSE_SEC;
}

/** Pure: crack glow strength 0 to 1.8: the health glow plus the hit pulse. */
export function crackStrength(share: number, pulse: number): number {
  return crackGlow(share) + CRACK_PULSE_BOOST * Math.min(1, Math.max(0, fin(pulse, 0)));
}

/** Widest a crack stroke grows, as a multiple of the full health width (glow-ember-flame). */
export const CRACK_WIDTH_MAX = 1.6;

/** Pure: width multiplier of the crack strokes (1 dim to CRACK_WIDTH_MAX bright); brightness grows more. */
export function crackWidthMul(strength: number): number {
  return 1 + (Math.min(1.8, Math.max(0, fin(strength, 0))) / 1.8) * (CRACK_WIDTH_MAX - 1);
}
