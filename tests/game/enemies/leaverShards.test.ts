import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../../src/core/events';
import { def as gruntDef } from '../../../src/game/enemies/grunt';
import * as leaver from '../../../src/game/enemies/leaver';
import { enemySpeedScale, gs } from '../../../src/game/state';
import { Kind, type World } from '../../../src/game/world';
import type { LevelDef } from '../../../src/levelgen/leveldef';
import { DT, makeGame, put, quietLevel } from '../helpers';

afterEach(() => bus.clear());

const BIG = { shape: 'rect' as const, width: 2400, height: 1600, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };

function placeShip(w: World, x: number, y: number): void {
  w.x[0] = x;
  w.prevX[0] = x;
  w.y[0] = y;
  w.prevY[0] = y;
}

function game(patch: Partial<LevelDef> = {}): World {
  const { w } = makeGame({ arena: BIG, drone: 'collect', ...patch });
  placeShip(w, 1000, 700);
  return w;
}

function shards(w: World): number[] {
  const ids: number[] = [];
  for (let id = 1; id < w.cap; id++) {
    if (w.alive[id] === 1 && w.kind[id] === Kind.LeaverShard) ids.push(id);
  }
  return ids;
}

function one(): { w: World; id: number; ux: number; uy: number } {
  const w = game();
  leaver.splitLeaver(w, 0, 0, 3);
  const id = shards(w)[0];
  if (id === undefined) throw new Error('splitLeaver did not create a shard');
  return { w, id, ux: w.vx[id] ?? 0, uy: w.vy[id] ?? 0 };
}

function capped(max: number): World {
  const w = game({ waves: { ...quietLevel().waves, maxLiveEnemies: max } });
  put(w, gruntDef, -900, 600);
  put(w, gruntDef, -840, 600);
  return w;
}

describe('shardColourIndex', () => {
  it('interleaves the three colours across six shards', () => {
    expect(leaver.SHARD_COUNT).toBe(6);
    const indices = Array.from({ length: 6 }, (_, i) => leaver.shardColourIndex(i));
    expect(indices).toEqual([0, 1, 2, 0, 1, 2]);
    expect(indices.map((i) => leaver.shardColour(i))).toEqual(['yellow', 'green', 'red', 'yellow', 'green', 'red']);
  });
});

describe('flingAt', () => {
  it('clamps the ends and treats NaN as zero progress', () => {
    expect(leaver.SHARD_FLING_SEC).toBe(0.15);
    for (const t of [0, -1, Number.NaN]) expect(leaver.flingAt(t)).toBe(0);
    for (const t of [leaver.SHARD_FLING_SEC, 1, Number.POSITIVE_INFINITY]) expect(leaver.flingAt(t)).toBe(1);
  });

  it('eases out through the specified intermediate progress', () => {
    expect(leaver.flingAt(0.075)).toBeCloseTo(0.75, 12);
    expect(leaver.flingAt(0.05)).toBeCloseTo(5 / 9, 12);
    expect(leaver.flingAt(0.1)).toBeCloseTo(8 / 9, 12);
    expect(leaver.flingAt(0.03)).toBeCloseTo(0.36, 12);
  });

  it('never falls or leaves the unit interval and starts faster than linear', () => {
    let previous = 0;
    for (let k = 0; k <= 200; k++) {
      const progress = leaver.flingAt(k / 1000);
      expect(progress).toBeGreaterThanOrEqual(previous);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
      previous = progress;
    }
    expect(leaver.flingAt(0.05)).toBeGreaterThan(0.05 / 0.15);
  });
});

