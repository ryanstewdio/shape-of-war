import { describe, expect, it } from 'vitest';
import {
  ENRAGE_GLOW,
  ENRAGE_GLOW_FLICKER,
  clearEnraged,
  createEnrageTrack,
  enrageFlicker,
  enrageGlowMul,
  enrageTint,
  isEnraged,
  markEnraged,
} from '../../src/render/enrage';
import { applyNeon, NEON_DEFAULT, palette } from '../../src/render/neon';

const rgb = (c: number): [number, number, number] => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];

describe('enrage tracking', () => {
  it('marks a slot from sim:enrage and keeps it for the life of that enemy', () => {
    const t = createEnrageTrack(4);
    expect(isEnraged(t, 2, 5)).toBe(false);
    markEnraged(t, 2);
    expect(isEnraged(t, 2, 5)).toBe(true);
    expect(isEnraged(t, 2, 5)).toBe(true);
  });
  it('clears on death and when the slot is reused by another kind', () => {
    const t = createEnrageTrack(4);
    markEnraged(t, 1);
    clearEnraged(t, 1);
    expect(isEnraged(t, 1, 3)).toBe(false);
    markEnraged(t, 1);
    expect(isEnraged(t, 1, 3)).toBe(true);
    expect(isEnraged(t, 1, 4)).toBe(false);
    expect(isEnraged(t, 1, 3)).toBe(false);
  });
  it('grows for ids past the capacity and ignores bad ids', () => {
    const t = createEnrageTrack(2);
    markEnraged(t, 10);
    expect(isEnraged(t, 10, 1)).toBe(true);
    markEnraged(t, -1);
    markEnraged(t, 1.5);
    expect(t.on.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe('enrage tint', () => {
  it('is hot red from the palette red: red channel dominant at every time', () => {
    applyNeon(NEON_DEFAULT);
    for (let i = 0; i < 40; i++) {
      const [r, g, b] = rgb(enrageTint(palette.red, i * 0.037, 0.3));
      expect(r).toBeGreaterThan(200);
      expect(r).toBeGreaterThan(g + 60);
      expect(r).toBeGreaterThan(b + 60);
    }
  });
  it('follows applyNeon through the palette (saturation changes the tint)', () => {
    applyNeon(0);
    const low = enrageTint(palette.red, 0, 0);
    applyNeon(100);
    const high = enrageTint(palette.red, 0, 0);
    expect(low).not.toBe(high);
    applyNeon(NEON_DEFAULT);
  });
  it('flickers subtly: bounded, varying, and the glow multiplier stays in range', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const t = i * 0.013;
      const f = enrageFlicker(t, 0.7);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      seen.add(Math.round(f * 10));
      const g = enrageGlowMul(t, 0.7);
      expect(g).toBeGreaterThanOrEqual(ENRAGE_GLOW);
      expect(g).toBeLessThanOrEqual(ENRAGE_GLOW + ENRAGE_GLOW_FLICKER);
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});
