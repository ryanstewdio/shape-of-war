// Leaver look (forge-leaver). Pure: no pixi.js import, so tests run in node.
//
// The Leaver is three layers of neon outline, all baked colours from the palette: a yellow square
// at the back, a green square frame turned LEAVER_FRAME_DEG on top, and a red square inside the
// frame. The view spins slowly one way (leaverSpin) while the frame counter rotates against the
// squares. A Graphics context cannot turn one layer on its own, so the frame's angle relative to
// the squares is baked into LEAVER_FRAME_STEPS visual slots over a quarter turn (a square repeats
// every 90 degrees) and the renderer picks the slot per frame (leaverFrameStep).
//
// Shards are small solid squares of one colour each that shimmer: a brightness flicker (alpha and
// glow) and a hue shimmer inside their own colour family, a mix toward a neighbouring palette key.
// Every colour is a palette value, so applyNeon (saturation, glow) reaches them like any other.
import type { PaletteKey } from './neon';
import type { ShapeLayer, ShapePrim, ShapeSpec } from './shapeSpecs';

/** Frame angle over the squares at rest, degrees (Ryan's image: about 40). */
export const LEAVER_FRAME_DEG = 40;
/** Baked frame angle steps over a quarter turn. */
export const LEAVER_FRAME_STEPS = 24;
/** View spin, radians per second (slow). */
export const LEAVER_SPIN = 0.6;
/** Frame counter spin relative to the squares, radians per second (the frame turns -0.6 in the world). */
export const LEAVER_COUNTER = -2 * LEAVER_SPIN;

/** Back square half side, frame outer and inner half sides, inner square half side (arena units). */
// The back square is the largest, so its corners show past the turned frame (Ryan's image).
export const LEAVER_BACK_HALF = 13;
export const LEAVER_FRAME_OUT = 11.5;
export const LEAVER_FRAME_IN = 7.5;
export const LEAVER_CORE_HALF = 4;

const QUARTER = Math.PI / 2;

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Closed square of half side h turned by a radians, as a poly prim. */
export function squarePoly(h: number, a: number): ShapePrim {
  const pts: number[] = [];
  for (let k = 0; k < 4; k++) {
    const t = a + Math.PI / 4 + k * QUARTER;
    const r = h * Math.SQRT2;
    pts.push(r2(Math.cos(t) * r) + 0, r2(Math.sin(t) * r) + 0);
  }
  return { t: 'poly', pts };
}

function layer(prims: readonly ShapePrim[], width: number, colour: PaletteKey, fill = 0, glow = true): ShapeLayer {
  return { prims, width, fill, colour, glow, alpha: 1 };
}

/** Pure: frame angle relative to the squares at step s (0 to LEAVER_FRAME_STEPS - 1), radians. */
export function frameAngleAt(step: number): number {
  const s = ((Math.round(step) % LEAVER_FRAME_STEPS) + LEAVER_FRAME_STEPS) % LEAVER_FRAME_STEPS;
  return (LEAVER_FRAME_DEG * Math.PI) / 180 + (s / LEAVER_FRAME_STEPS) * QUARTER;
}

/** Pure: the Leaver spec with its frame at step s. Back square, frame (two outlines, a faint band), core. */
export function leaverSpec(step: number): ShapeSpec {
  const fa = frameAngleAt(step);
  return {
    tint: null,
    radius: Math.ceil(Math.max(LEAVER_BACK_HALF, LEAVER_FRAME_OUT) * Math.SQRT2),
    layers: [
      layer([squarePoly(LEAVER_BACK_HALF, 0)], 2.2, 'yellow', 0.08),
      layer([squarePoly(LEAVER_FRAME_OUT, fa), squarePoly(LEAVER_FRAME_IN, fa)], 2.2, 'green'),
      layer([squarePoly(LEAVER_CORE_HALF, 0)], 2, 'red', 0.25),
    ],
  };
}

/** Every baked Leaver spec, by frame step. */
export const LEAVER_SPECS: readonly ShapeSpec[] = Array.from({ length: LEAVER_FRAME_STEPS }, (_, s) => leaverSpec(s));

/** The Leaver at frame step 0 (the registry entry), the same object as LEAVER_SPECS[0]. */
export const LEAVER_SPEC: ShapeSpec = LEAVER_SPECS[0] ?? leaverSpec(0);

/** Pure: the view rotation of a Leaver at render time t (seconds), phase h in [0, 1). */
export function leaverSpin(t: number, h: number): number {
  return h * Math.PI * 2 + t * LEAVER_SPIN;
}

/** Pure: the frame step at render time t, phase h: the counter spin, wrapped to a quarter turn. */
export function leaverFrameStep(t: number, h: number): number {
  const rel = h * QUARTER + t * LEAVER_COUNTER;
  const q = (((rel % QUARTER) + QUARTER) % QUARTER) / QUARTER;
  return Math.floor(q * LEAVER_FRAME_STEPS) % LEAVER_FRAME_STEPS;
}

/** Shard half side, arena units (hitbox radius 7). */
export const SHARD_HALF = 4.5;

/** The shard spec: one small solid square, white, coloured per shard by the view tint. */
export const SHARD_SPEC: ShapeSpec = {
  tint: 'yellow',
  radius: 7,
  layers: [{ prims: [squarePoly(SHARD_HALF, 0)], width: 1.4, fill: 1, colour: null, glow: true, alpha: 1 }],
};

/** Shard colour keys by sim colour index (0 yellow, 1 green, 2 red): the shard's own colour. */
export const SHARD_KEYS: readonly PaletteKey[] = ['yellow', 'green', 'red'];
/** Neighbour key each shard colour shimmers toward: a hue within its own colour family. */
export const SHARD_SHIMMER_KEYS: readonly PaletteKey[] = ['bossYellow', 'bossGreen', 'charger'];
/** Most the hue shimmer mixes toward the neighbour key. */
export const SHARD_HUE_MIX = 0.55;
/** Brightness flicker depth on alpha and glow. */
export const SHARD_FLICKER = 0.35;
/** Shimmer rates, Hz (two incommensurate rates so it never reads as a plain blink). */
export const SHARD_HUE_HZ = 2.3;
export const SHARD_FLICKER_HZ = 7.1;

/** Pure: palette key of a shard's colour index. */
export function shardKey(c: number): PaletteKey {
  return SHARD_KEYS[((c % 3) + 3) % 3] ?? 'yellow';
}

/** Pure: shimmer neighbour key of a shard's colour index. */
export function shardShimmerKey(c: number): PaletteKey {
  return SHARD_SHIMMER_KEYS[((c % 3) + 3) % 3] ?? 'bossYellow';
}

/** Pure: hue shimmer mix toward the neighbour key at time t, phase h: 0 to SHARD_HUE_MIX. */
export function shardHueMix(t: number, h: number): number {
  return SHARD_HUE_MIX * 0.5 * (1 + Math.sin((t * SHARD_HUE_HZ + h) * Math.PI * 2));
}

/** Pure: brightness factor at time t, phase h: 1 - SHARD_FLICKER to 1 (alpha and glow). */
export function shardFlicker(t: number, h: number): number {
  const a = Math.sin((t * SHARD_FLICKER_HZ + h * 3.7) * Math.PI * 2);
  const b = Math.sin((t * SHARD_FLICKER_HZ * 1.618 + h) * Math.PI * 2);
  return 1 - SHARD_FLICKER * 0.25 * (2 + a + b);
}

/** Pure: shard spin while it holds, radians per second (it turns to its heading once chasing). */
export const SHARD_HOLD_SPIN = 9;
