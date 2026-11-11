import { describe, expect, it } from 'vitest';
import { mixRgb } from '../../src/render/mapFx';
import {
  BLOCK_GREY,
  BLOCK_GREY_SHARE,
  BLOCK_SPARK_MS,
  BODY_FLASH_FILL,
  BODY_FLASH_GAP,
  BODY_FLASH_GLOW,
  CRACK_GLOW_MAX,
  CRACK_GLOW_MIN,
  CRACK_PULSE_BOOST,
  CRACK_PULSE_SEC,
  HIT_SPARK_LIFE_MUL,
  HIT_SPARK_SIZE,
  crackGlow,
  crackPulse,
  crackStrength,
  crackWidthMul,
  healthShare,
  BODY_FLASH_SEC,
  EMBER_FURY_SPARK_RATE,
  HIT_SPARK_MS,
  HIT_SPARK_WHITE,
  bodyFlashAmount,
  bossHitSparkColour,
  bossHitSparkCount,
  createBodyFlash,
  createSparkGate,
  emberFurySparkRate,
  furyArmAlpha,
  furyArmTint,
  furySpikes,
  resetBodyFlash,
  resetSparkGate,
  sparkAllow,
  stepBodyFlash,
  triggerBodyFlash,
} from '../../src/render/bossHitFury';
import { FURY_BREAK_SEC, FURY_PULSE_MIN, furyHotRed } from '../../src/render/wardenFury';
import { HAZARD_SWEEP, planHazard, type HazardInput } from '../../src/render/hazardFx';
import { createSpriteBuf, type FxHalo } from '../../src/render/fxSprites';

const BLUE = 0x2050ff;
const RED = 0xff2010;

describe('body flash', () => {
  it('is under 0.08 s and capped in rate', () => {
    expect(BODY_FLASH_SEC).toBeLessThan(0.08);
    expect(BODY_FLASH_GAP).toBeGreaterThan(BODY_FLASH_SEC);
  });

  it('starts off and flashes from the event path', () => {
    const f = createBodyFlash();
    expect(bodyFlashAmount(f)).toBe(0);
    expect(triggerBodyFlash(f)).toBe(true);
    expect(bodyFlashAmount(f)).toBe(1);
    stepBodyFlash(f, undefined, BODY_FLASH_SEC / 2);
    expect(bodyFlashAmount(f)).toBeCloseTo(0.5, 5);
    stepBodyFlash(f, undefined, BODY_FLASH_SEC);
    expect(bodyFlashAmount(f)).toBe(0);
  });

  it('refuses a second start inside the gap', () => {
    const f = createBodyFlash();
    triggerBodyFlash(f);
    stepBodyFlash(f, undefined, BODY_FLASH_GAP * 0.5);
    expect(triggerBodyFlash(f)).toBe(false);
    stepBodyFlash(f, undefined, BODY_FLASH_GAP * 0.6);
    expect(triggerBodyFlash(f)).toBe(true);
  });

  it('follows hitT from the view', () => {
    const f = createBodyFlash();
    stepBodyFlash(f, -1, 1 / 60);
    expect(bodyFlashAmount(f)).toBe(0);
    stepBodyFlash(f, 0.01, 1 / 60);
    expect(bodyFlashAmount(f)).toBeGreaterThan(0.8);
    stepBodyFlash(f, 0.5, 1);
    expect(bodyFlashAmount(f)).toBe(0);
  });

  it('strobes under continuous fire with a duty below half', () => {
    const f = createBodyFlash();
    const dt = 1 / 120;
    let on = 0;
    const steps = 240;
    for (let k = 0; k < steps; k++) {
      stepBodyFlash(f, 0, dt);
      if (bodyFlashAmount(f) > 0) on++;
    }
    expect(on / steps).toBeLessThan(0.5);
    expect(on).toBeGreaterThan(0);
  });

  it('resets', () => {
    const f = createBodyFlash();
    triggerBodyFlash(f);
    resetBodyFlash(f);
    expect(bodyFlashAmount(f)).toBe(0);
  });
});

describe('hit sparks', () => {
  it('landed throws 2 to 4, blocked exactly one', () => {
    for (let s = -5; s < 20; s++) {
      const n = bossHitSparkCount(true, s);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
      expect(bossHitSparkCount(false, s)).toBe(1);
    }
  });

  it('landed is the hue lifted to white, blocked is near grey', () => {
    expect(bossHitSparkColour(true, BLUE)).toBe(mixRgb(BLUE, 0xffffff, HIT_SPARK_WHITE));
    expect(bossHitSparkColour(false, BLUE)).toBe(mixRgb(BLUE, BLOCK_GREY, BLOCK_GREY_SHARE));
    expect(bossHitSparkColour(false, BLUE)).not.toBe(bossHitSparkColour(true, BLUE));
  });

  it('gates landed and blocked bursts on separate clocks', () => {
    const g = createSparkGate();
    expect(sparkAllow(g, true, 1000)).toBe(true);
    expect(sparkAllow(g, true, 1000 + HIT_SPARK_MS - 1)).toBe(false);
    expect(sparkAllow(g, false, 1001)).toBe(true);
    expect(sparkAllow(g, false, 1001 + BLOCK_SPARK_MS - 1)).toBe(false);
    expect(sparkAllow(g, true, 1000 + HIT_SPARK_MS)).toBe(true);
    // A clock that ran backwards (new level) never locks the gate.
    expect(sparkAllow(g, true, 10)).toBe(true);
    resetSparkGate(g);
    expect(sparkAllow(g, false, 0)).toBe(true);
  });
});

