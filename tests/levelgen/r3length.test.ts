// Release gate R3 (Ryan): "5 minute required play on the same level is too long. Average level
// play should be 3.5 minutes." "Par needs to be adequately adjusted for all levels." Version 8:
// non boss objectives at 200 to 230 s with the v6 pacing rules kept, the boss at 120 s after dense
// R1 waves (fight about 3 minutes), whole level par on every level (boss levels count the fight
// waves and the boss bonus), stars at 1, 1.25 and 1.5 par. Every older config is untouched.
import { describe, expect, it } from 'vitest';
// T3 pin: version 8 is now V8_GEN_CONFIG (the default builds version 9), so every default call here names it.
import { BOSS_BONUS_SHARE, BOSS_EVERY, BOSS_FIGHT_SEC, BOSS_R3_LEVEL_AT_SEC } from '../../src/levelgen/boss';
import { bossLevelAtSec, generateLevel, levelHash, longPulse } from '../../src/levelgen/generator';
import {
  GENERATOR_VERSION_V6,
  GENERATOR_VERSION_V7,
  GENERATOR_VERSION_V8,
  LONG_BANDS,
  R3_BANDS,
  R3_MAX_LEVEL_SEC,
  R3_MIN_LEVEL_SEC,
  V5_GEN_CONFIG,
  V6_GEN_CONFIG,
  V8_GEN_CONFIG,
  bandOf,
  fmix32,
} from '../../src/levelgen/leveldef';
import type { Band, LevelDef, WaveSchedule } from '../../src/levelgen/leveldef';
import {
  DEAD_AIR_BREATHER_SEC,
  DEAD_AIR_FROM_SEC,
  DEAD_AIR_MAX_SEC,
  R3_COLLECT_RATE,
  bossLevelPar,
  bossWavesSec,
  deadAirGaps,
  inBreather,
  objectiveSec,
  r1Stars,
  scoreUntil,
  wholeLevelPar,
} from '../../src/levelgen/pacing';
import { validateLevel } from '../../src/levelgen/validate';
import { simulateBossLevel, simulateScore } from './parSim';

const SPREAD = 2654435761;
const seedAt = (i: number): number => (7 + i * SPREAD) >>> 0;
const isBoss = (n: number): boolean => n % BOSS_EVERY === 0;
const ids = (errors: readonly string[]): string[] => [...new Set(errors.map((e) => e.split(':')[0] ?? ''))];
const BOSS_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const AT = BOSS_R3_LEVEL_AT_SEC;

