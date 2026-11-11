import { describe, expect, it } from 'vitest';
import { TROUGH_DEPTH_SHARE, troughHeight } from '../../src/core/trough';
import {
  drumBounds,
  drumDu,
  drumProject,
  fitDrum,
  makeDrum,
  makeTroughDrum,
  projectPhi,
  troughLift,
  troughProject,
  type DrumPoint,
} from '../../src/render/drum';
import { createDrumPen, penBegin, penOwner, penX, traceLine, createPenTrace, type PathSink } from '../../src/render/drumPen';
import { FOCAL_MUL } from '../../src/render/project';
import {
  polySpanAt,
  troughGridSegs,
  troughOutline,
  troughShadeAlpha,
  troughShadeBands,
  troughSteep,
  TROUGH_SHADE_MAX,
} from '../../src/render/troughGeom';
import { TROUGH_DEPTH_SCALE } from '../../src/render/troughDepth';

const W = 1216;
const H = 860;
const D = FOCAL_MUL * H;
const P = (): DrumPoint => ({ x: 0, y: 0, s: 1, a: 1, m: 1 });
const RECT = [-W / 2, -H / 2, W / 2, -H / 2, W / 2, H / 2, -W / 2, H / 2];

/**
 * At tilt 0 the projection factor is D / (D - lift) (y / v), so the ground height is recoverable
 * from the screen. The depth scale s also carries the trough-depth slope cue, so it is not used.
 */
function heightFromScreen(u: number, d = makeTroughDrum(W, H, 0)): number {
  const p = troughProject(u, 100, 0, d, P());
  const f = p.y / 100;
  const lift = D * (1 - 1 / f);
  return lift + d.depth;
}

describe('trough projection follows the shared profile', () => {
  it('bottom: the floor sits depth behind the arena plane', () => {
    const d = makeTroughDrum(W, H, 0);
    expect(d.trough).toBe(true);
    expect(d.period).toBe(0);
    expect(d.depth).toBeCloseTo(TROUGH_DEPTH_SHARE * W, 9);
    const p = troughProject(0, 100, 0, d, P());
    expect(p.s).toBeCloseTo(D / (D + d.depth), 12);
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(100 * p.s, 9);
    expect(heightFromScreen(0)).toBeCloseTo(0, 6);
  });

  it('slope: the projected height equals troughHeight at points between floor and rim', () => {
    for (const u of [W / 8, W / 4, (3 * W) / 8, -W / 5, -0.41 * W]) {
      expect(heightFromScreen(u)).toBeCloseTo(troughHeight(u, W), 6);
      const d = makeTroughDrum(W, H, 0);
      expect(troughLift(u, 0, d)).toBeCloseTo(troughHeight(u, W) - d.depth, 9);
    }
  });

  it('rim: the left and right edges sit in the arena plane, exactly where a flat level draws them', () => {
    const d = makeTroughDrum(W, H, 0);
    for (const u of [-W / 2, W / 2]) {
      expect(heightFromScreen(u)).toBeCloseTo(TROUGH_DEPTH_SHARE * W, 6);
      const p = troughProject(u, 0, 0, d, P());
      // Plain projection 1 at the rim; s carries the trough-depth rim scale on top.
      expect(p.s).toBeCloseTo(TROUGH_DEPTH_SCALE, 12);
      expect(p.x).toBeCloseTo(u, 9);
    }
  });

  it('no seam: the two rims are mirror images, never the same point', () => {
    const d = makeTroughDrum(W, H, 13);
    const l = troughProject(-W / 2 + 5, -200, 0, d, P());
    const r = troughProject(W / 2 - 5, -200, 0, d, P());
    expect(l.x).toBeCloseTo(-r.x, 9);
    expect(l.y).toBeCloseTo(r.y, 9);
    expect(r.x - l.x).toBeGreaterThan(W * 0.9);
  });

  it('steeper ground is closer: the depth scale grows monotonically from floor to rim', () => {
    const d = makeTroughDrum(W, H, 0);
    let prev = 0;
    for (let i = 0; i <= 20; i++) {
      const s = troughProject((i / 20) * (W / 2), 0, 0, d, P()).s;
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });

  it('tilt leans the valley: the floor drops down the screen, the rims stay higher', () => {
    for (const deg of [7, 13]) {
      const d = makeTroughDrum(W, H, deg);
      const floor = troughProject(0, 0, 0, d, P());
      const rim = troughProject(W / 2, 0, 0, d, P());
      expect(floor.y).toBeGreaterThan(0);
      expect(rim.y).toBeCloseTo(0, 9);
    }
  });

  it('drumProject on a trough is the trough projection, front only, and a lift adds toward the viewer', () => {
    const d = makeTroughDrum(W, H, 7);
    d.camU = 300; // ignored: a trough never turns
    for (const u of [-W / 2, -100, 0, 250, W / 2]) {
      const a = drumProject(u, 120, 0, d, P());
      const b = troughProject(u, 120, 0, d, P());
      expect(a).toEqual(b);
      expect(a.a).toBe(1);
      expect(a.m).toBe(1);
    }
    expect(drumProject(0, 0, 40, d, P()).s).toBeGreaterThan(drumProject(0, 0, 0, d, P()).s);
  });

  it('fit: the bounds hold the whole arena and the fit stays inside the play rect', () => {
    const d = makeTroughDrum(W, H, 13);
    const b = drumBounds(d);
    // The near rim corners are the widest points under tilt.
    const near = troughProject(W / 2, H / 2, 0, d, P());
    expect(b.maxX).toBeCloseTo(near.x, 6);
    expect(b.minX).toBeCloseTo(-near.x, 6);
    expect(drumBounds(makeTroughDrum(W, H, 0)).maxX).toBeCloseTo(W / 2, 6);
    const rect = { x: 0, y: 0, w: 900, h: 2000 };
    const f = fitDrum(d, rect);
    expect(b.minX * f.scale + f.x).toBeGreaterThanOrEqual(-1e-6);
    expect(b.maxX * f.scale + f.x).toBeLessThanOrEqual(900 + 1e-6);
  });
});

describe('cylinder unchanged', () => {
  it('makeDrum keeps its period and projection', () => {
    const d = makeDrum(W, H, 7);
    expect(d.trough).toBe(false);
    expect(d.period).toBe(W);
    expect(d.depth).toBe(0);
    d.camU = 40;
    const a = drumProject(40 + W / 8, 50, 0, d, P());
    const b = projectPhi(Math.PI / 4, 50, 0, d, P());
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.y).toBeCloseTo(b.y, 9);
    expect(drumDu(d, W - 20)).toBeCloseTo(-20, 9);
  });
});

