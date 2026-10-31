// Boss abilities wave: Warden's shield and swarm (phase 2 on). Every 14 s of attack time it stops,
// closes its core for 4 s (BossState.shielded) and releases Hornets in two bursts, never past the add
// cap; when the shield drops the core is open for 2 s. Hornets chase at 260 u/s, die on their own
// after 5 s of chase, kill on contact once armed, and go with a bomb or a ship death.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { bossOnBomb, countAdds, countHornets, damageBoss, damageBossPart, liveHornet, spawnHornet } from '../../src/game/bosses/core';
import { HORNET, MAX_ADDS, WARDEN, WARDEN_SHIELD } from '../../src/game/bosses/table';
import { PartType } from '../../src/game/bosses/types';
import { createBossView, readBoss } from '../../src/game/bosses/view';
import { burstSize, hornetsFor, shieldActive } from '../../src/game/bosses/warden';
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
  damageBoss(w, 1801, 0, 0); // just past 50 percent
  expect(bs(w).phase).toBe(2);
  run(w, 1); // the phase change pause
  return { w, id };
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
  it('pure rules: phase 2 on, 8 to 12 Hornets per shield, two bursts that add up', () => {
    expect(shieldActive(1)).toBe(false);
    expect(shieldActive(2)).toBe(true);
    for (let h = 0; h < 1; h += 0.01) {
      const n = hornetsFor(h);
      expect(n).toBeGreaterThanOrEqual(8);
      expect(n).toBeLessThanOrEqual(12);
      expect(burstSize(n, 0) + burstSize(n, 1)).toBe(n);
      expect(burstSize(n, 0)).toBeGreaterThanOrEqual(burstSize(n, 1));
    }
    expect(hornetsFor(0)).toBe(8);
    expect(hornetsFor(0.999)).toBe(12);
  });

  it('never shields in phase 1', () => {
    const w = bossGame('warden');
    park(w, 600, 400);
    enter(w);
    for (let i = 0; i < 120 * 30; i++) {
      stepGame(w, DT, idle());
      expect(bs(w).shielded).toBe(false);
    }
    expect(count(w, Kind.BossPart)).toBe(0);
  });

  it('the first shield comes 14 s into phase 2, lasts 4 s, then the next 14 s after it drops', () => {
    const { w } = phase2();
    const first = untilShield(w);
    expect(first).toBeGreaterThan(WARDEN_SHIELD.everySec - 0.1);
    expect(first).toBeLessThan(WARDEN_SHIELD.everySec + 0.1);
    let up = 0;
    while (bs(w).shielded) {
      stepGame(w, DT, idle());
      up += DT;
    }
    expect(up).toBeCloseTo(WARDEN_SHIELD.shieldSec, 1);
    // The next shield counts a full interval from the drop.
    expect(untilShield(w)).toBeCloseTo(WARDEN_SHIELD.everySec, 1);
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

  it('when the shield drops the core is exposed for a guaranteed 2 s window', () => {
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
    expect(bs(w).openLeft).toBeGreaterThan(WARDEN.openSec - 0.1);
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
    // Open for 2 s unless the next ring window extends it.
    expect((closed?.t ?? 0) - (opened?.t ?? 0)).toBeGreaterThanOrEqual(WARDEN.openSec - 0.05);
  });
});

describe('warden hornets', () => {
  it('two bursts during the shield: 1 HP, 10 u, spread round the body, never past the add cap', () => {
    const { w, id } = phase2();
    untilShield(w);
    const want = bs(w).abl[3] ?? 0;
    expect(want).toBeGreaterThanOrEqual(WARDEN_SHIELD.hornetsMin);
    expect(want).toBeLessThanOrEqual(WARDEN_SHIELD.hornetsMax);
    const seen: number[] = [];
    for (let i = 0; i < 120 * WARDEN_SHIELD.shieldSec; i++) {
      stepGame(w, DT, idle());
      seen.push(countHornets(w, bs(w)));
      expect(countAdds(w, bs(w))).toBeLessThanOrEqual(MAX_ADDS);
    }
    // First burst, then a second one: the count steps up twice.
    const first = seen.findIndex((n) => n > 0);
    expect(first * DT).toBeCloseTo(WARDEN_SHIELD.burstAt[0] ?? 0, 1);
    expect(seen[first]).toBe(burstSize(want, 0));
    const second = seen.findIndex((n) => n > burstSize(want, 0));
    expect(second * DT).toBeCloseTo(WARDEN_SHIELD.burstAt[1] ?? 0, 1);
    expect(Math.max(...seen)).toBe(Math.min(want, MAX_ADDS));
    for (const h of hornets(w)) {
      expect(w.hp[h]).toBe(HORNET.hp);
      expect(w.radius[h]).toBe(HORNET.radius);
    }
    expect(count(w, Kind.Boss)).toBe(1);
    expect(w.alive[id]).toBe(1);
  });

  it('respects the add cap shared with other adds', () => {
    const { w, id } = phase2();
    const s = bs(w);
    for (let k = 0; k < 5; k++) expect(spawnHornet(w, s, (w.x[id] ?? 0) + 200, (w.y[id] ?? 0) + k * 30, 0)).toBeGreaterThan(0);
    // Keep those five alive through the shield by pausing their age.
    untilShield(w);
    for (let i = 0; i < 120 * WARDEN_SHIELD.shieldSec; i++) {
      for (const h of hornets(w)) w.t[h] = 0;
      stepGame(w, DT, idle());
      expect(countAdds(w, s)).toBeLessThanOrEqual(MAX_ADDS);
    }
    expect(countHornets(w, s)).toBe(MAX_ADDS);
  });

  it('fly out, chase the ship at no more than 260 u/s, and die on their own after 5 s of chase', () => {
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
    expect(a.startsWith('4|') || a.startsWith('3|')).toBe(true);
    spy.mockRestore();
  });
});
