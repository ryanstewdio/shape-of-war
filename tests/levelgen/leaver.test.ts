// forge-leaver: the Leaver stage. Adventure from level 21, Endless from segment 6 (3 minutes), on
// its own stream; a level or segment that gains no Leaver is byte identical to the Leaver off
// generator; legacy configs never run it; every output validates.
import { describe, expect, it } from 'vitest';
import { generateEndless, generateEndlessSegment, generateLevel, levelHash } from '../../src/levelgen/generator';
import {
  LEAVER_JOIN_CHANCE,
  LEAVER_SPAWN_COST,
  leaverGroupCount,
  leaverLevelWeight,
  leaverSegmentWeight,
  leaverSwapChance,
  rosterWithLeaver,
} from '../../src/levelgen/leaver';
import {
  ALL_ENEMY_KINDS,
} from '../../src/levelgen/v2enemies';
import {
  BANDS,
  DEFAULT_GEN_CONFIG,
  V10_GEN_CONFIG,
  ENEMY_BASE,
  ENEMY_GEOMS,
  LEAVER_FROM_LEVEL,
  LEAVER_FROM_SEGMENT,
  V1_GEN_CONFIG,
  V2_ENEMY_KINDS,
  V2_STAGE_KINDS,
  V6_GEN_CONFIG,
  bandOf,
  effectiveIndexOf,
  type LevelDef,
} from '../../src/levelgen/leveldef';
import { validateLevel, validateSegment } from '../../src/levelgen/validate';
import { DEVICE_LEVEL, DEVICE_SEED } from './leaverDevice';

const OFF = { ...DEFAULT_GEN_CONFIG, enableLeaver: false };
// foundry-short-levels: version 11 formation beats draw from the final roster, so a Leaver moves
// the formations too; the head count identity below is pinned on version 10.
const ON10 = V10_GEN_CONFIG;
const OFF10 = { ...V10_GEN_CONFIG, enableLeaver: false };
const SEEDS = [1, 7, 42, 99, 777, 2024, 0xdeadbeef, 0x4e464f4c];
const hasLeaver = (d: Pick<LevelDef, 'roster' | 'waves'>): boolean =>
  d.roster.some((e) => e.kind === 'leaver') || d.waves.waves.some((w) => w.entries.some((e) => e.kind === 'leaver'));

describe('Leaver tables', () => {
  it('is a v2 kind after the six stage kinds, valued as the Weaver', () => {
    expect(V2_ENEMY_KINDS).toEqual([...V2_STAGE_KINDS, 'leaver']);
    expect(ALL_ENEMY_KINDS[ALL_ENEMY_KINDS.length - 1]).toBe('leaver');
    expect(ENEMY_BASE.leaver).toBe(ENEMY_BASE.weaver);
    expect(ENEMY_GEOMS.leaver).toBe(ENEMY_GEOMS.weaver);
    expect(LEAVER_SPAWN_COST).toBe(2);
    expect(BANDS[3].rosterWeights.leaver).toBe(BANDS[3].rosterWeights.weaver);
    expect(BANDS[4].rosterWeights.leaver).toBe(BANDS[4].rosterWeights.weaver);
    expect(BANDS[1].rosterWeights.leaver).toBe(0);
    expect(BANDS[2].rosterWeights.leaver).toBe(0);
  });

  it('gates by level, segment and config', () => {
    expect(LEAVER_FROM_LEVEL).toBe(21);
    expect(bandOf(LEAVER_FROM_LEVEL)).toBe(3);
    expect(leaverLevelWeight(20, 3, DEFAULT_GEN_CONFIG)).toBe(0);
    expect(leaverLevelWeight(21, 3, DEFAULT_GEN_CONFIG)).toBe(20);
    expect(leaverLevelWeight(40, 4, DEFAULT_GEN_CONFIG)).toBe(18);
    expect(leaverLevelWeight(40, 4, V6_GEN_CONFIG)).toBe(0);
    expect(leaverLevelWeight(40, 4, { ...DEFAULT_GEN_CONFIG, enableV2Enemies: false })).toBe(0);
    expect(LEAVER_FROM_SEGMENT * 30).toBe(180);
    expect(leaverSegmentWeight(5, bandOf(effectiveIndexOf(5)), DEFAULT_GEN_CONFIG)).toBe(0);
    expect(leaverSegmentWeight(6, bandOf(effectiveIndexOf(6)), DEFAULT_GEN_CONFIG)).toBeGreaterThan(0);
  });

  it('pure helpers', () => {
    expect(leaverSwapChance([{ kind: 'grunt', weight: 25 }, { kind: 'weaver', weight: 20 }], 20)).toBeCloseTo(20 / 65, 12);
    expect(leaverSwapChance([], 0)).toBe(0);
    expect(leaverGroupCount(0)).toBe(1);
    expect(leaverGroupCount(5)).toBe(5);
    expect(rosterWithLeaver([{ kind: 'grunt', weight: 1 }], 20)).toEqual([{ kind: 'grunt', weight: 1 }, { kind: 'leaver', weight: 20 }]);
  });
});

