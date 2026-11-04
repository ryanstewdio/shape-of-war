// Release polish (docs/14 item 6): GameOptions.difficulty scales enemy speed, enemy hit points,
// wave spawn counts and starting lives. Normal is the v3 sim exactly.
import { afterEach, describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../../src/core/difficulty';
import { bus } from '../../src/core/events';
import { difficultyOf, levelWithLiveCap, scaledCount, scaledHp, scaledLiveCap, startingLives } from '../../src/game/difficulty';
import * as bulwark from '../../src/game/enemies/bulwark';
import * as grunt from '../../src/game/enemies/grunt';
import { createGame, stepGame } from '../../src/game/game';
import { countWaveEnemies } from '../../src/game/spawner';
import { enemySpeedScale, gs } from '../../src/game/state';
import { ENTITY_CAP, inlineRectLevel } from '../../src/game/world';
import type { LevelDef, SpawnEntry } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

function entry(x: number, t: number): SpawnEntry {
  return { kind: 'grunt', tOffsetSec: t, mode: 'fixed', x, y: 300, angleDeg: 0, radius: 0, headingDeg: 0 };
}

/** One wave at 0 s with n grunt entries, no loop. */
function waveLevel(n: number): LevelDef {
  const base = inlineRectLevel(7);
  const entries: SpawnEntry[] = [];
  for (let i = 0; i < n; i++) entries.push(entry(-500 + i * 60, 0));
  return { ...base, waves: { ...base.waves, waves: [{ index: 0, atSec: 0, pattern: 'edges', entries }], loopFromIndex: -1 } };
}

function spawnsAfter(level: LevelDef, difficulty: 'easy' | 'normal' | 'hard', sec: number): number {
  const w = createGame(level, { vibrate: () => undefined, logSpawns: true, difficulty });
  const input = idle();
  for (let i = 0; i < Math.round(sec / DT); i++) stepGame(w, DT, input);
  return gs(w).spawnLog?.length ?? -1;
}

describe('pure helpers', () => {
  it('scaledCount rounds, keeps at least 1 when the def has 1, and is identity at rate 1', () => {
    for (let n = 0; n < 40; n++) expect(scaledCount(n, 1)).toBe(n);
    expect(scaledCount(0, 1.25)).toBe(0);
    expect(scaledCount(1, 0.75)).toBe(1);
    expect(scaledCount(1, 0.1)).toBe(1);
    expect(scaledCount(4, 0.75)).toBe(3);
    expect(scaledCount(4, 1.25)).toBe(5);
    expect(scaledCount(8, 1.25)).toBe(10);
  });

  it('scaledHp rounds with a floor of 1 and is identity at 1', () => {
    expect(scaledHp(3, 1)).toBe(3);
    expect(scaledHp(3, 0.75)).toBe(2);
    expect(scaledHp(3, 1.3)).toBe(4);
    expect(scaledHp(1, 0.75)).toBe(1);
    expect(scaledHp(1, 0.1)).toBe(1);
  });

  it('scaledLiveCap rounds, floors at 1, caps at the entity cap, identity at 1', () => {
    for (const m of [1, 5, 60, 90, 160, 600]) expect(scaledLiveCap(m, 1, ENTITY_CAP)).toBe(m);
    expect(scaledLiveCap(60, 0.9, ENTITY_CAP)).toBe(54);
    expect(scaledLiveCap(120, 1.15, ENTITY_CAP)).toBe(138);
    expect(scaledLiveCap(160, 1.6, ENTITY_CAP)).toBe(256);
    expect(scaledLiveCap(1, 0.1, ENTITY_CAP)).toBe(1);
    expect(scaledLiveCap(400, 1.6, ENTITY_CAP)).toBe(ENTITY_CAP);
  });

  it('levelWithLiveCap returns the same level when unchanged, else a copy with the scaled cap', () => {
    const lv = inlineRectLevel(3);
    expect(levelWithLiveCap(lv, 1, ENTITY_CAP)).toBe(lv);
    const hi = levelWithLiveCap(lv, 1.6, ENTITY_CAP);
    expect(hi).not.toBe(lv);
    expect(hi.waves.maxLiveEnemies).toBe(Math.round(lv.waves.maxLiveEnemies * 1.6));
    expect(hi.waves.waves).toBe(lv.waves.waves);
    expect(hi.seed).toBe(lv.seed);
  });

  it('startingLives adds extraLives with a minimum of 1', () => {
    expect(startingLives(3, 2)).toBe(5);
    expect(startingLives(3, -1)).toBe(2);
    expect(startingLives(1, -1)).toBe(1);
  });
});

describe('GameOptions.difficulty', () => {
  it('defaults to normal and is stored on the world', () => {
    const { w } = makeGame();
    expect(w.difficulty).toBe('normal');
    expect(difficultyOf(w)).toBe(DIFFICULTY.normal);
    const h = makeGame({}, { difficulty: 'hard' }).w;
    expect(h.difficulty).toBe('hard');
    expect(difficultyOf(h)).toBe(DIFFICULTY.hard);
  });

  it('scales enemy move speed', () => {
    const n = enemySpeedScale(makeGame().w);
    expect(enemySpeedScale(makeGame({}, { difficulty: 'normal' }).w)).toBe(n);
    expect(enemySpeedScale(makeGame({}, { difficulty: 'easy' }).w) / n).toBeCloseTo(0.8, 12);
    expect(enemySpeedScale(makeGame({}, { difficulty: 'hard' }).w) / n).toBeCloseTo(1.15, 12);
  });

  it('a grunt covers less ground on easy and more on hard', () => {
    const dist = (d: 'easy' | 'normal' | 'hard'): number => {
      const { w } = makeGame({}, { difficulty: d });
      gs(w).invulnerable = true;
      const id = put(w, grunt.def, -400, 0);
      for (let i = 0; i < 30; i++) stepGame(w, DT, idle()); // before the drone engages it
      return (w.x[id] ?? 0) + 400;
    };
    const n = dist('normal');
    expect(dist('easy') / n).toBeCloseTo(0.8, 4);
    expect(dist('hard') / n).toBeCloseTo(1.15, 4);
  });

  it('scales enemy hit points (rounded, at least 1)', () => {
    const hp = (d: 'easy' | 'normal' | 'hard', def: typeof grunt.def): number => {
      const { w } = makeGame({}, { difficulty: d });
      return w.hp[put(w, def, 300, 300)] ?? 0;
    };
    expect(hp('normal', bulwark.def)).toBe(3);
    expect(hp('easy', bulwark.def)).toBe(2);
    expect(hp('hard', bulwark.def)).toBe(4);
    expect(hp('easy', grunt.def)).toBe(1);
    expect(hp('hard', grunt.def)).toBe(1);
  });

  it('scales wave spawn counts, at least 1 where the wave has 1', () => {
    expect(spawnsAfter(waveLevel(4), 'normal', 1.5)).toBe(4);
    expect(spawnsAfter(waveLevel(4), 'easy', 1.5)).toBe(3);
    expect(spawnsAfter(waveLevel(4), 'hard', 1.5)).toBe(5);
    expect(spawnsAfter(waveLevel(1), 'easy', 1.5)).toBe(1);
    expect(spawnsAfter(waveLevel(8), 'hard', 1.5)).toBe(9);
    expect(spawnsAfter(waveLevel(8), 'easy', 1.5)).toBe(7);
    expect(spawnsAfter(waveLevel(10), 'hard', 1.5)).toBe(12);
  });

  it('R5: spawnRate steps about 15 percent per difficulty, Normal exactly 1', () => {
    expect(DIFFICULTY.easy.spawnRate).toBe(0.87);
    expect(DIFFICULTY.normal.spawnRate).toBe(1);
    expect(DIFFICULTY.hard.spawnRate).toBe(1.15);
    expect(DIFFICULTY.insane.spawnRate).toBe(1.32);
    expect(DIFFICULTY.normal.spawnRate / DIFFICULTY.easy.spawnRate).toBeCloseTo(1.15, 1);
    expect(DIFFICULTY.insane.spawnRate / DIFFICULTY.hard.spawnRate).toBeCloseTo(1.15, 1);
  });

  it('R5: liveCapScale scales the level maxLiveEnemies, Normal keeps the level object', () => {
    const lv = waveLevel(4);
    const max = lv.waves.maxLiveEnemies;
    const cap = (d: 'easy' | 'normal' | 'hard' | 'insane'): number => createGame(lv, { vibrate: () => undefined, difficulty: d }).level.waves.maxLiveEnemies;
    expect(createGame(lv, { vibrate: () => undefined }).level).toBe(lv);
    expect(cap('normal')).toBe(max);
    expect(cap('easy')).toBe(Math.round(max * 0.9));
    expect(cap('hard')).toBe(Math.round(max * 1.15));
    expect(cap('insane')).toBe(Math.round(max * 1.6));
    expect(lv.waves.maxLiveEnemies).toBe(max); // input never mutated
  });

  it('R5: a raised cap lets more wave enemies live at once', () => {
    const lv = waveLevel(10);
    const capped = { ...lv, waves: { ...lv.waves, maxLiveEnemies: 6 } };
    const peak = (d: 'normal' | 'hard' | 'insane'): number => {
      const w = createGame(capped, { vibrate: () => undefined, difficulty: d });
      gs(w).invulnerable = true;
      let m = 0;
      for (let i = 0; i < Math.round(1.5 / DT); i++) {
        stepGame(w, DT, idle());
        m = Math.max(m, countWaveEnemies(w));
      }
      return m;
    };
    expect(peak('normal')).toBe(6);
    expect(peak('hard')).toBe(7); // round(6 x 1.15)
    expect(peak('insane')).toBe(10); // round(6 x 1.6) = 10, wave count round(10 x 1.32) = 13
  });

  it('starting lives add extraLives with a minimum of 1', () => {
    expect(gs(makeGame({ lives: 3 }).w).lives).toBe(3);
    expect(gs(makeGame({ lives: 3 }, { difficulty: 'easy' }).w).lives).toBe(5);
    expect(gs(makeGame({ lives: 3 }, { difficulty: 'hard' }).w).lives).toBe(2);
    expect(gs(makeGame({ lives: 1 }, { difficulty: 'hard' }).w).lives).toBe(1);
  });

  it('explicit normal runs bit identical to no option', () => {
    const run = (opts: { difficulty?: 'normal' }): Float32Array => {
      const w = createGame(waveLevel(6), { vibrate: () => undefined, ...opts });
      gs(w).invulnerable = true;
      for (let i = 0; i < 600; i++) stepGame(w, DT, idle());
      return Float32Array.from(w.x);
    };
    expect(run({ difficulty: 'normal' })).toEqual(run({}));
  });
});
