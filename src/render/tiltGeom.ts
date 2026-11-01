// Pure tilt geometry for the arena walls, obstacles and the v1 grid (docs/12 Wave V3-G). No
// pixi.js import. The projection maps the floor by a homography, so straight edges stay straight:
// rect, obstacle and hexagon outlines project exactly from their corners. Round corners and the
// circle are sampled. Built on tilt, arena, resize or neon change only, never per frame.
import type { ArenaDef } from '../levelgen/leveldef';
import { hexagonPoints } from './gridGeom';
import { project, type Camera, type Projected } from './project';

/** Samples per quarter turn for round corners, and per full turn for the circle arena. */
export const ARC_STEPS = 12;
export const CIRCLE_STEPS = 96;

function arc(out: number[], cx: number, cy: number, r: number, a0: number, steps: number): void {
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (i / steps) * (Math.PI / 2);
    out.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
}

/** Pure: the arena outline as a closed polygon, flat [x, y, ...] in arena units (unprojected). */
export function outlinePoints(a: ArenaDef): number[] {
  const hw = a.width / 2;
  const hh = a.height / 2;
  switch (a.shape) {
    case 'rect':
    case 'rectObstacles':
      return [-hw, -hh, hw, -hh, hw, hh, -hw, hh];
    case 'roundRect': {
      const r = Math.max(0, Math.min(a.cornerRadius, hw, hh));
      if (r === 0) return [-hw, -hh, hw, -hh, hw, hh, -hw, hh];
      const out: number[] = [];
      arc(out, hw - r, -hh + r, r, -Math.PI / 2, ARC_STEPS);
      arc(out, hw - r, hh - r, r, 0, ARC_STEPS);
      arc(out, -hw + r, hh - r, r, Math.PI / 2, ARC_STEPS);
      arc(out, -hw + r, -hh + r, r, Math.PI, ARC_STEPS);
      return out;
    }
    case 'circle': {
      const out: number[] = [];
      for (let i = 0; i < CIRCLE_STEPS; i++) {
        const t = (i / CIRCLE_STEPS) * Math.PI * 2;
        out.push(hw * Math.cos(t), hw * Math.sin(t));
      }
      return out;
    }
    case 'hexagon':
      return hexagonPoints(a.width, a.height);
  }
}

/** Pure: each obstacle as a closed four corner polygon (unprojected). */
export function obstaclePolys(a: ArenaDef): number[][] {
  return a.obstacles.map((o) => {
    const x0 = o.cx - o.w / 2;
    const y0 = o.cy - o.h / 2;
    return [x0, y0, x0 + o.w, y0, x0 + o.w, y0 + o.h, x0, y0 + o.h];
  });
}

/** Pure: project a flat [x, y, ...] list on the floor (z = 0). Returns a new list. */
export function projectFlat(pts: readonly number[], cam: Camera): number[] {
  const out = new Array<number>(pts.length);
  const p: Projected = { x: 0, y: 0, s: 1 };
  for (let i = 0; i + 1 < pts.length; i += 2) {
    project(pts[i] ?? 0, pts[i + 1] ?? 0, 0, cam, p);
    out[i] = p.x;
    out[i + 1] = p.y;
  }
  return out;
}
