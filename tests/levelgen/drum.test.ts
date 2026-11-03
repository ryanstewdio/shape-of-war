// Drum layouts (G3H, G10): four cylinder patterns drawn from the surface stream. Flat levels and
// open drums stay byte identical to main; every pattern is valid and leaves a path between rims.
import { describe, expect, it } from 'vitest';
import {
  CYLINDER_MAX_OBSTACLES,
  CYLINDER_WIDTH_STEP,
  cylDist,
  cylObstacleDistance,
  cylObstacleGap,
  drumConnected,
  drumFlood,
  seamJoined,
} from '../../src/levelgen/cylinder';
import {
  DRUM_BAR_THICK,
  DRUM_PATTERNS,
  DRUM_PATTERN_WEIGHTS,
  PILLARS_MAX,
  PILLARS_MIN,
  RING_GAP_MAX,
  RING_GAP_MIN,
  RING_V_MIN,
  cutAtSeam,
  narrowWidth,
  pillarLayout,
  pillarRows,
  ringPieces,
  ringRows,
} from '../../src/levelgen/drum';
import type { DrumPattern } from '../../src/levelgen/drum';
import { drumPatternFor, generateLevel, levelHash } from '../../src/levelgen/generator';
import { DEFAULT_GEN_CONFIG, GENERATOR_VERSION_V6, GENERATOR_VERSION_V8, V3_GEN_CONFIG, V4_GEN_CONFIG, V5_GEN_CONFIG, V6_GEN_CONFIG, fmix32, levelSeed } from '../../src/levelgen/leveldef';
import type { ArenaDef, LevelDef } from '../../src/levelgen/leveldef';
import {
  CONNECT_CLEARANCE,
  OBSTACLE_SPAWN_CLEAR,
  SPAWNER_SPAWN_WIDTH_FRACTION,
  WELL_SPAWN_FLOOR,
  WELL_SPAWN_WIDTH_FRACTION,
  validateLevel,
} from '../../src/levelgen/validate';
import { BOSS_EVERY } from '../../src/levelgen/boss';

const fold = (h: number, hash: string, i: number): number => fmix32((h ^ parseInt(hash, 16)) + i);
const hex = (h: number): string => h.toString(16).toUpperCase().padStart(8, '0');
const pairSeed = (i: number): number => Math.imul(i + 1, 2654435761) >>> 0;
const ids = (errs: readonly string[]): string[] => errs.map((e) => e.slice(0, e.indexOf(':')));
const COARSE = 64;

/** Seed 42 level per pattern, for the device check (?seed=42&level=n). */
// Release polish (long levels, generator version 5, ring membranes) moved every hash: was open
// FD31D371, rings 8FCFD3FB, pillars F383CDC7, narrow 0D7137CC.
const EXAMPLES: Record<DrumPattern, { level: number; hash: string }> = {
  open: { level: 18, hash: '1D71AE37' },
  rings: { level: 12, hash: 'CA85076C' },
  pillars: { level: 16, hash: 'AC6E0C94' },
  narrow: { level: 27, hash: 'E3CF397C' },
};

/** Recorded on main at 8d5c989 before this change (same pairs, same fold). */
const MAIN_FLAT_ON_DIGEST = 'A1EAC2E1';
const MAIN_FLAT_ON_COUNT = 1556;
const MAIN_OPEN_DIGEST = '5DE5174A';
const MAIN_OPEN_COUNT = 162;

const rect = (width: number, height: number, obstacles: ArenaDef['obstacles'] = []): ArenaDef => ({
  shape: obstacles.length > 0 ? 'rectObstacles' : 'rect',
  width,
  height,
  cornerRadius: 0,
  obstacles,
  spawnPoint: { x: 0, y: 0 },
});

