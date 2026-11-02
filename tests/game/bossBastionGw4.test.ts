// Bastion GW4 (device gate GW4, build a1bbf1c: turrets "not harder to kill", fairness 5, too easy,
// target 4): turrets 30 HP; a fallen turret rebuilds at half hit points 18 s after it fell, one at a
// time, while the core holds more than 33 percent and has not woken; core hit points plus 20
// percent; the phase 3 shield every 10 s. Only the first four turret deaths cut the bar, so a
// rebuilt turret never makes the bar easier.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { DEATHS, deathCutsBar, regenAllowed, regenHp, REGEN, turretBarCut } from '../../src/game/bosses/bastion';
import { countParts, livePart } from '../../src/game/bosses/core';
import { BASTION, BASTION_SHIELD, BOSS_TABLE, PHASE_CHANGE_SEC } from '../../src/game/bosses/table';
import { PartType } from '../../src/game/bosses/types';
import { stepGame } from '../../src/game/game';
import type { World } from '../../src/game/world';
import { breakTurret, bs, bossGame, enter, park, run, legacyBossHp } from './bossHelpers';
import { stateHash } from './bossGw2Helpers';
import { DT, idle } from './helpers';

// Mechanics tuned on the GW6 hit points (release polish raised the rows; bossFightLength covers them).
legacyBossHp();

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

function game(): { w: World; boss: number } {
  const w = bossGame('bastion', { lives: 9 });
  park(w, 600, 380);
  return { w, boss: enter(w) };
}

function kill(w: World, k: number): void {
  const p = livePart(w, bs(w), k);
  expect(p).toBeGreaterThan(0);
  breakTurret(w, p, 9999);
  expect(livePart(w, bs(w), k)).toBe(-1);
}

describe('bastion gw4 rules', () => {
  it('30 HP turrets, rebuilt at 15 HP after 12 s (GW5) above 33 percent, core plus 20 then 15 percent, shield every 10 s', () => {
    expect(BASTION.turretHp).toBe(300);
    expect(regenHp()).toBe(150);
    expect(BASTION.regenSec).toBe(12); // GW5: 18 before
    expect(BOSS_TABLE.bastion.hp).toBe(Math.round(900 * 1.2 * 1.15)); // GW5: plus 15 percent
    expect(BASTION_SHIELD.everySec).toBe(10);
    expect(regenAllowed(3400, 10000, 2)).toBe(true);
    expect(regenAllowed(3300, 10000, 2)).toBe(false);
    expect(regenAllowed(9000, 10000, 3)).toBe(false); // the woken core never rebuilds
    expect(deathCutsBar(4)).toBe(true);
    expect(deathCutsBar(5)).toBe(false);
  });
});

describe('bastion gw4 turret regen', () => {
  it('a fallen turret rebuilds 18 s after it fell, in its slot, at half hit points', () => {
    const { w } = game();
    kill(w, 0);
    run(w, BASTION.regenSec - 0.1);
    expect(livePart(w, bs(w), 0)).toBe(-1);
    run(w, 0.2);
    const p = livePart(w, bs(w), 0);
    expect(p).toBeGreaterThan(0);
    expect(w.a[p]).toBe(PartType.Turret);
    expect(w.hp[p]).toBe(regenHp());
    expect(countParts(w, bs(w))).toBe(4);
    expect(bs(w).abl[REGEN]).toBe(-1); // nothing else down: the clock idles
  });

  it('one at a time: the second turret down returns 18 s after the first rebuild', () => {
    const { w } = game();
    kill(w, 0);
    run(w, 5);
    kill(w, 1); // two down: phase 2, and the boss (its regen clock too) holds for the phase change
    expect(bs(w).phase).toBe(2);
    run(w, BASTION.regenSec - 5 + PHASE_CHANGE_SEC + 0.1);
    expect(livePart(w, bs(w), 0)).toBeGreaterThan(0);
    expect(livePart(w, bs(w), 1)).toBe(-1);
    run(w, BASTION.regenSec - 0.2);
    expect(livePart(w, bs(w), 1)).toBe(-1);
    run(w, 0.2);
    expect(livePart(w, bs(w), 1)).toBeGreaterThan(0);
    expect(w.hp[livePart(w, bs(w), 1)]).toBe(regenHp());
  });

  it('no rebuild once the core is at 33 percent or less', () => {
    const { w, boss } = game();
    kill(w, 0);
    w.hp[boss] = Math.floor(bs(w).maxHp * BASTION.regenAboveShare);
    run(w, BASTION.regenSec + 1);
    expect(livePart(w, bs(w), 0)).toBe(-1);
  });

  it('no rebuild after the core wakes (all four down)', () => {
    const { w } = game();
    for (let k = 0; k < 4; k++) kill(w, k);
    expect(bs(w).phase).toBe(3);
    run(w, BASTION.regenSec + 2);
    expect(countParts(w, bs(w))).toBe(0);
  });

  it('only the first four turret deaths cut the bar', () => {
    const { w, boss } = game();
    const cut = turretBarCut(bs(w).maxHp);
    for (let n = 1; n <= 5; n++) {
      const before = w.hp[boss] ?? 0;
      kill(w, 0);
      expect(bs(w).abl[DEATHS]).toBe(n);
      expect(before - (w.hp[boss] ?? 0)).toBe(n <= 4 ? cut : 0);
      if (n < 5) run(w, BASTION.regenSec + 0.1);
    }
  });

  it('determinism: two runs with turret kills and rebuilds hash equal, with no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): number => {
      const { w } = game();
      const input = idle();
      let h = 1;
      for (let i = 0; i < 120 * 50; i++) {
        if (i === 120 * 2) kill(w, 0);
        if (i === 120 * 6) kill(w, 2);
        stepGame(w, DT, input);
        if (i % 30 === 0) h = (h * 31 + stateHash(w)) % 2147483647;
      }
      expect(countParts(w, bs(w))).toBe(4);
      bus.clear();
      return h;
    };
    expect(once()).toBe(once());
  });
});
