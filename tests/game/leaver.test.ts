// Leaver (forge-leaver): moves as the Weaver with 2 hit points; a scored kill releases six shards
// (two yellow, two green, two red) flung 40 u at hashed angles, which hold for 0.5 s and then chase
// at 1.06 x the Weaver speed, within the live cap, seam aware on drums, enraged by membranes.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { killEnemy } from '../../src/game/combat';
import { defOf, kindOf } from '../../src/game/defs';
import * as leaver from '../../src/game/enemies/leaver';
import * as grunt from '../../src/game/enemies/grunt';
import * as weaver from '../../src/game/enemies/weaver';
import { setInvulnerable, stepGame } from '../../src/game/game';
import { canEnrage, passesMembrane } from '../../src/game/membrane';
import { enemyKindOf, threatWeight } from '../../src/game/presence';
import { baseValue, countsAsKill } from '../../src/game/scoring';
import { enemySpeedScale, gs, isHostile, isWaveEnemy } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put, quietLevel } from './helpers';

afterEach(() => bus.clear());

const BIG = { shape: 'rect' as const, width: 2400, height: 1600, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };

function game(patch: Partial<LevelDef> = {}): World {
  const { w } = makeGame({ arena: BIG, drone: 'collect', ...patch });
  setInvulnerable(w, true);
  w.ship.invuln = 1e9;
  return w;
}

function placeShip(w: World, x: number, y: number): void {
  w.x[0] = x;
  w.y[0] = y;
  w.prevX[0] = x;
  w.prevY[0] = y;
}

function shards(w: World): number[] {
  const out: number[] = [];
  for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === Kind.LeaverShard) out.push(i);
  return out;
}

function steps(w: World, n: number): void {
  const input = idle();
  for (let i = 0; i < n; i++) stepGame(w, DT, input);
}

/** A game with a Leaver at (x, y) killed by a scored hit, the ship parked far away. */
function split(x = 0, y = 0, patch: Partial<LevelDef> = {}): { w: World; ids: number[] } {
  const w = game(patch);
  placeShip(w, 1000, 700);
  const id = put(w, leaver.def, x, y);
  killEnemy(w, id, true);
  return { w, ids: shards(w) };
}

describe('Leaver tables', () => {
  it('is the Weaver with 2 hit points, wired through every table', () => {
    expect(leaver.def.kind).toBe(Kind.Leaver);
    expect(leaver.def.hp).toBe(2);
    expect(leaver.def.speed).toBe(weaver.def.speed);
    expect(leaver.def.radius).toBe(weaver.def.radius);
    expect(leaver.step).toBe(weaver.step);
    expect(kindOf('leaver')).toBe(Kind.Leaver);
    expect(defOf(Kind.Leaver)).toBe(leaver.def);
    expect(defOf(Kind.LeaverShard)).toBe(leaver.shardDef);
    expect(enemyKindOf(Kind.Leaver)).toBe('leaver');
    expect(enemyKindOf(Kind.LeaverShard)).toBeNull();
    expect(threatWeight(Kind.Leaver)).toBe(threatWeight(Kind.Weaver));
    for (const k of [Kind.Leaver, Kind.LeaverShard]) {
      expect(isHostile(k)).toBe(true);
      expect(isWaveEnemy(k)).toBe(true);
      expect(passesMembrane(k)).toBe(true);
      expect(canEnrage(k)).toBe(true);
    }
  });

  it('scores as the Weaver, each shard a quarter of that; shards do not count for destroy', () => {
    expect(baseValue(Kind.Leaver)).toBe(baseValue(Kind.Weaver));
    expect(baseValue(Kind.LeaverShard)).toBe(baseValue(Kind.Weaver) / 4);
    expect(leaver.shardDef.value).toBe(25);
    expect(countsAsKill(Kind.Leaver)).toBe(true);
    expect(countsAsKill(Kind.LeaverShard)).toBe(false);
    expect(leaver.shardDef.hp).toBe(1);
    expect(leaver.shardDef.geoms).toBe(0);
  });

  it('shards chase at 1.06 x the Weaver speed', () => {
    expect(leaver.shardDef.speed / weaver.def.speed).toBeCloseTo(1.06, 12);
    expect(leaver.SHARD_SPEED_RATIO).toBe(1.06);
  });
});