describe('drum geometry helpers', () => {
  it('cylObstacleGap wraps across the seam; seamJoined spots the two halves of a cut bar', () => {
    const a = { cx: 700, cy: 300, w: 160, h: 24 };
    const b = { cx: -700, cy: 300, w: 160, h: 24 };
    expect(cylObstacleGap(a, b, 1600)).toBeCloseTo(40, 9);
    const left = { cx: 750, cy: 300, w: 100, h: 24 };
    const right = { cx: -760, cy: 300, w: 80, h: 24 };
    expect(seamJoined(left, right, 1600)).toBe(true);
    expect(seamJoined(right, left, 1600)).toBe(true);
    expect(seamJoined(left, { ...right, cy: 280 }, 1600)).toBe(false);
    expect(seamJoined(a, b, 1600)).toBe(false);
  });

  it('cutAtSeam keeps a bar whole inside the range and cuts one that crosses W/2', () => {
    expect(cutAtSeam(-100, 300, 1600)).toEqual([[-100, 200]]);
    expect(cutAtSeam(700, 300, 1600)).toEqual([
      [700, 800],
      [-800, -600],
    ]);
    expect(cutAtSeam(2300, 100, 1600)).toEqual([[700, 800]]);
  });

  it('ringPieces leaves exactly the gaps and nothing else round the drum', () => {
    const W = 1600;
    const pieces = ringPieces(300, [0, 800], [200, 160], W);
    const cover = pieces.reduce((s, o) => s + o.w, 0);
    expect(cover).toBe(W - 360);
    for (const o of pieces) {
      expect(o.cx - o.w / 2).toBeGreaterThanOrEqual(-W / 2);
      expect(o.cx + o.w / 2).toBeLessThanOrEqual(W / 2);
      expect(o.h).toBe(DRUM_BAR_THICK);
    }
  });

  it('ringRows: two mirrored rows, a third only when one side has room, all clear of spawn', () => {
    expect(ringRows(760, true, true)).toHaveLength(2);
    expect(ringRows(1100, false, true)).toHaveLength(2);
    const three = ringRows(1100, true, false);
    expect(three).toHaveLength(3);
    for (const v of three) expect(Math.abs(v)).toBeGreaterThanOrEqual(RING_V_MIN);
  });

  it('pillarRows and pillarLayout keep spawn clearance, edge gap and a checker of rows', () => {
    for (const H of [760, 780, 800, 1000, 1100]) {
      const { len, a } = pillarRows(H);
      expect(a - len / 2).toBeGreaterThanOrEqual(OBSTACLE_SPAWN_CLEAR);
      expect(a + len / 2).toBeLessThanOrEqual(H / 2 - 80);
    }
    const ps = pillarLayout(1216, 860, 8, 30);
    for (const o of ps) expect(cylObstacleDistance(o, { x: 0, y: 0 }, 1216)).toBeGreaterThanOrEqual(OBSTACLE_SPAWN_CLEAR);
    expect(new Set(ps.map((o) => o.cy)).size).toBe(3);
  });

  it('narrowWidth is the least multiple of 64 at aspect 1', () => {
    expect(narrowWidth(760)).toBe(768);
    expect(narrowWidth(960)).toBe(960);
    expect(narrowWidth(1100)).toBe(1152);
  });

  it('drumFlood: a closed ring seals the rims apart, a gap reopens them, a wall across the seam blocks', () => {
    const W = 1280;
    const H = 860;
    const open = rect(W, H);
    expect(drumConnected(open, COARSE, CONNECT_CLEARANCE)).toBe(true);
    const closed = rect(W, H, ringPieces(300, [0], [0], W));
    const f = drumFlood(closed, COARSE, CONNECT_CLEARANCE);
    expect(f.top).toBe(false);
    expect(f.bottom).toBe(true);
    const gapped = rect(W, H, ringPieces(300, [W / 2], [160], W));
    expect(drumConnected(gapped, COARSE, CONNECT_CLEARANCE)).toBe(true);
    // The gap sits on the seam: the flood has to wrap to find it.
    expect(drumFlood(gapped, COARSE, CONNECT_CLEARANCE).top).toBe(true);
  });
});

