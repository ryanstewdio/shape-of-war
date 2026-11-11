// Fury two (Ryan 2026-11-11): the shared fury any guardian opts into (fury.ts), Spindle's needles
// and fury, Ember's enraged Leavers and fury, the Broodling retune and the 'sim:bossHit' feedback.
import { afterEach, describe, expect, it } from 'vitest';
import { bus, type Events } from '../../src/core/events';
import { damageBoss, damageBossPart, livePart, spawnHornet } from '../../src/game/bosses/core';
import {
  bouncesFor,
  dashSpeedFor,
  EmberMove,
  emberLeavers,
  leaversPerStun,
  leaversToRelease,
  releaseLeavers,
} from '../../src/game/bosses/ember';
import { furyBreakHp, furyPhase } from '../../src/game/bosses/fury';
import {
  armRateFor,
  armsFor,
  clearArmAngle,
  liveSweep,
  needleEvery,
  needleHeading,
  reverseFor,
  shedNeedles,
} from '../../src/game/bosses/spindle';
import {
  BROODLING,
  EMBER,
  EMBER_FURY,
  EMBER_LEAVERS,
  FURY_BREAK_SEC,
  PHASE_CHANGE_SEC,
  SPINDLE,
  SPINDLE_FURY,
  SPINDLE_NEEDLES,
  spindleArmRate,
} from '../../src/game/bosses/table';
import { createBossView, readBoss } from '../../src/game/bosses/view';
import { enemyBulletsOf } from '../../src/game/enemyBullets';
import { stepGame } from '../../src/game/game';
import { Kind, type World } from '../../src/game/world';
import { bs, bossGame, count, enter, park, run } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => bus.clear());

function furyLog(): Events['sim:bossFury'][] {
  const log: Events['sim:bossFury'][] = [];
  bus.on('sim:bossFury', (e) => log.push({ ...e }));
  return log;
}

function hitLog(): Events['sim:bossHit'][] {
  const log: Events['sim:bossHit'][] = [];
  bus.on('sim:bossHit', (e) => log.push({ ...e }));
  return log;
}

function liveBullets(w: World): number[] {
  const p = enemyBulletsOf(w);
  const ids: number[] = [];
  for (let e = 0; e < p.cap; e++) if (p.alive[e] === 1) ids.push(e);
  return ids;
}

function placeBoss(w: World, x: number, y: number): void {
  const id = bs(w).id;
  w.x[id] = x;
  w.y[id] = y;
  w.prevX[id] = x;
  w.prevY[id] = y;
}

/** Hit the open body just past the stage 1 crack: the break starts. */
function breakNow(w: World, id: number): void {
  const s = bs(w);
  s.open = true;
  w.hp[id] = furyBreakHp(s.maxHp) + 1;
  damageBoss(w, 10, 0, 0);
}

describe('shared fury', () => {
  it('phase 2 starts at the break and later phases keep their hit point share', () => {
    expect(furyPhase(0, 100, 1000, 3)).toBe(1);
    expect(furyPhase(1, 900, 1000, 3)).toBe(2);
    expect(furyPhase(2, 100, 1000, 3)).toBe(3);
    expect(furyPhase(2, 600, 1000, 2)).toBe(2);
  });

  for (const id of ['spindle', 'ember'] as const) {
    it(`${id}: break at the stage 1 crack, no damage, phase 2 without a second pause, then 'on' once`, () => {
      const log = furyLog();
      const phases: number[] = [];
      bus.on('sim:bossPhase', (e) => phases.push(e.phase));
      const w = bossGame(id);
      park(w, 600, 400);
      const boss = enter(w);
      const s = bs(w);
      s.open = true;
      damageBoss(w, 99999, 0, 0);
      expect(w.hp[boss]).toBe(furyBreakHp(s.maxHp));
      expect(s.fury).toBe(1);
      expect(s.phase).toBe(2);
      expect(s.phaseT).toBe(0);
      expect(phases).toEqual([2]);
      expect(log.map((e) => e.stage)).toEqual(['break']);
      expect(log[0]).toMatchObject({ id, sec: FURY_BREAK_SEC });
      const v = readBoss(w, createBossView());
      expect(v.fury).toBe(1);
      expect(v.dashAim).toBe(-1); // the dash fields stay Warden's
      const x = w.x[boss];
      const y = w.y[boss];
      run(w, FURY_BREAK_SEC - 0.5);
      expect(s.open).toBe(false);
      damageBoss(w, 50, 0, 0, true); // even Detonate does nothing in the break
      expect(w.hp[boss]).toBe(furyBreakHp(s.maxHp));
      expect(w.x[boss]).toBe(x); // it stands still
      expect(w.y[boss]).toBe(y);
      expect(count(w, Kind.BossHazard)).toBe(0);
      expect(readBoss(w, createBossView()).furyT).toBeCloseTo(FURY_BREAK_SEC - 0.5, 1);
      run(w, 0.6);
      expect(s.fury).toBe(2);
      expect(log.map((e) => e.stage)).toEqual(['break', 'on']);
      run(w, 5);
      expect(log).toHaveLength(2);
      expect(readBoss(w, createBossView()).fury).toBe(2);
    });
  }

  it('a guardian off the shared fury reads fury 0', () => {
    const w = bossGame('mirage');
    park(w, 600, 400);
    enter(w);
    bs(w).fury = 2;
    expect(readBoss(w, createBossView()).fury).toBe(0);
  });

  it('a ship death keeps the stage', () => {
    const w = bossGame('ember');
    park(w, 600, 400);
    const id = enter(w);
    breakNow(w, id);
    run(w, FURY_BREAK_SEC + 0.1);
    expect(bs(w).fury).toBe(2);
    bs(w).def.reset(w, id, bs(w), false);
    expect(bs(w).fury).toBe(2);
  });
});

