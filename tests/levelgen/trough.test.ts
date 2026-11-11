// Trough wave (brief foundry-trough, Ryan 2026-11-10): the half drum valley from level 24, about 1
// in 5 eligible levels, never two in a row, never a boss level or a drum; trough maps and the
// Free Play trough arena. Version 12 on trough levels only; every earlier version bit identical.
import { describe, expect, it } from 'vitest';
import { deriveSeed } from '../../src/core/rng';
import { troughX } from '../../src/core/trough';
import { DEFAULT_FREE_PLAY } from '../../src/core/freeplayConfig';
import type { FreePlayConfig, FreePlaySize } from '../../src/core/freeplayConfig';
import { bossForLevel } from '../../src/levelgen/boss';
import { freePlayLevel, freePlaySegment, levelOptionsOf } from '../../src/levelgen/freeplay';
import { generateLevel, guardianArenaBoss, isTroughLevel, levelBeats, levelHash, pickSurface } from '../../src/levelgen/generator';
import {
  DEFAULT_GEN_CONFIG,
  GENERATOR_VERSION_V11,
  GENERATOR_VERSION_V12,
  V10_GEN_CONFIG,
  V11_GEN_CONFIG,
  V9_GEN_CONFIG,
  runsTrough,
} from '../../src/levelgen/leveldef';
import type { LevelDef, SpawnEntry } from '../../src/levelgen/leveldef';
import { V10_COLLECT_RATE, wholeLevelPar } from '../../src/levelgen/pacing';
import {
  TROUGH_FLOOR_X,
  TROUGH_MAX_OBSTACLES,
  TROUGH_MAX_WELLS,
  TROUGH_MIN_ASPECT,
  TROUGH_MIN_LEVEL,
  TROUGH_SPAWN_X,
  troughEligible,
  troughEntry,
  troughFromCandidates,
  troughHazards,
  troughMapErrors,
} from '../../src/levelgen/trough';
import { freePlayArenaSize, validateFreePlay, validateFreePlaySegment, validateLevel } from '../../src/levelgen/validate';

const SPREAD = 2654435761;
const seedAt = (i: number): number => (7 + i * SPREAD) >>> 0;
const ids = (errors: readonly string[]): string[] => [...new Set(errors.map((e) => e.split(':')[0] ?? ''))];
const thaw = (d: LevelDef): LevelDef => JSON.parse(JSON.stringify(d)) as LevelDef;
const fixed = (x: number, y: number): SpawnEntry => ({ kind: 'grunt', tOffsetSec: 0, mode: 'fixed', x, y, angleDeg: 0, radius: 0, headingDeg: 0 });
const flatCandidate = (s: number, n: number): boolean => troughEligible(n) && pickSurface(deriveSeed(s, n), n, DEFAULT_GEN_CONFIG) === 'flat';

/** First trough level of a run, searching seeds from i0 (levels 24 to 60). */
function firstTrough(i0 = 0): LevelDef {
  for (let i = i0; ; i++) for (let n = TROUGH_MIN_LEVEL; n <= 60; n++) if (isTroughLevel(seedAt(i), n)) return generateLevel(seedAt(i), n);
}

