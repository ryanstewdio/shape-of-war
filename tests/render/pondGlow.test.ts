import { describe, expect, it } from 'vitest';
import { addPondGlow, POND_GLOW_WHITE } from '../../src/render/lattice/pondGlow';

describe('pond crest glow on the heat colours', () => {
  it('adds white by glow and lifts alpha to the brightest channel', () => {
    const rgba = new Uint8Array([0, 0, 0, 0, 100, 20, 10, 100, 0, 0, 0, 0]);
    addPondGlow(rgba, new Float32Array([1, 0.5, 0]), 3);
    const w = Math.round(255 * POND_GLOW_WHITE);
    expect(Array.from(rgba.slice(0, 4))).toEqual([w, w, w, w]);
    const h = Math.round(255 * POND_GLOW_WHITE * 0.5);
    expect(Array.from(rgba.slice(4, 8))).toEqual([Math.min(255, 100 + h), 20 + h, 10 + h, Math.min(255, 100 + h)]);
    expect(Array.from(rgba.slice(8, 12))).toEqual([0, 0, 0, 0]);
  });

  it('clamps to 255, ignores bad glow and stops at n', () => {
    const rgba = new Uint8Array([250, 250, 250, 250, 0, 0, 0, 0]);
    addPondGlow(rgba, new Float32Array([3, 1]), 1);
    expect(Array.from(rgba)).toEqual([255, 255, 255, 255, 0, 0, 0, 0]);
    addPondGlow(rgba, new Float32Array([Number.NaN, Number.NaN]), 2);
    expect(Array.from(rgba)).toEqual([255, 255, 255, 255, 0, 0, 0, 0]);
  });
});
