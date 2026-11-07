import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { POND_WAVE_LIFE, POND_WAVE_SPEED, POND_WAVE_WIDTH } from '../../src/core/pondRipple';
import { makeCamera, project, type Projected } from '../../src/render/project';
import { RIPPLE_LIFE, RIPPLE_SPEED, RIPPLE_WIDTH, tracePondGridProjected, traceRippledGrid, type Pen } from '../../src/render/ripple';
import * as pondApi from '../../src/render/pondWave';
import {
  addPondToNodes,
  addPondWave,
  crestAlpha,
  crestWhite,
  devPondDrop,
  DEV_POND_PERIOD,
  MAX_POND_WAVES,
  parsePondKnob,
  POND_AMP_MAX,
  POND_AMP_MIN,
  POND_CRESTS,
  POND_LIFT_MUL,
  POND_TRAIL_DECAY,
  POND_WAVELENGTH,
  pondAmp,
  pondCrestOffset,
  pondCrestRadius,
  pondDisplace,
  pondFade,
  pondFrontRadius,
  pondGlow,
  pondProfile,
  pondReach,
  stepPondWaves,
  wrapDelta,
  type PondOut,
  type PondWave,
} from '../../src/render/pondWave';

const out = (): PondOut => ({ x: 0, y: 0, z: 0, h: 0 });

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

  it('crest k sits at front minus its offset, one wavelength apart, formed only once the front has passed', () => {
    for (const age of [0.5, 1, 2, 3]) {
      for (let k = 0; k < POND_CRESTS; k++) expect(pondCrestRadius(age, k)).toBeCloseTo(POND_WAVE_SPEED * age - pondCrestOffset(k), 9);
    }
    expect(pondCrestOffset(0)).toBe(0);
    expect(pondCrestOffset(2) - pondCrestOffset(1)).toBeCloseTo(POND_WAVELENGTH, 9);
    expect(pondCrestRadius(0.1, 2)).toBeLessThan(0);
    // Both trailing crests have formed well inside the life, so a still mid wave shows all three.
    expect(pondCrestOffset(2) / POND_WAVE_SPEED).toBeLessThan(POND_WAVE_LIFE * 0.75);
    expect(POND_CRESTS).toBe(3);
  });

  it('the lead crest is the sim band: cos squared over plus or minus POND_WAVE_WIDTH (160)', () => {
    expect(POND_WAVE_WIDTH).toBe(160);
    expect(pondProfile(0)).toBeCloseTo(1, 9);
    expect(pondProfile(POND_WAVE_WIDTH / 2)).toBeCloseTo(0.5, 9);
    expect(pondProfile(-POND_WAVE_WIDTH / 2)).toBeCloseTo(0.5, 9);
    expect(pondProfile(POND_WAVE_WIDTH)).toBe(0);
    for (let d = -POND_WAVE_WIDTH + 1; d < POND_WAVE_WIDTH; d += 7) expect(pondProfile(d)).toBeGreaterThan(0);
  });

  it('two trailing crests, each POND_TRAIL_DECAY of the one ahead, with troughs between', () => {
    const c1 = pondProfile(-pondCrestOffset(1));
    const c2 = pondProfile(-pondCrestOffset(2));
    expect(c1).toBeCloseTo(POND_TRAIL_DECAY, 9);
    expect(c2).toBeCloseTo(POND_TRAIL_DECAY * POND_TRAIL_DECAY, 9);
    expect(pondProfile(-POND_WAVE_WIDTH - 0.25 * POND_WAVELENGTH)).toBeLessThan(0);
    expect(pondProfile(-pondCrestOffset(1) - 0.5 * POND_WAVELENGTH)).toBeLessThan(0);
    const r = pondReach(3);
    expect(pondProfile(r.outer - POND_WAVE_SPEED * 3 + 1)).toBe(0);
    expect(pondProfile(r.inner - POND_WAVE_SPEED * 3 - 1)).toBe(0);
  });

  it('is continuous everywhere along the train', () => {
    let prev = pondProfile(POND_WAVE_WIDTH + 1);
    for (let d = POND_WAVE_WIDTH; d > -1200; d -= 0.5) {
      const v = pondProfile(d);
      expect(Math.abs(v - prev)).toBeLessThan(0.02);
      prev = v;
    }
  });

  it('the grid never folds over: a single wave keeps the radial map increasing', () => {
    for (const age of [0.3, 0.8, 1.4, 2.2, 2.9]) {
      const list: PondWave[] = [];
      addPondWave(list, 0, 0, 1);
      stepPondWaves(list, age);
      const o = out();
      let prev = -Infinity;
      for (let r = 120; r < 1500; r += 2) {
        pondDisplace(r, 0, list, o);
        expect(r + o.x).toBeGreaterThan(prev);
        prev = r + o.x;
      }
    }
  });

  it('is clearly bigger and slower than the explosion ripple', () => {
    expect(POND_WAVE_SPEED).toBeLessThan(RIPPLE_SPEED);
    expect(POND_WAVE_LIFE).toBeGreaterThan(RIPPLE_LIFE);
    const r = pondReach(1);
    expect(r.outer - r.inner).toBeGreaterThan(2 * RIPPLE_WIDTH);
  });
});

