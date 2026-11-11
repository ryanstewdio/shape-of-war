// Short levels (generator version 11, Ryan 2026-11-10): level 1 about 90 s, levels 2 to 4 ramping,
// 120 to 180 s from level 5, the boss at 85 s, regular score races and a beat every minute.
// Version 10 stays frozen under V10_GEN_CONFIG.
import { describe, expect, it } from 'vitest';
import { generateLevel, levelBeats, levelHash, wholeLevelTarget } from '../../src/levelgen/generator';
import {
  DEFAULT_GEN_CONFIG,
  GENERATOR_VERSION_V10,
  GENERATOR_VERSION_V11,
  GENERATOR_VERSION_V13,
  GENERATOR_VERSION_V14,
  V1_GEN_CONFIG,
  V5_GEN_CONFIG,
  V6_GEN_CONFIG,
  V8_GEN_CONFIG,
  V9_GEN_CONFIG,
  V10_GEN_CONFIG,
  V13_GEN_CONFIG,
  fmix32,
  hasParRamp,
  isLongVersion,
  isR3Version,
  isT3Version,
  levelMaxLive,
  parRampScale,
  runsShort,
} from '../../src/levelgen/leveldef';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { BOSS_EVERY, BOSS_R3_LEVEL_AT_SEC } from '../../src/levelgen/boss';
import { objectiveSec } from '../../src/levelgen/pacing';
import {
  BOSS_SHORT_LEVEL_AT_SEC,
  SHORT_LENGTHS,
  SHORT_RACE_EVERY,
  SHORT_RACE_FROM_LEVEL,
  SHORT_RUSH_SEC,
  SHORT_SURGE_BUDGET,
  SHORT_RUSH_BUDGET,
  beatBudgetAt,
  beatSlots,
  shortLevelSec,
  shortObjectiveKind,
} from '../../src/levelgen/short';
import { validateLevel } from '../../src/levelgen/validate';

const fold = (h: number, hash: string): number => fmix32((h ^ parseInt(hash, 16)) >>> 0);
const ids = (errs: readonly string[]): string[] => errs.map((e) => e.split(':')[0] ?? '');
const isBoss = (n: number): boolean => n % BOSS_EVERY === 0;
const seedAt = (i: number): number => (7 + i * 2654435761) >>> 0;
const timeOf = (d: LevelDef): number => objectiveSec(d.objective, d.waves);

describe('short levels config and version', () => {
  it('only the default runs short levels; V10_GEN_CONFIG is the default with the flag off', () => {
    expect(runsShort(DEFAULT_GEN_CONFIG)).toBe(true);
    for (const c of [V1_GEN_CONFIG, V5_GEN_CONFIG, V6_GEN_CONFIG, V8_GEN_CONFIG, V9_GEN_CONFIG, V10_GEN_CONFIG]) expect(runsShort(c)).toBe(false);
    expect({ ...V10_GEN_CONFIG, enableShortLevels: true }).toEqual(DEFAULT_GEN_CONFIG);
  });

  it('version 11 is long, R3, T3 and par ramp; every default level is 11, V10_GEN_CONFIG 10', () => {
    const v = GENERATOR_VERSION_V11;
    expect(isLongVersion(v) && isR3Version(v) && isT3Version(v) && hasParRamp(v)).toBe(true);
    for (const n of [1, 4, 5, 8, 10, 14, 15, 30]) {
      // foundry-boss-arenas: guardian levels from 10 (10, 15, 30 here) are version 13 by default.
      // foundry-guardian-par: every guardian level (5 too) is version 14 by default; V13_GEN_CONFIG keeps 13.
      expect(generateLevel(42, n).generatorVersion, `level ${n}`).toBe(n % 5 === 0 ? GENERATOR_VERSION_V14 : GENERATOR_VERSION_V11);
      expect(generateLevel(42, n, V13_GEN_CONFIG).generatorVersion, `level ${n}`).toBe(n >= 10 && n % 5 === 0 ? GENERATOR_VERSION_V13 : GENERATOR_VERSION_V11);
      expect(generateLevel(42, n, V10_GEN_CONFIG).generatorVersion, `level ${n}`).toBe(GENERATOR_VERSION_V10);
    }
  });

  it('version 10 is frozen: V10_GEN_CONFIG on 5 seeds x 50 levels hashes as the default did on main', () => {
    // Pinned from main at 754b6f7 with DEFAULT_GEN_CONFIG (the version 10 default then).
    let h = 0;
    for (const seed of [1, 42, 777, 0xdeadbeef, 2471588027]) for (let n = 1; n <= 50; n++) h = fold(h, levelHash(generateLevel(seed, n, V10_GEN_CONFIG)));
    expect((h >>> 0).toString(16)).toBe('a3bb328e');
  }, 120_000);

  it('J12 and J13 tie version 10 and 11 to the flag', () => {
    const v11 = generateLevel(42, 6);
    expect(validateLevel(v11, DEFAULT_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(v11, V10_GEN_CONFIG).errors)).toContain('J13');
    const v10 = generateLevel(42, 6, V10_GEN_CONFIG);
    expect(validateLevel(v10, V10_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(v10, DEFAULT_GEN_CONFIG).errors)).toContain('J12');
  });

  it('levelMaxLive keeps the par ramp cap on version 11', () => {
    for (let n = 1; n <= 20; n++) {
      const d = generateLevel(42, n);
      expect(d.waves.maxLiveEnemies, `level ${n}`).toBe(levelMaxLive(d.band, n, GENERATOR_VERSION_V10));
    }
  });
});

