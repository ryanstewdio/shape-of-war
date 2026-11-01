// GW5 galaxy whirlpool: 1.3x flow, spiral arms, twice the star dust streaming along the arms.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FLUID_DRIFT, FLUID_FRAGMENT, FLUID_UNIFORMS, fluidSourceRadius } from '../../src/render/wellFluid';
import {
  GALAXY_ARM_SHARE,
  GALAXY_ARM_SPREAD,
  GALAXY_ARMS,
  GALAXY_SPEED,
  GALAXY_TWINKLE,
  NOVA_ADDED_PARTICLES_MAX,
  WHIRL_MOTES,
  WHIRL_SHEAR,
  WHIRL_TURB_A,
  galaxyArmAngle,
  galaxyArmBase,
  galaxyArmMote,
  galaxyArmUniform,
  galaxyArmWave,
  galaxyTwinkle,
  novaAddedParticles,
  turnsClockwise,
  whirlMote,
  whirlOmega,
  whirlShare,
  type Mote,
} from '../../src/render/wellNova';

function wrapPi(a: number): number {
  const t = Math.PI * 2;
  const v = a - Math.floor(a / t) * t;
  return v > Math.PI ? v - t : v;
}

describe('galaxy flow speed', () => {
  it('runs 1.3x at the core and the rim', () => {
    expect(GALAXY_SPEED).toBe(1.3);
    for (const u of [0, 0.5, 1]) expect(whirlOmega(u, GALAXY_SPEED)).toBeCloseTo(1.3 * whirlOmega(u), 9);
    expect(fluidSourceRadius(0.5, 1)).toBeCloseTo(0.5 * Math.exp(FLUID_DRIFT * 1.3), 9);
  });

  it('the dust budget is about 2x GW4 and within 192 per nova', () => {
    expect(WHIRL_MOTES).toBe(128);
    expect(novaAddedParticles()).toBeLessThanOrEqual(NOVA_ADDED_PARTICLES_MAX);
    expect(NOVA_ADDED_PARTICLES_MAX).toBeLessThanOrEqual(192);
  });
});

