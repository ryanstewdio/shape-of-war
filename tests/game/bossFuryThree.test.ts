// Fury three (Ryan 2026-11-11): Brood's Broodlings frenzy (the pincer), Mirage's false landings and
// Gravitas's tide, the last two on the shared fury (fury.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus, type Events } from '../../src/core/events';
import { damageBoss, damageBossPart, hazardLethalAt, livePart } from '../../src/game/bosses/core';
import { frenzySpeed, Pincer, pincerPoint } from '../../src/game/bosses/brood';
import { furyBreakHp } from '../../src/game/bosses/fury';
import { tideAt, tideFlipInAt, tideTelegraph } from '../../src/game/bosses/gravitas';
import { fakeLife, MirageWarp, realRingIndex, ringsFor } from '../../src/game/bosses/mirage';
import {
  BROOD_FRENZY,
  BROODLING,
  CRACK_AT,
  FURY_BREAK_SEC,
  GRAVITAS,
  GRAVITAS_FURY,
  MIRAGE,
  MIRAGE_FURY,
} from '../../src/game/bosses/table';
import { HazardType } from '../../src/game/bosses/types';
import { createBossView, readBoss } from '../../src/game/bosses/view';
import { stepGame } from '../../src/game/game';
import { Kind, type World } from '../../src/game/world';
import { bs, bossGame, count, enter, park, run } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

function furyLog(): Events['sim:bossFury'][] {
  const log: Events['sim:bossFury'][] = [];
  bus.on('sim:bossFury', (e) => log.push({ ...e }));
  return log;
}

function markers(w: World): number[] {
  const s = bs(w);
  const out: number[] = [];
  for (let h = 1; h < w.cap; h++) {
    if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Ring && s.hzMarker[h] === 1) out.push(h);
  }
  return out;
}

/** True when marker h stands on the real landing point (w.x is single precision). */
function isReal(w: World, h: number): boolean {
  const s = bs(w);
  return Math.abs((w.x[h] ?? 0) - s.t1) < 0.01 && Math.abs((w.y[h] ?? 0) - s.t2) < 0.01;
}

function pulls(w: World): number[] {
  const out: number[] = [];
  for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Pull) out.push(h);
  return out;
}

function placeBoss(w: World, x: number, y: number): void {
  const id = bs(w).id;
  w.x[id] = x;
  w.y[id] = y;
  w.prevX[id] = x;
  w.prevY[id] = y;
}

/** Enraged without the break (isolates the enraged move). */
function enrage(w: World, furyT = 0): void {
  bs(w).fury = 2;
  bs(w).furyT = furyT;
}

// ---------------------------------------------------------------------------------------------
// Brood

function broodSplit(): { w: World; parts: number[] } {
  const w = bossGame('brood', { par: 1000 });
  park(w, 0, 0);
  const id = enter(w);
  w.hp[id] = 5;
  damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
  expect(bs(w).split).toBe(true);
  return { w, parts: [0, 1, 2].map((k) => livePart(w, bs(w), k)) };
}

