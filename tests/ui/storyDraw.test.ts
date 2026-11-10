// Pure scene draw helpers: slow reveal, colour drain and return, Torus size per act, and no flash
// or glitch faster than 3 per second (docs/19 photosensitivity rule).
import { describe, expect, it } from 'vitest';
import { ease, GLITCH_HZ, glitchOffset, markColour, panelSaturation, pulse, PULSE_HZ, REVEAL_SEC, revealAlpha, torusScale, TWEEN_SEC } from '../../src/ui/story/draw';

describe('story draw helpers', () => {
  it('reveals over 0.6 to 1.0 s', () => {
    expect(REVEAL_SEC).toBeGreaterThanOrEqual(0.6);
    expect(REVEAL_SEC).toBeLessThanOrEqual(1.0);
    expect(revealAlpha(0)).toBe(0);
    expect(revealAlpha(REVEAL_SEC)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 6);
  });

  it('pulses and glitches below 3 per second', () => {
    expect(PULSE_HZ).toBeLessThanOrEqual(1);
    expect(GLITCH_HZ).toBeLessThan(3);
    let changes = 0;
    let prev = glitchOffset(0, 10);
    for (let i = 1; i <= 1000; i++) {
      const v = glitchOffset(i / 1000, 10);
      if (v !== prev) changes++;
      prev = v;
    }
    expect(changes).toBeLessThan(3);
    expect(pulse(0)).toBeCloseTo(0.5, 6);
  });

  it('drains colour from a touched guardian and returns it when freed', () => {
    expect(panelSaturation('bossTouched', 0)).toBeGreaterThan(panelSaturation('bossTouched', TWEEN_SEC));
    expect(panelSaturation('bossTouched', TWEEN_SEC)).toBe(0);
    expect(panelSaturation('bossFreed', 0)).toBe(0);
    expect(panelSaturation('bossFreed', TWEEN_SEC)).toBe(1);
    expect(panelSaturation('boss', 3)).toBeLessThan(0.2);
    expect(panelSaturation('foe', 0)).toBe(1);
    expect(markColour('brood', 0)).toBe(markColour('warden', 0));
    expect(markColour('brood', 1)).not.toBe(markColour('brood', 0));
  });

  it('Torus is small in act 1 and larger each act', () => {
    for (let a = 1; a < 5; a++) expect(torusScale(a + 1)).toBeGreaterThan(torusScale(a));
  });
});
