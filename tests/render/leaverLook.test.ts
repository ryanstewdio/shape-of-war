// forge-leaver: the Leaver look. Three neon outline layers (a yellow square at the back, a green
// square frame turned 40 degrees, a red square inside the frame), the frame counter rotating
// through baked slots; shards are small solid single colour squares that shimmer inside their own
// colour family, every colour a palette key (so applyNeon reaches them).
import { describe, expect, it } from 'vitest';
import { Kind } from '../../src/game/world';
import {
  LEAVER_COUNTER,
  LEAVER_FRAME_DEG,
  LEAVER_FRAME_STEPS,
  LEAVER_SPECS,
  LEAVER_SPIN,
  SHARD_FLICKER,
  SHARD_HUE_MIX,
  SHARD_SPEC,
  frameAngleAt,
  leaverFrameStep,
  leaverSpec,
  shardFlicker,
  shardHueMix,
  shardKey,
  shardShimmerKey,
} from '../../src/render/leaverLook';
import { BASE_PALETTE, PALETTE_KEYS } from '../../src/render/neon';
import { isLeaverSlot, leaverSlot, LEAVER_SLOT_BASE, MAX_SLOT, SHAPE_SPECS, specFor, specForSlot, UNKNOWN_SPEC } from '../../src/render/shapeSpecs';

const angleOfPoly = (pts: readonly number[]): number => Math.atan2((pts[1] ?? 0), (pts[0] ?? 0)) - Math.PI / 4;
const wrapQuarter = (a: number): number => ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);

describe('Leaver spec', () => {
  it('is three outline layers: yellow back square, green frame, red inner square', () => {
    const s = leaverSpec(0);
    expect(s.tint).toBeNull();
    expect(s.layers.map((l) => l.colour)).toEqual(['yellow', 'green', 'red']);
    for (const l of s.layers) expect(l.width).toBeGreaterThan(0);
    // The frame is two concentric squares; the others one each.
    expect(s.layers.map((l) => l.prims.length)).toEqual([1, 2, 1]);
    const frame = s.layers[1]?.prims[0];
    expect(frame?.t).toBe('poly');
    if (frame?.t === 'poly') expect(wrapQuarter(angleOfPoly(frame.pts))).toBeCloseTo((LEAVER_FRAME_DEG * Math.PI) / 180, 2);
    const back = s.layers[0]?.prims[0];
    if (back?.t === 'poly') expect(wrapQuarter(angleOfPoly(back.pts))).toBeCloseTo(0, 2);
    // The red square sits inside the frame's inner edge.
    const inner = s.layers[1]?.prims[1];
    const core = s.layers[2]?.prims[0];
    if (inner?.t === 'poly' && core?.t === 'poly') expect(Math.hypot(core.pts[0] ?? 0, core.pts[1] ?? 0)).toBeLessThan(Math.hypot(inner.pts[0] ?? 0, inner.pts[1] ?? 0));
  });

  it('bakes the frame counter rotation into slots past the boss slots', () => {
    expect(LEAVER_SPECS).toHaveLength(LEAVER_FRAME_STEPS);
    expect(SHAPE_SPECS[Kind.Leaver]).toBe(LEAVER_SPECS[0]);
    expect(specFor(Kind.Leaver)).not.toBe(UNKNOWN_SPEC);
    expect(leaverSlot(0)).toBe(LEAVER_SLOT_BASE);
    expect(leaverSlot(LEAVER_FRAME_STEPS - 1)).toBe(MAX_SLOT);
    expect(leaverSlot(LEAVER_FRAME_STEPS)).toBe(LEAVER_SLOT_BASE);
    expect(leaverSlot(-1)).toBe(MAX_SLOT);
    for (let s = 0; s < LEAVER_FRAME_STEPS; s++) {
      expect(isLeaverSlot(leaverSlot(s))).toBe(true);
      expect(specForSlot(leaverSlot(s))).toBe(LEAVER_SPECS[s]);
    }
    expect(frameAngleAt(1) - frameAngleAt(0)).toBeCloseTo(Math.PI / 2 / LEAVER_FRAME_STEPS, 12);
  });

  it('counter rotates slowly: the frame turns against the view spin', () => {
    expect(LEAVER_SPIN).toBeGreaterThan(0);
    expect(LEAVER_SPIN).toBeLessThan(1.5);
    expect(LEAVER_COUNTER).toBeLessThan(0);
    // The step walks backwards one at a time as time runs.
    const dt = (Math.PI / 2 / LEAVER_FRAME_STEPS / -LEAVER_COUNTER) * 1.0001;
    const a = leaverFrameStep(0.0001, 0.3);
    const b = leaverFrameStep(0.0001 + dt, 0.3);
    expect((a - b + LEAVER_FRAME_STEPS) % LEAVER_FRAME_STEPS).toBe(1);
    for (let t = 0; t < 30; t += 0.37) {
      const s = leaverFrameStep(t, 0.6);
      expect(Number.isInteger(s) && s >= 0 && s < LEAVER_FRAME_STEPS).toBe(true);
    }
  });
});

describe('Leaver shards', () => {
  it('are small solid squares coloured per shard', () => {
    expect(SHAPE_SPECS[Kind.LeaverShard]).toBe(SHARD_SPEC);
    expect(SHARD_SPEC.layers).toHaveLength(1);
    expect(SHARD_SPEC.layers[0]?.fill).toBe(1);
    expect(SHARD_SPEC.layers[0]?.colour).toBeNull();
    expect(SHARD_SPEC.radius).toBeLessThan(10);
    expect([0, 1, 2].map(shardKey)).toEqual(['yellow', 'green', 'red']);
  });

  it('shimmer inside their own colour: the neighbour hue sits within 15 degrees', () => {
    for (const c of [0, 1, 2]) {
      const own = BASE_PALETTE[shardKey(c)][0];
      const nb = BASE_PALETTE[shardShimmerKey(c)][0];
      const d = Math.abs((((nb - own) % 360) + 540) % 360 - 180);
      expect(d).toBeLessThanOrEqual(17);
      expect(PALETTE_KEYS).toContain(shardShimmerKey(c));
    }
  });

  it('flicker and hue mix stay in range and move over time', () => {
    const seen = new Set<string>();
    for (let t = 0; t < 3; t += 0.013) {
      const f = shardFlicker(t, 0.4);
      const h = shardHueMix(t, 0.4);
      expect(f).toBeGreaterThanOrEqual(1 - SHARD_FLICKER - 1e-9);
      expect(f).toBeLessThanOrEqual(1 + 1e-9);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(SHARD_HUE_MIX + 1e-9);
      seen.add(f.toFixed(2));
    }
    expect(seen.size).toBeGreaterThan(10);
  });
});