describe('brood frenzy', () => {
  it('pure: the frenzy speed and the pincer point on the far side from the partner', () => {
    expect(frenzySpeed(100, 0)).toBe(100);
    expect(frenzySpeed(100, 2)).toBeCloseTo(100 * BROOD_FRENZY.speedMul, 9);
    expect(BROOD_FRENZY.speedMul).toBe(1.25);
    expect(BROOD_FRENZY.everySec).toBe(4);
    const out = { x: 0, y: 0 };
    pincerPoint(0, 0, -100, 0, out); // partner west of the ship: this one drives to a point east of it
    expect(out.x).toBeCloseTo(BROOD_FRENZY.reach, 9);
    expect(out.y).toBeCloseTo(0, 9);
    pincerPoint(10, 10, 10, 10, out); // coincident: still a point at reach
    expect(Math.hypot(out.x - 10, out.y - 10)).toBeCloseTo(BROOD_FRENZY.reach, 9);
  });

  it('the body has no fury and no break; the first Broodling death enrages the rest, once', () => {
    const log = furyLog();
    const w = bossGame('brood', { par: 1000 });
    park(w, 0, 0);
    const id = enter(w);
    const s = bs(w);
    s.open = true;
    damageBoss(w, Math.round(s.maxHp * 0.5), 0, 0, true); // past the stage 1 crack: no break
    expect(s.fury).toBe(0);
    expect(readBoss(w, createBossView()).fury).toBe(0);
    w.hp[id] = 5;
    damageBoss(w, 10, 0, 0, true);
    expect(s.split).toBe(true);
    expect(log).toEqual([]);
    expect(readBoss(w, createBossView()).frenzy).toBe(false);
    const parts = [0, 1, 2].map((k) => livePart(w, s, k));
    damageBossPart(w, parts[0] ?? -1, 99999, 0, 0);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ id: 'brood', stage: 'on', sec: 0 });
    expect(s.fury).toBe(2);
    expect(readBoss(w, createBossView()).frenzy).toBe(true);
    expect(readBoss(w, createBossView()).fury).toBe(0); // the shared fury fields stay off Brood
    damageBossPart(w, parts[1] ?? -1, 99999, 0, 0);
    run(w, 2);
    expect(log).toHaveLength(1);
    expect(readBoss(w, createBossView()).frenzy).toBe(true);
  });

  it('a pod death never enrages the body', () => {
    const w = bossGame('brood', { par: 1000 });
    park(w, 600, 400);
    enter(w);
    const s = bs(w);
    damageBossPart(w, livePart(w, s, 0), 99999, 0, 0);
    expect(s.fury).toBe(0);
  });

  it('survivors move speedMul faster in their roles', () => {
    const a = broodSplit();
    const b = broodSplit();
    for (const g of [a, b]) {
      // Kill the orbiter, keep the chaser; hold the pincer off to compare the role step alone.
      damageBossPart(g.w, g.parts[1] ?? -1, 99999, 0, 0);
    }
    bs(b.w).fury = 0; // the same split with no frenzy
    bs(a.w).abl[0] = -1e9;
    const c = a.parts[0] ?? -1;
    park(a.w, 600, 0);
    park(b.w, 600, 0);
    for (const g of [a, b]) {
      g.w.x[c] = 0;
      g.w.y[c] = 0;
      g.w.rot[c] = 0;
    }
    stepGame(a.w, DT, idle());
    stepGame(b.w, DT, idle());
    const da = a.w.x[c] ?? 0;
    const db = b.w.x[c] ?? 0;
    expect(db).toBeCloseTo(BROODLING.chaseSpeed * DT, 3);
    expect(da).toBeCloseTo(BROODLING.chaseSpeed * BROOD_FRENZY.speedMul * DT, 3);
  });

  it('every 4 s two survivors aim at points past the ship on the far side from each other, then drive through', () => {
    const { w, parts } = broodSplit();
    damageBossPart(w, parts[0] ?? -1, 99999, 0, 0);
    const s = bs(w);
    const a = parts[1] ?? -1;
    const b = parts[2] ?? -1;
    let t = 0;
    while ((s.abl[1] ?? 0) !== Pincer.Aim && t < 6) {
      stepGame(w, DT, idle());
      t += DT;
    }
    expect(s.abl[1]).toBe(Pincer.Aim);
    expect(t).toBeGreaterThan(BROOD_FRENZY.everySec - 0.5);
    expect(t).toBeLessThan(BROOD_FRENZY.everySec + 0.1);
    const sx = w.x[0] ?? 0;
    const sy = w.y[0] ?? 0;
    for (const [self, other, k] of [[a, b, 1], [b, a, 2]] as const) {
      const px = s.abl[3 + 2 * k] ?? 0;
      const py = s.abl[3 + 2 * k + 1] ?? 0;
      // The point lies past the ship on the far side from the partner.
      const ox = (w.x[other] ?? 0) - sx;
      const oy = (w.y[other] ?? 0) - sy;
      const dot = (px - sx) * ox + (py - sy) * oy;
      expect(dot).toBeLessThan(0);
      expect(Math.hypot(px - sx, py - sy)).toBeCloseTo(BROOD_FRENZY.reach, 3);
      expect(self).toBeGreaterThan(0);
    }
    // Aim: they stand still.
    const ax = w.x[a];
    const ay = w.y[a];
    run(w, BROOD_FRENZY.aimSec - 0.05);
    expect(w.x[a]).toBe(ax);
    expect(w.y[a]).toBe(ay);
    run(w, 0.1);
    expect(s.abl[1]).toBe(Pincer.Drive);
    // Drive: each closes on its point at driveSpeed.
    const pa = { x: s.abl[5] ?? 0, y: s.abl[6] ?? 0 };
    const d0 = Math.hypot((w.x[a] ?? 0) - pa.x, (w.y[a] ?? 0) - pa.y);
    run(w, 0.25);
    const d1 = Math.hypot((w.x[a] ?? 0) - pa.x, (w.y[a] ?? 0) - pa.y);
    expect(d0 - d1).toBeGreaterThan(BROOD_FRENZY.driveSpeed * 0.25 * 0.5);
    run(w, BROOD_FRENZY.driveSec);
    expect(s.abl[1]).toBe(Pincer.None);
  });

  it('a lone survivor keeps the speed and hunts the ship', () => {
    const { w, parts } = broodSplit();
    damageBossPart(w, parts[0] ?? -1, 99999, 0, 0);
    damageBossPart(w, parts[1] ?? -1, 99999, 0, 0);
    const f = parts[2] ?? -1; // the fleer, now a hunter
    w.x[f] = 0;
    w.y[f] = 0;
    w.rot[f] = 0;
    park(w, 500, 0);
    stepGame(w, DT, idle());
    expect(w.x[f]).toBeCloseTo(BROODLING.chaseSpeed * BROOD_FRENZY.speedMul * DT, 3);
    run(w, 1);
    expect(w.x[f]).toBeGreaterThan(100);
  });

  it('a ship death keeps the frenzy', () => {
    const { w, parts } = broodSplit();
    damageBossPart(w, parts[0] ?? -1, 99999, 0, 0);
    expect(bs(w).fury).toBe(2);
    w.ship.active = false;
    stepGame(w, DT, idle());
    expect(bs(w).fury).toBe(2);
    expect(bs(w).abl[1]).toBe(Pincer.None);
  });
});