describe('pond wave amplitude and fade', () => {
  it('amplitude runs about 40 to 80 u by strength (three times T3)', () => {
    expect(POND_AMP_MIN).toBe(40);
    expect(POND_AMP_MAX).toBe(80);
    expect(pondAmp(0)).toBe(40);
    expect(pondAmp(0.6)).toBeCloseTo(64, 9);
    expect(pondAmp(1)).toBe(80);
    // Peak lift at the front mid life is still most of the amplitude.
    const list: PondWave[] = [];
    addPondWave(list, 0, 0, 1);
    stepPondWaves(list, 1);
    const o = out();
    pondDisplace(POND_WAVE_SPEED, 0, list, o);
    expect(o.x).toBeGreaterThan(70);
    expect(o.z).toBeCloseTo(o.x * POND_LIFT_MUL, 6);
    expect(o.h).toBeCloseTo(o.x, 6);
  });

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
    stepPondWaves(list, 3);
    const o = out();
    pondDisplace(10, 0, list, o);
    expect(o).toEqual({ x: 0, y: 0, z: 0, h: 0 });
    pondDisplace(5000, 0, list, o);
    expect(o).toEqual({ x: 0, y: 0, z: 0, h: 0 });
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

describe('no telegraph', () => {
  it('the module has no warn api and never reads RIPPLE_WARN_SEC', () => {
    const names = Object.keys(pondApi);
    for (const n of names) expect(n.toLowerCase()).not.toContain('warn');
    const src = readFileSync('src/render/pondWave.ts', 'utf8');
    expect(src).not.toContain('RIPPLE_WARN_SEC');
  });

  it('the renderer listens to sim:ripple only, and starts the wave on it at once', () => {
    const src = readFileSync('src/render/renderer.ts', 'utf8');
    expect(src).not.toContain('sim:rippleWarn');
    expect(src).not.toContain('RIPPLE_WARN_SEC');
    expect(src).toContain("bus.on('sim:ripple', (p) => addPondWave(pondWaves, p.x, p.y, p.strength))");
  });

  it('a new wave moves the grid on its first frame', () => {
    const list: PondWave[] = [];
    addPondWave(list, 0, 0, 1);
    stepPondWaves(list, 1 / 60);
    const o = out();
    pondDisplace(POND_WAVE_SPEED / 60 + 20, 0, list, o);
    expect(o.x).toBeGreaterThan(0);
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

  it('crest outlines burn toward white with their height', () => {
    const w: PondWave = { x: 0, y: 0, age: 1.2, strength: 1 };
    expect(crestWhite(w, 0)).toBeGreaterThan(0.85);
    expect(crestWhite(w, 0)).toBeLessThanOrEqual(1);
    expect(crestWhite(w, 0)).toBeGreaterThan(crestWhite(w, 2));
    expect(crestWhite({ ...w, strength: 0.6 }, 0)).toBeLessThan(crestWhite(w, 0));
    expect(crestWhite({ ...w, age: POND_WAVE_LIFE }, 0)).toBe(0);
  });

  it('lattice glow is 0 on flat and troughs, 1 on a lifted crest', () => {
    expect(pondGlow(0)).toBe(0);
    expect(pondGlow(-30)).toBe(0);
    expect(pondGlow(Number.NaN)).toBe(0);
    expect(pondGlow(POND_AMP_MIN / 2)).toBeCloseTo(0.5, 9);
    expect(pondGlow(POND_AMP_MAX)).toBe(1);
    const list: PondWave[] = [];
    addPondWave(list, 0, 0, 0.6);
    stepPondWaves(list, 1);
    const pos = new Float32Array(4);
    const glow = new Float32Array(2);
    addPondToNodes(pos, new Float32Array([POND_WAVE_SPEED, 0]), new Float32Array([0, 900]), 2, list, null, glow);
    expect(glow[0]).toBe(1);
    expect(glow[1]).toBe(0);
  });

  it('wraps across the drum seam: a wave near +W/2 moves nodes just past -W/2', () => {
    const W = 2000;
    expect(wrapDelta(1900, W)).toBeCloseTo(-100, 9);
    expect(wrapDelta(-1100, W)).toBeCloseTo(900, 9);
    expect(wrapDelta(300, W)).toBe(300);
    expect(wrapDelta(1900, 0)).toBe(1900);
    const list: PondWave[] = [];
    addPondWave(list, W / 2 - 100, 0, 1);
    stepPondWaves(list, 1);
    const across = out();
    const same = out();
    // 360 u to the right of the source across the seam, and 360 u to its left on the same side.
    pondDisplace(-W / 2 + 260, 0, list, across, W);
    pondDisplace(W / 2 - 460, 0, list, same, W);
    expect(across.h).toBeGreaterThan(70);
    expect(across.h).toBeCloseTo(same.h, 6);
    expect(across.x).toBeGreaterThan(0);
    expect(same.x).toBeLessThan(0);
    const unwrapped = out();
    pondDisplace(-W / 2 + 260, 0, list, unwrapped);
    expect(unwrapped.h).toBe(0);
  });

  it('bends and lifts the projected v1 grid on low with tilt on, flat after the wave', () => {
    const cam = makeCamera(13, 1000);
    const segs = [-600, 200, 600, 200];
    const record = (): { pts: number[]; pen: Pen } => {
      const pts: number[] = [];
      const pen: Pen = {
        moveTo: (x: number, y: number) => pts.push(x, y),
        lineTo: (x: number, y: number) => pts.push(x, y),
      };
      return { pts, pen };
    };
    const list: PondWave[] = [];
    addPondWave(list, 0, 0, 1);
    stepPondWaves(list, 200 / POND_WAVE_SPEED);
    const bent = record();
    tracePondGridProjected(segs, list, bent.pen, cam);
    // The point straight over the source sits on the crest: pushed out and lifted toward the viewer.
    const flatP: Projected = { x: 0, y: 0, s: 1 };
    project(0, 200, 0, cam, flatP);
    const mid = bent.pts.length / 2;
    const my = bent.pts[mid % 2 === 0 ? mid + 1 : mid] ?? 0;
    expect(Math.abs(my - flatP.y)).toBeGreaterThan(10);
    stepPondWaves(list, POND_WAVE_LIFE);
    const after = record();
    tracePondGridProjected(segs, list, after.pen, cam);
    for (let i = 0; i + 1 < after.pts.length; i += 2) {
      const p: Projected = { x: 0, y: 0, s: 1 };
      const t = i / (after.pts.length - 2);
      project(-600 + 1200 * t, 200, 0, cam, p);
      expect(after.pts[i]).toBeCloseTo(p.x, 6);
      expect(after.pts[i + 1]).toBeCloseTo(p.y, 6);
    }
  });
});

describe('pond dev knob', () => {
  it('reads pond=1 only', () => {
    expect(parsePondKnob('?dev=1&pond=1')).toBe(true);
    expect(parsePondKnob('?pond=0')).toBe(false);
    expect(parsePondKnob('')).toBe(false);
  });

  it('cycles drop points inside the arena, a strength 1 wave every 4.5 s', () => {
    expect(DEV_POND_PERIOD).toBe(4.5);
    for (let n = 0; n < 8; n++) {
      const d = devPondDrop(n, 1600, 1000);
      expect(Math.abs(d.x)).toBeLessThan(800);
      expect(Math.abs(d.y)).toBeLessThan(500);
      expect(d.strength).toBe(1);
    }
    expect(devPondDrop(4, 1600, 1000)).toEqual(devPondDrop(0, 1600, 1000));
  });
});
