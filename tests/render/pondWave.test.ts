import { describe, expect, it } from 'vitest';
import { POND_WAVE_LIFE, POND_WAVE_SPEED, RIPPLE_WARN_SEC } from '../../src/core/pondRipple';
import { RIPPLE_LIFE, RIPPLE_SPEED, RIPPLE_WIDTH, traceRippledGrid, type Pen } from '../../src/render/ripple';
import {
  addPondToNodes,
  addPondWarn,
  addPondWave,
  crestAlpha,
  devPondDrop,
  MAX_POND_WARNS,
  MAX_POND_WAVES,
  parsePondKnob,
  POND_AMP_MAX,
  POND_CRESTS,
  POND_WAVELENGTH,
  pondAmp,
  pondCrestRadius,
  pondDisplace,
  pondFade,
  pondFrontRadius,
  pondProfile,
  pondReach,
  stepPondWarns,
  stepPondWaves,
  warnAlpha,
  warnProgress,
  warnRadius,
  WARN_R0,
  WARN_R1,
  type PondOut,
  type PondWarn,
  type PondWave,
} from '../../src/render/pondWave';

const out = (): PondOut => ({ x: 0, y: 0, z: 0 });

/** Radius of largest displacement along +x from a wave at the origin. */
function peakRadius(list: readonly PondWave[]): number {
  const o = out();
  let best = 0;
  let at = 0;
  for (let r = 1; r < 1400; r += 0.5) {
    pondDisplace(r, 0, list, o);
    if (o.x > best) {
      best = o.x;
      at = r;
    }
  }
  return at;
}

describe('pond wave radius follows the sim constants', () => {
  it('front radius is POND_WAVE_SPEED x age', () => {
    for (const age of [0, 0.1, 0.5, 1, 2, POND_WAVE_LIFE]) expect(pondFrontRadius(age)).toBeCloseTo(POND_WAVE_SPEED * age, 9);
    expect(pondFrontRadius(-1)).toBe(0);
    expect(pondFrontRadius(Number.NaN)).toBe(0);
  });

  it('the strongest outward push sits on the sim front at every age', () => {
    for (const age of [0.4, 1, 1.8, 2.4]) {
      const list: PondWave[] = [];
      addPondWave(list, 0, 0, 1);
      stepPondWaves(list, age);
      expect(Math.abs(peakRadius(list) - POND_WAVE_SPEED * age)).toBeLessThanOrEqual(1);
    }
  });

  it('crests trail the front one wavelength apart and form only once the front has passed', () => {
    expect(pondCrestRadius(1, 0)).toBeCloseTo(POND_WAVE_SPEED, 9);
    expect(pondCrestRadius(1, 1)).toBeCloseTo(POND_WAVE_SPEED - POND_WAVELENGTH, 9);
    expect(pondCrestRadius(1, 2)).toBeCloseTo(POND_WAVE_SPEED - 2 * POND_WAVELENGTH, 9);
    expect(pondCrestRadius(0.1, 2)).toBeLessThan(0);
    expect(POND_CRESTS).toBe(3);
  });

  it('two trailing crests, each smaller than the one ahead', () => {
    expect(pondProfile(0)).toBeCloseTo(1, 9);
    const c1 = pondProfile(-POND_WAVELENGTH);
    const c2 = pondProfile(-2 * POND_WAVELENGTH);
    expect(c1).toBeGreaterThan(0);
    expect(c2).toBeGreaterThan(0);
    expect(c1).toBeLessThan(1);
    expect(c2).toBeLessThan(c1);
    // Troughs between crests pull back in; nothing past the reach.
    expect(pondProfile(-0.5 * POND_WAVELENGTH)).toBeLessThan(0);
    expect(pondProfile(0.3 * POND_WAVELENGTH)).toBe(0);
    expect(pondProfile(-2.3 * POND_WAVELENGTH)).toBe(0);
  });

  it('is continuous at both ends of the train', () => {
    expect(Math.abs(pondProfile(0.2499 * POND_WAVELENGTH))).toBeLessThan(0.01);
    expect(Math.abs(pondProfile(-2.2499 * POND_WAVELENGTH))).toBeLessThan(0.01);
  });

  it('is clearly bigger and slower than the explosion ripple', () => {
    expect(POND_WAVE_SPEED).toBeLessThan(RIPPLE_SPEED);
    expect(POND_WAVE_LIFE).toBeGreaterThan(RIPPLE_LIFE);
    const r = pondReach(1);
    expect(r.outer - r.inner).toBeGreaterThan(2 * RIPPLE_WIDTH);
  });
});

