// Fury fixes looks (src/render/furyFixes.ts, hazardFx.ts pool, bossTier2.ts arc): the Mirage opening
// follows the sim's MIRAGE.arcDeg, the Brood pincer telegraph helpers and the Gravitas shelter pool.
import { describe, expect, it } from 'vitest';
import { BROOD_FRENZY, GRAVITAS_POOL, MIRAGE } from '../../src/game/bosses/table';
import { HazardType } from '../../src/game/bosses/types';
import { mirageLips, mirageShield } from '../../src/render/bossShapes';
import { MIRAGE_ARC_HALF, mirageArcHalf } from '../../src/render/bossTier2';
import { countFrame, createSpriteBuf, F_BAR, F_DOT, F_GLOW, type FxHalo } from '../../src/render/fxSprites';
import {
  isPincerId,
  PINCER_FLASH_HZ,
  PINCER_LINE_A0,
  PINCER_LINE_A1,
  pincerAimOn,
  pincerDriveOn,
  pincerFlash,
  pincerLineAlpha,
  pincerStreakDir,
  pincerStreakOn,
  POOL_DASHES_MAX,
  POOL_DASHES_MIN,
  POOL_FADE_IN,
  POOL_SPREAD,
  poolDashes,
  poolFade,
  poolSpeck,
  poolSpeckCount,
  speckHash,
} from '../../src/render/furyFixes';
import { HAZARD_POOL, planHazard, type HazardInput } from '../../src/render/hazardFx';

const halo: FxHalo = { alpha: 0.5, width: 2 };

function pool(over: Partial<HazardInput> = {}): HazardInput {
  return { type: HAZARD_POOL, x: 0, y: 0, rot: 0, radius: GRAVITAS_POOL.radius, vx: GRAVITAS_POOL.lifeSec, vy: 0, age: 3, tier: 2, tint: 0xaa44ff, timeSec: 0, ...over };
}

function maxAlpha(b: ReturnType<typeof createSpriteBuf>): number {
  let m = 0;
  for (let i = 0; i < b.count; i++) m = Math.max(m, b.alpha[i] ?? 0);
  return m;
}

describe('Mirage opening follows the sim', () => {
  it('the full half angle is half of MIRAGE.arcDeg, not a copied number', () => {
    expect(MIRAGE_ARC_HALF).toBeCloseTo((MIRAGE.arcDeg / 2) * (Math.PI / 180), 12);
    expect(mirageArcHalf(1)).toBeCloseTo(MIRAGE_ARC_HALF, 12);
  });

  it('the shield ring ends and the lips sit at the opening edges', () => {
    const p = mirageShield(50);
    if (p.t !== 'line') throw new Error('shield is a line');
    const n = p.pts.length;
    expect(Math.atan2(p.pts[1] ?? 0, p.pts[0] ?? 0)).toBeCloseTo(MIRAGE_ARC_HALF, 2);
    expect(Math.atan2(p.pts[n - 1] ?? 0, p.pts[n - 2] ?? 0)).toBeCloseTo(-MIRAGE_ARC_HALF, 2);
    const lips = mirageLips(50);
    expect(lips).toHaveLength(2);
    const a = lips[0];
    const b = lips[1];
    if (a?.t !== 'line' || b?.t !== 'line') throw new Error('lips are lines');
    expect(Math.atan2(a.pts[1] ?? 0, a.pts[0] ?? 0)).toBeCloseTo(MIRAGE_ARC_HALF, 3);
    expect(Math.atan2(b.pts[1] ?? 0, b.pts[0] ?? 0)).toBeCloseTo(-MIRAGE_ARC_HALF, 3);
  });
});

