// Fury tune looks (src/render/furyTune.ts and the aimed lane in hazardFx.ts): Mirage's aimed lane
// telegraph from w.vy, the straight shot tint and the ship's pool halo.
import { describe, expect, it } from 'vitest';
import { MIRAGE } from '../../src/game/bosses/table';
import { createSpriteBuf, F_BAR, F_FILL, type FxHalo, type SpriteBuf } from '../../src/render/fxSprites';
import {
  AIMED_LANE_GAIN,
  aimedLaneAlpha,
  aimedLaneTint,
  bulletStraight,
  bulletTint,
  laneAimed,
  POOL_HALO_A,
  POOL_HALO_EASE,
  POOL_HALO_RING_A,
  poolHaloAlpha,
  poolHaloRing,
  poolHaloRingAlpha,
  shipPoolHaloOn,
  stepPoolHalo,
  straightTint,
} from '../../src/render/furyTune';
import { HAZARD_LANE, HAZARD_RING, hazardForm, hazardTelegraphSec, laneTelegraphSec, planHazard, TELE_A0, TELE_A1, TELE_THICK, type HazardForm, type HazardInput } from '../../src/render/hazardFx';
import { mixRgb } from '../../src/render/mapFx';

const NO_HALO: FxHalo = { alpha: 0, width: 0 };
const VIOLET = 0x9933ff;

function lane(age: number, vy: number, tier = 3): HazardInput {
  return { type: HAZARD_LANE, x: 0, y: 0, rot: 0, radius: 22, vx: 600, vy, age, tier, tint: 0x3366ff, timeSec: 0 };
}

function maxAlpha(b: SpriteBuf, frame: number): number {
  let m = 0;
  for (let i = 0; i < b.count; i++) if (b.frame[i] === frame) m = Math.max(m, b.alpha[i] ?? 0);
  return m;
}

function maxThick(b: SpriteBuf): number {
  let m = 0;
  for (let i = 0; i < b.count; i++) if (b.frame[i] === F_BAR) m = Math.max(m, b.h[i] ?? 0);
  return m;
}

const form = (): HazardForm => ({ lethal: false, alpha: 0, thick: 0, flash: 0 });

