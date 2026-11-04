// D13 phase C0: the generator chooses cylinder levels. The surface comes from its own stream after
// every other draw, so every flat level keeps its exact LevelDef and hash; enableCylinder false is
// the v3 generator byte for byte.
// Release polish: these pin the v4 cylinder stage, so generation runs on V4_GEN_CONFIG (the
// default with the long levels off); long drum levels are covered in durations.test.ts.
import { describe, expect, it } from 'vitest';
import {
  CYLINDER_CHANCE,
  CYLINDER_WIDTH_STEP,
  canonX,
  cylDist,
  cylObstacleDistance,
  cylinderEligible,
  cylinderWidth,
  insideRims,
  roundCanonX,
  wrapDx,
} from '../../src/levelgen/cylinder';
import { generateEndless, generateEndlessSegment, generateLevel, levelHash, pickSurface } from '../../src/levelgen/generator';
import {
  DEFAULT_GEN_CONFIG,
  V4_GEN_CONFIG,
  GENERATOR_VERSION_V2,
  GENERATOR_VERSION_V4,
  V1_GEN_CONFIG,
  V2_GEN_CONFIG,
  V3_GEN_CONFIG,
  fmix32,
  levelSeed,
} from '../../src/levelgen/leveldef';
import type { ArenaDef, LevelDef } from '../../src/levelgen/leveldef';
import { validateLevel } from '../../src/levelgen/validate';
import { BOSS_EVERY } from '../../src/levelgen/boss';

/** Fold of levelHash over 2000 (seed, level) pairs, recorded on main at afde27c before this change. */
const MAIN_DIGEST = 'F4AEAB71';
const PAIRS = 2000;
const pair = (i: number): { seed: number; n: number } => ({ seed: Math.imul(i + 1, 2654435761) >>> 0, n: 1 + (i % 60) });
const fold = (h: number, hash: string, i: number): number => fmix32((h ^ parseInt(hash, 16)) + i);
const hex = (h: number): string => h.toString(16).toUpperCase().padStart(8, '0');
const ids = (errs: readonly string[]): string[] => errs.map((e) => e.slice(0, e.indexOf(':')));

/** Seed 42 level 16: a cylinder level with the default config (pillars drum since drum-maps; was 712BC1C1 open). */
const CYL_SEED = 42;
const CYL_LEVEL = 16;

describe('cylinder geometry helpers', () => {
  it('canonX keeps x in [-W/2, W/2) and roundCanonX wraps W/2 to -W/2', () => {
    expect(canonX(0, 1600)).toBe(0);
    expect(canonX(800, 1600)).toBe(-800);
    expect(canonX(-800, 1600)).toBe(-800);
    expect(canonX(1700, 1600)).toBe(100);
    expect(canonX(-900, 1600)).toBe(700);
    expect(roundCanonX(799.97, 1600)).toBe(-800);
    expect(roundCanonX(-0.01, 1600)).toBe(0);
    expect(Object.is(roundCanonX(-0.01, 1600), -0)).toBe(false);
  });

  it('wrapDx and cylDist take the short way round the seam', () => {
    expect(wrapDx(1500, 1600)).toBe(-100);
    expect(wrapDx(-1500, 1600)).toBe(100);
    expect(wrapDx(300, 1600)).toBe(300);
    expect(cylDist({ x: -790, y: 0 }, { x: 790, y: 0 }, 1600)).toBeCloseTo(20, 9);
    const o = { cx: 700, cy: 0, w: 100, h: 24 };
    expect(cylObstacleDistance(o, { x: -790, y: 0 }, 1600)).toBeCloseTo(60, 9);
  });

  it('insideRims applies the margin to the rims only', () => {
    const a: ArenaDef = { shape: 'rect', width: 1600, height: 1000, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };
    expect(insideRims(a, { x: -800, y: 0 }, 120)).toBe(true);
    expect(insideRims(a, { x: 799.9, y: 380 }, 120)).toBe(true);
    expect(insideRims(a, { x: 0, y: 381 }, 120)).toBe(false);
    expect(insideRims(a, { x: 800, y: 0 }, 120)).toBe(false);
  });

  it('cylinderWidth snaps to the nearest multiple of 64 inside the size bounds', () => {
    expect(cylinderWidth(1300, 900, 1800, 1, 1.8)).toBe(1280);
    expect(cylinderWidth(1340, 900, 1800, 1, 1.8)).toBe(1344);
    expect(cylinderWidth(1800, 1100, 1800, 1, 1.8)).toBe(1792);
    expect(cylinderWidth(1300, 720, 1800, 1, 1.8)).toBe(1280);
    // 1.8 x 720 = 1296: 1344 would break the aspect bound, so it steps in to 1280.
    expect(cylinderWidth(1330, 720, 1800, 1, 1.8)).toBe(1280);
  });

  it('cylinderEligible: levels from 11, never a boss level', () => {
    for (let n = 1; n <= 10; n++) expect(cylinderEligible(n)).toBe(false);
    expect(cylinderEligible(11)).toBe(true);
    expect(cylinderEligible(15)).toBe(false);
    expect(cylinderEligible(16)).toBe(true);
    expect(cylinderEligible(100)).toBe(false);
  });
});

