// Supernova well: slot matching, the colour cycle, and the GW2 whirlpool (clockwise on screen,
// inward motion, angular speed, budget, one Graphics rebuild per frame, no pull ring).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chromaOfRgb, hueDistance, hueOfRgb } from '../../src/render/emberFlame';
import { computePalette, NEON_DEFAULT, neonParams } from '../../src/render/neon';
import {
  CALM_RATE,
  createNovaState,
  NOVA_ADDED_PARTICLES_MAX,
  NOVA_CYCLE_SEC,
  NOVA_DRAWS_PER_WELL,
  NOVA_HUES,
  NOVA_SHIFT_SEC,
  NOVA_SLOTS,
  NOVA_WHITE,
  novaAddedParticles,
  novaAny,
  novaColour,
  novaCoreFlare,
  novaCycleColour,
  novaCycleStops,
  novaEvent,
  novaGrow,
  novaPulse,
  novaShift,
  novaShimmerHue,
  novaSlotFor,
  novaStreamColour,
  novaWhite,
  screenTurn,
  stepNovaState,
  turnsClockwise,
  WHIRL_BAND_PTS,
  WHIRL_BANDS,
  WHIRL_CORE,
  WHIRL_CW,
  WHIRL_MOTES,
  WHIRL_SPARKS,
  whirlAngle,
  whirlBand,
  whirlDashU,
  whirlMote,
  whirlOmega,
  whirlRadius,
  type Mote,
} from '../../src/render/wellNova';

const mote = (): Mote => ({ x: 0, y: 0, u: 0, a: 0 });

