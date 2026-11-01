// GW4 (Ryan: "wells do not clear with level resets"): level start, Restart and Retry each build a
// fresh world through createGame, which calls resetWellState before spawnWells. These tests run a
// real generated level (V2 config, spec with a well) until arrived wells and a nova exist, then
// restart it the way main.ts does and check that only the spec wells remain, nothing is pending
// and the arrival clock starts again from 0. They also pin resetWellState on a running world and
// that a new game silences a saw the previous game left sounding.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { createGame, setInvulnerable, stepGame } from '../../src/game/game';
import { gs, SNAKE_SLOTS } from '../../src/game/state';
import { equipWeapon, weaponState } from '../../src/game/weapons';
import { firstArrivalSec, resetWellState } from '../../src/game/wellArrival';
import { Kind, type World } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import { V2_GEN_CONFIG, type LevelDef } from '../../src/levelgen/leveldef';
import type { InputState } from '../../src/input/types';
import { DT, idle } from './helpers';

afterEach(() => bus.clear());

/** The first generated level (V2 config) whose spec has a Gravity well. */
function wellLevel(): LevelDef {
  for (let seed = 11; seed < 400; seed += 37) {
    for (let level = 1; level <= 30; level++) {
      const def = generateLevel(seed, level, V2_GEN_CONFIG);
      if (def.hazards.wells.length > 0) return def;
    }
  }
  throw new Error('no generated level with a well');
}

function liveWells(w: World): number {
  let n = 0;
  for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === Kind.GravityWell) n++;
  return n;
}

function novaSnakes(w: World): number {
  const g = gs(w);
  let n = 0;
  for (let s = 0; s < SNAKE_SLOTS; s++) if (g.snakeWell[s] !== -1 && (g.snakeHead[s] ?? -1) > 0) n++;
  return n;
}

/** Run until an arrived well and a nova both exist (and the nova has had time to emit a snake). */
function runToMessy(def: LevelDef): World {
  const w = createGame(def, { vibrate: () => undefined });
  setInvulnerable(w, true);
  const g = gs(w);
  const input = idle();
  let novaAt = -1;
  for (let i = 0; i < 120 * 90; i++) {
    stepGame(w, DT, input);
    if (novaAt < 0 && g.wellNova.some((v) => v === 1)) novaAt = w.time;
    if (g.wellArrivals > 0 && g.wellArriving < 0 && novaAt >= 0 && w.time > novaAt + 5) break;
  }
  expect(g.wellArrivals).toBeGreaterThan(0);
  expect(g.wellNova.some((v) => v === 1)).toBe(true);
  return w;
}

/** Every well and arrival field is back to its level start value with only `wells` spec wells live. */
function expectClean(w: World, wells: number): void {
  const g = gs(w);
  expect(liveWells(w)).toBe(wells);
  expect(g.wellCount).toBe(wells);
  for (let i = wells; i < g.wellIds.length; i++) expect(g.wellIds[i]).toBe(-1);
  for (let i = 0; i < g.wellIds.length; i++) {
    expect(g.wellAge[i]).toBe(0);
    expect(g.wellNova[i]).toBe(0);
    expect(g.wellOrd[i]).toBe(i);
    if (i < wells) expect(g.tele[g.wellIds[i] ?? 0]).toBe(0); // no arrival telegraph
  }
  expect(g.wellSnakeT.every((v) => v === 0)).toBe(true);
  expect(g.snakeWell.every((v) => v === -1)).toBe(true);
  expect(novaSnakes(w)).toBe(0);
  expect(g.wellArrivals).toBe(0);
  expect(g.wellArriveAt).toBe(-1);
  expect(g.wellArriving).toBe(-1);
}

describe('wells reset on level start, Restart and Retry (GW4)', () => {
  const def = wellLevel();

  it('a restart after arrivals and a nova starts with only the spec wells and the arrival clock at 0', () => {
    const old = runToMessy(def);
    expect(liveWells(old)).toBeGreaterThan(def.hazards.wells.length - 1);
    // Restart and Retry in main.ts: createGame(level) for the same level.
    const arrives: number[] = [];
    bus.on('sim:wellArrive', () => arrives.push(1));
    const w = createGame(def, { vibrate: () => undefined });
    setInvulnerable(w, true);
    const g = gs(w);
    expect(g.waveClock).toBe(0);
    expectClean(w, def.hazards.wells.length);
    for (let i = 0; i < def.hazards.wells.length; i++) {
      const id = g.wellIds[i] ?? -1;
      expect(w.x[id]).toBeCloseTo(def.hazards.wells[i]?.x ?? Number.NaN, 3); // positions are Float32
      expect(w.y[id]).toBeCloseTo(def.hazards.wells[i]?.y ?? Number.NaN, 3);
    }
    // The first arrival is scheduled from 0 again and comes at the same wave time as on the first run.
    stepGame(w, DT, idle());
    expect(g.wellArriveAt).toBeCloseTo(firstArrivalSec(def.seed), 9);
    expect(g.waveClock).toBeCloseTo(DT, 9);
    const first = firstArrivalSec(def.seed);
    while (g.waveClock < first - 2 * DT) stepGame(w, DT, idle());
    expect(arrives.length).toBe(0);
    expect(g.wellArrivals).toBe(0);
    for (let i = 0; i < 4; i++) stepGame(w, DT, idle());
    expect(g.wellArrivals).toBe(1);
  });

  it('resetWellState clears every well, telegraph, nova and nova snake of a running world', () => {
    const w = runToMessy(def);
    resetWellState(w);
    expectClean(w, 0); // the schedule is unset too: the next step plans the first arrival again
  });

  it('resetWellState also drops an arrival still telegraphing', () => {
    const w = createGame(def, { vibrate: () => undefined });
    setInvulnerable(w, true);
    const g = gs(w);
    for (let i = 0; i < 120 * 60 && g.wellArriving < 0; i++) stepGame(w, DT, idle());
    expect(g.wellArriving).toBeGreaterThan(0);
    resetWellState(w);
    expectClean(w, 0);
  });

  it('a new game silences a saw the previous game left sounding (Retry from the results screen)', () => {
    const aim: InputState = idle();
    aim.aim.active = true;
    aim.aim.x = 1;
    const old = createGame(def, { vibrate: () => undefined });
    setInvulnerable(old, true);
    equipWeapon(old, 'orbit');
    const log: boolean[] = [];
    bus.on('sim:saw', (e) => log.push(e.on));
    for (let i = 0; i < 60; i++) stepGame(old, DT, aim);
    expect(log).toEqual([true]);
    createGame(def, { vibrate: () => undefined });
    expect(log).toEqual([true, false]);
    expect(weaponState(old).sawOn).toBe(false);
  });
});
