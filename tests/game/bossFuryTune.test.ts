// Fury tune (Ryan's device check on 5e6fe77 and his rulings, 2026-11-12): Mirage's aimed lane on
// its own telegraph (w.vy, the Lane contract) and 650 hit points; Gravitas bent shots (option A,
// GRAVITAS_BEND), the straight shots fired from a pool (BulletPool.spawnStraight, BossView.shipInPool)
// and the float row inside a pool (GRAVITAS_POOL.float through stepThrustRow).
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { createThrustOut, SPACE_TABLE, stepThrust, stepThrustRow, type ThrustLevel } from '../../src/core/physics';
import { bossBodyContact, damageBoss, hazardLethalAt, livePart } from '../../src/game/bosses/core';
import { bendFalloff, bendShots, bendSide, dropPool, livePull } from '../../src/game/bosses/gravitas';
import { aimedTele } from '../../src/game/bosses/mirage';
import { INSANE_TELEGRAPH_SCALE } from '../../src/game/bosses/scale';
import { BOSS_TABLE, CRACK_AT, GRAVITANT, GRAVITAS, GRAVITAS_BEND, GRAVITAS_FURY, GRAVITAS_POOL, HAZARD, MIRAGE } from '../../src/game/bosses/table';
import { HazardType } from '../../src/game/bosses/types';
import { createBossView, readBoss } from '../../src/game/bosses/view';
import { BULLET_RADIUS, fireSpread, spawnBullet, stepBullets, STYLE_ORBIT } from '../../src/game/bullets';
import { stepGame } from '../../src/game/game';
import { Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { bs, bossGame, enter, park, run } from './bossHelpers';
import { DT, idle, makeGame } from './helpers';

afterEach(() => bus.clear());

function placeBoss(w: World, x: number, y: number): void {
  const id = bs(w).id;
  w.x[id] = x;
  w.y[id] = y;
  w.prevX[id] = x;
  w.prevY[id] = y;
}

function lanes(w: World): number[] {
  const out: number[] = [];
  for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Lane) out.push(h);
  return out;
}

function liveBullets(w: World): number[] {
  const out: number[] = [];
  for (let i = 0; i < w.bullets.cap; i++) if (w.bullets.alive[i] === 1) out.push(i);
  return out;
}

function clearBullets(w: World): void {
  const b = w.bullets;
  for (let i = 0; i < b.cap; i++) b.alive[i] = 0;
  b.freeTop = b.cap;
  for (let i = 0; i < b.cap; i++) b.free[i] = b.cap - 1 - i;
  b.liveCount = 0;
}

function aim(x: number, y: number): InputState {
  const i = idle();
  i.aim = { active: true, x, y };
  return i;
}

// ---------------------------------------------------------------------------------------------
// Mirage

/** Step until the burst: lanes appear. */
function untilBurst(w: World): void {
  for (let i = 0; i < 120 * 8; i++) {
    stepGame(w, DT, idle());
    if (lanes(w).length > 0) return;
  }
  throw new Error('no burst');
}

