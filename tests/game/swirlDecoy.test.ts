// R1 swirl: Swirls orbit and dive around the target (ship or detach decoy) the short way and do
// not collect in a corner, on the real seed 42 level 16 (cylinder with pillars) and a flat level.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import * as drones from '../../src/game/drones';
import * as swirl from '../../src/game/enemies/swirl';
import { setInvulnerable, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { targetOf } from '../../src/game/steer';
import { type World } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

const REAL = generateLevel(42, 16);
const FLAT: Partial<LevelDef> = {};
const N = 12;

function setup(level: Partial<LevelDef>, detach: boolean): { w: World; ids: number[] } {
  const { w } = makeGame({ ...level, waves: { ...(level.waves ?? REAL.waves), waves: [], loopFromIndex: -1, loopPeriodSec: 0 }, hazards: { wells: [], spawners: [] }, drone: 'collect' });
  setInvulnerable(w, true);
  w.ship.invuln = 1e9;
  if (detach) {
    stepGame(w, DT, idle());
    drones.armDrone(w, 'detach', 0, 0);
    for (let i = 0; i < 120; i++) drones.stepDrone(w, DT);
  }
  const a = w.level.arena;
  const ids: number[] = [];
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const x = Math.cos(ang) * (a.width / 2 - 60) * 0.9;
    const y = Math.sin(ang) * (a.height / 2 - 60) * 0.9;
    ids.push(put(w, swirl.def, x, y));
  }
  return { w, ids };
}

function corners(w: World): { x: number; y: number }[] {
  const a = w.level.arena;
  const out = [
    { x: -a.width / 2, y: -a.height / 2 },
    { x: a.width / 2, y: -a.height / 2 },
    { x: -a.width / 2, y: a.height / 2 },
    { x: a.width / 2, y: a.height / 2 },
  ];
  for (const o of a.obstacles) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push({ x: o.cx + (sx * o.w) / 2, y: o.cy + (sy * o.h) / 2 });
  }
  return out;
}

const sd = { x: 0, y: 0 };

/** Largest count of live Swirls within 120 u of any single corner. */
function worstBunch(w: World, ids: number[]): { count: number; live: number } {
  const cs = corners(w);
  let live = 0;
  const counts = new Array<number>(cs.length).fill(0);
  for (const id of ids) {
    if (w.alive[id] !== 1) continue;
    live++;
    cs.forEach((c, k) => {
      w.surface.delta(w.x[id] ?? 0, w.y[id] ?? 0, c.x, c.y, sd);
      if (Math.hypot(sd.x, sd.y) <= 120) counts[k] = (counts[k] ?? 0) + 1;
    });
  }
  return { count: Math.max(0, ...counts), live };
}

describe('swirls do not bunch in a corner', () => {
  const cases: [string, Partial<LevelDef>, boolean][] = [
    ['seed 42 level 16 cylinder, detach on', REAL, true],
    ['seed 42 level 16 cylinder, detach off', REAL, false],
    ['flat level, detach on', FLAT, true],
    ['flat level, detach off', FLAT, false],
  ];
  for (const [label, level, detach] of cases) {
    it(`${label}: at most a third near any one corner after 30 s`, () => {
      const { w, ids } = setup(level, detach);
      for (let i = 0; i < 120 * 30; i++) stepGame(w, DT, idle());
      const { count, live } = worstBunch(w, ids);
      if (!detach) expect(live).toBeGreaterThan(0); // a detached drone may legitimately clear them
      expect(count).toBeLessThanOrEqual(live / 3);
    });
  }
});

describe('swirl orbits the decoy, not the ship', () => {
  it('with a live decoy, a swirl in lure range closes on the decoy', () => {
    const { w, ids } = setup(FLAT, true);
    const decoy = gs(w).droneId;
    const id = ids[0] as number;
    w.x[id] = (w.x[decoy] ?? 0) + 400;
    w.y[id] = w.y[decoy] ?? 0;
    expect(targetOf(w, id)).toBe(decoy);
    const dist0 = Math.hypot((w.x[id] ?? 0) - (w.x[decoy] ?? 0), (w.y[id] ?? 0) - (w.y[decoy] ?? 0));
    for (let i = 0; i < 60; i++) swirl.step(w, id, DT * 2);
    const dist1 = Math.hypot((w.x[id] ?? 0) - (w.x[decoy] ?? 0), (w.y[id] ?? 0) - (w.y[decoy] ?? 0));
    expect(dist1).toBeLessThan(dist0);
    expect(dist1).toBeGreaterThan(dist0 - 200);
  });
});
