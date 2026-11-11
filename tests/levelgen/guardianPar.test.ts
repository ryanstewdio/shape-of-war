// foundry-guardian-par: version 14 guardian par (Ryan's ruling 2026-11-11 on docs/qa/par-audit.md).
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY } from '../../src/core/difficulty';
import { fmix32 } from '../../src/core/rng';
import { targetsFor } from '../../src/core/stars';
import { BOSS_TABLE, WAVE_BUDGET_WITH_BOSS } from '../../src/game/bosses/table';
import { scaledCount } from '../../src/game/difficulty';
import { bossBonus, BOSS_BONUS_SHARE as GAME_BONUS_SHARE } from '../../src/game/scoring';
import { REPEAT_STAGGER } from '../../src/game/spawner';
import { BOSS_BONUS_SHARE, BOSS_EVERY, BOSS_FIGHT_SEC, BOSS_SCHEDULE, bossTierOf } from '../../src/levelgen/boss';
import { generateLevel, levelHash, wholeLevelTarget } from '../../src/levelgen/generator';
import {
  GUARDIAN_FIGHT_SEC,
  GUARDIAN_PAR_SHARE,
  PAR_REPEAT_STAGGER,
  PAR_WAVE_BUDGET_WITH_BOSS,
  guardianAvailable,
  guardianBonus,
  guardianFightSec,
  guardianKillScore,
  guardianLevelPar,
  guardianParEndSec,
  guardianSpawns,
  killAllScore,
  parEntry,
  parScaledCount,
  toGuardianGrid,
} from '../../src/levelgen/guardianPar';
import type { GuardianParInput } from '../../src/levelgen/guardianPar';
import {
  BOSS_IDS,
  DEFAULT_GEN_CONFIG,
  ENEMY_BASE,
  ENEMY_GEOMS,
  GENERATOR_VERSION_V11,
  GENERATOR_VERSION_V12,
  GENERATOR_VERSION_V13,
  GENERATOR_VERSION_V14,
  V12_GEN_CONFIG,
  V13_GEN_CONFIG,
  hasParRamp,
  isLongVersion,
  isR3Version,
  isShortVersion,
  isT3Version,
  runsBossArenas,
  runsGuardianPar,
} from '../../src/levelgen/leveldef';
import type { LevelDef, RosterEntry, WaveSchedule } from '../../src/levelgen/leveldef';
import { r1Stars } from '../../src/levelgen/pacing';
import { PAR_MIN, PAR_STEP, difficultyParErrors, validateLevel } from '../../src/levelgen/validate';

const fold = (h: number, hash: string): number => fmix32((h ^ parseInt(hash, 16)) >>> 0);
const ids = (errors: string[]): string[] => errors.map((e) => e.split(':')[0] ?? '');
const seedAt = (i: number): number => fmix32((0x9e3779b9 + Math.imul(i, 0x85ebca6b)) >>> 0);
const GUARDIAN_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;
const ROSTER: RosterEntry[] = [
  { kind: 'grunt', weight: 1 },
  { kind: 'dart', weight: 1 },
] as RosterEntry[];

function schedule(waves: { atSec: number; kinds: ('grunt' | 'dart' | 'snake')[] }[], loopFromIndex = -1, loopPeriodSec = 0): WaveSchedule {
  return {
    waves: waves.map((w) => ({ atSec: w.atSec, entries: w.kinds.map((kind, i) => ({ kind, tOffsetSec: i * 0.1, spawn: { pattern: 'edgeRandom' } })) })),
    loopFromIndex,
    loopPeriodSec,
    maxLiveEnemies: 20,
  } as unknown as WaveSchedule;
}