/** 200 seeds; seed i plays the non boss levels (i mod 10) + 1 + 10k, k 0 to 4 (800 levels). */
const rows: { seed: number; n: number; def: LevelDef }[] = [];
for (let i = 0; i < 200; i++) {
  for (let k = 0; k < 5; k++) {
    const n = (i % 10) + 1 + 10 * k;
    if (!isBoss(n)) rows.push({ seed: seedAt(i), n, def: generateLevel(seedAt(i), n, V8_GEN_CONFIG) });
  }
}
/** 200 seeds; seed i plays boss level BOSS_LEVELS[i mod 10] and BOSS_LEVELS[(i + 5) mod 10] (400 levels). */
const bossRows: { seed: number; n: number; def: LevelDef }[] = [];
for (let i = 0; i < 200; i++) {
  for (const j of [i % 10, (i + 5) % 10]) {
    const n = BOSS_LEVELS[j] ?? 5;
    bossRows.push({ seed: seedAt(i), n, def: generateLevel(seedAt(i), n, V8_GEN_CONFIG) });
  }
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('R3 non boss length (200 seeds, 800 levels)', () => {
  it('objectives: survive and scoreInTime 200 to 230 s, destroy cleared at about 210 s', () => {
    const bad: string[] = [];
    for (const { seed, n, def } of rows) {
      const o = def.objective;
      const t = objectiveSec(o, def.waves);
      const lo = o.kind === 'destroy' ? R3_BANDS[bandOf(n)].destroySec.min : R3_MIN_LEVEL_SEC;
      // A destroy clear lands on a spawn, so it may run a few seconds past the band's top.
      const hi = o.kind === 'destroy' ? R3_MAX_LEVEL_SEC + 10 : R3_MAX_LEVEL_SEC;
      if (t < lo || t > hi) bad.push(`seed ${seed} level ${n} ${o.kind}: ${t} s`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('the average level plays about 3.5 minutes (205 to 218 s), in every band', () => {
    const all = rows.map((r) => objectiveSec(r.def.objective, r.def.waves));
    expect(mean(all)).toBeGreaterThan(205);
    expect(mean(all)).toBeLessThan(218);
    for (const band of [1, 2, 3, 4] as Band[]) {
      const m = mean(rows.filter((r) => bandOf(r.n) === band).map((r) => objectiveSec(r.def.objective, r.def.waves)));
      expect(m, `band ${band}`).toBeGreaterThan(200);
      expect(m, `band ${band}`).toBeLessThan(222);
    }
    // Version 6 asked for at least 300 s.
    const v6 = rows.slice(0, 50).map((r) => objectiveSec(generateLevel(r.seed, r.n, V6_GEN_CONFIG).objective, generateLevel(r.seed, r.n, V6_GEN_CONFIG).waves));
    expect(Math.min(...v6)).toBeGreaterThanOrEqual(300);
  });

  it('the R3 tables stay within 200 to 230 s and keep the scoreInTime 15 s step', () => {
    for (const b of [1, 2, 3, 4] as Band[]) {
      const l = R3_BANDS[b];
      for (const r of [l.surviveSec, l.destroySec, l.scoreTimeSec]) {
        expect(r.min).toBeGreaterThanOrEqual(R3_MIN_LEVEL_SEC);
        expect(r.max).toBeLessThanOrEqual(R3_MAX_LEVEL_SEC);
      }
      expect((l.scoreTimeSec.max - l.scoreTimeSec.min) % 15).toBe(0);
      expect(l.peakEverySec).toBe(LONG_BANDS[b].peakEverySec);
      expect(l.rampSec).toBeLessThan(LONG_BANDS[b].rampSec);
    }
  });

  it('every level is version 8, valid with the default config and needs no re-derive', () => {
    const bad: string[] = [];
    for (const { seed, n, def } of rows) {
      const e = validateLevel(def, V8_GEN_CONFIG).errors;
      if (e.length > 0 || def.retries !== 0 || def.generatorVersion !== GENERATOR_VERSION_V8) bad.push(`seed ${seed} level ${n}: ${e.join('; ')} v${def.generatorVersion}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  }, 60_000);
});

describe('R3 keeps the v6 pacing rules', () => {
  it('after 10 s never 3 s with fewer than 3 live enemies, except a breather of at most 4 s after a peak', () => {
    const bad: string[] = [];
    let breathers = 0;
    for (const { seed, n, def } of rows) {
      const s = longPulse(R3_BANDS[bandOf(n)]);
      for (const g of deadAirGaps(def.waves, DEAD_AIR_FROM_SEC, objectiveSec(def.objective, def.waves))) {
        if (g.lenSec <= DEAD_AIR_MAX_SEC) continue;
        const afterPeak = inBreather(s, g.startSec) || inBreather(s, g.startSec + g.lenSec - 0.01);
        if (afterPeak && g.lenSec <= DEAD_AIR_BREATHER_SEC) breathers++;
        else bad.push(`seed ${seed} level ${n}: ${g.lenSec.toFixed(1)} s at ${g.startSec.toFixed(1)} s`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
    // R5: the band 1 late lift makes the peaks before the final third's breathers busier, so the
    // few 3 to 4 s breather gaps on these seeds (all band 1 on main) now fall under 3 s. The
    // breathers themselves still dip: in every level a breather wave spawns less than the
    // median build wave.
    let dips = 0;
    for (const { n, def } of rows) {
      const s = longPulse(R3_BANDS[bandOf(n)]);
      const at = def.waves.waves.filter((w) => w.atSec >= 10);
      const build = at.filter((w) => !inBreather(s, w.atSec)).map((w) => w.entries.length).sort((a, b) => a - b);
      const med = build[Math.floor(build.length / 2)] ?? 0;
      if (at.some((w) => inBreather(s, w.atSec) && w.entries.length < med)) dips++;
    }
    expect(dips).toBe(rows.length);
  });

  it('surges, swarms and lulls in nearly every level', () => {
    let surge = 0;
    let swarm = 0;
    let lull = 0;
    for (const { def } of rows) {
      const s = def.waves.waves.filter((w) => w.atSec >= 60).map((w) => w.entries.length);
      const med = [...s].sort((a, b) => a - b)[Math.floor(s.length / 2)] ?? 0;
      if (s.some((x) => x >= 2 * med)) surge++;
      if (s.some((x) => x === 1)) lull++;
      if (def.waves.waves.some((w) => w.entries.length >= 6 && (w.entries.every((e) => e.kind === 'dart') || w.entries.every((e) => e.kind === 'grunt')))) swarm++;
    }
    expect(surge / rows.length).toBeGreaterThan(0.98);
    expect(swarm / rows.length).toBeGreaterThan(0.9);
    expect(lull).toBe(rows.length);
  });
});

describe('R3 boss levels (200 seeds, 400 levels)', () => {
  it('the boss enters at 120 s; the R2 config keeps 200 s', () => {
    expect(AT).toBe(120);
    expect(BOSS_FIGHT_SEC).toBe(180);
    expect(bossLevelAtSec(V8_GEN_CONFIG)).toBe(120);
    expect(bossLevelAtSec(V6_GEN_CONFIG)).toBe(200);
    for (const { def } of bossRows) expect(def.boss?.atSec).toBe(AT);
  });

  it('flat, version 8, valid with no re-derive; no hold before the fight ends, so the waves run about 5 minutes', () => {
    const bad: string[] = [];
    for (const { seed, n, def } of bossRows) {
      const e = validateLevel(def, V8_GEN_CONFIG).errors;
      const hold = objectiveSec(def.objective, def.waves);
      if (e.length > 0 || def.retries !== 0 || def.surface !== 'flat' || def.generatorVersion !== GENERATOR_VERSION_V8 || hold < AT + BOSS_FIGHT_SEC) {
        bad.push(`seed ${seed} level ${n}: ${e.join('; ')} v${def.generatorVersion} hold ${hold}`);
      }
      expect(bossWavesSec(def.waves, def.objective, AT)).toBe(AT + BOSS_FIGHT_SEC);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('from 10 s to the boss: the v6 dead air rule, and dense waves with surges and swarms', () => {
    const bad: string[] = [];
    let surge = 0;
    let swarm = 0;
    for (const { seed, n, def } of bossRows) {
      const s = longPulse(R3_BANDS[bandOf(n)]);
      for (const g of deadAirGaps(def.waves, DEAD_AIR_FROM_SEC, AT)) {
        if (g.lenSec <= DEAD_AIR_MAX_SEC) continue;
        const afterPeak = inBreather(s, g.startSec) || inBreather(s, g.startSec + g.lenSec - 0.01);
        if (!afterPeak || g.lenSec > DEAD_AIR_BREATHER_SEC) bad.push(`seed ${seed} level ${n}: ${g.lenSec.toFixed(1)} s at ${g.startSec.toFixed(1)}`);
      }
      const pre = def.waves.waves.filter((w) => w.atSec < AT).map((w) => w.entries.length);
      const med = [...pre].sort((a, b) => a - b)[Math.floor(pre.length / 2)] ?? 0;
      if (pre.some((x) => x >= 2 * med)) surge++;
      if (def.waves.waves.some((w) => w.atSec < AT && w.entries.length >= 6 && (w.entries.every((e) => e.kind === 'dart') || w.entries.every((e) => e.kind === 'grunt')))) swarm++;
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(surge / bossRows.length).toBeGreaterThan(0.9);
    expect(swarm / bossRows.length).toBeGreaterThan(0.7);
  });
});

describe('R3 par: the whole level on every level', () => {
  it('stars at 1, 1.25 and 1.5 x par everywhere; par is wholeLevelPar (non boss) or bossLevelPar (boss)', () => {
    for (const { def } of rows.slice(0, 300)) {
      expect(def.stars).toEqual(r1Stars(def.par));
      expect(wholeLevelPar(def.waves, def.objective, R3_COLLECT_RATE)).toEqual({ par: def.par, stars: def.stars });
    }
    for (const { def } of bossRows.slice(0, 200)) {
      expect(def.stars).toEqual(r1Stars(def.par));
      expect(bossLevelPar(def.waves, def.objective, AT)).toEqual({ par: def.par, stars: def.stars });
    }
  });

  it('the scripted strong run lands between 1 and 1.5 x par on non boss levels (200 seeds)', () => {
    const out: string[] = [];
    const ratios = rows.map(({ seed, n, def }) => {
      const r = simulateScore(def).score / def.par;
      if (r < 1 || r > 1.5) out.push(`seed ${seed} level ${n}: ${r.toFixed(2)}`);
      return r;
    });
    expect(out.slice(0, 5)).toEqual([]);
    // Centred between the first and third star, not pinned to either end.
    expect(mean(ratios)).toBeGreaterThan(1.15);
    expect(mean(ratios)).toBeLessThan(1.45);
  });

  it('the scripted strong run (waves before and during the fight plus the boss bonus) lands between 1 and 1.5 x par on boss levels (200 seeds)', () => {
    const out: string[] = [];
    const ratios = bossRows.map(({ seed, n, def }) => {
      const r = simulateBossLevel(def).score / def.par;
      if (r < 1 || r > 1.5) out.push(`seed ${seed} level ${n}: ${r.toFixed(2)}`);
      return r;
    });
    expect(out.slice(0, 5)).toEqual([]);
    expect(mean(ratios)).toBeGreaterThan(1.1);
    expect(mean(ratios)).toBeLessThan(1.45);
  });

  it('boss par counts the fight waves and the bonus: far above the waves before the boss alone', () => {
    for (const { def } of bossRows.slice(0, 50)) {
      const pre = scoreUntil(def.waves, AT, 0.7, R3_COLLECT_RATE);
      expect(def.par).toBeGreaterThan(2 * pre);
      // The R2 par (computePar over the objective, 1 2 4 stars) sat far below the whole level.
      const v6 = generateLevel(def.runSeed, def.levelIndex, V6_GEN_CONFIG);
      expect(v6.stars).toEqual([v6.par, 2 * v6.par, 4 * v6.par]);
      expect(def.par).toBeGreaterThan(v6.par);
    }
  });

  it('bossLevelPar: the R1 formula to the fight end (or the hold), divided by 1 - the bonus share', () => {
    const grunts = (n: number, step: number): WaveSchedule => ({
      maxLiveEnemies: 60, intervalStartSec: 6, intervalEndSec: 4, rampSec: 60, rampExponent: 1, budgetStart: 3, budgetEnd: 8,
      waves: [{ index: 0, atSec: 0, pattern: 'edges', entries: Array.from({ length: n }, (_, i) => ({ kind: 'grunt' as const, tOffsetSec: i * step, mode: 'fixed' as const, x: 0, y: 0, angleDeg: 0, radius: 0, headingDeg: 0 })) }],
      loopFromIndex: -1, loopPeriodSec: 0,
    });
    const w = grunts(400, 1);
    const long = { kind: 'survive' as const, durationSec: 330 };
    expect(bossWavesSec(w, long, 120)).toBe(300);
    expect(bossWavesSec(w, { kind: 'survive', durationSec: 250 }, 120)).toBe(250);
    const s = scoreUntil(w, 300, 0.7, R3_COLLECT_RATE);
    const want = Math.round(s / (1 - BOSS_BONUS_SHARE) / 500) * 500;
    expect(bossLevelPar(w, long, 120).par).toBe(want);
    expect(bossLevelPar(w, long, 120).stars).toEqual(r1Stars(want));
    // scoreUntil on a survive window is the whole level score of that objective.
    expect(scoreUntil(w, 250)).toBeCloseTo(wholeLevelPar(w, { kind: 'survive', durationSec: 250 }).par, -3);
  });
});

/** FNV-1a fold of a string into h. */
function fold(h: number, s: string): number {
  let v = h;
  for (let i = 0; i < s.length; i++) v = Math.imul(v ^ s.charCodeAt(i), 0x01000193);
  return v >>> 0;
}

describe('R3 flags, versions and determinism', () => {
  it('V6_GEN_CONFIG builds the R2 generator byte for byte (versions 6 and 7)', () => {
    let h = 0x811c9dc5;
    for (const seed of [1, 42, 777, 0xdeadbeef]) for (let n = 1; n <= 50; n++) h = fold(h, levelHash(generateLevel(seed, n, V6_GEN_CONFIG)));
    // Pinned on this branch; V6 reproduces the version 6 gcTriage hashes of main (7AFE6A2E and on).
    expect(fmix32(h).toString(16)).toBe('fd696876'); // foundry-score-target: scoreInTime target 0.6 x par (was 3a33d889)
    expect(levelHash(generateLevel(42, 6, V6_GEN_CONFIG))).toBe('7AFE6A2E');
    expect(generateLevel(42, 13, V6_GEN_CONFIG).generatorVersion).toBe(GENERATOR_VERSION_V6);
    expect(generateLevel(42, 10, V6_GEN_CONFIG).generatorVersion).toBe(GENERATOR_VERSION_V7);
    expect(generateLevel(42, 10, V6_GEN_CONFIG).boss?.atSec).toBe(200);
  });

  it('the R3 flag needs the R1 pacing: V5 with it on is version 5, byte for byte', () => {
    for (const n of [3, 5, 13, 27]) expect(levelHash(generateLevel(42, n, { ...V5_GEN_CONFIG, enableR3Length: true }))).toBe(levelHash(generateLevel(42, n, V5_GEN_CONFIG)));
    const older = { ...V8_GEN_CONFIG };
    delete older.enableR3Length;
    for (const n of [5, 12]) expect(levelHash(generateLevel(42, n, older))).toBe(levelHash(generateLevel(42, n, V6_GEN_CONFIG)));
  });

  it('J10 ties version 8 to the R3 flag; B1 checks the 120 s entrance; O1 the R3 ranges', () => {
    const v8 = structuredClone(generateLevel(42, 13, V8_GEN_CONFIG));
    expect(validateLevel(v8, V8_GEN_CONFIG).errors).toEqual([]);
    expect(ids(validateLevel(v8, V6_GEN_CONFIG).errors)).toContain('J10');
    const v6 = generateLevel(42, 13, V6_GEN_CONFIG);
    expect(ids(validateLevel(v6, V8_GEN_CONFIG).errors)).toContain('J10');
    expect(validateLevel(v6, V6_GEN_CONFIG).errors).toEqual([]);
    const boss = structuredClone(generateLevel(42, 5, V8_GEN_CONFIG));
    expect(validateLevel(boss, V8_GEN_CONFIG).errors).toEqual([]);
    if (boss.boss === undefined) throw new Error('no boss');
    boss.boss = { ...boss.boss, atSec: 200 };
    expect(ids(validateLevel(boss).errors)).toContain('B1');
    const long = structuredClone(generateLevel(42, 12, V8_GEN_CONFIG));
    long.objective = { kind: 'survive', durationSec: 300 };
    expect(ids(validateLevel(long).errors)).toContain('O1');
    const stars = structuredClone(generateLevel(42, 10, V8_GEN_CONFIG));
    stars.stars = [stars.par, 2 * stars.par, 4 * stars.par];
    expect(ids(validateLevel(stars).errors)).toContain('P1');
  });

  it('deterministic and JSON safe, in any order', () => {
    const levels = [3, 5, 14, 25, 38, 50];
    const a = levels.map((n) => levelHash(generateLevel(77, n, V8_GEN_CONFIG)));
    const b = [...levels].reverse().map((n) => levelHash(generateLevel(77, n, V8_GEN_CONFIG))).reverse();
    expect(b).toEqual(a);
    const d = generateLevel(77, 25, V8_GEN_CONFIG);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    expect(JSON.stringify(generateLevel(77, 38, V8_GEN_CONFIG))).toBe(JSON.stringify(generateLevel(77, 38, V8_GEN_CONFIG)));
  });
});
