// Warden GW2 (fairness 5 of 5, target 4): 520 hits, 10 Hornets per shield at 300 u/s, rings every
// 3.7 s and 2.8 s, a 2.0 s window after the shield, 'sim:bossShield' on every shield edge, and in
// phase 2 the dropping shield fires one ring of 12 enemy bullets.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { damageBoss } from '../../src/game/bosses/core';
import { BOSS_TABLE, HORNET, MAX_HORNETS, WARDEN, WARDEN_SHIELD } from '../../src/game/bosses/table';
import { dropRingActive, dropRingHeading, ringEvery } from '../../src/game/bosses/warden';
import { enemyBulletsOf } from '../../src/game/enemyBullets';
import { stepGame } from '../../src/game/game';
import type { World } from '../../src/game/world';
import { bs, bossGame, enter, park, run, LEGACY_BOSS_HP } from './bossHelpers';
import { stateHash } from './bossGw2Helpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

function fight(phase: 1 | 2): { w: World; id: number } {
  const w = bossGame('warden', { par: 1000 });
  park(w, 600, 400);
  const id = enter(w);
  if (phase === 2) {
    bs(w).open = true;
    damageBoss(w, Math.floor(bs(w).maxHp / 2) + 1, 0, 0);
    expect(bs(w).phase).toBe(2);
    run(w, 1);
  }
  return { w, id };
}

function untilShieldEdge(w: World, up: boolean, secs = 20): void {
  for (let i = 0; i < secs * 120; i++) {
    if (bs(w).shielded === up) return;
    stepGame(w, DT, idle());
  }
  throw new Error('no shield edge');
}

function liveBullets(w: World): number[] {
  const p = enemyBulletsOf(w);
  const out: number[] = [];
  for (let e = 0; e < p.cap; e++) if (p.alive[e] === 1) out.push(e);
  return out;
}

describe('warden GW2 numbers', () => {
  it('HP 520, 10 Hornets in a pool of 10 at 300 u/s, rings 3.7 s and 2.8 s, 2.0 s shield window', () => {
    expect(LEGACY_BOSS_HP.warden).toBe(520); // release polish raised the row (bossScale tests)
    expect(MAX_HORNETS).toBe(10);
    expect(WARDEN_SHIELD.hornetsMin).toBe(10);
    expect(WARDEN_SHIELD.hornetsMax).toBe(10);
    expect(HORNET.speed).toBe(300);
    expect(ringEvery(1)).toBe(3.7);
    expect(ringEvery(2)).toBe(2.8);
    expect(WARDEN.ringEvery).toBe(3.7);
    expect(WARDEN_SHIELD.openSec).toBe(2.0);
    expect(WARDEN_SHIELD.dropRingBullets).toBe(12);
  });

  it('pure drop ring rules: phase 2 only, 12 headings evenly spaced from the first', () => {
    expect(dropRingActive(1)).toBe(false);
    expect(dropRingActive(2)).toBe(true);
    const n = WARDEN_SHIELD.dropRingBullets;
    expect(dropRingHeading(0.5, 0, n)).toBe(0.5);
    for (let k = 1; k < n; k++) expect(dropRingHeading(0.5, k, n) - dropRingHeading(0.5, k - 1, n)).toBeCloseTo((Math.PI * 2) / n, 9);
  });
});