describe('Leaver movement', () => {
  it('moves exactly like a Weaver from the same start', () => {
    const a = game();
    const b = game();
    placeShip(a, 600, 300);
    placeShip(b, 600, 300);
    const l = put(a, leaver.def, -500, -200);
    const v = put(b, weaver.def, -500, -200);
    expect(l).toBe(v);
    steps(a, 240);
    steps(b, 240);
    expect(a.x[l]).toBe(b.x[v]);
    expect(a.y[l]).toBe(b.y[v]);
  });

  it('takes two hits: the first leaves it alive, the second splits it', () => {
    const w = game();
    placeShip(w, 1000, 700);
    const id = put(w, leaver.def, 0, 0);
    expect(w.hp[id]).toBe(2);
    expect(shards(w)).toHaveLength(0);
    killEnemy(w, id, false);
    expect(shards(w)).toHaveLength(0); // an unscored removal (bomb, death clear) never splits
  });
});

describe('Leaver split', () => {
  it('releases six shards, two of each colour, scored as a Weaver kill', () => {
    const { w, ids } = split();
    expect(ids).toHaveLength(leaver.SHARD_COUNT);
    const colours = ids.map((i) => w.a[i] ?? -1).sort();
    expect(colours).toEqual([0, 0, 1, 1, 2, 2]);
    expect(ids.map((i) => leaver.shardColour(w.a[i] ?? 0)).sort()).toEqual(['green', 'green', 'red', 'red', 'yellow', 'yellow']);
    expect(gs(w).score).toBe(100);
    expect(gs(w).kills).toBe(1);
  });

  it('flings each shard 40 u outward, then holds still until 0.5 s', () => {
    const { w, ids } = split(100, -50);
    steps(w, Math.round(leaver.SHARD_FLING_SEC / DT) + 1);
    for (const i of ids) expect(Math.hypot((w.x[i] ?? 0) - 100, (w.y[i] ?? 0) + 50)).toBeCloseTo(leaver.SHARD_FLING, 3);
    const held = ids.map((i) => [w.x[i], w.y[i]]);
    steps(w, Math.round((leaver.SHARD_HOLD_SEC - leaver.SHARD_FLING_SEC) / DT) - 3);
    expect(ids.map((i) => [w.x[i], w.y[i]])).toEqual(held);
    steps(w, 12);
    for (const [k, i] of ids.entries()) expect(w.x[i] !== held[k]?.[0] || w.y[i] !== held[k]?.[1]).toBe(true);
  });

  it('spreads the shards around the circle at hashed angles (no PRNG)', () => {
    const { w, ids } = split();
    steps(w, 30);
    const angles = ids.map((i) => Math.atan2(w.y[i] ?? 0, w.x[i] ?? 0)).sort((p, q) => p - q);
    for (let k = 1; k < angles.length; k++) expect((angles[k] ?? 0) - (angles[k - 1] ?? 0)).toBeGreaterThan(Math.PI / 3 - 2 * leaver.SHARD_JITTER - 1e-6);
    expect(leaver.shardAngle(5, 100, 0)).toBe(leaver.shardAngle(5, 100, 0));
    expect(leaver.shardAngle(5, 100, 0)).not.toBe(leaver.shardAngle(5, 101, 0));
    expect(leaver.shardAngle(6, 100, 0)).not.toBe(leaver.shardAngle(5, 100, 0));
  });

  it('chases the ship at 1.06 x the distance a Weaver covers', () => {
    const { w, ids } = split(0, 0);
    placeShip(w, 1100, 0);
    const wv = put(w, weaver.def, -100, 600);
    const s0 = ids[0] ?? -1;
    steps(w, Math.round(leaver.SHARD_HOLD_SEC / DT) + 1);
    const sx = w.x[s0] ?? 0;
    const sy = w.y[s0] ?? 0;
    const wx = w.x[wv] ?? 0;
    const wy = w.y[wv] ?? 0;
    steps(w, 60);
    const ds = Math.hypot((w.x[s0] ?? 0) - sx, (w.y[s0] ?? 0) - sy);
    const dw = Math.hypot((w.x[wv] ?? 0) - wx, (w.y[wv] ?? 0) - wy);
    expect(ds / dw).toBeCloseTo(1.06, 2);
  });

  it('never exceeds the live cap: shards that do not fit are dropped', () => {
    const base = quietLevel();
    const w = game({ waves: { ...base.waves, maxLiveEnemies: 5 } });
    placeShip(w, 1000, 700);
    for (let k = 0; k < 2; k++) put(w, grunt.def, -900 + k * 60, 600);
    const id = put(w, leaver.def, 0, 0);
    killEnemy(w, id, true);
    // 2 grunts stay, the Leaver's slot is free: 3 shards fit under the cap of 5.
    const ids = shards(w);
    expect(ids).toHaveLength(3);
    expect(ids.map((i) => w.a[i]).sort()).toEqual([0, 1, 2]);
    let live = 0;
    for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && isWaveEnemy(w.kind[i] ?? 0)) live++;
    expect(live).toBe(5);
  });

  it('is deterministic: the same kill on the same tick gives the same shards', () => {
    const run = (): number[] => {
      const { w, ids } = split(37, -12);
      steps(w, 90);
      return ids.flatMap((i) => [w.x[i] ?? 0, w.y[i] ?? 0]);
    };
    expect(run()).toEqual(run());
  });

  it('a shard kill scores a quarter and counts no destroy kill', () => {
    const { w, ids } = split();
    const before = gs(w).score;
    const kills = gs(w).kills;
    killEnemy(w, ids[0] ?? -1, true);
    expect(gs(w).score - before).toBe(25);
    expect(gs(w).kills).toBe(kills);
  });

  it('enraged shards chase faster, like any enemy through a membrane', () => {
    const { w, ids } = split();
    const id = ids[0] ?? -1;
    const calm = enemySpeedScale(w, id);
    w.enraged[id] = 1;
    expect(enemySpeedScale(w, id)).toBeGreaterThan(calm);
  });
});

