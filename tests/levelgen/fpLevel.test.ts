// Free Play options, the level side (docs/14, brief foundry-fp-level): enemies, density, bosses,
// wells and arena size from a FreePlayConfig. Absent config is today's Free Play, byte for byte.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FREE_PLAY } from '../../src/core/freeplayConfig';
import type { FreePlayConfig } from '../../src/core/freeplayConfig';
import { freePlayBossFor } from '../../src/levelgen/boss';
import { freePlayLevel, freePlaySegment, levelOptionsOf } from '../../src/levelgen/freeplay';
import { levelHash } from '../../src/levelgen/generator';
import { BANDS, V1_GEN_CONFIG, bandOf, effectiveIndexOf } from '../../src/levelgen/leveldef';
import type { EndlessDef, EndlessSegmentDef, FreePlayArena } from '../../src/levelgen/leveldef';
import { FREE_PLAY_DENSITY_SCALE, FREE_PLAY_ENTITY_CAP, FREE_PLAY_MANY_WELLS, FREE_PLAY_NORMAL_WELLS, FREE_PLAY_SNAKES_PER_SEGMENT, freePlayArenaSize, validateFreePlay, validateFreePlaySegment } from '../../src/levelgen/validate';

const SPREAD = 2654435761;
const seedAt = (i: number): number => (17 + i * SPREAD) >>> 0;
const ids = (errors: readonly string[]): string[] => [...new Set(errors.map((e) => e.split(':')[0] ?? ''))];
const ARENAS: readonly FreePlayArena[] = ['rect', 'circle', 'drum'];
const SEGMENTS = [0, 1, 5, 6, 12, 15, 18, 30];
const cfg = (over: Partial<FreePlayConfig>): FreePlayConfig => ({ ...DEFAULT_FREE_PLAY, ...over });
const entries = (seg: EndlessSegmentDef): number => seg.waves.waves.reduce((n, w) => n + w.entries.length, 0);
const kindsOf = (seg: EndlessSegmentDef): Set<string> => new Set(seg.waves.waves.flatMap((w) => w.entries.map((e) => e.kind)));

