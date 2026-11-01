// Warden (docs/12 roster row 1): the shell opens for 2 s after each ring launches (and 2.0 s after
// each shield, see bossWardenShield), the ring gap faces the ship, phase 2 rings come faster with
// two gaps, and it seeks at 55 u/s. GW2: rings every 3.7 s and 2.8 s (4.05 and 3.15 at GW1).
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { damageBoss } from '../../src/game/bosses/core';
import { hazardTelegraph, wrapPi } from '../../src/game/bosses/kit';
import { WARDEN, WARDEN_SHIELD } from '../../src/game/bosses/table';
import { HazardType } from '../../src/game/bosses/types';
import { ringEvery, ringGaps } from '../../src/game/bosses/warden';
import { stepGame } from '../../src/game/game';
import { angleBetween } from '../../src/game/steer';
import { Kind, type World } from '../../src/game/world';
import { bs, bossGame, enter, park } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => bus.clear());

function rings(w: World): number[] {
  const out: number[] = [];
  for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Ring) out.push(h);
  return out;
}

describe('warden', () => {
  it('opens only after a ring launches (2 s) or a shield drops (2.0 s), and blocks every shot otherwise', () => {
    const w = bossGame('warden');
    park(w, 600, 400);
    const id = enter(w);
    const tele = hazardTelegraph(1);
    let wasOpen = false;
    let windows = 0;
    let openSteps = 0;
    const lengths: number[] = [];
    let ringsBorn = 0;
    let lastLaunch = -99;
    let lastDrop = -99;
    let wasShielded = false;
    let fromShield = false;
    const shieldLengths: number[] = [];
    for (let i = 0; i < 120 * 32; i++) {
      stepGame(w, DT, idle());
      const t = i * DT;
      if (wasShielded && !bs(w).shielded) lastDrop = t;
      wasShielded = bs(w).shielded;
      for (const h of rings(w)) {
        const age = w.t[h] ?? 0;
        if (age <= DT * 1.5) ringsBorn++;
        if (age >= tele && age < tele + DT * 1.5) lastLaunch = t;
      }
      const open = bs(w).open;
      if (open && !wasOpen) {
        windows++;
        // A ring launched, or the shield dropped, on this step or the one before.
        fromShield = t - lastDrop <= DT * 2.5;
        expect(fromShield || t - lastLaunch <= DT * 2.5).toBe(true);
      }
      if (open) openSteps++;
      if (!open && wasOpen) {
        // A shield going up closes the core early: that ring window is cut short.
        if (fromShield) shieldLengths.push(openSteps / 120);
        else if (!bs(w).shielded) lengths.push(openSteps / 120);
      }
      if (!open) openSteps = 0;
      wasOpen = open;
      // Damage lands exactly when open.
      const hp = w.hp[id] ?? 0;
      damageBoss(w, 1, 0, 0);
      expect(w.hp[id]).toBe(open ? hp - 1 : hp);
    }
    expect(windows).toBeGreaterThanOrEqual(5);
    expect(windows).toBeLessThanOrEqual(ringsBorn + shieldLengths.length);
    expect(lengths.length).toBeGreaterThanOrEqual(3);
    expect(shieldLengths.length).toBe(2); // shields at 10 s and 24 s
    for (const l of lengths) expect(Math.abs(l - WARDEN.openSec)).toBeLessThanOrEqual(DT * 2);
    for (const l of shieldLengths) expect(l).toBeGreaterThanOrEqual(WARDEN_SHIELD.openSec - DT * 2);
  });

  it('never opens before its first ring', () => {
    const w = bossGame('warden');
    park(w, 600, 400);
    enter(w);
    for (let i = 0; i < 120 * (WARDEN.firstRing + hazardTelegraph(1)) - 4; i++) {
      stepGame(w, DT, idle());
      expect(bs(w).open).toBe(false);
    }
  });

  it('the ring gap faces the ship when the ring is made', () => {
    const w = bossGame('warden');
    park(w, -500, 300);
    const id = enter(w);
    let checked = 0;
    for (let i = 0; i < 120 * 12; i++) {
      stepGame(w, DT, idle());
      for (const h of rings(w)) {
        if ((w.t[h] ?? 0) > DT * 1.5) continue;
        expect(Math.abs(wrapPi((w.rot[h] ?? 0) - angleBetween(w, id, 0)))).toBeLessThan(0.05);
        expect((w.vx[h] ?? 0) * 2).toBeCloseTo((WARDEN.gapDeg * Math.PI) / 180);
        expect(w.vy[h]).toBe(1);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it('phase 2 rings come every 2.8 s with two gaps', () => {
    expect(ringEvery(1)).toBe(3.7);
    expect(ringEvery(2)).toBe(2.8);
    expect(ringGaps(2)).toBe(2);
    const w = bossGame('warden');
    park(w, 600, 400);
    enter(w);
    bs(w).open = true;
    damageBoss(w, Math.floor(bs(w).maxHp / 2) + 1, 0, 0);
    expect(bs(w).phase).toBe(2);
    const born: number[] = [];
    // Stop before the first shield (10 s into the fight) pauses the ring clock.
    for (let i = 0; i < 120 * 9; i++) {
      stepGame(w, DT, idle());
      for (const h of rings(w)) {
        if ((w.t[h] ?? 0) > DT * 1.5) continue;
        expect(w.vy[h]).toBe(2);
        born.push(i * DT);
      }
    }
    expect(born.length).toBeGreaterThanOrEqual(2);
    for (let k = 1; k < born.length; k++) expect((born[k] ?? 0) - (born[k - 1] ?? 0)).toBeCloseTo(2.8, 1);
  });

  it('seeks its target at no more than 55 u/s', () => {
    const w = bossGame('warden');
    park(w, 600, 400);
    const id = enter(w);
    let x = w.x[id] ?? 0;
    let y = w.y[id] ?? 0;
    for (let s = 0; s < 6; s++) {
      for (let i = 0; i < 120; i++) stepGame(w, DT, idle());
      const nx = w.x[id] ?? 0;
      const ny = w.y[id] ?? 0;
      expect(Math.hypot(nx - x, ny - y)).toBeLessThanOrEqual(WARDEN.seekSpeed + 0.01);
      x = nx;
      y = ny;
    }
  });
});