describe('pen on a trough never wraps', () => {
  it('drumDu and penX keep the long offset across the arena', () => {
    const d = makeTroughDrum(W, H, 0);
    expect(drumDu(d, W - 20)).toBe(W - 20);
    const sink: PathSink = { moveTo: () => 0, lineTo: () => 0, circle: () => 0, closePath: () => 0, fill: () => 0, stroke: () => 0 };
    const p = penBegin(createDrumPen(), sink, d);
    penOwner(p, -W / 2 + 10, 0);
    expect(penX(p, W / 2 - 10)).toBeGreaterThan(p.own.x + W * 0.5);
    const t = createPenTrace();
    traceLine(p, t, -W / 2 + 10, 0, W / 2 - 10, 0);
    // Sampled along the full width, left to right.
    expect(t.n).toBeGreaterThan(40);
    expect(t.pts[0]).toBeLessThan(0);
    expect(t.pts[2 * (t.n - 1)]).toBeGreaterThan(0);
  });
});

describe('trough view geometry', () => {
  it('steepness is 0 on the floor, 1 at the rims and grows outward', () => {
    expect(troughSteep(0, W)).toBe(0);
    expect(troughSteep(W / 2, W)).toBeCloseTo(1, 12);
    expect(troughSteep(-W / 2, W)).toBeCloseTo(1, 12);
    expect(troughSteep(W / 4, W)).toBeGreaterThan(troughSteep(W / 8, W));
    expect(troughShadeAlpha(W / 2, W)).toBeCloseTo(TROUGH_SHADE_MAX, 12);
  });

  it('shade bands brighten toward both rims and leave the floor clear', () => {
    const d = makeTroughDrum(W, H, 0);
    const bands = troughShadeBands(d, RECT, 64);
    expect(bands.length).toBeGreaterThan(40);
    const first = bands[0];
    const mid = bands.reduce((m, b) => (b.alpha < m.alpha ? b : m));
    expect(first?.alpha ?? 0).toBeGreaterThan(mid.alpha * 10);
    for (const b of bands) expect(b.pts.length).toBe(8);
  });

  it('polySpanAt: rect and circle spans', () => {
    expect(polySpanAt(RECT, 0)).toEqual([-H / 2, H / 2]);
    expect(polySpanAt(RECT, W)).toBeNull();
    const circle: number[] = [];
    for (let i = 0; i < 64; i++) circle.push(300 * Math.cos((i / 64) * 2 * Math.PI), 300 * Math.sin((i / 64) * 2 * Math.PI));
    const s = polySpanAt(circle, 0);
    expect(s?.[0] ?? 0).toBeCloseTo(-300, 0);
    expect(s?.[1] ?? 0).toBeCloseTo(300, 0);
  });

  it('outline is closed and bends: the far edge sags toward the middle', () => {
    const d = makeTroughDrum(W, H, 0);
    const o = troughOutline(d, RECT);
    expect(o[0]).toBeCloseTo(o[o.length - 2] ?? NaN, 9);
    expect(o[1]).toBeCloseTo(o[o.length - 1] ?? NaN, 9);
    // The top edge's middle sample (u = 0) is pulled toward the centre by the recessed floor.
    let topMidY = 0;
    for (let i = 0; i + 1 < o.length; i += 2) if (Math.abs(o[i] ?? 1) < 1e-6 && (o[i + 1] ?? 0) < 0) topMidY = o[i + 1] ?? 0;
    expect(topMidY).toBeGreaterThan(-H / 2 + 10);
  });

  it('grid segments: lines along v stay one piece, lines along u are cut', () => {
    const d = makeTroughDrum(W, H, 7);
    const out: number[] = [];
    troughGridSegs(d, [100, -H / 2, 100, H / 2], out);
    expect(out.length).toBe(4);
    troughGridSegs(d, [-W / 2, 0, W / 2, 0], out);
    expect(out.length / 4).toBeGreaterThan(50);
  });
});