describe('validator on drum layouts', () => {
  const pillars = (): LevelDef => structuredClone(generateLevel(42, EXAMPLES.pillars.level));
  const rings = (): LevelDef => structuredClone(generateLevel(42, EXAMPLES.rings.level));

  it('accepts more than three bars on a cylinder but not on a flat level', () => {
    const d = pillars();
    expect(d.arena.obstacles.length).toBeGreaterThan(3);
    expect(validateLevel(d, DEFAULT_GEN_CONFIG).errors).toEqual([]);
    const tooMany = pillars();
    const o = tooMany.arena.obstacles[0];
    if (o === undefined) throw new Error('no pillar');
    tooMany.arena = { ...tooMany.arena, obstacles: Array.from({ length: CYLINDER_MAX_OBSTACLES + 1 }, () => o) };
    expect(ids(validateLevel(tooMany).errors)).toContain('A4');
  });

  it('rejects a bar that crosses the seam, a bar too near a rim, a sealed ring (A4, A6)', () => {
    const d = rings();
    const W = d.arena.width;
    const H = d.arena.height;
    const cross = rings();
    cross.arena = { ...cross.arena, obstacles: [{ cx: W / 2 - 10, cy: 300, w: 100, h: 24 }] };
    expect(ids(validateLevel(cross).errors)).toContain('A4');
    const rim = rings();
    rim.arena = { ...rim.arena, obstacles: [{ cx: 0, cy: H / 2 - 40, w: 200, h: 24 }] };
    expect(ids(validateLevel(rim).errors)).toContain('A4');
    const sealed = rings();
    sealed.arena = { ...sealed.arena, obstacles: ringPieces(RING_V_MIN + 20, [100], [0], W) };
    sealed.hazards = { wells: [], spawners: [] };
    expect(ids(validateLevel(sealed).errors)).toContain('A6');
  });

  it('a bar cut at the seam passes A5; two separate bars that close across the seam do not', () => {
    const d = rings();
    const W = d.arena.width;
    d.hazards = { wells: [], spawners: [] };
    d.arena = { ...d.arena, obstacles: ringPieces(300, [0], [200], W) };
    expect(d.arena.obstacles).toHaveLength(2);
    expect(validateLevel(d).errors.filter((e) => e.startsWith('A5:'))).toEqual([]);
    const near = structuredClone(d);
    near.arena = { ...near.arena, obstacles: [{ cx: W / 2 - 100, cy: 300, w: 160, h: 24 }, { cx: -W / 2 + 100, cy: 300, w: 160, h: 24 }] };
    expect(ids(validateLevel(near).errors)).toContain('A5');
  });
});

describe('drum patterns in the generator', () => {
  it('pattern weights hold over 4000 seeds by levels 11 to 60', () => {
    const counts: Record<DrumPattern, number> = { open: 0, rings: 0, pillars: 0, narrow: 0 };
    let total = 0;
    for (let s = 0; s < 4000; s++) {
      const runSeed = Math.imul(s + 7, 0x9e3779b1) >>> 0;
      for (let n = 11; n <= 60; n++) {
        const seed = levelSeed(runSeed, n);
        const p = drumPatternFor(seed, n);
        expect(drumPatternFor(seed, n, V3_GEN_CONFIG)).toBeNull();
        if (p === null) continue;
        counts[p]++;
        total++;
      }
    }
    expect(total).toBeGreaterThan(50000);
    for (const p of DRUM_PATTERNS) {
      const share = counts[p] / total;
      expect(share, p).toBeGreaterThan(DRUM_PATTERN_WEIGHTS[p] / 100 - 0.01);
      expect(share, p).toBeLessThan(DRUM_PATTERN_WEIGHTS[p] / 100 + 0.01);
    }
  });

  it('every cylinder level in 11 to 60 for 500 seeds is valid, has a path between rims and keeps its pattern', () => {
    const seen: Record<DrumPattern, number> = { open: 0, rings: 0, pillars: 0, narrow: 0 };
    for (let s = 0; s < 500; s++) {
      const runSeed = (1 + s * 2654435761) >>> 0;
      for (let n = 11; n <= 60; n++) {
        if (n % BOSS_EVERY === 0) continue;
        const p = drumPatternFor(levelSeed(runSeed, n), n);
        if (p === null) continue;
        seen[p]++;
        expectDrum(generateLevel(runSeed, n), p);
      }
    }
    for (const p of DRUM_PATTERNS) expect(seen[p], p).toBeGreaterThan(800);
  }, 600000);

  // Release polish: the two byte identity sweeps below pin the v4 drum stage, so they run on
  // V4_GEN_CONFIG (the default with the long levels off).
  it('flat levels with the flag on and open drums are byte identical to main', () => {
    let flat = 0;
    let nFlat = 0;
    let open = 0;
    let nOpen = 0;
    for (let i = 0; i < 2000; i++) {
      const seed = pairSeed(i);
      const d = generateLevel(seed, 1 + (i % 60), V4_GEN_CONFIG);
      if (d.surface === 'flat') flat = fold(flat, levelHash(d), nFlat++);
      const n = 11 + (i % 50);
      if (drumPatternFor(levelSeed(seed, n), n, V4_GEN_CONFIG) === 'open') open = fold(open, levelHash(generateLevel(seed, n, V4_GEN_CONFIG)), nOpen++);
    }
    expect([hex(flat), nFlat]).toEqual([MAIN_FLAT_ON_DIGEST, MAIN_FLAT_ON_COUNT]);
    expect([hex(open), nOpen]).toEqual([MAIN_OPEN_DIGEST, MAIN_OPEN_COUNT]);
  }, 300000);

  it('enableCylinder false: every level is flat, has no drum pattern and matches the flag on flat level', () => {
    for (let i = 0; i < 300; i++) {
      const seed = pairSeed(i);
      const n = 11 + (i % 50);
      const off = generateLevel(seed, n, V3_GEN_CONFIG);
      expect(off.surface).toBe('flat');
      expect(drumPatternFor(levelSeed(seed, n), n, V3_GEN_CONFIG)).toBeNull();
      const on = generateLevel(seed, n, V4_GEN_CONFIG);
      if (on.surface === 'flat') expect(JSON.stringify(on)).toBe(JSON.stringify(off));
    }
  }, 120000);

  it('seed 42 has one level per pattern for the device check (version 5)', () => {
    for (const p of DRUM_PATTERNS) {
      const { level, hash } = EXAMPLES[p];
      expect(drumPatternFor(levelSeed(42, level), level, V5_GEN_CONFIG), `level ${level}`).toBe(p);
      const d = generateLevel(42, level, V5_GEN_CONFIG);
      expect(levelHash(d), `${p} level ${level}`).toBe(hash);
      expectDrum(d, p);
    }
  });
});

