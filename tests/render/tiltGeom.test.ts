import { describe, expect, it } from 'vitest';
import { makeCamera, project, type Projected } from '../../src/render/project';
import { obstaclePolys, outlinePoints, projectFlat } from '../../src/render/tiltGeom';
import { arena } from './lattice/fixtures';

describe('tilt wall geometry', () => {
  it('rect outline is the four corners; obstacles are four corner polygons', () => {
    const a = arena('rectObstacles', 1800, 1100, { obstacles: [{ cx: 100, cy: -50, w: 200, h: 80 }] });
    expect(outlinePoints(a)).toEqual([-900, -550, 900, -550, 900, 550, -900, 550]);
    expect(obstaclePolys(a)).toEqual([[0, -90, 200, -90, 200, -10, 0, -10]]);
  });

  it('round shapes are sampled on their outline', () => {
    const c = outlinePoints(arena('circle', 1000, 1000));
    for (let i = 0; i + 1 < c.length; i += 2) expect(Math.hypot(c[i] ?? 0, c[i + 1] ?? 0)).toBeCloseTo(500, 6);
    const r = outlinePoints(arena('roundRect', 1800, 1100));
    for (let i = 0; i + 1 < r.length; i += 2) {
      expect(Math.abs(r[i] ?? 0)).toBeLessThanOrEqual(900 + 1e-9);
      expect(Math.abs(r[i + 1] ?? 0)).toBeLessThanOrEqual(550 + 1e-9);
    }
    expect(outlinePoints(arena('hexagon', 1200, 1000)).length).toBe(12);
  });

  it('projectFlat projects every point on the floor and is the identity when off', () => {
    const pts = outlinePoints(arena('rect', 1600, 1000));
    expect(projectFlat(pts, makeCamera(0, 1000))).toEqual(pts);
    const cam = makeCamera(22, 1000);
    const out = projectFlat(pts, cam);
    const o: Projected = { x: 0, y: 0, s: 1 };
    for (let i = 0; i + 1 < pts.length; i += 2) {
      project(pts[i] ?? 0, pts[i + 1] ?? 0, 0, cam, o);
      expect(out[i]).toBe(o.x);
      expect(out[i + 1]).toBe(o.y);
    }
    // A trapezoid: the far (top) edge is narrower than the near edge.
    expect((out[2] ?? 0) - (out[0] ?? 0)).toBeLessThan((out[4] ?? 0) - (out[6] ?? 0));
  });
});