describe('whirlpool direction', () => {
  it('clockwise on a y down screen is a positive cross product', () => {
    // +x (east) to +y (down, south) is a clockwise quarter turn on screen.
    expect(turnsClockwise(1, 0, 0, 1)).toBe(true);
    expect(turnsClockwise(0, 1, 1, 0)).toBe(false);
    expect(screenTurn(1, 0, 0, 1)).toBeGreaterThan(0);
    expect(WHIRL_CW).toBe(1);
  });

  it('every mote turns clockwise on screen and falls inward from frame to frame', () => {
    const a = mote();
    const b = mote();
    let checked = 0;
    for (let k = 0; k < WHIRL_MOTES; k++) {
      for (const t of [0.13, 1.7, 5.21]) {
        whirlMote(t, 3, k, 400, a);
        whirlMote(t + 1 / 60, 3, k, 400, b);
        if (b.u > a.u) continue; // respawned at the rim this frame
        expect(turnsClockwise(a.x, a.y, b.x, b.y)).toBe(true);
        expect(b.u).toBeLessThan(a.u);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(WHIRL_MOTES * 2);
  });

  it('the calm pre nova swirl turns the same way, but slower', () => {
    const a = mote();
    const b = mote();
    whirlMote(0.4, 9, 2, 50, a, CALM_RATE);
    whirlMote(0.4 + 1 / 60, 9, 2, 50, b, CALM_RATE);
    if (b.u < a.u) expect(turnsClockwise(a.x, a.y, b.x, b.y)).toBe(true);
    expect(whirlOmega(0.5, CALM_RATE)).toBeLessThan(whirlOmega(0.5));
  });
});

describe('whirlpool flow speed', () => {
  it('turns about 1 rad/s at the rim and at least 4 rad/s at the core, rising inward', () => {
    expect(whirlOmega(1)).toBeCloseTo(1, 5);
    expect(whirlOmega(0)).toBeGreaterThanOrEqual(4);
    let prev = whirlOmega(1);
    for (let u = 0.9; u >= 0; u -= 0.1) {
      const w = whirlOmega(u);
      expect(w).toBeGreaterThan(prev);
      prev = w;
    }
  });

  it('the angle formula matches the stated angular speed (finite difference)', () => {
    // A mote at share u moves dt later to u - dt * (1 / infall); compare its angle change.
    const k = 11;
    const a = mote();
    const b = mote();
    whirlMote(0.5, 1, k, 300, a);
    const dt = 1e-3;
    whirlMote(0.5 + dt, 1, k, 300, b);
    const d = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
    const dd = Math.atan2(Math.sin(d), Math.cos(d));
    expect(dd / dt).toBeCloseTo(whirlOmega(a.u), 1);
  });
});

describe('whirlpool geometry', () => {
  it('bands run from the rim (the reach) to the core share, and spiral clockwise inward', () => {
    const out = new Float32Array(WHIRL_BAND_PTS * 2);
    expect(whirlBand(0.7, 1, WHIRL_BANDS, 400, out)).toBe(out);
    expect(Math.hypot(out[0] ?? 0, out[1] ?? 0)).toBeCloseTo(400, 3);
    const last = WHIRL_BAND_PTS - 1;
    expect(Math.hypot(out[last * 2] ?? 0, out[last * 2 + 1] ?? 0)).toBeCloseTo(400 * WHIRL_CORE, 3);
    for (let k = 1; k < WHIRL_BAND_PTS; k++) {
      const ax = out[(k - 1) * 2] ?? 0;
      const ay = out[(k - 1) * 2 + 1] ?? 0;
      const bx = out[k * 2] ?? 0;
      const by = out[k * 2 + 1] ?? 0;
      expect(Math.hypot(bx, by)).toBeLessThan(Math.hypot(ax, ay));
      expect(turnsClockwise(ax, ay, bx, by)).toBe(true);
    }
  });

  it('three to four bands, evenly spaced, the pattern turning clockwise with time', () => {
    expect(WHIRL_BANDS).toBeGreaterThanOrEqual(3);
    expect(WHIRL_BANDS).toBeLessThanOrEqual(4);
    const a = whirlBand(0, 0, WHIRL_BANDS, 100, new Float32Array(WHIRL_BAND_PTS * 2));
    const b = whirlBand(0, 1, WHIRL_BANDS, 100, new Float32Array(WHIRL_BAND_PTS * 2));
    const d = Math.atan2(b[1] ?? 0, b[0] ?? 0) - Math.atan2(a[1] ?? 0, a[0] ?? 0);
    expect(Math.cos(d)).toBeCloseTo(Math.cos((Math.PI * 2) / WHIRL_BANDS));
    const later = whirlBand(0.1, 0, WHIRL_BANDS, 100, new Float32Array(WHIRL_BAND_PTS * 2));
    expect(turnsClockwise(a[0] ?? 0, a[1] ?? 0, later[0] ?? 0, later[1] ?? 0)).toBe(true);
  });

  it('dashes slide down the bands toward the core', () => {
    const u0 = whirlDashU(0.2, 0, 0);
    const u1 = whirlDashU(0.25, 0, 0);
    expect(u1).toBeLessThan(u0);
    expect(u0).toBeGreaterThanOrEqual(0);
    expect(u0).toBeLessThanOrEqual(1);
  });

  it('motes stay within the reach, respawn at the rim and are deterministic from id and clock', () => {
    const a = mote();
    const b = mote();
    let rimSeen = false;
    for (let f = 0; f < 240; f++) {
      const t = f / 60;
      whirlMote(t, 5, 0, 320, a);
      expect(Math.hypot(a.x, a.y)).toBeLessThanOrEqual(320 * 1.06 + 1e-6);
      expect(a.a).toBeGreaterThanOrEqual(0);
      expect(a.a).toBeLessThanOrEqual(1);
      if (a.u > 0.95) rimSeen = true;
      whirlMote(t, 5, 0, 320, b);
      expect(b).toEqual(a);
    }
    expect(rimSeen).toBe(true);
    whirlMote(1, 6, 0, 320, b);
    whirlMote(1, 5, 0, 320, a);
    expect(b.x).not.toBe(a.x);
  });

  it('the radius and angle helpers are finite for junk input', () => {
    expect(whirlRadius(Number.NaN, 100)).toBeCloseTo(100);
    expect(Number.isFinite(whirlAngle(Number.NaN, Number.NaN, 0))).toBe(true);
  });

  it('grows in and settles at full size', () => {
    expect(novaGrow(0)).toBe(0);
    expect(novaGrow(10)).toBeCloseTo(1);
  });
});

describe('whirlpool budget and renderer', () => {
  it('60 to 90 dust motes, at most 96 particles in all, one draw per well', () => {
    expect(WHIRL_MOTES).toBeGreaterThanOrEqual(60);
    expect(WHIRL_MOTES).toBeLessThanOrEqual(90);
    expect(novaAddedParticles()).toBe(WHIRL_MOTES + WHIRL_SPARKS);
    expect(novaAddedParticles()).toBeLessThanOrEqual(NOVA_ADDED_PARTICLES_MAX);
    expect(NOVA_ADDED_PARTICLES_MAX).toBe(96);
    expect(NOVA_DRAWS_PER_WELL).toBe(1);
  });

  const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
  const bodyOf = (name: string): string => {
    const i = src.indexOf(`function ${name}(`);
    return src.slice(i, src.indexOf('\n  }\n', i));
  };

  it('the nova draws no pull ring, never clears, and reaches the sim pull radius of the entity', () => {
    const body = bodyOf('drawNova');
    expect(body).not.toMatch(/\.clear\(|novaRingR|pullR\)\)\.stroke/);
    expect(body).toMatch(/const reach = Math\.max\(r, pullR\) \* grow/);
    expect(src).toMatch(/wellInNova\(w, i\) \? NOVA_RADIUS : PULL_RADIUS/);
  });

  it('the well layer is cleared once per frame and nothing else clears it', () => {
    const clears = src.match(/novaG\.clear\(\)/g) ?? [];
    expect(clears.length).toBe(1);
    for (const f of ['drawNova', 'drawCalmSwirl', 'drawWellFx']) expect(bodyOf(f)).not.toMatch(/\.clear\(/);
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

describe('nova colour', () => {
  const pal = computePalette(neonParams(NEON_DEFAULT).saturation);
  const stops = novaCycleStops(pal, new Uint32Array(NOVA_HUES));

  it('the base white is hsl 0 0 95 percent and the well turns to it over the shift', () => {
    expect(NOVA_WHITE).toBe(0xf2f2f2);
    expect(novaWhite(pal.red, 0)).toBe(pal.red);
    expect(novaWhite(pal.red, 1)).toBe(NOVA_WHITE);
  });

  it('slides one full cycle per 2 s and turns from the well red over 1 s', () => {
    expect(NOVA_CYCLE_SEC).toBe(2);
    expect(novaCycleColour(stops, 0.3, 0.4)).toBe(novaCycleColour(stops, 0.3, 0.4 + NOVA_CYCLE_SEC));
    expect(novaShift(0)).toBe(0);
    expect(novaShift(NOVA_SHIFT_SEC)).toBe(1);
    expect(novaColour(stops, pal.red, 0.6, 0.2, 0)).toBe(pal.red);
  });

  it('the shimmer sparks cycle through the neon hues and pulse', () => {
    const hues: number[] = [];
    for (let s = 0; s < NOVA_HUES; s++) {
      expect(novaShimmerHue(s)).toBe(s);
      const c = novaStreamColour(stops, pal.red, s, 0.3, 1);
      const h = hueOfRgb(c);
      if (chromaOfRgb(c) > 0.3 && hues.every((x) => hueDistance(x, h) >= 15)) hues.push(h);
    }
    expect(hues.length).toBeGreaterThanOrEqual(7);
    const vals = [0, 0.2, 0.4, 0.6, 0.8].map((t) => novaPulse(t, 1));
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.1);
  });

  it('the core flares at the eruption, then settles', () => {
    expect(novaCoreFlare(0, 0)).toBeGreaterThan(novaCoreFlare(3, 0));
    expect(novaCoreFlare(0, 0)).toBeLessThanOrEqual(1);
  });
});
