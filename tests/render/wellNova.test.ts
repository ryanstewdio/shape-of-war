// v31 supernova well: spiral geometry, inward shimmer, slot matching and the stream budget.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PARTICLE_CAP, TRAIL_SHED_FRAC, createParticlePool, emitTrail, type TrailSpec } from '../../src/render/particlePool';
import { stepEmitter } from '../../src/render/trails';
import { chromaOfRgb, hueDistance, hueOfRgb } from '../../src/render/emberFlame';
import { computePalette, NEON_DEFAULT, neonParams } from '../../src/render/neon';
import {
  createNovaState,
  NOVA_ADDED_PARTICLES_MAX,
  NOVA_CYCLE_SEC,
  NOVA_DRAWS_PER_WELL,
  NOVA_HUES,
  NOVA_SHIFT_SEC,
  novaAddedParticles,
  novaColour,
  novaCycleColour,
  novaCycleStops,
  novaArmPulse,
  novaCoreFlare,
  novaRingR,
  novaShimmerHue,
  novaWhite,
  NOVA_DRIFT_SPEED,
  NOVA_PULSE_RANGE,
  NOVA_SPIN,
  NOVA_WHITE,
  novaPulse,
  novaShift,
  novaStreamColour,
  NOVA_ARM_PTS,
  NOVA_ARMS,
  NOVA_DRIFT_LIFE,
  NOVA_EMIT_RATE,
  NOVA_ORBITERS,
  NOVA_PARTICLE_BUDGET,
  NOVA_SLOTS,
  novaAny,
  novaDriftParticle,
  novaEvent,
  novaGrow,
  novaOrbiter,
  novaSlotFor,
  novaSpiral,
  novaSteadyParticles,
  stepNovaState,
  type Orbiter,
} from '../../src/render/wellNova';

describe('nova spiral', () => {
  it('each arm winds outward from near the core to the reach, in place', () => {
    const out = new Float32Array(NOVA_ARM_PTS * 2);
    expect(novaSpiral(1.3, 0, 50, out)).toBe(out);
    let prev = -1;
    for (let k = 0; k < NOVA_ARM_PTS; k++) {
      const r = Math.hypot(out[k * 2] ?? 0, out[k * 2 + 1] ?? 0);
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
    expect(prev).toBeCloseTo(50);
    expect(Math.hypot(out[0] ?? 0, out[1] ?? 0)).toBeLessThan(10);
  });

  it('arms are evenly spaced and the spiral turns with time', () => {
    const a = novaSpiral(0, 0, 40, new Float32Array(NOVA_ARM_PTS * 2));
    const b = novaSpiral(0, 1, 40, new Float32Array(NOVA_ARM_PTS * 2));
    expect(NOVA_ARMS).toBeGreaterThanOrEqual(10);
    expect(NOVA_ARMS).toBeLessThanOrEqual(14);
    // Arm 1 is arm 0 turned by one arm spacing.
    const step = (Math.PI * 2) / NOVA_ARMS;
    expect(Math.atan2(b[1] ?? 0, b[0] ?? 0)).toBeCloseTo(Math.atan2(Math.sin(Math.atan2(a[1] ?? 0, a[0] ?? 0) + step), Math.cos(Math.atan2(a[1] ?? 0, a[0] ?? 0) + step)));
    const later = novaSpiral(0.5, 0, 40, new Float32Array(NOVA_ARM_PTS * 2));
    expect(Math.abs((later[0] ?? 0) - (a[0] ?? 0))).toBeGreaterThan(0.1);
  });

  it('shimmer points fall inward over time and twinkle within range', () => {
    const o: Orbiter = { x: 0, y: 0, a: 0, u: 0 };
    for (let k = 0; k < NOVA_ORBITERS; k++) {
      novaOrbiter(0.2, k, 60, o);
      const u0 = o.u;
      novaOrbiter(0.25, k, 60, o);
      if (u0 > 0.1) expect(o.u).toBeLessThan(u0);
      expect(o.a).toBeGreaterThanOrEqual(0.25);
      expect(o.a).toBeLessThanOrEqual(1);
      expect(Math.hypot(o.x, o.y)).toBeLessThanOrEqual(60 + 1e-6);
    }
  });

  it('grows in and settles at full size', () => {
    expect(novaGrow(0)).toBe(0);
    expect(novaGrow(10)).toBeCloseTo(1);
  });
});

describe('nova slots', () => {
  it('matches a well by position, follows it, frees it when the well is gone', () => {
    const s = createNovaState();
    expect(novaAny(s)).toBe(false);
    novaEvent(s, -1, 100, 50);
    expect(novaAny(s)).toBe(true);
    expect(novaSlotFor(s, 7, 300, 300, 24)).toBe(-1);
    const k = novaSlotFor(s, 7, 104, 50, 24);
    expect(k).toBeGreaterThanOrEqual(0);
    stepNovaState(s, 0.016);
    expect(novaSlotFor(s, 7, 140, 50, 24)).toBe(k);
    stepNovaState(s, 0.016);
    stepNovaState(s, 0.016);
    expect(novaAny(s)).toBe(false);
  });

  it('matches by numeric id and never holds more than NOVA_SLOTS', () => {
    const s = createNovaState();
    novaEvent(s, 3, 0, 0);
    expect(novaSlotFor(s, 3, 900, 900, 24)).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < NOVA_SLOTS + 3; i++) novaEvent(s, i, i * 100, 0);
    expect(s.age.length).toBe(NOVA_SLOTS);
  });
});

