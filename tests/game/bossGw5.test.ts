// Device gate GW5 (build 5966c36): Tempest and Bastion both rated fairness 5, "a little too easy";
// target 4. Tempest: attack cadence 20 percent faster, hit points plus 10 percent; Tempestlings chase
// 165 to 185 u/s (faster as they lose hit points), dash every 2.6 s at 462 u/s after a 0.7 s wind up,
// then fire a 6 bullet fan back along the dash path. Bastion: turret turns 25 percent shorter, regen
// 12 s (half hit points, above 33 percent only), 8 Hornets per phase 3 shield, sweep 20 percent
// faster, core hit points plus 15 percent. Every number has a test; two runs of each fight hash equal.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { regenAllowed, regenHp } from '../../src/game/bosses/bastion';
import { bossHittable, damageBoss, livePart } from '../../src/game/bosses/core';
import { wrapPi } from '../../src/game/bosses/kit';
import { bossOf, type BossState } from '../../src/game/bosses/state';
import {
  BASTION,
  BASTION_SHIELD,
  BOSS_SHOTS,
  BOSS_TABLE,
  CRACK_AT,
  MAX_HORNETS,
  TEMPEST,
  TEMPESTLING,
} from '../../src/game/bosses/table';
import {
  dashEveryFor,
  fanCentre,
  fireDashFan,
  hpShareOf,
  SLOT,
  tempestlingDashEvery,
  tempestlingSpeed,
  TempestMove,
} from '../../src/game/bosses/tempest';
import { HazardType } from '../../src/game/bosses/types';
import { burstSize } from '../../src/game/bosses/warden';
import { ENEMY_BULLET_CAP, enemyBulletsOf } from '../../src/game/enemyBullets';
import { createGame, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { generateLevel } from '../../src/levelgen/generator';
import { breakTurret, bs, bossGame, enter, park, run, LEGACY_BOSS_HP, earlyBoss } from './bossHelpers';
import { stateHash } from './bossGw2Helpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

const DEG = Math.PI / 180;

function bossState(w: World): BossState {
  const s = bossOf(w);
  if (s === null) throw new Error('no boss state');
  return s;
}

/** The real level 40 game, played past the Tempest entrance, then cracked to its split. */
function splitLevel40(seed: number): World {
  const def = earlyBoss(generateLevel(seed, 40));
  expect(def.boss?.id).toBe('tempest');
  const w = createGame({ ...def, drone: 'collect' });
  gs(w).invulnerable = true;
  bossState(w).rotOn = false; // the fan mechanic alone (release polish attack rotation off)
  const input = idle();
  let id = -1;
  for (let i = 0; i < 120 * 120 && id < 0; i++) {
    stepGame(w, DT, input);
    id = bossHittable(w);
  }
  expect(id).toBeGreaterThan(0);
  const s = bossState(w);
  // GW5 numbers as tuned: the release polish level 40 scale (1.1) is covered by bossScale tests.
  s.cadence = 1;
  s.levelScale = 1;
  w.hp[id] = Math.floor(s.maxHp * CRACK_AT[1]) + 5;
  damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
  expect(s.split).toBe(true);
  return w;
}

/** The ship circles without aiming (no shots). */
function circle(step: number, out: InputState): InputState {
  const t = step * DT * 1.2;
  out.move.active = true;
  out.move.x = Math.cos(t);
  out.move.y = Math.sin(t);
  out.aim.active = false;
  return out;
}

describe('tempest gw5 numbers', () => {
  it('big Tempest: dash cadence 20 percent faster in every phase, hit points plus 10 percent', () => {
    expect(dashEveryFor(1)).toBeCloseTo(6 / 1.2, 9);
    expect(dashEveryFor(2)).toBeCloseTo(5 / 1.2, 9);
    expect(dashEveryFor(3)).toBeCloseTo(4 / 1.2, 9);
    expect(LEGACY_BOSS_HP.tempest).toBeCloseTo(1035 * 1.1, 9); // release polish raised the row (bossScale tests)
    expect(TEMPEST.firstDash).toBe(4);
  });

  it('Tempestlings: chase 165 to 185 u/s by hit points, dash every 2.6 s, dash 462 u/s, wind up 0.5 s (GW6, 0.7 before)', () => {
    expect(TEMPESTLING.chaseSpeed).toBe(165);
    expect(TEMPESTLING.chaseSpeedMax).toBe(185);
    expect(tempestlingSpeed()).toBe(165);
    expect(tempestlingSpeed(1)).toBe(165);
    expect(tempestlingSpeed(0.5)).toBeCloseTo(175, 9);
    expect(tempestlingSpeed(0)).toBe(185);
    expect(tempestlingSpeed(-1)).toBe(185);
    expect(tempestlingSpeed(2)).toBe(165);
    expect(hpShareOf(300, 600)).toBe(0.5);
    expect(hpShareOf(700, 600)).toBe(1);
    expect(hpShareOf(-5, 600)).toBe(0);
    expect(hpShareOf(5, 0)).toBe(1);
    expect(tempestlingDashEvery()).toBe(2.6);
    expect(TEMPESTLING.dashSpeed).toBeCloseTo(420 * 1.1, 9);
    expect(TEMPESTLING.windupSec).toBe(0.5);
  });

  it('the fan: 6 bullets, at least 12 deg apart, centred back along the dash heading', () => {
    expect(TEMPESTLING.fanCount).toBe(6);
    expect(TEMPESTLING.fanSpreadDeg).toBeGreaterThanOrEqual(12);
    expect(TEMPESTLING.fanSpeed).toBeLessThanOrEqual(240);
    expect(fanCentre(0)).toBeCloseTo(Math.PI, 9);
    expect(fanCentre(Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 9);
  });
});

describe('tempest gw5 in play', () => {
  it('the split records each part hit points, so the chase speeds up as they fall', () => {
    const w = splitLevel40(1);
    const s = bossState(w);
    for (let k = 0; k < TEMPESTLING.count; k++) {
      const p = livePart(w, s, k);
      expect(p).toBeGreaterThan(0);
      expect(s.abl[k * SLOT + 4]).toBe(w.hp[p]);
      expect(tempestlingSpeed(hpShareOf((w.hp[p] ?? 0) / 2, s.abl[k * SLOT + 4] ?? 0))).toBeCloseTo(175, 6);
    }
  });

  // Fans seen in the 30 s by seed. Release polish (docs/14 item 7): on seed 2 the long level's paced
  // waves change the fight so 12 of its 14 rests begin with the ship inside the 300 u rule, which
  // skips the fan by design (fireDashFan), and 2 fans land (one per part). Seeds 1 and 42 keep 3.
  const MIN_FANS: Readonly<Record<number, number>> = { 1: 3, 2: 2, 42: 3 };
  for (const seed of [1, 2, 42]) {
    it('seed ' + seed + ': each Tempestling dashes at 462 u/s and fires 6 bullet fans back along its path', () => {
      const w = splitLevel40(seed);
      const s = bossState(w);
      const parts = [livePart(w, s, 0), livePart(w, s, 1)];
      const was = new Uint8Array(ENEMY_BULLET_CAP);
      const prev = [TempestMove.Lap, TempestMove.Lap];
      const fans = [0, 0];
      let dashSteps = 0;
      const input = idle();
      // GW6: 30 s (20 before). The cut off part's dash ends near the ship's sidestep, so the ship is
      // more often inside the fan's minimum range in its rest and a fan is skipped.
      for (let i = 0; i < 120 * 30; i++) {
        const before = enemyBulletsOf(w); // the shared empty pool until the first bullet
        for (let e = 0; e < ENEMY_BULLET_CAP; e++) was[e] = before.alive[e] ?? 0;
        const px = parts.map((p) => w.x[p] ?? 0);
        const py = parts.map((p) => w.y[p] ?? 0);
        stepGame(w, DT, circle(i, input));
        for (let k = 0; k < 2; k++) {
          const p = parts[k] ?? -1;
          const st = (s.abl[k * SLOT] ?? 0) as TempestMove;
          if (st === TempestMove.Dash && prev[k] === TempestMove.Dash) {
            const d = Math.hypot((w.x[p] ?? 0) - (px[k] ?? 0), (w.y[p] ?? 0) - (py[k] ?? 0));
            if (d > 0.5 * TEMPESTLING.dashSpeed * DT) {
              expect(d).toBeCloseTo(TEMPESTLING.dashSpeed * DT, 3);
              dashSteps++;
            }
          }
          prev[k] = st;
        }
        const pool = enemyBulletsOf(w);
        // Bullets spawned this step, grouped by muzzle (they charge in place): one fan per part.
        for (let k = 0; k < 2; k++) {
          const p = parts[k] ?? -1;
          if ((s.abl[k * SLOT] ?? 0) !== TempestMove.Rest) continue; // fans fire in the rest only
          // The muzzle: the body edge back along the dash, or the centre when that edge is off the floor.
          const c = fanCentre(s.abl[k * SLOT + 6] ?? 0);
          const r = w.radius[p] ?? 0;
          const heads: number[] = [];
          for (let e = 0; e < pool.cap; e++) {
            if (pool.alive[e] !== 1 || was[e] === 1) continue;
            const bx = pool.x[e] ?? 0;
            const by = pool.y[e] ?? 0;
            const atEdge = Math.hypot(bx - (w.x[p] ?? 0) - Math.cos(c) * r, by - (w.y[p] ?? 0) - Math.sin(c) * r) < 0.01;
            const atCentre = Math.hypot(bx - (w.x[p] ?? 0), by - (w.y[p] ?? 0)) < 0.01;
            if (atEdge || atCentre) heads.push(Math.atan2(pool.vy[e] ?? 0, pool.vx[e] ?? 0));
          }
          if (heads.length === 0) continue;
          expect(heads.length).toBe(TEMPESTLING.fanCount);
          const offs = heads.map((a) => wrapPi(a - c)).sort((x, y) => x - y);
          for (let j = 0; j < offs.length; j++) {
            expect(offs[j]).toBeCloseTo((j - 2.5) * TEMPESTLING.fanSpreadDeg * DEG, 4);
          }
          fans[k] = (fans[k] ?? 0) + 1;
        }
      }
      expect(dashSteps).toBeGreaterThan(20);
      expect(fans[0]).toBeGreaterThanOrEqual(1);
      expect(fans[1]).toBeGreaterThanOrEqual(1);
      expect((fans[0] ?? 0) + (fans[1] ?? 0)).toBeGreaterThanOrEqual(MIN_FANS[seed] ?? 3);
    });
  }

  it('no fan while the ship is within 300 u of the muzzle', () => {
    const w = splitLevel40(1);
    const s = bossState(w);
    const p = livePart(w, s, 0);
    park(w, (w.x[p] ?? 0) + 60, w.y[p] ?? 0);
    const before = enemyBulletsOf(w).liveCount;
    expect(fireDashFan(w, s, p, Math.PI)).toBe(false);
    expect(enemyBulletsOf(w).liveCount).toBe(before);
  });
});

describe('bastion gw5 numbers', () => {
  it('turret turns 25 percent shorter, regen 12 s at half hit points above 33 percent, core plus 15 percent', () => {
    expect(BASTION.turnEvery).toBeCloseTo(1.5 * 0.75, 9);
    expect(BOSS_SHOTS.bastion?.every).toBeCloseTo(1.5 * 0.75, 9);
    expect(BOSS_SHOTS.bastion?.everyP2).toBeCloseTo(1.5 * 0.75, 9);
    expect(BASTION.regenSec).toBe(12);
    expect(regenHp()).toBe(BASTION.turretHp / 2);
    expect(BASTION.regenAboveShare).toBe(0.33);
    expect(regenAllowed(3400, 10000, 2)).toBe(true);
    expect(regenAllowed(3300, 10000, 2)).toBe(false);
    expect(LEGACY_BOSS_HP.bastion).toBeCloseTo(1080 * 1.15, 9); // release polish raised the row (bossScale tests)
  });

  it('phase 3: 8 Hornets in two bursts of 4 inside the pool cap, sweep 20 percent faster', () => {
    expect(BASTION_SHIELD.hornets).toBe(8);
    expect(burstSize(BASTION_SHIELD.hornets, 0)).toBe(4);
    expect(burstSize(BASTION_SHIELD.hornets, 1)).toBe(4);
    expect(BASTION_SHIELD.hornets).toBeLessThanOrEqual(MAX_HORNETS);
    expect(BASTION_SHIELD.burstAt.length).toBe(2);
    expect(BASTION.sweepRate).toBeCloseTo(0.9 * 1.2, 9);
  });
});

describe('bastion gw5 in play', () => {
  it('turrets take their turns every 1.125 s', () => {
    const w = bossGame('bastion', { lives: 9, par: 1000 });
    park(w, 600, 380);
    enter(w);
    const s = bs(w);
    let last = s.n0;
    let lastT = -1;
    const gaps: number[] = [];
    for (let i = 0; i < 120 * 12; i++) {
      s.t1 = 0; // no Bulwarks
      stepGame(w, DT, idle());
      if (s.n0 !== last) {
        const t = (i + 1) * DT;
        if (lastT >= 0 && s.retry <= 0 && s.shotWait <= 0) gaps.push(t - lastT);
        lastT = t;
        last = s.n0;
      }
    }
    expect(gaps.length).toBeGreaterThan(6);
    gaps.sort((a, b) => a - b);
    expect(gaps[0]).toBeGreaterThanOrEqual(BASTION.turnEvery - DT - 1e-9);
    expect(gaps[Math.floor(gaps.length / 2)]).toBeCloseTo(BASTION.turnEvery, 1);
  });

  it('a fallen turret rebuilds 12 s after it fell', () => {
    const w = bossGame('bastion', { lives: 9, par: 1000 });
    park(w, 600, 380);
    enter(w);
    const p = livePart(w, bs(w), 0);
    breakTurret(w, p, 9999);
    expect(livePart(w, bs(w), 0)).toBe(-1);
    run(w, 11.9);
    expect(livePart(w, bs(w), 0)).toBe(-1);
    run(w, 0.2);
    const q = livePart(w, bs(w), 0);
    expect(q).toBeGreaterThan(0);
    expect(w.hp[q]).toBe(regenHp());
  });

  it('the woken core sweep arm turns at 1.08 rad/s', () => {
    const w = bossGame('bastion', { lives: 9, par: 1000 });
    park(w, 600, 380);
    enter(w);
    for (let k = 0; k < BASTION.turrets; k++) {
      const p = livePart(w, bs(w), k);
      if (p > 0) breakTurret(w, p, BASTION.turretHp);
    }
    expect(bs(w).phase).toBe(3);
    run(w, 2);
    const h = bs(w).n2;
    expect(h).toBeGreaterThan(0);
    expect(w.kind[h]).toBe(Kind.BossHazard);
    expect(w.a[h]).toBe(HazardType.Sweep);
    const r0 = w.rot[h] ?? 0;
    run(w, 1);
    expect(w.alive[h]).toBe(1);
    expect(Math.abs(wrapPi((w.rot[h] ?? 0) - r0))).toBeCloseTo(BASTION.sweepRate, 1);
  });
});

describe('gw5 determinism', () => {
  function hashRun(make: () => World, secs: number): number[] {
    const w = make();
    const out: number[] = [];
    const input = idle();
    for (let i = 0; i < 120 * secs; i++) {
      stepGame(w, DT, circle(i, input));
      if (i % 60 === 0) out.push(stateHash(w));
    }
    return out;
  }

  it('Tempestling fight: two runs hash equal, no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random called');
    });
    const a = hashRun(() => splitLevel40(42), 15);
    const b = hashRun(() => splitLevel40(42), 15);
    expect(a).toEqual(b);
  });

  it('Bastion fight with a turret down: two runs hash equal, no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random called');
    });
    const make = (): World => {
      const w = bossGame('bastion', { lives: 9, par: 1000 });
      park(w, 600, 380);
      enter(w);
      const p = livePart(w, bs(w), 2);
      breakTurret(w, p, 9999);
      return w;
    };
    const a = hashRun(make, 30);
    const b = hashRun(make, 30);
    expect(a).toEqual(b);
  });
});