describe('level length', () => {
  it('the table: level 1 at 90 s, levels 2 to 4 ramp, from level 5 a draw in 120 to 180 s', () => {
    expect(SHORT_LENGTHS.early).toEqual([90, 105, 120, 135]);
    expect(SHORT_LENGTHS.late).toEqual([120, 135, 150, 165, 180]);
    for (let i = 0; i < 50; i++) {
      const rs = seedAt(i);
      for (let n = 1; n <= 4; n++) expect(shortLevelSec(rs, n)).toBe(SHORT_LENGTHS.early[n - 1]);
      for (let n = 5; n <= 60; n++) {
        expect(SHORT_LENGTHS.late).toContain(shortLevelSec(rs, n));
        if (n > 5) expect(shortLevelSec(rs, n), `seed ${rs} level ${n}`).not.toBe(shortLevelSec(rs, n - 1));
      }
    }
  });

  it('visibly varied: every late length appears, each about a fifth of the time over 300 seeds', () => {
    const count = new Map<number, number>();
    let total = 0;
    for (let i = 0; i < 300; i++) {
      for (let n = 5; n <= 40; n++) {
        const s = shortLevelSec(seedAt(i), n);
        count.set(s, (count.get(s) ?? 0) + 1);
        total++;
      }
    }
    for (const s of SHORT_LENGTHS.late) {
      expect((count.get(s) ?? 0) / total, `${s} s`).toBeGreaterThan(0.15);
      expect((count.get(s) ?? 0) / total, `${s} s`).toBeLessThan(0.25);
    }
  });

  it('generated non boss levels hold their objective at the length (destroy clears no sooner) and validate', () => {
    for (let i = 0; i < 20; i++) {
      const rs = seedAt(i);
      for (let n = 1; n <= 30; n++) {
        if (isBoss(n)) continue;
        const d = generateLevel(rs, n);
        const at = `seed ${rs} level ${n}`;
        const len = shortLevelSec(rs, n);
        expect(validateLevel(d, DEFAULT_GEN_CONFIG).errors, at).toEqual([]);
        expect(d.retries, at).toBe(0);
        if (d.objective.kind === 'destroy') {
          expect(timeOf(d), at).toBeGreaterThanOrEqual(len);
          expect(timeOf(d), at).toBeLessThan(len + 15);
        } else {
          expect(timeOf(d), at).toBe(len);
        }
      }
    }
  });

  it('boss levels: the entrance at 85 s on levels 5, 10, 15 and 20 (version 10: 120 s); the boss itself is unchanged', () => {
    expect(BOSS_SHORT_LEVEL_AT_SEC).toBe(85);
    for (const seed of [42, 2471588027, 7]) {
      for (const n of [5, 10, 15, 20]) {
        const a = generateLevel(seed, n);
        const b = generateLevel(seed, n, V10_GEN_CONFIG);
        expect(a.boss?.atSec).toBe(85);
        expect(b.boss?.atSec).toBe(BOSS_R3_LEVEL_AT_SEC);
        expect({ ...a.boss, atSec: 0 }).toEqual({ ...b.boss, atSec: 0 });
        expect(a.objective.kind).toBe(b.objective.kind);
        expect(validateLevel(a, DEFAULT_GEN_CONFIG).errors).toEqual([]);
      }
    }
  });
});

describe('score races', () => {
  it('every 4 consecutive non boss levels from level 3 hold a scoreInTime level (200 seeds, levels 1 to 60)', () => {
    for (let i = 0; i < 200; i++) {
      const rs = seedAt(i);
      let dry = 0;
      for (let n = SHORT_RACE_FROM_LEVEL; n <= 60; n++) {
        if (isBoss(n)) continue;
        dry = shortObjectiveKind(rs, n, true) === 'scoreInTime' ? 0 : dry + 1;
        expect(dry, `seed ${rs} level ${n}`).toBeLessThan(SHORT_RACE_EVERY);
      }
    }
  });

  it('share of non boss levels 1 to 30 that are races is about 0.39 (500 seeds)', () => {
    let races = 0;
    let all = 0;
    for (let i = 0; i < 500; i++) {
      for (let n = 1; n <= 30; n++) {
        if (isBoss(n)) continue;
        all++;
        if (shortObjectiveKind(seedAt(i), n, true) === 'scoreInTime') races++;
      }
    }
    expect(races / all).toBeGreaterThan(0.34);
    expect(races / all).toBeLessThan(0.44);
  });

  it('the generated kind is the schedule kind and the goal is 0.6 x par on the existing formula', () => {
    for (let i = 0; i < 10; i++) {
      const rs = seedAt(i);
      for (let n = 1; n <= 24; n++) {
        if (isBoss(n)) continue;
        const d = generateLevel(rs, n);
        expect(d.objective.kind).toBe(shortObjectiveKind(rs, n, true));
        if (d.objective.kind === 'scoreInTime') expect(d.objective.target).toBe(wholeLevelTarget(d.par));
      }
    }
  });
});

