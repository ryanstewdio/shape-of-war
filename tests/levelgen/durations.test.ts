// Release polish (docs/14 items 7 and 9): long levels and ring membranes. Expected duration per
// level over 500 seeds, no wave repeat within 90 s, the paced ramp, the boss entrance at 240 s,
// membranes placed and valid, the flag off configs, and the pure pacing helpers.
import { describe, expect, it } from 'vitest';
import { BOSS_LONG_LEVEL_AT_SEC, BOSS_EVERY } from '../../src/levelgen/boss';
import { DRUM_BAR_THICK, MEMBRANE_MAX, MEMBRANE_MIN, addMembranes, ringPieces } from '../../src/levelgen/drum';
import {
  computePar,
  drumPatternFor,
  generateEndless,
  generateEndlessSegment,
  generateLevel,
  levelHash,
  longPulse,
  scaledTarget,
} from '../../src/levelgen/generator';
import {
  BANDS,
  DEFAULT_GEN_CONFIG,
  GENERATOR_VERSION_V5,
  GENERATOR_VERSION_V6,
  GENERATOR_VERSION_V7,
  LONG_BANDS,
  LONG_CALM_SEC,
  LONG_MIN_LEVEL_SEC,
  LONG_MIN_REPEAT_SEC,
  V1_GEN_CONFIG,
  V2_GEN_CONFIG,
  V3_GEN_CONFIG,
  V4_GEN_CONFIG,
  V5_GEN_CONFIG,
  V6_GEN_CONFIG,
  bandOf,
  expandSpawns,
  levelSeed,
} from '../../src/levelgen/leveldef';
import type { Band, GenConfig, LevelDef, Obstacle, WaveSchedule } from '../../src/levelgen/leveldef';
import {
  BREATHER_BUDGET,
  BUILD_BUDGET_PEAK,
  CALM_BUDGET,
  destroyClearSec,
  destroyCountFor,
  estimateDuration,
  nearestRepeatSec,
  pulseAt,
  spawnsBefore,
  spawnsNeeded,
} from '../../src/levelgen/pacing';
import { KILL_RATE, MAX_EST_SEC, validateLevel } from '../../src/levelgen/validate';

const SPREAD = 2654435761;
const seedAt = (i: number): number => (7 + i * SPREAD) >>> 0;
const ids = (errors: readonly string[]): string[] => [...new Set(errors.map((e) => e.split(':')[0] ?? ''))];
const isBoss = (n: number): boolean => n % BOSS_EVERY === 0;
const copy = (d: LevelDef): LevelDef => structuredClone(d);

/** 500 seeds; seed i plays levels (i mod 10) + 1 + 10k for k 0 to 4, so each of 1 to 50 sees 50 seeds. */
const SEEDS = 500;
interface Row {
  seed: number;
  n: number;
  def: LevelDef;
}
const rows: Row[] = [];
for (let i = 0; i < SEEDS; i++) for (let k = 0; k < 5; k++) rows.push({ seed: seedAt(i), n: (i % 10) + 1 + 10 * k, def: generateLevel(seedAt(i), (i % 10) + 1 + 10 * k, V6_GEN_CONFIG) });