// ---------------------------------------------------------------------------------------------
// Shared fury on Mirage and Gravitas

describe('mirage and gravitas on the shared fury', () => {
  for (const id of ['mirage', 'gravitas'] as const) {
    it(`${id}: break at the stage 1 crack, no damage, phase 2, then 'on' once`, () => {
      const log = furyLog();
      const w = bossGame(id);
      park(w, 600, 400);
      const boss = enter(w);
      const s = bs(w);
      s.open = true;
      damageBoss(w, 99999, w.x[boss] ?? 0, w.y[boss] ?? 0, true);
      expect(w.hp[boss]).toBe(furyBreakHp(s.maxHp));
      expect(s.fury).toBe(1);
      expect(s.phase).toBe(2);
      expect(s.phaseT).toBe(0);
      expect(log.map((e) => e.stage)).toEqual(['break']);
      const x = w.x[boss];
      run(w, FURY_BREAK_SEC - 0.5);
      damageBoss(w, 50, 0, 0, true);
      expect(w.hp[boss]).toBe(furyBreakHp(s.maxHp));
      expect(w.x[boss]).toBe(x);
      expect(count(w, Kind.BossHazard)).toBe(0);
      run(w, 0.6);
      expect(s.fury).toBe(2);
      expect(log.map((e) => e.stage)).toEqual(['break', 'on']);
      expect(readBoss(w, createBossView()).fury).toBe(2);
      s.def.reset(w, boss, s, false); // a ship death keeps the stage
      expect(s.fury).toBe(2);
    });
  }
});

// ---------------------------------------------------------------------------------------------
// Mirage

