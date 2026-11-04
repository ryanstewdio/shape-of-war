// Release gate R2 (Ryan): boss levels. The boss enters at 200 s (was 240 s) and the waves before it
// get the version 6 pacing (no dead air, surges and swarms, the volume of a version 6 level of the
// same band). Boss levels stay flat, report version 7 and keep the version 5 par rule, and the
// fight itself keeps the version 5 waves. Every config before R1 is untouched. Since R3 these rows
// are built with V6_GEN_CONFIG; the version 8 boss rules (120 s, whole level par) are in
// r3length.test.ts.
import { describe, expect, it } from 'vitest';
import { BOSS_EVERY, BOSS_LONG_LEVEL_AT_SEC, BOSS_V5_LEVEL_AT_SEC } from '../../src/levelgen/boss';
import { bossLevelAtSec, canonicalJson, generateEndlessSegment, generateLevel, levelHash, longPulse } from '../../src/levelgen/generator';
import {
  DEFAULT_GEN_CONFIG,
  GENERATOR_VERSION_V3,
  GENERATOR_VERSION_V5,
  GENERATOR_VERSION_V7,
  LONG_BANDS,
  V1_GEN_CONFIG,
  V2_GEN_CONFIG,
  V3_GEN_CONFIG,
  V4_GEN_CONFIG,
  V5_GEN_CONFIG,
  V6_GEN_CONFIG,
  bandOf,
  fmix32,
} from '../../src/levelgen/leveldef';
import type { GenConfig, LevelDef } from '../../src/levelgen/leveldef';
import { DEAD_AIR_BREATHER_SEC, DEAD_AIR_FROM_SEC, DEAD_AIR_MAX_SEC, deadAirGaps, inBreather, spawnsBefore } from '../../src/levelgen/pacing';
import { validateLevel } from '../../src/levelgen/validate';

const SPREAD = 2654435761;
const seedAt = (i: number): number => (7 + i * SPREAD) >>> 0;
const ids = (errors: readonly string[]): string[] => [...new Set(errors.map((e) => e.split(':')[0] ?? ''))];
const BOSS_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const AT = BOSS_LONG_LEVEL_AT_SEC;

/** 100 seeds x the ten boss levels of pass 1, default config. */
const rows: { seed: number; n: number; def: LevelDef }[] = [];
for (let i = 0; i < 100; i++) for (const n of BOSS_LEVELS) rows.push({ seed: seedAt(i), n, def: generateLevel(seedAt(i), n, V6_GEN_CONFIG) });

/** Spawns per second over [a, b). */
const rate = (d: LevelDef, a: number, b: number): number => (spawnsBefore(d.waves, b) - spawnsBefore(d.waves, a)) / (b - a);

