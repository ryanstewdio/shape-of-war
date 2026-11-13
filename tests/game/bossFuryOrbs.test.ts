// Fury orbs (Ryan's device check on 64f6225, 2026-11-13): enraged, Gravitas launches pool orbs toward
// the ship (GRAVITAS_ORB) that stop after a share of the distance (clamped, and at the arena wall)
// and open a shelter pool there, each with an enraged Snake (spawnSnake, capped, scaled by the
// difficulty addScale); the trail of pools where Gravitas stood is gone. Hit points 1704 to 1300.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { countAdds, countHazards, damageBoss, hazardLethalAt, spawnLaneMarker } from '../../src/game/bosses/core';
import {
  countOrbs,
  countPools,
  gravitasSnakes,
  launchOrb,
  orbFits,
  orbStopDist,
  snakeCapFor,
  snakeSide,
  snakesToRelease,
  stepOrb,
} from '../../src/game/bosses/gravitas';
import { BOSS_TABLE, CRACK_AT, GRAVITAS_ORB, GRAVITAS_ORB_SNAKE, GRAVITAS_POOL, MAX_HAZARDS } from '../../src/game/bosses/table';
import { HazardType } from '../../src/game/bosses/types';
import { def as snakeDef } from '../../src/game/enemies/snake';
import { stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import type { Difficulty } from '../../src/core/difficulty';
import { bs, bossGame, count, enter, park, run } from './bossHelpers';
import { killShip } from '../../src/game/player';
import { DT, idle } from './helpers';

afterEach(() => bus.clear());

const DEG = Math.PI / 180;

function gravitas(difficulty: Difficulty = 'normal'): { w: World; id: number } {
  const w = bossGame('gravitas', { par: 1000, lives: 99 }, { difficulty });
  park(w, 0, 0);
  const id = enter(w);
  bs(w).t0 = -1e9; // hold the rings
  return { w, id };
}

function enrage(w: World): void {
  bs(w).fury = 2;
  bs(w).furyT = 0;
}

function placeBoss(w: World, x: number, y: number): void {
  const id = bs(w).id;
  w.x[id] = x;
  w.y[id] = y;
  w.prevX[id] = x;
  w.prevY[id] = y;
}

function orbs(w: World): number[] {
  const out: number[] = [];
  for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Orb) out.push(h);
  return out;
}

function pools(w: World): number[] {
  const out: number[] = [];
  for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Pool) out.push(h);
  return out;
}

/** Fly orb h by hand until it is gone. Returns the steps taken. */
function fly(w: World, h: number): number {
  let n = 0;
  while (w.alive[h] === 1 && w.a[h] === HazardType.Orb && n < 10000) {
    stepOrb(w, bs(w), h, DT);
    n++;
  }
  return n;
}

describe('fury orbs: pure rules', () => {
  it('the ruled values and the hit points', () => {
    expect(GRAVITAS_ORB).toEqual({ everySec: 3, speed: 220, share: 0.55, minDist: 120, maxDist: 260, radius: 14, snakesPerOrb: 1, snakeCap: 2 });
    expect(BOSS_TABLE.gravitas.hp).toBe(1300);
  });

  it('the stop distance: share of the distance to the ship, clamped to 120 to 260 u', () => {
    expect(orbStopDist(300)).toBeCloseTo(165, 9);
    expect(orbStopDist(100)).toBe(GRAVITAS_ORB.minDist);
    expect(orbStopDist(0)).toBe(GRAVITAS_ORB.minDist);
    expect(orbStopDist(Number.NaN)).toBe(GRAVITAS_ORB.minDist);
    expect(orbStopDist(1000)).toBe(GRAVITAS_ORB.maxDist);
  });

  it('an orb fits only while it and the pool reserve stay inside MAX_HAZARDS', () => {
    expect(orbFits(MAX_HAZARDS - GRAVITAS_POOL.reserve - 1)).toBe(true);
    expect(orbFits(MAX_HAZARDS - GRAVITAS_POOL.reserve)).toBe(false);
  });

  it('Snakes per launch and the cap scale with addScale through minionCount', () => {
    expect(snakeCapFor(1)).toBe(2);
    expect(snakeCapFor(0.75)).toBe(2);
    expect(snakeCapFor(1.6)).toBe(3);
    expect(snakesToRelease(1, 0)).toBe(1);
    expect(snakesToRelease(1, 1)).toBe(1);
    expect(snakesToRelease(1, 2)).toBe(0);
    expect(snakesToRelease(1.6, 0)).toBe(2);
    expect(snakesToRelease(1.6, 2)).toBe(1);
    expect(snakesToRelease(1.6, 3)).toBe(0);
    expect(snakesToRelease(0.75, 0)).toBe(1);
  });

  it('Snakes sit off the orb path on alternate sides', () => {
    const s = GRAVITAS_ORB_SNAKE.sideDeg * DEG;
    expect(snakeSide(0)).toBeCloseTo(s, 12);
    expect(snakeSide(1)).toBeCloseTo(-s, 12);
    expect(snakeSide(2)).toBeCloseTo(2 * s, 12);
    expect(snakeSide(3)).toBeCloseTo(-2 * s, 12);
  });
});

