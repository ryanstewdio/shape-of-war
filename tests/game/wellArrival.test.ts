// GW2 wells over time: on a level whose spec has a Gravity well more wells arrive during play, the
// first 20 to 30 s after level start, then every 25 to 35 s (hashed, no PRNG), at least 300 u from
// the ship and 250 u from other wells, inside the arena margin, capped at the spec count plus 2 and
// at most 4, within the hazard cap of 8. None while a boss is alive, during respawn, or in Endless.
// 'sim:wellArrive' { id, x, y, inSec: 1.5 } fires at the telegraph start; the well goes live 1.5 s
// later and the ship is never inside it then.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { isInside } from '../../src/game/arena';
import { bossAlive } from '../../src/game/bosses/core';
import { def as wellDef } from '../../src/game/enemies/gravitywell';
import { def as spawnerDef } from '../../src/game/enemies/spawner';
import { createGame, setInvulnerable, stepGame } from '../../src/game/game';
import { killShip } from '../../src/game/player';
import { SHIP_RADIUS } from '../../src/game/ship';
import { gs, MAX_WELLS } from '../../src/game/state';
import {
  ARRIVE_GAP_MAX,
  ARRIVE_GAP_MIN,
  ARRIVE_MARGIN,
  ARRIVE_SHIP_DIST,
  ARRIVE_TELE_SEC,
  ARRIVE_WELL_DIST,
  arrivalAtSec,
  arrivalCap,
  arrivalGapSec,
  firstArrivalSec,
  HAZARD_CAP,
} from '../../src/game/wellArrival';
import { Kind, type World } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, put, quietLevel } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

const BIG = { shape: 'rect' as const, width: 2400, height: 1600, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };

function wellLevel(seed: number, wells: { x: number; y: number }[]): LevelDef {
  return quietLevel({ seed, arena: BIG, drone: 'collect', hazards: { wells, spawners: [] } });
}

interface Arrival {
  t: number;
  clock: number;
  id: number;
  x: number;
  y: number;
  inSec: number;
  shipX: number;
  shipY: number;
  others: { x: number; y: number }[];
}

/** Game with an invulnerable idle ship; logs every arrival with the scene at emit time. */
function arrivalGame(def: LevelDef, invulnerable = true): { w: World; log: Arrival[]; clock: { t: number } } {
  // A vulnerable ship runs with the nova off, so no nova snake hunts it down mid test.
  const w = createGame(def, { vibrate: () => undefined, wellNova: invulnerable });
  if (invulnerable) setInvulnerable(w, true);
  const g = gs(w);
  const clock = { t: 0 };
  const log: Arrival[] = [];
  bus.on('sim:wellArrive', (e) => {
    const others: { x: number; y: number }[] = [];
    for (let i = 0; i < g.wellCount; i++) {
      const id = g.wellIds[i] ?? -1;
      if (id > 0 && id !== e.id) others.push({ x: w.x[id] ?? 0, y: w.y[id] ?? 0 });
    }
    log.push({ t: clock.t, clock: g.waveClock, id: e.id, x: e.x, y: e.y, inSec: e.inSec, shipX: w.x[0] ?? 0, shipY: w.y[0] ?? 0, others });
  });
  return { w, log, clock };
}

function run(w: World, clock: { t: number }, secs: number, each?: () => void): void {
  const n = Math.round(secs / DT);
  for (let i = 0; i < n; i++) {
    clock.t += DT;
    stepGame(w, DT, idle());
    each?.();
  }
}

describe('arrival schedule: pure', () => {
  it('first arrival in 20 to 30 s, gaps in 25 to 35 s, hashed per seed and index', () => {
    const firsts = new Set<number>();
    for (let seed = 1; seed < 200; seed++) {
      const f = firstArrivalSec(seed);
      expect(f).toBeGreaterThanOrEqual(20);
      expect(f).toBeLessThan(30);
      expect(firstArrivalSec(seed)).toBe(f);
      firsts.add(Math.round(f * 10));
      for (let k = 1; k < 6; k++) {
        const gap = arrivalGapSec(seed, k);
        expect(gap).toBeGreaterThanOrEqual(ARRIVE_GAP_MIN);
        expect(gap).toBeLessThan(ARRIVE_GAP_MAX);
      }
      expect(arrivalAtSec(seed, 2)).toBeCloseTo(f + arrivalGapSec(seed, 1) + arrivalGapSec(seed, 2), 9);
    }
    expect(firsts.size).toBeGreaterThan(50);
  });

  it('cap is the spec count plus 2, at most 4, and 0 without a spec well', () => {
    expect(arrivalCap(0)).toBe(0);
    expect(arrivalCap(1)).toBe(3);
    expect(arrivalCap(2)).toBe(4);
    expect(arrivalCap(3)).toBe(4);
    expect(MAX_WELLS).toBe(4);
  });
});

