// R5 Free Play check (brief foundry-r5-fp, build 405facc): bosses by 120 s and every 300 s after,
// snakes independent of wells, wells normal and many always placed, Swarm 1.95x, and the late
// ramp of Adventure band 1 levels.
import { describe, expect, it } from 'vitest';
import { DEFAULT_FREE_PLAY } from '../../src/core/freeplayConfig';
import type { FreePlayConfig } from '../../src/core/freeplayConfig';
import { FREE_PLAY_DRUM_BOSSES, bossOfNumber, freePlayBossFor, freePlayBossNumber } from '../../src/levelgen/boss';
import { freePlayLevel, freePlaySegment } from '../../src/levelgen/freeplay';
import { R5_LATE_BUDGET, R5_LATE_FROM, generateLevel, levelHash } from '../../src/levelgen/generator';
import { ENDLESS_SEGMENT_SEC, expandSpawns } from '../../src/levelgen/leveldef';
import type { EndlessDef, EndlessSegmentDef, FreePlayArena, LevelDef } from '../../src/levelgen/leveldef';
import { objectiveSec } from '../../src/levelgen/pacing';
import {
  FREE_PLAY_DENSITY_SCALE,
  FREE_PLAY_MANY_WELLS,
  FREE_PLAY_NORMAL_WELLS,
  FREE_PLAY_SNAKES_PER_SEGMENT,
  validateFreePlay,
  validateFreePlaySegment,
  validateLevel,
} from '../../src/levelgen/validate';
import { ALL_ENEMY_KINDS } from '../../src/levelgen/v2enemies';

const ARENAS: readonly FreePlayArena[] = ['rect', 'circle', 'drum'];
/** 11 minutes of 30 s segments. */
const RUN = Array.from({ length: 22 }, (_, s) => s);
const cfg = (over: Partial<FreePlayConfig>): FreePlayConfig => ({ ...DEFAULT_FREE_PLAY, ...over });
const snakes = (seg: EndlessSegmentDef): number => seg.waves.waves.reduce((n, w) => n + w.entries.filter((e) => e.kind === 'snake').length, 0);

function entrances(def: EndlessDef): { sec: number; id: string }[] {
  const out: { sec: number; id: string }[] = [];
  for (const s of RUN) {
    const b = freePlaySegment(def, s).boss;
    if (b !== undefined) out.push({ sec: s * ENDLESS_SEGMENT_SEC + b.atSec, id: b.id });
  }
  return out;
}

function expectValidRun(def: EndlessDef): void {
  expect(validateFreePlay(def).errors).toEqual([]);
  for (const s of RUN) expect(validateFreePlaySegment(freePlaySegment(def, s), def, { enableBosses: true }).errors).toEqual([]);
}

