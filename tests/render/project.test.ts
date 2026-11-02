import { describe, expect, it } from 'vitest';
import { fitArena, FIT_MARGIN, type PlayRect } from '../../src/render/layout';
import {
  affineAt,
  cameraFor,
  depthScale,
  FOCAL_MUL,
  fitProjected,
  makeCamera,
  MAX_TILT_DEG,
  parseTiltKnob,
  project,
  projectedBounds,
  projectNodes,
  TILT_DEG,
  type Affine,
  type Camera,
  type Projected,
} from '../../src/render/project';
import { getTilt, setTilt } from '../../src/render/tilt';

const P = (): Projected => ({ x: 0, y: 0, s: 1 });

/** Reference projection written out longhand from the design (docs/12 item 3, far wall at top). */
function reference(x: number, y: number, z: number, deg: number, H: number): { x: number; y: number } {
  const t = (deg * Math.PI) / 180;
  const D = FOCAL_MUL * H;
  const yr = y * Math.cos(t) - z * Math.sin(t);
  const depth = -(y * Math.sin(t) + z * Math.cos(t));
  const f = D / (D + depth);
  return { x: x * f, y: yr * f };
}

describe('tilt levels', () => {
  it('off, low 7 deg, high 13 deg; default off', () => {
    expect(TILT_DEG).toEqual({ off: 0, low: 7, high: 13 });
    expect(getTilt()).toBe('off');
    setTilt('high');
    expect(getTilt()).toBe('high');
    setTilt('off');
    expect(getTilt()).toBe('off');
    expect(cameraFor('off', 1000).on).toBe(false);
    expect(cameraFor('low', 1000).deg).toBe(7);
    expect(cameraFor('high', 1000).deg).toBe(13);
  });
});

describe('parseTiltKnob', () => {
  it('reads ?tilt=off|low|high and ignores anything else', () => {
    expect(parseTiltKnob('?tilt=low')).toBe('low');
    expect(parseTiltKnob('?stress=400&tilt=high')).toBe('high');
    expect(parseTiltKnob('?tilt=off')).toBe('off');
    expect(parseTiltKnob('?tilt=max')).toBeNull();
    expect(parseTiltKnob('')).toBeNull();
  });
});

