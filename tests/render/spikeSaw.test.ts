// Look GW2: orbit chainsaw teeth follow BulletPool.spikeLen.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SAW_SPIKE_MAX, SPIKE_LEN } from '../../src/game/weapons';
import {
  SAW_CHAIN_MAX,
  sawChain,
  sawChainAlpha,
  SPIKE_GHOSTS,
  SPIKE_HALF,
  SPIKE_MAX,
  SPIKE_REST,
  spikeDrawLen,
  spikeGhost,
  spikeHalfWidth,
  spikeSpin,
  spikeStretch,
  spikeTriangle,
  type SpikePose,
} from '../../src/render/spikeSaw';

/** Drawn length: tip to the midpoint of the base. */
function drawnLen(t: Float32Array): number {
  const mx = ((t[2] ?? 0) + (t[4] ?? 0)) / 2;
  const my = ((t[3] ?? 0) + (t[5] ?? 0)) / 2;
  return Math.hypot((t[0] ?? 0) - mx, (t[1] ?? 0) - my);
}

describe('spike saw', () => {
  it('rest and max lengths match the sim', () => {
    expect(SPIKE_REST).toBe(SPIKE_LEN);
    expect(SPIKE_MAX).toBe(SAW_SPIKE_MAX);
  });

  it('drawn length tracks spikeLen from rest to full stretch', () => {
    const t = new Float32Array(6);
    for (const len of [24, 30, 42, 51.5, 60]) {
      spikeTriangle(100, 50, 3, -4, spikeDrawLen(len), spikeHalfWidth(spikeStretch(len)), t);
      expect(drawnLen(t)).toBeCloseTo(len, 4);
    }
    expect(spikeDrawLen(0)).toBe(SPIKE_REST);
    expect(spikeDrawLen(Number.NaN)).toBe(SPIKE_REST);
  });

  it('is centred on (x, y) and points along the tangent', () => {
    const t = spikeTriangle(10, 20, 0, 5, 40, 5, new Float32Array(6));
    const cx = ((t[0] ?? 0) + ((t[2] ?? 0) + (t[4] ?? 0)) / 2) / 2;
    const cy = ((t[1] ?? 0) + ((t[3] ?? 0) + (t[5] ?? 0)) / 2) / 2;
    expect(cx).toBeCloseTo(10);
    expect(cy).toBeCloseTo(20);
    expect(t[0]).toBeCloseTo(10);
    expect(t[1]).toBeCloseTo(40);
    expect(Math.hypot((t[2] ?? 0) - (t[4] ?? 0), (t[3] ?? 0) - (t[5] ?? 0))).toBeCloseTo(10);
  });

  it('stretch share runs 0 at rest to 1 at full saw and the tooth narrows', () => {
    expect(spikeStretch(SPIKE_REST)).toBe(0);
    expect(spikeStretch(SPIKE_MAX)).toBe(1);
    expect(spikeStretch(100)).toBe(1);
    expect(spikeHalfWidth(0)).toBe(SPIKE_HALF);
    expect(spikeHalfWidth(1)).toBeLessThan(SPIKE_HALF);
  });

  it('ghosts sit behind the spin direction and only spread while stretched', () => {
    const g: SpikePose = { x: 0, y: 0, vx: 0, vy: 0 };
    // Ship at origin, spike at (50, 0) moving +y: clockwise on screen, spin +1.
    expect(spikeSpin(0, 0, 50, 0, 0, 10)).toBe(1);
    expect(SPIKE_GHOSTS).toBe(2);
    spikeGhost(0, 0, 50, 0, 0, 10, 1, 1, g);
    expect(g.y).toBeLessThan(0);
    expect(Math.hypot(g.x, g.y)).toBeCloseTo(50);
    const g2: SpikePose = { x: 0, y: 0, vx: 0, vy: 0 };
    spikeGhost(0, 0, 50, 0, 0, 10, 2, 1, g2);
    expect(g2.y).toBeLessThan(g.y);
    spikeGhost(0, 0, 50, 0, 0, 10, 1, 0, g);
    expect(g.x).toBeCloseTo(50);
    expect(g.y).toBeCloseTo(0);
    // Counter clockwise spin puts the ghost on the other side.
    spikeGhost(0, 0, 50, 0, 0, -10, 1, 1, g);
    expect(g.y).toBeGreaterThan(0);
  });

  it('the renderer reads spikeLen for orbit spikes', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/const spikeLen = pool\.spikeLen/);
    expect(src).toMatch(/drawSawTooth\(x, y, vx, vy, spikeDrawLen\(/);
  });

  it('GW3: no ghost smear behind the ship; a chain line is drawn after the teeth', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const i = src.indexOf('function drawSawTooth(');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).not.toMatch(/spikeGhost/);
    expect(body).toMatch(/0xffffff/); // the white edge stays
    expect(src).toMatch(/drawSawChain\(\);\n    if \(restyled\)/);
  });
});

describe('saw chain line (GW3)', () => {
  const order = new Int32Array(SAW_CHAIN_MAX);

  it('an evenly spaced ring is a closed chain sorted by phase', () => {
    const ph = new Float32Array([Math.PI, 0.1, Math.PI * 1.5 + 0.1, Math.PI / 2 + 0.1]);
    expect(sawChain(ph, 4, order)).toBe(4);
    expect(Array.from(order.slice(0, 4))).toEqual([1, 3, 0, 2]);
  });

  it('a bar bunched toward the aim is an open chain from one end to the other', () => {
    // Teeth around the aim at angle 0 (wrapping through 2 pi): -0.6, -0.2, 0.2, 0.6.
    const ph = new Float32Array([0.2, -0.6, 0.6, -0.2]);
    expect(sawChain(ph, 4, order)).toBe(3);
    expect(Array.from(order.slice(0, 4))).toEqual([1, 3, 0, 2]);
  });

  it('handles junk and tiny counts without throwing', () => {
    expect(sawChain(new Float32Array([1]), 1, order)).toBe(0);
    expect(sawChain(new Float32Array(0), 0, order)).toBe(0);
    expect(sawChain(new Float32Array([Number.NaN, 1, 2]), 3, order)).toBeGreaterThan(0);
  });

  it('the chain shows only while the saw level is above 0, faint and brighter with the level', () => {
    expect(sawChainAlpha(0)).toBe(0);
    expect(sawChainAlpha(0.1)).toBeGreaterThan(0);
    expect(sawChainAlpha(1)).toBeGreaterThan(sawChainAlpha(0.2));
    expect(sawChainAlpha(1)).toBeLessThanOrEqual(0.6);
  });
});