describe('Brood pincer', () => {
  it('aim is on at 0 or more, off when absent, negative or not finite', () => {
    expect(pincerAimOn(0)).toBe(true);
    expect(pincerAimOn(0.3)).toBe(true);
    expect(pincerAimOn(-1)).toBe(false);
    expect(pincerAimOn(undefined)).toBe(false);
    expect(pincerAimOn(Number.NaN)).toBe(false);
    expect(pincerDriveOn(true)).toBe(true);
    expect(pincerDriveOn(undefined)).toBe(false);
    expect(pincerDriveOn(false)).toBe(false);
  });

  it('matches only the two pincer ids, never -1 or absent', () => {
    expect(isPincerId(5, 5, 9)).toBe(true);
    expect(isPincerId(9, 5, 9)).toBe(true);
    expect(isPincerId(7, 5, 9)).toBe(false);
    expect(isPincerId(-1, -1, -1)).toBe(false);
    expect(isPincerId(3, undefined, undefined)).toBe(false);
  });

  it('flashes white at about 6 Hz, half of each cycle', () => {
    expect(PINCER_FLASH_HZ).toBeGreaterThanOrEqual(5);
    expect(PINCER_FLASH_HZ).toBeLessThanOrEqual(7);
    let on = 0;
    let edges = 0;
    let last = pincerFlash(0);
    const steps = 6000;
    for (let k = 0; k < steps; k++) {
      const f = pincerFlash(k / steps);
      if (f) on++;
      if (f && !last) edges++;
      last = f;
    }
    expect(on / steps).toBeCloseTo(0.5, 1);
    expect(edges).toBeGreaterThanOrEqual(PINCER_FLASH_HZ - 1);
    expect(edges).toBeLessThanOrEqual(PINCER_FLASH_HZ);
    expect(pincerFlash(Number.NaN)).toBe(true);
  });

  it('the aim line brightens as the aim runs out', () => {
    expect(pincerLineAlpha(BROOD_FRENZY.aimSec)).toBeCloseTo(PINCER_LINE_A0, 9);
    expect(pincerLineAlpha(0)).toBeCloseTo(PINCER_LINE_A1, 9);
    expect(pincerLineAlpha(BROOD_FRENZY.aimSec / 2)).toBeGreaterThan(PINCER_LINE_A0);
    expect(pincerLineAlpha(BROOD_FRENZY.aimSec / 2)).toBeLessThan(PINCER_LINE_A1);
    expect(pincerLineAlpha(99)).toBeCloseTo(PINCER_LINE_A0, 9);
  });

  it('the streak shows while driving, never on Low', () => {
    expect(pincerStreakOn(true, 'standard')).toBe(true);
    expect(pincerStreakOn(true, 'high')).toBe(true);
    expect(pincerStreakOn(true, 'low')).toBe(false);
    expect(pincerStreakOn(false, 'high')).toBe(false);
    expect(pincerStreakOn(undefined, 'high')).toBe(false);
  });

  it('the streak trails against the move, else away from the drive point', () => {
    const o = { x: 0, y: 0 };
    pincerStreakDir(3, 4, 100, 0, o);
    expect(o.x).toBeCloseTo(-0.6, 9);
    expect(o.y).toBeCloseTo(-0.8, 9);
    pincerStreakDir(0, 0, 0, 50, o);
    expect(o.x).toBeCloseTo(0, 9);
    expect(o.y).toBeCloseTo(-1, 9);
    pincerStreakDir(0, 0, 0, 0, o);
    expect(o).toEqual({ x: 0, y: 0 });
  });
});

