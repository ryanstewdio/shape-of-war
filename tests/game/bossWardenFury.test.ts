// Warden fury (Ryan 2026-11-11). When the Shield bar empties (the stage 1 crack) Warden breaks: it
// stops, clears its rings and Hornets, closes its core and takes no damage for FURY_BREAK_SEC, and
// phase 2 starts there. Then it is enraged to its death: faster seek, turn and rings, and a dash
// charge (aim 0.8 s, dash at 300 u/s for up to 1.0 s, a ring of 12 bullets, a 2.0 s open core).
// Brood first cut retune from Ryan's device time is pinned at the bottom.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { armBoss, bossOnShipDeath, countHornets, damageBoss, spawnHornet, spawnRing } from '../../src/game/bosses/core';
import { BOSS_TABLE, BROODLING, CRACK_AT, FURY_BREAK_SEC, HAZARD, WARDEN, WARDEN_FURY, WARDEN_SHIELD } from '../../src/game/bosses/table';
import { createBossView, readBoss } from '../../src/game/bosses/view';
import { DASH_CLOCK_SLOT, SHIELD_CLOCK_SLOT, furyBreakHp, furyClamp, ringEvery, seekSpeedFor, turnRateFor } from '../../src/game/bosses/warden';
import { enemyBulletsOf } from '../../src/game/enemyBullets';
import { stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { bs, bossGame, count, enter, park, run, wardenFury } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

function liveBullets(w: World): number {
  const p = enemyBulletsOf(w);
  let n = 0;
  for (let e = 0; e < p.cap; e++) if (p.alive[e] === 1) n++;
  return n;
}

/** Warden past its entrance with the ship parked; returns the body id. */
function warden(shield = true): { w: World; id: number } {
  const w = bossGame('warden', { par: 1000 }, {}, shield);
  park(w, 600, 400);
  const id = enter(w);
  return { w, id };
}

/** Bring the dash due on the next step with Warden at (bx, by) and the ship at (sx, sy). */
function dashNow(w: World, id: number, bx: number, by: number, sx: number, sy: number): void {
  bs(w).abl[DASH_CLOCK_SLOT] = DT / 2;
  w.x[id] = bx;
  w.y[id] = by;
  park(w, sx, sy);
  w.ship.invuln = 0;
}

describe('warden fury: pure rules', () => {
  it('the break hit points sit just below the stage 1 crack', () => {
    for (const max of [100, 519, 5190, 3000]) {
      const v = furyBreakHp(max);
      expect(v).toBeLessThan(max * CRACK_AT[0]);
      expect(v + 1).toBeGreaterThanOrEqual(max * CRACK_AT[0]);
    }
    expect(furyBreakHp(0)).toBe(0);
  });

  it('clamp: no damage in the break, the crossing hit stops at the bar, enraged hits land whole', () => {
    expect(furyClamp(1, 400, 519, 50)).toBe(0);
    expect(furyClamp(0, furyBreakHp(519) + 5, 519, 50)).toBe(5);
    expect(furyClamp(0, 500, 519, 10)).toBe(10);
    expect(furyClamp(2, 300, 519, 50)).toBe(50);
  });

  it('enraged numbers live in WARDEN_FURY: seek 55 to 80, turn 60 to 90 deg/s, rings 2.8 to 2.4 s', () => {
    expect(FURY_BREAK_SEC).toBe(4.5);
    expect(seekSpeedFor(0)).toBe(55);
    expect(seekSpeedFor(2)).toBe(80);
    expect(turnRateFor(0)).toBeCloseTo((60 * Math.PI) / 180, 9);
    expect(turnRateFor(2)).toBeCloseTo((90 * Math.PI) / 180, 9);
    expect(ringEvery(2, 0)).toBe(2.8);
    expect(ringEvery(2, 2)).toBe(2.4);
    expect(WARDEN_FURY.dashFirst).toBe(3);
    expect(WARDEN_FURY.dashEvery).toBe(8);
    expect(WARDEN_FURY.aimSec).toBe(0.8);
    expect(WARDEN_FURY.dashSpeed).toBe(300);
    expect(WARDEN_FURY.dashSec).toBe(1.0);
    expect(WARDEN_FURY.dashRingBullets).toBe(12);
    expect(WARDEN_FURY.openSec).toBe(2.0);
  });
});

describe('warden fury: the break', () => {
  it('breaks at the crack: stops at the Shield bar, clears rings and Hornets, closes the core', () => {
    const { w, id } = warden();
    const s = bs(w);
    run(w, 1.4); // a ring launches at 1.5 s; place one by hand and a Hornet too
    spawnRing(w, s, w.x[id] ?? 0, w.y[id] ?? 0, 80, 0, 0.5, 1, HAZARD.ringGrowth);
    spawnHornet(w, s, (w.x[id] ?? 0) + 90, w.y[id] ?? 0, 0);
    expect(count(w, Kind.BossHazard)).toBeGreaterThan(0);
    expect(countHornets(w, s)).toBe(1);
    s.open = true;
    damageBoss(w, 99999, 0, 0);
    expect(w.hp[id]).toBe(furyBreakHp(s.maxHp));
    expect(s.fury).toBe(1);
    expect(s.crack[0]).toBe(1);
    expect(count(w, Kind.BossHazard)).toBe(0);
    expect(countHornets(w, s)).toBe(0);
    expect(s.open).toBe(false);
  });

  it('fires break, phase 2, then on, once each and in order, with the break payload', () => {
    const { w, id } = warden();
    const log: string[] = [];
    let breakSec = 0;
    let bx = NaN;
    bus.on('sim:bossFury', (e) => {
      log.push(`fury:${e.stage}`);
      if (e.stage === 'break') {
        breakSec = e.sec;
        bx = e.x;
        expect(e.id).toBe('warden');
        expect(e.y).toBe(w.y[id]);
      }
    });
    bus.on('sim:bossPhase', (e) => log.push(`phase:${e.phase}`));
    bus.on('sim:bossCrack', (e) => log.push(`crack:${e.stage}`));
    const x0 = w.x[id];
    bs(w).open = true;
    damageBoss(w, 99999, 0, 0);
    expect(breakSec).toBe(FURY_BREAK_SEC);
    expect(bx).toBe(x0);
    expect(bs(w).phase).toBe(2); // phase 2 at the break, not at half health
    expect(bs(w).phaseT).toBe(0); // the break is the pause
    run(w, FURY_BREAK_SEC + 0.1);
    bs(w).open = true;
    damageBoss(w, 10, 0, 0);
    run(w, 3);
    expect(log.filter((e) => e.startsWith('fury:'))).toEqual(['fury:break', 'fury:on']);
    expect(log.indexOf('fury:break')).toBeLessThan(log.indexOf('phase:2'));
    expect(log.indexOf('phase:2')).toBeLessThan(log.indexOf('fury:on'));
    expect(log.filter((e) => e === 'phase:2')).toHaveLength(1);
    expect(log.filter((e) => e === 'crack:1')).toHaveLength(1);
  });

  it('takes no damage for 4.5 s, Detonate included, and stands still; then it is enraged', () => {
    const { w, id } = warden();
    const s = bs(w);
    s.open = true;
    damageBoss(w, 99999, 0, 0);
    const hp = w.hp[id];
    const x = w.x[id];
    const y = w.y[id];
    const n = Math.round(FURY_BREAK_SEC * 120);
    for (let i = 0; i < n - 2; i++) {
      s.open = true;
      damageBoss(w, 50, 0, 0);
      damageBoss(w, 50, 0, 0, true);
      stepGame(w, DT, idle());
      expect(w.hp[id]).toBe(hp);
      expect(w.x[id]).toBe(x);
      expect(w.y[id]).toBe(y);
      expect(s.fury).toBe(1);
      expect(count(w, Kind.BossHazard)).toBe(0);
    }
    run(w, 3 * DT);
    expect(s.fury).toBe(2);
    bs(w).open = true;
    damageBoss(w, 50, 0, 0);
    expect(w.hp[id]).toBe((hp ?? 0) - 50);
  });
});

describe('warden fury: enraged', () => {
  it('seeks at up to 80 u/s and turns at up to 90 deg/s', () => {
    const { w, id } = warden();
    wardenFury(w);
    park(w, -600, -400);
    let x = w.x[id] ?? 0;
    let y = w.y[id] ?? 0;
    let r = w.rot[id] ?? 0;
    let peak = 0;
    for (let i = 0; i < 120 * 3; i++) {
      stepGame(w, DT, idle());
      const step = Math.hypot((w.x[id] ?? 0) - x, (w.y[id] ?? 0) - y);
      peak = Math.max(peak, step);
      let dr = Math.abs((w.rot[id] ?? 0) - r);
      if (dr > Math.PI) dr = Math.PI * 2 - dr;
      expect(dr).toBeLessThanOrEqual(WARDEN_FURY.turnRate * DT + 1e-6); // rot is stored in float32
      x = w.x[id] ?? 0;
      y = w.y[id] ?? 0;
      r = w.rot[id] ?? 0;
    }
    expect(peak).toBeLessThanOrEqual(WARDEN_FURY.seekSpeed * DT + 1e-3); // positions are float32
    expect(peak).toBeGreaterThan(WARDEN.seekSpeed * DT * 1.2);
  });

  it('dash: first 3 s after the break, aim 0.8 s still, dash at 300 u/s, ring of 12, then a 2 s open core', () => {
    const { w, id } = warden();
    wardenFury(w, false);
    const s = bs(w);
    s.abl[SHIELD_CLOCK_SLOT] = -100; // hold the shield so the dash cycle shows alone
    const view = createBossView();
    // Find the aim start.
    let t = 0;
    while (readBoss(w, view).dashAim === -1) {
      stepGame(w, DT, idle());
      t += DT;
      expect(t).toBeLessThan(5);
    }
    expect(t).toBeCloseTo(WARDEN_FURY.dashFirst, 1);
    expect(view.dashAim ?? 0).toBeCloseTo(WARDEN_FURY.aimSec, 1);
    const head = view.dashHeading ?? 0;
    const toShip = Math.atan2((w.y[0] ?? 0) - (w.y[id] ?? 0), (w.x[0] ?? 0) - (w.x[id] ?? 0));
    expect(Math.abs(head - toShip)).toBeLessThan(0.05);
    // Aim: still, aim counting down, heading locked, no bullets yet.
    const ax = w.x[id];
    let aim = view.dashAim ?? 0;
    park(w, -600, -400); // the ship moves: the heading stays locked
    while (readBoss(w, view).dashAim !== -1) {
      expect(w.x[id]).toBe(ax);
      expect(view.dashHeading).toBe(head);
      expect(view.dashAim ?? 0).toBeLessThanOrEqual(aim);
      aim = view.dashAim ?? 0;
      stepGame(w, DT, idle());
    }
    expect(liveBullets(w)).toBe(0);
    // Dash: along the heading at 300 u/s until it stops, then the ring and the window.
    let steps = 0;
    let px = w.x[id] ?? 0;
    let py = w.y[id] ?? 0;
    while (liveBullets(w) === 0) {
      stepGame(w, DT, idle());
      steps++;
      const dx = (w.x[id] ?? 0) - px;
      const dy = (w.y[id] ?? 0) - py;
      const d = Math.hypot(dx, dy);
      if (d > 0) {
        expect(d).toBeLessThanOrEqual(WARDEN_FURY.dashSpeed * DT + 1e-6);
        expect(Math.abs(Math.atan2(dy, dx) - head)).toBeLessThan(0.01);
      }
      px = w.x[id] ?? 0;
      py = w.y[id] ?? 0;
      expect(steps).toBeLessThanOrEqual(Math.round(WARDEN_FURY.dashSec * 120) + 2);
    }
    expect(liveBullets(w)).toBe(WARDEN_FURY.dashRingBullets);
    expect(s.open).toBe(true);
    expect(s.openLeft).toBeCloseTo(WARDEN_FURY.openSec, 1);
    // The next dash comes dashEvery after this one started.
    let t2 = 0;
    while (readBoss(w, view).dashAim === -1) {
      stepGame(w, DT, idle());
      t2 += DT;
      expect(t2).toBeLessThan(10);
    }
    expect(t2 + WARDEN_FURY.aimSec + steps * DT).toBeCloseTo(WARDEN_FURY.dashEvery, 0);
  });

  it('the dash stops early at the wall', () => {
    const { w, id } = warden();
    wardenFury(w);
    dashNow(w, id, 400, 0, 600, 0); // heading +x; the wall at x 700 is 244 u of travel away
    stepGame(w, DT, idle());
    run(w, WARDEN_FURY.aimSec + DT);
    let steps = 0;
    while (liveBullets(w) === 0 && steps < 200) {
      stepGame(w, DT, idle());
      steps++;
    }
    expect(liveBullets(w)).toBe(WARDEN_FURY.dashRingBullets);
    expect(steps * DT).toBeLessThan(WARDEN_FURY.dashSec - 0.1);
    expect(w.x[id] ?? 0).toBeGreaterThan(700 - BOSS_TABLE.warden.radius - 2);
  });

  it('contact during the dash kills like body contact', () => {
    const { w, id } = warden(false);
    gs(w).lives = 5;
    wardenFury(w);
    dashNow(w, id, -300, 0, 0, 0);
    stepGame(w, DT, idle());
    run(w, WARDEN_FURY.aimSec + WARDEN_FURY.dashSec);
    expect(gs(w).lives).toBe(4);
  });

  it('never starts a dash while a shield is up or the ship is respawning', () => {
    const { w, id } = warden();
    wardenFury(w);
    const s = bs(w);
    const view = createBossView();
    // Respawning: invulnerable after a respawn, the due dash waits.
    dashNow(w, id, 0, 0, 500, 300);
    w.ship.invuln = 1;
    for (let i = 0; i < 100; i++) {
      stepGame(w, DT, idle());
      expect(readBoss(w, view).dashAim).toBe(-1);
    }
    run(w, 0.3);
    expect(readBoss(w, view).dashAim).toBeGreaterThan(0);
    // Shield: hold the dash, wait for a shield, make the dash due inside it.
    s.abl[DASH_CLOCK_SLOT] = 1e9;
    for (let i = 0; i < 120 * 20 && !s.shielded; i++) stepGame(w, DT, idle());
    expect(s.shielded).toBe(true);
    s.abl[DASH_CLOCK_SLOT] = DT / 2;
    let shieldSteps = 0;
    while (s.shielded) {
      stepGame(w, DT, idle());
      if (s.shielded) expect(readBoss(w, view).dashAim).toBe(-1);
      shieldSteps++;
      expect(shieldSteps).toBeLessThan(120 * (WARDEN_SHIELD.shieldSec + 1));
    }
    run(w, 2 * DT);
    expect(readBoss(w, view).dashAim).toBeGreaterThan(0);
  });

  it('a ship death keeps the fury stage; re-arming clears it', () => {
    const { w } = warden();
    wardenFury(w);
    const s = bs(w);
    bossOnShipDeath(w);
    expect(s.fury).toBe(2);
    armBoss(w, s.spec, s.def, 0.25);
    expect(s.fury).toBe(0);
    expect(s.furyT).toBe(0);
  });

  it('the old enrage at 240 s still stacks on the fury rings', () => {
    const { w } = warden();
    wardenFury(w);
    bs(w).age = 300;
    expect(bs(w).hold || bs(w).age >= 240).toBe(true);
    expect(ringEvery(2, bs(w).fury)).toBe(WARDEN_FURY.ringEvery);
  });
});

describe('warden fury: render contract', () => {
  it('readBoss writes fury, furyT, dashAim and dashHeading every frame', () => {
    const { w } = warden();
    const v = createBossView();
    expect(v.fury).toBe(0);
    expect(v.dashAim).toBe(-1);
    readBoss(w, v);
    expect(v.fury).toBe(0);
    expect(v.furyT).toBe(0);
    expect(v.dashAim).toBe(-1);
    bs(w).open = true;
    damageBoss(w, 99999, 0, 0);
    run(w, 1);
    readBoss(w, v);
    expect(v.fury).toBe(1);
    expect(v.furyT ?? 0).toBeCloseTo(1, 1);
    run(w, FURY_BREAK_SEC);
    readBoss(w, v);
    expect(v.fury).toBe(2);
    expect(v.furyT ?? 0).toBeGreaterThan(0);
  });

  it('other guardians report no fury', () => {
    const w = bossGame('spindle');
    park(w, 600, 400);
    enter(w);
    const v = createBossView();
    v.fury = 2;
    v.dashAim = 1;
    readBoss(w, v);
    expect(v.fury).toBe(0);
    expect(v.dashAim).toBe(-1);
  });

  it('determinism: two 40 s fury fights match, with no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): string => {
      const { w, id } = warden();
      wardenFury(w, false);
      const log: number[] = [];
      for (let i = 0; i < 120 * 40; i++) {
        stepGame(w, DT, idle());
        if (i % 60 === 0) log.push(Math.round((w.x[id] ?? 0) * 100), Math.round((w.y[id] ?? 0) * 100), liveBullets(w));
      }
      bus.clear();
      return log.join(',');
    };
    expect(once()).toBe(once());
  });
});

describe('brood first cut retune (Ryan device time)', () => {
  it('Brood body 202 (x0.44 of 459) and Broodlings 190 (x0.31 of 600, 19 hits each)', () => {
    expect(BOSS_TABLE.brood.hp).toBe(202);
    expect(BROODLING.hp).toBe(190);
    expect(BROODLING.hp / 10).toBe(19);
  });
});