describe('nova emitter budget', () => {
  it('a nova keeps 60 to 90 stream particles alive, at most 96 in all, 3 wells under 15 percent of the cap', () => {
    expect(novaSteadyParticles()).toBeLessThanOrEqual(NOVA_PARTICLE_BUDGET);
    expect(novaSteadyParticles()).toBeGreaterThanOrEqual(60);
    expect(novaSteadyParticles()).toBeLessThanOrEqual(90);
    expect(novaAddedParticles()).toBeLessThanOrEqual(96);
    expect(novaSteadyParticles(NOVA_EMIT_RATE, NOVA_DRIFT_LIFE) * 3).toBeLessThan(PARTICLE_CAP * 0.15);
  });

  it('shimmer particles start near the core, fly outward at 60 to 120 u/s, live about 2 s, alternate colours', () => {
    const t: TrailSpec = { x: 0, y: 0, vx: 0, vy: 0, life: 0, drag: 0, colour: 0 };
    for (let seq = 1; seq < 40; seq++) {
      novaDriftParticle(t, 10, 20, 24, seq, 0xff00aa, 0xffffff);
      expect(Math.hypot(t.x - 10, t.y - 20)).toBeLessThanOrEqual(24);
      expect(Math.hypot(t.vx, t.vy)).toBeLessThanOrEqual(NOVA_DRIFT_SPEED[1] + 1e-6);
      expect(Math.hypot(t.vx, t.vy)).toBeGreaterThanOrEqual(NOVA_DRIFT_SPEED[0] - 1e-6);
      expect(NOVA_DRIFT_SPEED).toEqual([60, 120]);
      expect((t.x - 10) * t.vx + (t.y - 20) * t.vy).toBeGreaterThan(0);
      expect(t.life).toBeLessThanOrEqual(NOVA_DRIFT_LIFE);
      expect(t.life).toBeGreaterThan(1.75);
      expect(t.colour).toBe((seq & 1) === 0 ? 0xff00aa : 0xffffff);
    }
  });

  it('the stream never pushes a tier capped pool past the trail shed threshold', () => {
    const pool = createParticlePool(PARTICLE_CAP, 300);
    const em = { acc: 0 };
    const t: TrailSpec = { x: 0, y: 0, vx: 0, vy: 0, life: 0, drag: 0, colour: 0 };
    let seq = 0;
    for (let f = 0; f < 600; f++) {
      const n = stepEmitter(em, NOVA_EMIT_RATE * 40, 1 / 60);
      for (let k = 0; k < n; k++) {
        novaDriftParticle(t, 0, 0, 24, ++seq, 1, 2);
        if (!emitTrail(pool, t)) break;
      }
    }
    expect(pool.live).toBeLessThanOrEqual(Math.floor(300 * TRAIL_SHED_FRAC));
  });
});

// Look v32: the multicolour supernova (hue cycle, the 1 s shift from red, halo breathing, budget).
describe('nova colour cycle (look v32)', () => {
  const pal = computePalette(neonParams(NEON_DEFAULT).saturation);
  const stops = novaCycleStops(pal, new Uint32Array(NOVA_HUES));

  it('an arm cycles through at least six distinct hues along its length', () => {
    const kept: number[] = [];
    for (let k = 0; k < NOVA_ARM_PTS; k++) {
      const c = novaCycleColour(stops, k / (NOVA_ARM_PTS - 1), 0.37);
      const h = hueOfRgb(c);
      if (chromaOfRgb(c) > 0.3 && kept.every((x) => hueDistance(x, h) >= 25)) kept.push(h);
    }
    expect(kept.length).toBeGreaterThanOrEqual(6);
  });

  it('slides one full cycle per 2 s', () => {
    expect(NOVA_CYCLE_SEC).toBe(2);
    for (const u of [0, 0.3, 0.71]) {
      expect(novaCycleColour(stops, u, 0.4)).toBe(novaCycleColour(stops, u, 0.4 + NOVA_CYCLE_SEC));
      expect(novaCycleColour(stops, u, 0.4)).not.toBe(novaCycleColour(stops, u, 0.4 + NOVA_CYCLE_SEC / 2));
    }
  });

  it('turns from the well red into the cycle over 1 s', () => {
    expect(novaShift(0)).toBe(0);
    expect(novaShift(NOVA_SHIFT_SEC / 2)).toBeCloseTo(0.5);
    expect(novaShift(NOVA_SHIFT_SEC)).toBe(1);
    expect(novaColour(stops, pal.red, 0.6, 0.2, 0)).toBe(pal.red);
    expect(novaColour(stops, pal.red, 0.6, 0.2, 1)).toBe(novaCycleColour(stops, 0.6, 0.2));
  });

  it('the pull ring sits at exactly the pull radius with no pulse', () => {
    expect(novaRingR(320)).toBe(320);
    expect(novaRingR(400)).toBe(400);
    expect(novaRingR(-3)).toBe(0);
  });

  it('swirl points pulse in brightness; stream particles take their own place on the cycle', () => {
    for (let k = 0; k < NOVA_ORBITERS; k++) {
      const vals = [0, 0.2, 0.4, 0.6, 0.8].map((t) => novaPulse(t, k));
      expect(Math.min(...vals)).toBeGreaterThanOrEqual(0.35 - 1e-9);
      expect(Math.max(...vals)).toBeLessThanOrEqual(1 + 1e-9);
      expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.1);
    }
    const cols = new Set<number>();
    for (let seq = 1; seq <= 24; seq++) cols.add(novaStreamColour(stops, pal.red, seq, 0.5, 1));
    expect(cols.size).toBeGreaterThanOrEqual(NOVA_HUES);
    expect(novaStreamColour(stops, pal.red, 5, 0.5, 0)).toBe(pal.red);
  });

  it('budget: a nova adds at most 96 particles and one extra draw per well', () => {
    expect(novaAddedParticles()).toBe(NOVA_ORBITERS + novaSteadyParticles());
    expect(novaAddedParticles()).toBeLessThanOrEqual(NOVA_ADDED_PARTICLES_MAX);
    expect(NOVA_ADDED_PARTICLES_MAX).toBe(96);
    expect(NOVA_DRAWS_PER_WELL).toBe(1);
  });
});