describe('guardian par: copies pinned to src/game', () => {
  it('WAVE_BUDGET_WITH_BOSS, REPEAT_STAGGER and the bonus share match the game', () => {
    expect(PAR_WAVE_BUDGET_WITH_BOSS).toEqual(WAVE_BUDGET_WITH_BOSS);
    expect(PAR_REPEAT_STAGGER).toBe(REPEAT_STAGGER);
    expect(BOSS_BONUS_SHARE).toBe(GAME_BONUS_SHARE);
  });

  it('every guardian tier in levelgen matches src/game/bosses/table.ts', () => {
    for (const id of BOSS_IDS) expect(bossTierOf(id), id).toBe(BOSS_TABLE[id].tier);
    for (const row of BOSS_SCHEDULE) expect(row.tier, row.id).toBe(BOSS_TABLE[row.id].tier);
  });

  it('parScaledCount is scaledCount and guardianBonus is the Adventure bossBonus', () => {
    for (let n = 0; n <= 40; n++) for (const d of DIFFICULTIES) expect(parScaledCount(n, DIFFICULTY[d].spawnRate)).toBe(scaledCount(n, DIFFICULTY[d].spawnRate));
    for (const p of [0, -5, 1000, 1250, 1499, 56000, 228500, 6014500, 123456789]) expect(guardianBonus(p)).toBe(bossBonus(p, 'adventure', 1));
    expect(guardianBonus(Number.NaN)).toBe(0);
  });
});

describe('guardian par: tables', () => {
  it('ruled shares and tiered fight lengths, separate from BOSS_FIGHT_SEC', () => {
    expect(GUARDIAN_PAR_SHARE).toEqual({ easy: 0.51, normal: 0.49, hard: 0.42, insane: 0.36 });
    expect(GUARDIAN_FIGHT_SEC).toEqual({ 1: 70, 2: 90, 3: 120, 4: 150 });
    expect([1, 2, 3, 4].map((t) => guardianFightSec(t as 1 | 2 | 3 | 4))).toEqual([70, 90, 120, 150]);
    expect(BOSS_FIGHT_SEC).toBe(180);
    expect(Object.isFrozen(GUARDIAN_PAR_SHARE) && Object.isFrozen(GUARDIAN_FIGHT_SEC) && Object.isFrozen(PAR_WAVE_BUDGET_WITH_BOSS)).toBe(true);
  });
});

describe('guardian par: pure model', () => {
  it('guardianSpawns plays full waves before the entrance and the share after it', () => {
    const w = schedule([
      { atSec: 0, kinds: ['grunt', 'grunt'] },
      { atSec: 10, kinds: ['grunt', 'grunt', 'grunt', 'grunt'] },
    ]);
    expect(guardianSpawns(w, ROSTER, 1, 0, 100, 5).map((s) => s.t)).toEqual([0, 0.1]);
    expect(guardianSpawns(w, ROSTER, 1, 0.5, 100, 5).map((s) => s.t)).toEqual([0, 0.1, 10.1, 10.3]);
    expect(guardianSpawns(w, ROSTER, 1, 1, 100, 50)).toHaveLength(6);
    expect(guardianSpawns(w, ROSTER, 1, 1, 10.15, 50)).toHaveLength(4);
  });

  it('guardianSpawns skips kinds outside the roster, repeats at the spawn rate and walks the loop', () => {
    const w = schedule([{ atSec: 0, kinds: ['grunt', 'snake'] }]);
    expect(guardianSpawns(w, ROSTER, 1, 1, 100, 100).map((s) => s.kind)).toEqual(['grunt']);
    const r = guardianSpawns(schedule([{ atSec: 0, kinds: ['grunt', 'dart'] }]), ROSTER, 2, 1, 100, 100);
    expect(r.map((s) => s.t)).toEqual([0, 0.1, PAR_REPEAT_STAGGER, 0.1 + PAR_REPEAT_STAGGER]);
    const loop = guardianSpawns(schedule([{ atSec: 0, kinds: ['grunt'] }], 0, 10), ROSTER, 1, 1, 35, 100);
    expect(loop.map((s) => s.t)).toEqual([0, 10, 20, 30]);
  });

  it('killAllScore builds the multiplier from collected geoms', () => {
    const g = ENEMY_BASE.grunt;
    const geo = ENEMY_GEOMS.grunt;
    expect(killAllScore([{ t: 0, kind: 'grunt' }, { t: 1, kind: 'grunt' }], 0.25)).toBeCloseTo(g + g * (1 + 0.25 * geo));
    expect(killAllScore([])).toBe(0);
  });

  it('toGuardianGrid and parEntry', () => {
    expect(toGuardianGrid(0)).toBe(PAR_MIN);
    expect(toGuardianGrid(12_249)).toBe(12_000);
    expect(toGuardianGrid(12_250)).toBe(12_500);
    expect(parEntry(56_000, false)).toEqual({ par: 56_000, stars: r1Stars(56_000) });
    expect(parEntry(56_000, true)).toEqual({ par: 56_000, stars: r1Stars(56_000), goal: wholeLevelTarget(56_000) });
  });

  it('guardianLevelPar: Normal solves P = s K / (1 - B s), every other difficulty s_d (K_d + bonus)', () => {
    for (const n of GUARDIAN_LEVELS) {
      const def = generateLevel(1000, n);
      const boss = def.boss;
      if (boss === undefined) throw new Error(`level ${n} has no boss`);
      const g: GuardianParInput = { waves: def.waves, roster: def.roster, objective: def.objective, atSec: boss.atSec, tier: boss.tier };
      expect(guardianParEndSec(g)).toBeLessThanOrEqual(boss.atSec + GUARDIAN_FIGHT_SEC[boss.tier]);
      const p = guardianLevelPar(g);
      const sN = GUARDIAN_PAR_SHARE.normal;
      expect(p.normal.par).toBe(toGuardianGrid((sN * guardianKillScore(g, 'normal')) / (1 - BOSS_BONUS_SHARE * sN)));
      for (const d of DIFFICULTIES) {
        const avail = guardianAvailable(g, d, p.normal.par);
        if (d !== 'normal') expect(p[d].par).toBe(toGuardianGrid(GUARDIAN_PAR_SHARE[d] * avail));
        expect(Math.abs(p[d].par / avail - GUARDIAN_PAR_SHARE[d]), `level ${n} ${d}`).toBeLessThan(0.02);
        expect(p[d].stars).toEqual(r1Stars(p[d].par));
      }
      expect(guardianLevelPar(g)).toEqual(p);
      expect(JSON.parse(JSON.stringify(p))).toEqual(p);
    }
  });

  it('Easy keeps no regular enemy after the entrance, so its kill score stops at the entrance', () => {
    const def = generateLevel(1, 15);
    const boss = def.boss;
    if (boss === undefined) throw new Error('no boss');
    const g: GuardianParInput = { waves: def.waves, roster: def.roster, objective: def.objective, atSec: boss.atSec, tier: boss.tier };
    const pre = guardianSpawns(def.waves, def.roster, DIFFICULTY.easy.spawnRate, 0, boss.atSec, boss.atSec);
    expect(guardianKillScore(g, 'easy')).toBe(Math.round(killAllScore(pre)));
  });
});