describe('spindle needles and fury', () => {
  it('needle and fury numbers live in the table', () => {
    expect(SPINDLE_NEEDLES.every).toBe(1.2);
    expect(SPINDLE_NEEDLES.everyFury).toBe(0.9);
    expect(SPINDLE_NEEDLES.shipClear).toBe(150);
    expect(needleEvery(0)).toBe(1.2);
    expect(needleEvery(2)).toBe(0.9);
    expect(armsFor(2, 2)).toBe(SPINDLE_FURY.arms);
    expect(SPINDLE_FURY.arms).toBe(4);
    expect(reverseFor(0)).toBe(SPINDLE.reverseEvery);
    expect(reverseFor(2)).toBe(3);
    expect(armRateFor(0, 0.7)).toBe(spindleArmRate());
    expect(armRateFor(2, 0)).toBeCloseTo(0.4, 9);
    expect(armRateFor(2, 1)).toBeCloseTo(0.6, 9);
    expect(armRateFor(2, 0.5)).toBeCloseTo(0.5, 9);
    expect(needleHeading(1, 0.4)).toBeCloseTo(1 + Math.PI / 2, 9);
    expect(needleHeading(1, -0.4)).toBeCloseTo(1 - Math.PI / 2, 9);
    // Four arms set clear of the ship: the ship bearing sits mid gap (45 deg from the arms).
    expect(clearArmAngle(0, 4)).toBeCloseTo(Math.PI / 4, 9);
  });

  it('each arm tip on the floor sheds one needle along the tangent; none within 150 u of the ship', () => {
    const w = bossGame('spindle');
    park(w, 0, 300);
    enter(w);
    run(w, 1.2); // the first sweep is past its telegraph
    const s = bs(w);
    const h = liveSweep(w, s);
    expect(h).toBeGreaterThan(0);
    placeBoss(w, 0, 0);
    w.rot[h] = 0; // tips at (380, 0) and (-380, 0)
    const before = liveBullets(w).length;
    expect(shedNeedles(w, s.id, s, h)).toBe(2);
    const ids = liveBullets(w);
    expect(ids.length - before).toBe(2);
    const p = enemyBulletsOf(w);
    const sign = (s.hzRate[h] ?? 0) < 0 ? -1 : 1;
    for (const b of ids.slice(-2)) {
      expect(Math.abs(p.x[b] ?? 0)).toBeCloseTo(SPINDLE.armLength, 3);
      expect(Math.hypot(p.vx[b] ?? 0, p.vy[b] ?? 0)).toBeCloseTo(SPINDLE_NEEDLES.speed, 3);
      expect((p.arm[b] ?? 0) > 0).toBe(true); // it charges first (a telegraph)
      const tangent = Math.sign(p.x[b] ?? 0) * sign; // tangent of the arm at angle 0 or pi
      expect(Math.sign(p.vy[b] ?? 0)).toBe(tangent);
    }
    park(w, 380, 100); // 100 u from one tip
    expect(shedNeedles(w, s.id, s, h)).toBe(1);
  });

  it('in play, needles come every 1.2 s of attack time once the arms turn, at 170 u/s', () => {
    const w = bossGame('spindle');
    park(w, 0, 0);
    enter(w);
    const s = bs(w);
    s.shotT = -1e9; // the pellet held
    let first = -1;
    for (let i = 0; i < 120 * 4 && first < 0; i++) {
      stepGame(w, DT, idle());
      if (liveBullets(w).length > 0) first = i * DT;
    }
    expect(first).toBeGreaterThan(0);
    const p = enemyBulletsOf(w);
    for (const b of liveBullets(w)) expect(Math.hypot(p.vx[b] ?? 0, p.vy[b] ?? 0)).toBeCloseTo(SPINDLE_NEEDLES.speed, 3);
  });

  it('enraged: four arms at 0.4 to 0.6 rad/s, a fresh sweep every 3 s, telegraph intact', () => {
    const w = bossGame('spindle');
    park(w, 600, 400);
    const id = enter(w);
    breakNow(w, id);
    expect(liveSweep(w, bs(w))).toBe(-1);
    run(w, FURY_BREAK_SEC + 0.05);
    const s = bs(w);
    expect(s.fury).toBe(2);
    let h = -1;
    for (let i = 0; i < 120 && h < 0; i++) {
      stepGame(w, DT, idle());
      h = liveSweep(w, s);
    }
    expect(w.vy[h]).toBe(4);
    const rate = Math.abs(s.hzRate[h] ?? 0);
    expect(rate).toBeGreaterThanOrEqual(SPINDLE_FURY.armRateMin - 1e-6);
    expect(rate).toBeLessThanOrEqual(SPINDLE_FURY.armRateMax + 1e-6);
    // Each sweep keeps its full telegraph before it turns.
    const r0 = w.rot[h] ?? 0;
    run(w, 0.8);
    expect(w.rot[h]).toBe(r0);
    // The next reversal comes 3 s after the first enraged sweep.
    let t = 0.8;
    while (liveSweep(w, s) === h && t < 6) {
      stepGame(w, DT, idle());
      t += DT;
    }
    expect(Math.abs(t - SPINDLE_FURY.reverseEvery)).toBeLessThan(0.1);
  });
});

