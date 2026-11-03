// Release gate R1 (Ryan, build a1aa5e3): whole level par and stars, no dead air, volatile waves,
// more drums and truly open open drums, all behind GenConfig.enableR1Pacing (version 6).
import { describe, expect, it } from 'vitest';
import { BOSS_EVERY } from '../../src/levelgen/boss';
import { cylinderEligible } from '../../src/levelgen/cylinder';
import { drumPatternFor, generateLevel, levelHash, lullKind, pickSurface, swarmKind } from '../../src/levelgen/generator';
import {
  DEFAULT_GEN_CONFIG,
  GENERATOR_VERSION_V5,
  GENERATOR_VERSION_V6,
  LONG_BANDS,
  V1_GEN_CONFIG,
  V2_GEN_CONFIG,
  V3_GEN_CONFIG,
  V4_GEN_CONFIG,
  V5_GEN_CONFIG,
  bandOf,
  levelSeed,
} from '../../src/levelgen/leveldef';
import type { LevelDef, WaveSchedule } from '../../src/levelgen/leveldef';
import {
  DEAD_AIR_BREATHER_SEC,
  DEAD_AIR_FROM_SEC,
  DEAD_AIR_MAX_SEC,
  deadAirGaps,
  estimateDuration,
  inBreather,
  r1Stars,
  wholeLevelPar,
  wholeLevelScore,
} from '../../src/levelgen/pacing';
import { validateLevel } from '../../src/levelgen/validate';

const SPREAD = 2654435761;
const seedAt = (i: number): number => (7 + i * SPREAD) >>> 0;
const isBoss = (n: number): boolean => n % BOSS_EVERY === 0;
const ids = (errors: readonly string[]): string[] => [...new Set(errors.map((e) => e.split(':')[0] ?? ''))];
const grid = (v: number): number => Math.round(v / 500) * 500;

/** 500 seeds; seed i plays the non boss levels (i mod 10) + 1 + 10k, k 0 to 4. */
const rows: { seed: number; n: number; def: LevelDef }[] = [];
for (let i = 0; i < 500; i++) {
  for (let k = 0; k < 5; k++) {
    const n = (i % 10) + 1 + 10 * k;
    if (!isBoss(n)) rows.push({ seed: seedAt(i), n, def: generateLevel(seedAt(i), n) });
  }
}

const shapeOf = (n: number): { calmSec: number; peakEverySec: number; breatherSec: number } => ({ calmSec: 60, peakEverySec: LONG_BANDS[bandOf(n)].peakEverySec, breatherSec: 10 });