describe('mirage false landings', () => {
  it('pure: the real ring reads the clock and the warp counter, in range', () => {
    expect(ringsFor(0)).toBe(1);
    expect(ringsFor(2)).toBe(MIRAGE_FURY.rings);
    expect(fakeLife(MIRAGE.markSec)).toBeCloseTo(MIRAGE.markSec - MIRAGE_FURY.fakeFadeSec, 9);
    const seen = new Set<number>();
    for (let n = 0; n < 60; n++) {
      const k = realRingIndex(12.345 + n * 0.37, n, 3);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(3);
      expect(realRingIndex(12.345 + n * 0.37, n, 3)).toBe(k);
      seen.add(k);
    }
    expect(seen.size).toBe(3);
    expect(realRingIndex(5, 1, 1)).toBe(0);
  });

  it('enraged: three rings, one real, the fakes 120 u apart, never lethal, gone 0.2 s before the landing', () => {
    const rnd = vi.spyOn(Math, 'random');
    const w = bossGame('mirage', { par: 1000 });
    park(w, 0, 0);
    const boss = enter(w);
    enrage(w);
    const s = bs(w);
    let guard = 0;
    while (s.n2 !== MirageWarp.Marked && guard++ < 1200) stepGame(w, DT, idle());
    expect(s.n2).toBe(MirageWarp.Marked);
    const m = markers(w);
    expect(m).toHaveLength(MIRAGE_FURY.rings);
    const sx = w.x[0] ?? 0;
    const sy = w.y[0] ?? 0;
    for (const h of m) {
      const d = Math.hypot((w.x[h] ?? 0) - sx, (w.y[h] ?? 0) - sy);
      expect(d).toBeGreaterThanOrEqual(MIRAGE.warpMin - 1);
      expect(d).toBeLessThanOrEqual(MIRAGE.warpMax + 1);
      expect(hazardLethalAt(w, s, h, w.x[h] ?? 0, w.y[h] ?? 0)).toBe(false);
    }
    for (let i = 0; i < m.length; i++) {
      for (let j = i + 1; j < m.length; j++) {
        const a = m[i] ?? 0;
        const b = m[j] ?? 0;
        expect(Math.hypot((w.x[a] ?? 0) - (w.x[b] ?? 0), (w.y[a] ?? 0) - (w.y[b] ?? 0))).toBeGreaterThanOrEqual(MIRAGE_FURY.fakeGap);
      }
    }
    const real = m.filter((h) => isReal(w, h));
    expect(real).toHaveLength(1);
    // Hold still for the warning: the fakes go fakeFadeSec before the landing, the real one stays.
    run(w, fakeLife(MIRAGE.markSec) + 0.05);
    const left = markers(w);
    expect(left).toEqual(real);
    expect(s.n2).toBe(MirageWarp.Marked);
    run(w, MIRAGE_FURY.fakeFadeSec);
    expect(w.x[boss]).toBeCloseTo(s.t1, 3);
    expect(w.y[boss]).toBeCloseTo(s.t2, 3);
    expect(rnd).not.toHaveBeenCalled();
  });

  it('before the fury a warp shows one ring', () => {
    const w = bossGame('mirage', { par: 1000 });
    park(w, 0, 0);
    enter(w);
    const s = bs(w);
    let guard = 0;
    while (s.n2 !== MirageWarp.Marked && guard++ < 1200) stepGame(w, DT, idle());
    expect(markers(w)).toHaveLength(1);
  });

  it('the real ring is not always the first candidate over many enraged warps', () => {
    const w = bossGame('mirage', { par: 1000 });
    park(w, 0, 0);
    enter(w);
    enrage(w);
    const s = bs(w);
    const order = new Set<number>();
    for (let warp = 0; warp < 12; warp++) {
      let guard = 0;
      while (s.n2 !== MirageWarp.Marked && guard++ < 1200) stepGame(w, DT, idle());
      const m = markers(w);
      const k = m.findIndex((h) => isReal(w, h));
      if (m.length === MIRAGE_FURY.rings) order.add(k);
      while (s.n2 === MirageWarp.Marked && guard++ < 2400) stepGame(w, DT, idle());
    }
    expect(order.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Gravitas

function gravitasOpen(): { w: World; id: number } {
  const w = bossGame('gravitas', { par: 1000 });
  park(w, 0, 0);
  const id = enter(w);
  bs(w).t0 = -1e9; // hold the rings: the tide alone moves the ship
  return { w, id };
}

describe('gravitas tide', () => {
  it('pure: pull, push and back every flipSec; flipIn counts down; the telegraph window', () => {
    expect(GRAVITAS_FURY.flipSec).toBe(4);
    expect(GRAVITAS_FURY.telegraphSec).toBe(0.8);
    expect(tideAt(0, 10)).toBe(0);
    expect(tideAt(1, 10)).toBe(0);
    expect(tideAt(2, 0)).toBe(1);
    expect(tideAt(2, 3.9)).toBe(1);
    expect(tideAt(2, 4.1)).toBe(-1);
    expect(tideAt(2, 8.1)).toBe(1);
    expect(tideFlipInAt(0, 3)).toBe(-1);
    expect(tideFlipInAt(2, 1)).toBeCloseTo(3, 9);
    expect(tideFlipInAt(2, 4.5)).toBeCloseTo(3.5, 9);
    expect(tideTelegraph(0.5)).toBe(true);
    expect(tideTelegraph(1.5)).toBe(false);
    expect(tideTelegraph(-1)).toBe(false);
  });

  it('readBoss writes tide and tideFlipIn (0 and -1 before the fury)', () => {
    const { w } = gravitasOpen();
    let v = readBoss(w, createBossView());
    expect(v.tide).toBe(0);
    expect(v.tideFlipIn).toBe(-1);
    enrage(w, 1);
    v = readBoss(w, createBossView());
    expect(v.tide).toBe(1);
    expect(v.tideFlipIn).toBeCloseTo(3, 6);
    bs(w).furyT = 4.5;
    v = readBoss(w, createBossView());
    expect(v.tide).toBe(-1);
    expect(v.tideFlipIn).toBeCloseTo(3.5, 6);
  });

  it('other guardians read tide 0 and no frenzy', () => {
    const w = bossGame('mirage');
    park(w, 600, 400);
    enter(w);
    enrage(w, 5);
    const v = readBoss(w, createBossView());
    expect(v.tide).toBe(0);
    expect(v.tideFlipIn).toBe(-1);
    expect(v.frenzy).toBe(false);
  });

  it('the push moves the ship out at the speed the pull moves it in (same cap)', () => {
    const pull = gravitasOpen();
    const push = gravitasOpen();
    enrage(pull.w, 0.5);
    enrage(push.w, GRAVITAS_FURY.flipSec + 0.5);
    for (const g of [pull, push]) {
      placeBoss(g.w, 0, 0);
      park(g.w, 150, 0);
    }
    run(pull.w, 0.5);
    run(push.w, 0.5);
    const dIn = 150 - (pull.w.x[0] ?? 0);
    const dOut = (push.w.x[0] ?? 0) - 150;
    expect(dIn).toBeGreaterThan(0);
    expect(dOut).toBeGreaterThan(0);
    expect(dOut).toBeLessThanOrEqual(dIn + 1e-6); // never faster than the pull
    expect(dOut).toBeLessThanOrEqual(GRAVITAS.pullMax * 0.5);
    // While it pushes the core pull is off and render keeps the strength.
    const p = pulls(push.w);
    expect(p).toHaveLength(1);
    expect(bs(push.w).hzRate[p[0] ?? 0]).toBe(0);
    expect(push.w.vx[p[0] ?? 0]).toBe(GRAVITAS.pullMax);
    expect(bs(pull.w).hzRate[pulls(pull.w)[0] ?? 0]).toBe(GRAVITAS.pullMax);
  });

  it('the tide flips in play, and carries on through the stage 2 split onto the pair', () => {
    const { w, id } = gravitasOpen();
    enrage(w, GRAVITAS_FURY.flipSec - 0.2);
    run(w, 0.3);
    expect(readBoss(w, createBossView()).tide).toBe(-1);
    w.hp[id] = Math.floor(bs(w).maxHp * CRACK_AT[1]) + 5;
    damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
    expect(bs(w).split).toBe(true);
    run(w, 0.5);
    const p = pulls(w);
    expect(p).toHaveLength(2);
    for (const h of p) expect(bs(w).hzRate[h]).toBe(0);
    run(w, GRAVITAS_FURY.flipSec);
    expect(readBoss(w, createBossView()).tide).toBe(1);
    for (const h of pulls(w)) expect(bs(w).hzRate[h]).toBeGreaterThan(0);
  });
});