describe('splitLeaver', () => {
  it('initializes six shards at the split position without scoring', () => {
    const w = game();
    expect(leaver.splitLeaver(w, 100, -50, 7)).toBe(6);
    const ids = shards(w);
    expect(ids).toHaveLength(6);
    for (const id of ids) {
      expect(w.x[id] ?? 0).toBe(100);
      expect(w.y[id] ?? 0).toBe(-50);
      expect(w.t[id] ?? 0).toBe(0);
      expect(w.hp[id] ?? 0).toBe(1);
      expect(w.radius[id] ?? 0).toBe(7);
      expect(gs(w).tele[id] ?? 0).toBe(0);
      const vx = w.vx[id] ?? 0;
      const vy = w.vy[id] ?? 0;
      const rot = w.rot[id] ?? 0;
      expect(Math.hypot(vx, vy)).toBeCloseTo(1, 6);
      expect(vx).toBeCloseTo(Math.cos(rot), 6);
      expect(vy).toBeCloseTo(Math.sin(rot), 6);
    }
    expect(ids.map((id) => w.a[id] ?? 0).sort((a, b) => a - b)).toEqual([0, 0, 1, 1, 2, 2]);
    const rotations = ids.map((id) => w.rot[id] ?? 0).sort((a, b) => a - b);
    const expected = Array.from({ length: 6 }, (_, i) => Math.fround(leaver.shardAngle(7, w.tick, i))).sort((a, b) => a - b);
    expect(rotations).toEqual(expected);
    expect(gs(w).score).toBe(0);
    expect(gs(w).kills).toBe(0);
  });

  it('fills only the remaining room under the live enemy cap', () => {
    const partial = capped(5);
    expect(leaver.splitLeaver(partial, 0, 0, 1)).toBe(3);
    expect(shards(partial).map((id) => partial.a[id] ?? 0).sort((a, b) => a - b)).toEqual([0, 1, 2]);

    for (const max of [2, 1]) {
      const w = capped(max);
      expect(leaver.splitLeaver(w, 0, 0, 1)).toBe(0);
      expect(shards(w)).toHaveLength(0);
    }

    const full = capped(8);
    expect(leaver.splitLeaver(full, 0, 0, 1)).toBe(6);
    expect(leaver.splitLeaver(full, 0, 0, 2)).toBe(0);
    expect(shards(full)).toHaveLength(6);
  });

  it('repeats the stored rotations for the same key and changes them for another key', () => {
    const rotations = (key: number): number[] => {
      const w = game();
      leaver.splitLeaver(w, 0, 0, key);
      return shards(w).map((id) => w.rot[id] ?? 0).sort((a, b) => a - b);
    };
    const first = rotations(7);
    expect(rotations(7)).toEqual(first);
    expect(rotations(8)).not.toEqual(first);
  });
});

