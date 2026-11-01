import { describe, expect, it } from 'vitest';
import { wrapCoord } from '../../src/core/surface';
import {
  BACK_ALPHA,
  BACK_TEX_U,
  DRUM_TAU,
  drumAffineAt,
  drumBounds,
  drumCamera,
  drumPhi,
  drumProject,
  drumProjectNodes,
  drumRectSegs,
  drumULines,
  fitDrum,
  FRONT_TEX_U,
  followCamU,
  interpWrap,
  makeDrum,
  ringArcs,
  unwrapNear,
  type DrumPoint,
} from '../../src/render/drum';
import { interp } from '../../src/render/layout';
import type { Affine } from '../../src/render/project';

// Seed 42 level 16 is a cylinder: rect 1216 x 860.
const W = 1216;
const H = 860;
const P = (): DrumPoint => ({ x: 0, y: 0, s: 1, a: 1, m: 1 });

describe('drum phi and screen x', () => {
  it('phi is 2 pi (u - camU) / W, the short way, in [-pi, pi)', () => {
    expect(drumPhi(100, 100, W)).toBe(0);
    expect(drumPhi(100 + W / 4, 100, W)).toBeCloseTo(Math.PI / 2, 12);
    expect(drumPhi(100 - W / 4, 100, W)).toBeCloseTo(-Math.PI / 2, 12);
    expect(drumPhi(100 + W / 2, 100, W)).toBeCloseTo(-Math.PI, 12);
    // Across the seam: camU near +W/2, u near -W/2 is a small positive angle.
    expect(drumPhi(-W / 2 + 10, W / 2 - 10, W)).toBeCloseTo((20 * 2 * Math.PI) / W, 12);
  });

  it('front centre maps to x 0 at full size and alpha', () => {
    const d = makeDrum(W, H, 0);
    d.camU = 250;
    const p = drumProject(250, 0, 0, d, P());
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(0, 9);
    expect(p.s).toBeCloseTo(1, 12);
    expect(p.a).toBe(1);
    expect(p.m).toBe(1);
    // v keeps its arena axis at the front centre (screen axes are the arena axes).
    expect(drumProject(250, -200, 0, d, P()).y).toBeCloseTo(-200, 9);
  });

  it('screen x is rs sin phi scaled by the depth: plus u is screen right at the front', () => {
    const d = makeDrum(W, H, 0);
    const D = d.cam.focal;
    for (const phi of [0.2, 0.7, 1.2]) {
      const u = (phi * W) / (2 * Math.PI);
      const p = drumProject(u, 0, 0, d, P());
      const depth = d.rs * (1 - Math.cos(phi));
      const f = D / (D + depth);
      expect(p.x).toBeCloseTo(d.rs * Math.sin(phi) * f, 9);
      expect(p.s).toBeCloseTo(f, 12);
      expect(p.x).toBeGreaterThan(0);
      expect(drumProject(-u, 0, 0, d, P()).x).toBeCloseTo(-p.x, 9);
    }
  });

  it('the edges sit at plus and minus rs times their depth scale', () => {
    const d = makeDrum(W, H, 0);
    const right = drumProject(W / 4, 0, 0, d, P());
    const left = drumProject(-W / 4, 0, 0, d, P());
    const f = d.cam.focal / (d.cam.focal + d.rs);
    expect(right.x).toBeCloseTo(d.rs * f, 9);
    expect(left.x).toBeCloseTo(-d.rs * f, 9);
    expect(right.a).toBe(1);
  });

  it('the back half is smaller, mirrored and at BACK_ALPHA', () => {
    const d = makeDrum(W, H, 0);
    const back = drumProject(W / 2, 0, 0, d, P());
    expect(back.x).toBeCloseTo(0, 9);
    expect(back.a).toBe(BACK_ALPHA);
    expect(back.m).toBe(-1);
    expect(back.s).toBeLessThan(drumProject(W / 4, 0, 0, d, P()).s);
    // Mirrored: past the edge, more u moves the point back toward the centre (screen left).
    const a = drumProject((3 * W) / 8, 0, 0, d, P());
    const b = drumProject((7 * W) / 16, 0, 0, d, P());
    expect(a.x).toBeGreaterThan(b.x);
    expect(b.x).toBeGreaterThan(0);
    // Rims at the back sit closer to the middle (a rim is an ellipse).
    expect(Math.abs(drumProject(W / 2, -H / 2, 0, d, P()).y)).toBeLessThan(H / 2);
  });

  it('is continuous all the way round, seam included', () => {
    const d = makeDrum(W, H, 22);
    d.camU = 300;
    const p = P();
    const q = P();
    // About rs k = pi screen units per arena unit at most (the front centre), seam or not.
    for (let u = -W; u < W; u += 1) {
      drumProject(u, 100, 0, d, p);
      drumProject(u + 1, 100, 0, d, q);
      expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeLessThan(Math.PI * 1.05);
    }
  });

  it('a radial lift pushes a front point toward the viewer (bigger)', () => {
    const d = makeDrum(W, H, 0);
    expect(drumProject(0, 0, 20, d, P()).s).toBeGreaterThan(1);
  });

  it('the camera is always on, tilt only leans it', () => {
    expect(drumCamera(0, H).on).toBe(true);
    expect(drumCamera(0, H).sin).toBe(0);
    expect(drumCamera(22, H).sin).toBeCloseTo(Math.sin((22 * Math.PI) / 180), 12);
  });
});

