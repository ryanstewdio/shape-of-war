// Warden's shield and swarm, GW1 rework: in every phase the first shield goes up 10 s into the fight
// and then every 14 s (start to start). It stops, closes its core for 4 s (BossState.shielded) and
// releases Hornets in two bursts into their own pool (MAX_HORNETS, separate from the add slots).
// GW2: 10 Hornets in two bursts of 5, a pool of 10, a 2.0 s window when the shield drops, Hornets
// chase at 300 u/s; they die on their own after 5 s of chase, kill on contact once armed, and go
// with a bomb or a ship death. Phase 2 drop ring and 'sim:bossShield' in bossWardenGw2.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { bossOnBomb, countAdds, countHornets, damageBoss, damageBossPart, liveHornet, spawnAdd, spawnHornet } from '../../src/game/bosses/core';
import { HORNET, MAX_ADDS, MAX_HORNETS, WARDEN_SHIELD } from '../../src/game/bosses/table';
import { PartType } from '../../src/game/bosses/types';
import { createBossView, readBoss } from '../../src/game/bosses/view';
import { burstSize, hornetsFor, shieldActive, shieldClockStart } from '../../src/game/bosses/warden';
import { def as grunt } from '../../src/game/enemies/grunt';
import { stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { bs, bossGame, count, enter, park, run } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

/** Warden in phase 2 with the ship parked, the phase change pause over. Returns the body id. */
function phase2(shield = true): { w: World; id: number } {
  const w = bossGame('warden', { par: 1000 }, {}, shield);
  park(w, 600, 400);
  const id = enter(w);
  bs(w).open = true;
  damageBoss(w, Math.floor(bs(w).maxHp / 2) + 1, 0, 0); // just past 50 percent
  expect(bs(w).phase).toBe(2);
  run(w, 1); // the phase change pause
  return { w, id };
}

/** Fill every free add slot with a Grunt (add pressure); they are parked far from the ship. */
function pressure(w: World, id: number): void {
  for (let k = 0; k < MAX_ADDS; k++) {
    if (countAdds(w, bs(w)) >= MAX_ADDS) return;
    if (spawnAdd(w, bs(w), grunt, (w.x[id] ?? 0) - 150, (w.y[id] ?? 0) - 150 + k * 10) < 0) return;
  }
}

/** Shield start times (s after the entrance) over secs of a phase 1 fight, with or without add pressure. */
function shieldStarts(secs: number, adds: boolean): { starts: number[]; peakAdds: number; peakHornets: number } {
  const w = bossGame('warden', { par: 1000 });
  park(w, 600, 400);
  const id = enter(w);
  const starts: number[] = [];
  let was = bs(w).shielded;
  let peakAdds = 0;
  let peakHornets = 0;
  for (let i = 1; i <= secs * 120; i++) {
    if (adds) pressure(w, id);
    stepGame(w, DT, idle());
    const up = bs(w).shielded;
    if (up && !was) starts.push(i * DT);
    was = up;
    peakAdds = Math.max(peakAdds, countAdds(w, bs(w)));
    peakHornets = Math.max(peakHornets, countHornets(w, bs(w)));
    expect(bs(w).status).toBe('alive');
  }
  bus.clear();
  return { starts, peakAdds, peakHornets };
}

/** Step until the shield goes up (at most secs). Returns the seconds it took. */
function untilShield(w: World, secs = 20): number {
  for (let i = 0; i < secs * 120; i++) {
    if (bs(w).shielded) return i * DT;
    stepGame(w, DT, idle());
  }
  throw new Error('no shield');
}

function hornets(w: World): number[] {
  const out: number[] = [];
  for (let e = 1; e < w.cap; e++) if (w.alive[e] === 1 && w.kind[e] === Kind.BossPart && w.a[e] === PartType.Hornet) out.push(e);
  return out;
}

describe('warden shield timing', () => {
  it('pure rules: every phase, 10 Hornets per shield in two bursts of 5, first shield at 10 s', () => {
    expect(shieldActive(1)).toBe(true);
    expect(shieldActive(2)).toBe(true);
    for (let h = 0; h < 1; h += 0.01) {
      const n = hornetsFor(h);
      expect(n).toBe(10);
      expect(burstSize(n, 0)).toBe(5);
      expect(burstSize(n, 1)).toBe(5);
    }
    expect(MAX_HORNETS).toBe(10);
    expect(WARDEN_SHIELD.firstSec).toBe(10);
    expect(WARDEN_SHIELD.everySec).toBe(14);
    expect(WARDEN_SHIELD.openSec).toBe(2.0);
    expect(shieldClockStart()).toBe(4);
  });

  it('fires at 10 s and every 14 s in a 60 s fight, the same with every add slot full', () => {
    const calm = shieldStarts(60, false);
    const busy = shieldStarts(60, true);
    expect(busy.peakAdds).toBe(MAX_ADDS);
    for (const r of [calm, busy]) {
      expect(r.starts.length).toBe(4);
      [10, 24, 38, 52].forEach((t, k) => expect(Math.abs((r.starts[k] ?? 0) - t)).toBeLessThanOrEqual(DT * 1.5));
      expect(r.peakHornets).toBe(10);
    }
    expect(busy.starts).toEqual(calm.starts);
  });

  it('shields in phase 2 too, lasting 4 s, the next one 14 s after the last one started', () => {
    const { w } = phase2();
    const first = untilShield(w);
    expect(first).toBeLessThan(WARDEN_SHIELD.everySec + 0.1);
    expect(bs(w).phase).toBe(2);
    let up = 0;
    while (bs(w).shielded) {
      stepGame(w, DT, idle());
      up += DT;
    }
    expect(up).toBeCloseTo(WARDEN_SHIELD.shieldSec, 1);
    expect(untilShield(w)).toBeCloseTo(WARDEN_SHIELD.everySec - WARDEN_SHIELD.shieldSec, 1);
  });

  it('while shielded the core is closed, Warden stops, no ring is fired, and the view shows it', () => {
    const { w, id } = phase2();
    untilShield(w);
    const exposedLog: boolean[] = [];
    bus.on('sim:bossExposed', (e) => exposedLog.push(e.exposed));
    const x = w.x[id] ?? 0;
    const y = w.y[id] ?? 0;
    const view = createBossView();
    for (let i = 0; i < 120 * 3.5; i++) {
      stepGame(w, DT, idle());
      expect(bs(w).open).toBe(false);
      expect(bs(w).exposed).toBe(false);
      expect(w.x[id]).toBe(x);
      expect(w.y[id]).toBe(y);
      for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard) expect(w.t[h] ?? 0).toBeGreaterThan(DT * 2);
      readBoss(w, view);
      expect(view.shielded).toBe(true);
      expect(view.shieldLeft ?? 0).toBeGreaterThan(0);
      expect(view.shieldLeft ?? 0).toBeLessThanOrEqual(WARDEN_SHIELD.shieldSec);
    }
    // A hit on the closed core is blocked.
    const hp = w.hp[id] ?? 0;
    damageBoss(w, 10, 0, 0);
    expect(w.hp[id]).toBe(hp);
    expect(exposedLog).not.toContain(true);
  });

  it('when the shield drops the core is exposed for a guaranteed 2.0 s window', () => {
    const { w, id } = phase2();
    untilShield(w);
    const log: { exposed: boolean; t: number }[] = [];
    let t = 0;
    bus.on('sim:bossExposed', (e) => log.push({ exposed: e.exposed, t }));
    while (bs(w).shielded) {
      stepGame(w, DT, idle());
      t += DT;
    }
    run(w, 0.05);
    expect(bs(w).exposed).toBe(true);
    expect(bs(w).openLeft).toBeGreaterThan(WARDEN_SHIELD.openSec - 0.1);
    const hp = w.hp[id] ?? 0;
    damageBoss(w, 10, 0, 0);
    expect(w.hp[id]).toBe(hp - 10);
    for (let i = 0; i < 120 * 8; i++) {
      stepGame(w, DT, idle());
      t += DT;
    }
    const opened = log.find((e) => e.exposed);
    const closed = log.find((e) => !e.exposed && e.t > (opened?.t ?? 0));
    expect(opened).toBeDefined();
    expect(closed).toBeDefined();
    // Open for 2.0 s unless the next ring window extends it.
    expect((closed?.t ?? 0) - (opened?.t ?? 0)).toBeGreaterThanOrEqual(WARDEN_SHIELD.openSec - 0.05);
  });
});