/** The config that builds a long level of this version (8: default, 6: V6, else V5). */
const configOfVersion = (v: number): typeof DEFAULT_GEN_CONFIG =>
  v === GENERATOR_VERSION_V8 ? DEFAULT_GEN_CONFIG : v === GENERATOR_VERSION_V6 ? V6_GEN_CONFIG : V5_GEN_CONFIG;

function expectDrum(d: LevelDef, p: DrumPattern): void {
  const at = `seed ${d.runSeed} level ${d.levelIndex} ${p}`;
  const a = d.arena;
  const W = a.width;
  expect(d.surface, at).toBe('cylinder');
  expect(W % CYLINDER_WIDTH_STEP, at).toBe(0);
  expect(validateLevel(d, configOfVersion(d.generatorVersion)).errors, at).toEqual([]);
  expect(d.retries, at).toBe(0);
  const flood = drumFlood(a, COARSE, CONNECT_CLEARANCE);
  expect(flood.top && flood.bottom, `${at} rims reachable`).toBe(true);
  if (p === 'narrow') {
    expect(a.shape, at).toBe('rect');
    expect(W, at).toBe(narrowWidth(a.height));
  }
  if (p === 'rings') {
    expect(a.shape, at).toBe('rectObstacles');
    const rows = new Set(a.obstacles.map((o) => o.cy));
    expect([2, 3], at).toContain(rows.size);
    for (const v of rows) {
      const bars = a.obstacles.filter((o) => o.cy === v);
      const cover = bars.reduce((s, o) => s + o.w, 0);
      expect(W - cover, `${at} ring ${v} gap total`).toBeGreaterThanOrEqual(RING_GAP_MIN);
      expect(W - cover, `${at} ring ${v} gap total`).toBeLessThanOrEqual(2 * RING_GAP_MAX);
    }
  }
  if (p === 'pillars') {
    expect(a.shape, at).toBe('rectObstacles');
    expect(a.obstacles.length, at).toBeGreaterThanOrEqual(PILLARS_MIN);
    expect(a.obstacles.length, at).toBeLessThanOrEqual(PILLARS_MAX);
    for (const o of a.obstacles) expect(o.w, at).toBe(DRUM_BAR_THICK);
    expect(a.obstacles.some((o) => o.cx < 0) && a.obstacles.some((o) => o.cx > 0), `${at} pillars both sides of the seam`).toBe(true);
  }
  // Spawn, wells and spawners at legal wrapped distances (the validator checks too; this names them).
  const wellMin = Math.max(WELL_SPAWN_WIDTH_FRACTION * W, WELL_SPAWN_FLOOR);
  for (const w of d.hazards.wells) expect(cylDist(w, a.spawnPoint, W), at).toBeGreaterThanOrEqual(wellMin);
  for (const s of d.hazards.spawners) expect(cylDist(s, a.spawnPoint, W), at).toBeGreaterThanOrEqual(SPAWNER_SPAWN_WIDTH_FRACTION * W);
  for (const o of a.obstacles) expect(cylObstacleDistance(o, a.spawnPoint, W), at).toBeGreaterThanOrEqual(OBSTACLE_SPAWN_CLEAR);
}
