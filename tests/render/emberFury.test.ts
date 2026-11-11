import { describe, expect, it } from 'vitest';
import {
  BLUE_BODY_ALPHA_MIN,
  BLUE_EDGE_ALPHA,
  BLUE_EDGE_WIDTH,
  BLUE_FLAME_HZ,
  blueBodyAlpha,
  blueEdgeAlpha,
  blueEdgeWidth,
  blueFlameColour,
  emberFuryMix,
  emberFurySpark,
  emberFuryStops,
  emberFuryTint,
} from '../../src/render/emberFury';
import { FLAME_STOP_COUNT, flameStops, hueDistance, hueOfRgb } from '../../src/render/emberFlame';
import { palette as pal } from '../../src/render/neon';
import { sweepArmAngle, sweepArms } from '../../src/render/hazardFx';


describe('emberFury blue flame', () => {
  it('pulses blue, purple, white at BLUE_FLAME_HZ and repeats every period', () => {
    const per = 1 / BLUE_FLAME_HZ;
    expect(blueFlameColour(pal, 0)).toBe(pal.bossBlue);
    expect(blueFlameColour(pal, per / 3)).toBe(pal.bossViolet);
    const white = blueFlameColour(pal, (2 * per) / 3);
    expect(white & 255).toBeGreaterThan(230);
    expect((white >> 16) & 255).toBeGreaterThan(200);
    expect(blueFlameColour(pal, per * 5)).toBe(blueFlameColour(pal, 0));
    expect(blueFlameColour(pal, Number.NaN)).toBe(pal.bossBlue);
  });
  it('stays in the blue to purple hue band away from white', () => {
    const h = hueOfRgb(blueFlameColour(pal, 0.1));
    expect(hueDistance(h, 250)).toBeLessThan(60);
  });
  it('flicker is deterministic and inside its ranges', () => {
    for (let k = 0; k < 6; k++) {
      for (let t = 0; t < 3; t += 0.07) {
        const a = blueEdgeAlpha(t, k);
        const w = blueEdgeWidth(t, k);
        expect(a).toBeGreaterThanOrEqual(BLUE_EDGE_ALPHA[0]);
        expect(a).toBeLessThanOrEqual(BLUE_EDGE_ALPHA[1]);
        expect(w).toBeGreaterThanOrEqual(BLUE_EDGE_WIDTH[0]);
        expect(w).toBeLessThanOrEqual(BLUE_EDGE_WIDTH[1]);
        expect(blueEdgeAlpha(t, k)).toBe(a);
      }
    }
    expect(blueEdgeAlpha(0.2, 0)).not.toBe(blueEdgeAlpha(0.9, 0));
  });
  it('body alpha only flickers when enraged', () => {
    expect(blueBodyAlpha(0, 1)).toBe(1);
    expect(blueBodyAlpha(1, 1)).toBe(1);
    for (let t = 0; t < 2; t += 0.05) {
      const a = blueBodyAlpha(2, t);
      expect(a).toBeGreaterThanOrEqual(BLUE_BODY_ALPHA_MIN);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
  it('the break crosses from orange to the flame, never to red', () => {
    expect(emberFuryMix(0, 3)).toBe(0);
    expect(emberFuryMix(2, 0)).toBe(1);
    expect(emberFuryMix(1, 0)).toBe(0);
    expect(emberFuryMix(1, 2)).toBeGreaterThan(0);
    expect(emberFuryMix(1, 2)).toBeLessThan(1);
    expect(emberFuryTint(0, 0, pal.bossOrange, pal, 0)).toBe(pal.bossOrange);
    expect(emberFuryTint(2, 5, pal.bossOrange, pal, 0)).toBe(pal.bossBlue);
    // Enraged colour is far from the orange and red hues.
    const h = hueOfRgb(emberFuryTint(2, 5, pal.bossOrange, pal, 0.1));
    expect(hueDistance(h, hueOfRgb(pal.bossRed))).toBeGreaterThan(90);
  });
  it('stops are untouched with no fury and blue when enraged, without allocating', () => {
    const base = flameStops(pal, new Uint32Array(FLAME_STOP_COUNT));
    const none = emberFuryStops(Uint32Array.from(base), pal, 0, 0, 0.2);
    expect(Array.from(none)).toEqual(Array.from(base));
    const out = flameStops(pal, new Uint32Array(FLAME_STOP_COUNT));
    expect(emberFuryStops(out, pal, 2, 5, 0)).toBe(out);
    expect(Array.from(out)).not.toEqual(Array.from(base));
    expect(hueDistance(hueOfRgb(out[1] ?? 0), 224)).toBeLessThan(40);
  });
  it('dash sparks follow the flame colours', () => {
    const c = emberFurySpark(pal, 0, 0);
    expect(hueDistance(hueOfRgb(c), 224)).toBeLessThan(40);
    expect(emberFurySpark(pal, 0, 1)).not.toBe(c);
  });
  it('a four arm sweep draws four evenly spaced arms', () => {
    expect(sweepArms(4)).toBe(4);
    const angles = [0, 1, 2, 3].map((k) => sweepArmAngle(0, k, 4));
    expect(angles[3]).toBeCloseTo((3 * Math.PI) / 2, 9);
  });
});