describe('warden hornets', () => {
  it('two bursts of 5 during the shield: 1 HP, 10 u, 10 live after the second burst', () => {
    const { w, id } = phase2();
    untilShield(w);
    expect(bs(w).abl[3]).toBe(10);
    const seen: number[] = [];
    for (let i = 0; i < 120 * WARDEN_SHIELD.shieldSec; i++) {
      stepGame(w, DT, idle());
      seen.push(countHornets(w, bs(w)));
    }
    const first = seen.findIndex((n) => n > 0);
    expect(first * DT).toBeCloseTo(WARDEN_SHIELD.burstAt[0] ?? 0, 1);
    expect(seen[first]).toBe(5);
    const second = seen.findIndex((n) => n > 5);
    expect(second * DT).toBeCloseTo(WARDEN_SHIELD.burstAt[1] ?? 0, 1);
    expect(seen[second]).toBe(10);
    for (const h of hornets(w)) {
      expect(w.hp[h]).toBe(HORNET.hp);
      expect(w.radius[h]).toBe(HORNET.radius);
    }
    expect(count(w, Kind.Boss)).toBe(1);
    expect(w.alive[id]).toBe(1);
  });

  it('Hornets have their own cap of 10: full add slots never block them and they never take an add slot', () => {
    const { w, id } = phase2();
    const s = bs(w);
    pressure(w, id);
    const adds = countAdds(w, s);
    expect(adds).toBe(MAX_ADDS);
    untilShield(w);
    run(w, (WARDEN_SHIELD.burstAt[1] ?? 0) + 0.05);
    expect(countHornets(w, s)).toBe(10);
    expect(countAdds(w, s)).toBeLessThanOrEqual(adds);
    // The pool is full: an eleventh Hornet is refused.
    expect(spawnHornet(w, s, (w.x[id] ?? 0) + 200, w.y[id] ?? 0, 0)).toBe(-1);
  });

  it('fly out, chase the ship at no more than 300 u/s, and die on their own after 5 s of chase', () => {
    const { w } = phase2();
    untilShield(w);
    run(w, WARDEN_SHIELD.burstAt[0] ?? 0);
    run(w, 0.05);
    const hs = hornets(w);
    expect(hs.length).toBeGreaterThan(0);
    const h = hs[0] ?? -1;
    run(w, HORNET.leaveSec);
    let x = w.x[h] ?? 0;
    let y = w.y[h] ?? 0;
    const d0 = Math.hypot(x - (w.x[0] ?? 0), y - (w.y[0] ?? 0));
    for (let i = 0; i < 60; i++) {
      stepGame(w, DT, idle());
      if (w.alive[h] !== 1) break;
      const nx = w.x[h] ?? 0;
      const ny = w.y[h] ?? 0;
      expect(Math.hypot(nx - x, ny - y)).toBeLessThanOrEqual(HORNET.speed * DT * 1.001);
      x = nx;
      y = ny;
    }
    expect(Math.hypot(x - (w.x[0] ?? 0), y - (w.y[0] ?? 0))).toBeLessThan(d0);
    run(w, HORNET.lifeSec);
    expect(w.alive[h] === 1 && w.a[h] === PartType.Hornet && (w.t[h] ?? 0) > HORNET.lifeSec).toBe(false);
    const score = gs(w).score;
    run(w, 0.1);
    expect(gs(w).score).toBe(score);
  });

  it('a bomb clears every Hornet; a shot pops one for no score', () => {
    const { w } = phase2();
    untilShield(w);
    run(w, 2.2);
    expect(countHornets(w, bs(w))).toBeGreaterThan(0);
    const score = gs(w).score;
    const one = hornets(w)[0] ?? -1;
    w.hp[one] = HORNET.hp;
    damageBossPart(w, one, 10, w.x[one] ?? 0, w.y[one] ?? 0); // one spread hit pops it
    expect(w.alive[one] === 1 && w.a[one] === PartType.Hornet).toBe(false);
    expect(gs(w).score).toBe(score);
    bossOnBomb(w);
    expect(countHornets(w, bs(w))).toBe(0);
    expect(hornets(w).length).toBe(0);
  });

  it('contact kills once armed; a ship death clears the swarm and restarts the shield clock', () => {
    const { w } = phase2(false);
    gs(w).lives = 5;
    untilShield(w);
    run(w, (WARDEN_SHIELD.burstAt[0] ?? 0) + HORNET.armSec + 0.1);
    const h = hornets(w)[0] ?? -1;
    expect(h).toBeGreaterThan(0);
    const lives = gs(w).lives;
    w.x[h] = w.x[0] ?? 0;
    w.y[h] = w.y[0] ?? 0;
    stepGame(w, DT, idle());
    expect(gs(w).lives).toBe(lives - 1);
    expect(countHornets(w, bs(w))).toBe(0);
    expect(bs(w).shielded).toBe(false);
    expect(liveHornet(w, bs(w), 0)).toBe(-1);
    run(w, 3);
    expect(bs(w).status).toBe('alive');
  });
});


describe('warden shield determinism', () => {
  it('two identical 60 s phase 2 runs end in identical state, with no Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): string => {
      const { w, id } = phase2();
      let shields = 0;
      let was = false;
      let peak = 0;
      for (let i = 0; i < 120 * 60; i++) {
        stepGame(w, DT, idle());
        if (bs(w).shielded && !was) shields++;
        was = bs(w).shielded;
        peak = Math.max(peak, countHornets(w, bs(w)));
      }
      const hs = hornets(w).map((h) => `${w.x[h]},${w.y[h]},${w.rot[h]}`);
      const out = `${shields}|${peak}|${w.x[id]},${w.y[id]},${w.hp[id]}|${hs.join(';')}|${Array.from(bs(w).abl).join(',')}`;
      bus.clear();
      return out;
    };
    const a = once();
    expect(a).toBe(once());
    expect(a.startsWith('4|10|') || a.startsWith('5|10|')).toBe(true);
    spy.mockRestore();
  });
});