describe('aimed lane telegraph from w.vy', () => {
  it('w.vy above 0 is the telegraph; 0, negative or NaN keeps the tier telegraph', () => {
    expect(laneTelegraphSec(MIRAGE.aimedTeleSec, 3)).toBe(MIRAGE.aimedTeleSec);
    expect(laneTelegraphSec(1.2, 2)).toBe(1.2);
    for (const t of [1, 2, 3, 4]) {
      expect(laneTelegraphSec(0, t)).toBe(hazardTelegraphSec(t));
      expect(laneTelegraphSec(-1, t)).toBe(hazardTelegraphSec(t));
      expect(laneTelegraphSec(Number.NaN, t)).toBe(hazardTelegraphSec(t));
    }
    expect(laneAimed(1.2)).toBe(true);
    expect(laneAimed(0)).toBe(false);
    expect(laneAimed(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('hazardForm with an own telegraph stays thin until it, ramps over it and flashes at it', () => {
    const tele = 1.2;
    const f = form();
    hazardForm(0, 3, f, tele);
    expect(f.lethal).toBe(false);
    expect(f.alpha).toBeCloseTo(TELE_A0, 6);
    expect(f.thick).toBe(TELE_THICK);
    hazardForm(0.6, 3, f, tele);
    expect(f.lethal).toBe(false);
    expect(f.alpha).toBeCloseTo((TELE_A0 + TELE_A1) / 2, 6);
    // Past the tier 3 telegraph (0.6 s) but inside 1.2 s: still the thin warning.
    hazardForm(1.0, 3, f, tele);
    expect(f.lethal).toBe(false);
    expect(f.flash).toBe(0);
    hazardForm(tele, 3, f, tele);
    expect(f.lethal).toBe(true);
    expect(f.alpha).toBe(1);
    expect(f.thick).toBe(1);
    expect(f.flash).toBeCloseTo(1, 6);
  });

  it('without an own telegraph hazardForm is exactly the tier form', () => {
    const a = form();
    const b = form();
    for (const t of [1, 2, 3, 4]) {
      for (const age of [0, 0.3, 0.59, 0.6, 0.7, 1, 2]) {
        hazardForm(age, t, a);
        hazardForm(age, t, b, 0);
        expect(b).toEqual(a);
      }
    }
  });

  it('a w.vy 1.2 lane is still the thin form at 1.0 s; a w.vy 0 lane of tier 3 is lethal then', () => {
    const aimed = createSpriteBuf(64);
    const plain = createSpriteBuf(64);
    planHazard(lane(1.0, 1.2), aimed, NO_HALO);
    planHazard(lane(1.0, 0), plain, NO_HALO);
    expect(maxThick(aimed)).toBeLessThan(maxThick(plain));
    expect(maxAlpha(aimed, F_BAR)).toBeLessThan(1);
    expect(maxAlpha(plain, F_BAR)).toBeGreaterThanOrEqual(1);
    expect(aimed.count).toBe(plain.count);
  });

  it('the aimed lane reads brighter and whiter than a plain lane at the same telegraph share', () => {
    const aimed = createSpriteBuf(64);
    const plain = createSpriteBuf(64);
    // Half way through each lane's own telegraph: 0.6 of 1.2 s, and 0.3 of tier 3's 0.6 s.
    planHazard(lane(0.6, 1.2), aimed, NO_HALO);
    planHazard(lane(0.3, 0), plain, NO_HALO);
    expect(maxAlpha(aimed, F_BAR)).toBeGreaterThan(maxAlpha(plain, F_BAR));
    expect(maxAlpha(aimed, F_FILL)).toBeGreaterThan(maxAlpha(plain, F_FILL));
    expect(aimed.tint[0]).toBe(aimedLaneTint(0x3366ff, true, false));
    expect(plain.tint[0]).toBe(0x3366ff);
  });

  it('once lethal the aimed lane looks like any lethal lane', () => {
    const aimed = createSpriteBuf(64);
    const plain = createSpriteBuf(64);
    planHazard(lane(2, 1.2), aimed, NO_HALO);
    planHazard(lane(2, 0), plain, NO_HALO);
    expect(Array.from(aimed.alpha.subarray(0, aimed.count))).toEqual(Array.from(plain.alpha.subarray(0, plain.count)));
    expect(Array.from(aimed.tint.subarray(0, aimed.count))).toEqual(Array.from(plain.tint.subarray(0, plain.count)));
  });

  it('w.vy only means a telegraph on lanes: a ring keeps the tier telegraph', () => {
    const a = createSpriteBuf(256);
    const b = createSpriteBuf(256);
    planHazard({ ...lane(0.7, 2), type: HAZARD_RING, radius: 200, vx: 0.6 }, a, NO_HALO);
    planHazard({ ...lane(0.7, 1), type: HAZARD_RING, radius: 200, vx: 0.6 }, b, NO_HALO);
    expect(maxAlpha(a, F_BAR)).toBe(1);
    expect(maxAlpha(b, F_BAR)).toBe(1);
  });

  it('alpha lift is capped at 1 and off once lethal; tint untouched off the aimed lane', () => {
    expect(aimedLaneAlpha(0.4, true, false)).toBeCloseTo(0.4 * AIMED_LANE_GAIN, 6);
    expect(aimedLaneAlpha(0.9, true, false)).toBe(1);
    expect(aimedLaneAlpha(1, true, true)).toBe(1);
    expect(aimedLaneAlpha(0.4, false, false)).toBe(0.4);
    expect(aimedLaneAlpha(Number.NaN, true, false)).toBe(0);
    expect(aimedLaneTint(0x3366ff, false, false)).toBe(0x3366ff);
    expect(aimedLaneTint(0x3366ff, true, true)).toBe(0x3366ff);
    expect(aimedLaneTint(0x3366ff, true, false)).not.toBe(0x3366ff);
  });
});

describe('straight shots', () => {
  it('reads the straight array; absent or 0 is off', () => {
    const s = new Uint8Array([0, 1, 0]);
    expect(bulletStraight(s, 1)).toBe(true);
    expect(bulletStraight(s, 0)).toBe(false);
    expect(bulletStraight(s, 9)).toBe(false);
    expect(bulletStraight(undefined, 1)).toBe(false);
  });

  it('a straight shot takes violet white from the palette violet; others keep their tint', () => {
    expect(bulletTint(0x00ffcc, false, VIOLET)).toBe(0x00ffcc);
    const t = bulletTint(0x00ffcc, true, VIOLET);
    expect(t).toBe(straightTint(VIOLET));
    expect(t).toBe(mixRgb(VIOLET, 0xffffff, 0.55));
    // Whiter than the violet in every channel, and still violet (blue and red above green).
    const r = (t >> 16) & 0xff;
    const g = (t >> 8) & 0xff;
    const b = t & 0xff;
    expect(r).toBeGreaterThanOrEqual((VIOLET >> 16) & 0xff);
    expect(b).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(g);
  });
});

describe('ship pool halo', () => {
  it('on only in a pool with a live ship; absent is off', () => {
    expect(shipPoolHaloOn(true, true)).toBe(true);
    expect(shipPoolHaloOn(true, false)).toBe(false);
    expect(shipPoolHaloOn(false, true)).toBe(false);
    expect(shipPoolHaloOn(undefined, true)).toBe(false);
  });

  it('eases in and out over POOL_HALO_EASE and stays in 0 to 1', () => {
    expect(stepPoolHalo(0, true, POOL_HALO_EASE / 2)).toBeCloseTo(0.5, 6);
    expect(stepPoolHalo(0.5, true, 10)).toBe(1);
    expect(stepPoolHalo(1, false, POOL_HALO_EASE / 2)).toBeCloseTo(0.5, 6);
    expect(stepPoolHalo(0.2, false, 10)).toBe(0);
    expect(stepPoolHalo(0.3, true, Number.NaN)).toBe(0.3);
    expect(stepPoolHalo(Number.NaN, true, 0)).toBe(0);
  });

  it('alpha is faint, breathes, and is 0 when off', () => {
    expect(poolHaloAlpha(0, 1)).toBe(0);
    let lo = 1;
    let hi = 0;
    for (let t = 0; t < 4; t += 0.05) {
      const a = poolHaloAlpha(1, t);
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
    }
    expect(hi).toBeLessThanOrEqual(POOL_HALO_A + 1e-9);
    expect(lo).toBeGreaterThan(0);
    expect(hi - lo).toBeGreaterThan(0.01);
    expect(poolHaloAlpha(0.5, 0)).toBeCloseTo(poolHaloAlpha(1, 0) / 2, 9);
  });

  it('ring alpha follows the halo; Low draws the glow only', () => {
    expect(poolHaloRingAlpha(POOL_HALO_A)).toBeCloseTo(POOL_HALO_RING_A, 9);
    expect(poolHaloRingAlpha(0)).toBe(0);
    expect(poolHaloRing('low')).toBe(false);
    expect(poolHaloRing('standard')).toBe(true);
    expect(poolHaloRing('high')).toBe(true);
  });
});