describe('ember leavers and fury', () => {
  it('pure: per stun, the cap and the enraged numbers', () => {
    expect(EMBER_LEAVERS.perStun).toBe(2);
    expect(EMBER_LEAVERS.cap).toBe(4);
    expect(leaversPerStun(0)).toBe(2);
    expect(leaversPerStun(2)).toBe(3);
    expect(leaversToRelease(0, 0)).toBe(2);
    expect(leaversToRelease(0, 3)).toBe(1);
    expect(leaversToRelease(2, 2)).toBe(2);
    expect(leaversToRelease(2, 4)).toBe(0);
    expect(dashSpeedFor(1, 2)).toBeCloseTo(EMBER.dashSpeed * EMBER_FURY.dashSpeedMul, 9);
    expect(dashSpeedFor(1, 0)).toBe(EMBER.dashSpeed);
    expect(bouncesFor(0)).toBe(2);
    expect(bouncesFor(2)).toBe(3);
  });

  it('a stun releases 2 enraged Leavers at the body, with sim:enrage for each', () => {
    const enr: number[] = [];
    bus.on('sim:enrage', (e) => enr.push(e.id));
    const w = bossGame('ember');
    park(w, -400, 0);
    enter(w);
    const s = bs(w);
    placeBoss(w, 560, 0);
    s.n0 = EmberMove.Dash;
    s.dir = 0;
    s.t3 = 0.6;
    s.n1 = 0;
    s.t1 = 0;
    s.t0 = 0;
    for (let i = 0; i < 240 && s.n0 !== EmberMove.Stun; i++) stepGame(w, DT, idle());
    expect(s.n0).toBe(EmberMove.Stun);
    expect(emberLeavers(w, s)).toBe(2);
    expect(count(w, Kind.Leaver)).toBe(2);
    expect(enr).toHaveLength(2);
    for (const l of enr) {
      expect(w.kind[l]).toBe(Kind.Leaver);
      expect(w.enraged[l]).toBe(1);
      expect(Math.hypot((w.x[l] ?? 0) - (w.x[s.id] ?? 0), (w.y[l] ?? 0) - (w.y[s.id] ?? 0))).toBeLessThan(120);
    }
  });

  it('at most 4 Ember Leavers alive, and never past maxLiveEnemies', () => {
    const w = bossGame('ember');
    park(w, -400, 0);
    const id = enter(w);
    const s = bs(w);
    expect(releaseLeavers(w, id, s)).toBe(2);
    expect(releaseLeavers(w, id, s)).toBe(2);
    expect(releaseLeavers(w, id, s)).toBe(0);
    expect(emberLeavers(w, s)).toBe(4);
    const v = bossGame('ember');
    park(v, -400, 0);
    const vid = enter(v);
    v.level = { ...v.level, waves: { ...v.level.waves, maxLiveEnemies: 1 } };
    expect(releaseLeavers(v, vid, bs(v))).toBe(1);
  });

  it('enraged: 3 Leavers per stun', () => {
    const w = bossGame('ember');
    park(w, -400, 0);
    const id = enter(w);
    breakNow(w, id);
    run(w, FURY_BREAK_SEC + 0.05);
    expect(bs(w).fury).toBe(2);
    expect(releaseLeavers(w, id, bs(w))).toBe(3);
  });

  it('the break clears the lane marker and the core stays closed; enraged it winds up again', () => {
    const w = bossGame('ember');
    park(w, -400, 0);
    const id = enter(w);
    breakNow(w, id);
    expect(count(w, Kind.BossHazard)).toBe(0);
    run(w, 1);
    expect(bs(w).open).toBe(false);
    run(w, FURY_BREAK_SEC);
    expect(bs(w).fury).toBe(2);
    expect([EmberMove.Windup, EmberMove.Dash, EmberMove.Rest, EmberMove.Stun]).toContain(bs(w).n0);
    expect(PHASE_CHANGE_SEC).toBeGreaterThan(0);
  });
});

