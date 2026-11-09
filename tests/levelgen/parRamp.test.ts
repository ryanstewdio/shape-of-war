// Tester Tom par ramp (generator version 10, Ryan 2026-11-09): quarter geom pickup par and the
// gentler early ramp on levels 1 to 14. Version 9 stays frozen under V9_GEN_CONFIG.
import { describe, expect, it } from 'vitest';
import { PAR_RAMP_LATE_BUDGET, R5_LATE_BUDGET, generateLevel, levelHash, wholeLevelTarget } from '../../src/levelgen/generator';
import {
  BANDS,
  DEFAULT_GEN_CONFIG,
  GENERATOR_VERSION_V10,
  GENERATOR_VERSION_V9,
  PAR_RAMP_SCALE,
  R1_STAR_MULS,
  V1_GEN_CONFIG,
  V2_GEN_CONFIG,
  V3_GEN_CONFIG,
  V4_GEN_CONFIG,
  V5_GEN_CONFIG,
  V6_GEN_CONFIG,
  V8_GEN_CONFIG,
  V9_GEN_CONFIG,
  bandOf,
  fmix32,
  isLongVersion,
  isR3Version,
  isT3Version,
  levelMaxLive,
  parRampScale,
  runsParRamp,
} from '../../src/levelgen/leveldef';
import { R3_COLLECT_RATE, V10_COLLECT_RATE, bossLevelPar, objectiveSec, spawnsBefore, wholeLevelPar } from '../../src/levelgen/pacing';
import { BOSS_R3_LEVEL_AT_SEC } from '../../src/levelgen/boss';
import { validateLevel } from '../../src/levelgen/validate';

const fold = (h: number, hash: string): number => fmix32((h ^ parseInt(hash, 16)) >>> 0);
const ids = (errs: readonly string[]): string[] => errs.map((e) => e.split(':')[0] ?? '');
const wavesSec = (d: ReturnType<typeof generateLevel>): number =>
  d.boss === undefined ? objectiveSec(d.objective, d.waves) : Math.min(objectiveSec(d.objective, d.waves), d.boss.atSec);

describe('par ramp config and version', () => {
  it('enableParRamp is on only in the default; every older config has it false', () => {
    expect(DEFAULT_GEN_CONFIG.enableParRamp).toBe(true);
    expect(runsParRamp(DEFAULT_GEN_CONFIG)).toBe(true);
    for (const c of [V1_GEN_CONFIG, V2_GEN_CONFIG, V3_GEN_CONFIG, V4_GEN_CONFIG, V5_GEN_CONFIG, V6_GEN_CONFIG, V8_GEN_CONFIG, V9_GEN_CONFIG]) {
      expect(c.enableParRamp).toBe(false);
      expect(runsParRamp(c)).toBe(false);
    }
    expect({ ...V9_GEN_CONFIG, enableParRamp: true }).toEqual(DEFAULT_GEN_CONFIG);
  });

  it('version 10 is long, R3 and T3; every default level is version 10, V9_GEN_CONFIG version 9', () => {
    expect(isLongVersion(GENERATOR_VERSION_V10) && isR3Version(GENERATOR_VERSION_V10) && isT3Version(GENERATOR_VERSION_V10)).toBe(true);
    for (const n of [1, 5, 8, 10, 14, 15, 30]) {
      expect(generateLevel(42, n).generatorVersion, `level ${n}`).toBe(GENERATOR_VERSION_V10);
      expect(generateLevel(42, n, V9_GEN_CONFIG).generatorVersion, `level ${n}`).toBe(GENERATOR_VERSION_V9);
    }
  });

  it('version 9 is frozen: V9_GEN_CONFIG on 4 seeds x 50 levels hashes as the default did before the par ramp', () => {
    // Pinned from main at b76e135 with DEFAULT_GEN_CONFIG (the version 9 default then).
    let h = 0;
    for (const seed of [1, 42, 777, 0xdeadbeef]) for (let n = 1; n <= 50; n++) h = fold(h, levelHash(generateLevel(seed, n, V9_GEN_CONFIG)));
    expect((h >>> 0).toString(16)).toBe('37b1b7ea');
  }, 60_000);

  it('J11 and J12 tie version 9 and 10 to the flag', () => {
    const v10 = generateLevel(42, 6);
    expect(validateLevel(v10, DEFAULT_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(v10, V9_GEN_CONFIG).errors)).toContain('J12');
    const v9 = generateLevel(42, 6, V9_GEN_CONFIG);
    expect(validateLevel(v9, V9_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(v9, DEFAULT_GEN_CONFIG).errors)).toContain('J11');
  });
});