describe('project', () => {
  it('tilt 0 is the identity on x and y for any z', () => {
    const cam = makeCamera(0, 1100);
    const o = P();
    for (const [x, y, z] of [
      [0, 0, 0],
      [800, -550, 0],
      [-123.456, 789.01, 25],
      [1e6, -1e6, -30],
    ] as const) {
      project(x, y, z, cam, o);
      expect(o.x).toBe(x);
      expect(o.y).toBe(y);
      expect(o.s).toBe(1);
    }
  });

  it('matches known points at 7, 13 and 22 deg', () => {
    const H = 1100;
    for (const deg of [7, 13, 22]) {
      const cam = makeCamera(deg, H);
      const o = P();
      for (const [x, y, z] of [
        [0, 0, 0],
        [900, -550, 0],
        [-900, 550, 0],
        [400, 200, 20],
        [-300, -100, -15],
      ] as const) {
        project(x, y, z, cam, o);
        const r = reference(x, y, z, deg, H);
        expect(o.x).toBeCloseTo(r.x, 9);
        expect(o.y).toBeCloseTo(r.y, 9);
      }
    }
    // Hand checked values at 22 deg, H 1100 (D 2750): the far wall centre and a near corner.
    const cam = makeCamera(22, H);
    const o = P();
    project(0, -550, 0, cam, o);
    expect(o.y).toBeCloseTo((-550 * Math.cos(0.383972435)) * (2750 / (2750 + 550 * Math.sin(0.383972435))), 6);
    expect(o.y).toBeCloseTo(-474.41, 1);
    project(900, 550, 0, cam, o);
    expect(o.x).toBeCloseTo(972.89, 1);
    expect(o.y).toBeCloseTo(551.26, 1);
  });

  it('the far wall (top) is smaller and higher than the near wall', () => {
    for (const deg of [7, 13, 22]) {
      const cam = makeCamera(deg, 1000);
      const top = P();
      const bottom = P();
      project(500, -500, 0, cam, top);
      project(500, 500, 0, cam, bottom);
      expect(top.s).toBeLessThan(1);
      expect(bottom.s).toBeGreaterThan(1);
      expect(top.x).toBeLessThan(bottom.x);
      expect(-top.y).toBeLessThan(bottom.y);
    }
  });

  it('a lift moves a point up the screen and toward the viewer', () => {
    const cam = makeCamera(22, 1000);
    const flat = P();
    const up = P();
    project(100, 0, 0, cam, flat);
    project(100, 0, 20, cam, up);
    expect(up.y).toBeLessThan(flat.y);
    expect(up.s).toBeGreaterThan(flat.s);
  });

  it('depth is monotonic: scale rises from the far wall to the near wall and with lift', () => {
    for (const deg of [1, 12, 22, 45, MAX_TILT_DEG]) {
      const cam = makeCamera(deg, 1100);
      let prevS = 0;
      let prevY = -Infinity;
      for (let y = -2000; y <= 2000; y += 25) {
        const s = depthScale(y, 0, cam);
        expect(s).toBeGreaterThanOrEqual(prevS);
        prevS = s;
        const o = project(0, y, 0, cam, P());
        // Screen y never folds back over the visible span of a level (the arena and a margin).
        if (Math.abs(y) <= 1100) expect(o.y).toBeGreaterThan(prevY);
        if (Math.abs(y) <= 1100) prevY = o.y;
      }
      let prevZ = 0;
      for (let z = -60; z <= 60; z += 5) {
        const s = depthScale(0, z, cam);
        expect(s).toBeGreaterThanOrEqual(prevZ);
        prevZ = s;
      }
    }
  });

  it('no NaN or infinity at the extremes', () => {
    const vals = [0, 1, -1, 1e-9, 1e6, -1e6, 99999, -99999, 1e12, -1e12];
    for (const deg of [0, 0.001, 12, 22, 60, MAX_TILT_DEG, 90, 180, -10, Number.NaN]) {
      for (const H of [1, 1000, 1100, 1e6, 0, -5, Number.NaN]) {
        const cam = makeCamera(deg, H);
        expect(Number.isFinite(cam.cos) && Number.isFinite(cam.sin) && cam.focal > 0).toBe(true);
        const o = P();
        const a: Affine = { a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 };
        for (const x of vals) {
          for (const y of vals) {
            for (const z of [0, 30, -30, 1e6, -1e6]) {
              project(x, y, z, cam, o);
              expect(Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.s)).toBe(true);
              expect(o.s).toBeGreaterThan(0);
            }
            affineAt(x, y, cam, a);
            for (const v of [a.a, a.b, a.c, a.d, a.tx, a.ty]) expect(Number.isFinite(v)).toBe(true);
          }
        }
      }
    }
  });

  it('projectNodes matches project and leaves the array alone at tilt 0', () => {
    const n = 50;
    const pos = new Float32Array(n * 2);
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[2 * i] = (i - 25) * 33;
      pos[2 * i + 1] = (i % 7) * 120 - 400;
      z[i] = (i % 5) * 4 - 8;
    }
    const before = pos.slice();
    projectNodes(pos, z, n, makeCamera(0, 1000));
    expect(Array.from(pos)).toEqual(Array.from(before));
    const cam = makeCamera(22, 1000);
    projectNodes(pos, z, n, cam);
    const o = P();
    for (let i = 0; i < n; i++) {
      project(before[2 * i] ?? 0, before[2 * i + 1] ?? 0, z[i] ?? 0, cam, o);
      expect(pos[2 * i]).toBeCloseTo(o.x, 3);
      expect(pos[2 * i + 1]).toBeCloseTo(o.y, 3);
    }
  });

  it('affineAt is exact at its point and close nearby', () => {
    const cam = makeCamera(22, 1100);
    const a: Affine = { a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 };
    const o = P();
    for (const [px, py] of [
      [0, 0],
      [700, -450],
      [-600, 500],
    ] as const) {
      affineAt(px, py, cam, a);
      project(px, py, 0, cam, o);
      expect(a.a * px + a.c * py + a.tx).toBeCloseTo(o.x, 9);
      expect(a.b * px + a.d * py + a.ty).toBeCloseTo(o.y, 9);
      // 40 u away (a ring or a lane end) the linearisation is within half a unit.
      project(px + 40, py + 40, 0, cam, o);
      expect(Math.abs(a.a * (px + 40) + a.c * (py + 40) + a.tx - o.x)).toBeLessThan(0.5);
      expect(Math.abs(a.b * (px + 40) + a.d * (py + 40) + a.ty - o.y)).toBeLessThan(0.5);
    }
  });

  it('timing proxy: 8192 lattice nodes', () => {
    const n = 8192;
    const pos = new Float32Array(n * 2);
    const z = new Float32Array(n);
    const src = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      src[2 * i] = ((i % 128) - 64) * 14;
      src[2 * i + 1] = (Math.floor(i / 128) - 32) * 17;
      z[i] = (i % 9) - 4;
    }
    const cam = makeCamera(22, 1100);
    for (let k = 0; k < 50; k++) {
      pos.set(src);
      projectNodes(pos, z, n, cam);
    }
    const reps = 400;
    const t0 = performance.now();
    for (let k = 0; k < reps; k++) {
      pos.set(src);
      projectNodes(pos, z, n, cam);
    }
    const ms = (performance.now() - t0) / reps;
    console.log(`[tilt] projectNodes 8192 nodes: ${ms.toFixed(4)} ms per frame (node proxy, includes the copy)`);
    // Proxy only: the device budget is 0.5 ms for nodes plus entities (docs/12 item 7).
    expect(ms).toBeLessThan(5);
  });
});

