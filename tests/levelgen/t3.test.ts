// Tester 3 (foundry-t3, version 9): Brood first and Warden second with a softer first fight, the
// level 8 drum taste, and no ripples (they start from destroyed wells). Version 8 stays frozen.
import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../../src/core/difficulty';
import { FIRST_FIGHT_HP_MUL, BOSS_R3_LEVEL_AT_SEC, bossForLevel, t3BossForLevel, t3BossOfNumber, bossOfNumber } from '../../src/levelgen/boss';
import { DRUM_TASTE_KINDS, DRUM_TASTE_LEVEL } from '../../src/levelgen/cylinder';
import { drumPatternFor, drumTaste, generateEndlessSegment, generateLevel, levelHash, pickSurface } from '../../src/levelgen/generator';
import {
  DEFAULT_GEN_CONFIG,
  GENERATOR_VERSION_V8,
  GENERATOR_VERSION_V9,
  V1_GEN_CONFIG,
  V2_GEN_CONFIG,
  V3_GEN_CONFIG,
  V4_GEN_CONFIG,
  V5_GEN_CONFIG,
  V6_GEN_CONFIG,
  V8_GEN_CONFIG,
  fmix32,
  levelSeed,
  runsT3,
} from '../../src/levelgen/leveldef';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { validateLevel } from '../../src/levelgen/validate';

const SPREAD = 0x9e3779b1;
const seedAt = (i: number): number => (3 + i * SPREAD) >>> 0;
const fold = (h: number, hash: string): number => fmix32((h ^ parseInt(hash, 16)) >>> 0);
const ids = (errors: readonly string[]): string[] => errors.map((e) => e.split(':')[0] ?? '');

describe('T3 config and version', () => {
  it('enableT3 is on only in the default; every older config has it false', () => {
    expect(DEFAULT_GEN_CONFIG.enableT3).toBe(true);
    expect(runsT3(DEFAULT_GEN_CONFIG)).toBe(true);
    for (const c of [V1_GEN_CONFIG, V2_GEN_CONFIG, V3_GEN_CONFIG, V4_GEN_CONFIG, V5_GEN_CONFIG, V6_GEN_CONFIG, V8_GEN_CONFIG]) {
      expect(c.enableT3).toBe(false);
      expect(runsT3(c)).toBe(false);
    }
    expect({ ...V8_GEN_CONFIG, enableT3: true }).toEqual(DEFAULT_GEN_CONFIG);
  });

  it('every default level is version 9; V8_GEN_CONFIG is version 8', () => {
    for (const n of [1, 5, 8, 10, 12, 13, 25, 40]) {
      expect(generateLevel(42, n).generatorVersion, `level ${n}`).toBe(GENERATOR_VERSION_V9);
      expect(generateLevel(42, n, V8_GEN_CONFIG).generatorVersion, `level ${n}`).toBe(GENERATOR_VERSION_V8);
    }
  });

  it('version 8 is frozen: V8_GEN_CONFIG on 4 seeds x 50 levels hashes as the default did before T3', () => {
    // Pinned from main at a5216c7 with DEFAULT_GEN_CONFIG (the version 8 default then).
    let h = 0;
    for (const seed of [1, 42, 777, 0xdeadbeef]) for (let n = 1; n <= 50; n++) h = fold(h, levelHash(generateLevel(seed, n, V8_GEN_CONFIG)));
    expect((h >>> 0).toString(16)).toBe('48d2637c');
  }, 60_000);

  it('Endless never reads the flag', () => {
    for (const k of [0, 3, 6, 12, 30]) expect(generateEndlessSegment(42, k)).toEqual(generateEndlessSegment(42, k, V8_GEN_CONFIG));
  });

  it('J10 and J11 tie version 8 and 9 to the flag', () => {
    const v9 = generateLevel(42, 13);
    expect(validateLevel(v9, DEFAULT_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(v9, V8_GEN_CONFIG).errors)).toContain('J10');
    const v8 = generateLevel(42, 13, V8_GEN_CONFIG);
    expect(validateLevel(v8, V8_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(v8, DEFAULT_GEN_CONFIG).errors)).toContain('J11');
  });

  it('Easy bossScale is 0.55; Normal, Hard and Insane are unchanged', () => {
    expect(DIFFICULTY.easy.bossScale).toBe(0.55);
    expect(DIFFICULTY.normal.bossScale).toBe(1);
    expect(DIFFICULTY.hard.bossScale).toBe(1.35);
    expect(DIFFICULTY.insane.bossScale).toBe(1.62);
  });
});

