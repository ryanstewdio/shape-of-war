// foundry-boss-arenas: version 13 guardian arenas (Ryan, device check on ecde5b2, 2026-11-11).
// foundry-guardian-par: the default config now builds version 14 guardian levels (same arenas, new
// par), so the version 13 pins below read V13_GEN_CONFIG; tests/levelgen/guardianPar.test.ts
// covers version 14 and the default config.
import { describe, expect, it } from 'vitest';
import { fmix32 } from '../../src/core/rng';
import { BOSS_ARENA_FROM_LEVEL, BOSS_ARENA_LARGE, BOSS_EVERY } from '../../src/levelgen/boss';
import { growGuardianArena } from '../../src/levelgen/bossArena';
import { generateLevel, guardianArenaBoss, levelHash } from '../../src/levelgen/generator';
import {
  DEFAULT_GEN_CONFIG,
  GENERATOR_VERSION_V11,
  GENERATOR_VERSION_V12,
  GENERATOR_VERSION_V13,
  V11_GEN_CONFIG,
  V12_GEN_CONFIG,
  V13_GEN_CONFIG,
  hasParRamp,
  isLongVersion,
  isR3Version,
  isShortVersion,
  isT3Version,
  runsBossArenas,
} from '../../src/levelgen/leveldef';
import type { ArenaDef, LevelDef } from '../../src/levelgen/leveldef';
import { HEX_ASPECT, freePlayArenaSize, guardianArenaMin, validateLevel } from '../../src/levelgen/validate';

const fold = (h: number, hash: string): number => fmix32((h ^ parseInt(hash, 16)) >>> 0);
const ids = (errors: string[]): string[] => errors.map((e) => e.split(':')[0] ?? '');
const seedAt = (i: number): number => fmix32((0x9e3779b9 + Math.imul(i, 0x85ebca6b)) >>> 0);
const GUARDIAN_LEVELS = [10, 15, 20, 25, 30, 35, 40, 45, 50] as const;
const MEDIUM_RECT = freePlayArenaSize('rect', 'medium');
const LARGE_RECT = freePlayArenaSize('rect', 'large');
const MEDIUM_CIRCLE = freePlayArenaSize('circle', 'medium');
const LARGE_CIRCLE = freePlayArenaSize('circle', 'large');

function base(shape: ArenaDef['shape'], width: number, height: number, cornerRadius = 0): ArenaDef {
  return { shape, width, height, cornerRadius, obstacles: [], spawnPoint: { x: 0, y: 0 } };
}

describe('boss arenas: config and version', () => {
  it('the default config runs the boss arenas; V12_GEN_CONFIG and older do not', () => {
    expect(runsBossArenas(DEFAULT_GEN_CONFIG)).toBe(true);
    expect(runsBossArenas(V12_GEN_CONFIG)).toBe(false);
    expect(runsBossArenas(V11_GEN_CONFIG)).toBe(false);
    expect({ ...V12_GEN_CONFIG, enableBossArenas: true }).toEqual(DEFAULT_GEN_CONFIG);
  });

  it('version 13 plays every version 11 rule', () => {
    const v = GENERATOR_VERSION_V13;
    expect(isShortVersion(v) && hasParRamp(v) && isT3Version(v) && isR3Version(v) && isLongVersion(v)).toBe(true);
  });

  it('selects version 13 on every guardian level from 10 (loops included) and nowhere else', () => {
    for (const seed of [0, 42, 0xdeadbeef]) {
      for (let n = 1; n <= 120; n++) {
        const d = generateLevel(seed, n, V13_GEN_CONFIG);
        const guardian = n >= BOSS_ARENA_FROM_LEVEL && n % BOSS_EVERY === 0;
        expect(guardianArenaBoss(n, DEFAULT_GEN_CONFIG) !== null, `level ${n}`).toBe(guardian);
        if (guardian) expect(d.generatorVersion, `level ${n}`).toBe(GENERATOR_VERSION_V13);
        else expect([GENERATOR_VERSION_V11, GENERATOR_VERSION_V12], `level ${n}`).toContain(d.generatorVersion);
      }
    }
  }, 120_000);

  it('level 5 (Brood) and every non guardian level equal the version 12 output byte for byte', () => {
    for (let i = 0; i < 4; i++) {
      const s = seedAt(i);
      for (let n = 1; n <= 60; n++) {
        if (guardianArenaBoss(n, DEFAULT_GEN_CONFIG) !== null) continue;
        expect(levelHash(generateLevel(s, n, V13_GEN_CONFIG)), `seed ${s} level ${n}`).toBe(levelHash(generateLevel(s, n, V12_GEN_CONFIG)));
      }
    }
  }, 120_000);

  it('version 12 is frozen: V12_GEN_CONFIG on 5 seeds x 60 levels hashes as the default did on main', () => {
    // Pinned from main at 1325749 with DEFAULT_GEN_CONFIG (the version 12 default then).
    let h = 0;
    for (const seed of [1, 42, 777, 0xdeadbeef, 2471588027]) for (let n = 1; n <= 60; n++) h = fold(h, levelHash(generateLevel(seed, n, V12_GEN_CONFIG)));
    expect((h >>> 0).toString(16)).toBe('5273e626');
  }, 120_000);

  it('G1 ties version 13 to the flag and to guardian levels', () => {
    const d = generateLevel(42, 15, V13_GEN_CONFIG);
    expect(validateLevel(d, V13_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(d, V12_GEN_CONFIG).errors)).toContain('G1');
    const v12 = generateLevel(42, 15, V12_GEN_CONFIG);
    expect(validateLevel(v12, V12_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(v12, V13_GEN_CONFIG).errors)).toContain('G1');
    const plain: LevelDef = { ...generateLevel(42, 12), generatorVersion: GENERATOR_VERSION_V13 };
    expect(ids(validateLevel(plain).errors)).toContain('G1');
    const small: LevelDef = { ...d, arena: base('rect', 1200, 800) };
    expect(validateLevel(small).errors.some((e) => e.startsWith('G1:') && e.includes('smaller'))).toBe(true);
  });
});

