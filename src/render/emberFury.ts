// Ember fury look (glow-ember-flame, Ryan 2026-11-11). Enraged Ember burns as a blue flame that pulses
// through blue, purple and white at about 1.5 Hz, with a flickering flame edge and a dash spark trail in
// the same colours. The break (fury 1) crosses the body from orange to that flame instead of to red.
// Colours come from the palette (bossBlue, bossViolet) so applyNeon stays the only place glow is set.
// Pure maths, no pixi, no PRNG (flicker is the hashed noise table), no allocation.
import { noiseAt } from './bossDamage';
import { FLAME_STOP_COUNT } from './emberFlame';
import { furyFlash, furyRedMix, FURY_FLASH_WHITE } from './wardenFury';
import { mixRgb } from './mapFx';
import type { PaletteKey } from './neon';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

type Pal = Readonly<Record<PaletteKey, number>>;

/** Pulse rate (Hz) through blue, purple and white. */
export const BLUE_FLAME_HZ = 1.5;
/** Share of white at the white point of the pulse (a hot white, not pure). */
export const BLUE_FLAME_WHITE = 0.92;
/** Flame edge flicker: alpha range and width multiplier range of the tongue edge. */
export const BLUE_EDGE_ALPHA: readonly [number, number] = [0.55, 1];
export const BLUE_EDGE_WIDTH: readonly [number, number] = [0.8, 1.9];
/** Enraged body alpha flicker range (the flame never dims like the generic red pulse). */
export const BLUE_BODY_ALPHA_MIN = 0.85;

/**
 * Pure: the pulse colour at timeSec: blue to purple to white and back, smooth, period 1 / BLUE_FLAME_HZ.
 */
export function blueFlameColour(pal: Pal, timeSec: number): number {
  const c = fin(timeSec, 0) * BLUE_FLAME_HZ;
  const p = (c - Math.floor(c)) * 3;
  const i = Math.floor(p);
  const f = p - i;
  const s = f * f * (3 - 2 * f);
  const blue = pal.bossBlue;
  const violet = pal.bossViolet;
  const white = mixRgb(blue, 0xffffff, BLUE_FLAME_WHITE);
  if (i === 0) return mixRgb(blue, violet, s);
  if (i === 1) return mixRgb(violet, white, s);
  return mixRgb(white, blue, s);
}

/** Pure: 0 to 1 flicker of the flame edge of tongue k at timeSec, from the noise table. */
export function blueFlicker(timeSec: number, k: number): number {
  const t = fin(timeSec, 0);
  const a = noiseAt(k * 5.3 + t * 9.1);
  const b = noiseAt(k * 2.9 + 40 + t * 17.3);
  return 0.6 * a + 0.4 * b;
}

/** Pure: edge alpha of tongue k at timeSec within BLUE_EDGE_ALPHA. */
export function blueEdgeAlpha(timeSec: number, k: number): number {
  return BLUE_EDGE_ALPHA[0] + (BLUE_EDGE_ALPHA[1] - BLUE_EDGE_ALPHA[0]) * blueFlicker(timeSec, k);
}

/** Pure: edge width multiplier of tongue k at timeSec within BLUE_EDGE_WIDTH. */
export function blueEdgeWidth(timeSec: number, k: number): number {
  return BLUE_EDGE_WIDTH[0] + (BLUE_EDGE_WIDTH[1] - BLUE_EDGE_WIDTH[0]) * blueFlicker(timeSec + 0.37, k);
}

/** Pure: enraged body alpha multiplier, a quick flicker in BLUE_BODY_ALPHA_MIN to 1; 1 unless stage 2. */
export function blueBodyAlpha(stage: number, timeSec: number): number {
  if (stage !== 2) return 1;
  return BLUE_BODY_ALPHA_MIN + (1 - BLUE_BODY_ALPHA_MIN) * blueFlicker(timeSec, 11);
}

/** Pure: the share 0 to 1 of the blue flame in the colours (smoothstep over the break, 1 enraged). */
export function emberFuryMix(stage: number, furyT: number): number {
  return furyRedMix(stage, furyT);
}

/** Pure: Ember's body tint: orange crossing to the pulsing blue flame, flashing white in the break. */
export function emberFuryTint(stage: number, furyT: number, orange: number, pal: Pal, timeSec: number): number {
  const base = mixRgb(orange, blueFlameColour(pal, timeSec), emberFuryMix(stage, furyT));
  return furyFlash(stage, furyT) === 1 ? mixRgb(base, 0xffffff, FURY_FLASH_WHITE) : base;
}

/**
 * Pure: colour of Ember's dash spark at height share u (0 to 1) in fury: the pulse colour lifted toward
 * white. Used for the enraged spark trail; u picks a little variety between sparks.
 */
export function emberFurySpark(pal: Pal, timeSec: number, u: number): number {
  const k = Math.max(0, Math.min(1, fin(u, 0)));
  return mixRgb(blueFlameColour(pal, timeSec), 0xffffff, 0.15 + 0.5 * k);
}

/**
 * Pure: bend flame stops toward the blue flame in place. stops holds the orange flame stops
 * (FLAME_STOP_COUNT entries); each is mixed toward the pulse colour, deep at the root, lifted toward
 * white at the tip, by emberFuryMix. No change at mix 0.
 */
export function emberFuryStops(stops: Uint32Array, pal: Pal, stage: number, furyT: number, timeSec: number): Uint32Array {
  const m = emberFuryMix(stage, furyT);
  if (m <= 0) return stops;
  const pulse = blueFlameColour(pal, timeSec);
  const last = Math.max(1, FLAME_STOP_COUNT - 1);
  for (let k = 0; k < FLAME_STOP_COUNT; k++) {
    const u = k / last;
    const dark = mixRgb(pulse, 0x000000, 0.25 * (1 - u));
    const blue = mixRgb(dark, 0xffffff, 0.78 * u * u);
    stops[k] = mixRgb(stops[k] ?? 0, blue, m);
  }
  return stops;
}