describe('trough helpers', () => {
  it('troughFromCandidates: a run of candidates alternates, starting with a trough', () => {
    const cand = new Set([24, 26, 27, 28, 29, 31]);
    const got = [24, 25, 26, 27, 28, 29, 30, 31].filter((n) => troughFromCandidates(n, (m) => cand.has(m)));
    expect(got).toEqual([24, 26, 28, 31]);
  });

  it('troughEligible: from level 24, never a boss level', () => {
    expect(troughEligible(23)).toBe(false);
    expect(troughEligible(24)).toBe(true);
    expect(troughEligible(25)).toBe(false);
    expect(troughEligible(26)).toBe(true);
    for (let n = 1; n <= 200; n++) if (bossForLevel(n) !== null) expect(troughEligible(n)).toBe(false);
  });

  it('troughEntry pulls a fixed point in by the squeeze, falls back to a ring, leaves rings alone', () => {
    expect(troughEntry(fixed(-740, 100), () => true)).toMatchObject({ mode: 'fixed', x: -555, y: 100 });
    const ring = troughEntry(fixed(400, 400), () => false);
    expect(ring).toMatchObject({ mode: 'ring', x: 0, y: 0, radius: 300 });
    expect(ring.angleDeg).toBe(Math.round((Math.atan2(400, 300) * 180) / Math.PI));
    const r: SpawnEntry = { ...fixed(0, 0), mode: 'ring', angleDeg: 10, radius: 280 };
    expect(troughEntry(r, () => false)).toBe(r);
  });

  it('troughHazards keeps the first floor well only and spawners in the spawn band', () => {
    const W = 1600;
    const h = troughHazards(
      {
        wells: [{ x: 700, y: 0 }, { x: 300, y: 200 }, { x: -300, y: -200 }],
        spawners: [
          { x: 700, y: 0, spawnAtSec: 30, emitEverySec: 5, dartsPerEmit: 3 },
          { x: 500, y: 0, spawnAtSec: 30, emitEverySec: 5, dartsPerEmit: 3 },
        ],
      },
      W,
    );
    expect(h.wells).toEqual([{ x: 300, y: 200 }]);
    expect(h.spawners.map((s) => s.x)).toEqual([500]);
  });

  it('troughMapErrors names rim obstacles, extra and rim wells, rim spawners and rim spawn points', () => {
    const arena = { shape: 'rectObstacles' as const, width: 1600, height: 1000, cornerRadius: 0, spawnPoint: { x: 0, y: 0 }, obstacles: [{ cx: 500, cy: 0, w: 24, h: 200 }] };
    const errs = troughMapErrors(
      arena,
      { wells: [{ x: 0, y: 300 }, { x: 750, y: 0 }], spawners: [{ x: 700, y: 0, spawnAtSec: 30, emitEverySec: 5, dartsPerEmit: 3 }] },
      [fixed(700, 0), fixed(100, 400)],
    );
    expect(errs.some((e) => e.includes('obstacle 0 reaches the rim'))).toBe(true);
    expect(errs.some((e) => e.includes('2 gravity wells'))).toBe(true);
    expect(errs.some((e) => e.includes('well 1 on the rim'))).toBe(true);
    expect(errs.some((e) => e.includes('spawner 0'))).toBe(true);
    expect(errs.some((e) => e.includes('1 fixed spawn entries'))).toBe(true);
    expect(troughMapErrors({ ...arena, shape: 'circle', width: 1000, obstacles: [] }, { wells: [], spawners: [] }, []).length).toBe(1);
  });
});

describe('which levels are troughs', () => {
  it('seed 42 and seed 2471588027, levels 24 to 60 (pinned)', () => {
    const list = (s: number): number[] => Array.from({ length: 37 }, (_, k) => k + 24).filter((n) => isTroughLevel(s, n));
    expect(list(42)).toEqual([24, 32, 38, 42, 44, 47, 54]);
    expect(list(2471588027)).toEqual([26, 58]);
    for (const n of list(42)) expect(generateLevel(42, n).surface).toBe('trough');
  }, 120_000); // heavy generator sweep: the CI runner is slower than the 5000 ms default

  it('about 1 in 5 eligible levels (400 seeds), never below 24, never a boss, never a drum, never two in a row', () => {
    let eligible = 0;
    let troughs = 0;
    const bad: string[] = [];
    for (let i = 0; i < 400; i++) {
      const s = seedAt(i);
      let prev = false;
      for (let n = 1; n <= 80; n++) {
        const t = isTroughLevel(s, n);
        if (t && (n < TROUGH_MIN_LEVEL || bossForLevel(n) !== null || !flatCandidate(s, n) || prev)) bad.push(`${s}/${n}`);
        if (flatCandidate(s, n)) {
          eligible++;
          if (t) troughs++;
        }
        prev = t;
      }
    }
    expect(bad).toEqual([]);
    expect(Math.abs(troughs / eligible - 0.2)).toBeLessThan(0.015);
  }, 120_000); // heavy generator sweep: the CI runner is slower than the 5000 ms default

  it('older configs never draw a trough (versions 1 to 11 frozen)', () => {
    expect(runsTrough(DEFAULT_GEN_CONFIG)).toBe(true);
    for (const cfg of [V11_GEN_CONFIG, V10_GEN_CONFIG, V9_GEN_CONFIG]) {
      expect(runsTrough(cfg)).toBe(false);
      for (let n = 24; n <= 60; n++) expect(isTroughLevel(42, n, cfg)).toBe(false);
    }
  }, 120_000); // heavy generator sweep: the CI runner is slower than the 5000 ms default
});