describe('fury orbs: launch', () => {
  it('no orb, pool or Gravitas Snake before the break', () => {
    const { w } = gravitas();
    park(w, 500, 300);
    run(w, 10);
    expect(countOrbs(w)).toBe(0);
    expect(countPools(w)).toBe(0);
    expect(gravitasSnakes(w, bs(w))).toBe(0);
  });

  it('enraged: an orb every 3 s of attack time from the body edge toward the ship, never lethal, no pool where Gravitas stands', () => {
    const { w, id } = gravitas();
    park(w, 500, 300);
    enrage(w);
    const s = bs(w);
    const launches: number[] = [];
    let t = 0;
    let seen = -1;
    for (let i = 0; i < 120 * 10; i++) {
      stepGame(w, DT, idle());
      t += DT;
      const o = orbs(w);
      const h = o[0] ?? -1;
      if (h > 0 && h !== seen && (w.vy[h] ?? 0) === 0) {
        seen = h;
        launches.push(t);
        // Fresh this step: it sits on the body edge, heading at the ship.
        const bx = w.x[id] ?? 0;
        const by = w.y[id] ?? 0;
        const r = (w.radius[id] ?? 0) + GRAVITAS_ORB.radius;
        expect(Math.hypot((w.x[h] ?? 0) - bx, (w.y[h] ?? 0) - by)).toBeCloseTo(r, 0);
        const toShip = Math.atan2((w.y[0] ?? 0) - by, (w.x[0] ?? 0) - bx);
        expect(Math.abs(Math.atan2(Math.sin((w.rot[h] ?? 0) - toShip), Math.cos((w.rot[h] ?? 0) - toShip)))).toBeLessThan(0.02);
        expect(w.radius[h]).toBe(GRAVITAS_ORB.radius);
        expect(hazardLethalAt(w, s, h, w.x[h] ?? 0, w.y[h] ?? 0)).toBe(false);
        expect(countPools(w)).toBe(launches.length - 1); // the pool comes where the orb stops, later
      }
    }
    expect(launches.length).toBeGreaterThanOrEqual(3);
    const first = launches[0] ?? 0;
    expect(first).toBeGreaterThan(GRAVITAS_ORB.everySec / 1.31 - DT);
    expect(first).toBeLessThanOrEqual(GRAVITAS_ORB.everySec + 2 * DT);
    const gap = (launches[1] ?? 0) - first;
    expect(gap).toBeCloseTo((launches[2] ?? 0) - (launches[1] ?? 0), 1);
    expect(gap).toBeLessThanOrEqual(GRAVITAS_ORB.everySec + DT);
  });

  it('a ship on an orb is never killed by it', () => {
    const { w, id } = gravitas();
    const s = bs(w);
    gs(w).invulnerable = false;
    w.ship.invuln = 0;
    park(w, (w.x[id] ?? 0) + 400, w.y[id] ?? 0);
    const h = launchOrb(w, s, w.x[id] ?? 0, w.y[id] ?? 0, 200, 60);
    expect(h).toBeGreaterThan(0);
    park(w, w.x[h] ?? 0, w.y[h] ?? 0);
    expect(hazardLethalAt(w, s, h, w.x[0] ?? 0, w.y[0] ?? 0)).toBe(false);
    run(w, 0.2);
    expect(w.ship.active).toBe(true);
  });
});