describe('warden sim:bossShield', () => {
  it('fires once when the shield goes up and once when it drops, with the body position', () => {
    const { w, id } = fight(1);
    const log: { up: boolean; x: number; y: number; id: string; t: number }[] = [];
    let t = 0;
    bus.on('sim:bossShield', (e) => log.push({ up: e.up, x: e.x, y: e.y, id: e.id, t }));
    for (let i = 0; i < 120 * 30; i++) {
      stepGame(w, DT, idle());
      t += DT;
    }
    // Shields start 10 s and 24 s into the fight, each up 4 s.
    expect(log.map((e) => e.up)).toEqual([true, false, true, false]);
    for (const e of log) expect(e.id).toBe('warden');
    expect((log[1]?.t ?? 0) - (log[0]?.t ?? 0)).toBeCloseTo(WARDEN_SHIELD.shieldSec, 1);
    expect((log[2]?.t ?? 0) - (log[0]?.t ?? 0)).toBeCloseTo(WARDEN_SHIELD.everySec, 1);
    // Warden stands still while shielded, so the up and drop positions match its body.
    expect(log[0]?.x).toBe(log[1]?.x);
    expect(log[0]?.y).toBe(log[1]?.y);
    expect(Number.isFinite(w.x[id] ?? NaN)).toBe(true);
  });

  it('a ship death while shielded drops the shield with one event', () => {
    const w = bossGame('warden', { par: 1000, lives: 5 }, {}, false);
    park(w, 600, 400);
    enter(w);
    untilShieldEdge(w, true);
    const log: boolean[] = [];
    bus.on('sim:bossShield', (e) => log.push(e.up));
    w.ship.invuln = 0;
    // Park the ship on the body: contact kills.
    const id = bs(w).id;
    park(w, w.x[id] ?? 0, w.y[id] ?? 0);
    stepGame(w, DT, idle());
    expect(w.ship.active).toBe(false);
    expect(bs(w).shielded).toBe(false);
    expect(log).toEqual([false]);
  });
});

describe('warden phase 2 drop ring', () => {
  it('phase 1: no bullets when the shield drops', () => {
    const { w } = fight(1);
    untilShieldEdge(w, true);
    untilShieldEdge(w, false);
    expect(liveBullets(w).length).toBe(0);
  });

  it('phase 2: one ring of 12 bullets round the body as the shield drops, launching after the telegraph', () => {
    const { w, id } = fight(2);
    untilShieldEdge(w, true);
    expect(liveBullets(w).length).toBe(0);
    const shots: number[] = [];
    bus.on('fx:bossShot', () => shots.push(1));
    untilShieldEdge(w, false);
    const ring = liveBullets(w);
    expect(ring.length).toBe(WARDEN_SHIELD.dropRingBullets);
    const p = enemyBulletsOf(w);
    const bx = w.x[id] ?? 0;
    const by = w.y[id] ?? 0;
    const angles = ring.map((e) => Math.atan2((p.vy[e] ?? 0), (p.vx[e] ?? 0))).sort((a, b) => a - b);
    for (let k = 1; k < angles.length; k++) expect((angles[k] ?? 0) - (angles[k - 1] ?? 0)).toBeCloseTo((Math.PI * 2) / 12, 3);
    for (const e of ring) {
      expect(Math.hypot((p.x[e] ?? 0) - bx, (p.y[e] ?? 0) - by)).toBeGreaterThan(BOSS_TABLE.warden.radius);
      expect(Math.hypot(p.vx[e] ?? 0, p.vy[e] ?? 0)).toBeCloseTo(WARDEN_SHIELD.dropRingSpeed, 3);
      expect(p.arm[e] ?? 0).toBeGreaterThan(0); // charging: harmless until the telegraph ends
    }
    run(w, 1.1);
    expect(shots.length).toBe(1);
  });

  it('determinism: two phase 2 runs over 40 s hash equal, with no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): number => {
      const { w } = fight(2);
      const log: number[] = [];
      bus.on('sim:bossShield', (e) => log.push(e.up ? 1 : 0, e.x, e.y));
      let h = 0;
      for (let i = 0; i < 120 * 40; i++) {
        stepGame(w, DT, idle());
        if (i % 30 === 0) h = (h * 31 + stateHash(w)) % 2147483647;
      }
      bus.clear();
      return (h * 31 + log.reduce((a, v) => (a * 17 + Math.round(v * 1000)) % 2147483647, 0)) % 2147483647;
    };
    expect(once()).toBe(once());
  });
});
