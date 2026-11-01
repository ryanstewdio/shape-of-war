// G6 tilt-depth: farther lattice lines read slightly thinner (an alpha multiplier only), and the
// z lift reads a little more, still bounded.
import { describe, expect, it } from 'vitest';
import { FADE_TEXEL, FAR_FADE, fadeU, lineDepthAlpha, writeFadeUv } from '../../../src/render/lattice/depthFade';
import { Z_DISP_MUL, Z_FORCE_GAIN, Z_KICK_GAIN } from '../../../src/render/lattice/sim';
import { cameraFor } from '../../../src/render/project';

const H = 1100;

describe('lattice depth fade', () => {
  it('Off never fades', () => {
    const off = cameraFor('off', H);
    for (const y of [-550, 0, 550]) expect(lineDepthAlpha(y, H, off)).toBe(1);
  });

  it('near wall full, far wall 1 - FAR_FADE at high, less at low, monotone', () => {
    const hi = cameraFor('high', H);
    const lo = cameraFor('low', H);
    expect(lineDepthAlpha(H / 2, H, hi)).toBe(1);
    expect(lineDepthAlpha(-H / 2, H, hi)).toBeCloseTo(1 - FAR_FADE, 9);
    expect(lineDepthAlpha(-H / 2, H, lo)).toBeGreaterThan(1 - FAR_FADE);
    expect(lineDepthAlpha(-H / 2, H, lo)).toBeLessThan(1);
    let last = 0;
    for (let y = -H / 2; y <= H / 2; y += 50) {
      const a = lineDepthAlpha(y, H, hi);
      expect(a).toBeGreaterThanOrEqual(last);
      expect(a).toBeGreaterThanOrEqual(FADE_TEXEL);
      expect(a).toBeLessThanOrEqual(1);
      last = a;
    }
    // Slightly: the far wall keeps at least 70 percent.
    expect(FAR_FADE).toBeLessThanOrEqual(0.3);
  });

  it('the texture u maps the multiplier linearly between the texel centres', () => {
    expect(fadeU(1)).toBeCloseTo(0.75, 9);
    expect(fadeU(FADE_TEXEL)).toBeCloseTo(0.25, 9);
    expect(fadeU(0)).toBeCloseTo(0.25, 9);
    expect(fadeU(2)).toBeCloseTo(0.75, 9);
    // Linear filtering between texel 0 (FADE_TEXEL) and texel 1 (1) reads back the multiplier.
    for (const a of [0.7, 0.8, 0.9]) {
      const t = (fadeU(a) - 0.25) / 0.5;
      expect(FADE_TEXEL + (1 - FADE_TEXEL) * t).toBeCloseTo(a, 9);
    }
  });

  it('writes one u per node and v 0', () => {
    const uv = new Float32Array(6).fill(9);
    writeFadeUv(uv, new Float32Array([-550, 0, 550]), 3, H, cameraFor('high', H));
    expect(uv[1]).toBe(0);
    expect(uv[0]).toBeLessThan(uv[2] ?? 0);
    expect(uv[2]).toBeLessThan(uv[4] ?? 0);
    expect(uv[4]).toBeCloseTo(0.75, 6);
  });
});

describe('lattice z lift', () => {
  it('reads a little more than before (1, 0.5, 1.5) and stays bounded', () => {
    expect(Z_KICK_GAIN).toBeGreaterThan(1);
    expect(Z_KICK_GAIN).toBeLessThanOrEqual(1.5);
    expect(Z_FORCE_GAIN).toBeGreaterThan(0.5);
    expect(Z_FORCE_GAIN).toBeLessThanOrEqual(0.75);
    expect(Z_DISP_MUL).toBeGreaterThan(1.5);
    expect(Z_DISP_MUL).toBeLessThanOrEqual(2);
  });
});