describe('drum camera follow', () => {
  it('follows with time constant DRUM_TAU', () => {
    const c = followCamU(0, 100, DRUM_TAU, W);
    expect(100 - c).toBeCloseTo(100 * Math.exp(-1), 9);
  });

  it('takes the short way across the seam, smoothed', () => {
    let c = W / 2 - 10;
    const target = -W / 2 + 10;
    const dt = 1 / 60;
    const first = followCamU(c, target, dt, W);
    // Moved forward across the seam, not back through the middle.
    expect(first).toBeGreaterThan(c);
    expect(first).toBeLessThan(W / 2);
    for (let i = 0; i < 120; i++) {
      c = followCamU(c, target, dt, W);
      expect(Math.abs(c)).toBeGreaterThan(W / 2 - 25);
      expect(c).toBeGreaterThanOrEqual(-W / 2);
      expect(c).toBeLessThan(W / 2);
    }
    expect(c).toBeCloseTo(target, 3);
  });

  it('no time, no move; infinite time snaps to the target', () => {
    expect(followCamU(40, 300, 0, W)).toBe(40);
    expect(followCamU(40, 300, Number.NaN, W)).toBe(40);
    expect(followCamU(40, W / 2 + 10, Number.POSITIVE_INFINITY, W)).toBeCloseTo(wrapCoord(W / 2 + 10, W), 9);
  });
});

describe('trails across the seam', () => {
  it('interpolation goes the short way across the seam', () => {
    const v = interpWrap(W / 2 - 2, -W / 2 + 4, 0.5, W);
    expect(v).toBeCloseTo(W / 2 + 1, 9);
  });

  it('a ship trail crossing the seam has no long segment', () => {
    const d = makeDrum(W, H, 0);
    d.camU = W / 2 - 1;
    // Canonical sim positions: the ship flies right through the seam at 6 u per sample.
    const raw: number[] = [];
    for (let k = 0; k < 20; k++) raw.push(wrapCoord(W / 2 - 60 + 6 * k, W));
    expect(raw.some((x) => x < 0)).toBe(true);
    // The renderer keeps each point at its image nearest the last (cometX, the snake body).
    let u = raw[0] ?? 0;
    const p = P();
    const q = P();
    let longest = 0;
    let longestU = 0;
    for (let k = 1; k < raw.length; k++) {
      const next = unwrapNear(u, raw[k] ?? 0, W);
      drumProject(u, 0, 0, d, p);
      drumProject(next, 0, 0, d, q);
      longest = Math.max(longest, Math.hypot(q.x - p.x, q.y - p.y));
      longestU = Math.max(longestU, Math.abs(next - u));
      u = next;
    }
    expect(longestU).toBeLessThan(6 + 1e-6);
    // 6 u at no more than pi screen units per u.
    expect(longest).toBeLessThan(6 * Math.PI + 0.01);
    // Without unwrapping the raw polyline jumps by a whole drum width at the seam.
    let rawLongest = 0;
    for (let k = 1; k < raw.length; k++) rawLongest = Math.max(rawLongest, Math.abs((raw[k] ?? 0) - (raw[k - 1] ?? 0)));
    expect(rawLongest).toBeGreaterThan(W / 2);
  });
});

describe('flat path unchanged', () => {
  it('period 0 interpolation is bit identical to interp for a recorded frame', () => {
    const prev = [12.5, -433.25, 607.75, 0.1, -0.3];
    const cur = [14.75, -431.5, -607.5, 0.2, 0.7];
    for (const a of [0, 0.25, 0.6180339887, 1]) {
      for (let i = 0; i < prev.length; i++) {
        expect(Object.is(interpWrap(prev[i] ?? 0, cur[i] ?? 0, a, 0), interp(prev[i] ?? 0, cur[i] ?? 0, a))).toBe(true);
      }
    }
    expect(unwrapNear(10, 600, 0)).toBe(600);
  });
});