describe('frozen output', () => {
  it('V11_GEN_CONFIG equals main default byte for byte (digest recorded on main 09b46f9)', () => {
    let acc = '';
    for (let s = 0; s < 12; s++) for (let n = 1; n <= 60; n++) acc += levelHash(generateLevel((s * SPREAD) >>> 0, n, V11_GEN_CONFIG));
    let h = 0x811c9dc5;
    for (let i = 0; i < acc.length; i++) {
      h ^= acc.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    expect(h.toString(16).toUpperCase().padStart(8, '0')).toBe('35821CFF');
  }, 120_000); // heavy generator sweep: the CI runner is slower than the 5000 ms default

  it('every non trough level with the flag on equals the version 11 level', () => {
    for (let i = 0; i < 6; i++) {
      const s = seedAt(i);
      for (let n = 20; n <= 60; n++) {
        // foundry-boss-arenas: guardian levels from 10 are version 13 (bossArenas.test.ts pins them).
        if (isTroughLevel(s, n) || guardianArenaBoss(n, DEFAULT_GEN_CONFIG) !== null) continue;
        expect(levelHash(generateLevel(s, n))).toBe(levelHash(generateLevel(s, n, V11_GEN_CONFIG)));
      }
    }
  }, 120_000); // heavy generator sweep: the CI runner is slower than the 5000 ms default
});

describe('trough maps', () => {
  it('every trough level (120 seeds, 24 to 60) validates first time and suits the valley', () => {
    const bad: string[] = [];
    let n = 0;
    for (let i = 0; i < 120; i++) {
      const s = seedAt(i);
      for (let L = TROUGH_MIN_LEVEL; L <= 60; L++) {
        if (!isTroughLevel(s, L)) continue;
        n++;
        const d = generateLevel(s, L);
        const W = d.arena.width;
        const e = validateLevel(d, DEFAULT_GEN_CONFIG).errors;
        const floor = d.arena.obstacles.every((o) => Math.abs(troughX(Math.abs(o.cx) + o.w / 2, W)) <= TROUGH_FLOOR_X + 1e-9);
        const spawns = d.waves.waves.every((w) => w.entries.every((en) => en.mode !== 'fixed' || Math.abs(troughX(en.x, W)) <= TROUGH_SPAWN_X + 1e-9));
        const ok =
          e.length === 0 &&
          d.retries === 0 &&
          d.generatorVersion === GENERATOR_VERSION_V12 &&
          d.boss === undefined &&
          W / d.arena.height >= TROUGH_MIN_ASPECT - 1e-9 &&
          (d.arena.shape === 'rect' || d.arena.shape === 'rectObstacles') &&
          d.arena.obstacles.length <= TROUGH_MAX_OBSTACLES &&
          floor &&
          d.hazards.wells.length <= TROUGH_MAX_WELLS &&
          d.hazards.wells.every((w) => Math.abs(troughX(w.x, W)) <= TROUGH_FLOOR_X + 1e-9) &&
          spawns;
        if (!ok) bad.push(`${s}/${L}: ${e.join('; ')} r${String(d.retries)} v${d.generatorVersion}`);
      }
    }
    expect(n).toBeGreaterThan(400);
    expect(bad).toEqual([]);
  }, 120_000); // heavy generator sweep: the CI runner is slower than the 5000 ms default

  it('par is the existing whole level formula, and the minute beats still play', () => {
    const d = firstTrough();
    expect(d.par).toBe(wholeLevelPar(d.waves, d.objective, V10_COLLECT_RATE).par);
    expect(levelBeats(d).length).toBeGreaterThan(0);
  });

  it('seed 42 level 24 is a trough (pinned hash)', () => {
    const d = generateLevel(42, 24);
    expect([d.surface, d.generatorVersion, d.arena.shape, d.arena.width, d.arena.height]).toEqual(['trough', 12, 'rectObstacles', 1620, 1000]);
    expect(levelHash(d)).toBe('77AE4DDD');
    expect(levelHash(generateLevel(2471588027, 26))).toBe('A030C315');
  });
});

describe('validator TR1 and TR2', () => {
  it('rejects a trough below level 24, the wrong version, version 12 on a flat level and a rim obstacle', () => {
    const d = thaw(firstTrough());
    expect(validateLevel(d, DEFAULT_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel({ ...d, generatorVersion: GENERATOR_VERSION_V11 }).errors)).toContain('TR1');
    expect(ids(validateLevel({ ...d, surface: 'flat' }).errors)).toContain('TR1');
    expect(ids(validateLevel({ ...d, levelIndex: 22 }).errors)).toContain('TR1');
    const rim = { ...d, arena: { ...d.arena, shape: 'rectObstacles' as const, obstacles: [{ cx: d.arena.width / 2 - 140, cy: 0, w: 24, h: 160 }] } };
    expect(ids(validateLevel(rim).errors)).toContain('TR2');
  });

  it('V1 rejects a trough when the config says the trough flag is off', () => {
    const d = thaw(firstTrough());
    expect(ids(validateLevel(d, { ...DEFAULT_GEN_CONFIG, enableTrough: false }).errors)).toContain('V1');
  });
});

describe('Free Play trough', () => {
  const cfg = (over: Partial<FreePlayConfig>): FreePlayConfig => ({ ...DEFAULT_FREE_PLAY, ...over });
  const SIZES: readonly FreePlaySize[] = ['small', 'medium', 'large'];

  it('surface trough builds a rect trough of the chosen size, version 12, valid with valid segments', () => {
    for (const size of SIZES) {
      for (const barriers of [false, true]) {
        for (const wells of ['off', 'normal', 'many'] as const) {
          for (const seed of [1, 3735928559]) {
            const d = freePlayLevel({ arena: 'drum', barriers, seed, config: cfg({ surface: 'trough', size, wells }) });
            const want = freePlayArenaSize('rect', size);
            expect([d.surface, d.generatorVersion, d.arena.width, d.arena.height, d.freePlay?.arena]).toEqual(['trough', GENERATOR_VERSION_V12, want.width, want.height, 'rect']);
            expect(validateFreePlay(d).errors).toEqual([]);
            expect(d.arena.obstacles.length > 0).toBe(barriers);
            expect(d.hazards.wells.length).toBe(wells === 'off' ? 0 : 1);
            for (const s of [0, 6, 13]) expect(validateFreePlaySegment(freePlaySegment(d, s), d, { enableBosses: true }).errors).toEqual([]);
          }
        }
      }
    }
  });

  it('surface flat or absent keeps the options record and the def as before', () => {
    const a = freePlayLevel({ arena: 'rect', barriers: true, seed: 5, config: cfg({}) });
    const b = freePlayLevel({ arena: 'rect', barriers: true, seed: 5, config: cfg({ surface: 'flat' }) });
    expect(levelHash(b)).toBe(levelHash(a));
    expect(a.freePlay?.options).not.toHaveProperty('surface');
    expect(levelOptionsOf(cfg({ surface: 'trough' }), a.roster).surface).toBe('trough');
  });

  it('FP7 rejects a trough surface without the trough option', () => {
    const d = freePlayLevel({ arena: 'rect', barriers: false, seed: 9, config: cfg({}) });
    const errs = validateFreePlay({ ...d, surface: 'trough' }).errors;
    expect(ids(errs)).toContain('FP7');
  });
});