describe('arrivals in the sim', () => {
  it('arrive on the hashed schedule with a 1.5 s telegraph, then go live', () => {
    const def = wellLevel(0x1234, [{ x: -900, y: -500 }]);
    const { w, log, clock } = arrivalGame(def);
    const g = gs(w);
    let liveAt = -1;
    run(w, clock, firstArrivalSec(def.seed) + 0.5);
    expect(log.length).toBe(1);
    const a = log[0]!;
    expect(a.clock).toBeCloseTo(firstArrivalSec(def.seed), 1);
    expect(a.inSec).toBe(ARRIVE_TELE_SEC);
    expect(w.kind[a.id]).toBe(Kind.GravityWell);
    expect(g.tele[a.id]).toBeGreaterThan(0);
    run(w, clock, 2, () => {
      if (liveAt < 0 && (g.tele[a.id] ?? 0) <= 0) liveAt = clock.t;
    });
    expect(liveAt - a.t).toBeCloseTo(ARRIVE_TELE_SEC, 1);
    expect(w.x[a.id]).toBe(a.x);
    expect(w.y[a.id]).toBe(a.y);
    run(w, clock, arrivalAtSec(def.seed, 1) - g.waveClock + 0.5);
    expect(log.length).toBe(2);
    expect(log[1]!.clock).toBeCloseTo(arrivalAtSec(def.seed, 1), 1);
    expect(log[1]!.clock - log[0]!.clock).toBeGreaterThanOrEqual(ARRIVE_GAP_MIN - 0.01);
    expect(log[1]!.clock - log[0]!.clock).toBeLessThan(ARRIVE_GAP_MAX + 0.01);
  });

  it('a level without a spec well never gets one', () => {
    const { w, log, clock } = arrivalGame(wellLevel(5, []));
    run(w, clock, 120);
    expect(log.length).toBe(0);
    expect(gs(w).wellCount).toBe(0);
  });

  it('spacing: 300 u from the ship, 250 u from other wells, inside the arena margin', () => {
    let n = 0;
    for (const seed of [3, 77, 901, 4242]) {
      const def = wellLevel(seed, [{ x: 600, y: 300 }, { x: -600, y: -300 }]);
      const { w, log, clock } = arrivalGame(def);
      run(w, clock, 90);
      for (const a of log) {
        n++;
        expect(Math.hypot(a.x - a.shipX, a.y - a.shipY)).toBeGreaterThanOrEqual(ARRIVE_SHIP_DIST);
        for (const o of a.others) expect(Math.hypot(a.x - o.x, a.y - o.y)).toBeGreaterThanOrEqual(ARRIVE_WELL_DIST);
        expect(isInside(def.arena, a.x, a.y, ARRIVE_MARGIN)).toBe(true);
      }
      bus.clear();
    }
    expect(n).toBeGreaterThanOrEqual(4);
  });

  it('caps: spec 1 holds at most 3 live wells, spec 3 at most 4', () => {
    for (const [wells, cap] of [[[{ x: -900, y: -600 }], 3], [[{ x: -900, y: -600 }, { x: 900, y: 600 }, { x: 900, y: -600 }], 4]] as const) {
      const def = wellLevel(99, wells.map((p) => ({ ...p })));
      const { w, log, clock } = arrivalGame(def);
      let most = 0;
      run(w, clock, 200, () => {
        most = Math.max(most, gs(w).wellCount);
      });
      expect(most).toBe(cap);
      expect(log.length).toBe(cap - wells.length);
      bus.clear();
    }
  });

  it('the hazard cap of 8 holds: no arrival with wells plus hazard spawners at 8', () => {
    const def = wellLevel(7, [{ x: -1000, y: -650 }]);
    const { w, log, clock } = arrivalGame(def);
    // 1 well + 7 hazard spawners = 8, the docs/13 cap; the well cap (3) alone would allow one.
    for (let i = 0; i < HAZARD_CAP - 1; i++) expect(put(w, spawnerDef, 1000 - i * 60, 650)).toBeGreaterThan(0);
    run(w, clock, firstArrivalSec(def.seed) + 3);
    expect(log.length).toBe(0);
    expect(gs(w).wellCount).toBe(1);
  });

  it('none while a boss is alive (real boss level)', () => {
    let def: LevelDef | null = null;
    for (let seed = 1; seed < 60 && def === null; seed++) {
      for (let level = 5; level <= 30; level++) {
        const d = generateLevel(seed, level);
        if (d.boss !== undefined && d.hazards.wells.length > 0) {
          def = d;
          break;
        }
      }
    }
    expect(def).not.toBeNull();
    const { w, log, clock } = arrivalGame(def!);
    let aliveAtDue = 0;
    const at0 = arrivalAtSec(def!.seed, 0);
    let duringBoss = 0;
    bus.on('sim:wellArrive', () => {
      if (bossAlive(w)) duringBoss++;
    });
    run(w, clock, 70, () => {
      const c = gs(w).waveClock;
      if (Math.abs(c - at0) < DT / 2 && bossAlive(w)) aliveAtDue++;
    });
    expect(aliveAtDue + (bossAlive(w) ? 1 : 0)).toBeGreaterThan(0);
    expect(duringBoss).toBe(0);
    if (bossAlive(w)) expect(log.length).toBe(0);
  });

  it('none during the respawn delay: a due arrival waits for the ship', () => {
    const def = wellLevel(21, [{ x: -900, y: -600 }]);
    const { w, log, clock } = arrivalGame(def, false);
    const g = gs(w);
    w.ship.invuln = 0;
    run(w, clock, firstArrivalSec(def.seed) - 0.2);
    expect(log.length).toBe(0);
    killShip(w);
    expect(g.deathTimer).toBeGreaterThan(0);
    let duringDeath = 0;
    bus.on('sim:wellArrive', () => {
      if (g.deathTimer > 0 || !w.ship.active) duringDeath++;
    });
    run(w, clock, 3);
    expect(duringDeath).toBe(0);
    expect(w.ship.active).toBe(true);
    expect(log.length).toBe(1);
  });

  it('none in Endless', () => {
    const def = wellLevel(8, [{ x: -900, y: -600 }]);
    const w = createGame(def, { mode: 'endless', vibrate: () => undefined });
    setInvulnerable(w, true);
    let n = 0;
    bus.on('sim:wellArrive', () => n++);
    for (let i = 0; i < 120 * 90; i++) stepGame(w, DT, idle());
    expect(n).toBe(0);
  });

  it('a ship standing on the telegraph is never inside the well when it goes live', () => {
    const def = wellLevel(0xbeef, [{ x: -1000, y: -650 }]);
    const { w, log, clock } = arrivalGame(def, false);
    w.ship.invuln = 0;
    const g = gs(w);
    let deaths = 0;
    bus.on('fx:death', () => deaths++);
    run(w, clock, firstArrivalSec(def.seed) + DT * 2);
    expect(log.length).toBe(1);
    const a = log[0]!;
    // Park the ship on the arriving well for the whole telegraph.
    run(w, clock, ARRIVE_TELE_SEC + 0.2, () => {
      if ((g.tele[a.id] ?? 0) > 0) {
        w.x[0] = a.x;
        w.y[0] = a.y;
        w.prevX[0] = a.x;
        w.prevY[0] = a.y;
      }
    });
    expect(deaths).toBe(0);
    expect(w.alive[a.id] === 1 && w.kind[a.id] === Kind.GravityWell).toBe(true); // re-hashed, not cancelled
    {
      const d = Math.hypot((w.x[a.id] ?? 0) - (w.x[0] ?? 0), (w.y[a.id] ?? 0) - (w.y[0] ?? 0));
      expect(d).toBeGreaterThan(wellDef.radius + SHIP_RADIUS);
      expect(w.x[a.id] === a.x && w.y[a.id] === a.y).toBe(false); // it moved
    }
  });

  it('two identical runs give identical arrivals and wells, with no Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in sim code');
    });
    const once = (): string => {
      const def = wellLevel(0x5eed, [{ x: 700, y: 400 }]);
      const { w, log, clock } = arrivalGame(def);
      run(w, clock, 100);
      const g = gs(w);
      const wells: string[] = [];
      for (let i = 0; i < g.wellCount; i++) {
        const id = g.wellIds[i] ?? -1;
        wells.push(`${id}:${w.x[id]},${w.y[id]}:${g.wellNova[i]}:${g.wellOrd[i]}`);
      }
      bus.clear();
      return `${log.map((a) => `${a.clock.toFixed(4)}@${a.x},${a.y}#${a.id}`).join(';')}|${wells.join(';')}`;
    };
    const a = once();
    expect(a).toBe(once());
    expect(a.split('|')[0]!.split(';').length).toBeGreaterThanOrEqual(2);
    spy.mockRestore();
  });
});