describe('drum geometry', () => {
  it('nodes project in place and pick the front or back texel', () => {
    const d = makeDrum(W, H, 0);
    const pos = new Float32Array([0, 0, W / 2, 10, W / 8, -100]);
    const uv = new Float32Array(6);
    drumProjectNodes(pos, null, 3, d, uv);
    expect(pos[0]).toBeCloseTo(0, 5);
    expect(uv[0]).toBe(FRONT_TEX_U);
    expect(uv[2]).toBe(BACK_TEX_U);
    expect(uv[4]).toBe(FRONT_TEX_U);
  });

  it('rims split into a front arc and a back arc; the front is the wider', () => {
    // Same ends (the edges at plus and minus 90 degrees); the front bulges wider by perspective.
    const d = makeDrum(W, H, 0);
    const r = ringArcs(d, -H / 2, 32);
    expect(r.front.length).toBe(34);
    expect(r.back.length).toBe(34);
    const span = (pts: number[]): number => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        lo = Math.min(lo, pts[i] ?? 0);
        hi = Math.max(hi, pts[i] ?? 0);
      }
      return hi - lo;
    };
    expect(span(r.front)).toBeGreaterThan(span(r.back));
    expect(r.front[0]).toBeCloseTo(r.back[r.back.length - 2] ?? 0, 6);
    // The front arc bulges up (toward the top rim's near side), the back arc sits lower.
    expect(r.front[r.front.length / 2] ?? 0).toBeLessThan(r.back[r.back.length / 2] ?? 0);
  });

  it('the fit holds the whole drum inside the safe rect', () => {
    const d = makeDrum(W, H, 12);
    const rect = { x: 0, y: 0, w: 2176, h: 1812 };
    const fit = fitDrum(d, rect, 0.02);
    const b = drumBounds(d);
    expect(fit.x + b.minX * fit.scale).toBeGreaterThanOrEqual(-1e-6);
    expect(fit.x + b.maxX * fit.scale).toBeLessThanOrEqual(rect.w + 1e-6);
    expect(fit.y + b.minY * fit.scale).toBeGreaterThanOrEqual(-1e-6);
    expect(fit.y + b.maxY * fit.scale).toBeLessThanOrEqual(rect.h + 1e-6);
  });

  it('low tier u lines: one per spacing round the drum, straight segments', () => {
    const d = makeDrum(W, H, 0);
    const front: number[] = [];
    const back: number[] = [];
    drumULines(d, 64, front, back);
    expect((front.length + back.length) / 4).toBe(W / 64);
    // Spacing compresses toward the edges of the front face.
    const xs: number[] = [];
    for (let i = 0; i < front.length; i += 4) xs.push(front[i] ?? 0);
    xs.sort((a, b) => a - b);
    const mid = Math.floor(xs.length / 2);
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBeLessThan((xs[mid + 1] ?? 0) - (xs[mid] ?? 0));
  });

  it('the linearisation is exact at its point and returns its alpha', () => {
    const d = makeDrum(W, H, 22);
    d.camU = -100;
    const m: Affine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    const u = 120;
    const v = 40;
    expect(drumAffineAt(u, v, d, m)).toBe(1);
    const p = drumProject(u, v, 0, d, P());
    expect(m.a * u + m.c * v + m.tx).toBeCloseTo(p.x, 6);
    expect(m.b * u + m.d * v + m.ty).toBeCloseTo(p.y, 6);
    // Back half: alpha through the glass, x runs the other way (mirrored).
    expect(drumAffineAt(-100 + W / 2 - 50, v, d, m)).toBe(BACK_ALPHA);
    expect(m.a).toBeLessThan(0);
  });
});

describe('drum obstacles', () => {
  it('a wide obstacle bends round the drum in short segments, back half split off', () => {
    const d = makeDrum(W, H, 0);
    const front: number[] = [];
    const back: number[] = [];
    // 600 u wide, centred on the camera: its ends reach past the edges into the back half.
    drumRectSegs(d, -400, -50, 800, 100, front, back);
    expect(front.length).toBeGreaterThan(0);
    expect(back.length).toBeGreaterThan(0);
    expect(front.length % 4).toBe(0);
    for (const list of [front, back]) {
      for (let i = 0; i + 3 < list.length; i += 4) {
        const len = Math.hypot((list[i + 2] ?? 0) - (list[i] ?? 0), (list[i + 3] ?? 0) - (list[i + 1] ?? 0));
        // Edges along u: at most W / RING_STEPS u each (pi screen units per u); edges along v: 100 u.
        expect(len).toBeLessThan(Math.max(110, (Math.PI * W) / 96 + 1));
      }
    }
    // Reused lists: a second call clears first.
    drumRectSegs(d, -20, -20, 40, 40, front, back);
    expect(back.length).toBe(0);
  });
});