describe('fury tune: Mirage', () => {
  it('numbers: 650 hit points, the aimed lane telegraphs 1.2 s (the Insane cut applies)', () => {
    expect(BOSS_TABLE.mirage.hp).toBe(650);
    expect(MIRAGE.aimedTeleSec).toBe(1.2);
    expect(aimedTele(1)).toBe(1.2);
    expect(aimedTele(INSANE_TELEGRAPH_SCALE)).toBeCloseTo(1.2 * 0.85, 12);
  });

  it('the aimed lane carries its own telegraph in w.vy and turns lethal only after it; the other seven keep the tier telegraph and w.vy 0', () => {
    const w = bossGame('mirage', { lives: 99 });
    park(w, 100, 50);
    enter(w);
    const s = bs(w);
    untilBurst(w);
    const ls = lanes(w);
    expect(ls).toHaveLength(MIRAGE.lanes);
    const aimed = ls.filter((h) => (w.vy[h] ?? 0) > 0);
    expect(aimed).toHaveLength(1);
    const h = aimed[0] ?? -1;
    expect(w.vy[h]).toBeCloseTo(MIRAGE.aimedTeleSec, 6);
    expect(s.hzTele[h]).toBeCloseTo(MIRAGE.aimedTeleSec, 6);
    expect(s.hzLife[h] ?? 0).toBeCloseTo(MIRAGE.aimedTeleSec + HAZARD.laneLethalSec - (w.t[h] ?? 0), 5);
    for (const o of ls) {
      if (o === h) continue;
      expect(w.vy[o]).toBe(0);
      expect(s.hzTele[o]).toBeCloseTo(0.8, 6);
    }
    // It runs through the ship and is not lethal before 1.2 s, lethal after.
    const sx = w.x[0] ?? 0;
    const sy = w.y[0] ?? 0;
    expect(hazardLethalAt(w, s, h, sx, sy)).toBe(false);
    w.t[h] = MIRAGE.aimedTeleSec - 0.05;
    expect(hazardLethalAt(w, s, h, sx, sy)).toBe(false);
    w.t[h] = MIRAGE.aimedTeleSec + 0.01;
    expect(hazardLethalAt(w, s, h, sx, sy)).toBe(true);
  });

  it('on Insane the aimed lane telegraphs 1.2 s times the Insane scale, the rest the scaled tier telegraph', () => {
    const w = bossGame('mirage', { lives: 99 }, { difficulty: 'insane' });
    park(w, 100, 50);
    enter(w);
    const s = bs(w);
    untilBurst(w);
    for (const h of lanes(w)) {
      const want = (w.vy[h] ?? 0) > 0 ? MIRAGE.aimedTeleSec * INSANE_TELEGRAPH_SCALE : 0.8 * INSANE_TELEGRAPH_SCALE;
      expect(s.hzTele[h]).toBeCloseTo(want, 6);
    }
    expect(lanes(w).filter((h) => (w.vy[h] ?? 0) > 0)).toHaveLength(1);
  });

  it('a ship that holds still in the aimed lane dies only after its telegraph', () => {
    const w = bossGame('mirage', { lives: 3 }, {}, false);
    park(w, 100, 50);
    w.ship.invuln = 0;
    enter(w);
    w.ship.invuln = 0;
    untilBurst(w);
    const h = lanes(w).find((l) => (w.vy[l] ?? 0) > 0) ?? -1;
    expect(h).toBeGreaterThan(0);
    while ((w.t[h] ?? 0) < MIRAGE.aimedTeleSec - 2 * DT) {
      stepGame(w, DT, idle());
      expect(w.ship.active).toBe(true);
    }
    run(w, 0.1);
    expect(w.ship.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Gravitas bent shots

/** Gravitas past its entrance, rings held, its body pull live, enraged furyT seconds in. */
function gravitas(furyT: number | null = 0.5): { w: World; id: number; pull: number } {
  const w = bossGame('gravitas', { par: 1000, lives: 99 });
  park(w, 0, 0);
  const id = enter(w);
  bs(w).t0 = -1e9;
  run(w, 0.1);
  if (furyT !== null) {
    bs(w).fury = 2;
    bs(w).furyT = furyT;
  }
  placeBoss(w, 0, 0);
  const pull = livePull(w, bs(w));
  expect(pull).toBeGreaterThan(0);
  clearBullets(w);
  return { w, id, pull };
}

/**
 * Fire one spread volley from (-d, 0) at the core centre (0, 0) and fly it under bendShots alone.
 * Returns how many of the three bullets touch the body.
 */
function volley(w: World, id: number, pull: number, d: number, straight = 0): number {
  clearBullets(w);
  w.vx[0] = 0;
  w.vy[0] = 0;
  w.bullets.spawnStraight = straight;
  fireSpread(w, -d, 0, 0);
  w.bullets.spawnStraight = 0;
  const hit = new Set<number>();
  for (let step = 0; step < 120; step++) {
    bendShots(w, bs(w), id, pull, DT);
    stepBullets(w, DT);
    for (const b of liveBullets(w)) {
      if (bossBodyContact(w, id, w.bullets.x[b] ?? 0, w.bullets.y[b] ?? 0, BULLET_RADIUS)) {
        hit.add(b);
        w.bullets.alive[b] = 0;
      }
    }
    if (liveBullets(w).length === 0) break;
  }
  return hit.size;
}

describe('fury tune: Gravitas bent shots', () => {
  it('numbers: radius 300, rate 10 rad/s, scatter 5000 u/s^2', () => {
    expect(GRAVITAS_BEND).toEqual({ radius: 300, rate: 10, scatter: 5000 });
  });

  it('pure: the falloff is 1 at the body edge and inside, 0 at the radius, linear between; the side', () => {
    expect(bendFalloff(60, 60)).toBe(1);
    expect(bendFalloff(10, 60)).toBe(1);
    expect(bendFalloff(300, 60)).toBe(0);
    expect(bendFalloff(400, 60)).toBe(0);
    expect(bendFalloff(180, 60)).toBeCloseTo(0.5, 12);
    // Passing with the core on the left: turn clockwise (right, away). On the right: counter clockwise.
    expect(bendSide(1, 0, 0, 1)).toBe(-1);
    expect(bendSide(1, 0, 0, -1)).toBe(1);
    expect(bendSide(1, 0, 10, 0)).toBe(1); // dead centre: one side, always the same
  });

  it('with no pool a spread volley at the core centre from 200 to 300 u misses on the pull and on the push; a straight one hits', () => {
    for (const furyT of [0.5, GRAVITAS_FURY.flipSec + 0.5]) {
      const { w, id, pull } = gravitas(furyT);
      for (let d = 200; d <= 300; d += 20) {
        expect(volley(w, id, pull, d)).toBe(0);
        expect(volley(w, id, pull, d, 1)).toBe(3);
      }
    }
  });

  it('before the fury and in the break nothing bends', () => {
    for (const fury of [0, 1] as const) {
      const { w, id, pull } = gravitas(null);
      bs(w).fury = fury;
      expect(volley(w, id, pull, 250)).toBe(3);
    }
  });

  it('the push scatters outward on top of the turn; the pull only turns (speed kept)', () => {
    const turn = gravitas(0.5);
    const push = gravitas(GRAVITAS_FURY.flipSec + 0.5);
    for (const g of [turn, push]) {
      const b = spawnBullet(g.w.bullets, -150, 30, 1400, 0, 1);
      bendShots(g.w, bs(g.w), g.id, g.pull, DT);
      expect(b).toBeGreaterThanOrEqual(0);
    }
    const sp = (g: { w: World }): number => Math.hypot(g.w.bullets.vx[0] ?? 0, g.w.bullets.vy[0] ?? 0);
    expect(sp(turn)).toBeCloseTo(1400, 2);
    expect(turn.w.bullets.vy[0] ?? 0).toBeGreaterThan(0); // the core is below-right: it turns away, up
    const f = bendFalloff(Math.hypot(150, 30), turn.w.radius[turn.id] ?? 0);
    expect(Math.atan2(turn.w.bullets.vy[0] ?? 0, turn.w.bullets.vx[0] ?? 0)).toBeCloseTo(GRAVITAS_BEND.rate * f * DT, 4);
    // The push adds an outward kick (away from the core, here up and back).
    expect(push.w.bullets.vy[0] ?? 0).toBeGreaterThan(turn.w.bullets.vy[0] ?? 0);
    expect(push.w.bullets.vx[0] ?? 0).toBeLessThan(turn.w.bullets.vx[0] ?? 0);
  });

  it('orbit blades, straight shots and shots beyond the radius are untouched', () => {
    const { w, id, pull } = gravitas(0.5);
    const blade = spawnBullet(w.bullets, -100, 20, 300, 0, 1);
    w.bullets.style[blade] = STYLE_ORBIT;
    const straight = spawnBullet(w.bullets, -100, 20, 1400, 0, 1);
    w.bullets.straight[straight] = 1;
    const far = spawnBullet(w.bullets, -350, 20, 1400, 0, 1);
    bendShots(w, bs(w), id, pull, DT);
    expect(w.bullets.vx[blade]).toBe(300);
    expect(w.bullets.vy[blade]).toBe(0);
    expect(w.bullets.vx[straight]).toBe(1400);
    expect(w.bullets.vy[straight]).toBe(0);
    expect(w.bullets.vx[far]).toBe(1400);
    expect(w.bullets.vy[far]).toBe(0);
  });

  it('in play: an enraged step bends a shot near the body, an unenraged one does not', () => {
    const on = gravitas(0.5);
    const off = gravitas(null);
    for (const g of [on, off]) {
      spawnBullet(g.w.bullets, -150, 30, 1400, 0, 1);
      stepGame(g.w, DT, idle());
    }
    expect(on.w.bullets.vy[0] ?? 0).toBeGreaterThan(1);
    expect(off.w.bullets.vy[0]).toBe(0);
  });

  it('after the split each Gravitant bends at its own strength (half the body)', () => {
    const { w } = gravitas(0.5);
    const id = bs(w).id;
    w.hp[id] = Math.floor(bs(w).maxHp * (CRACK_AT[1] ?? 0)) + 5;
    damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
    expect(bs(w).split).toBe(true);
    run(w, 0.5);
    const s = bs(w);
    const g0 = livePart(w, s, 0);
    const p0 = s.n0;
    expect(g0).toBeGreaterThan(0);
    expect(w.vx[p0]).toBe(GRAVITANT.pullMax);
    clearBullets(w);
    const gx = w.x[g0] ?? 0;
    const gy = w.y[g0] ?? 0;
    spawnBullet(w.bullets, gx - 150, gy + 30, 1400, 0, 1);
    s.furyT = 0.5; // the pull half of the tide
    bendShots(w, s, g0, p0, DT);
    const f = bendFalloff(Math.hypot(150, 30), w.radius[g0] ?? 0);
    const want = GRAVITAS_BEND.rate * (GRAVITANT.pullMax / GRAVITAS.pullMax) * f * DT;
    expect(Math.atan2(w.bullets.vy[0] ?? 0, w.bullets.vx[0] ?? 0)).toBeCloseTo(want, 4);
    // In play the pair bends: a shot near the lead Gravitant turns on the next step.
    clearBullets(w);
    spawnBullet(w.bullets, (w.x[g0] ?? 0) - 120, (w.y[g0] ?? 0) + 20, 1400, 0, 1);
    stepGame(w, DT, idle());
    expect(Math.abs(w.bullets.vy[0] ?? 0)).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Straight shots, shipInPool and the float

describe('fury tune: straight shots from a pool', () => {
  it('spawnStraight is 1 while the ship centre is in a live pool, 0 outside and with no pool; readBoss writes shipInPool', () => {
    const { w } = gravitas(0.5);
    placeBoss(w, -500, 0);
    park(w, 300, 0);
    stepGame(w, DT, idle());
    expect(w.bullets.spawnStraight).toBe(0);
    expect(readBoss(w, createBossView()).shipInPool).toBe(false);
    const p = dropPool(w, bs(w), 300, 0);
    expect(p).toBeGreaterThan(0);
    stepGame(w, DT, idle());
    expect(w.bullets.spawnStraight).toBe(1);
    expect(readBoss(w, createBossView()).shipInPool).toBe(true);
    park(w, 300, 200); // out of the pool
    stepGame(w, DT, idle());
    expect(w.bullets.spawnStraight).toBe(0);
    expect(readBoss(w, createBossView()).shipInPool).toBe(false);
  });

  it('other guardians and boss free worlds never write 1', () => {
    const m = bossGame('mirage');
    park(m, 0, 0);
    enter(m);
    run(m, 1);
    expect(m.bullets.spawnStraight).toBe(0);
    expect(readBoss(m, createBossView()).shipInPool).toBe(false);
    const { w } = makeGame();
    stepGame(w, DT, idle());
    expect(w.bullets.spawnStraight).toBe(0);
  });

  it('shots fired from a pool fly straight for their whole life; shots fired outside bend', () => {
    const { w } = gravitas(0.5);
    placeBoss(w, 0, 0);
    park(w, -260, 0);
    dropPool(w, bs(w), -260, 0);
    stepGame(w, DT, idle()); // the boss sim writes spawnStraight for the next step
    expect(w.bullets.spawnStraight).toBe(1);
    stepGame(w, DT, aim(1, 0));
    const fired = liveBullets(w);
    expect(fired.length).toBeGreaterThan(0);
    for (const b of fired) expect(w.bullets.straight[b]).toBe(1);
    const dirs = fired.map((b) => Math.atan2(w.bullets.vy[b] ?? 0, w.bullets.vx[b] ?? 0));
    for (let k = 0; k < 6; k++) stepGame(w, DT, idle());
    fired.forEach((b, k) => {
      if (w.bullets.alive[b] === 1) expect(Math.atan2(w.bullets.vy[b] ?? 0, w.bullets.vx[b] ?? 0)).toBeCloseTo(dirs[k] ?? 0, 6);
    });
  });
});

describe('fury tune: the float row', () => {
  it('numbers: about a third of the low grip, no brake assist, little drag', () => {
    expect(GRAVITAS_POOL.float).toEqual({ aMin: 400, tau: 0.6, aMax: 800, vMax: 420, drag: 0.2, brake: 1 });
    expect(GRAVITAS_POOL.float.aMin / SPACE_TABLE.low.aMin).toBeCloseTo(1 / 3, 9);
    expect(GRAVITAS_POOL.float.aMax / SPACE_TABLE.low.aMax).toBeCloseTo(1 / 3, 9);
  });

  it('stepThrust is stepThrustRow on the level row, bit for bit, for every Space level', () => {
    const levels: ThrustLevel[] = ['low', 'medium', 'high'];
    const a = createThrustOut();
    const b = createThrustOut();
    for (const level of levels) {
      let vx = 0;
      let vy = 0;
      let hold = 0;
      for (let i = 0; i < 600; i++) {
        const dx = Math.cos(i * 0.037);
        const dy = Math.sin(i * 0.051);
        const held = i % 70 < 50;
        const slow = i % 200 < 30 ? 0.8 : 1;
        stepThrust(level, vx, vy, dx * 0.9, dy * 0.6, held, hold, DT, slow, a);
        stepThrustRow(SPACE_TABLE[level], vx, vy, dx * 0.9, dy * 0.6, held, hold, DT, slow, b);
        expect(b.vx).toBe(a.vx);
        expect(b.vy).toBe(a.vy);
        expect(b.holdT).toBe(a.holdT);
        vx = a.vx;
        vy = a.vy;
        hold = a.holdT;
      }
    }
    stepThrust('off', 12, -7, 1, 0, true, 3, DT, 1, a);
    expect([a.vx, a.vy, a.holdT]).toEqual([12, -7, 0]);
  });

  it('inside a pool the ship drifts on the float row: slower to answer than high, and it keeps coasting', () => {
    const { w } = gravitas(0.5);
    placeBoss(w, -500, 0);
    park(w, 300, 0);
    dropPool(w, bs(w), 300, 0);
    stepGame(w, DT, idle());
    expect(w.ship.float).toBe(true);
    const push = idle();
    push.move = { active: true, x: 0, y: 1 };
    for (let i = 0; i < 12; i++) stepGame(w, DT, push);
    const v = w.vy[0] ?? 0;
    expect(v).toBeGreaterThan(0);
    const high = createThrustOut();
    let hv = 0;
    let hh = 0;
    for (let i = 0; i < 12; i++) {
      stepThrust('high', 0, hv, 0, 1, true, hh, DT, 1, high);
      hv = high.vy;
      hh = high.holdT;
    }
    expect(v).toBeLessThan(hv);
    // Released: little drag, it coasts (high would bleed 1.2/s).
    stepGame(w, DT, idle());
    expect(w.vy[0] ?? 0).toBeGreaterThan(v * Math.exp(-GRAVITAS_POOL.float.drag * DT) - 1e-3);
  });
});