describe('generator surface choice', () => {
  it(`flat levels are byte identical to main for ${PAIRS} seeds by levels, and enableCylinder false is identical`, () => {
    let main = 0;
    let cylinders = 0;
    for (let i = 0; i < PAIRS; i++) {
      const { seed, n } = pair(i);
      const off = generateLevel(seed, n, V3_GEN_CONFIG);
      const on = generateLevel(seed, n, V4_GEN_CONFIG);
      main = fold(main, levelHash(off), i);
      expect(off.surface).toBe('flat');
      if (on.surface === 'flat') expect(JSON.stringify(on), `seed ${seed} level ${n}`).toBe(JSON.stringify(off));
      else cylinders++;
    }
    // The off config reproduces main for every pair, so every flat level with the flag on does too.
    expect(hex(main)).toBe(MAIN_DIGEST);
    expect(cylinders).toBeGreaterThan(0);
  }, 180000);

  it('V1 and V2 configs carry the cylinder flag off; the default carries it on', () => {
    expect(DEFAULT_GEN_CONFIG.enableCylinder).toBe(true);
    expect(V4_GEN_CONFIG.enableCylinder).toBe(true);
    expect(V1_GEN_CONFIG.enableCylinder).toBe(false);
    expect(V2_GEN_CONFIG.enableCylinder).toBe(false);
    expect(V3_GEN_CONFIG.enableCylinder).toBe(false);
    expect({ ...V3_GEN_CONFIG, enableCylinder: true }).toEqual(V4_GEN_CONFIG);
  });

  it('share of cylinder is near 35 percent of eligible levels from 11 to 60; levels 1 to 10 and boss levels flat', () => {
    let eligible = 0;
    let cyl = 0;
    let all = 0;
    for (let s = 0; s < 4000; s++) {
      const runSeed = Math.imul(s + 7, 0x9e3779b1) >>> 0;
      for (let n = 1; n <= 60; n++) {
        const surface = pickSurface(levelSeed(runSeed, n), n, V4_GEN_CONFIG);
        if (n <= 10 || n % BOSS_EVERY === 0) {
          expect(surface).toBe('flat');
          continue;
        }
        eligible++;
        if (surface === 'cylinder') cyl++;
        expect(pickSurface(levelSeed(runSeed, n), n, V3_GEN_CONFIG)).toBe('flat');
      }
      all += 50;
    }
    const share = cyl / eligible;
    expect(share).toBeGreaterThan(CYLINDER_CHANCE - 0.01);
    expect(share).toBeLessThan(CYLINDER_CHANCE + 0.01);
    // Of all levels 11 to 60, 40 of every 50 are eligible: about 28 percent overall.
    expect(cyl / all).toBeCloseTo(0.28, 1);
  });

  it('generated cylinder levels: rect family, width a multiple of 64, version 4, valid, placed on the cylinder', () => {
    let seen = 0;
    for (let s = 0; s < 60; s++) {
      const runSeed = (1 + s * 2654435761) >>> 0;
      for (let n = 11; n <= 60; n++) {
        const d = generateLevel(runSeed, n, V4_GEN_CONFIG);
        if (n % BOSS_EVERY === 0) {
          expect(d.surface, `boss level ${n}`).toBe('flat');
          expect(d.boss).toBeDefined();
        }
        if (d.surface !== 'cylinder') continue;
        seen++;
        expectCylinder(d);
      }
    }
    expect(seen).toBeGreaterThan(400);
  }, 180000);

  it('boss levels stay flat with the boss flag on or off; Endless stays flat', () => {
    for (let s = 0; s < 30; s++) {
      for (const n of [15, 20, 25, 30, 35, 40, 45, 50, 55, 60]) {
        expect(generateLevel(s, n, V4_GEN_CONFIG).surface).toBe('flat');
        expect(generateLevel(s, n, { ...V4_GEN_CONFIG, enableBosses: false }).surface).toBe('flat');
      }
    }
    expect(generateEndless(42).surface).toBe('flat');
    // forge-leaver: V3 has the Leaver off, so compare with it on (the stage is flat either way).
    expect(generateEndlessSegment(42, 20)).toEqual(generateEndlessSegment(42, 20, { ...V3_GEN_CONFIG, enableLeaver: true }));
  }, 120000);

  it(`seed ${CYL_SEED} level ${CYL_LEVEL} is a cylinder level, deterministic and valid`, () => {
    const d = generateLevel(CYL_SEED, CYL_LEVEL, V4_GEN_CONFIG);
    expect(d.surface).toBe('cylinder');
    expect(generateLevel(CYL_SEED, CYL_LEVEL, V4_GEN_CONFIG)).toEqual(d);
    expect(levelHash(d)).toBe('F383CDC7');
    expectCylinder(d);
    expect(generateLevel(CYL_SEED, CYL_LEVEL, V3_GEN_CONFIG).surface).toBe('flat');
  });
});

