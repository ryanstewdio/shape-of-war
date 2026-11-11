import { describe, expect, it } from 'vitest';
import { mixRgb } from '../../src/render/mapFx';
import type { ShapeSpec } from '../../src/render/shapeSpecs';
import {
  AIM_ALPHA,
  AIM_WRAP_SHARE,
  FURY_BREAK_SEC,
  FURY_GLOW,
  FURY_PULSE_MIN,
  FURY_SHAKE_U,
  FURY_SPIKE_BASE,
  FURY_SPIKE_TIP,
  aimBlink,
  aimEnd,
  aimLength,
  aimOn,
  furyFlash,
  furyGlowMul,
  furyHotRed,
  furyProgress,
  furyPulseAlpha,
  furyRedMix,
  furyShake,
  furySpike,
  furySpikeLen,
  furyStage,
  furyTint,
  whiteSpec,
} from '../../src/render/wardenFury';

const BLUE = 0x2a6cff;
const RED = 0xe0203a;
const rect = { shape: 'rect' as const, width: 1000, height: 600 };
const circle = { shape: 'circle' as const, width: 800, height: 800 };

describe('furyStage and progress', () => {
  it('maps absent and unknown values to 0', () => {
    expect(furyStage(undefined)).toBe(0);
    expect(furyStage(0)).toBe(0);
    expect(furyStage(1)).toBe(1);
    expect(furyStage(2)).toBe(2);
    expect(furyStage(3)).toBe(0);
  });
  it('runs 0 to 1 over the break and holds 1 enraged', () => {
    expect(furyProgress(0, 3)).toBe(0);
    expect(furyProgress(1, 0)).toBe(0);
    expect(furyProgress(1, FURY_BREAK_SEC / 2)).toBeCloseTo(0.5);
    expect(furyProgress(1, 99)).toBe(1);
    expect(furyProgress(2, 0)).toBe(1);
    expect(furyProgress(1, Number.NaN)).toBe(0);
  });
});

describe('furyShake', () => {
  it('is zero with no fury and enraged', () => {
    const o = { x: 9, y: 9 };
    expect(furyShake(0, 1.2, o)).toEqual({ x: 0, y: 0 });
    expect(furyShake(2, 1.2, o)).toEqual({ x: 0, y: 0 });
  });
  it('stays within about 4 u during the break and moves', () => {
    const o = { x: 0, y: 0 };
    let moved = false;
    for (let t = 0; t <= FURY_BREAK_SEC; t += 0.05) {
      furyShake(1, t, o);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(FURY_SHAKE_U + 1e-9);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(FURY_SHAKE_U + 1e-9);
      if (Math.abs(o.x) > 1) moved = true;
    }
    expect(moved).toBe(true);
  });
  it('is deterministic in furyT', () => {
    const a = furyShake(1, 2.37, { x: 0, y: 0 });
    const b = furyShake(1, 2.37, { x: 0, y: 0 });
    expect(a).toEqual(b);
  });
});