describe('guardian par: generator version 14', () => {
  it('the default config runs the guardian par; V13_GEN_CONFIG and older do not', () => {
    expect(runsGuardianPar(DEFAULT_GEN_CONFIG)).toBe(true);
    expect(runsGuardianPar(V13_GEN_CONFIG)).toBe(false);
    expect(runsGuardianPar(V12_GEN_CONFIG)).toBe(false);
    expect(runsBossArenas(V13_GEN_CONFIG)).toBe(true);
    expect({ ...V13_GEN_CONFIG, enableGuardianPar: true }).toEqual(DEFAULT_GEN_CONFIG);
  });

  it('version 14 plays every version 11 rule', () => {
    const v = GENERATOR_VERSION_V14;
    expect(isShortVersion(v) && hasParRamp(v) && isT3Version(v) && isR3Version(v) && isLongVersion(v)).toBe(true);
  });

  it('every guardian level (loops included) is version 14 with difficultyPar; no other level is', () => {
    for (const seed of [0, 42, 0xdeadbeef]) {
      for (let n = 1; n <= 120; n++) {
        const d = generateLevel(seed, n);
        if (n % BOSS_EVERY === 0) {
          expect(d.generatorVersion, `level ${n}`).toBe(GENERATOR_VERSION_V14);
          expect(d.difficultyPar, `level ${n}`).toBeDefined();
          expect(Object.keys(d).at(-1), `level ${n}`).toBe('difficultyPar');
        } else {
          expect([GENERATOR_VERSION_V11, GENERATOR_VERSION_V12], `level ${n}`).toContain(d.generatorVersion);
          expect(d.difficultyPar, `level ${n}`).toBeUndefined();
        }
      }
    }
  }, 120_000);

  it('every non guardian level is byte identical to version 13', () => {
    for (let i = 0; i < 5; i++) {
      const s = seedAt(i);
      for (let n = 1; n <= 60; n++) {
        if (n % BOSS_EVERY === 0) continue;
        const a = generateLevel(s, n);
        const b = generateLevel(s, n, V13_GEN_CONFIG);
        expect(JSON.stringify(a), `seed ${s} level ${n}`).toBe(JSON.stringify(b));
        expect(levelHash(a)).toBe(levelHash(b));
      }
    }
  }, 120_000);

  it('a guardian level differs from version 13 only in version, par, stars, the race goal and difficultyPar', () => {
    for (let i = 0; i < 5; i++) {
      for (const n of GUARDIAN_LEVELS) {
        const a = generateLevel(seedAt(i), n);
        const b = generateLevel(seedAt(i), n, V13_GEN_CONFIG);
        expect(b.generatorVersion).toBe(n >= 10 ? GENERATOR_VERSION_V13 : GENERATOR_VERSION_V11);
        expect(levelHash(a)).not.toBe(levelHash(b));
        const strip = (d: LevelDef): Record<string, unknown> => {
          const { generatorVersion: _v, par: _p, stars: _s, difficultyPar: _dp, objective, ...rest } = d;
          return { ...rest, objective: objective.kind === 'scoreInTime' ? { ...objective, target: 0 } : objective };
        };
        expect(strip(a)).toEqual(strip(b));
        expect(Object.keys(a).slice(0, -1)).toEqual(Object.keys(b));
        expect(a.par).toBeLessThan(b.par);
        expect(a.difficultyPar?.normal.par).toBe(a.par);
        if (a.objective.kind === 'scoreInTime') expect(a.objective.target).toBe(wholeLevelTarget(a.par));
      }
    }
  });

  it('version 13 is frozen: V13_GEN_CONFIG on 5 seeds x 60 levels hashes as the default did on main', () => {
    // Pinned from main at bcdad78 with DEFAULT_GEN_CONFIG (the version 13 default then).
    let h = 0;
    for (const seed of [1, 42, 777, 0xdeadbeef, 2471588027]) for (let n = 1; n <= 60; n++) h = fold(h, levelHash(generateLevel(seed, n, V13_GEN_CONFIG)));
    expect((h >>> 0).toString(16)).toBe('52a02a8a');
  }, 120_000);

  it('version 12 is still frozen under its own config', () => {
    let h = 0;
    for (const seed of [1, 42, 777, 0xdeadbeef, 2471588027]) for (let n = 1; n <= 60; n++) h = fold(h, levelHash(generateLevel(seed, n, V12_GEN_CONFIG)));
    expect((h >>> 0).toString(16)).toBe('5273e626');
  }, 120_000);

  it('is deterministic and JSON serialisable', () => {
    for (const n of GUARDIAN_LEVELS) {
      const a = generateLevel(424242, n);
      expect(generateLevel(424242, n)).toEqual(a);
      expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    }
  });

  it('targetsFor reads the per difficulty par of a guardian level and parScale elsewhere', () => {
    for (const d of DIFFICULTIES) {
      const g = generateLevel(1, 15);
      expect(targetsFor(g, d)).toEqual({ par: g.difficultyPar?.[d].par, stars: g.difficultyPar?.[d].stars });
      const plain = generateLevel(1, 14);
      const k = DIFFICULTY[d].parScale;
      expect(targetsFor(plain, d).par).toBe(Math.max(1, Math.round(plain.par * k)));
    }
  });
});