describe('Leaver stage, Adventure', () => {
  it('no Leaver before level 21; from 21 on a share of levels gains one; all validate', () => {
    let gained = 0;
    let eligible = 0;
    for (const s of SEEDS) {
      for (let n = 1; n <= 45; n++) {
        const d = generateLevel(s, n);
        expect(validateLevel(d).errors, `seed ${s} level ${n}`).toEqual([]);
        if (n < LEAVER_FROM_LEVEL) expect(hasLeaver(d), `seed ${s} level ${n}`).toBe(false);
        else {
          eligible++;
          if (hasLeaver(d)) gained++;
        }
      }
    }
    expect(gained / eligible).toBeGreaterThan(LEAVER_JOIN_CHANCE * 0.6);
    expect(gained / eligible).toBeLessThanOrEqual(LEAVER_JOIN_CHANCE + 0.1);
  });

  it('a level that gains no Leaver is byte identical to the Leaver off generator', () => {
    let kept = 0;
    let moved = 0;
    for (const s of SEEDS) {
      for (let n = 1; n <= 45; n++) {
        const on = generateLevel(s, n, ON10);
        const off = generateLevel(s, n, OFF10);
        if (hasLeaver(on)) {
          moved++;
          // Only the roster, the waves and what par derives from them move.
          expect(on.arena).toEqual(off.arena);
          expect(on.hazards).toEqual(off.hazards);
          expect(on.surface).toBe(off.surface);
          expect(on.generatorVersion).toBe(off.generatorVersion);
          expect(on.roster.slice(0, -1)).toEqual(off.roster);
          expect(on.waves.waves.map((w) => w.atSec)).toEqual(off.waves.waves.map((w) => w.atSec));
          // Same head count per wave: a Leaver group keeps its group's size.
          expect(on.waves.waves.map((w) => w.entries.length)).toEqual(off.waves.waves.map((w) => w.entries.length));
        } else {
          kept++;
          expect(levelHash(on), `seed ${s} level ${n}`).toBe(levelHash(off));
        }
      }
    }
    expect(kept).toBeGreaterThan(0);
    expect(moved).toBeGreaterThan(0);
  }, 60_000); // CI runner is slower than the Mac

  it('legacy configs never run the stage', () => {
    for (const s of SEEDS.slice(0, 3)) for (const n of [21, 25, 31, 44]) {
      expect(hasLeaver(generateLevel(s, n, V6_GEN_CONFIG))).toBe(false);
      expect(hasLeaver(generateLevel(s, n, V1_GEN_CONFIG))).toBe(false);
    }
  });

  it('is deterministic', () => {
    for (const n of [21, 27, 33]) expect(levelHash(generateLevel(42, n))).toBe(levelHash(generateLevel(42, n)));
  });

  it(`the device check level (seed ${DEVICE_SEED} level ${DEVICE_LEVEL}) holds Leavers, under level 30`, () => {
    expect(DEVICE_LEVEL).toBeLessThan(30);
    const d = generateLevel(DEVICE_SEED, DEVICE_LEVEL);
    expect(d.roster.some((e) => e.kind === 'leaver')).toBe(true);
    const first = d.waves.waves.find((w) => w.entries.some((e) => e.kind === 'leaver'));
    expect(first).toBeDefined();
    expect(first?.atSec ?? Infinity).toBeLessThan(60);
  });
});

describe('Leaver stage, Endless', () => {
  it('no Leaver before 3 minutes; segments from 6 may hold one and validate', () => {
    let gained = 0;
    for (const s of SEEDS) {
      for (let seg = 0; seg <= 24; seg++) {
        const d = generateEndlessSegment(s, seg);
        expect(validateSegment(d, { enableBosses: true }).errors, `seed ${s} segment ${seg}`).toEqual([]);
        if (seg < LEAVER_FROM_SEGMENT) expect(hasLeaver(d)).toBe(false);
        else if (hasLeaver(d)) gained++;
        if (!hasLeaver(d)) expect(levelHash(d as unknown as LevelDef)).toBe(levelHash(generateEndlessSegment(s, seg, OFF) as unknown as LevelDef));
      }
    }
    expect(gained).toBeGreaterThan(0);
  });

  it('the Endless catalogue lists the Leaver only with the stage on', () => {
    expect(generateEndless(5).roster.some((e) => e.kind === 'leaver')).toBe(true);
    expect(generateEndless(5, OFF).roster.some((e) => e.kind === 'leaver')).toBe(false);
  });
});
