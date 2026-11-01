// GW4 fluid whirlpool: flow parameter helpers and the shader source.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FLUID_CW,
  FLUID_SPEED,
  FLUID_FRAGMENT,
  FLUID_UNIFORMS,
  FLUID_VERTEX,
  fluidDensity,
  fluidEdgeFade,
  fluidHaze,
  FLUID_VISUAL,
  FLUID_HAZE,
  fluidOmega,
  fluidPhaseWeights,
  fluidShaderOn,
  fluidSourceAngle,
  fluidSourceRadius,
  rgbUnit,
} from '../../src/render/wellFluid';
import { WHIRL_VISUAL } from '../../src/render/wellNova';
import { turnsClockwise } from '../../src/render/wellNova';

describe('fluid flow helpers', () => {
  it('angular speed rises toward the core: GW5 1.3x, 1.3 rad/s at the edge, about 6.1 near the core', () => {
    expect(FLUID_SPEED).toBe(1.3);
    expect(fluidOmega(1)).toBeCloseTo(1.3, 5);
    expect(fluidOmega(0.12)).toBeCloseTo(4.7 * 1.3, 1);
    let prev = fluidOmega(1);
    for (let u = 0.95; u >= 0; u -= 0.05) {
      const w = fluidOmega(u);
      expect(w).toBeGreaterThan(prev);
      prev = w;
    }
    expect(Number.isFinite(fluidOmega(0))).toBe(true);
    expect(fluidOmega(1, 2)).toBeCloseTo(2.6, 5);
  });

  it('turns clockwise on screen with y down', () => {
    expect(FLUID_CW).toBe(1);
    // Gas now at angle 0 came from a smaller angle: it moved toward increasing atan2, which is
    // clockwise on a y down screen.
    const src = fluidSourceAngle(0, 0.5, 0.1);
    expect(src).toBeLessThan(0);
    expect(turnsClockwise(Math.cos(src), Math.sin(src), 1, 0)).toBe(true);
  });

  it('drifts inward: gas came from further out', () => {
    expect(fluidSourceRadius(0.5, 0)).toBeCloseTo(0.5);
    expect(fluidSourceRadius(0.5, 0.5)).toBeGreaterThan(0.5);
    expect(fluidSourceRadius(0.5, 1)).toBeGreaterThan(fluidSourceRadius(0.5, 0.5));
  });

  it('fades to nothing at the pull radius edge and is densest at the core', () => {
    expect(fluidEdgeFade(0)).toBe(1);
    expect(fluidEdgeFade(0.5)).toBe(1);
    expect(fluidEdgeFade(1)).toBe(0);
    expect(fluidEdgeFade(1.4)).toBe(0);
    expect(fluidEdgeFade(0.85)).toBeGreaterThan(0);
    expect(fluidEdgeFade(0.85)).toBeLessThan(1);
    expect(fluidEdgeFade(0.8)).toBeGreaterThan(fluidEdgeFade(0.9));
    expect(fluidDensity(0)).toBeGreaterThan(fluidDensity(0.5));
    expect(fluidDensity(0.5)).toBeGreaterThan(fluidDensity(1));
  });

  it('the two advection cycles cross fade with weights summing to 1, each 0 at its restart', () => {
    const out = new Float32Array(4);
    for (let t = 0; t < 5; t += 0.07) {
      fluidPhaseWeights(t, out);
      expect((out[1] ?? 0) + (out[3] ?? 0)).toBeCloseTo(1, 5);
    }
    fluidPhaseWeights(0, out);
    expect(out[0]).toBeCloseTo(0);
    expect(out[1]).toBeCloseTo(0);
    expect(out[3]).toBeCloseTo(1);
  });

  it('Standard and High use the shader, Low keeps the geometry', () => {
    expect(fluidShaderOn('low')).toBe(false);
    expect(fluidShaderOn('standard')).toBe(true);
    expect(fluidShaderOn('high')).toBe(true);
  });

  it('colours unpack to unit rgb in place', () => {
    const o = rgbUnit(0xff8000, new Float32Array(3));
    expect(o[0]).toBeCloseTo(1);
    expect(o[1]).toBeCloseTo(128 / 255);
    expect(o[2]).toBe(0);
  });
});

describe('GW6 compact disc', () => {
  it('draws the gas disc at 65 percent of the pull radius with a faint 15 percent haze beyond', () => {
    expect(WHIRL_VISUAL).toBe(0.65);
    expect(FLUID_VISUAL).toBe(0.65);
    expect(FLUID_HAZE).toBe(0.15);
    expect(fluidHaze(0.5)).toBe(0);
    expect(fluidHaze(0.65)).toBe(0);
    expect(fluidHaze(0.66)).toBeGreaterThan(0.14);
    expect(fluidHaze(0.66)).toBeLessThanOrEqual(0.15);
    expect(fluidHaze(0.8)).toBeLessThan(fluidHaze(0.7));
    expect(fluidHaze(1)).toBe(0);
    expect(fluidHaze(Number.NaN)).toBe(0);
  });

  it('the shader maps the quad to the visual disc and keeps the clockwise spin', () => {
    expect(FLUID_FRAGMENT).toMatch(/vec2 q = vPos \/ 0\.65;/);
    expect(FLUID_FRAGMENT).not.toMatch(/layer\(vPos/);
  });
});

describe('fluid shader source', () => {
  it('declares every expected uniform and is a well formed GLSL string', () => {
    for (const u of FLUID_UNIFORMS) expect(FLUID_FRAGMENT).toMatch(new RegExp(`uniform (float|vec3) ${u};`));
    for (const u of ['uTime', 'uRadius', 'uSpin']) expect(FLUID_UNIFORMS).toContain(u);
    for (const src of [FLUID_VERTEX, FLUID_FRAGMENT]) {
      expect(src).toMatch(/void main\(void\)/);
      expect((src.match(/\{/g) ?? []).length).toBe((src.match(/\}/g) ?? []).length);
      expect((src.match(/\(/g) ?? []).length).toBe((src.match(/\)/g) ?? []).length);
      expect(src).not.toMatch(/\$\{|undefined|NaN/);
      expect(src).not.toMatch(/#version/);
    }
    expect(FLUID_VERTEX).toMatch(/in vec2 aPosition;/);
    expect(FLUID_VERTEX).toMatch(/out vec2 vPos;/);
    expect(FLUID_FRAGMENT).toMatch(/in vec2 vPos;/);
    expect(FLUID_FRAGMENT).toMatch(/out vec4 finalColor;/);
    // Float literals only where GLSL ES 1.0 needs them: no bare integer in a float multiply.
    expect(FLUID_FRAGMENT).not.toMatch(/[^.\w]1 \* w/);
    // 3 octaves of value noise and a domain warp.
    expect(FLUID_FRAGMENT).toMatch(/i < 3;/);
    expect(FLUID_FRAGMENT).toMatch(/warp/);
  });

  it('the view draws one quad per nova and allocates nothing per frame', () => {
    const src = readFileSync(new URL('../../src/render/wellFluidView.ts', import.meta.url), 'utf8');
    const i = src.indexOf('function set(');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).not.toMatch(/new |\[\]|\{ /);
    expect(src).toMatch(/for \(let k = 0; k < NOVA_SLOTS; k\+\+\)/);
    expect(src).toMatch(/new Uint32Array\(\[0, 1, 2, 0, 2, 3\]\)/);
  });
});