describe('fury orbs: the stop rule', () => {
  it('stops after share of the launch distance and opens a pool there; the orb is gone', () => {
    const { w } = gravitas();
    const s = bs(w);
    placeBoss(w, -300, 0);
    park(w, 100, 0); // 400 u from the centre, launched from the centre: 220 u
    const h = launchOrb(w, s, -300, 0, 0, 0);
    expect(w.vx[h]).toBeCloseTo(220, 6);
    const steps = fly(w, h);
    expect(steps * DT).toBeCloseTo(220 / GRAVITAS_ORB.speed, 1);
    expect(countOrbs(w)).toBe(0);
    const p = pools(w)[0] ?? -1;
    expect(p).toBeGreaterThan(0);
    expect(w.x[p]).toBeCloseTo(-80, 3);
    expect(w.y[p]).toBeCloseTo(0, 3);
    expect(w.radius[p]).toBe(GRAVITAS_POOL.radius);
  });

  it('clamped to minDist when the ship is close and to maxDist when it is far', () => {
    const near = gravitas();
    placeBoss(near.w, 0, 300);
    park(near.w, 0, 200);
    const a = launchOrb(near.w, bs(near.w), 0, 0, 0, 0);
    expect(near.w.vx[a]).toBe(GRAVITAS_ORB.minDist);
    fly(near.w, a);
    expect(near.w.y[pools(near.w)[0] ?? -1]).toBeCloseTo(GRAVITAS_ORB.minDist, 3);
    const far = gravitas();
    placeBoss(far.w, 0, 300);
    park(far.w, -600, 0);
    const b = launchOrb(far.w, bs(far.w), 0, 0, 0, 0);
    expect(far.w.vx[b]).toBe(GRAVITAS_ORB.maxDist);
    fly(far.w, b);
    expect(far.w.x[pools(far.w)[0] ?? -1]).toBeCloseTo(-GRAVITAS_ORB.maxDist, 3);
  });

  it('stops early at the arena wall and opens its pool inside', () => {
    const { w } = gravitas();
    const half = w.level.arena.width / 2;
    placeBoss(w, 0, 300);
    park(w, half - 30, 0);
    const x0 = half - 100;
    const h = launchOrb(w, bs(w), x0, 0, 0, 0);
    expect(w.vx[h]).toBe(GRAVITAS_ORB.minDist); // would end past the wall
    fly(w, h);
    expect(countOrbs(w)).toBe(0);
    const p = pools(w)[0] ?? -1;
    expect(p).toBeGreaterThan(0);
    expect(w.x[p] ?? 0).toBeLessThanOrEqual(half - GRAVITAS_ORB.radius + 1e-6);
    expect(w.x[p] ?? 0).toBeGreaterThan(half - GRAVITAS_ORB.radius - GRAVITAS_ORB.speed * DT - 1e-6);
  });

  it('an orb never takes a ring slot: skipped at the reserve, and it hands its slot to its pool', () => {
    const { w, id } = gravitas();
    const s = bs(w);
    park(w, 400, 0);
    while (countHazards(w) < MAX_HAZARDS - GRAVITAS_POOL.reserve - 1) spawnLaneMarker(w, s, 0, 0, 0, 100, 10);
    const h = launchOrb(w, s, w.x[id] ?? 0, w.y[id] ?? 0, 0, 0);
    expect(h).toBeGreaterThan(0);
    expect(countHazards(w)).toBe(MAX_HAZARDS - GRAVITAS_POOL.reserve);
    expect(launchOrb(w, s, w.x[id] ?? 0, w.y[id] ?? 0, 0, 0)).toBe(-1);
    for (let i = 0; i < 10 && w.alive[h] === 1 && w.a[h] === HazardType.Orb; i++) stepOrb(w, s, h, 0.2);
    expect(countOrbs(w)).toBe(0);
    expect(countPools(w)).toBe(1);
  });

  it('after the stage 2 split the orbs launch from the pair centre', () => {
    const { w, id } = gravitas();
    park(w, 500, 300);
    enrage(w);
    w.hp[id] = Math.floor(bs(w).maxHp * CRACK_AT[1]) + 5;
    damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
    const s = bs(w);
    expect(s.split).toBe(true);
    s.t0 = -1e9;
    let h = -1;
    for (let i = 0; i < 800 && h < 0; i++) {
      stepGame(w, DT, idle());
      h = orbs(w)[0] ?? -1;
    }
    expect(h).toBeGreaterThan(0);
    expect(w.vy[h]).toBe(0);
    expect(w.x[h]).toBeCloseTo(s.t1, 3);
    expect(w.y[h]).toBeCloseTo(s.t2, 3);
    fly(w, h);
    expect(countPools(w)).toBe(1);
  });
});