/** Every outline point of an arena box, sampled, projected to screen through a fit. */
function screenPoints(w: number, h: number, cam: Camera, fit: { scale: number; x: number; y: number }): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const o = P();
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const u = -w / 2 + (w * i) / steps;
    const v = -h / 2 + (h * i) / steps;
    for (const [x, y] of [
      [u, -h / 2],
      [u, h / 2],
      [-w / 2, v],
      [w / 2, v],
    ] as const) {
      project(x, y, 0, cam, o);
      out.push({ x: fit.x + o.x * fit.scale, y: fit.y + o.y * fit.scale });
    }
  }
  return out;
}

describe('fitProjected', () => {
  // Safe rects for the two aspect classes (hudFrame: cover when w / h >= 1.8): the folded cover
  // screen and the near square main screen, each minus a HUD band and insets.
  const rects: { name: string; r: PlayRect }[] = [
    { name: 'cover', r: { x: 40, y: 24, w: 820, h: 330 } },
    { name: 'main', r: { x: 16, y: 72, w: 762, h: 620 } },
  ];
  const arenas = [
    { name: 'Endless 1600 x 1000', w: 1600, h: 1000 },
    { name: 'level 1800 x 1100', w: 1800, h: 1100 },
  ];

  it('off equals fitArena exactly', () => {
    for (const { r } of rects) {
      for (const a of arenas) {
        expect(fitProjected(a.w, a.h, r, makeCamera(0, a.h))).toEqual(fitArena(a.w, a.h, r));
      }
    }
  });

  for (const { name, r } of rects) {
    for (const a of arenas) {
      for (const level of ['low', 'high'] as const) {
        it(`keeps the whole ${a.name} arena inside the ${name} safe rect at ${level}`, () => {
          const cam = cameraFor(level, a.h);
          const fit = fitProjected(a.w, a.h, r, cam);
          const mx = r.w * FIT_MARGIN - 1e-6;
          const my = r.h * FIT_MARGIN - 1e-6;
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          for (const p of screenPoints(a.w, a.h, cam, fit)) {
            expect(p.x).toBeGreaterThanOrEqual(r.x + mx);
            expect(p.x).toBeLessThanOrEqual(r.x + r.w - mx);
            expect(p.y).toBeGreaterThanOrEqual(r.y + my);
            expect(p.y).toBeLessThanOrEqual(r.y + r.h - my);
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
          }
          // It also fills the limiting axis (no wasted letterbox) and is centred.
          const fillX = (maxX - minX) / (r.w * (1 - 2 * FIT_MARGIN));
          const fillY = (maxY - minY) / (r.h * (1 - 2 * FIT_MARGIN));
          expect(Math.max(fillX, fillY)).toBeCloseTo(1, 6);
          expect((minX + maxX) / 2).toBeCloseTo(r.x + r.w / 2, 6);
          expect((minY + maxY) / 2).toBeCloseTo(r.y + r.h / 2, 6);
        });
      }
    }
  }

  it('projected bounds are the trapezoid corners: wider at the bottom, taller fit at the top', () => {
    const b = projectedBounds(1800, 1100, makeCamera(22, 1100));
    expect(b.maxX).toBeGreaterThan(900);
    expect(b.maxY - b.minY).toBeLessThan(1100);
    expect(b.minX).toBeCloseTo(-b.maxX, 9);
  });
});
