// GW4 crystal shimmer: gem glints.
import { describe, expect, it } from 'vitest';
import {
  createGlint,
  GLINT_LIFE_MAX,
  GLINT_LIFE_MIN,
  GLINT_STAR_PTS,
  GLINT_WAIST,
  glintAt,
  glintFlare,
  glintLife,
  glintsAlive,
  glintSize,
  glintStar,
} from '../../src/render/gemGlint';
import { NOVA_SNAKE_GLINTS } from '../../src/render/novaSnake';

describe('gem glints', () => {
  it('each glint lives 0.15 to 0.4 s', () => {
    expect(GLINT_LIFE_MIN).toBe(0.15);
    expect(GLINT_LIFE_MAX).toBe(0.4);
    for (let seed = 0; seed < 20; seed++) {
      for (let k = 0; k < 10; k++) {
        const l = glintLife(seed, k);
        expect(l).toBeGreaterThanOrEqual(GLINT_LIFE_MIN);
        expect(l).toBeLessThanOrEqual(GLINT_LIFE_MAX);
      }
    }
  });

  it('is deterministic from the seed, slot and draw clock', () => {
    const a = glintAt(7, 2, 3.21, createGlint());
    const b = glintAt(7, 2, 3.21, createGlint());
    expect(b).toEqual(a);
    const c = glintAt(8, 2, 3.21, createGlint());
    expect(c.a === a.a && c.b === a.b).toBe(false);
  });

  it('pops in and out: the flare is 0 at birth and death and peaks at 1 early in the life', () => {
    expect(glintFlare(0)).toBe(0);
    expect(glintFlare(1)).toBe(0);
    let peak = 0;
    let at = 0;
    for (let i = 1; i < 100; i++) {
      const f = glintFlare(i / 100);
      if (f > peak) {
        peak = f;
        at = i / 100;
      }
    }
    expect(peak).toBeCloseTo(1, 2);
    expect(at).toBeLessThan(0.5);
    expect(glintFlare(Number.NaN)).toBe(0);
  });

  it('restarts at a new spot each cycle and its hue sweeps through the prism over a life', () => {
    const g = createGlint();
    const life = glintLife(3, 1);
    glintAt(3, 1, 10, g);
    const cycle = g.cycle;
    const spot = g.a;
    const hue0 = g.hue;
    glintAt(3, 1, 10 + life, g);
    expect(g.cycle).toBe(cycle + 1);
    expect(g.a).not.toBe(spot);
    // Within one cycle the hue moves.
    glintAt(3, 1, 10, g);
    const t0 = 10 - g.p * life;
    glintAt(3, 1, t0 + life * 0.1, g);
    const h1 = g.hue;
    glintAt(3, 1, t0 + life * 0.8, g);
    expect(g.hue).not.toBeCloseTo(h1, 3);
    expect(hue0).toBeGreaterThanOrEqual(0);
    expect(hue0).toBeLessThan(1);
  });

  it('every slot is always alive, so nova snakes show 3 to 5 glints at any time', () => {
    expect(glintsAlive(NOVA_SNAKE_GLINTS)).toBeGreaterThanOrEqual(3);
    expect(glintsAlive(NOVA_SNAKE_GLINTS)).toBeLessThanOrEqual(5);
    const g = createGlint();
    for (let t = 0; t < 3; t += 0.037) {
      glintAt(1, 0, t, g);
      expect(g.p).toBeGreaterThanOrEqual(0);
      expect(g.p).toBeLessThan(1);
    }
  });

  it('the star is a sharp 4 point star: arms at the size, valleys at the waist', () => {
    const pts = glintStar(10, 20, 8, 0, new Float32Array(GLINT_STAR_PTS * 2));
    expect(pts[0]).toBeCloseTo(18);
    expect(pts[1]).toBeCloseTo(20);
    expect(Math.hypot((pts[2] ?? 0) - 10, (pts[3] ?? 0) - 20)).toBeCloseTo(8 * GLINT_WAIST);
    expect(Math.hypot((pts[4] ?? 0) - 10, (pts[5] ?? 0) - 20)).toBeCloseTo(8);
    expect(GLINT_WAIST).toBeLessThan(0.3);
    expect(glintSize(10, 0)).toBeLessThan(glintSize(10, 1));
    expect(glintSize(10, 1)).toBeCloseTo(10);
  });
});