function expectValid(def: EndlessDef, segments: readonly number[] = SEGMENTS): void {
  expect(validateFreePlay(def).errors).toEqual([]);
  for (const s of segments) expect(validateFreePlaySegment(freePlaySegment(def, s), def, { enableBosses: true }).errors).toEqual([]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('absent config is today', () => {
  // Hashes taken from main (64a20eb) before this change: def, then segments 0, 6 and 13.
  const GOLDEN: readonly (readonly [FreePlayArena, boolean, number, string, string])[] = [
    ['rect', false, 1, 'FD322F91', '8683585A,DA7277F2,0C3BE108'],
    ['rect', false, 3735928559, '35A51E4E', 'D861D132,AC596B6C,F57AD752'],
    ['rect', true, 1, '5219FF10', '8683585A,FCDE2ADD,069E0293'],
    ['rect', true, 3735928559, '0B462C18', 'D861D132,AC596B6C,F57AD752'],
    ['circle', false, 1, '622679DC', 'EA9CB292,B7CAFB06,BDDC6670'],
    ['circle', false, 3735928559, '56A8188D', 'CED8C5B9,4510CE8A,615DB7DD'],
    ['circle', true, 1, '60D7A108', 'EA9CB292,B7CAFB06,C5D8CC4E'],
    ['circle', true, 3735928559, 'E36A04ED', 'CED8C5B9,B3F0334A,687D1CCA'],
    ['drum', false, 1, 'CEBEEC73', 'BD6B2C3D,A0529061,5202EADE'],
    ['drum', false, 3735928559, 'A1EB5989', '377AD182,790D1B91,F0BA4199'],
    ['drum', true, 1, 'CDE6C706', 'BD6B2C3D,A0529061,CBF3D9AD'],
    ['drum', true, 3735928559, '7C638F7A', '13D45026,711B686F,10BCBE4B'],
  ];
  it.each(GOLDEN)('%s barriers %s seed %i hashes as on main', (arena, barriers, seed, defHash, segHashes) => {
    const d = freePlayLevel({ arena, barriers, seed });
    expect(levelHash(d)).toBe(defHash);
    expect([0, 6, 13].map((s) => levelHash(freePlaySegment(d, s) as unknown as EndlessDef)).join(',')).toBe(segHashes);
    expect(d.freePlay?.options).toBeUndefined();
  });

  it('a config with today\'s level side (bosses every3, flat) gives the same arena and segments', () => {
    for (const arena of ['rect', 'circle'] as const) {
      for (let i = 0; i < 6; i++) {
        const plain = freePlayLevel({ arena, barriers: true, seed: seedAt(i) });
        // R5: wells off keeps today's hazards; the boss cadence and the snake floor start at segments 3 and 1.
        const withCfg = freePlayLevel({ arena, barriers: true, seed: seedAt(i), config: cfg({ bosses: 'every3', wells: 'off' }) });
        expect(withCfg.arena).toEqual(plain.arena);
        expect(withCfg.hazards).toEqual(plain.hazards);
        expect({ ...withCfg.freePlay, options: undefined }).toEqual({ ...plain.freePlay, options: undefined });
        expect(freePlaySegment(withCfg, 0)).toEqual(freePlaySegment(plain, 0));
      }
    }
  });

  it('stores the level side of the config, JSON safe', () => {
    const d = freePlayLevel({ arena: 'rect', barriers: false, seed: 3, config: cfg({ enemies: ['splime', 'grunt', 'grunt'], density: 'swarm', wells: 'many', size: 'large', bosses: 'prism' }) });
    expect(d.freePlay?.options).toEqual({ enemies: ['grunt', 'splime'], density: 'swarm', bosses: 'prism', wells: 'many', size: 'large' });
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    expect(Object.isFrozen(d.freePlay?.options)).toBe(true);
  });
});

describe('enemies', () => {
  it('only the chosen kinds appear in segments, every arena, valid', () => {
    for (const arena of ARENAS) {
      for (let i = 0; i < 5; i++) {
        const d = freePlayLevel({ arena, barriers: true, seed: seedAt(i), config: cfg({ enemies: ['weaver', 'splime'], bosses: 'off' }) });
        expectValid(d);
        for (const s of SEGMENTS) {
          const seg = freePlaySegment(d, s);
          expect(seg.roster.map((e) => e.kind)).toEqual(['weaver', 'splime']);
          for (const k of kindsOf(seg)) expect(['weaver', 'splime']).toContain(k);
          expect(entries(seg)).toBeGreaterThan(0);
        }
      }
    }
  });

  it('a single costly kind (snake, dart) still spawns and validates', () => {
    for (const kind of ['snake', 'dart', 'bulwark'] as const) {
      const d = freePlayLevel({ arena: 'rect', barriers: false, seed: 5, config: cfg({ enemies: [kind] }) });
      expectValid(d);
      const all = new Set<string>();
      let n = 0;
      for (const s of SEGMENTS) {
        const seg = freePlaySegment(d, s);
        for (const k of kindsOf(seg)) all.add(k);
        n += entries(seg);
      }
      expect([...all]).toEqual([kind]);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('snakes alone stay under the live snake cap', () => {
    const d = freePlayLevel({ arena: 'rect', barriers: false, seed: 8, config: cfg({ enemies: ['snake'] }) });
    for (const s of SEGMENTS) {
      const seg = freePlaySegment(d, s);
      // R5: the Free Play snake floor lifts the band cap to at least FREE_PLAY_SNAKES_PER_SEGMENT.
      const cap = Math.max(BANDS[seg.band].maxLiveSnakes, s >= 1 ? FREE_PLAY_SNAKES_PER_SEGMENT : 0);
      for (const w of seg.waves.waves) expect(w.entries.length).toBeLessThanOrEqual(cap);
    }
  });

  it('empty means the normal roster; kinds outside the catalogue are dropped', () => {
    const plain = freePlayLevel({ arena: 'circle', barriers: false, seed: 4 });
    const none = freePlayLevel({ arena: 'circle', barriers: false, seed: 4, config: cfg({ bosses: 'every3' }) });
    // R5: the snake joins the roster whenever it is allowed (the snake floor); the rest is the drawn roster.
    const noSnake = (seg: EndlessSegmentDef): string[] => seg.roster.filter((e) => e.kind !== 'snake').map((e) => e.kind);
    for (const s of SEGMENTS) expect(noSnake(freePlaySegment(none, s))).toEqual(noSnake(freePlaySegment(plain, s)));
    const v1 = freePlayLevel({ arena: 'rect', barriers: false, seed: 4, config: cfg({ enemies: ['splime'] }) }, V1_GEN_CONFIG);
    expect(v1.freePlay?.options?.enemies).toEqual([]);
    expect(levelOptionsOf(cfg({ enemies: ['dart', 'charger'] }), v1.roster).enemies).toEqual(['dart']);
  });
});

describe('density', () => {
  const total = (density: FreePlayConfig['density'], seed: number): number => {
    const d = freePlayLevel({ arena: 'rect', barriers: false, seed, config: cfg({ density, bosses: 'off' }) });
    expectValid(d);
    return SEGMENTS.reduce((n, s) => n + entries(freePlaySegment(d, s)), 0);
  };

  it('Low about 0.6x, Normal 1x, Swarm about 1.95x the spawn counts (R5)', () => {
    let low = 0;
    let normal = 0;
    let swarm = 0;
    for (let i = 0; i < 8; i++) {
      low += total('low', seedAt(i));
      normal += total('normal', seedAt(i));
      swarm += total('swarm', seedAt(i));
    }
    expect(low / normal).toBeGreaterThan(0.5);
    expect(low / normal).toBeLessThan(0.75);
    expect(swarm / normal).toBeGreaterThan(1.6);
    expect(swarm / normal).toBeLessThan(2.1);
  });

  it('Swarm raises maxLiveEnemies by its scale up to the entity cap; Low and Normal keep the band value', () => {
    for (const density of ['low', 'normal', 'swarm'] as const) {
      const d = freePlayLevel({ arena: 'drum', barriers: true, seed: 2, config: cfg({ density }) });
      for (const s of SEGMENTS) {
        const seg = freePlaySegment(d, s);
        const band = BANDS[bandOf(effectiveIndexOf(s))].maxLiveEnemies;
        const want = density === 'swarm' ? Math.min(FREE_PLAY_ENTITY_CAP, Math.round(band * FREE_PLAY_DENSITY_SCALE.swarm)) : band;
        expect(seg.waves.maxLiveEnemies).toBe(want);
        expect(seg.waves.maxLiveEnemies).toBeLessThanOrEqual(FREE_PLAY_ENTITY_CAP);
      }
    }
  });
});

describe('bosses', () => {
  it('off: no boss on any segment', () => {
    const d = freePlayLevel({ arena: 'rect', barriers: false, seed: 6, config: cfg({ bosses: 'off' }) });
    expectValid(d);
    for (const s of SEGMENTS) expect(freePlaySegment(d, s).boss).toBeUndefined();
  });

  it('every3 (R5): the tier ladder on segments 3, 13, 23 (100 s, then every 300 s); Warden and Brood on a drum', () => {
    for (const arena of ARENAS) {
      const d = freePlayLevel({ arena, barriers: false, seed: 6, config: cfg({ bosses: 'every3' }) });
      expectValid(d, [...SEGMENTS, 3, 13, 23]);
      for (const s of [...SEGMENTS, 3, 13, 23]) expect(freePlaySegment(d, s).boss).toEqual(freePlayBossFor('every3', s, arena === 'drum') ?? undefined);
    }
    const flat = freePlayLevel({ arena: 'rect', barriers: false, seed: 6, config: cfg({ bosses: 'every3' }) });
    expect([3, 13, 23].map((s) => freePlaySegment(flat, s).boss?.id)).toEqual(['warden', 'brood', 'spindle']);
  });

  it('a chosen boss on the R5 cadence on a flat arena; a drum fights it as Warden', () => {
    const d = freePlayLevel({ arena: 'circle', barriers: true, seed: 6, config: cfg({ bosses: 'prism' }) });
    expectValid(d, [...SEGMENTS, 3, 13]);
    for (const s of [...SEGMENTS, 3, 13]) {
      const b = freePlaySegment(d, s).boss;
      if (s >= 3 && (s - 3) % 10 === 0) expect(b).toMatchObject({ id: 'prism', tier: 4, atSec: 10 });
      else expect(b).toBeUndefined();
    }
    const drum = freePlayLevel({ arena: 'drum', barriers: false, seed: 6, config: cfg({ bosses: 'prism' }) });
    expect(freePlaySegment(drum, 3).boss).toMatchObject({ id: 'warden', tier: 1 });
  });

  it('B1 catches a boss the options did not ask for', () => {
    const d = freePlayLevel({ arena: 'rect', barriers: false, seed: 6, config: cfg({ bosses: 'off' }) });
    const seg = structuredClone(freePlaySegment(d, 6)) as EndlessSegmentDef;
    seg.boss = { id: 'warden', tier: 1, atSec: 10, hpMul: 1 };
    seg.generatorVersion = 3;
    expect(ids(validateFreePlaySegment(seg, d).errors)).toContain('B1');
  });
});

describe('wells', () => {
  it('off: no wells; normal (R5): 1 to 2; many: 2 to 4 wells, every arena and size', () => {
    for (const arena of ARENAS) {
      for (const size of ['small', 'medium', 'large'] as const) {
        for (let i = 0; i < 15; i++) {
          expect(freePlayLevel({ arena, barriers: true, seed: seedAt(i), config: cfg({ wells: 'off', size }) }).hazards.wells).toEqual([]);
          const n = freePlayLevel({ arena, barriers: true, seed: seedAt(i), config: cfg({ wells: 'normal', size }) });
          expect(validateFreePlay(n).errors).toEqual([]);
          expect(n.hazards.wells.length).toBeGreaterThanOrEqual(FREE_PLAY_NORMAL_WELLS.min);
          expect(n.hazards.wells.length).toBeLessThanOrEqual(FREE_PLAY_NORMAL_WELLS.max);
          const d = freePlayLevel({ arena, barriers: i % 2 === 0, seed: seedAt(i), config: cfg({ wells: 'many', size }) });
          expect(validateFreePlay(d).errors).toEqual([]);
          expect(d.hazards.wells.length).toBeGreaterThanOrEqual(FREE_PLAY_MANY_WELLS.min);
          expect(d.hazards.wells.length).toBeLessThanOrEqual(FREE_PLAY_MANY_WELLS.max);
          expect(d.hazards.spawners).toEqual([]);
        }
      }
    }
  });

  it('many uses the whole 2 to 4 range', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) seen.add(freePlayLevel({ arena: 'rect', barriers: false, seed: seedAt(i), config: cfg({ wells: 'many' }) }).hazards.wells.length);
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });

  it('FP4 catches wells with wells off, and too many for normal', () => {
    const d = structuredClone(freePlayLevel({ arena: 'rect', barriers: false, seed: 1, config: cfg({ wells: 'off' }) }));
    d.hazards.wells = [{ x: 500, y: 300 }];
    expect(ids(validateFreePlay(d).errors)).toContain('FP4');
    const n = structuredClone(freePlayLevel({ arena: 'rect', barriers: false, seed: 1, config: cfg({ wells: 'normal' }) }));
    n.hazards.wells = [{ x: 500, y: 300 }, { x: -500, y: 300 }, { x: 500, y: -300 }];
    expect(ids(validateFreePlay(n).errors)).toContain('FP4');
    expect(ids(validateFreePlay(d).errors)).toContain('FP4');
  });
});

describe('arena size', () => {
  it('small 0.75x, medium 1x, large 1.3x; drum widths multiples of 64; valid with and without barriers', () => {
    const want: Record<FreePlayArena, Record<string, [number, number]>> = {
      rect: { small: [1200, 750], medium: [1600, 1000], large: [2080, 1300] },
      circle: { small: [830, 830], medium: [1100, 1100], large: [1430, 1430] },
      drum: { small: [1216, 750], medium: [1600, 1000], large: [2112, 1300] },
    };
    for (const arena of ARENAS) {
      for (const size of ['small', 'medium', 'large'] as const) {
        expect(freePlayArenaSize(arena, size)).toEqual({ width: want[arena][size]?.[0], height: want[arena][size]?.[1] });
        for (let i = 0; i < 12; i++) {
          const d = freePlayLevel({ arena, barriers: i % 2 === 1, seed: seedAt(i), config: cfg({ size, bosses: 'every3' }) });
          expect([d.arena.width, d.arena.height]).toEqual(want[arena][size]);
          if (arena === 'drum') expect(d.arena.width % 64).toBe(0);
          expect(d.freePlay?.retries).toBeLessThanOrEqual(3);
          expectValid(d, i < 3 ? SEGMENTS : [0, 6]);
        }
      }
    }
  });

  it('FP2 catches a size that does not match the option', () => {
    const d = structuredClone(freePlayLevel({ arena: 'rect', barriers: false, seed: 1, config: cfg({ size: 'large' }) }));
    d.arena.width = 1600;
    d.arena.height = 1000;
    expect(ids(validateFreePlay(d).errors)).toContain('FP2');
  });
});

describe('determinism', () => {
  const full = cfg({ enemies: ['grunt', 'dart', 'swirl'], density: 'swarm', bosses: 'every3', wells: 'many', size: 'large' });

  it('same seed and config give equal defs and segments; a different seed differs', () => {
    for (const arena of ARENAS) {
      const a = freePlayLevel({ arena, barriers: true, seed: 99, config: full });
      const b = freePlayLevel({ arena, barriers: true, seed: 99, config: { ...full } });
      expect(a).toEqual(b);
      for (const s of [0, 6, 12]) expect(freePlaySegment(a, s)).toEqual(freePlaySegment(b, s));
      expect(levelHash(freePlayLevel({ arena, barriers: true, seed: 100, config: full }))).not.toBe(levelHash(a));
      expectValid(a);
    }
  });

  it('FP5 catches a segment roster that is not the chosen kinds', () => {
    const d = freePlayLevel({ arena: 'rect', barriers: false, seed: 2, config: full });
    const seg = structuredClone(freePlaySegment(d, 1)) as EndlessSegmentDef;
    seg.roster = [...seg.roster, { kind: 'snake', weight: 1 }];
    expect(ids(validateFreePlaySegment(seg, d).errors)).toContain('FP5');
  });

  it('never calls Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random called');
    });
    for (const arena of ARENAS) {
      const d = freePlayLevel({ arena, barriers: true, seed: 77, config: full });
      freePlaySegment(d, 0);
      freePlaySegment(d, 6);
    }
  });
});
