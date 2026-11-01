// Bastion phase 3 shield (GW2): once the turrets are gone the core drifts toward the ship at 50 u/s;
// every 12 s (the first 12 s after waking) it raises a shield for 3 s (shots absorbed,
// 'sim:bossShield'), releases 6 Hornets from the shared Hornet pool, then opens for 2 s.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { shieldClockStart, Wake } from '../../src/game/bosses/bastion';
import { countHornets, damageBoss, livePart } from '../../src/game/bosses/core';
import { BASTION, BASTION_SHIELD, HORNET } from '../../src/game/bosses/table';
import { BossMode } from '../../src/game/bosses/types';
import { stepGame } from '../../src/game/game';
import type { World } from '../../src/game/world';
import { breakTurret, bs, bossGame, enter, park, run } from './bossHelpers';
import { stateHash } from './bossGw2Helpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

/** Bastion with every turret down (phase 3, awake) and the phase change pause over. */
function awake(): { w: World; id: number } {
  const w = bossGame('bastion', { lives: 9, par: 1000 });
  park(w, 600, 380);
  const id = enter(w);
  for (let k = 0; k < BASTION.turrets; k++) {
    const p = livePart(w, bs(w), k);
    if (p > 0) breakTurret(w, p, BASTION.turretHp);
  }
  expect(bs(w).phase).toBe(3);
  return { w, id };
}

describe('bastion phase 3 shield', () => {
  it('pure rules: every 10 s (GW4), the first 10 s after waking, up 3 s, 6 Hornets, open 2 s, drift 50 u/s', () => {
    expect(BASTION_SHIELD.everySec).toBe(10);
    expect(BASTION_SHIELD.firstSec).toBe(10);
    expect(BASTION_SHIELD.shieldSec).toBe(3);
    expect(BASTION_SHIELD.hornets).toBe(6);
    expect(BASTION_SHIELD.openSec).toBe(2);
    expect(BASTION.wakeSpeed).toBe(50);
    expect(shieldClockStart()).toBe(BASTION_SHIELD.everySec - BASTION_SHIELD.firstSec);
  });

  it('shield timing: up about every 10 s for 3 s, then a 2 s open window, with sim:bossShield edges', () => {
    const { w } = awake();
    const log: { up: boolean; t: number; id: string }[] = [];
    let t = 0;
    bus.on('sim:bossShield', (e) => log.push({ up: e.up, t, id: e.id }));
    const opens: number[] = [];
    let openRun = 0;
    let wasShielded = false;
    for (let i = 0; i < 120 * 35; i++) {
      stepGame(w, DT, idle());
      t += DT;
      const s = bs(w);
      if (wasShielded && !s.shielded) openRun = 0;
      if (!s.shielded && s.openLeft > 0 && s.mode === BossMode.Vulnerable) openRun += DT;
      else if (openRun > 0) {
        opens.push(openRun);
        openRun = 0;
      }
      wasShielded = s.shielded;
      expect(s.status).toBe('alive');
    }
    expect(log.map((e) => e.up)).toEqual([true, false, true, false, true, false]);
    for (const e of log) expect(e.id).toBe('bastion');
    const ups = log.filter((e) => e.up).map((e) => e.t);
    const downs = log.filter((e) => !e.up).map((e) => e.t);
    // The first comes 10 s after waking (plus the phase change pause, at most the charge it waited for).
    expect(ups[0] ?? 0).toBeGreaterThanOrEqual(BASTION_SHIELD.firstSec - 0.05);
    expect(ups[0] ?? 0).toBeLessThanOrEqual(BASTION_SHIELD.firstSec + 2.5);
    for (let k = 0; k < ups.length; k++) expect((downs[k] ?? 0) - (ups[k] ?? 0)).toBeCloseTo(BASTION_SHIELD.shieldSec, 1);
    for (let k = 1; k < ups.length; k++) {
      const gap = (ups[k] ?? 0) - (ups[k - 1] ?? 0);
      expect(gap).toBeGreaterThan(BASTION_SHIELD.everySec - 2.5);
      expect(gap).toBeLessThan(BASTION_SHIELD.everySec + 2.5);
    }
    expect(opens.length).toBeGreaterThanOrEqual(2);
    for (const o of opens) expect(o).toBeCloseTo(BASTION_SHIELD.openSec, 1);
  });

  it('while shielded shots are absorbed and it stands still; 6 Hornets join from the shared pool', () => {
    const { w, id } = awake();
    for (let i = 0; i < 120 * 20 && !bs(w).shielded; i++) stepGame(w, DT, idle());
    expect(bs(w).shielded).toBe(true);
    const x = w.x[id] ?? 0;
    const y = w.y[id] ?? 0;
    let peak = 0;
    for (let i = 0; i < 120 * (BASTION_SHIELD.shieldSec - 0.1); i++) {
      stepGame(w, DT, idle());
      expect(bs(w).open).toBe(false);
      expect(w.x[id]).toBe(x);
      expect(w.y[id]).toBe(y);
      const hp = w.hp[id] ?? 0;
      damageBoss(w, 10, 0, 0);
      expect(w.hp[id]).toBe(hp);
      peak = Math.max(peak, countHornets(w, bs(w)));
    }
    expect(peak).toBe(BASTION_SHIELD.hornets);
    // After the shield the window is open: hits land.
    run(w, 0.2);
    expect(bs(w).shielded).toBe(false);
    expect(bs(w).open).toBe(true);
    const hp = w.hp[id] ?? 0;
    damageBoss(w, 10, 0, 0);
    expect(w.hp[id]).toBe(hp - 10);
  });

  it('drifts toward the ship at no more than 50 u/s between shields', () => {
    const { w, id } = awake();
    run(w, 1.1); // the phase change pause
    let x = w.x[id] ?? 0;
    let y = w.y[id] ?? 0;
    const d0 = Math.hypot(x - (w.x[0] ?? 0), y - (w.y[0] ?? 0));
    let checked = 0;
    for (let i = 0; i < 120 * 4; i++) {
      const before = bs(w).dir;
      stepGame(w, DT, idle());
      const nx = w.x[id] ?? 0;
      const ny = w.y[id] ?? 0;
      if (before === Wake.Pursue && bs(w).dir === Wake.Pursue && !bs(w).shielded) {
        expect(Math.hypot(nx - x, ny - y)).toBeLessThanOrEqual(BASTION.wakeSpeed * DT * 1.001);
        checked++;
      }
      x = nx;
      y = ny;
    }
    expect(checked).toBeGreaterThan(100);
    expect(Math.hypot(x - (w.x[0] ?? 0), y - (w.y[0] ?? 0))).toBeLessThan(d0);
    expect(HORNET.speed).toBe(300);
  });

  it('determinism: two 40 s phase 3 runs hash equal, with no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): number => {
      const { w } = awake();
      let shields = 0;
      bus.on('sim:bossShield', (e) => {
        if (e.up) shields++;
      });
      let h = 0;
      for (let i = 0; i < 120 * 40; i++) {
        stepGame(w, DT, idle());
        if (i % 30 === 0) h = (h * 31 + stateHash(w)) % 2147483647;
      }
      bus.clear();
      expect(shields).toBe(3);
      return h;
    };
    expect(once()).toBe(once());
  });
});
