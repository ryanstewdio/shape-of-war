// Bastion GW3 (device gate GW3: "the turrets are too easy to kill, which makes Bastion lose down to
// 50 percent easily"): turrets have 18 HP, the live turrets are shielded for 1.5 s after each turret
// death (hits blocked), and turret kills alone take the bar down by 20 percent at most.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { hpAfterTurret, turretBarCut, turretOpen, turretShieldAfter } from '../../src/game/bosses/bastion';
import { countParts, damageBossPart, livePart } from '../../src/game/bosses/core';
import { BASTION } from '../../src/game/bosses/table';
import { stepGame } from '../../src/game/game';
import { Kind, type World } from '../../src/game/world';
import { bs, bossGame, enter, park, run } from './bossHelpers';
import { stateHash } from './bossGw2Helpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

function game(): { w: World; boss: number } {
  const w = bossGame('bastion', { lives: 9 });
  park(w, 600, 380);
  return { w, boss: enter(w) };
}

/** Hit turret slot k with amount tenths; the part id it hit (or -1 when gone). */
function hit(w: World, k: number, amount: number): number {
  const p = livePart(w, bs(w), k);
  if (p > 0) damageBossPart(w, p, amount, w.x[p] ?? 0, w.y[p] ?? 0);
  return p;
}

describe('bastion gw3 pure rules', () => {
  it('18 HP turrets, a 5 percent bar cut per turret, 20 percent for all four, a 1.5 s shield', () => {
    expect(BASTION.turretHp).toBe(180);
    expect(BASTION.turretShieldSec).toBe(1.5);
    expect(turretBarCut(9000)).toBe(450);
    expect(BASTION.turrets * turretBarCut(9000)).toBeLessThanOrEqual(9000 * 0.2);
    expect(hpAfterTurret(9000, 9000)).toBe(8550);
    expect(hpAfterTurret(200, 9000)).toBe(1); // a turret death never kills the core
    expect(hpAfterTurret(1, 9000)).toBe(1);
    expect(turretShieldAfter(1.5, 0.5)).toBeCloseTo(1, 9);
    expect(turretShieldAfter(0.2, 0.5)).toBe(0);
    expect(turretOpen(0)).toBe(true);
    expect(turretOpen(0.1)).toBe(false);
  });
});

describe('bastion gw3', () => {
  it('a turret takes 18 HP: 17.9 leaves it standing', () => {
    const { w } = game();
    const p = hit(w, 0, 179);
    expect(w.alive[p]).toBe(1);
    expect(w.hp[p]).toBe(1);
    hit(w, 0, 1);
    expect(w.alive[p]).toBe(0);
  });

  it('the turrets left are shielded for 1.5 s after a turret death: hits blocked, then they land', () => {
    const { w } = game();
    const blocked: boolean[] = [];
    bus.on('fx:hit', (e) => {
      if (e.kind === Kind.BossPart) blocked.push(e.blocked);
    });
    hit(w, 0, BASTION.turretHp);
    const p = hit(w, 2, 50);
    expect(w.hp[p]).toBe(BASTION.turretHp);
    expect(blocked).toEqual([true]);
    run(w, 1.0);
    hit(w, 2, 50);
    expect(w.hp[p]).toBe(BASTION.turretHp);
    run(w, 0.6);
    hit(w, 2, 50);
    expect(w.hp[p]).toBe(BASTION.turretHp - 50);
    expect(blocked).toEqual([true, true, false]);
  });

  it('turret kills alone take the bar down by 20 percent at most', () => {
    const { w, boss } = game();
    const s = bs(w);
    const bar: number[] = [];
    bus.on('hud:boss', (e) => bar.push(e.hp));
    for (let i = 0; i < 120 * 30 && countParts(w, s) > 0; i++) {
      for (let k = 0; k < BASTION.turrets; k++) hit(w, k, 30); // steady fire on every turret, never the core
      stepGame(w, DT, idle());
    }
    expect(countParts(w, s)).toBe(0);
    expect(s.phase).toBe(3);
    expect(w.hp[boss]).toBe(s.maxHp - BASTION.turrets * turretBarCut(s.maxHp));
    expect(w.hp[boss]).toBeGreaterThanOrEqual(Math.round(s.maxHp * 0.8));
    for (const h of bar) expect(h).toBeGreaterThanOrEqual(Math.round(s.maxHp * 0.8));
  });

  it('determinism: two 40 s runs with steady turret fire hash equal, with no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): number => {
      const { w } = game();
      let h = 1;
      for (let i = 0; i < 120 * 40; i++) {
        if (i % 12 === 0) for (let k = 0; k < BASTION.turrets; k++) hit(w, k, 20);
        stepGame(w, DT, idle());
        if (i % 30 === 0) h = (h * 31 + stateHash(w)) % 2147483647;
      }
      bus.clear();
      return h;
    };
    expect(once()).toBe(once());
  });
});