describe('galaxy arms', () => {
  it('2 to 4 arms, a hashed fixed base per well', () => {
    expect(GALAXY_ARMS).toBeGreaterThanOrEqual(2);
    expect(GALAXY_ARMS).toBeLessThanOrEqual(4);
    expect(galaxyArmBase(5)).toBe(galaxyArmBase(5));
    expect(galaxyArmBase(5)).not.toBe(galaxyArmBase(6));
    expect(galaxyArmBase(5)).toBeGreaterThanOrEqual(0);
    expect(galaxyArmBase(5)).toBeLessThan(Math.PI * 2);
  });

  it('the arms turn clockwise on screen and wind inward as a log spiral', () => {
    const b = galaxyArmBase(3);
    const a0 = galaxyArmAngle(0, 0.6, 1, b);
    const a1 = galaxyArmAngle(0, 0.6, 1 + 1 / 60, b);
    expect(turnsClockwise(Math.cos(a0), Math.sin(a0), Math.cos(a1), Math.sin(a1))).toBe(true);
    expect(galaxyArmAngle(0, 0.2, 1, b)).toBeGreaterThan(galaxyArmAngle(0, 0.9, 1, b));
    expect(galaxyArmAngle(1, 0.5, 1, b) - galaxyArmAngle(0, 0.5, 1, b)).toBeCloseTo((Math.PI * 2) / GALAXY_ARMS, 9);
  });

  it('the shader uniform is arm 0 at the rim, wrapped to 0 to 2 pi', () => {
    const b = galaxyArmBase(2);
    for (let t = 0; t < 500; t += 37.3) {
      const u = galaxyArmUniform(t, b);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(Math.PI * 2);
      expect(Math.abs(wrapPi(u - galaxyArmAngle(0, 1, t, b)))).toBeLessThan(1e-6);
    }
  });

  it('the arm wave is 1 on a crest and 0 between arms', () => {
    const b = galaxyArmBase(1);
    const crest = galaxyArmAngle(1, 0.5, 2, b);
    expect(galaxyArmWave(crest, 0.5, 2, b)).toBeCloseTo(1, 9);
    expect(galaxyArmWave(crest + Math.PI / GALAXY_ARMS, 0.5, 2, b)).toBeCloseTo(0, 9);
  });

  it('most motes start on an arm and stay on it as they fall in', () => {
    let onArm = 0;
    for (let k = 0; k < WHIRL_MOTES; k++) if (galaxyArmMote(k)) onArm++;
    expect(onArm / WHIRL_MOTES).toBeCloseTo(GALAXY_ARM_SHARE, 2);
    const id = 11;
    const base = galaxyArmBase(id);
    const m: Mote = { x: 0, y: 0, u: 0, a: 0 };
    const bound = GALAXY_ARM_SPREAD / 2 + WHIRL_SHEAR + WHIRL_TURB_A + 1e-6;
    let armWave = 0;
    let fieldWave = 0;
    let nArm = 0;
    let nField = 0;
    for (let t = 0; t < 6; t += 0.31) {
      for (let k = 0; k < WHIRL_MOTES; k++) {
        whirlMote(t, id, k, 300, m, GALAXY_SPEED, GALAXY_ARMS, base);
        const th = Math.atan2(m.y, m.x);
        const s = whirlShare(m.u);
        const wv = galaxyArmWave(th, s, t, base);
        if (galaxyArmMote(k)) {
          const j = k % GALAXY_ARMS;
          expect(Math.abs(wrapPi(th - galaxyArmAngle(j, s, t, base)))).toBeLessThanOrEqual(bound);
          armWave += wv;
          nArm++;
        } else {
          fieldWave += wv;
          nField++;
        }
      }
    }
    expect(armWave / nArm).toBeGreaterThan(fieldWave / nField + 0.2);
  });

  it('arm motes still turn clockwise and fall inward', () => {
    const base = galaxyArmBase(4);
    const a: Mote = { x: 0, y: 0, u: 0, a: 0 };
    const b: Mote = { x: 0, y: 0, u: 0, a: 0 };
    let checked = 0;
    for (let k = 0; k < WHIRL_MOTES; k += 5) {
      for (let t = 0.2; t < 3; t += 0.53) {
        whirlMote(t, 4, k, 300, a, GALAXY_SPEED, GALAXY_ARMS, base);
        whirlMote(t + 1 / 60, 4, k, 300, b, GALAXY_SPEED, GALAXY_ARMS, base);
        if (b.u > a.u) continue; // respawned at the rim
        expect(turnsClockwise(a.x, a.y, b.x, b.y)).toBe(true);
        expect(b.u).toBeLessThan(a.u);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('the twinkle is deterministic and bounded', () => {
    for (let t = 0; t < 4; t += 0.013) {
      const v = galaxyTwinkle(3, 9, t);
      expect(v).toBe(galaxyTwinkle(3, 9, t));
      expect(v).toBeGreaterThanOrEqual(1 - GALAXY_TWINKLE - 1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe('galaxy shader and renderer', () => {
  it('the shader has the arms, dust lanes, bulge, glow pass and the 1.3x flow', () => {
    expect(FLUID_UNIFORMS).toContain('uArm');
    expect(FLUID_FRAGMENT).toMatch(/uniform float uArm;/);
    expect(FLUID_FRAGMENT).toMatch(/float w = 1\.3 \* uSpin/);
    for (const k of ['armPh', 'lane', 'aBulge', 'glow', 'log(1.0 / sr)']) expect(FLUID_FRAGMENT).toContain(k);
  });

  it('the view sets uArm in place and the renderer feeds the galaxy flow', () => {
    const view = readFileSync(new URL('../../src/render/wellFluidView.ts', import.meta.url), 'utf8');
    expect(view).toMatch(/u\.uArm = p\.arm;/);
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const i = src.indexOf('function drawNova(');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).toMatch(/const rate = GALAXY_SPEED;/);
    expect(body).toMatch(/fluidP\.arm = galaxyArmUniform\(timeSec, armBase, rate\)/);
    expect(body).toMatch(/whirlMote\(timeSec, id, k, vis, novaMote, rate, GALAXY_ARMS, armBase\)/);
    expect(body).toMatch(/whirlBand\(timeSec, b, WHIRL_BANDS, vis, novaArm, rate, id\)/);
    expect(body).not.toMatch(/new |\.clear\(/);
  });
});

describe('GW6 compact whirlpool', () => {
  it('draws bands, motes and glints in the visual disc, only the quad at the pull reach', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const i = src.indexOf('function drawNova(');
    const body = src.slice(i, src.indexOf('function drawGlint(', i));
    expect(body).toMatch(/const vis = reach \* WHIRL_VISUAL;/);
    expect(body).toMatch(/fluidP\.reach = reach;/);
    expect(body).not.toMatch(/whirl(Mote|Wisp|GasSector)\([^)]*\breach\b/);
    expect(body).not.toMatch(/novaGlintSpot\([^)]*\breach\b/);
  });
});