describe('PAR_RAMP_SCALE', () => {
  it('rises linearly from 0.75 at level 1 to 1 at level 15, two decimals', () => {
    expect(PAR_RAMP_SCALE.length).toBe(14);
    for (let n = 1; n <= 14; n++) expect(Math.abs(parRampScale(n) - (0.75 + (0.25 * (n - 1)) / 14)), `level ${n}`).toBeLessThanOrEqual(0.0051);
    for (let n = 2; n <= 14; n++) expect(parRampScale(n)).toBeGreaterThan(parRampScale(n - 1));
    for (const n of [15, 16, 40, 0, -1, 1.5]) expect(parRampScale(n), `level ${n}`).toBe(1);
  });

  it('levelMaxLive scales the band cap on version 10 only', () => {
    expect(levelMaxLive(1, 1, GENERATOR_VERSION_V10)).toBe(45);
    expect(levelMaxLive(2, 6, GENERATOR_VERSION_V10)).toBe(76);
    expect(levelMaxLive(2, 15, GENERATOR_VERSION_V10)).toBe(90);
    for (let n = 1; n <= 30; n++) expect(levelMaxLive(bandOf(n), n, GENERATOR_VERSION_V9)).toBe(BANDS[bandOf(n)].maxLiveEnemies);
  });

  it('V10 late lift is larger than R5_LATE_BUDGET', () => {
    expect(PAR_RAMP_LATE_BUDGET).toBeGreaterThan(R5_LATE_BUDGET);
  });
});

describe('par ramp levels', () => {
  const seeds = [1, 42, 777, 2471588027];

  it('levels 1 to 10: fewer spawns before the objective (or the boss); 11 to 14 fewer in total; 15 and up keep the waves', () => {
    const late: [number, number] = [0, 0];
    for (const seed of seeds) {
      for (let n = 1; n <= 20; n++) {
        const a = generateLevel(seed, n);
        const b = generateLevel(seed, n, V9_GEN_CONFIG);
        const at = `seed ${seed} level ${n}`;
        expect(a.objective.kind, at).toBe(b.objective.kind);
        expect(validateLevel(a, DEFAULT_GEN_CONFIG).errors, at).toEqual([]);
        expect(a.waves.maxLiveEnemies, at).toBe(Math.round(b.waves.maxLiveEnemies * parRampScale(n)));
        // 11 to 14 ramp by 0.93 to 0.98: the R1_MIN_WAVE floor and the shifted v2 stage can cancel
        // that on one level, so those count only in the total below.
        if (n <= 10) expect(spawnsBefore(a.waves, wavesSec(a)), at).toBeLessThan(spawnsBefore(b.waves, wavesSec(b)));
        else if (n <= 14) {
          late[0] += spawnsBefore(a.waves, wavesSec(a));
          late[1] += spawnsBefore(b.waves, wavesSec(b));
        }
        else expect(a.waves.waves, at).toEqual(b.waves.waves);
      }
    }
    expect(late[0]).toBeLessThan(late[1]);
  });

  it('boss levels keep the boss timing and every wave time (the ramp moves only wave sizes)', () => {
    for (const seed of seeds) {
      for (const n of [5, 10, 15]) {
        const a = generateLevel(seed, n);
        const b = generateLevel(seed, n, V9_GEN_CONFIG);
        expect(a.boss).toEqual(b.boss);
        expect(a.boss?.atSec).toBe(BOSS_R3_LEVEL_AT_SEC);
        expect(a.waves.waves.map((w) => w.atSec)).toEqual(b.waves.waves.map((w) => w.atSec));
        expect([a.waves.loopFromIndex, a.waves.loopPeriodSec]).toEqual([b.waves.loopFromIndex, b.waves.loopPeriodSec]);
      }
    }
  });

  it('par uses V10_COLLECT_RATE, stars stay 1, 1.25 and 1.5 x par, the goal 0.6 x par', () => {
    expect(V10_COLLECT_RATE).toBe(0.25);
    expect(V10_COLLECT_RATE).toBeLessThan(R3_COLLECT_RATE);
    expect(R1_STAR_MULS).toEqual([1, 1.25, 1.5]);
    for (const seed of seeds) {
      for (let n = 1; n <= 20; n++) {
        const d = generateLevel(seed, n);
        const want = d.boss === undefined ? wholeLevelPar(d.waves, d.objective, V10_COLLECT_RATE) : bossLevelPar(d.waves, d.objective, d.boss.atSec, V10_COLLECT_RATE);
        expect(d.par, `seed ${seed} level ${n}`).toBe(want.par);
        expect(d.stars).toEqual(want.stars);
        if (d.objective.kind === 'scoreInTime') expect(d.objective.target).toBe(wholeLevelTarget(d.par));
      }
    }
  });

  it('levels 1 to 10: par at most 0.6 of the version 9 par (Tom: a clean aggressive run reaches 1 star)', () => {
    for (const seed of seeds) {
      for (let n = 1; n <= 10; n++) {
        const ratio = generateLevel(seed, n).par / generateLevel(seed, n, V9_GEN_CONFIG).par;
        expect(ratio, `seed ${seed} level ${n}`).toBeLessThan(0.6);
        expect(ratio, `seed ${seed} level ${n}`).toBeGreaterThan(0.25);
      }
    }
  });

  it('report pins: seed 2471588027 level 6 and seed 42 level 1 at Normal', () => {
    const l6 = generateLevel(2471588027, 6);
    expect(l6.par).toBe(1_273_500);
    expect(l6.objective).toEqual({ kind: 'destroy', count: 395 });
    const l1 = generateLevel(42, 1);
    expect(l1.par).toBe(338_000);
    expect(l1.objective).toEqual({ kind: 'survive', durationSec: 205 });
  });
});