// Look v33 (GW1): the white tornado time bomb.
describe('nova tornado (look v33)', () => {
  const pal = computePalette(neonParams(NEON_DEFAULT).saturation);
  const stops = novaCycleStops(pal, new Uint32Array(NOVA_HUES));

  it('the base white is hsl 0 0 95 percent and the well turns to it over the shift', () => {
    expect(NOVA_WHITE).toBe(0xf2f2f2);
    expect(novaWhite(pal.red, 0)).toBe(pal.red);
    expect(novaWhite(pal.red, 1)).toBe(NOVA_WHITE);
  });

  it('turns at 1.5 rad/s: the arm pattern after one second is the start turned by 1.5 rad', () => {
    expect(NOVA_SPIN).toBe(1.5);
    const a = novaSpiral(0, 0, 40, new Float32Array(NOVA_ARM_PTS * 2));
    const b = novaSpiral(1, 0, 40, new Float32Array(NOVA_ARM_PTS * 2));
    const k = NOVA_ARM_PTS - 1;
    const d = Math.atan2(b[k * 2 + 1] ?? 0, b[k * 2] ?? 0) - Math.atan2(a[k * 2 + 1] ?? 0, a[k * 2] ?? 0);
    expect(Math.cos(d)).toBeCloseTo(Math.cos(1.5));
    expect(Math.sin(d)).toBeCloseTo(Math.sin(1.5));
  });

  it('arms pulse in brightness within range and the core flares', () => {
    const vals = Array.from({ length: 60 }, (_, i) => novaArmPulse(i / 30, 0));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(NOVA_PULSE_RANGE[0] - 1e-9);
    expect(Math.max(...vals)).toBeLessThanOrEqual(NOVA_PULSE_RANGE[1] + 1e-9);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.3);
    expect(novaCoreFlare(0, 0)).toBeGreaterThan(novaCoreFlare(3, 0));
    expect(novaCoreFlare(0, 0)).toBeLessThanOrEqual(1);
  });

  it('the shimmer cycles through all 8 neon hues in turn', () => {
    expect(NOVA_HUES).toBeGreaterThanOrEqual(8);
    const idx = new Set<number>();
    for (let s = 0; s < NOVA_HUES; s++) idx.add(novaShimmerHue(s));
    expect(idx.size).toBe(NOVA_HUES);
    expect(novaShimmerHue(-1)).toBe(NOVA_HUES - 1);
    const hues: number[] = [];
    for (let s = 0; s < NOVA_HUES; s++) {
      const c = novaStreamColour(stops, pal.red, s, 0.3, 1);
      const h = hueOfRgb(c);
      if (chromaOfRgb(c) > 0.3 && hues.every((x) => hueDistance(x, h) >= 15)) hues.push(h);
    }
    expect(hues.length).toBeGreaterThanOrEqual(7);
  });

  it('the renderer draws one ring at exactly the pull radius, no pulse, and never clears per nova', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const i = src.indexOf('function drawNova(');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).not.toMatch(/novaHaloR|\.clear\(/);
    expect(body).toMatch(/g\.circle\(x, y, novaRingR\(pullR\)\)/);
    expect(NOVA_DRAWS_PER_WELL).toBe(1);
    expect(src).toMatch(/wellInNova\(w, i\) \? NOVA_RADIUS : PULL_RADIUS/);
  });
});
