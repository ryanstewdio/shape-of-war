import { Container, type Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { TROUGH_DEPTH_SHARE, troughHeight } from '../../src/core/trough';
import { drumProject, makeDrum, makeTroughDrum, projectPhi, troughProject, type DrumPoint } from '../../src/render/drum';
import { drawTroughGrid, drawTroughWalls, gridLineWidth } from '../../src/render/grid';
import { writeRimUv } from '../../src/render/latticeView';
import { FOCAL_MUL, TILT_DEG } from '../../src/render/project';
import { createTiltScene } from '../../src/render/tiltScene';
import {
  depthScaleAt,
  rimBucket,
  rimBucketT,
  rimLineAlpha,
  rimLineWidth,
  rimTexU,
  rimWallAlpha,
  rimWallWidth,
  troughDepthScale,
  troughHeightFrac,
  TROUGH_DEPTH_SCALE,
  TROUGH_FLOOR_LINE_ALPHA,
  TROUGH_RIM_BUCKETS,
} from '../../src/render/troughDepth';
import { polyEdges, rimBuckets, troughGridSegs, troughRimSegs } from '../../src/render/troughGeom';

const W = 1216;
const H = 860;
const D = FOCAL_MUL * H;
const P = (): DrumPoint => ({ x: 0, y: 0, s: 1, a: 1, m: 1 });
const RECT = [-W / 2, -H / 2, W / 2, -H / 2, W / 2, H / 2, -W / 2, H / 2];

/** The plain projection factor at (u, v) on a tilt 0 trough: D / (D - lift). */
function plainF(u: number): number {
  return D / (D - (troughHeight(u, W) - TROUGH_DEPTH_SHARE * W));
}

interface StrokeRec {
  width: number;
  alpha: number;
  pts: number;
}

/** Records strokes: the width, alpha and how many lineTo calls each one carried. */
class Rec {
  strokes: StrokeRec[] = [];
  private n = 0;
  clear(): this {
    this.strokes = [];
    this.n = 0;
    return this;
  }
  moveTo(): this {
    return this;
  }
  lineTo(): this {
    this.n++;
    return this;
  }
  stroke(s: { width: number; alpha: number }): this {
    this.strokes.push({ width: s.width, alpha: s.alpha, pts: this.n });
    this.n = 0;
    return this;
  }
}

describe('trough depth scale (render only)', () => {
  it('floor 1, mid slope between, rim TROUGH_DEPTH_SCALE (about 1.35)', () => {
    expect(TROUGH_DEPTH_SCALE).toBeGreaterThan(1.3);
    expect(TROUGH_DEPTH_SCALE).toBeLessThan(1.4);
    expect(troughDepthScale(0, W)).toBe(1);
    expect(troughDepthScale(W / 2, W)).toBeCloseTo(TROUGH_DEPTH_SCALE, 12);
    expect(troughDepthScale(-W / 2, W)).toBeCloseTo(TROUGH_DEPTH_SCALE, 12);
    const mid = troughDepthScale(W / 4, W);
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(TROUGH_DEPTH_SCALE);
    // In proportion to the ground height under it.
    const t = troughHeight(W / 4, W) / (TROUGH_DEPTH_SHARE * W);
    expect(troughHeightFrac(W / 4, W)).toBeCloseTo(t, 12);
    expect(mid).toBeCloseTo(1 + (TROUGH_DEPTH_SCALE - 1) * t, 12);
    // Clamped outside the arena and for a bad width.
    expect(depthScaleAt(2)).toBe(TROUGH_DEPTH_SCALE);
    expect(depthScaleAt(-1)).toBe(1);
    expect(troughHeightFrac(10, 0)).toBe(0);
  });

  it('troughProject s is the plain projection times the depth scale; positions are unchanged', () => {
    const d = makeTroughDrum(W, H, 0);
    for (const u of [0, W / 8, W / 4, -0.4 * W, W / 2]) {
      const p = troughProject(u, 100, 0, d, P());
      const f = plainF(u);
      expect(p.x).toBeCloseTo(u * f, 9);
      expect(p.y).toBeCloseTo(100 * f, 9);
      expect(p.s).toBeCloseTo(f * troughDepthScale(u, W), 9);
    }
    // Floor objects keep exactly the plain projection.
    expect(troughProject(0, 0, 0, d, P()).s).toBeCloseTo(D / (D + d.depth), 12);
  });

  it('every tilt: a drawn object grows as it climbs, the rim about 1.35 x the plain scale', () => {
    for (const deg of [TILT_DEG.off, TILT_DEG.low, TILT_DEG.high]) {
      const d = makeTroughDrum(W, H, deg);
      let prev = 0;
      for (let i = 0; i <= 10; i++) {
        const s = troughProject((i / 10) * (W / 2), 0, 0, d, P()).s;
        expect(s).toBeGreaterThan(prev);
        prev = s;
      }
      // At v = 0 the rim's plain projection is 1, so its s is the rim scale itself.
      expect(troughProject(W / 2, 0, 0, d, P()).s).toBeCloseTo(TROUGH_DEPTH_SCALE, 9);
    }
  });

  it('billboards on a trough take the depth scale through the drum scene pass; the sim value is restored', () => {
    const parent = new Container();
    const floor = new Container();
    floor.position.set(0, 0);
    const rim = new Container();
    rim.position.set(W / 2 - 1, 0);
    parent.addChild(floor, rim);
    const tilt = createTiltScene({ billboardParents: [parent], particles: [], freeform: [] });
    const d = makeTroughDrum(W, H, 0);
    tilt.projectDrum(d);
    const ratio = rim.scale.x / floor.scale.x;
    const plainRatio = plainF(W / 2 - 1) / plainF(0);
    expect(ratio).toBeCloseTo(plainRatio * troughDepthScale(W / 2 - 1, W), 6);
    tilt.restore();
    expect(floor.scale.x).toBe(1);
    expect(rim.scale.x).toBe(1);
    expect(rim.position.x).toBe(W / 2 - 1);
  });

  it('flat and drum levels are unchanged: the cylinder projection carries no depth cue', () => {
    const d = makeDrum(W, H, 0);
    const p = drumProject(W / 4, 50, 0, d, P());
    const q = projectPhi(Math.PI / 2, 50, 0, d, P());
    expect(p).toEqual(q);
    // Front centre of a cylinder at tilt 0 is exactly scale 1, as before.
    expect(drumProject(0, 0, 0, d, P()).s).toBeCloseTo(1, 12);
  });
});

describe('trough rim light', () => {
  it('rim brightness and width rise with height', () => {
    let pa = 0;
    let pw = 0;
    let pwa = 0;
    let pww = 0;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      expect(rimLineAlpha(t)).toBeGreaterThan(pa);
      expect(rimLineWidth(t)).toBeGreaterThan(pw);
      expect(rimWallWidth(t)).toBeGreaterThan(pww);
      expect(rimWallAlpha(0.16, t)).toBeGreaterThan(pwa);
      pa = rimLineAlpha(t);
      pw = rimLineWidth(t);
      pww = rimWallWidth(t);
      pwa = rimWallAlpha(0.16, t);
    }
    expect(rimLineAlpha(0)).toBe(TROUGH_FLOOR_LINE_ALPHA);
    expect(rimLineAlpha(1)).toBe(1);
    expect(rimLineWidth(0)).toBe(1);
    expect(rimWallAlpha(1, 1)).toBe(1);
    expect(rimWallAlpha(0.38, 0)).toBe(0.38);
  });

  it('buckets: every height share lands in one bucket, centres inside it', () => {
    expect(rimBucket(0)).toBe(0);
    expect(rimBucket(1)).toBe(TROUGH_RIM_BUCKETS - 1);
    expect(rimBucket(-3)).toBe(0);
    expect(rimBucket(4)).toBe(TROUGH_RIM_BUCKETS - 1);
    for (let b = 0; b < TROUGH_RIM_BUCKETS; b++) expect(rimBucket(rimBucketT(b))).toBe(b);
  });

  it('troughRimSegs holds the same pieces as troughGridSegs, sorted floor to rim', () => {
    const d = makeTroughDrum(W, H, 7);
    const segs = [-W / 2, 0, W / 2, 0, 100, -H / 2, 100, H / 2, W / 2 - 2, -H / 2, W / 2 - 2, H / 2];
    const flat: number[] = [];
    troughGridSegs(d, segs, flat);
    const b = rimBuckets();
    troughRimSegs(d, segs, b);
    expect(b.reduce((n, l) => n + l.length, 0)).toBe(flat.length);
    // The near rim line sits in the top bucket, the floor line in the bottom one.
    const top = b[TROUGH_RIM_BUCKETS - 1] ?? [];
    const bottom = b[0] ?? [];
    expect(top.length).toBeGreaterThan(0);
    expect(bottom.length).toBeGreaterThan(0);
    const rimX = troughProject(W / 2 - 2, -H / 2, 0, d, P()).x;
    expect(top.some((x, i) => i % 2 === 0 && Math.abs(x - rimX) < 1e-6)).toBe(true);
  });

  it('drawTroughGrid: rim strokes wider and brighter than floor strokes', () => {
    const d = makeTroughDrum(W, H, 0);
    const b = rimBuckets();
    troughRimSegs(d, [-W / 2, -100, W / 2, -100, -W / 2, 100, W / 2, 100], b);
    const g = new Rec();
    drawTroughGrid(g as unknown as Graphics, b, 0x00ffff, 2);
    expect(g.strokes.length).toBe(TROUGH_RIM_BUCKETS);
    const first = g.strokes[0];
    const last = g.strokes[g.strokes.length - 1];
    expect(first && last).toBeTruthy();
    if (!first || !last) return;
    expect(last.width).toBeGreaterThan(first.width);
    expect(last.alpha).toBeGreaterThan(first.alpha);
    expect(first.width).toBeGreaterThanOrEqual(gridLineWidth(2));
  });

  it('drawTroughWalls: the rim edges get the widest, brightest pass; each pass alpha stays <= 1', () => {
    const d = makeTroughDrum(W, H, 13);
    const b = rimBuckets();
    troughRimSegs(d, polyEdges(RECT), b);
    const g = new Rec();
    const passes = [
      { width: 10, alpha: 0.16 },
      { width: 3, alpha: 1 },
    ];
    drawTroughWalls(g as unknown as Graphics, b, 0xff00ff, passes);
    expect(g.strokes.length).toBe(2 * TROUGH_RIM_BUCKETS);
    for (const s of g.strokes) expect(s.alpha).toBeLessThanOrEqual(1);
    const glowFloor = g.strokes[0];
    const glowRim = g.strokes[TROUGH_RIM_BUCKETS - 1];
    if (!glowFloor || !glowRim) throw new Error('missing strokes');
    expect(glowRim.width).toBeGreaterThan(glowFloor.width);
    expect(glowRim.alpha).toBeGreaterThan(glowFloor.alpha);
    // Contiguous pieces chain: a bucket is a few polylines, not one stroke per piece.
    expect(g.strokes.length).toBeLessThan(20);
  });

  it('lattice rim uv: floor nodes sample the dim texel, rim nodes the full one, rising with height', () => {
    const restX = [0, W / 8, W / 4, (3 * W) / 8, W / 2, -W / 2];
    const uv = new Float32Array(restX.length * 2).fill(9);
    writeRimUv(uv, restX, restX.length, W);
    expect(uv[0]).toBeCloseTo(rimTexU(0), 6);
    expect(uv[8]).toBeCloseTo(0.75, 6);
    expect(uv[10]).toBeCloseTo(0.75, 6);
    for (let i = 1; i < 5; i++) expect(uv[2 * i] ?? 0).toBeGreaterThan(uv[2 * (i - 1)] ?? 0);
    for (let i = 0; i < restX.length; i++) expect(uv[2 * i + 1]).toBe(0);
  });
});