describe('T3 boss order and first fight', () => {
  const AT = BOSS_R3_LEVEL_AT_SEC;

  it('t3BossOfNumber: Brood first at 0.75, Warden second at 1, every later boss as the ladder', () => {
    expect(t3BossOfNumber(1, AT)).toEqual({ id: 'brood', tier: 1, atSec: AT, hpMul: FIRST_FIGHT_HP_MUL });
    expect(FIRST_FIGHT_HP_MUL).toBe(0.75);
    expect(t3BossOfNumber(2, AT)).toEqual({ id: 'warden', tier: 1, atSec: AT, hpMul: 1 });
    for (let j = 3; j <= 60; j++) expect(t3BossOfNumber(j, AT), `boss ${j}`).toEqual(bossOfNumber(j, AT));
    for (const j of [0, -1, 1.5, Number.NaN]) expect(t3BossOfNumber(j, AT)).toBeNull();
  });

  it('t3BossForLevel: same boss levels as bossForLevel', () => {
    for (let n = 1; n <= 200; n++) expect(t3BossForLevel(n, AT) === null, `level ${n}`).toBe(bossForLevel(n, AT) === null);
  });

  it('generated, 20 seeds: level 5 Brood at 0.75 and level 10 Warden under V9; Warden and Brood at 1 under V8', () => {
    for (let i = 0; i < 20; i++) {
      const seed = seedAt(i);
      const l5 = generateLevel(seed, 5);
      const l10 = generateLevel(seed, 10);
      expect(l5.boss).toEqual({ id: 'brood', tier: 1, atSec: AT, hpMul: 0.75 });
      expect(l10.boss).toEqual({ id: 'warden', tier: 1, atSec: AT, hpMul: 1 });
      for (const n of [15, 20, 50, 55]) expect(generateLevel(seed, n).boss, `level ${n}`).toEqual(bossForLevel(n, AT));
      expect(validateLevel(l5, DEFAULT_GEN_CONFIG).errors).toEqual([]);
      expect(validateLevel(l10, DEFAULT_GEN_CONFIG).errors).toEqual([]);
      expect(generateLevel(seed, 5, V8_GEN_CONFIG).boss).toEqual({ id: 'warden', tier: 1, atSec: AT, hpMul: 1 });
      expect(generateLevel(seed, 10, V8_GEN_CONFIG).boss).toEqual({ id: 'brood', tier: 1, atSec: AT, hpMul: 1 });
    }
  });

  it('B1 rejects the version 8 boss on a version 9 level and the version 9 boss on a version 8 level', () => {
    const v9 = structuredClone(generateLevel(42, 5));
    v9.boss = { id: 'warden', tier: 1, atSec: AT, hpMul: 1 };
    expect(ids(validateLevel(v9, DEFAULT_GEN_CONFIG).errors)).toContain('B1');
    const v8 = structuredClone(generateLevel(42, 5, V8_GEN_CONFIG));
    v8.boss = { id: 'brood', tier: 1, atSec: AT, hpMul: 0.75 };
    expect(ids(validateLevel(v8, V8_GEN_CONFIG).errors)).toContain('B1');
  });

  it('boss levels keep the version 8 waves, par and stars (only the boss field and version move)', () => {
    for (const n of [5, 10, 15]) {
      const a = generateLevel(42, n);
      const b = generateLevel(42, n, V8_GEN_CONFIG);
      expect({ ...a, generatorVersion: 0, boss: null }).toEqual({ ...b, generatorVersion: 0, boss: null });
    }
  });
});

