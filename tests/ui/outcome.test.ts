// R2 P0 (Ryan, build 39d1421): Insane level 6, objective bar under half full, last life lost, and
// the results said success with 4 stars. Cause: main.ts decided success with goalMet, which ignores
// lives, so a score objective whose target was met early read as a win after the last life went.
// These tests run the real sim (createGame, stepGame, killShip, the real game:over emit) and feed
// what main.ts reads into settleAdventure, with a recording storage.
import { afterEach, describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../../src/core/difficulty';
import { bus } from '../../src/core/events';
import { ADVENTURE_SCORES_KEY, type StorageLike } from '../../src/core/settings';
import { createGame, gameState, objectiveClock, stepGame } from '../../src/game/game';
import { killShip } from '../../src/game/player';
import { gs } from '../../src/game/state';
import { inlineRectLevel, type World } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import type { LevelDef, ObjectiveDef } from '../../src/levelgen/leveldef';
import type { ObjectiveSnapshot } from '../../src/ui/objective';
import { judgeAdventure, settleAdventure } from '../../src/ui/outcome';
import { DT, idle } from '../game/helpers';

afterEach(() => bus.clear());

function memory(): StorageLike & { data: Map<string, string>; writes: string[] } {
  const data = new Map<string, string>();
  const writes: string[] = [];
  return {
    data,
    writes,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k);
      data.set(k, v);
    },
  };
}

function snapshotOf(w: World): ObjectiveSnapshot {
  const g = gameState(w);
  return { elapsedSec: objectiveClock(w), score: g.score, kills: g.kills, lives: g.lives };
}

interface Over {
  score: number;
  stars: number;
}

/** Play `level` on `difficulty`; `setup` runs once, then the ship is killed until the sim ends the level. */
function loseAllLives(level: LevelDef, difficulty: Difficulty, setup: (w: World) => void): { w: World; over: Over } {
  const overs: Over[] = [];
  bus.on('game:over', (p) => overs.push({ score: p.score, stars: p.stars }));
  const w = createGame(level, { difficulty });
  for (let i = 0; i < 120; i++) stepGame(w, DT, idle());
  setup(w);
  for (let guard = 0; guard < 40 && overs.length === 0; guard++) {
    w.ship.invuln = 0;
    killShip(w);
    for (let i = 0; i < 240 && overs.length === 0; i++) stepGame(w, DT, idle());
  }
  const over = overs[0];
  if (over === undefined) throw new Error('the level never ended');
  return { w, over };
}

function settle(level: LevelDef, w: World, over: Over, difficulty: Difficulty, storage: StorageLike) {
  return settleAdventure(
    {
      levelIndex: level.levelIndex,
      objective: level.objective,
      snapshot: snapshotOf(w),
      outcome: gameState(w).outcome,
      bossLevel: level.boss !== undefined,
      score: over.score,
      scoreStars: over.stars,
      difficulty,
      sessionOnly: false,
    },
    storage,
  );
}

const quiet = (objective: ObjectiveDef): LevelDef => ({ ...inlineRectLevel(6), levelIndex: 6, objective, par: 1000, stars: [1000, 1250, 1500] });