describe('pond wave amplitude and fade', () => {
  it('amplitude grows with strength and clamps to 0..1', () => {
    expect(pondAmp(1)).toBe(POND_AMP_MAX);
    expect(pondAmp(0.2)).toBeLessThan(pondAmp(1));
    expect(pondAmp(5)).toBe(pondAmp(1));
    expect(pondAmp(-1)).toBe(pondAmp(0));
  });

  it('fades in fast, out to nothing at its life', () => {
    expect(pondFade(0)).toBe(0);
    expect(pondFade(0.3)).toBeGreaterThan(0.9);
    expect(pondFade(POND_WAVE_LIFE * 0.5)).toBeGreaterThan(pondFade(POND_WAVE_LIFE * 0.9));
    expect(pondFade(POND_WAVE_LIFE - 1e-6)).toBeLessThan(1e-4);
    expect(pondFade(POND_WAVE_LIFE)).toBe(0);
  });

  it('a stronger wave pushes the grid further', () => {
    const a: PondWave[] = [];
    const b: PondWave[] = [];
    addPondWave(a, 0, 0, 0.2);
    addPondWave(b, 0, 0, 1);
    stepPondWaves(a, 1);
    stepPondWaves(b, 1);
    const oa = out();
    const ob = out();
    pondDisplace(POND_WAVE_SPEED, 0, a, oa);
    pondDisplace(POND_WAVE_SPEED, 0, b, ob);
    expect(ob.x).toBeGreaterThan(oa.x);
    expect(oa.x).toBeGreaterThan(0);
    expect(ob.z).toBeGreaterThan(0);
  });

  it('leaves points outside the band alone', () => {
    const list: PondWave[] = [];
    addPondWave(list, 0, 0, 1);
    stepPondWaves(list, 2);
    const o = out();
    pondDisplace(10, 0, list, o);
    expect(o).toEqual({ x: 0, y: 0, z: 0 });
    pondDisplace(5000, 0, list, o);
    expect(o).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('pond wave lifetime and cleanup', () => {
  it('drops a wave at its life and the grid returns flat', () => {
    const list: PondWave[] = [];
    addPondWave(list, 0, 0, 1);
    stepPondWaves(list, POND_WAVE_LIFE - 0.01);
    expect(list).toHaveLength(1);
    stepPondWaves(list, 0.02);
    expect(list).toHaveLength(0);
    const pos = new Float32Array([100, 0, 200, 0]);
    addPondToNodes(pos, new Float32Array([100, 200]), new Float32Array([0, 0]), 2, list, null);
    expect(Array.from(pos)).toEqual([100, 0, 200, 0]);
  });

  it('at most MAX_POND_WAVES live, the oldest goes', () => {
    const list: PondWave[] = [];
    for (let i = 0; i < MAX_POND_WAVES + 2; i++) {
      addPondWave(list, i, 0, 1);
      stepPondWaves(list, 0.1);
    }
    expect(MAX_POND_WAVES).toBe(3);
    expect(list).toHaveLength(MAX_POND_WAVES);
    expect(list.map((w) => w.x)).toEqual([2, 3, 4]);
  });

  it('ignores a bad drop point and a negative or bad dt', () => {
    const list: PondWave[] = [];
    addPondWave(list, Number.NaN, 0, 1);
    expect(list).toHaveLength(0);
    addPondWave(list, 0, 0, 1);
    stepPondWaves(list, -1);
    stepPondWaves(list, Number.NaN);
    expect(list[0]?.age).toBe(0);
  });
});

describe('pond telegraph', () => {
  it('lives RIPPLE_WARN_SEC by default and inSec when given', () => {
    const list: PondWarn[] = [];
    addPondWarn(list, 0, 0, 0, 1);
    expect(list[0]?.life).toBe(RIPPLE_WARN_SEC);
    stepPondWarns(list, RIPPLE_WARN_SEC - 0.01);
    expect(list).toHaveLength(1);
    stepPondWarns(list, 0.02);
    expect(list).toHaveLength(0);
    addPondWarn(list, 0, 0, 0.5, 1);
    expect(list[0]?.life).toBe(0.5);
    stepPondWarns(list, 0.51);
    expect(list).toHaveLength(0);
  });

  it('tightens onto the drop point and stays visible', () => {
    expect(warnRadius(0)).toBe(WARN_R0);
    expect(warnRadius(1)).toBe(WARN_R1);
    expect(warnRadius(0.5)).toBeLessThan(WARN_R0);
    const w: PondWarn = { x: 0, y: 0, age: 0, life: 1, strength: 1 };
    for (let t = 0; t < 1; t += 0.05) {
      w.age = t;
      expect(warnProgress(w)).toBeCloseTo(t, 9);
      const a = warnAlpha(w);
      expect(a).toBeGreaterThan(0.1);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it('keeps at most MAX_POND_WARNS', () => {
    const list: PondWarn[] = [];
    for (let i = 0; i < MAX_POND_WARNS + 3; i++) addPondWarn(list, i, 0, 1, 1);
    expect(list).toHaveLength(MAX_POND_WARNS);
  });
});

describe('pond wave on the grid', () => {
  it('moves free lattice nodes and lifts them, never the pinned ends', () => {
    const list: PondWave[] = [];
    addPondWave(list, 0, 0, 1);
    stepPondWaves(list, 1);
    const restX = new Float32Array([POND_WAVE_SPEED, POND_WAVE_SPEED]);
    const restY = new Float32Array([0, 0]);
    const pos = new Float32Array([POND_WAVE_SPEED, 0, POND_WAVE_SPEED, 0]);
    const lift = new Float32Array(2);
    addPondToNodes(pos, restX, restY, 1, list, lift);
    expect(pos[0]).toBeGreaterThan(POND_WAVE_SPEED);
    expect(lift[0]).toBeGreaterThan(0);
    expect(pos[2]).toBe(POND_WAVE_SPEED);
    expect(lift[1]).toBe(0);
  });

  it('bends the v1 grid trace while a wave is live, flat without one', () => {
    const segs = [-600, 0, 600, 0];
    const record = (): { pts: number[]; pen: Pen } => {
      const pts: number[] = [];
      const pen: Pen = {
        moveTo: (x: number, y: number) => pts.push(x, y),
        lineTo: (x: number, y: number) => pts.push(x, y),
      };
      return { pts, pen };
    };
    const flat = record();
    traceRippledGrid(segs, [], flat.pen);
    const list: PondWave[] = [];
    addPondWave(list, 0, 0, 1);
    stepPondWaves(list, 1);
    const bent = record();
    traceRippledGrid(segs, [], bent.pen, list);
    expect(bent.pts).not.toEqual(flat.pts);
    stepPondWaves(list, POND_WAVE_LIFE);
    const after = record();
    traceRippledGrid(segs, [], after.pen, list);
    expect(after.pts).toEqual(flat.pts);
  });

  it('crest outlines fade with the wave and trail dimmer', () => {
    const w: PondWave = { x: 0, y: 0, age: 1.2, strength: 1 };
    expect(crestAlpha(w, 0)).toBeGreaterThan(crestAlpha(w, 1));
    expect(crestAlpha(w, 1)).toBeGreaterThan(crestAlpha(w, 2));
    expect(crestAlpha({ ...w, age: 0.05 }, 2)).toBe(0);
    expect(crestAlpha({ ...w, age: POND_WAVE_LIFE }, 0)).toBe(0);
  });
});

describe('pond dev knob', () => {
  it('reads pond=1 only', () => {
    expect(parsePondKnob('?dev=1&pond=1')).toBe(true);
    expect(parsePondKnob('?pond=0')).toBe(false);
    expect(parsePondKnob('')).toBe(false);
  });

  it('cycles drop points inside the arena', () => {
    for (let n = 0; n < 8; n++) {
      const d = devPondDrop(n, 1600, 1000);
      expect(Math.abs(d.x)).toBeLessThan(800);
      expect(Math.abs(d.y)).toBeLessThan(500);
      expect(d.strength).toBeGreaterThan(0);
    }
    expect(devPondDrop(4, 1600, 1000)).toEqual(devPondDrop(0, 1600, 1000));
  });
});
