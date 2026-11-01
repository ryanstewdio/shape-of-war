// Surface core (V3-H C0, docs/09 sections 2.1 to 2.3): the wrap rule at the seam, cylinder delta,
// wrap and toXYZ, makeSurface, and flat staying plain b minus a.
import { describe, expect, it } from 'vitest';
import { cylinderSurface, flatSurface, makeSurface, wrapCoord, wrapDelta, type Vec3 } from '../../src/core/surface';

const W = 1408;
const H = 896;

describe('wrapDelta', () => {
  it('leaves offsets inside the half period alone', () => {
    expect(wrapDelta(0, W)).toBe(0);
    expect(wrapDelta(100, W)).toBe(100);
    expect(wrapDelta(-100, W)).toBe(-100);
    expect(wrapDelta(W / 2 - 1, W)).toBe(W / 2 - 1);
    expect(wrapDelta(-W / 2 + 1, W)).toBe(-W / 2 + 1);
  });

  it('takes the short way across the seam in both directions', () => {
    expect(wrapDelta(W / 2 + 10, W)).toBe(-W / 2 + 10);
    expect(wrapDelta(-W / 2 - 10, W)).toBe(W / 2 - 10);
    expect(wrapDelta(W - 4, W)).toBe(-4);
    expect(wrapDelta(-(W - 4), W)).toBe(4);
    expect(wrapDelta(3 * W + 5, W)).toBe(5);
  });

  it('maps exactly plus and minus L/2 to minus L/2 (half open range)', () => {
    expect(wrapDelta(W / 2, W)).toBe(-W / 2);
    expect(wrapDelta(-W / 2, W)).toBe(-W / 2);
  });

  it('wrapCoord keeps in range values bit identical and folds the rest into [-L/2, L/2)', () => {
    expect(wrapCoord(123.456, W)).toBe(123.456);
    expect(wrapCoord(-W / 2, W)).toBe(-W / 2);
    expect(wrapCoord(W / 2, W)).toBe(-W / 2);
    expect(wrapCoord(W / 2 + 3, W)).toBe(-W / 2 + 3);
    expect(wrapCoord(-W / 2 - 3, W)).toBe(W / 2 - 3);
  });
});

describe('cylinderSurface', () => {
  const s = cylinderSurface(W, H);
  const out = { x: 0, y: 0 };

  it('wraps u only', () => {
    expect(s.kind).toBe('cylinder');
    expect(s.topology).toEqual({ wrapU: true, wrapV: false, flipVOnWrapU: false });
    expect(s.width).toBe(W);
    expect(s.height).toBe(H);
  });

  it('delta crosses the seam both ways and leaves v unwrapped', () => {
    s.delta(W / 2 - 10, 0, -W / 2 + 10, 0, out);
    expect(out.x).toBe(20);
    s.delta(-W / 2 + 10, 0, W / 2 - 10, 0, out);
    expect(out.x).toBe(-20);
    s.delta(0, -H / 2 + 5, 0, H / 2 - 5, out);
    expect(out.y).toBe(H - 10); // v is bounded: no short way round
  });

  it('delta at exactly half a turn returns minus W/2', () => {
    s.delta(0, 0, W / 2, 0, out);
    expect(out.x).toBe(-W / 2);
    s.delta(W / 2, 0, 0, 0, out);
    expect(out.x).toBe(-W / 2);
  });

  it('delta returns out and is antisymmetric away from the half turn', () => {
    const r = s.delta(600, 3, -650, -7, out);
    expect(r).toBe(out);
    const ax = out.x;
    const ay = out.y;
    s.delta(-650, -7, 600, 3, out);
    expect(out.x).toBe(-ax);
    expect(out.y).toBe(-ay);
  });

  it('wrap canonicalises u, never flips, never touches v', () => {
    const p = { x: W / 2 + 7, y: 1234 };
    expect(s.wrap(p)).toBe(false);
    expect(p.x).toBe(-W / 2 + 7);
    expect(p.y).toBe(1234);
    const q = { x: -W / 2 - 7, y: 0 };
    s.wrap(q);
    expect(q.x).toBe(W / 2 - 7);
  });

  it('toXYZ maps onto a cylinder of radius W / 2 pi round the y axis', () => {
    const R = W / (2 * Math.PI);
    const v: Vec3 = { x: 0, y: 0, z: 0 };
    s.toXYZ(0, 50, v);
    expect(v.x).toBeCloseTo(R, 9);
    expect(v.y).toBe(50);
    expect(v.z).toBeCloseTo(0, 9);
    s.toXYZ(W / 4, -20, v);
    expect(v.x).toBeCloseTo(0, 9);
    expect(v.y).toBe(-20);
    expect(v.z).toBeCloseTo(R, 9);
    s.toXYZ(-W / 2, 0, v);
    expect(v.x).toBeCloseTo(-R, 9);
    for (const u of [-700, -123, 0, 345, 703]) {
      s.toXYZ(u, 9, v);
      expect(Math.hypot(v.x, v.z)).toBeCloseTo(R, 9);
    }
  });

  it('toXYZ is continuous across the seam', () => {
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const b: Vec3 = { x: 0, y: 0, z: 0 };
    s.toXYZ(W / 2 - 0.001, 0, a);
    s.toXYZ(-W / 2 + 0.001, 0, b);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.01);
  });
});

describe('makeSurface and flat', () => {
  it('builds the kind it is asked for', () => {
    expect(makeSurface('flat', W, H).kind).toBe('flat');
    expect(makeSurface('cylinder', W, H).kind).toBe('cylinder');
  });

  it('flat delta is the raw subtraction and wrap never moves anything', () => {
    const f = flatSurface(W, H);
    const out = { x: 0, y: 0 };
    f.delta(W / 2 - 10, 1.5, -W / 2 + 10, -2.25, out);
    expect(out.x).toBe(-W / 2 + 10 - (W / 2 - 10));
    expect(out.y).toBe(-2.25 - 1.5);
    const p = { x: W, y: H };
    expect(f.wrap(p)).toBe(false);
    expect(p).toEqual({ x: W, y: H });
  });
});