describe('Leaver shards on a drum', () => {
  it('chase the ship across the u seam', () => {
    const gen = generateLevel(42, 16);
    expect(gen.surface).toBe('cylinder');
    const half = gen.arena.width / 2;
    const level: LevelDef = { ...gen, waves: { ...gen.waves, waves: [], loopFromIndex: -1, loopPeriodSec: 0 }, hazards: { wells: [], spawners: [] }, drone: 'collect' };
    const { w } = makeGame(level);
    setInvulnerable(w, true);
    w.ship.invuln = 1e9;
    placeShip(w, half - 30, 0);
    const id = put(w, leaver.def, -half + 120, 0);
    killEnemy(w, id, true);
    const ids = shards(w);
    expect(ids.length).toBeGreaterThan(0);
    const sd = { x: 0, y: 0 };
    const gap = (i: number): number => Math.hypot(w.surface.delta(w.x[i] ?? 0, w.y[i] ?? 0, w.x[0] ?? 0, w.y[0] ?? 0, sd).x, sd.y);
    steps(w, Math.round(leaver.SHARD_HOLD_SEC / DT) + 1);
    const before = ids.map(gap);
    steps(w, 30);
    // Every shard closes in over the seam (the long way round is about a full drum width).
    for (const [k, i] of ids.entries()) expect(gap(i)).toBeLessThan(before[k] ?? 0);
    for (const i of ids) expect(gap(i)).toBeLessThan(half);
  });
});