describe('minute beats', () => {
  it('slots: one beat per full minute before the rush, never the same type twice, then the rush', () => {
    let r = 0;
    const rng = (): number => ((r = (r + 0.37) % 1), r);
    expect(beatSlots(rng, 90, null).map((s) => [s.atSec, s.type === 'rush'])).toEqual([[60, false], [70, true]]);
    const s180 = beatSlots(rng, 180, null);
    expect(s180.map((s) => s.atSec)).toEqual([60, 120, 160]);
    expect(s180[0]?.type).not.toBe(s180[1]?.type);
    expect(s180[2]).toEqual({ type: 'rush', atSec: 180 - SHORT_RUSH_SEC, lenSec: SHORT_RUSH_SEC });
    expect(beatSlots(rng, 0, 85).map((s) => s.atSec)).toEqual([60]);
    expect(beatBudgetAt(s180, 165)).toBe(SHORT_RUSH_BUDGET);
    expect(beatBudgetAt([{ type: 'surge', atSec: 60, lenSec: 10 }], 65)).toBe(SHORT_SURGE_BUDGET);
    expect(beatBudgetAt([{ type: 'surge', atSec: 60, lenSec: 10 }], 70)).toBe(1);
  });

  it('every generated level: beats at each minute, formations from the roster are in the waves, deterministic', () => {
    for (let i = 0; i < 20; i++) {
      const rs = seedAt(i);
      for (let n = 1; n <= 20; n++) {
        const d = generateLevel(rs, n);
        const beats = levelBeats(d);
        const at = `seed ${rs} level ${n}`;
        expect(levelBeats(generateLevel(rs, n)), at).toEqual(beats);
        const minutes = beats.filter((b) => b.type !== 'rush');
        const end = d.boss === undefined ? shortLevelSec(rs, n) - SHORT_RUSH_SEC : 85 - 10;
        expect(minutes.length, at).toBe(Math.ceil(end / 60) - 1);
        minutes.forEach((b, k) => {
          expect(b.atSec, at).toBeGreaterThanOrEqual(60 * (k + 1));
          expect(b.atSec, at).toBeLessThan(60 * (k + 1) + 5);
        });
        expect(beats.some((b) => b.type === 'rush'), at).toBe(d.boss === undefined);
        const kinds = new Set(d.roster.map((e) => e.kind));
        for (const b of beats) {
          if (b.type !== 'formation') continue;
          expect(b.kind !== undefined && kinds.has(b.kind), at).toBe(true);
          const wave = d.waves.waves.find((w) => w.atSec === b.atSec);
          const n0 = wave?.entries.filter((e) => e.kind === b.kind && e.tOffsetSec <= 3.5).length ?? 0;
          expect(n0, at).toBeGreaterThanOrEqual(b.count ?? 0);
        }
      }
    }
  });

  it('the final rush: the last 20 s spawn more than the 20 s before them on at least 80 percent of levels', () => {
    let lifted = 0;
    let levels = 0;
    for (let i = 0; i < 30; i++) {
      const rs = seedAt(i);
      for (const n of [1, 3, 6, 9, 12, 17, 23]) {
        const d = generateLevel(rs, n);
        const len = shortLevelSec(rs, n);
        let before = 0;
        let rush = 0;
        for (const w of d.waves.waves) {
          if (w.atSec >= len - 40 && w.atSec < len - 20) before += w.entries.length;
          if (w.atSec >= len - 20 && w.atSec < len) rush += w.entries.length;
        }
        levels++;
        if (rush > before) lifted++;
      }
    }
    expect(lifted / levels).toBeGreaterThan(0.8);
  });
});

describe('report pins, Normal', () => {
  it('seed 42 level 1 and seed 2471588027 level 6', () => {
    const a = generateLevel(42, 1);
    expect(a.objective).toEqual({ kind: 'survive', durationSec: 90 });
    expect(a.par).toBe(78_000);
    expect(levelBeats(a).map((b) => [b.type, b.atSec])).toEqual([['surge', 60], ['rush', 70]]);
    const b = generateLevel(2471588027, 6);
    expect(b.objective).toEqual({ kind: 'scoreInTime', target: 749_000, timeLimitSec: 150 });
    expect(b.par).toBe(1_248_000);
    expect(parRampScale(6)).toBe(0.84);
    expect(levelBeats(b).map((x) => x.type)).toEqual(['formation', 'surge', 'rush']);
  });
});