function expectCylinder(d: LevelDef): void {
  const at = `seed ${d.runSeed} level ${d.levelIndex}`;
  const W = d.arena.width;
  expect(['rect', 'rectObstacles'], at).toContain(d.arena.shape);
  expect(W % CYLINDER_WIDTH_STEP, at).toBe(0);
  expect(d.generatorVersion, at).toBe(GENERATOR_VERSION_V4);
  expect(d.boss, at).toBeUndefined();
  expect(validateLevel(d, V4_GEN_CONFIG).errors, at).toEqual([]);
  const canonical = (x: number): boolean => x >= -W / 2 && x < W / 2;
  for (const w of d.waves.waves) for (const e of w.entries) if (e.mode === 'fixed') expect(canonical(e.x), `${at} entry x ${e.x}`).toBe(true);
  for (const p of [...d.hazards.wells, ...d.hazards.spawners]) expect(canonical(p.x), `${at} hazard x ${p.x}`).toBe(true);
}

describe('validator C1 and V1 with the cylinder', () => {
  const cyl = (): LevelDef => structuredClone(generateLevel(CYL_SEED, CYL_LEVEL, V4_GEN_CONFIG));

  it('accepts the generated cylinder level, with or without options', () => {
    expect(validateLevel(cyl()).errors).toEqual([]);
    expect(validateLevel(cyl(), V4_GEN_CONFIG).errors).toEqual([]);
  });

  it('rejects cylinder when the config says the flag is off (V1)', () => {
    expect(ids(validateLevel(cyl(), V3_GEN_CONFIG).errors)).toEqual(['V1']);
  });

  it('rejects a cylinder on a non rect shape, an odd width, a wrong version, an early or boss level (C1)', () => {
    const round = cyl();
    round.arena = { ...round.arena, shape: 'roundRect', cornerRadius: 0.2 * round.arena.height, obstacles: [] };
    expect(ids(validateLevel(round).errors)).toContain('C1');

    const odd = cyl();
    odd.arena = { ...odd.arena, width: odd.arena.width - 20 };
    expect(ids(validateLevel(odd).errors)).toContain('C1');

    const v2 = cyl();
    v2.generatorVersion = GENERATOR_VERSION_V2;
    expect(ids(validateLevel(v2).errors)).toEqual(['C1']);

    const early = { ...structuredClone(generateLevel(42, 9, V3_GEN_CONFIG)), surface: 'cylinder' as const, generatorVersion: GENERATOR_VERSION_V4 };
    expect(validateLevel(early).errors.filter((e) => e.startsWith('C1:')).some((e) => e.includes('level 9'))).toBe(true);

    const boss = { ...structuredClone(generateLevel(42, 20, V4_GEN_CONFIG)), surface: 'cylinder' as const };
    expect(ids(validateLevel(boss).errors)).toContain('C1');
  });

  it('rejects version 4 on a flat level (C1)', () => {
    const flat = structuredClone(generateLevel(42, 13, V3_GEN_CONFIG));
    expect(flat.surface).toBe('flat');
    flat.generatorVersion = GENERATOR_VERSION_V4;
    expect(ids(validateLevel(flat).errors)).toEqual(['C1']);
  });

  it('still rejects every other non flat surface value (V1)', () => {
    for (const v of ['torus', 'sphere', 'capsule', 'twistedBand', 'Cylinder', '', null, 0]) {
      const bad: unknown = { ...cyl(), surface: v };
      expect(ids(validateLevel(bad as LevelDef).errors), `surface ${String(v)}`).toContain('V1');
    }
  });

  it('uses wrapped distances for a cylinder: a well across the seam from another is too close (H2)', () => {
    const d = cyl();
    const W = d.arena.width;
    d.hazards = { wells: [{ x: -W / 2 + 100, y: 0 }, { x: W / 2 - 100, y: 0 }], spawners: [] };
    expect(validateLevel(d).errors.some((e) => e.startsWith('H2:'))).toBe(true);
    // The same pair on the flat surface is W - 200 apart and passes H2.
    const flat = { ...d, surface: 'flat' as const };
    expect(validateLevel(flat).errors.some((e) => e.startsWith('H2:'))).toBe(false);
  });

  it('a spawn entry next to the seam passes W4 on a cylinder; the margin applies to the rims only', () => {
    const d = cyl();
    const W = d.arena.width;
    const w0 = d.waves.waves[0];
    const first = w0?.entries[0];
    if (w0 === undefined || first === undefined) throw new Error('no wave');
    const e = { ...first, mode: 'fixed' as const, x: -W / 2, y: d.arena.height / 2 - 60, angleDeg: 0, radius: 0 };
    w0.entries = [e];
    d.arena = { ...d.arena, shape: 'rect', obstacles: [] };
    expect(validateLevel(d).errors.filter((x) => x.startsWith('W4:'))).toEqual([]);
    w0.entries = [{ ...e, y: d.arena.height / 2 - 20 }];
    expect(validateLevel(d).errors.some((x) => x.startsWith('W4:'))).toBe(true);
  });
});
