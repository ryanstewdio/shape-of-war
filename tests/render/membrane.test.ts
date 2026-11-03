import type { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { drawWalls, wallPasses } from '../../src/render/grid';
import type { ArenaDef, Obstacle } from '../../src/levelgen/leveldef';
import {
  MEMBRANE_GLOW_IN,
  MEMBRANE_GLOW_OUT,
  MEMBRANE_GLOW_RADIUS,
  MEMBRANE_OPEN_SHARE,
  barrierRects,
  circleOverlapsObstacle,
  glowStep,
  markGlowCells,
  membraneCellCount,
  membraneObstacles,
  membraneSegmentCount,
  membraneSegmentRects,
  membraneSegments,
  obstacleStyle,
  solidObstacles,
  stepGlow,
} from '../../src/render/membrane';

const solid: Obstacle = { cx: 0, cy: 0, w: 100, h: 20 };
const bar: Obstacle = { cx: 200, cy: 0, w: 20, h: 300, membrane: true };
const flatBar: Obstacle = { cx: 0, cy: 300, w: 450, h: 16, membrane: true };
const arena = { shape: 'rect', width: 1000, height: 800, cornerRadius: 0, obstacles: [solid, bar] } as unknown as ArenaDef;

interface Call {
  op: string;
  args: unknown[];
}

/** A recording stand in for a pixi Graphics: every chained call is logged. */
function recorder(): { g: Graphics; calls: Call[] } {
  const calls: Call[] = [];
  const target: Record<string, unknown> = {};
  const g = new Proxy(target, {
    get(_t, op: string) {
      return (...args: unknown[]) => {
        calls.push({ op, args });
        return g;
      };
    },
  });
  return { g: g as unknown as Graphics, calls };
}

describe('membrane style: the ring bar with openings', () => {
  it('a membrane obstacle takes the membrane style and a solid one does not', () => {
    expect(obstacleStyle(bar)).toBe('membrane');
    expect(obstacleStyle(solid)).toBe('solid');
    expect(solidObstacles(arena)).toEqual([solid]);
    expect(membraneObstacles(arena)).toEqual([bar]);
  });

  it('segments cover 90 percent of the bar with equal openings and closed ends', () => {
    for (const len of [60, 180, 300, 451, 1200]) {
      const iv: number[] = [];
      const n = membraneSegments(-len / 2, len, iv);
      expect(n).toBe(membraneSegmentCount(len));
      expect(n).toBeGreaterThanOrEqual(2);
      expect(iv[0]).toBeCloseTo(-len / 2);
      expect(iv[2 * n - 1]).toBeCloseTo(len / 2);
      let on = 0;
      const gaps: number[] = [];
      for (let k = 0; k < n; k++) {
        on += (iv[2 * k + 1] ?? 0) - (iv[2 * k] ?? 0);
        if (k > 0) gaps.push((iv[2 * k] ?? 0) - (iv[2 * k - 1] ?? 0));
      }
      expect(on / len).toBeCloseTo(1 - MEMBRANE_OPEN_SHARE);
      for (const gp of gaps) expect(gp).toBeCloseTo((gaps[0] ?? 0));
    }
  });

  it('segment rects keep the bar thickness and run along its long axis', () => {
    const v = membraneSegmentRects(bar);
    for (const r of v) {
      expect(r.cx).toBe(bar.cx);
      expect(r.w).toBe(bar.w);
    }
    const h = membraneSegmentRects(flatBar);
    for (const r of h) {
      expect(r.cy).toBe(flatBar.cy);
      expect(r.h).toBe(flatBar.h);
    }
  });

  it('barrier rects hold the solid obstacles and the membrane segments, cached per arena', () => {
    const rects = barrierRects(arena);
    expect(rects[0]).toBe(solid);
    expect(rects.length).toBe(1 + membraneSegmentCount(bar.h));
    expect(barrierRects(arena)).toBe(rects);
  });

  it('drawWalls strokes membrane segments with the exact solid bar stroke (width, colour, alpha)', () => {
    const { g, calls } = recorder();
    const passes = wallPasses(0.8, 1, 1, 'crisp');
    drawWalls(g, arena, 0x33ccff, passes);
    const rects = calls.filter((c) => c.op === 'rect');
    // Arena outline plus one solid and the membrane segments, per pass.
    expect(rects.length).toBe(passes.length * (1 + 1 + membraneSegmentCount(bar.h)));
    const strokes = calls.filter((c) => c.op === 'stroke').map((c) => JSON.stringify(c.args[0]));
    const perPass = strokes.length / passes.length;
    for (let p = 0; p < passes.length; p++) {
      const group = strokes.slice(p * perPass, (p + 1) * perPass);
      expect(new Set(group).size).toBe(1);
    }
  });
});

describe('membrane red glow region', () => {
  it('detects an enemy circle overlapping the bar', () => {
    expect(circleOverlapsObstacle(bar, 200, 50, 5)).toBe(true);
    expect(circleOverlapsObstacle(bar, 225, 0, 10)).toBe(false);
    expect(circleOverlapsObstacle(bar, 215, 0, 10)).toBe(true);
  });

  it('marks only the cells whose centre is within 60 u of the enemy', () => {
    const len = 300;
    const cells = membraneCellCount(len);
    const lit = new Uint8Array(cells + 4);
    markGlowCells(lit, 2, cells, len, 150);
    const cl = len / cells;
    expect(lit[0]).toBe(0);
    expect(lit[1]).toBe(0);
    for (let c = 0; c < cells; c++) {
      const centre = (c + 0.5) * cl;
      expect(lit[2 + c]).toBe(Math.abs(centre - 150) <= MEMBRANE_GLOW_RADIUS ? 1 : 0);
    }
    const lit2 = new Uint8Array(cells);
    markGlowCells(lit2, 0, cells, len, 0);
    expect(lit2[0]).toBe(1);
    expect(lit2[cells - 1]).toBe(0);
  });

  it('fades in over 0.1 s and out over 0.4 s', () => {
    expect(stepGlow(0, MEMBRANE_GLOW_IN / 2, true)).toBeCloseTo(0.5);
    expect(stepGlow(0, MEMBRANE_GLOW_IN, true)).toBe(1);
    expect(stepGlow(1, MEMBRANE_GLOW_OUT / 2, false)).toBeCloseTo(0.5);
    expect(stepGlow(1, MEMBRANE_GLOW_OUT, false)).toBe(0);
    let v = 0;
    for (let i = 0; i < 7; i++) v = stepGlow(v, 1 / 60, true);
    expect(v).toBe(1);
  });

  it('quantises glow so equal neighbours merge, and 0 is not drawn', () => {
    expect(glowStep(0)).toBe(0);
    expect(glowStep(0.01)).toBe(0);
    expect(glowStep(1)).toBeGreaterThan(glowStep(0.5));
    expect(glowStep(2)).toBe(glowStep(1));
  });
});