describe('Gravitas pool', () => {
  it('the render pool type is the sim HazardType.Pool', () => {
    expect(HAZARD_POOL).toBe(HazardType.Pool);
  });

  it('fades in, holds, then dims to 0 over its last GRAVITAS_POOL.fadeSec', () => {
    const life = GRAVITAS_POOL.lifeSec;
    expect(poolFade(0, life)).toBe(0);
    expect(poolFade(POOL_FADE_IN, life)).toBe(1);
    expect(poolFade(life - GRAVITAS_POOL.fadeSec, life)).toBe(1);
    expect(poolFade(life - GRAVITAS_POOL.fadeSec / 2, life)).toBeCloseTo(0.5, 9);
    expect(poolFade(life, life)).toBe(0);
    expect(poolFade(3, 0)).toBe(1);
    expect(poolFade(Number.NaN, life)).toBe(0);
  });

  it('dash count follows the radius within its bounds', () => {
    expect(poolDashes(0)).toBe(0);
    expect(poolDashes(5)).toBe(POOL_DASHES_MIN);
    expect(poolDashes(1000)).toBe(POOL_DASHES_MAX);
    expect(poolDashes(GRAVITAS_POOL.radius)).toBeGreaterThanOrEqual(POOL_DASHES_MIN);
  });

  it('specks stay inside the pool, rise over time and are fixed by index', () => {
    const r = GRAVITAS_POOL.radius;
    const s = { x: 0, y: 0, a: 0 };
    for (let k = 0; k < 12; k++) {
      for (let t = 0; t < 10; t += 0.37) {
        poolSpeck(k, r, t, s);
        expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(r * POOL_SPREAD + 1e-6);
        expect(s.a).toBeGreaterThanOrEqual(0);
        expect(s.a).toBeLessThanOrEqual(1);
      }
    }
    const a = poolSpeck(2, r, 1, { x: 0, y: 0, a: 0 });
    const b = poolSpeck(2, r, 1.1, { x: 0, y: 0, a: 0 });
    expect(b.y).toBeLessThan(a.y);
    expect(b.x).toBe(a.x);
    expect(speckHash(4, 1)).toBe(speckHash(4, 1));
  });

  it('Low draws fewer specks', () => {
    expect(poolSpeckCount('low')).toBeLessThan(poolSpeckCount('standard'));
    expect(poolSpeckCount('standard')).toBeLessThanOrEqual(poolSpeckCount('high'));
  });

  it('plans a dashed ring, a faint fill and specks', () => {
    const b = createSpriteBuf(512);
    const n = planHazard(pool(), b, halo);
    expect(n).toBe(b.count);
    expect(countFrame(b, F_GLOW)).toBe(1);
    expect(countFrame(b, F_BAR)).toBe(2 * poolDashes(GRAVITAS_POOL.radius));
    expect(countFrame(b, F_DOT)).toBeGreaterThan(0);
    expect(countFrame(b, F_DOT)).toBeLessThanOrEqual(poolSpeckCount('standard'));
  });

  it('is never drawn as a lethal hazard: no telegraph form and no flash at any age', () => {
    const young = createSpriteBuf(512);
    const old = createSpriteBuf(512);
    planHazard(pool({ age: 0.5 }), young, halo);
    planHazard(pool({ age: 0.81 }), old, halo);
    expect(maxAlpha(young)).toBeCloseTo(maxAlpha(old), 9);
    expect(maxAlpha(old)).toBeLessThan(0.7);
  });

  it('dims as it fades and draws nothing at the end of its life', () => {
    const full = createSpriteBuf(512);
    const dim = createSpriteBuf(512);
    const gone = createSpriteBuf(512);
    const life = GRAVITAS_POOL.lifeSec;
    planHazard(pool({ age: 3 }), full, halo);
    planHazard(pool({ age: life - GRAVITAS_POOL.fadeSec / 4, radius: GRAVITAS_POOL.radius / 4 }), dim, halo);
    planHazard(pool({ age: life }), gone, halo);
    expect(maxAlpha(dim)).toBeLessThan(maxAlpha(full));
    expect(gone.count).toBe(0);
  });

  it('Low is cheaper, and four pools at once stay small', () => {
    const lo = createSpriteBuf(512);
    const hi = createSpriteBuf(1024);
    planHazard(pool({ fx: 'low' }), lo, halo);
    for (let k = 0; k < GRAVITAS_POOL.max; k++) planHazard(pool({ fx: 'high', x: k * 200 }), hi, halo);
    expect(lo.count).toBeLessThan(hi.count / GRAVITAS_POOL.max);
    expect(hi.count).toBeLessThanOrEqual(400);
    expect(hi.dropped).toBe(0);
  });
});
