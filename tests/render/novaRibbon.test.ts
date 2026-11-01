// GW5 nova snake glints: a helix ribbon round the body and a stream from the whirlpool.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createRibbonPt,
  NOVA_SNAKE_GLINTS,
  NOVA_SNAKE_GLINTS_MAX,
  NOVA_SNAKE_ORBIT_MAX,
  NOVA_STREAM_BEND,
  NOVA_STREAM_GLINTS,
  NOVA_STREAM_RANGE,
  NOVA_STREAM_WOBBLE,
  novaRibbonAt,
  novaSnakeGlintCount,
  novaStreamAt,
  novaStreamReach,
} from '../../src/render/novaSnake';

/** A curved body: head at the origin, 9 points bending away. */
function body(): Float32Array {
  const p = new Float32Array(18);
  for (let i = 0; i < 9; i++) {
    p[i * 2] = i * 14;
    p[i * 2 + 1] = Math.sin(i * 0.6) * 20;
  }
  return p;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function polyDist(px: number, py: number, pts: Float32Array, n: number): number {
  let d = Infinity;
  for (let i = 0; i + 1 < n; i++) {
    d = Math.min(d, segDist(px, py, pts[i * 2] ?? 0, pts[i * 2 + 1] ?? 0, pts[i * 2 + 2] ?? 0, pts[i * 2 + 3] ?? 0));
  }
  return d;
}

describe('glint counts', () => {
  it('a ribbon of 6 to 10, a stream, and a per snake cap', () => {
    expect(NOVA_SNAKE_GLINTS).toBeGreaterThanOrEqual(6);
    expect(NOVA_SNAKE_GLINTS).toBeLessThanOrEqual(10);
    expect(NOVA_STREAM_GLINTS).toBeGreaterThan(0);
    expect(NOVA_SNAKE_GLINTS_MAX).toBe(NOVA_SNAKE_GLINTS + NOVA_STREAM_GLINTS);
    expect(NOVA_SNAKE_GLINTS_MAX).toBeLessThanOrEqual(16);
    expect(novaSnakeGlintCount(false)).toBe(NOVA_SNAKE_GLINTS);
    expect(novaSnakeGlintCount(true)).toBe(NOVA_SNAKE_GLINTS_MAX);
  });
});

describe('ribbon orbit helper', () => {
  it('is deterministic', () => {
    const pts = body();
    const a = novaRibbonAt(pts, 9, 2.37, 0.41, 3, createRibbonPt());
    const b = novaRibbonAt(pts, 9, 2.37, 0.41, 3, createRibbonPt());
    expect(a).toEqual(b);
    const c = novaRibbonAt(pts, 9, 2.37, 0.42, 3, createRibbonPt());
    expect(c).not.toEqual(a);
  });

  it('stays bounded round the body line', () => {
    const pts = body();
    const o = createRibbonPt();
    for (let t = 0; t < 8; t += 0.071) {
      for (let k = 0; k < NOVA_SNAKE_GLINTS; k++) {
        novaRibbonAt(pts, 9, t, 0.77, k, o);
        expect(Number.isFinite(o.x) && Number.isFinite(o.y)).toBe(true);
        expect(polyDist(o.x, o.y, pts, 9)).toBeLessThanOrEqual(NOVA_SNAKE_ORBIT_MAX + 1e-6);
        expect(o.p).toBeGreaterThanOrEqual(0);
        expect(o.p).toBeLessThan(1);
        expect(Math.abs(o.depth)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('orbits: a glint swings to both sides of the body and drifts tailward', () => {
    const pts = new Float32Array([0, 0, 50, 0, 100, 0, 150, 0]);
    const o = createRibbonPt();
    let above = 0;
    let below = 0;
    for (let t = 0; t < 3; t += 0.02) {
      novaRibbonAt(pts, 4, t, 0.2, 1, o);
      if (o.y > 2) below++;
      if (o.y < -2) above++;
    }
    expect(above).toBeGreaterThan(10);
    expect(below).toBeGreaterThan(10);
    const p0 = novaRibbonAt(pts, 4, 1, 0.2, 1, createRibbonPt()).p;
    const p1 = novaRibbonAt(pts, 4, 1.05, 0.2, 1, createRibbonPt()).p;
    if (p1 > p0) expect(p1 - p0).toBeLessThan(0.1);
  });

  it('a degenerate body stays finite and near the head', () => {
    const o = novaRibbonAt(new Float32Array([5, 5]), 1, 1, 0.3, 0, createRibbonPt());
    expect(Math.hypot(o.x - 5, o.y - 5)).toBeLessThanOrEqual(NOVA_SNAKE_ORBIT_MAX);
  });
});

describe('whirlpool stream helper', () => {
  it('is deterministic, bounded to the bent path, and bends clockwise', () => {
    const o = { x: 0, y: 0 };
    const o2 = { x: 0, y: 0 };
    const wx = 10;
    const wy = 20;
    const hx = 170;
    const hy = 80;
    const d = Math.hypot(hx - wx, hy - wy);
    for (let t = 0; t < 4; t += 0.043) {
      for (let k = 0; k < NOVA_STREAM_GLINTS; k++) {
        const a = novaStreamAt(wx, wy, hx, hy, t, 0.6, k, o);
        expect(novaStreamAt(wx, wy, hx, hy, t, 0.6, k, o2)).toBe(a);
        expect(o2).toEqual(o);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
        expect(segDist(o.x, o.y, wx, wy, hx, hy)).toBeLessThanOrEqual((NOVA_STREAM_BEND * d) / 2 + NOVA_STREAM_WOBBLE + 1e-6);
      }
    }
    // Mid path on average it sits on the clockwise side (screen cross product positive).
    let side = 0;
    for (let t = 0; t < 4; t += 0.01) {
      novaStreamAt(0, 0, 200, 0, t, 0, 0, o);
      side += o.y;
    }
    expect(side).toBeGreaterThan(0);
  });

  it('fades with distance from the well and is off beyond 250 u', () => {
    expect(NOVA_STREAM_RANGE).toBe(250);
    expect(novaStreamReach(0)).toBe(1);
    expect(novaStreamReach(150)).toBe(1);
    expect(novaStreamReach(225)).toBeGreaterThan(0);
    expect(novaStreamReach(225)).toBeLessThan(1);
    expect(novaStreamReach(250)).toBe(0);
    expect(novaStreamReach(Number.NaN)).toBe(0);
    const o = { x: 0, y: 0 };
    for (let t = 0; t < 2; t += 0.1) expect(novaStreamAt(0, 0, 260, 0, t, 0.1, 2, o)).toBe(0);
  });
});

describe('renderer wiring', () => {
  it('drawNovaSnakes draws the ribbon and the stream with the glint helper, allocation free', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const i = src.indexOf('function drawNovaSnakes(');
    const b = src.slice(i, src.indexOf('\n  }\n', i));
    expect(b).toMatch(/novaRibbonAt\(snakePts, n, timeSec, h, d, ribbonPt\)/);
    expect(b).toMatch(/novaStreamAt\(/);
    expect(b).toMatch(/NOVA_STREAM_RANGE \* NOVA_STREAM_RANGE/);
    expect(b).toMatch(/st\.snakeWell\[slot\]/);
    expect((b.match(/glintAt\(/g) ?? []).length).toBe(2);
    expect(b).not.toMatch(/new |\[\]|\.clear\(/);
  });
});