function expectTaste(d: LevelDef): void {
  const at = `seed ${d.runSeed}`;
  expect(d.generatorVersion, at).toBe(GENERATOR_VERSION_V9);
  expect(d.surface, at).toBe('cylinder');
  expect(d.arena.shape, at).toBe('rect');
  expect(d.arena.obstacles, at).toEqual([]);
  expect(d.noDrift, at).toBe(true);
  expect(d.hazards.wells.length, at).toBeLessThanOrEqual(1);
  expect(d.hazards.spawners, at).toEqual([]);
  expect(d.ripples, at).toBeUndefined();
  for (const e of d.roster) expect(DRUM_TASTE_KINDS, at).toContain(e.kind);
  for (const w of d.waves.waves) for (const e of w.entries) expect(DRUM_TASTE_KINDS, at).toContain(e.kind);
  expect(validateLevel(d, DEFAULT_GEN_CONFIG).errors, at).toEqual([]);
  expect(d.retries, at).toBe(0);
}

describe('T3 drum taste, level 8', () => {
  it('20 seeds: always an open gentle drum with no drift, at most one well, no spawners', () => {
    expect(DRUM_TASTE_LEVEL).toBe(8);
    for (let i = 0; i < 20; i++) {
      const seed = seedAt(i);
      expectTaste(generateLevel(seed, 8));
      expect(drumPatternFor(levelSeed(seed, 8), 8)).toBe('open');
      const v8 = generateLevel(seed, 8, V8_GEN_CONFIG);
      expect(v8.surface).toBe('flat');
      expect(v8.noDrift).toBeUndefined();
    }
  });

  it('only level 8 is a taste; the cylinder flag off keeps it flat', () => {
    for (let n = 1; n <= 60; n++) expect(drumTaste(n, DEFAULT_GEN_CONFIG), `level ${n}`).toBe(n === 8);
    expect(drumTaste(8, { ...DEFAULT_GEN_CONFIG, enableCylinder: false })).toBe(false);
    const flat = generateLevel(42, 8, { ...DEFAULT_GEN_CONFIG, enableCylinder: false });
    expect(flat.surface).toBe('flat');
    expect(flat.noDrift).toBeUndefined();
  });

  it('levels 1 to 7, 9 and 10 stay flat and levels 11 and up keep the version 8 random share', () => {
    for (let i = 0; i < 200; i++) {
      const seed = levelSeed(seedAt(i), 0);
      for (let n = 1; n <= 40; n++) {
        if (n === 8) continue;
        const s = levelSeed(seedAt(i), n);
        expect(pickSurface(s, n, DEFAULT_GEN_CONFIG), `seed ${seed} level ${n}`).toBe(pickSurface(s, n, V8_GEN_CONFIG));
      }
    }
  });

  it('T1 rejects a drifting, barred, well heavy or harsh taste level and a stray noDrift', () => {
    const base = generateLevel(42, 8);
    const noFlag = structuredClone(base);
    delete noFlag.noDrift;
    expect(ids(validateLevel(noFlag, DEFAULT_GEN_CONFIG).errors)).toContain('T1');
    const harsh = structuredClone(base);
    harsh.roster = [...harsh.roster, { kind: 'dart', weight: 15 }];
    expect(ids(validateLevel(harsh, DEFAULT_GEN_CONFIG).errors)).toContain('T1');
    const spawner = structuredClone(base);
    spawner.hazards = { wells: [], spawners: [{ x: 300, y: 0, spawnAtSec: 20, emitEverySec: 6, dartsPerEmit: 5 }] };
    expect(ids(validateLevel(spawner, DEFAULT_GEN_CONFIG).errors)).toContain('T1');
    const stray = structuredClone(generateLevel(42, 9));
    stray.noDrift = true;
    expect(ids(validateLevel(stray, DEFAULT_GEN_CONFIG).errors)).toContain('T1');
  });
});