describe('R2 boss levels (V6_GEN_CONFIG, the default before R3)', { timeout: 120_000 }, () => {
  it('the boss enters at 200 s; version 5 long levels keep 240 s and short levels 20 s', () => {
    expect(AT).toBe(200);
    expect(BOSS_V5_LEVEL_AT_SEC).toBe(240);
    expect(bossLevelAtSec(V6_GEN_CONFIG)).toBe(200);
    expect(bossLevelAtSec(V5_GEN_CONFIG)).toBe(240);
    expect(bossLevelAtSec(V4_GEN_CONFIG)).toBe(20);
    for (const { def } of rows) expect(def.boss?.atSec).toBe(AT);
  });

  it('every boss level is flat, version 7, valid with no re-derive, with version 5 style stars', () => {
    const bad: string[] = [];
    for (const { seed, n, def } of rows) {
      const e = validateLevel(def, V6_GEN_CONFIG).errors;
      const okStars = def.stars[0] === def.par && def.stars[1] === 2 * def.par && def.stars[2] === 4 * def.par;
      if (e.length > 0 || def.retries !== 0 || def.surface !== 'flat' || def.generatorVersion !== GENERATOR_VERSION_V7 || !okStars) {
        bad.push(`seed ${seed} level ${n}: ${e.join('; ')} v${def.generatorVersion} ${String(def.surface)}`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('from 10 s to the boss never 3 s of dead air, except a breather of at most 4 s after a peak (the v6 rule; v5 had 5 s and more)', () => {
    const bad: string[] = [];
    let v5Worst = 0;
    for (const { seed, n, def } of rows) {
      const s = longPulse(LONG_BANDS[bandOf(n)]);
      for (const g of deadAirGaps(def.waves, DEAD_AIR_FROM_SEC, AT)) {
        if (g.lenSec <= DEAD_AIR_MAX_SEC) continue;
        const afterPeak = inBreather(s, g.startSec) || inBreather(s, g.startSec + g.lenSec - 0.01);
        if (!afterPeak || g.lenSec > DEAD_AIR_BREATHER_SEC) bad.push(`seed ${seed} level ${n}: ${g.lenSec.toFixed(1)} s at ${g.startSec.toFixed(1)}`);
      }
    }
    for (const { seed, n } of rows.slice(0, 50)) {
      const v5 = generateLevel(seed, n, V5_GEN_CONFIG);
      for (const g of deadAirGaps(v5.waves, DEAD_AIR_FROM_SEC, AT)) v5Worst = Math.max(v5Worst, g.lenSec);
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(v5Worst).toBeGreaterThan(5);
  });

  it('pre boss waves have surges and swarms', () => {
    let surge = 0;
    let swarm = 0;
    for (const { def } of rows) {
      const pre = def.waves.waves.filter((w) => w.atSec >= 60 && w.atSec < AT).map((w) => w.entries.length);
      const med = [...pre].sort((a, b) => a - b)[Math.floor(pre.length / 2)] ?? 0;
      if (pre.some((x) => x >= 2 * med)) surge++;
      const sw = def.waves.waves.some((w) => w.atSec < AT && w.entries.length >= 6 && (w.entries.every((e) => e.kind === 'dart') || w.entries.every((e) => e.kind === 'grunt')));
      if (sw) swarm++;
    }
    expect(surge / rows.length).toBeGreaterThan(0.95);
    expect(swarm / rows.length).toBeGreaterThan(0.8);
  });

  it('pre boss volume is that of a version 6 level of the same band, and well above version 5', () => {
    for (const n of BOSS_LEVELS) {
      const peer = n - 1; // same band: 4, 9, 14 and so on
      expect(bandOf(peer)).toBe(bandOf(n));
      let boss = 0;
      let v6 = 0;
      let v5 = 0;
      for (let i = 0; i < 100; i++) {
        boss += rate(generateLevel(seedAt(i), n, V6_GEN_CONFIG), 10, AT);
        v6 += rate(generateLevel(seedAt(i), peer, V6_GEN_CONFIG), 10, AT);
        if (i < 30) v5 += rate(generateLevel(seedAt(i), n, V5_GEN_CONFIG), 10, AT) * (100 / 30);
      }
      expect(boss / v6, `level ${n} vs ${peer}`).toBeGreaterThan(0.8);
      expect(boss / v6, `level ${n} vs ${peer}`).toBeLessThan(1.25);
      expect(boss / v5, `level ${n} vs version 5`).toBeGreaterThan(1.2);
    }
  });

  it('the fight keeps the version 5 waves: the spawn rate from the entrance on is the version 5 rate', () => {
    const ratios: string[] = [];
    for (const n of BOSS_LEVELS) {
      let fight = 0;
      let v5 = 0;
      for (let i = 0; i < 100; i++) {
        fight += rate(generateLevel(seedAt(i), n, V6_GEN_CONFIG), AT, AT + 100);
        v5 += rate(generateLevel(seedAt(i), n, V5_GEN_CONFIG), AT, AT + 100);
      }
      ratios.push(`${n}: ${(fight / v5).toFixed(2)}`);
      expect(fight / v5, `level ${n}`).toBeGreaterThan(0.85);
      expect(fight / v5, `level ${n}`).toBeLessThan(1.15);
    }
    expect(ratios).toHaveLength(BOSS_LEVELS.length);
  });

  it('J9 ties version 7 to a boss level with the R1 pacing; B3 checks the 200 s entrance', () => {
    const d = structuredClone(generateLevel(42, 5, V6_GEN_CONFIG));
    expect(validateLevel(d, V6_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(d, V5_GEN_CONFIG).errors)).toContain('J9');
    const late = structuredClone(d);
    if (late.boss === undefined) throw new Error('no boss');
    late.boss = { ...late.boss, atSec: 240 };
    expect(ids(validateLevel(late).errors)).toContain('B1');
    const v6 = structuredClone(d);
    v6.generatorVersion = 6;
    expect(ids(validateLevel(v6, V6_GEN_CONFIG).errors)).toContain('J9');
    const nonBoss = structuredClone(generateLevel(42, 13, V6_GEN_CONFIG));
    nonBoss.generatorVersion = GENERATOR_VERSION_V7;
    expect(ids(validateLevel(nonBoss).errors)).toContain('B1');
  });

  it('is deterministic and JSON safe', () => {
    const a = BOSS_LEVELS.map((n) => levelHash(generateLevel(99, n, V6_GEN_CONFIG)));
    const b = [...BOSS_LEVELS].reverse().map((n) => levelHash(generateLevel(99, n, V6_GEN_CONFIG))).reverse();
    expect(b).toEqual(a);
    const d = generateLevel(99, 25, V6_GEN_CONFIG);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
  });
});

/** FNV-1a fold of a string into h. */
function fold(h: number, s: string): number {
  let v = h;
  for (let i = 0; i < s.length; i++) v = Math.imul(v ^ s.charCodeAt(i), 0x01000193);
  return v >>> 0;
}

describe('flat invariants: the V1 to V5 configs and Endless are byte for byte as before R2', { timeout: 120_000 }, () => {
  it('levels 1 to 50 of four seeds under each older config hash as pinned', () => {
    const cfgs = [V1_GEN_CONFIG, V2_GEN_CONFIG, V3_GEN_CONFIG, V4_GEN_CONFIG, V5_GEN_CONFIG];
    const got = cfgs.map((cfg) => {
      let h = 0x811c9dc5;
      for (const seed of [1, 42, 777, 0xdeadbeef]) for (let n = 1; n <= 50; n++) h = fold(h, levelHash(generateLevel(seed, n, cfg)));
      return fmix32(h).toString(16);
    });
    expect(got).toEqual(['f4eac953', 'ce8d8d59', '34c5d565', 'dd7ba7e0', '253b0151']);
  });

  it('Endless segments 0 to 20 of two seeds hash as pinned', () => {
    // forge-leaver: with the Leaver off, Endless is byte for byte as before (the old pin); the
    // default config adds the Leaver from segment 6, so its pin moved.
    const pin = (cfg: GenConfig): string => {
      let e = 0x811c9dc5;
      for (const seed of [1, 42]) for (let s = 0; s <= 20; s++) e = fold(e, canonicalJson(generateEndlessSegment(seed, s, cfg)));
      return fmix32(e).toString(16);
    };
    expect(pin({ ...DEFAULT_GEN_CONFIG, enableLeaver: false })).toBe('4833a515');
    expect(pin(DEFAULT_GEN_CONFIG)).toBe('35194387');
  });

  it('older configs keep their boss versions and entrances', () => {
    expect(generateLevel(42, 5, V5_GEN_CONFIG).boss?.atSec).toBe(240);
    expect(generateLevel(42, 5, V5_GEN_CONFIG).generatorVersion).toBe(GENERATOR_VERSION_V5);
    expect(generateLevel(42, 5, V4_GEN_CONFIG).boss?.atSec).toBe(20);
    expect(generateLevel(42, 5, V4_GEN_CONFIG).generatorVersion).toBe(GENERATOR_VERSION_V3);
    expect(BOSS_EVERY).toBe(5);
  });
});