describe('generic fury', () => {
  it('only the Warden grows spikes', () => {
    expect(furySpikes(0, 0)).toBe(true);
    for (let b = 1; b < 10; b++) expect(furySpikes(b, 0)).toBe(false);
  });

  it('arms keep their hue with no fury, cross over the break, hot red enraged', () => {
    expect(furyArmTint(0, 1, BLUE, RED)).toBe(BLUE);
    expect(furyArmTint(1, 0, BLUE, RED)).toBe(BLUE);
    expect(furyArmTint(1, FURY_BREAK_SEC, BLUE, RED)).toBe(furyHotRed(RED));
    expect(furyArmTint(2, 0, BLUE, RED)).toBe(furyHotRed(RED));
  });

  it('arms pulse only while enraged', () => {
    expect(furyArmAlpha(0, 0.5)).toBe(1);
    expect(furyArmAlpha(1, 0.5)).toBe(1);
    expect(furyArmAlpha(2, 0)).toBeCloseTo(1, 6);
    expect(furyArmAlpha(2, 0.5)).toBeCloseTo(FURY_PULSE_MIN, 6);
  });

  it('Ember fury sparks only enraged, dashing and off Low', () => {
    expect(emberFurySparkRate(2, true, false)).toBe(EMBER_FURY_SPARK_RATE);
    expect(emberFurySparkRate(2, false, false)).toBe(0);
    expect(emberFurySparkRate(1, true, false)).toBe(0);
    expect(emberFurySparkRate(0, true, false)).toBe(0);
    expect(emberFurySparkRate(2, true, true)).toBe(0);
  });

  it('sweep arms take the alpha multiplier, absent means unchanged', () => {
    const h: HazardInput = { type: HAZARD_SWEEP, x: 0, y: 0, rot: 0, radius: 0, vx: 300, vy: 2, age: 5, tier: 1, tint: RED, timeSec: 0 };
    const halo: FxHalo = { alpha: 0.5, width: 0.55 };
    const a = createSpriteBuf(64);
    const na = planHazard(h, a, halo);
    const b = createSpriteBuf(64);
    const nb = planHazard({ ...h, alphaMul: 0.5 }, b, halo);
    expect(nb).toBe(na);
    expect(na).toBeGreaterThan(0);
    const sumA = Array.from(a.alpha.subarray(0, a.count)).reduce((s, v) => s + v, 0);
    const sumB = Array.from(b.alpha.subarray(0, b.count)).reduce((s, v) => s + v, 0);
    expect(sumB).toBeCloseTo(sumA * 0.5, 4);
  });
});

describe('glow-hit-feel helpers', () => {
  it('healthShare clamps and tolerates bad input', () => {
    expect(healthShare(50, 100)).toBe(0.5);
    expect(healthShare(150, 100)).toBe(1);
    expect(healthShare(-5, 100)).toBe(0);
    expect(healthShare(10, 0)).toBe(1);
    expect(healthShare(Number.NaN, 100)).toBe(1);
  });
  it('crackGlow rises as health falls', () => {
    expect(crackGlow(1)).toBe(CRACK_GLOW_MIN);
    expect(crackGlow(0)).toBe(CRACK_GLOW_MAX);
    expect(crackGlow(0.2)).toBeGreaterThan(crackGlow(0.8));
  });
  it('crackPulse is 1 at a hit and 0 once over or unknown', () => {
    expect(crackPulse(0)).toBe(1);
    expect(crackPulse(CRACK_PULSE_SEC / 2)).toBeCloseTo(0.5);
    expect(crackPulse(CRACK_PULSE_SEC)).toBe(0);
    expect(crackPulse(-1)).toBe(0);
    expect(crackPulse(undefined)).toBe(0);
    expect(crackPulse(Number.NaN)).toBe(0);
  });
  it('crackStrength adds the pulse and crackWidthMul stays in 1 to 1.6', () => {
    expect(crackStrength(1, 1)).toBeCloseTo(CRACK_GLOW_MIN + CRACK_PULSE_BOOST);
    expect(crackStrength(0.5, 5)).toBe(crackStrength(0.5, 1));
    expect(crackWidthMul(0)).toBe(1);
    expect(crackWidthMul(99)).toBeCloseTo(1.6);
    expect(crackWidthMul(99)).toBeLessThanOrEqual(1.6);
    expect(crackWidthMul(crackStrength(0.1, 0))).toBeGreaterThan(crackWidthMul(crackStrength(0.9, 0)));
  });
  it('hit constants are stronger than before and the flash cap is kept', () => {
    expect(BODY_FLASH_FILL).toBeGreaterThan(0.5);
    expect(BODY_FLASH_GLOW).toBeGreaterThan(0.6);
    expect(HIT_SPARK_SIZE).toBe(2);
    expect(HIT_SPARK_LIFE_MUL).toBeGreaterThan(1);
    expect(BODY_FLASH_GAP).toBe(0.18);
  });
});