describe('boss arenas: sizes', () => {
  it('guardianArenaMin is the Free Play medium of the kind, large for Spindle', () => {
    expect(guardianArenaMin('rect', 'warden')).toEqual(MEDIUM_RECT);
    expect(guardianArenaMin('roundRect', 'ember')).toEqual(MEDIUM_RECT);
    expect(guardianArenaMin('rectObstacles', 'prism')).toEqual(MEDIUM_RECT);
    expect(guardianArenaMin('circle', 'mirage')).toEqual(MEDIUM_CIRCLE);
    expect(guardianArenaMin('hexagon', 'gravitas')).toEqual({ width: 1270.2, height: MEDIUM_CIRCLE.height });
    expect(guardianArenaMin('rect', 'spindle')).toEqual(LARGE_RECT);
    expect(guardianArenaMin('circle', 'spindle')).toEqual(LARGE_CIRCLE);
    expect(guardianArenaMin('hexagon', 'spindle')).toEqual({ width: 1651.2, height: LARGE_CIRCLE.height });
    expect(BOSS_ARENA_LARGE).toEqual(['spindle']);
  });

  it('growGuardianArena raises each dimension, keeps big arenas and the roundRect corner share', () => {
    expect(growGuardianArena(base('rect', 1200, 800), 'warden')).toEqual(base('rect', 1600, 1000));
    expect(growGuardianArena(base('rect', 1700, 900), 'warden')).toEqual(base('rect', 1700, 1000));
    const big = base('rectObstacles', 1800, 1100);
    expect(growGuardianArena(big, 'tempest')).toBe(big);
    expect(growGuardianArena(base('circle', 900, 900), 'ember')).toEqual(base('circle', 1100, 1100));
    expect(growGuardianArena(base('hexagon', 900 * HEX_ASPECT, 900), 'ember')).toEqual(base('hexagon', 1270.2, 1100));
    const rr = growGuardianArena(base('roundRect', 1200, 800, 200), 'mirage');
    expect(rr).toEqual(base('roundRect', 1600, 1000, 250));
    expect(growGuardianArena(base('rect', 1800, 1100), 'spindle')).toEqual(base('rect', 2080, 1300));
  });

  it('every guardian arena from 10 is at least its minimum, keeps its surface, shape and obstacles, and carries no membrane', () => {
    for (let i = 0; i < 40; i++) {
      const s = seedAt(i);
      for (const n of GUARDIAN_LEVELS) {
        const d = generateLevel(s, n);
        const old = generateLevel(s, n, V12_GEN_CONFIG);
        const id = d.boss?.id;
        expect(id, `level ${n}`).toBe(old.boss?.id);
        if (id === undefined) throw new Error(`level ${n} has no boss`);
        const min = guardianArenaMin(d.arena.shape, id);
        expect(d.surface).toBe(old.surface);
        expect(d.arena.shape).toBe(old.arena.shape);
        expect(d.arena.obstacles).toEqual(old.arena.obstacles);
        expect(d.arena.obstacles.some((o) => o.membrane === true)).toBe(false);
        expect(d.arena.width, `level ${n} ${id}`).toBeGreaterThanOrEqual(min.width);
        expect(d.arena.height, `level ${n} ${id}`).toBeGreaterThanOrEqual(min.height);
        expect(d.arena.width).toBeGreaterThanOrEqual(old.arena.width);
        expect(d.arena.height).toBeGreaterThanOrEqual(old.arena.height);
        // Already at least the minimum: the arena stays as it was.
        if (old.arena.width >= min.width && old.arena.height >= min.height) expect(d.arena).toEqual(old.arena);
      }
    }
  }, 120_000);

  it('Spindle (level 15) always fights on the large size of its kind', () => {
    for (let i = 0; i < 40; i++) {
      const d = generateLevel(seedAt(i), 15);
      expect(d.boss?.id).toBe('spindle');
      expect(d.arena).toMatchObject(guardianArenaMin(d.arena.shape, 'spindle'));
    }
  });
});

describe('boss arenas: validator sweep', () => {
  it('200 seeds of guardian levels 10 to 50 validate strictly', () => {
    const bad: string[] = [];
    for (let i = 0; i < 200; i++) {
      const s = seedAt(i);
      for (const n of GUARDIAN_LEVELS) {
        const d = generateLevel(s, n, V13_GEN_CONFIG);
        const r = validateLevel(d, V13_GEN_CONFIG);
        if (!r.ok || d.generatorVersion !== GENERATOR_VERSION_V13) bad.push(`seed ${s} level ${n} v${d.generatorVersion}: ${r.errors.join('; ')}`);
      }
    }
    expect(bad).toEqual([]);
  }, 300_000);
});
