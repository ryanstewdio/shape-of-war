// Release gate R2: Free Play (freeplay.ts). Every arena and barrier combination over 200 seeds:
// valid, the arena the options name, deterministic, JSON safe, frozen, and the normal Endless
// segments laid out on that arena.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cylObstacleDistance } from '../../src/levelgen/cylinder';
import { FREE_PLAY_DRUM, FREE_PLAY_MIN_OBSTACLES, freePlayArena, freePlayLevel, freePlaySegment } from '../../src/levelgen/freeplay';
import type { FreePlayOptions } from '../../src/levelgen/freeplay';
import { generateEndless, generateEndlessSegment, levelHash } from '../../src/levelgen/generator';
import { GENERATOR_VERSION_V7, V1_GEN_CONFIG } from '../../src/levelgen/leveldef';
import type { EndlessDef, FreePlayArena } from '../../src/levelgen/leveldef';
import { mulberry32 } from '../../src/core/rng';
import { FREE_PLAY_CIRCLE, FREE_PLAY_RECT, MAX_OBSTACLES, validateEndless, validateFreePlay, validateFreePlaySegment } from '../../src/levelgen/validate';

const SPREAD = 2654435761;
const seedAt = (i: number): number => (11 + i * SPREAD) >>> 0;
const ids = (errors: readonly string[]): string[] => [...new Set(errors.map((e) => e.split(':')[0] ?? ''))];
const ARENAS: readonly FreePlayArena[] = ['rect', 'circle', 'drum'];
const COMBOS: readonly (readonly [FreePlayArena, boolean])[] = ARENAS.flatMap((a) => [[a, false] as const, [a, true] as const]);
const SEEDS = 200;
const SEGMENTS = [0, 1, 6, 15, 30];

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(COMBOS)('freePlayLevel arena %s, barriers %s', { timeout: 60_000 }, (arena, barriers) => {
  const defs: EndlessDef[] = [];
  for (let i = 0; i < SEEDS; i++) defs.push(freePlayLevel({ arena, barriers, seed: seedAt(i) }));

  it('validates for 200 seeds, version 7, with the freePlay record', () => {
    const bad: string[] = [];
    for (const d of defs) {
      const e = validateFreePlay(d).errors;
      if (e.length > 0) bad.push(`seed ${d.endlessSeed}: ${e.join('; ')}`);
      expect(d.generatorVersion).toBe(GENERATOR_VERSION_V7);
      expect(d.freePlay?.arena).toBe(arena);
      expect(d.freePlay?.barriers).toBe(barriers);
      expect(d.freePlay?.retries).toBeLessThanOrEqual(2);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('the arena follows the options', () => {
    for (const d of defs) {
      const a = d.arena;
      const n = a.obstacles.length;
      if (!barriers) expect(n).toBe(0);
      if (arena === 'rect') {
        expect(d.surface).toBe('flat');
        expect([a.width, a.height]).toEqual([FREE_PLAY_RECT.width, FREE_PLAY_RECT.height]);
        expect(a.shape).toBe(barriers ? 'rectObstacles' : 'rect');
      } else if (arena === 'circle') {
        expect(d.surface).toBe('flat');
        expect([a.shape, a.width, a.height]).toEqual(['circle', FREE_PLAY_CIRCLE, FREE_PLAY_CIRCLE]);
      } else {
        expect(d.surface).toBe('cylinder');
        expect(a.width % 64).toBe(0);
        expect([a.width, a.height]).toEqual([FREE_PLAY_DRUM.width, FREE_PLAY_DRUM.height]);
        expect(a.shape).toBe(barriers ? 'rectObstacles' : 'rect');
        if (barriers) expect(['rings', 'pillars']).toContain(d.freePlay?.drumPattern);
        else expect(d.freePlay?.drumPattern).toBeNull();
        for (const o of a.obstacles) expect(Math.abs(o.cx) + o.w / 2).toBeLessThanOrEqual(a.width / 2 + 1e-9);
        for (const o of a.obstacles) expect(cylObstacleDistance(o, { x: 0, y: 0 }, a.width)).toBeGreaterThanOrEqual(200);
      }
      if (barriers && arena !== 'drum') {
        expect(n).toBeGreaterThanOrEqual(FREE_PLAY_MIN_OBSTACLES);
        expect(n).toBeLessThanOrEqual(MAX_OBSTACLES);
      }
      if (barriers && arena === 'drum') expect(n).toBeGreaterThan(0);
      expect(a.obstacles.some((o) => o.membrane === true)).toBe(false);
    }
  });

  it('keeps the Endless kit, roster and clocks, no hazards', () => {
    const plain = generateEndless(seedAt(0));
    for (const d of defs.slice(0, 20)) {
      expect(d.mode).toBe('endless');
      expect(d.roster).toEqual(plain.roster);
      expect([d.drone, d.superType, d.lives, d.bombs]).toEqual([plain.drone, plain.superType, plain.lives, plain.bombs]);
      expect([d.segmentSec, d.budgetPerSegment, d.band4Segment]).toEqual([plain.segmentSec, plain.budgetPerSegment, plain.band4Segment]);
      expect(d.hazards).toEqual({ wells: [], spawners: [] });
      expect(d.objective).toEqual({ kind: 'none' });
    }
  });

  it('is deterministic, JSON safe and frozen', () => {
    for (const d of defs.slice(0, 20)) {
      const o: FreePlayOptions = { arena, barriers, seed: d.endlessSeed };
      const again = freePlayLevel(o);
      expect(again).toEqual(d);
      expect(levelHash(again)).toBe(levelHash(d));
      expect(JSON.parse(JSON.stringify(d))).toEqual(d);
      expect(Object.isFrozen(d)).toBe(true);
      expect(Object.isFrozen(d.arena.obstacles)).toBe(true);
    }
  });

  it('segments validate on the Free Play arena (spawn points inside, clear of barriers, wrapped on a drum)', () => {
    const bad: string[] = [];
    for (const d of defs.slice(0, 40)) {
      for (const s of SEGMENTS) {
        const seg = freePlaySegment(d, s);
        const e = validateFreePlaySegment(seg, d).errors;
        if (e.length > 0) bad.push(`seed ${d.endlessSeed} segment ${s}: ${e.slice(0, 2).join('; ')}`);
        if (arena === 'drum') for (const w of seg.waves.waves) for (const en of w.entries) if (en.mode === 'fixed') expect(Math.abs(en.x)).toBeLessThanOrEqual(d.arena.width / 2);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('segments are the normal Endless segments: same seed, band, roster, speed, wave clock and boss', () => {
    for (const d of defs.slice(0, 10)) {
      for (const s of SEGMENTS) {
        const fp = freePlaySegment(d, s);
        const plain = generateEndlessSegment(d.endlessSeed, s);
        expect([fp.seed, fp.band, fp.effectiveIndex, fp.speedScale, fp.generatorVersion]).toEqual([plain.seed, plain.band, plain.effectiveIndex, plain.speedScale, plain.generatorVersion]);
        expect(fp.boss).toEqual(plain.boss);
        expect(fp.waves.maxLiveEnemies).toBe(plain.waves.maxLiveEnemies);
        expect(fp.waves.waves[0]?.atSec).toBe(plain.waves.waves[0]?.atSec);
        if (arena === 'rect' && !barriers) expect(fp).toEqual(plain);
      }
    }
  });
});

describe('Free Play edges', () => {
  it('different seeds give different barrier layouts; barriers off ignores the seed for the arena', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 20; i++) hashes.add(JSON.stringify(freePlayLevel({ arena: 'rect', barriers: true, seed: seedAt(i) }).arena));
    expect(hashes.size).toBeGreaterThan(15);
    const a = freePlayLevel({ arena: 'circle', barriers: false, seed: 1 }).arena;
    const b = freePlayLevel({ arena: 'circle', barriers: false, seed: 2 }).arena;
    expect(a).toEqual(b);
  });

  it('drum barriers use both the ring and the pillar layouts', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(String(freePlayLevel({ arena: 'drum', barriers: true, seed: seedAt(i) }).freePlay?.drumPattern));
    expect([...seen].sort()).toEqual(['pillars', 'rings']);
  });

  it('seeds are taken as uint32', () => {
    expect(freePlayLevel({ arena: 'rect', barriers: true, seed: -1 })).toEqual(freePlayLevel({ arena: 'rect', barriers: true, seed: 0xffffffff }));
    expect(freePlayLevel({ arena: 'rect', barriers: false, seed: -1 }).endlessSeed).toBe(0xffffffff);
  });

  it('freePlayArena draws nothing with barriers off', () => {
    const r = mulberry32(5);
    let draws = 0;
    const counted = (): number => {
      draws++;
      return r();
    };
    for (const k of ARENAS) freePlayArena(counted, k, false);
    expect(draws).toBe(0);
  });

  it('a Free Play def fails the fixed arena check of plain Endless, and plain Endless fails FP1', () => {
    const d = freePlayLevel({ arena: 'circle', barriers: true, seed: 3 });
    expect(ids(validateEndless(d).errors)).toContain('E1');
    expect(ids(validateFreePlay(generateEndless(3)).errors)).toContain('FP1');
  });

  it('FP2 and A4 catch a mismatched arena', () => {
    const d = structuredClone(freePlayLevel({ arena: 'rect', barriers: true, seed: 4 }));
    d.arena.obstacles = [];
    expect(ids(validateFreePlay(d).errors)).toEqual(expect.arrayContaining(['FP2', 'A4']));
    const drum = structuredClone(freePlayLevel({ arena: 'drum', barriers: false, seed: 4 }));
    drum.arena.width = 1610;
    expect(ids(validateFreePlay(drum).errors)).toContain('FP2');
    const circle = structuredClone(freePlayLevel({ arena: 'circle', barriers: false, seed: 4 }));
    circle.surface = 'cylinder';
    expect(ids(validateFreePlay(circle).errors)).toContain('FP2');
  });

  it('respects a GenConfig: v2 kinds off gives the v1 roster', () => {
    const d = freePlayLevel({ arena: 'rect', barriers: false, seed: 9 }, V1_GEN_CONFIG);
    expect(d.roster).toEqual(generateEndless(9, V1_GEN_CONFIG).roster);
    expect(validateFreePlay(d).errors).toEqual([]);
  });

  it('never calls Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random called');
    });
    for (const [arena, barriers] of COMBOS) {
      const d = freePlayLevel({ arena, barriers, seed: 77 });
      freePlaySegment(d, 0);
      freePlaySegment(d, 6);
    }
  });
});