describe('stepShard', () => {
  it('follows flingAt each tick and finishes 40 units out without turning', () => {
    const { w, id, ux, uy } = one();
    const rot0 = w.rot[id] ?? 0;
    for (let k = 1; k <= 18; k++) {
      leaver.stepShard(w, id, DT);
      expect(w.t[id] ?? 0).toBeCloseTo(k * DT, 5);
      expect(w.x[id] ?? 0).toBeCloseTo(ux * leaver.SHARD_FLING * leaver.flingAt(k * DT), 3);
      expect(w.y[id] ?? 0).toBeCloseTo(uy * leaver.SHARD_FLING * leaver.flingAt(k * DT), 3);
    }
    expect(Math.hypot(w.x[id] ?? 0, w.y[id] ?? 0)).toBeCloseTo(40, 3);
    expect(w.rot[id] ?? 0).toBe(rot0);
  });

  it('moves 30 units in one call of half the fling time', () => {
    const { w, id, ux, uy } = one();
    leaver.stepShard(w, id, 0.075);
    expect(w.x[id] ?? 0).toBeCloseTo(30 * ux, 3);
    expect(w.y[id] ?? 0).toBeCloseTo(30 * uy, 3);
  });

  it('holds its position and rotation after the fling until the hold ends', () => {
    const { w, id } = one();
    for (let k = 0; k < 20; k++) leaver.stepShard(w, id, DT);
    const x = w.x[id] ?? 0;
    const y = w.y[id] ?? 0;
    const rot = w.rot[id] ?? 0;
    for (let k = 0; k < 30; k++) leaver.stepShard(w, id, DT);
    expect(w.t[id] ?? 0).toBeLessThan(leaver.SHARD_HOLD_SEC);
    expect(w.x[id] ?? 0).toBe(x);
    expect(w.y[id] ?? 0).toBe(y);
    expect(w.rot[id] ?? 0).toBe(rot);

    w.t[id] = 0.4;
    leaver.stepShard(w, id, 0.05);
    expect(w.x[id] ?? 0).toBe(x);
    expect(w.y[id] ?? 0).toBe(y);
    expect(w.rot[id] ?? 0).toBe(rot);
    expect(w.t[id] ?? 0).toBeCloseTo(0.45, 5);
  });

  it('chases for the whole dt of the call that reaches the end of the hold', () => {
    const { w, id } = one();
    for (let k = 0; k < 20; k++) leaver.stepShard(w, id, DT);
    const x = w.x[id] ?? 0;
    const y = w.y[id] ?? 0;
    w.t[id] = 0.49;
    leaver.stepShard(w, id, 0.02);
    const moved = Math.hypot((w.x[id] ?? 0) - x, (w.y[id] ?? 0) - y);
    expect(moved).toBeCloseTo(leaver.shardDef.speed * enemySpeedScale(w, id) * 0.02, 3);
    expect(w.rot[id] ?? 0).toBeCloseTo(Math.atan2(700 - y, 1000 - x), 5);
  });

  it('chases the ship in a straight line after the hold', () => {
    const { w, id } = one();
    w.x[id] = 0;
    w.y[id] = 0;
    w.t[id] = 0.6;
    const per = leaver.shardDef.speed * enemySpeedScale(w, id) * DT;
    const heading = Math.atan2(700, 1000);
    for (let k = 1; k <= 10; k++) {
      leaver.stepShard(w, id, DT);
      expect(w.x[id] ?? 0).toBeCloseTo(Math.cos(heading) * per * k, 3);
      expect(w.y[id] ?? 0).toBeCloseTo(Math.sin(heading) * per * k, 3);
      expect(w.rot[id] ?? 0).toBeCloseTo(heading, 5);
    }
    expect(w.t[id] ?? 0).toBeCloseTo(0.6 + 10 * DT, 5);
  });

  it('chases faster when enraged in proportion to enemySpeedScale', () => {
    const { w, id } = one();
    w.x[id] = 0;
    w.y[id] = 0;
    w.t[id] = 0.6;
    const calm = enemySpeedScale(w, id);
    leaver.stepShard(w, id, DT);
    const d1 = Math.hypot(w.x[id] ?? 0, w.y[id] ?? 0);

    w.x[id] = 0;
    w.y[id] = 0;
    w.enraged[id] = 1;
    const hot = enemySpeedScale(w, id);
    expect(hot).toBeGreaterThan(calm);
    leaver.stepShard(w, id, DT);
    const d2 = Math.hypot(w.x[id] ?? 0, w.y[id] ?? 0);
    expect(d2 / d1).toBeCloseTo(hot / calm, 3);
  });

  it('stops exactly at the ship without overshooting', () => {
    const { w, id } = one();
    w.x[id] = 999;
    w.y[id] = 700;
    w.t[id] = 0.6;
    leaver.stepShard(w, id, 1);
    expect(w.x[id] ?? 0).toBe(1000);
    expect(w.y[id] ?? 0).toBe(700);
  });
});

describe('shardHolding', () => {
  it('recognizes only shards strictly before the hold boundary', () => {
    expect(leaver.SHARD_HOLD_SEC).toBe(0.5);
    const { w, id } = one();
    expect(leaver.shardHolding(w, id)).toBe(true);
    w.t[id] = 0.49;
    expect(leaver.shardHolding(w, id)).toBe(true);
    w.t[id] = 0.5;
    expect(leaver.shardHolding(w, id)).toBe(false);
    w.t[id] = 2;
    expect(leaver.shardHolding(w, id)).toBe(false);

    const grunt = put(w, gruntDef, -300, 0);
    expect(w.t[grunt] ?? 0).toBe(0);
    expect(leaver.shardHolding(w, grunt)).toBe(false);
    expect(leaver.shardHolding(w, 0)).toBe(false);
    const parent = put(w, leaver.def, -300, 200);
    expect(leaver.shardHolding(w, parent)).toBe(false);
  });

  it('follows the timer advanced by stepShard', () => {
    const { w, id } = one();
    for (let k = 0; k < 50; k++) leaver.stepShard(w, id, DT);
    expect(leaver.shardHolding(w, id)).toBe(true);
    for (let k = 0; k < 20; k++) leaver.stepShard(w, id, DT);
    expect(leaver.shardHolding(w, id)).toBe(false);
  });
});