describe('P0: losing every life is a failure with 0 stars', () => {
  it('Insane, score objective met early, lives reach 0 before the time limit: failure, 0 stars, nothing saved', () => {
    const level = quiet({ kind: 'scoreInTime', target: 3000, timeLimitSec: 240 });
    const { w, over } = loseAllLives(level, 'insane', (w) => {
      gs(w).score = 9000; // past target and 3 x par: the old code read this as a win
    });
    expect(gameState(w).lives).toBe(0);
    expect(gameState(w).outcome).toBe('lost');
    expect(objectiveClock(w)).toBeLessThan(240);
    const storage = memory();
    const end = settle(level, w, over, 'insane', storage);
    expect(end.success).toBe(false);
    expect(end.stars).toBe(0);
    expect(end.saved).toBe(false);
    expect(end.newBest).toBe(false);
    expect(storage.writes).not.toContain(ADVENTURE_SCORES_KEY);
  });

  it('every difficulty and every objective kind: lives out before the objective is complete is 0 stars', () => {
    const objectives: ObjectiveDef[] = [
      { kind: 'scoreInTime', target: 3000, timeLimitSec: 240 },
      { kind: 'survive', durationSec: 240 },
      { kind: 'destroy', count: 500 },
    ];
    for (const d of DIFFICULTIES) {
      for (const o of objectives) {
        bus.clear();
        const level = quiet(o);
        const { w, over } = loseAllLives(level, d, (w) => {
          gs(w).score = 9000;
          gs(w).kills = 200; // under half of a destroy objective, as on the device
        });
        const storage = memory();
        const end = settle(level, w, over, d, storage);
        expect(end.success, `${d} ${o.kind}`).toBe(false);
        expect(end.stars, `${d} ${o.kind}`).toBe(0);
        expect(storage.writes, `${d} ${o.kind}`).toEqual([]);
      }
    }
  });

  it('a real generated level 6 played on Insane and lost is a failure with 0 stars', () => {
    const level = generateLevel(42, 6);
    const { w, over } = loseAllLives(level, 'insane', (w) => {
      gs(w).score = level.par * 5;
    });
    expect(gameState(w).outcome).toBe('lost');
    const end = settle(level, w, over, 'insane', memory());
    expect(end).toMatchObject({ success: false, stars: 0, saved: false });
  });

  it('a stored best stays as it was after a loss', () => {
    const storage = memory();
    storage.data.set(ADVENTURE_SCORES_KEY, JSON.stringify({ '6': { best: 1200, stars: 1, difficulty: 'easy' } }));
    const level = quiet({ kind: 'scoreInTime', target: 3000, timeLimitSec: 240 });
    const { w, over } = loseAllLives(level, 'insane', (w) => {
      gs(w).score = 9000;
    });
    const end = settle(level, w, over, 'insane', storage);
    expect(end.best).toBe(1200);
    expect(storage.data.get(ADVENTURE_SCORES_KEY)).toBe(JSON.stringify({ '6': { best: 1200, stars: 1, difficulty: 'easy' } }));
  });
});

describe('Insane gives 4 stars only on a real success', () => {
  it('a destroy objective completed on Insane is a success with 4 stars, saved', () => {
    const level = quiet({ kind: 'destroy', count: 1 });
    const overs: Over[] = [];
    bus.on('game:over', (p) => overs.push({ score: p.score, stars: p.stars }));
    const w = createGame(level, { difficulty: 'insane' });
    stepGame(w, DT, idle());
    gs(w).kills = 1;
    gs(w).score = 1100;
    for (let i = 0; i < 10 && overs.length === 0; i++) stepGame(w, DT, idle());
    const over = overs[0];
    if (over === undefined) throw new Error('no game:over');
    expect(gameState(w).outcome).toBe('won');
    const storage = memory();
    const end = settle(level, w, over, 'insane', storage);
    expect(end).toMatchObject({ success: true, stars: 4, saved: true });
    expect(storage.writes).toContain(ADVENTURE_SCORES_KEY);
  });

  it('judgeAdventure: the sim verdict wins over the snapshot; the fallback path applies lives', () => {
    const o: ObjectiveDef = { kind: 'scoreInTime', target: 100, timeLimitSec: 60 };
    const base = { objective: o, bossLevel: false, scoreStars: 3, difficulty: 'insane' as const };
    const met = { elapsedSec: 30, score: 500, kills: 0, lives: 0 };
    expect(judgeAdventure({ ...base, snapshot: met, outcome: 'lost' })).toEqual({ success: false, stars: 0 });
    expect(judgeAdventure({ ...base, snapshot: met, outcome: 'running' })).toEqual({ success: false, stars: 0 });
    expect(judgeAdventure({ ...base, snapshot: { ...met, elapsedSec: 60, lives: 1 }, outcome: 'running' })).toEqual({ success: true, stars: 4 });
    expect(judgeAdventure({ ...base, snapshot: met, outcome: 'won' })).toEqual({ success: true, stars: 4 });
  });
});