describe('expected duration over 500 seeds (R2 config, V6_GEN_CONFIG; R3 in r3length.test.ts)', () => {
  it('every non boss level needs at least 300 s, and each level index averages at least 300 s', () => {
    const bad: string[] = [];
    const sum = new Map<number, { t: number; c: number }>();
    for (const { seed, n, def } of rows) {
      if (isBoss(n)) continue;
      const e = estimateDuration(def);
      if (e.boss || e.wavesSec < LONG_MIN_LEVEL_SEC) bad.push(`seed ${seed} level ${n}: ${e.wavesSec} s`);
      const s = sum.get(n) ?? { t: 0, c: 0 };
      sum.set(n, { t: s.t + e.wavesSec, c: s.c + 1 });
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(sum.size).toBe(40);
    for (const [n, s] of sum) expect(s.t / s.c, `level ${n} mean`).toBeGreaterThanOrEqual(LONG_MIN_LEVEL_SEC);
  });

  it('every boss level has at least 200 s of waves before the boss, which enters at 200 s (R2; v5 240 s)', () => {
    expect(BOSS_LONG_LEVEL_AT_SEC).toBe(200);
    const bad: string[] = [];
    let n5 = 0;
    for (const { seed, n, def } of rows) {
      if (!isBoss(n)) continue;
      n5++;
      const e = estimateDuration(def);
      if (!e.boss || def.boss?.atSec !== BOSS_LONG_LEVEL_AT_SEC || e.wavesSec < BOSS_LONG_LEVEL_AT_SEC) bad.push(`seed ${seed} level ${n}: ${e.wavesSec} s, boss at ${String(def.boss?.atSec)}`);
      // The objective is not met before the entrance, so no hold brings the boss in early.
      const o = def.objective;
      const t = o.kind === 'survive' ? o.durationSec : o.kind === 'scoreInTime' ? o.timeLimitSec : destroyClearSec(def.waves, o.count);
      if (t < BOSS_LONG_LEVEL_AT_SEC) bad.push(`seed ${seed} level ${n}: objective met at ${t} s`);
    }
    expect(n5).toBe(SEEDS);
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('no wave plays again within 90 s, up to the estimated end and up to 600 s', () => {
    const bad: string[] = [];
    for (const { seed, n, def } of rows) {
      expect(def.waves.loopPeriodSec).toBeGreaterThanOrEqual(LONG_MIN_REPEAT_SEC);
      if (nearestRepeatSec(def.waves, MAX_EST_SEC) < LONG_MIN_REPEAT_SEC) bad.push(`seed ${seed} level ${n}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('objectives sit in the long band ranges: survive and scoreInTime 300 to 360 s, levels 1 to 5 at 300 s', () => {
    for (const { n, def } of rows) {
      const o = def.objective;
      const l = LONG_BANDS[bandOf(n)];
      if (o.kind === 'survive') expect(o.durationSec).toBeGreaterThanOrEqual(l.surviveSec.min);
      if (o.kind === 'survive') expect(o.durationSec).toBeLessThanOrEqual(Math.min(360, l.surviveSec.max));
      if (o.kind === 'scoreInTime') expect(o.timeLimitSec).toBeGreaterThanOrEqual(300);
      if (o.kind === 'scoreInTime') expect(o.timeLimitSec).toBeLessThanOrEqual(360);
      if (n <= 5 && o.kind !== 'destroy') expect(o.kind === 'survive' ? o.durationSec : o.timeLimitSec).toBe(300);
    }
  });

  it('every level validates with V6_GEN_CONFIG, needs no re-derive and is version 6 (R1; R2 boss levels 7)', () => {
    const bad: string[] = [];
    for (const { seed, n, def } of rows) {
      const e = validateLevel(def, V6_GEN_CONFIG).errors;
      if (e.length > 0 || def.retries !== 0 || def.generatorVersion !== (isBoss(n) ? GENERATOR_VERSION_V7 : GENERATOR_VERSION_V6)) bad.push(`seed ${seed} level ${n}: ${e.join('; ')} r${String(def.retries)}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  }, 60_000); // validating 500 long levels takes about 5.5 s on the cloud VM, over the 5 s default
});

/** Spawns per second over [a, b). */
function rate(w: WaveSchedule, a: number, b: number): number {
  return (spawnsBefore(w, b) - spawnsBefore(w, a)) / (b - a);
}

describe('paced ramp', () => {
  it('pulseAt: calm first minute, a build to the peak, then a breather, every peakEverySec', () => {
    const s = { calmSec: 60, peakEverySec: 80, breatherSec: 10 };
    expect(pulseAt(s, 0)).toEqual({ budget: CALM_BUDGET, interval: 1.25 });
    expect(pulseAt(s, 59.9).budget).toBe(CALM_BUDGET);
    expect(pulseAt(s, 60).budget).toBeCloseTo(0.85);
    expect(pulseAt(s, 129.9).budget).toBeCloseTo(BUILD_BUDGET_PEAK, 2);
    expect(pulseAt(s, 130)).toEqual({ budget: BREATHER_BUDGET, interval: 1.6 });
    expect(pulseAt(s, 139.9).budget).toBe(BREATHER_BUDGET);
    expect(pulseAt(s, 140).budget).toBeCloseTo(0.85);
    expect(pulseAt(s, 209.9).budget).toBeCloseTo(BUILD_BUDGET_PEAK, 2);
    for (const b of [1, 2, 3, 4] as const) {
      const p = longPulse(LONG_BANDS[b]).peakEverySec;
      expect(p).toBeGreaterThanOrEqual(60);
      expect(p).toBeLessThanOrEqual(90);
    }
  });

  it('generated levels: the first minute is calmer than the later peaks, and a breather follows each peak', () => {
    let calmer = 0;
    let breathers = 0;
    let total = 0;
    for (const { n, def } of rows.slice(0, 600)) {
      const p = LONG_BANDS[bandOf(n)].peakEverySec;
      const w = def.waves;
      const peakEnd = LONG_CALM_SEC + 2 * p - 10;
      total++;
      if (rate(w, 2.5, LONG_CALM_SEC) < rate(w, peakEnd - 20, peakEnd)) calmer++;
      if (rate(w, peakEnd, peakEnd + 10) < rate(w, peakEnd - 10, peakEnd)) breathers++;
    }
    expect(calmer / total).toBeGreaterThan(0.95);
    expect(breathers / total).toBeGreaterThan(0.8);
  });
});

describe('destroy sizing and the scoreInTime target', () => {
  const w = generateLevel(42, 13).waves;

  it('destroyCountFor: a multiple of 5 whose needed spawn comes at or after the clear second', () => {
    for (const clear of [300, 315, 345, 360]) {
      const c = destroyCountFor(w, clear);
      expect(c % 5).toBe(0);
      expect(spawnsNeeded(c)).toBeGreaterThan(spawnsBefore(w, clear));
      expect(destroyClearSec(w, c)).toBeGreaterThanOrEqual(clear);
      // The least such count: 5 fewer clears before the second.
      expect(spawnsNeeded(c - 5)).toBeLessThanOrEqual(spawnsBefore(w, clear));
    }
    expect(spawnsNeeded(70)).toBe(Math.ceil(70 / KILL_RATE));
  });

  it('destroyClearSec: the time of the needed spawn, MAX_EST_SEC when it never comes', () => {
    const all = expandSpawns(w, MAX_EST_SEC);
    expect(destroyClearSec(w, 7)).toBe(all[9]?.t);
    expect(destroyClearSec(w, 1e6)).toBe(MAX_EST_SEC);
  });

  it('scaledTarget: the legacy window target per second times the long limit, on the 500 grid, at most par', () => {
    const ref = computePar(w, { kind: 'scoreInTime', target: 1000, timeLimitSec: 90 }).target;
    const par = computePar(w, { kind: 'scoreInTime', target: 1000, timeLimitSec: 330 }).par;
    const t = scaledTarget(w, 330, 90, par);
    expect(t % 500).toBe(0);
    expect(t).toBeLessThanOrEqual(par);
    expect(Math.abs(t - (ref * 330) / 90)).toBeLessThanOrEqual(250);
    expect(scaledTarget(w, 330, 90, 1000)).toBe(1000);
  });
});

/** Rings drum levels of the default config: non boss levels 11 to 50 whose drum pattern is rings. */
function ringLevels(count: number): LevelDef[] {
  const out: LevelDef[] = [];
  for (let i = 0; out.length < count && i < 4000; i++) {
    const seed = seedAt(i);
    const n = 11 + (i % 40);
    if (drumPatternFor(levelSeed(seed, n), n) === 'rings') out.push(generateLevel(seed, n));
  }
  return out;
}

/** Ring rows of a drum: v of every horizontal bar. */
const ringRows = (obs: readonly Obstacle[]): number[] => [...new Set(obs.filter((o) => o.w > o.h).map((o) => o.cy))];

describe('membranes', () => {
  const rings = ringLevels(150);

  it('every ring of a rings drum gets 1 or 2 membranes, 120 to 200 u wide, beside a bar, and the level validates', () => {
    expect(rings.length).toBe(150);
    for (const d of rings) {
      const at = `seed ${d.runSeed} level ${d.levelIndex}`;
      expect(validateLevel(d, DEFAULT_GEN_CONFIG).errors, at).toEqual([]);
      for (const v of ringRows(d.arena.obstacles)) {
        const m = d.arena.obstacles.filter((o) => o.cy === v && o.membrane === true);
        expect(m.length, `${at} ring ${v}`).toBeGreaterThanOrEqual(1);
        expect(m.length, `${at} ring ${v}`).toBeLessThanOrEqual(2);
        for (const o of m) {
          expect(o.w).toBeGreaterThanOrEqual(MEMBRANE_MIN);
          expect(o.w).toBeLessThanOrEqual(MEMBRANE_MAX);
          expect(o.h).toBe(DRUM_BAR_THICK);
          expect(Object.keys(o)).toEqual(['cx', 'cy', 'w', 'h', 'membrane']);
        }
      }
    }
  });

  it('no membrane on a flat level, a pillars, open or narrow drum, or with the long levels off', () => {
    for (const { def } of rows) if (def.surface === 'flat' || drumPatternFor(def.seed, def.levelIndex) !== 'rings') expect(def.arena.obstacles.some((o) => o.membrane !== undefined)).toBe(false);
    for (const d of rings) expect(generateLevel(d.runSeed, d.levelIndex, V4_GEN_CONFIG).arena.obstacles.some((o) => o.membrane !== undefined)).toBe(false);
  });

  it('the rings keep their bars and open gaps: removing the membranes leaves the flag off drum layout covered', () => {
    for (const d of rings.slice(0, 40)) {
      const off = generateLevel(d.runSeed, d.levelIndex, { ...DEFAULT_GEN_CONFIG, enableLongLevels: false });
      // R1 raises the drum share to 40 percent: a level drawn between 35 and 40 is flat with the flag off.
      if (off.surface !== 'cylinder') continue;
      // Same rows; every membrane lies inside a flag off bar (the flag off drum has the same draws).
      expect(ringRows(d.arena.obstacles).sort()).toEqual(ringRows(off.arena.obstacles).sort());
      expect(d.arena.obstacles.filter((o) => o.membrane !== true).length).toBe(off.arena.obstacles.length);
    }
  });

  it('M1 rejects a membrane on a flat level, of the wrong size, three in a ring, not true, or on version 4', () => {
    const base = rings[0];
    if (base === undefined) throw new Error('no rings level');
    expect(validateLevel(base).errors).toEqual([]);
    const flat = copy(generateLevel(42, 13));
    const bar: Obstacle = { cx: 0, cy: 300, w: 160, h: DRUM_BAR_THICK, membrane: true };
    flat.arena = { ...flat.arena, shape: 'rectObstacles', obstacles: [bar] };
    expect(ids(validateLevel(flat).errors)).toContain('M1');
    const idx = base.arena.obstacles.findIndex((o) => o.membrane === true);
    const wide = copy(base);
    const m = wide.arena.obstacles[idx];
    if (m === undefined) throw new Error('no membrane');
    wide.arena.obstacles[idx] = { ...m, w: 260 };
    expect(ids(validateLevel(wide).errors)).toContain('M1');
    const notTrue = copy(base);
    (notTrue.arena.obstacles[idx] as unknown as { membrane: unknown }).membrane = false;
    expect(ids(validateLevel(notTrue).errors)).toContain('M1');
    const three = copy(base);
    three.arena.obstacles.push({ ...m }, { ...m });
    expect(ids(validateLevel(three).errors)).toContain('M1');
    const v4 = copy(base);
    v4.generatorVersion = 4;
    expect(ids(validateLevel(v4).errors)).toContain('M1');
  });

  it('addMembranes: deterministic, keeps the bar count, leaves seam halves at least 80 u of solid', () => {
    const W = 1280;
    const bars = [...ringPieces(-300, [600], [200], W), ...ringPieces(300, [100, 740], [160, 240], W)];
    let k = 1;
    const r = (): number => ((k = (k * 48271) % 2147483647) / 2147483647);
    const out = addMembranes(r, bars, W);
    k = 1;
    expect(addMembranes(r, bars, W)).toEqual(out);
    expect(out.filter((o) => o.membrane !== true).length).toBe(bars.length);
    for (const o of out) {
      if (o.membrane === true) continue;
      const seam = o.cx - o.w / 2 <= -W / 2 || o.cx + o.w / 2 >= W / 2;
      const orig = bars.find((b) => b.cy === o.cy && Math.abs(b.cx - o.cx) <= b.w / 2);
      if (seam && orig !== undefined && orig.w !== o.w) expect(o.w).toBeGreaterThanOrEqual(80);
    }
    for (const v of [-300, 300]) expect(out.filter((o) => o.cy === v && o.membrane === true).length).toBeGreaterThanOrEqual(1);
  });
});

describe('flags, versions and Endless', () => {
  it('only the default turns the long levels on; V1, V2, V3 and V4 leave them off', () => {
    expect(DEFAULT_GEN_CONFIG.enableLongLevels).toBe(true);
    for (const c of [V1_GEN_CONFIG, V2_GEN_CONFIG, V3_GEN_CONFIG, V4_GEN_CONFIG]) expect(c.enableLongLevels).toBe(false);
    // forge-leaver: the legacy configs also turn the Leaver off.
    expect({ ...V4_GEN_CONFIG, enableLongLevels: true, enableR1Pacing: true, enableR3Length: true, enableLeaver: true }).toEqual(DEFAULT_GEN_CONFIG);
    expect({ ...V5_GEN_CONFIG, enableR1Pacing: true, enableR3Length: true, enableLeaver: true }).toEqual(DEFAULT_GEN_CONFIG);
    expect({ ...V6_GEN_CONFIG, enableR3Length: true, enableLeaver: true }).toEqual(DEFAULT_GEN_CONFIG);
    expect(V5_GEN_CONFIG.enableLongLevels).toBe(true);
  });

  it('a config without the field (an older literal) builds the flag off level', () => {
    const older: GenConfig = { ...DEFAULT_GEN_CONFIG };
    delete older.enableLongLevels;
    delete older.enableLeaver; // forge-leaver: an older literal has neither field
    for (const n of [1, 5, 13, 22]) expect(levelHash(generateLevel(42, n, older))).toBe(levelHash(generateLevel(42, n, V4_GEN_CONFIG)));
  });

  it('J8 ties version 5 to the flag when the caller says', () => {
    const on = copy(generateLevel(42, 13));
    expect(validateLevel(on, DEFAULT_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(on, V4_GEN_CONFIG).errors)).toContain('J8');
    const off = generateLevel(42, 13, V4_GEN_CONFIG);
    expect(ids(validateLevel(off, DEFAULT_GEN_CONFIG).errors)).toContain('J8');
    expect(validateLevel(off, V4_GEN_CONFIG).errors).toEqual([]);
  });

  it('O1 and W11 reject a long level with a legacy objective or a short loop; B3 rejects the boss at 20 s', () => {
    const short = copy(generateLevel(42, 12));
    short.objective = { kind: 'survive', durationSec: 60 };
    expect(ids(validateLevel(short).errors)).toContain('O1');
    const destroy = copy(generateLevel(42, 13));
    destroy.objective = { kind: 'destroy', count: 50 };
    expect(ids(validateLevel(destroy).errors)).toContain('O1');
    const loop = copy(generateLevel(42, 13));
    loop.waves.loopPeriodSec = 60;
    expect(ids(validateLevel(loop).errors)).toContain('W11');
    const boss = copy(generateLevel(42, 5));
    if (boss.boss === undefined) throw new Error('no boss');
    boss.boss = { ...boss.boss, atSec: 20 };
    expect(ids(validateLevel(boss).errors)).toContain('B3');
  });

  it('deterministic: the same level twice, and generation order does not matter', () => {
    const a = [3, 10, 27, 44].map((n) => levelHash(generateLevel(99, n)));
    const b = [44, 27, 10, 3].map((n) => levelHash(generateLevel(99, n))).reverse();
    expect(b).toEqual(a);
    expect(JSON.stringify(generateLevel(99, 27))).toBe(JSON.stringify(generateLevel(99, 27)));
  });

  it('Endless is unchanged by the flag', () => {
    for (const s of [0, 42, 0xdeadbeef]) {
      // forge-leaver: V4 has the Leaver off; Endless reads it, so compare with it on.
      const v4 = { ...V4_GEN_CONFIG, enableLeaver: true };
      expect(generateEndless(s)).toEqual(generateEndless(s, v4));
      for (const seg of [0, 6, 15, 30]) expect(generateEndlessSegment(s, seg)).toEqual(generateEndlessSegment(s, seg, v4));
    }
  });

  it('the long tables cover every band and stay within 300 to 360 s', () => {
    for (const b of [1, 2, 3, 4] as Band[]) {
      const l = LONG_BANDS[b];
      for (const r of [l.surviveSec, l.destroySec, l.scoreTimeSec]) {
        expect(r.min).toBeGreaterThanOrEqual(300);
        expect(r.max).toBeLessThanOrEqual(360);
      }
      expect((l.scoreTimeSec.max - l.scoreTimeSec.min) % 15).toBe(0);
      expect(BANDS[b].scoreTimeSec.max).toBeLessThan(l.scoreTimeSec.min);
    }
  });
});
