// GW3: nova snakes keep a white core line and a faint shimmer for their whole life.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createNovaSnakeState,
  NOVA_SNAKE_DOTS,
  NOVA_SNAKE_TRACK,
  novaSnakeCount,
  novaSnakeDot,
  novaSnakeDotAlpha,
  novaSnakeGlow,
  novaSnakeHas,
  novaSnakeMark,
  novaSnakeSweep,
  polyAt,
  resetNovaSnakeState,
} from '../../src/render/novaSnake';

const HEAD = 7;

describe('nova snake tracking', () => {
  it('tracks a marked head while it lives and drops it when it dies', () => {
    const s = createNovaSnakeState();
    const alive = new Uint8Array(10).fill(1);
    const kind = new Uint8Array(10).fill(HEAD);
    const t = new Float32Array(10).fill(0.5);
    expect(novaSnakeMark(s, 3, 0.1)).toBeGreaterThanOrEqual(0);
    expect(novaSnakeMark(s, 3, 0.2)).toBe(novaSnakeMark(s, 3, 0.2));
    expect(novaSnakeCount(s)).toBe(1);
    for (let f = 0; f < 600; f++) {
      t[3] = 0.5 + f / 60;
      novaSnakeSweep(s, alive, kind, t, HEAD);
    }
    expect(novaSnakeHas(s, 3)).toBe(true);
    alive[3] = 0;
    novaSnakeSweep(s, alive, kind, t, HEAD);
    expect(novaSnakeHas(s, 3)).toBe(false);
  });

  it('drops a head whose index was reused (kind changed or clock went back)', () => {
    const s = createNovaSnakeState();
    const alive = new Uint8Array(10).fill(1);
    const kind = new Uint8Array(10).fill(HEAD);
    const t = new Float32Array(10).fill(4);
    novaSnakeMark(s, 2, 4);
    novaSnakeMark(s, 5, 4);
    kind[2] = 1;
    t[5] = 0.01;
    novaSnakeSweep(s, alive, kind, t, HEAD);
    expect(novaSnakeCount(s)).toBe(0);
  });

  it('never holds more than NOVA_SNAKE_TRACK and ignores junk ids', () => {
    const s = createNovaSnakeState();
    for (let i = 0; i < NOVA_SNAKE_TRACK + 5; i++) novaSnakeMark(s, i, 0);
    expect(novaSnakeCount(s)).toBe(NOVA_SNAKE_TRACK);
    expect(novaSnakeMark(s, -1, 0)).toBe(-1);
    expect(novaSnakeMark(s, 1.5, 0)).toBe(-1);
    resetNovaSnakeState(s);
    expect(novaSnakeCount(s)).toBe(0);
  });
});

describe('nova snake shimmer', () => {
  it('dots run down the body and wrap, deterministic from the clock and the head hash', () => {
    expect(NOVA_SNAKE_DOTS).toBeGreaterThan(0);
    const a = novaSnakeDot(1, 0.3, 0);
    const b = novaSnakeDot(1.05, 0.3, 0);
    expect(b).toBeGreaterThan(a);
    for (let t = 0; t < 5; t += 0.1) {
      const p = novaSnakeDot(t, 0.7, 1);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
      expect(novaSnakeDotAlpha(p)).toBeLessThanOrEqual(0.7);
      expect(novaSnakeDotAlpha(p)).toBeGreaterThanOrEqual(0);
      const g = novaSnakeGlow(t, 0.7);
      expect(g).toBeGreaterThanOrEqual(0.08 - 1e-9);
      expect(g).toBeLessThanOrEqual(0.2 + 1e-9);
    }
  });

  it('polyAt walks the body polyline by point index', () => {
    const pts = new Float32Array([0, 0, 10, 0, 10, 10]);
    const o = { x: 0, y: 0 };
    expect(polyAt(pts, 3, 0, o)).toEqual({ x: 0, y: 0 });
    expect(polyAt(pts, 3, 0.25, o)).toEqual({ x: 5, y: 0 });
    expect(polyAt(pts, 3, 1, o)).toEqual({ x: 10, y: 10 });
    expect(polyAt(pts, 1, 0.5, o)).toEqual({ x: 0, y: 0 });
    expect(polyAt(pts, 0, 0.5, o)).toEqual({ x: 0, y: 0 });
  });

  it('the renderer marks emerged heads, sweeps once per frame and draws on the well layer', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/emergeTrack\(emerge, i, ev\.x, ev\.y\) >= 0\) novaSnakeMark\(/);
    expect((src.match(/novaSnakeSweep\(/g) ?? []).length).toBe(1);
    const i = src.indexOf('function drawNovaSnakes(');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).toMatch(/wellLayer\(\)/);
    expect(body).not.toMatch(/new (Float32Array|Array)|\.clear\(/);
  });
});

describe('GW4 nova snake glints', () => {
  it('the ribbon glint slots spread down the body and travel tailward', async () => {
    const m = await import('../../src/render/novaSnake');
    const a = m.novaSnakeGlintShare(1, 0.3, 0);
    const b = m.novaSnakeGlintShare(1.05, 0.3, 0);
    expect(b).toBeGreaterThan(a);
    const shares = new Set<string>();
    for (let k = 0; k < m.NOVA_SNAKE_GLINTS; k++) shares.add(m.novaSnakeGlintShare(2, 0.1, k).toFixed(3));
    expect(shares.size).toBe(m.NOVA_SNAKE_GLINTS);
  });

  it('the renderer draws glints, not the old dots, along nova snakes', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const i = src.indexOf('function drawNovaSnakes(');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).toMatch(/drawGlint\(/);
    expect(body).toMatch(/NOVA_SNAKE_GLINTS/);
    expect(body).not.toMatch(/novaSnakeDot\(/);
  });
});