describe('guardian par: validator GP1 and GP2', () => {
  it('200 seeds of guardian levels 5 to 50 validate strictly as version 14', () => {
    const bad: string[] = [];
    for (let i = 0; i < 200; i++) {
      const s = seedAt(i);
      for (const n of GUARDIAN_LEVELS) {
        const d = generateLevel(s, n);
        const r = validateLevel(d, DEFAULT_GEN_CONFIG);
        if (!r.ok || d.generatorVersion !== GENERATOR_VERSION_V14) bad.push(`seed ${s} level ${n} v${d.generatorVersion}: ${r.errors.join('; ')}`);
      }
    }
    expect(bad).toEqual([]);
  }, 300_000);

  it('GP1 ties version 14 and difficultyPar to the flag and to guardian levels', () => {
    const d = generateLevel(42, 15);
    expect(validateLevel(d, DEFAULT_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(d, V13_GEN_CONFIG).errors)).toContain('GP1');
    const v13 = generateLevel(42, 15, V13_GEN_CONFIG);
    expect(validateLevel(v13, V13_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(v13, DEFAULT_GEN_CONFIG).errors)).toContain('GP1');
    const { difficultyPar: _dp, ...noField } = d;
    expect(ids(validateLevel(noField as LevelDef).errors)).toContain('GP1');
    const plain: LevelDef = { ...generateLevel(42, 12), generatorVersion: GENERATOR_VERSION_V14 };
    expect(ids(validateLevel(plain).errors)).toContain('GP1');
    const stray: LevelDef = { ...v13, difficultyPar: d.difficultyPar };
    expect(ids(validateLevel(stray).errors)).toContain('GP1');
  });

  it('GP2 catches a par that is on the grid and well formed but not the guardian par', () => {
    const d = generateLevel(42, 15);
    const dp = d.difficultyPar;
    if (dp === undefined) throw new Error('no difficultyPar');
    const hard = dp.hard.par + PAR_STEP;
    const bad: LevelDef = { ...d, difficultyPar: { ...dp, hard: { par: hard, stars: r1Stars(hard) } } };
    const errs = validateLevel(bad, DEFAULT_GEN_CONFIG).errors;
    expect(ids(errs)).toContain('GP2');
    expect(ids(errs)).not.toContain('GP1');
  });

  it('difficultyParErrors checks every entry, the grid, the stars, the goal and the normal entry', () => {
    const d = generateLevel(42, 15);
    const dp = d.difficultyPar;
    if (dp === undefined) throw new Error('no difficultyPar');
    expect(difficultyParErrors(d)).toEqual([]);
    expect(difficultyParErrors({ ...d, difficultyPar: undefined })).toEqual([]);
    const { easy: _e, ...noEasy } = dp;
    expect(difficultyParErrors({ ...d, difficultyPar: noEasy as typeof dp })).toEqual(['difficultyPar.easy missing']);
    expect(difficultyParErrors({ ...d, difficultyPar: { ...dp, extra: dp.easy } as typeof dp })).toEqual(['difficultyPar has unknown key extra']);
    expect(difficultyParErrors({ ...d, difficultyPar: { ...dp, easy: { par: 1234, stars: r1Stars(1234) } } }).some((e) => e.startsWith('difficultyPar.easy.par'))).toBe(true);
    expect(difficultyParErrors({ ...d, difficultyPar: { ...dp, easy: { par: dp.easy.par, stars: [1, 2, 3] } } }).some((e) => e.startsWith('difficultyPar.easy.stars'))).toBe(true);
    expect(difficultyParErrors({ ...d, difficultyPar: { ...dp, easy: { ...dp.easy, goal: 5000 } } }).some((e) => e.startsWith('difficultyPar.easy.goal'))).toBe(true);
    expect(difficultyParErrors({ ...d, par: d.par + PAR_STEP }).some((e) => e.startsWith('difficultyPar.normal.par'))).toBe(true);
    const race = { ...d, objective: { kind: 'scoreInTime' as const, target: wholeLevelTarget(d.par), timeLimitSec: 300 } };
    expect(difficultyParErrors(race).filter((e) => e.includes('.goal'))).toHaveLength(5);
    const raceDp = Object.fromEntries(DIFFICULTIES.map((k) => [k, parEntry(dp[k].par, true)])) as typeof dp;
    expect(difficultyParErrors({ ...race, difficultyPar: raceDp })).toEqual([]);
    expect(difficultyParErrors({ ...race, difficultyPar: raceDp, objective: { ...race.objective, target: race.objective.target + PAR_STEP } })).toEqual([
      `difficultyPar.normal.goal ${raceDp.normal.goal} !== target ${race.objective.target + PAR_STEP}`,
    ]);
  });

  it('a version 13 def is still judged by G1 alone, and a version 14 guardian arena from level 10 keeps the G1 minimum', () => {
    const d = generateLevel(42, 15);
    const small: LevelDef = { ...d, arena: { ...d.arena, width: 1200, height: 800 } };
    expect(validateLevel(small).errors.some((e) => e.startsWith('G1:') && e.includes('smaller'))).toBe(true);
    expect(validateLevel(generateLevel(42, 5), DEFAULT_GEN_CONFIG).errors).toEqual([]);
  });
});