describe('fury orbs: Snakes', () => {
  it('each launch releases one enraged Snake at the body edge beside the orb path, kept as a boss add', () => {
    const { w, id } = gravitas();
    const s = bs(w);
    const enr: number[] = [];
    bus.on('sim:enrage', (e) => enr.push(e.id));
    park(w, 400, 0);
    placeBoss(w, 0, 0);
    const h = launchOrb(w, s, 0, 0, (w.radius[id] ?? 0) + GRAVITAS_ORB.radius, w.radius[id] ?? 0);
    expect(h).toBeGreaterThan(0);
    expect(gravitasSnakes(w, s)).toBe(1);
    expect(countAdds(w, s)).toBe(1);
    expect(enr).toHaveLength(1);
    const head = enr[0] ?? -1;
    expect(w.kind[head]).toBe(Kind.SnakeHead);
    expect(w.enraged[head]).toBe(1);
    const d = (w.radius[id] ?? 0) + GRAVITAS_ORB_SNAKE.spawnPad + snakeDef.radius;
    expect(Math.hypot(w.x[head] ?? 0, w.y[head] ?? 0)).toBeCloseTo(d, 3);
    expect(Math.atan2(w.y[head] ?? 0, w.x[head] ?? 0)).toBeCloseTo(GRAVITAS_ORB_SNAKE.sideDeg * DEG, 6);
    // It has its body: twelve segments follow the head.
    let segs = 0;
    for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === Kind.SnakeBody && w.a[i] === head) segs++;
    expect(segs).toBe(12);
  });

  it('at most 2 Gravitas Snakes alive at Normal; Insane releases 2 a launch up to 3, Easy 1 up to 2', () => {
    const cases: [Difficulty, number[]][] = [
      ['normal', [1, 2, 2]],
      ['insane', [2, 3, 3]],
      ['easy', [1, 2, 2]],
    ];
    for (const [diff, want] of cases) {
      const { w, id } = gravitas(diff);
      const s = bs(w);
      park(w, 400, 0);
      const got: number[] = [];
      for (let k = 0; k < 3; k++) {
        launchOrb(w, s, w.x[id] ?? 0, w.y[id] ?? 0, 74, 60);
        got.push(gravitasSnakes(w, s));
        for (const o of orbs(w)) fly(w, o);
      }
      expect(got, diff).toEqual(want);
    }
  });

  it('a ship death clears them as any boss add, and a reused id never reads as one', () => {
    const { w, id } = gravitas();
    const s = bs(w);
    park(w, 400, 0);
    launchOrb(w, s, w.x[id] ?? 0, w.y[id] ?? 0, 74, 60);
    expect(gravitasSnakes(w, s)).toBe(1);
    gs(w).invulnerable = false;
    w.ship.invuln = 0;
    killShip(w);
    expect(count(w, Kind.SnakeHead)).toBe(0);
    expect(countOrbs(w)).toBe(0);
    expect(countAdds(w, s)).toBe(0);
    expect(Array.from(s.addIds).every((a) => a === -1)).toBe(true);
  });

  it('never past maxLiveEnemies: the orb still flies with no Snake', () => {
    const { w, id } = gravitas();
    w.level = { ...w.level, waves: { ...w.level.waves, maxLiveEnemies: 0 } };
    park(w, 400, 0);
    const h = launchOrb(w, bs(w), w.x[id] ?? 0, w.y[id] ?? 0, 74, 60);
    expect(h).toBeGreaterThan(0);
    expect(gravitasSnakes(w, bs(w))).toBe(0);
  });

  it('enraged play: Snakes come with the orbs, and the cap holds over a long stretch', () => {
    const { w } = gravitas();
    park(w, 500, 300);
    enrage(w);
    let most = 0;
    for (let i = 0; i < 120 * 20; i++) {
      stepGame(w, DT, idle());
      const n = gravitasSnakes(w, bs(w));
      if (n > most) most = n;
    }
    expect(most).toBe(GRAVITAS_ORB.snakeCap);
  });
});
