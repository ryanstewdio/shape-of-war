// Forge charger-drum: charger dash, blink teleport and swirl dive and orbit near the u seam of
// the generated cylinder level (seed 42 level 16), through the real step loop.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import * as blink from '../../src/game/enemies/blink';
import * as charger from '../../src/game/enemies/charger';
import * as swirl from '../../src/game/enemies/swirl';
import { setInvulnerable, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

const GEN = generateLevel(42, 16);
const W = GEN.arena.width;
const HALF = W / 2;
const RIM = GEN.arena.height / 2;

function game(): World {
  // Obstacles cleared: drum maps (foundry-drum-maps) put barriers on this level; the test is about the seam.
  const level: LevelDef = { ...GEN, arena: { ...GEN.arena, obstacles: [] }, waves: { ...GEN.waves, waves: [], loopFromIndex: -1, loopPeriodSec: 0 }, hazards: { wells: [], spawners: [] }, drone: 'collect' };
  const { w } = makeGame(level);
  setInvulnerable(w, true);
  w.ship.invuln = 1e9;
  return w;
}

function placeShip(w: World, x: number, y: number): void {
  w.x[0] = x;
  w.y[0] = y;
  w.prevX[0] = x;
  w.prevY[0] = y;
}

const sd = { x: 0, y: 0 };

function wrapped(w: World, ax: number, ay: number, bx: number, by: number): { x: number; y: number } {
  w.surface.delta(ax, ay, bx, by, sd);
  return { x: sd.x, y: sd.y };
}

/** Run until the charger enters its dash, then return the start position. */
function runToDash(w: World, id: number): void {
  for (let s = 0; s < 400 && !charger.isDashing(w, id); s++) stepGame(w, DT, idle());
  expect(charger.isDashing(w, id)).toBe(true);
}

describe('charger dash on the cylinder', () => {
  it('has a cylinder level with chargers available', () => {
    expect(GEN.surface).toBe('cylinder');
  });

  for (const [label, sx, sy, shipX, shipY, moveTo] of [
    ['across the seam, ship then jumps away', -HALF + 120, 0, HALF - 80, 0, [0, 300] as const],
    ['across the seam, ship runs the other way', HALF - 120, 0, -HALF + 80, 0, [0, -300] as const],
  ] as const) {
    it(`locks the short way and finishes the full dash: ${label}`, () => {
      const w = game();
      placeShip(w, shipX, shipY);
      const id = put(w, charger.def, sx, sy);
      w.rot[id] = Math.PI / 2; // 90 deg off: the windup turn (120 deg max) must pick the short way
      runToDash(w, id);
      const h = w.rot[id] ?? 0;
      const dirX = Math.cos(h);
      const dirY = Math.sin(h);
      // The lock points the short way (toward the seam), not the long way.
      expect(dirX * (sx < 0 ? -1 : 1)).toBeGreaterThan(0.9);
      const x0 = w.x[id] ?? 0;
      const y0 = w.y[id] ?? 0;
      placeShip(w, shipX, moveTo[1]); // the ship moves during the dash
      let prevX = x0;
      let prevY = y0;
      let crossed = false;
      let travelled = 0;
      let steps = 0;
      while (charger.isDashing(w, id) && steps < 200) {
        stepGame(w, DT, idle());
        steps++;
        const d = wrapped(w, prevX, prevY, w.x[id] ?? 0, w.y[id] ?? 0);
        expect(d.x * dirX + d.y * dirY).toBeGreaterThan(0); // never stops or reverses
        expect(w.rot[id]).toBe(h); // lock never recomputed
        travelled += Math.hypot(d.x, d.y);
        if (Math.abs((w.x[id] ?? 0) - prevX) > HALF) crossed = true;
        prevX = w.x[id] ?? 0;
        prevY = w.y[id] ?? 0;
      }
      expect(crossed).toBe(true);
      const total = wrapped(w, x0, y0, w.x[id] ?? 0, w.y[id] ?? 0);
      // Flat prediction: the full dash length along the locked unit vector (rim not reached).
      expect(travelled).toBeGreaterThan(charger.def.speed * charger.DASH_SEC - 2 * charger.def.speed * DT);
      expect(total.x).toBeCloseTo(dirX * travelled, 3);
      expect(total.y).toBeCloseTo(dirY * travelled, 3);
      expect(Math.abs(w.x[id] ?? 0)).toBeLessThanOrEqual(HALF);
    });
  }

  it('stops at the rim like a flat wall when the lane would cross it', () => {
    const w = game();
    placeShip(w, HALF - 80, RIM); // far above
    const id = put(w, charger.def, -HALF + 120, RIM - 60);
    w.rot[id] = Math.PI / 2;
    runToDash(w, id);
    w.rot[id] = Math.PI * 0.75; // locked toward +v and across the seam
    for (let s = 0; s < 80; s++) stepGame(w, DT, idle());
    expect(w.y[id] ?? 0).toBeLessThanOrEqual(RIM - (w.radius[id] ?? 0) + 1e-6);
    expect(Math.abs(w.x[id] ?? 0)).toBeLessThanOrEqual(HALF);
  });
});

describe('blink and swirl near the seam', () => {
  it('blink destination near the seam is wrapped and lands within jump range of the ship', () => {
    const w = game();
    placeShip(w, HALF - 20, 0);
    w.vx[0] = 200; // moving toward the seam, so the lead puts the target across it
    const id = put(w, blink.def, HALF - 60, 40);
    for (let s = 0; s < 400 && (w.t[id] ?? 0) < blink.DRIFT_SEC; s++) stepGame(w, DT, idle());
    const dx = wrapped(w, w.x[0] ?? 0, w.y[0] ?? 0, w.vx[id] ?? 0, w.vy[id] ?? 0);
    const dist = Math.hypot(dx.x, dx.y);
    expect(dist).toBeGreaterThan(blink.JUMP_MIN - 1);
    expect(dist).toBeLessThan(blink.JUMP_MAX + 1);
    expect(Math.abs(w.vy[id] ?? 0)).toBeLessThanOrEqual(RIM);
    for (let s = 0; s < 120 && w.alive[id] === 1 && (gsAux(w, id) === 0); s++) stepGame(w, DT, idle());
    expect(Math.abs(w.x[id] ?? 0)).toBeLessThanOrEqual(HALF);
  });

  it('swirl dive across the seam keeps its locked heading and wraps', () => {
    const w = game();
    placeShip(w, HALF - 20, 0);
    const id = put(w, swirl.def, -HALF + 40, 0);
    let dove = false;
    let crossed = false;
    let prevX = w.x[id] ?? 0;
    for (let s = 0; s < 120 && !crossed; s++) {
      stepGame(w, DT, idle());
      if (swirl.isDiving(w, id)) dove = true;
      if (Math.abs((w.x[id] ?? 0) - prevX) > HALF) crossed = true;
      prevX = w.x[id] ?? 0;
      expect(Math.abs(w.x[id] ?? 0)).toBeLessThanOrEqual(HALF);
    }
    expect(dove).toBe(true);
    expect(w.kind[id]).toBe(Kind.Swirl);
  });

  it('swirl orbit around a ship at the seam stays a constant distance', () => {
    const w = game();
    placeShip(w, HALF - 5, 0);
    const id = put(w, swirl.def, HALF - 5 - 230, 0);
    for (let s = 0; s < 240; s++) {
      stepGame(w, DT, idle());
      if (swirl.isDiving(w, id)) break;
      const d = wrapped(w, w.x[0] ?? 0, w.y[0] ?? 0, w.x[id] ?? 0, w.y[id] ?? 0);
      expect(Math.hypot(d.x, d.y)).toBeLessThan(260);
      expect(Math.abs(w.x[id] ?? 0)).toBeLessThanOrEqual(HALF);
    }
  });
});

function gsAux(w: World, id: number): number {
  return w.alive[id] === 1 ? (gs(w).aux[id] ?? 0) : 1;
}
