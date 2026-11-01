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
  NOVA_GLINTS,
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
  FLOW_NOISE_SLOPE,
  flowNoise,
  WHIRL_GAS_LAYERS,
  WHIRL_GAS_PTS,
  WHIRL_SHEAR,
  WHIRL_WISP_PTS,
  WHIRL_WISPS,
  WHIRL_WOBBLE,
  whirlFlowAngle,
  whirlGasAlpha,
  whirlGasSector,
  whirlGasWidth,
  whirlShear,
  whirlWisp,
  whirlWobble,
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

  it('the mote angle speed stays near the stated angular speed (shear and turbulence are bounded)', () => {
    // A mote at share u moves dt later to u - dt * (1 / infall); compare its angle change.
    const k = 11;
    const a = mote();
    const b = mote();
    whirlMote(0.5, 1, k, 300, a);
    const dt = 1e-3;
    whirlMote(0.5 + dt, 1, k, 300, b);
    const d = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
    const dd = Math.atan2(Math.sin(d), Math.cos(d));
    expect(Math.abs(dd / dt - whirlOmega(a.u))).toBeLessThan(0.5);
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
  it('GW5: about 2x the GW4 dust (120 to 140 motes), at most 192 particles in all, at most 3 gas layers, one draw per well', () => {
    expect(WHIRL_MOTES).toBeGreaterThanOrEqual(120);
    expect(WHIRL_MOTES).toBeLessThanOrEqual(140);
    expect(novaAddedParticles()).toBe(WHIRL_MOTES + WHIRL_SPARKS + WHIRL_WISPS + NOVA_GLINTS);
    expect(WHIRL_GAS_LAYERS).toBeLessThanOrEqual(3);
    expect(novaAddedParticles()).toBeLessThanOrEqual(NOVA_ADDED_PARTICLES_MAX);
    expect(NOVA_ADDED_PARTICLES_MAX).toBe(192);
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

  it('the nova fills gas once per layer and allocates no scratch per frame', () => {
    const body = bodyOf('drawNova');
    expect(body).toMatch(/whirlGasSector\(/);
    expect(body).not.toMatch(/new (Float32Array|Array|Float64Array)|\[\]/);
    expect(src).toMatch(/const gasPts = new Float32Array\(WHIRL_GAS_PTS \* 4\)/);
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

describe('GW3 fluid flow', () => {
  it('flow noise is deterministic, bounded and low frequency', () => {
    let prev = flowNoise(42, 0);
    for (let x = 0; x <= 40; x += 0.05) {
      const n = flowNoise(42, x);
      expect(n).toBe(flowNoise(42, x));
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
      expect(Math.abs(n - prev)).toBeLessThanOrEqual(FLOW_NOISE_SLOPE * 0.05 + 1e-9);
      prev = n;
    }
    expect(flowNoise(42, 3)).not.toBe(flowNoise(43, 3));
    expect(Number.isFinite(flowNoise(1, Number.NaN))).toBe(true);
  });

  it('shear is zero at the rim, bounded by WHIRL_SHEAR, changes over time and differs by well', () => {
    const vals: number[] = [];
    for (const t of [0, 1.3, 2.9, 7.4, 13]) {
      for (let u = 0; u <= 1; u += 0.1) {
        const s = whirlShear(5, u, t);
        expect(Math.abs(s)).toBeLessThanOrEqual(WHIRL_SHEAR + 1e-9);
        expect(s).toBe(whirlShear(5, u, t));
      }
      expect(whirlShear(5, 1, t)).toBeCloseTo(0, 12);
      vals.push(whirlShear(5, 0.1, t));
    }
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.05);
    expect(whirlShear(5, 0.2, 1)).not.toBe(whirlShear(6, 0.2, 1));
  });

  it('band wobble is zero at the rim and the core and bounded between', () => {
    for (const t of [0, 0.7, 4.1]) {
      expect(whirlWobble(3, 1, 1, t)).toBeCloseTo(0, 12);
      expect(whirlWobble(3, 1, 0, t)).toBeCloseTo(0, 12);
      for (let u = 0; u <= 1; u += 0.05) expect(Math.abs(whirlWobble(3, 1, u, t))).toBeLessThanOrEqual(WHIRL_WOBBLE + 1e-9);
    }
  });

  it('sheared bands still run rim to core, spiralling clockwise inward, for many wells and times', () => {
    const out = new Float32Array(WHIRL_BAND_PTS * 2);
    for (const id of [0, 1, 7, 33, 120]) {
      for (const t of [0, 0.4, 2.2, 5.7, 11.3, 29.9]) {
        for (let b = 0; b < WHIRL_BANDS; b++) {
          whirlBand(t, b, WHIRL_BANDS, 400, out, 1, id);
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
        }
      }
    }
  });

  it('the inner flow turns faster than the outer flow (differential rotation, rising smoothly)', () => {
    const dt = 1 / 60;
    let prev = 0;
    for (let u = 1; u >= 0; u -= 0.125) {
      const d = whirlFlowAngle(u, 2 + dt, 0, 4) - whirlFlowAngle(u, 2, 0, 4);
      expect(d).toBeGreaterThan(0);
      expect(whirlOmega(u)).toBeGreaterThanOrEqual(prev);
      prev = whirlOmega(u);
    }
  });

  it('turbulent motes still turn clockwise and fall inward for many wells, also in the calm swirl', () => {
    const a = mote();
    const b = mote();
    for (const id of [2, 19, 404]) {
      for (const rate of [1, CALM_RATE]) {
        for (let k = 0; k < WHIRL_MOTES; k += 3) {
          for (let f = 0; f < 120; f += 7) {
            const t = f / 30;
            whirlMote(t, id, k, 300, a, rate);
            whirlMote(t + 1 / 60, id, k, 300, b, rate);
            if (b.u > a.u) continue;
            expect(turnsClockwise(a.x, a.y, b.x, b.y)).toBe(true);
          }
        }
      }
    }
  });

  it('gas sectors fill the space behind each band, inside the reach, denser layers toward the core', () => {
    const out = new Float32Array(WHIRL_GAS_PTS * 4);
    expect(WHIRL_GAS_LAYERS).toBeGreaterThanOrEqual(1);
    for (let L = 0; L < WHIRL_GAS_LAYERS; L++) {
      expect(whirlGasAlpha(L)).toBeGreaterThanOrEqual(0.1);
      expect(whirlGasAlpha(L)).toBeLessThanOrEqual(0.25);
      if (L > 0) {
        expect(whirlGasAlpha(L)).toBeGreaterThan(whirlGasAlpha(L - 1));
        expect(whirlGasWidth(L, 0.3)).toBeLessThan(whirlGasWidth(L - 1, 0.3));
      }
      expect(whirlGasSector(1.1, 2, WHIRL_BANDS, L, 400, 8, out)).toBe(out);
      let maxR = 0;
      for (let k = 0; k < WHIRL_GAS_PTS * 2; k++) maxR = Math.max(maxR, Math.hypot(out[k * 2] ?? 0, out[k * 2 + 1] ?? 0));
      expect(maxR).toBeLessThanOrEqual(400 + 1e-3);
      // The trailing edge sits anticlockwise of (behind) the band edge at the same share.
      const k = 4;
      const j = WHIRL_GAS_PTS * 2 - 1 - k;
      expect(turnsClockwise(out[j * 2] ?? 0, out[j * 2 + 1] ?? 0, out[k * 2] ?? 0, out[k * 2 + 1] ?? 0)).toBe(true);
    }
    // Width stays under the band gap, so sectors of one layer never overlap.
    for (let u = 0; u <= 1; u += 0.1) expect(whirlGasWidth(0, u)).toBeLessThan(1);
  });

  it('wisps peel off, drift inward with the flow, stretch, and stay inside the reach', () => {
    const a = new Float32Array(WHIRL_WISP_PTS * 2);
    const b = new Float32Array(WHIRL_WISP_PTS * 2);
    expect(WHIRL_WISPS).toBeGreaterThan(0);
    let checked = 0;
    for (let k = 0; k < WHIRL_WISPS; k++) {
      for (const t of [0.2, 1.9, 4.4]) {
        const aa = whirlWisp(t, 6, k, 400, a);
        const ab = whirlWisp(t + 0.05, 6, k, 400, b);
        expect(aa).toBeGreaterThanOrEqual(0);
        expect(aa).toBeLessThanOrEqual(0.6);
        expect(whirlWisp(t, 6, k, 400, new Float32Array(WHIRL_WISP_PTS * 2))).toBe(aa);
        for (let q = 0; q < WHIRL_WISP_PTS; q++) expect(Math.hypot(a[q * 2] ?? 0, a[q * 2 + 1] ?? 0)).toBeLessThanOrEqual(400 * 1.06);
        const h = (WHIRL_WISP_PTS - 1) * 2;
        const ra = Math.hypot(a[h] ?? 0, a[h + 1] ?? 0);
        const rb = Math.hypot(b[h] ?? 0, b[h + 1] ?? 0);
        if (ab === 0 || rb > ra * 1.2) continue; // reborn between the samples
        expect(turnsClockwise(a[h] ?? 0, a[h + 1] ?? 0, b[h] ?? 0, b[h + 1] ?? 0)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(WHIRL_WISPS);
  });
});

describe('GW4 nova glints and shader tier', () => {
  it('glint spots stay inside the whirlpool and ride the flow', async () => {
    const m = await import('../../src/render/wellNova');
    const p = { x: 0, y: 0 };
    for (let i = 0; i < 20; i++) {
      m.novaGlintSpot(i / 20, (i * 7) % 20 / 20, 1.3, 4, 300, p);
      const r = Math.hypot(p.x, p.y);
      expect(r).toBeLessThanOrEqual(300 * m.NOVA_GLINT_U1 + 1e-6);
      expect(r).toBeGreaterThanOrEqual(300 * m.whirlShare(m.NOVA_GLINT_U0) - 1e-6);
    }
    expect(m.NOVA_GLINTS).toBeGreaterThan(0);
  });

  it('the renderer uses the shader quad on Standard and High and the geometry on Low', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const i = src.indexOf('function drawNova(');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).toMatch(/fluidShaderOn\(getEffectsTier\(\)\)/);
    expect(body).toMatch(/fluid\.set\(slot, fluidP\)/);
    expect(body).toMatch(/drawGlint\(/);
  });
});