describe('no dead air (500 seeds, duration estimator plus gap check)', () => {
  it('after 10 s never 3 s with fewer than 3 live enemies, except a breather of at most 4 s after a peak', () => {
    const bad: string[] = [];
    let breathers = 0;
    for (const { seed, n, def } of rows) {
      const end = estimateDuration(def).wavesSec;
      const s = shapeOf(n);
      for (const g of deadAirGaps(def.waves, DEAD_AIR_FROM_SEC, end)) {
        if (g.lenSec <= DEAD_AIR_MAX_SEC) continue;
        const afterPeak = inBreather(s, g.startSec) || inBreather(s, g.startSec + g.lenSec - 0.01);
        if (afterPeak && g.lenSec <= DEAD_AIR_BREATHER_SEC) breathers++;
        else bad.push(`seed ${seed} level ${n}: ${g.lenSec.toFixed(1)} s at ${g.startSec.toFixed(1)} s`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(breathers).toBeGreaterThan(0);
  });

  it('version 5 had the dead air Ryan saw (gaps of 5 s and more), so the check has teeth', () => {
    let worst = 0;
    for (const { seed, n } of rows.slice(0, 100)) {
      const d = generateLevel(seed, n, V5_GEN_CONFIG);
      for (const g of deadAirGaps(d.waves, DEAD_AIR_FROM_SEC, estimateDuration(d).wavesSec)) worst = Math.max(worst, g.lenSec);
    }
    expect(worst).toBeGreaterThan(5);
  });

  it('deadAirGaps: pure sweep over spawn lives', () => {
    const w: WaveSchedule = {
      maxLiveEnemies: 60, intervalStartSec: 6, intervalEndSec: 4, rampSec: 60, rampExponent: 1, budgetStart: 3, budgetEnd: 8,
      waves: [0, 10].map((atSec, index) => ({
        index, atSec, pattern: 'edges' as const,
        entries: [0, 0.1, 0.2].map((tOffsetSec) => ({ kind: 'grunt' as const, tOffsetSec, mode: 'fixed' as const, x: 0, y: 0, angleDeg: 0, radius: 0, headingDeg: 0 })),
      })),
      loopFromIndex: -1, loopPeriodSec: 0,
    };
    // Three grunts live from 0.2 to 2 s, then nothing until the third of the next wave at 10.2 s.
    const g = deadAirGaps(w, 0, 15);
    expect(g.map((x) => [Number(x.startSec.toFixed(2)), Number(x.lenSec.toFixed(2))])).toEqual([[0, 0.2], [2, 8.2], [12, 3]]);
  });
});

/** Entries per wave after the calm opening. */
const sizesAfterCalm = (d: LevelDef): number[] => d.waves.waves.filter((w) => w.atSec >= 60).map((w) => w.entries.length);

describe('volatility', () => {
  it('every non boss level has surges (2x the median wave) and lulls of one enemy; v5 had no lulls', () => {
    let surge = 0;
    let lull = 0;
    for (const { def } of rows) {
      const s = sizesAfterCalm(def);
      const med = [...s].sort((a, b) => a - b)[Math.floor(s.length / 2)] ?? 0;
      if (s.some((x) => x >= 2 * med)) surge++;
      if (s.some((x) => x === 1)) lull++;
    }
    expect(surge / rows.length).toBeGreaterThan(0.98);
    expect(lull).toBe(rows.length);
    const v5 = generateLevel(seedAt(3), 14, V5_GEN_CONFIG);
    expect(sizesAfterCalm(v5).some((x) => x === 1)).toBe(false);
  });

  it('swarm waves: a wave of 6 or more of one small fast kind shows up in most levels', () => {
    let swarm = 0;
    for (const { def } of rows) {
      const hit = def.waves.waves.some((w) => w.entries.length >= 6 && w.entries.every((e) => e.kind === 'dart') || (w.entries.length >= 6 && w.entries.every((e) => e.kind === 'grunt')));
      if (hit) swarm++;
    }
    expect(swarm / rows.length).toBeGreaterThan(0.9);
  });

  it('swarmKind and lullKind', () => {
    const roster = [{ kind: 'grunt' as const, weight: 1 }, { kind: 'weaver' as const, weight: 1 }, { kind: 'dart' as const, weight: 1 }, { kind: 'snake' as const, weight: 1 }];
    expect(swarmKind(roster, 4)).toBe('dart');
    expect(swarmKind(roster, 3)).toBe('grunt');
    expect(swarmKind(roster.slice(0, 2), 9)).toBe('grunt');
    expect(lullKind(roster, true)).toBe('snake');
    expect(lullKind(roster, false)).toBe('weaver');
    expect(lullKind(roster.slice(0, 1), true)).toBe('grunt');
  });

  it('deterministic: same seed, same level, any order', () => {
    const a = [6, 14, 27, 43].map((n) => levelHash(generateLevel(77, n)));
    const b = [43, 27, 14, 6].map((n) => levelHash(generateLevel(77, n))).reverse();
    expect(b).toEqual(a);
    expect(JSON.stringify(generateLevel(77, 27))).toBe(JSON.stringify(generateLevel(77, 27)));
  });
});

describe('whole level par and stars', () => {
  it('stars are par, 1.25 x par and 1.5 x par on the 500 grid; par is wholeLevelPar', () => {
    for (const { def } of rows.slice(0, 300)) {
      expect(def.stars).toEqual([def.par, grid(1.25 * def.par), grid(1.5 * def.par)]);
      expect(wholeLevelPar(def.waves, def.objective)).toEqual({ par: def.par, stars: def.stars });
    }
    expect(r1Stars(1000)).toEqual([1000, 1500, 1500]);
    expect(r1Stars(742_000)).toEqual([742_000, 927_500, 1_113_000]);
  });

  it('Ryan R1: a level 6 with version 5 par 742,000 and a full run of 4,873,670 lands near the top star', () => {
    // The formula over version 5 waves is a steady multiple of the old par (about 4.45).
    const ratios: number[] = [];
    for (let i = 0; i < 100; i++) {
      const d = generateLevel(seedAt(i), 6, V5_GEN_CONFIG);
      ratios.push(wholeLevelScore(d.waves, d.objective) / d.par);
    }
    ratios.sort((a, b) => a - b);
    const med = ratios[50] ?? 0;
    expect(ratios[5]).toBeGreaterThan(0.9 * med);
    expect(ratios[95]).toBeLessThan(1.1 * med);
    const par = grid(742_000 * med);
    const run = 4_873_670 / par;
    expect(run).toBeGreaterThan(1.3);
    expect(run).toBeLessThan(1.6);
    // Version 5 put the same run at more than 6 x par.
    expect(4_873_670 / 742_000).toBeGreaterThan(6);
  });

  it('a version 6 level 6 par is far above its version 5 par (more spawns and the whole level multiplier)', () => {
    for (let i = 0; i < 20; i++) expect(generateLevel(seedAt(i), 6).par).toBeGreaterThan(4 * generateLevel(seedAt(i), 6, V5_GEN_CONFIG).par);
  });
});

describe('drums', () => {
  it('cylinder levels are 40 percent of eligible levels and open drums 30 percent of those', () => {
    let eligible = 0;
    let cyl = 0;
    let open = 0;
    for (let i = 0; i < 20000; i++) {
      const n = 11 + (i % 50);
      if (!cylinderEligible(n)) continue;
      eligible++;
      const seed = levelSeed(seedAt(i), n);
      if (pickSurface(seed, n, DEFAULT_GEN_CONFIG) !== 'cylinder') continue;
      cyl++;
      if (drumPatternFor(seed, n) === 'open') open++;
    }
    expect(Math.abs(cyl / eligible - 0.4)).toBeLessThan(0.015);
    expect(Math.abs(open / cyl - 0.3)).toBeLessThan(0.02);
  });

  it('an open drum has no barriers at all; the same level at version 5 could have bars', () => {
    let withBarsBefore = 0;
    let seen = 0;
    for (let i = 0; seen < 120 && i < 3000; i++) {
      const n = 11 + (i % 40);
      if (drumPatternFor(levelSeed(seedAt(i), n), n) !== 'open') continue;
      seen++;
      const d = generateLevel(seedAt(i), n);
      expect(d.arena.shape).toBe('rect');
      expect(d.arena.obstacles).toEqual([]);
      expect(validateLevel(d, DEFAULT_GEN_CONFIG).errors).toEqual([]);
      const v5 = generateLevel(seedAt(i), n, V5_GEN_CONFIG);
      if (v5.surface === 'cylinder' && v5.arena.obstacles.length > 0) withBarsBefore++;
    }
    expect(seen).toBe(120);
    expect(withBarsBefore).toBeGreaterThan(0);
  });

  it('device examples, run seed 2026: level 11 narrow drum, level 14 rings with membranes, level 16 open drum', () => {
    const narrow = generateLevel(2026, 11);
    const rings = generateLevel(2026, 14);
    const open = generateLevel(2026, 16);
    expect(drumPatternFor(narrow.seed, 11)).toBe('narrow');
    expect(narrow.surface).toBe('cylinder');
    expect(narrow.arena.obstacles).toEqual([]);
    expect(narrow.arena.width / narrow.arena.height).toBeLessThan(1.1);
    expect(drumPatternFor(rings.seed, 14)).toBe('rings');
    expect(rings.arena.obstacles.some((o) => o.membrane === true)).toBe(true);
    expect(drumPatternFor(open.seed, 16)).toBe('open');
    expect(open.surface).toBe('cylinder');
    expect(open.arena.obstacles).toEqual([]);
    for (const d of [narrow, rings, open]) expect(validateLevel(d, DEFAULT_GEN_CONFIG).errors).toEqual([]);
  });
});

describe('flags, versions and validation', () => {
  it('the R1 flag is inert without the long levels: V1 to V4 build the same bytes with it on', () => {
    for (const cfg of [V1_GEN_CONFIG, V2_GEN_CONFIG, V3_GEN_CONFIG, V4_GEN_CONFIG]) {
      expect(cfg.enableR1Pacing).toBe(false);
      for (const n of [1, 5, 13, 22, 30, 41]) expect(JSON.stringify(generateLevel(42, n, { ...cfg, enableR1Pacing: true }))).toBe(JSON.stringify(generateLevel(42, n, cfg)));
    }
  });

  it('every level of the default config is version 6; V5_GEN_CONFIG and an older literal give version 5', () => {
    for (const { def } of rows.slice(0, 200)) expect(def.generatorVersion).toBe(GENERATOR_VERSION_V6);
    // Boss levels keep the version 5 waves, par and fight tuning.
    expect(generateLevel(42, 10).generatorVersion).toBe(GENERATOR_VERSION_V5);
    expect(generateLevel(42, 10).stars).toEqual(generateLevel(42, 10, V5_GEN_CONFIG).stars);
    const older = { ...DEFAULT_GEN_CONFIG };
    delete older.enableR1Pacing;
    for (const n of [5, 12, 13]) {
      expect(generateLevel(42, n, V5_GEN_CONFIG).generatorVersion).toBe(GENERATOR_VERSION_V5);
      expect(levelHash(generateLevel(42, n, older))).toBe(levelHash(generateLevel(42, n, V5_GEN_CONFIG)));
    }
  });

  it('J9 ties version 6 to the flag; P1 rejects version 5 stars on version 6 and the reverse', () => {
    const v6 = structuredClone(generateLevel(42, 13));
    const v5 = structuredClone(generateLevel(42, 13, V5_GEN_CONFIG));
    expect(validateLevel(v6, DEFAULT_GEN_CONFIG).errors).toEqual([]);
    expect(validateLevel(v5, V5_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(v6, V5_GEN_CONFIG).errors)).toContain('J9');
    expect(ids(validateLevel(v5, DEFAULT_GEN_CONFIG).errors)).toContain('J9');
    v6.stars = [v6.par, 2 * v6.par, 4 * v6.par];
    expect(ids(validateLevel(v6).errors)).toContain('P1');
    v5.stars = r1Stars(v5.par);
    expect(ids(validateLevel(v5).errors)).toContain('P1');
  });
});