describe('fury colour', () => {
  it('red share goes 0 to 1 over the break and is 1 enraged', () => {
    expect(furyRedMix(1, 0)).toBe(0);
    expect(furyRedMix(1, FURY_BREAK_SEC)).toBe(1);
    expect(furyRedMix(2, 0)).toBe(1);
    expect(furyRedMix(0, 2)).toBe(0);
    let prev = -1;
    for (let t = 0; t <= FURY_BREAK_SEC; t += 0.1) {
      const m = furyRedMix(1, t);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
  it('flashes faster near the end of the break', () => {
    const edges = (t0: number, t1: number): number => {
      let n = 0;
      let last = furyFlash(1, t0);
      for (let t = t0; t <= t1; t += 0.002) {
        const f = furyFlash(1, t);
        if (f !== last) n++;
        last = f;
      }
      return n;
    };
    expect(edges(3.5, 4.5)).toBeGreaterThan(edges(0, 1));
    expect(furyFlash(0, 1)).toBe(0);
    expect(furyFlash(2, 1)).toBe(0);
  });
  it('tint starts blue, ends hot red and enraged is hot red', () => {
    expect(furyTint(1, 0, BLUE, RED)).toBe(furyFlash(1, 0) === 1 ? mixRgb(BLUE, 0xffffff, 0.8) : BLUE);
    expect(furyTint(1, 0.3, BLUE, RED) & 0xff).toBeGreaterThan(0);
    expect(furyTint(2, 0.7, BLUE, RED)).toBe(furyHotRed(RED));
    expect(furyHotRed(RED)).not.toBe(RED);
    const end = furyTint(1, FURY_BREAK_SEC, BLUE, RED);
    expect([furyHotRed(RED), mixRgb(furyHotRed(RED), 0xffffff, 0.8)]).toContain(end);
  });
  it('glow is 1 with no fury and hot enraged', () => {
    expect(furyGlowMul(0, 1)).toBe(1);
    expect(furyGlowMul(2, 1)).toBe(FURY_GLOW);
    expect(furyGlowMul(1, 0.1)).toBeGreaterThanOrEqual(1);
  });
});

describe('spikes', () => {
  it('length grows 0 to 1 over the break and is full enraged', () => {
    expect(furySpikeLen(0, 2)).toBe(0);
    expect(furySpikeLen(1, 0)).toBe(0);
    expect(furySpikeLen(1, FURY_BREAK_SEC)).toBe(1);
    expect(furySpikeLen(2, 0)).toBe(1);
    expect(furySpikeLen(1, 1)).toBeLessThan(furySpikeLen(1, 3));
  });
  it('tip sits at the base radius at length 0 and the tip radius at full', () => {
    const out = new Float32Array(6);
    furySpike(0, 0, 100, 0, out);
    expect(Math.hypot(out[2] ?? 0, out[3] ?? 0)).toBeCloseTo(FURY_SPIKE_BASE * 100, 3);
    furySpike(0, 0, 100, 1, out);
    expect(out[2]).toBeCloseTo(FURY_SPIKE_TIP * 100, 3);
    expect(out[3]).toBeCloseTo(0, 3);
    expect(Math.hypot(out[0] ?? 0, out[1] ?? 0)).toBeCloseTo(FURY_SPIKE_BASE * 100, 3);
  });
});

describe('furyPulseAlpha', () => {
  it('is 1 outside enraged', () => {
    expect(furyPulseAlpha(0, 0.5)).toBe(1);
    expect(furyPulseAlpha(1, 0.5)).toBe(1);
  });
  it('pulses 0.6 to 1 at about 1 Hz enraged', () => {
    expect(furyPulseAlpha(2, 0)).toBeCloseTo(1);
    expect(furyPulseAlpha(2, 0.5)).toBeCloseTo(FURY_PULSE_MIN);
    expect(furyPulseAlpha(2, 1)).toBeCloseTo(1);
    for (let t = 0; t < 3; t += 0.07) {
      const a = furyPulseAlpha(2, t);
      expect(a).toBeGreaterThanOrEqual(FURY_PULSE_MIN - 1e-9);
      expect(a).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe('dash aim', () => {
  it('shows only for dashAim 0 or more', () => {
    expect(aimOn(undefined)).toBe(false);
    expect(aimOn(-1)).toBe(false);
    expect(aimOn(0)).toBe(true);
    expect(aimOn(0.4)).toBe(true);
    expect(aimOn(Number.NaN)).toBe(false);
  });
  it('blinks', () => {
    expect(aimBlink(0)).toBe(AIM_ALPHA);
    expect(aimBlink(0.7 / 6)).toBeLessThan(AIM_ALPHA);
  });
  it('ends on the rect edge', () => {
    const o = { x: 0, y: 0 };
    aimEnd(0, 0, 0, rect, false, o);
    expect(o.x).toBeCloseTo(500);
    expect(o.y).toBeCloseTo(0);
    aimEnd(100, 0, Math.PI / 2, rect, false, o);
    expect(o.x).toBeCloseTo(100);
    expect(o.y).toBeCloseTo(300);
    aimEnd(0, 0, Math.PI / 4, rect, false, o);
    expect(o.y).toBeCloseTo(300);
    expect(o.x).toBeCloseTo(300);
  });
  it('ends on the circle edge for circle arenas', () => {
    const o = { x: 0, y: 0 };
    aimEnd(0, 0, Math.PI, circle, false, o);
    expect(o.x).toBeCloseTo(-400);
    aimEnd(100, 50, 1.1, circle, false, o);
    expect(Math.hypot(o.x, o.y)).toBeCloseTo(400);
  });
  it('on a cylinder stops at the rims, or at the wrap cap across u', () => {
    expect(aimLength(0, 0, 0, rect, true)).toBeCloseTo(AIM_WRAP_SHARE * rect.width);
    expect(aimLength(0, 100, Math.PI / 2, rect, true)).toBeCloseTo(200);
  });
  it('is never negative outside the arena', () => {
    expect(aimLength(900, 0, 0, rect, false)).toBe(0);
  });
});

describe('whiteSpec', () => {
  it('clears every baked colour and keeps geometry', () => {
    const spec: ShapeSpec = {
      tint: null,
      radius: 40,
      layers: [
        { prims: [{ t: 'circle', r: 10 }], width: 2, fill: 0.2, colour: 'bossBlue', glow: true, alpha: 1 },
        { prims: [{ t: 'circle', r: 5 }], width: 1, fill: 1, colour: 'white', glow: false, alpha: 1, haloMul: 1.5 },
      ],
    };
    const w = whiteSpec(spec);
    expect(w.radius).toBe(40);
    expect(w.layers.map((l) => l.colour)).toEqual([null, null]);
    expect(w.layers[1]?.haloMul).toBe(1.5);
    expect(w.layers[0]?.prims).toBe(spec.layers[0]?.prims);
    expect(spec.layers[0]?.colour).toBe('bossBlue');
  });
});