describe('R5 bosses', () => {
  it('every3: first entrance by 120 s, then every 300 s, on the real segment stream over 11 minutes', () => {
    for (const arena of ARENAS) {
      for (const seed of [1, 6, 3735928559]) {
        const d = freePlayLevel({ arena, barriers: true, seed, config: cfg({ bosses: 'every3', length: 'endless' }) });
        expectValidRun(d);
        const e = entrances(d);
        expect(e.map((x) => x.sec)).toEqual([100, 400]);
        expect(e[0]?.sec ?? Infinity).toBeLessThanOrEqual(120);
        // Flat: the ladder (warden, brood); a drum alternates its two bosses, which here coincide.
        expect(e.map((x) => x.id)).toEqual(['warden', 'brood']);
      }
    }
  });

  it('a 3 minute score attack sees its boss (entrance 100 s < 180 s)', () => {
    const d = freePlayLevel({ arena: 'rect', barriers: false, seed: 9, config: cfg({ bosses: 'every3', length: 180 }) });
    expect(entrances(d).filter((x) => x.sec < 180)).toHaveLength(1);
  });

  it('the cadence: boss numbers on segments 3, 13, 23, 33 and none elsewhere', () => {
    for (let s = 0; s < 60; s++) {
      const j = freePlayBossNumber(s);
      expect(j).toBe(s >= 3 && (s - 3) % 10 === 0 ? 1 + (s - 3) / 10 : null);
    }
    expect(freePlayBossNumber(-3)).toBeNull();
    expect(freePlayBossNumber(3.5)).toBeNull();
  });

  it('a chosen boss on a flat arena fights each time with the ladder pass hit points', () => {
    const d = freePlayLevel({ arena: 'circle', barriers: true, seed: 6, config: cfg({ bosses: 'prism' }) });
    expectValidRun(d);
    expect(entrances(d)).toEqual([
      { sec: 100, id: 'prism' },
      { sec: 400, id: 'prism' },
    ]);
    for (let j = 1; j <= 14; j++) {
      const b = freePlayBossFor('prism', 3 + 10 * (j - 1), false);
      expect(b).toEqual({ id: 'prism', tier: 4, atSec: 10, hpMul: bossOfNumber(j, 10)?.hpMul });
    }
  });

  it('R6: a drum honours the chosen boss and the full ladder, like a flat arena', () => {
    for (let j = 1; j <= 12; j++) expect(freePlayBossFor('every3', 3 + 10 * (j - 1), true)).toEqual(freePlayBossFor('every3', 3 + 10 * (j - 1), false));
    expect(freePlayBossFor('brood', 3, true)?.id).toBe('brood');
    expect(freePlayBossFor('gravitas', 3, true)).toEqual({ id: 'gravitas', tier: 2, atSec: 10, hpMul: 1 });
    expect(freePlayBossFor('off', 3, true)).toBeNull();
    expect(FREE_PLAY_DRUM_BOSSES).toEqual(['warden', 'brood', 'spindle', 'ember', 'mirage', 'gravitas', 'bastion', 'tempest', 'twins', 'prism']);
    const d = freePlayLevel({ arena: 'drum', barriers: false, seed: 4, config: cfg({ bosses: 'tempest' }) });
    expectValidRun(d);
    expect(entrances(d).map((x) => x.id)).toEqual(['tempest', 'tempest']);
  });

  it('off: no boss in 11 minutes', () => {
    const d = freePlayLevel({ arena: 'rect', barriers: false, seed: 2, config: cfg({ bosses: 'off' }) });
    expect(entrances(d)).toEqual([]);
  });
});

describe('R5 snakes', () => {
  it('allowed by the toggles: the snake floor every segment from the first (R6), with wells off', () => {
    for (const arena of ARENAS) {
      for (const enemies of [[], ['grunt', 'snake', 'dart'], [...ALL_ENEMY_KINDS]] as const) {
        const d = freePlayLevel({ arena, barriers: true, seed: 12, config: cfg({ enemies: [...enemies], wells: 'off' }) });
        expectValidRun(d);
        expect(d.hazards.wells).toEqual([]);
        for (const s of RUN) {
          const seg = freePlaySegment(d, s);
          expect(snakes(seg)).toBeGreaterThanOrEqual(FREE_PLAY_SNAKES_PER_SEGMENT);
          expect(seg.roster.some((e) => e.kind === 'snake')).toBe(true);
        }
      }
    }
  });

  it('the same snakes with wells on: the wells choice does not move them', () => {
    const off = freePlayLevel({ arena: 'rect', barriers: false, seed: 5, config: cfg({ wells: 'off' }) });
    const many = freePlayLevel({ arena: 'rect', barriers: false, seed: 5, config: cfg({ wells: 'many' }) });
    for (const s of RUN) expect(freePlaySegment(many, s).waves).toEqual(freePlaySegment(off, s).waves);
  });

  it('not allowed: no snake anywhere', () => {
    const d = freePlayLevel({ arena: 'circle', barriers: false, seed: 5, config: cfg({ enemies: ['grunt', 'weaver', 'dart'] }) });
    expectValidRun(d);
    for (const s of RUN) expect(snakes(freePlaySegment(d, s))).toBe(0);
  });

  it('is deterministic', () => {
    const a = freePlayLevel({ arena: 'drum', barriers: true, seed: 77, config: cfg({}) });
    const b = freePlayLevel({ arena: 'drum', barriers: true, seed: 77, config: cfg({}) });
    for (const s of [1, 4, 9]) expect(levelHash(freePlaySegment(a, s) as unknown as EndlessDef)).toBe(levelHash(freePlaySegment(b, s) as unknown as EndlessDef));
  });
});