describe('brood retune', () => {
  it('Broodlings 300 (30 hits each), and they start full: barHp equals barMax at the split', () => {
    expect(BROODLING.hp).toBe(300);
    const w = bossGame('brood', { par: 1000 });
    park(w, 0, 0);
    const id = enter(w);
    w.hp[id] = 5;
    damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
    expect(bs(w).split).toBe(true);
    const v = readBoss(w, createBossView());
    expect(v.broodlings).toBe(true);
    expect(v.barHp).toBe(v.barMax);
    expect(v.barMax).toBeGreaterThan(0);
  });
});

describe('hit feedback', () => {
  it('hitT is -1 before any landed hit; a closed core hit is absorbed (landed false)', () => {
    const log = hitLog();
    const w = bossGame('warden');
    park(w, 600, 400);
    const id = enter(w);
    expect(readBoss(w, createBossView()).hitT).toBe(-1);
    const s = bs(w);
    s.open = false;
    damageBoss(w, 10, 5, 6);
    expect(log).toEqual([{ id: 'warden', x: 5, y: 6, landed: false }]);
    expect(readBoss(w, createBossView()).hitT).toBe(-1);
    s.open = true;
    const hp = w.hp[id] ?? 0;
    damageBoss(w, 10, 7, 8);
    expect(w.hp[id]).toBeLessThan(hp);
    expect(log[1]).toEqual({ id: 'warden', x: 7, y: 8, landed: true });
    expect(readBoss(w, createBossView()).hitT).toBe(0);
    run(w, 0.5);
    expect(readBoss(w, createBossView()).hitT).toBeCloseTo(0.5, 2);
  });

  it('the fury break absorbs hits (landed false); Detonate lands', () => {
    const log = hitLog();
    const w = bossGame('spindle');
    park(w, 600, 400);
    const id = enter(w);
    breakNow(w, id);
    expect(log.at(-1)?.landed).toBe(true); // the crossing hit took hit points
    damageBoss(w, 10, 0, 0);
    damageBoss(w, 10, 0, 0, true);
    expect(log.slice(-2).map((e) => e.landed)).toEqual([false, false]);
    run(w, FURY_BREAK_SEC + 0.1);
    damageBoss(w, 10, 0, 0, true);
    expect(log.at(-1)?.landed).toBe(true);
  });

  it('part hits report too: a Broodling hit lands, a Hornet hit lands', () => {
    const log = hitLog();
    const w = bossGame('brood', { par: 1000 });
    park(w, 0, 0);
    const id = enter(w);
    w.hp[id] = 5;
    damageBoss(w, 10, 0, 0, true);
    const s = bs(w);
    const p = livePart(w, s, 0);
    expect(p).toBeGreaterThan(0);
    log.length = 0;
    damageBossPart(w, p, 10, 1, 2);
    expect(log).toEqual([{ id: 'brood', x: 1, y: 2, landed: true }]);
    expect(readBoss(w, createBossView()).hitT).toBe(0);

    const v = bossGame('warden');
    park(v, 600, 400);
    enter(v);
    const hn = spawnHornet(v, bs(v), 0, 0, 0);
    expect(hn).toBeGreaterThan(0);
    log.length = 0;
    damageBossPart(v, hn, 10, 0, 0);
    expect(log).toEqual([{ id: 'warden', x: 0, y: 0, landed: true }]);
  });
});
