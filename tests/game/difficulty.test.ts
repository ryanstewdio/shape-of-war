// Release polish (docs/14 item 6): GameOptions.difficulty scales enemy speed, enemy hit points,
// wave spawn counts and starting lives. Normal is the v3 sim exactly.
import { afterEach, describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../../src/core/difficulty';
import { bus } from '../../src/core/events';
import { difficultyOf, scaledCount, scaledHp, startingLives } from '../../src/game/difficulty';
import * as bulwark from '../../src/game/enemies/bulwark';
import * as grunt from '../../src/game/enemies/grunt';
import { createGame, stepGame } from '../../src/game/game';
import { enemySpeedScale, gs } from '../../src/game/state';
import { inlineRectLevel } from '../../src/game/world';
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
    expect(spawnsAfter(waveLevel(8), 'hard', 1.5)).toBe(10);
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