describe('R5 wells', () => {
  it('normal places 1 to 2 wells and many 2 to 4, on every arena and size', () => {
    for (const arena of ARENAS) {
      for (const size of ['small', 'medium', 'large'] as const) {
        for (let i = 0; i < 8; i++) {
          const seed = (31 + i * 2654435761) >>> 0;
          const normal = freePlayLevel({ arena, barriers: i % 2 === 0, seed, config: cfg({ wells: 'normal', size }) });
          const many = freePlayLevel({ arena, barriers: i % 2 === 0, seed, config: cfg({ wells: 'many', size }) });
          const off = freePlayLevel({ arena, barriers: i % 2 === 0, seed, config: cfg({ wells: 'off', size }) });
          for (const d of [normal, many, off]) expect(validateFreePlay(d).errors).toEqual([]);
          expect(normal.hazards.wells.length).toBeGreaterThanOrEqual(FREE_PLAY_NORMAL_WELLS.min);
          expect(normal.hazards.wells.length).toBeLessThanOrEqual(FREE_PLAY_NORMAL_WELLS.max);
          expect(many.hazards.wells.length).toBeGreaterThanOrEqual(FREE_PLAY_MANY_WELLS.min);
          expect(many.hazards.wells.length).toBeLessThanOrEqual(FREE_PLAY_MANY_WELLS.max);
          expect(off.hazards.wells).toEqual([]);
        }
      }
    }
  });
});

describe('R5 Swarm', () => {
  it('density scale is within 1.8x to 1.95x', () => {
    expect(FREE_PLAY_DENSITY_SCALE.swarm).toBeGreaterThanOrEqual(1.8);
    expect(FREE_PLAY_DENSITY_SCALE.swarm).toBeLessThanOrEqual(1.95);
  });
});

/** Spawns per second in thirds of the level's expected clear time. */
function thirds(d: LevelDef): [number, number, number] {
  const T = objectiveSec(d.objective, d.waves);
  const out: [number, number, number] = [0, 0, 0];
  for (const s of expandSpawns(d.waves, T)) {
    const i = Math.min(2, Math.floor((3 * s.t) / T));
    out[i] = (out[i] ?? 0) + 1;
  }
  return out;
}

describe('R5 late ramp', () => {
  it('Adventure non boss levels spawn at least 1.2x more in their final third than the middle third, like Free Play', () => {
    const fp = freePlayLevel({ arena: 'rect', barriers: false, seed: 5, config: DEFAULT_FREE_PLAY });
    const fpThirds = [0, 0, 0];
    for (let s = 0; s < 6; s++) for (const w of freePlaySegment(fp, s).waves.waves) fpThirds[Math.floor(s / 2)] = (fpThirds[Math.floor(s / 2)] ?? 0) + w.entries.length;
    expect((fpThirds[2] ?? 0) / (fpThirds[1] ?? 1)).toBeGreaterThan(1.2);
    for (const lv of [1, 2, 3, 4, 6, 8, 12, 19, 26, 33, 44]) {
      for (const seed of [1, 2, 3, 4]) {
        const d = generateLevel(seed, lv);
        if (d.boss !== undefined) continue;
        expect(validateLevel(d).errors).toEqual([]);
        const t = thirds(d);
        expect(t[2] / t[1], `level ${lv} seed ${seed}`).toBeGreaterThan(1.2);
      }
    }
  });

  it('constants', () => {
    expect(R5_LATE_FROM).toBeCloseTo(2 / 3, 6);
    expect(R5_LATE_BUDGET).toBe(1.4);
  });
});
