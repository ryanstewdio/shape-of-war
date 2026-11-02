// Release polish (docs/14 item 9): membrane gaps. A membrane obstacle blocks the ship and player
// bullets like a wall; enemies pass through at 35 percent of their speed while overlapping it.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { confineOn, createConfineResult, overlapsMembrane } from '../../src/game/arena';
import { spawnBullet, stepBulletPool } from '../../src/game/bullets';
import * as grunt from '../../src/game/enemies/grunt';
import { stepGame } from '../../src/game/game';
import { hasMembrane, MEMBRANE_SPEED, passesMembrane } from '../../src/game/membrane';
import { SHIP_RADIUS } from '../../src/game/ship';
import { enemySpeedScale, gs } from '../../src/game/state';
import { moveTo } from '../../src/game/steer';
import { inlineRectLevel, Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import type { LevelDef, Obstacle } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

const BAR_X = 200;
const BAR_W = 40;

function barPatch(membrane: boolean, surface: 'flat' | 'cylinder' = 'flat'): Partial<LevelDef> {
  const base = inlineRectLevel(7);
  const bar: Obstacle = membrane ? { cx: BAR_X, cy: 0, w: BAR_W, h: 900, membrane: true } : { cx: BAR_X, cy: 0, w: BAR_W, h: 900 };
  // Collect drone: an attack drone would shoot the test grunt.
  return { surface, drone: 'collect', arena: { ...base.arena, shape: 'rectObstacles', obstacles: [bar] } };
}

function game(membrane: boolean, surface: 'flat' | 'cylinder' = 'flat'): World {
  const { w } = makeGame(barPatch(membrane, surface));
  gs(w).invulnerable = true;
  w.drift.active = false;
  return w;
}

function moving(x: number): InputState {
  const i = idle();
  i.move = { active: x !== 0, x, y: 0 };
  return i;
}

describe('pure', () => {
  it('hasMembrane and passesMembrane', () => {
    expect(hasMembrane(inlineRectLevel(1).arena)).toBe(false);
    expect(hasMembrane({ ...inlineRectLevel(1).arena, obstacles: [{ cx: 0, cy: 0, w: 10, h: 10 }] })).toBe(false);
    expect(hasMembrane({ ...inlineRectLevel(1).arena, obstacles: [{ cx: 0, cy: 0, w: 10, h: 10, membrane: true }] })).toBe(true);
    for (const k of [Kind.Grunt, Kind.Wanderer, Kind.Weaver, Kind.Dart, Kind.SnakeHead, Kind.Charger, Kind.Splime]) expect(passesMembrane(k)).toBe(true);
    for (const k of [Kind.Ship, Kind.GravityWell, Kind.Geom, Kind.Drone, Kind.Boss, Kind.BossPart, Kind.BossHazard, Kind.WeaponPickup]) {
      expect(passesMembrane(k)).toBe(false);
    }
  });

  it('confineOn treats a membrane as a wall unless passMembrane', () => {
    const w = game(true);
    const out = createConfineResult();
    expect(confineOn(w.surface, w.level.arena, BAR_X, 0, 10, out).hit).toBe(true);
    expect(confineOn(w.surface, w.level.arena, BAR_X, 0, 10, out, true).hit).toBe(false);
    expect(overlapsMembrane(w.surface, w.level.arena, BAR_X - BAR_W / 2 - 9, 0, 10)).toBe(true);
    expect(overlapsMembrane(w.surface, w.level.arena, BAR_X - BAR_W / 2 - 11, 0, 10)).toBe(false);
  });
});

describe('membrane in the sim', () => {
  it('blocks the ship', () => {
    const w = game(true);
    for (let i = 0; i < 240; i++) stepGame(w, DT, moving(1));
    expect(w.x[0]).toBeCloseTo(BAR_X - BAR_W / 2 - SHIP_RADIUS, 3);
  });

  it('blocks player bullets', () => {
    const w = game(true);
    const p = w.bullets;
    const b = spawnBullet(p, 100, 0, 1200, 0, 2);
    let maxX = 0;
    for (let i = 0; i < 60 && p.alive[b] === 1; i++) {
      stepBulletPool(p, w.level.arena, DT, w.surface);
      if (p.alive[b] === 1) maxX = Math.max(maxX, p.x[b] ?? 0);
    }
    expect(p.alive[b]).toBe(0);
    expect(maxX).toBeLessThan(BAR_X);
  });

  it('a grunt crosses slowly (35 percent while overlapping)', () => {
    const w = game(true);
    w.x[0] = 500; // ship beyond the membrane; idle so it stays
    const id = put(w, grunt.def, -100, 0);
    const full = grunt.def.speed * enemySpeedScale(w) * DT;
    const r = grunt.def.radius;
    let slowSteps = 0;
    for (let i = 0; i < 600 && (w.x[id] ?? 0) < BAR_X + BAR_W / 2 + r + 5; i++) {
      expect(w.kind[id]).toBe(Kind.Grunt);
      const x0 = w.x[id] ?? 0;
      const overlapping = Math.abs(x0 - BAR_X) < BAR_W / 2 + r;
      stepGame(w, DT, idle());
      const dx = (w.x[id] ?? 0) - x0;
      if (overlapping) {
        expect(dx).toBeCloseTo(full * MEMBRANE_SPEED, 4);
        slowSteps++;
      } else expect(dx).toBeCloseTo(full, 4);
    }
    expect(w.x[id] ?? 0).toBeGreaterThan(BAR_X + BAR_W / 2 + r);
    expect(slowSteps).toBeGreaterThan(0);
  });

  it('a solid bar still stops the grunt', () => {
    const w = game(false);
    w.x[0] = 500;
    const id = put(w, grunt.def, -100, 0);
    for (let i = 0; i < 600; i++) stepGame(w, DT, idle());
    expect(w.x[id] ?? 0).toBeLessThanOrEqual(BAR_X - BAR_W / 2 - grunt.def.radius + 1e-3);
  });

  it('works on a drum ring level, crossing a membrane at the u seam', () => {
    const base = inlineRectLevel(7);
    const seamBar: Obstacle = { cx: 690, cy: 0, w: BAR_W, h: 896, membrane: true };
    const { w } = makeGame({
      surface: 'cylinder',
      drone: 'collect',
      arena: { ...base.arena, shape: 'rectObstacles', width: 1408, height: 896, obstacles: [seamBar] },
    });
    gs(w).invulnerable = true;
    expect(w.drift.active).toBe(false); // a ring level has obstacles: no drift
    w.x[0] = -500; // shortest way from the grunt runs right, through the bar and the seam
    const id = put(w, grunt.def, 560, 0);
    let wrapped = false;
    for (let i = 0; i < 900 && !wrapped; i++) {
      stepGame(w, DT, idle());
      expect(w.kind[id]).toBe(Kind.Grunt);
      if ((w.x[id] ?? 0) < 0) wrapped = true;
    }
    expect(wrapped).toBe(true);
  });

  it('levels without membranes are unchanged: moveTo is plain confineOn', () => {
    const { w } = makeGame(barPatch(false));
    expect(w.membranes).toBe(false);
    const id = put(w, grunt.def, BAR_X - 50, 0);
    const out = createConfineResult();
    const want = confineOn(w.surface, w.level.arena, BAR_X, 3, grunt.def.radius, out);
    moveTo(w, id, BAR_X, 3);
    expect(w.x[id]).toBe(Math.fround(want.x));
    expect(w.y[id]).toBe(Math.fround(want.y));
    expect(makeGame().w.membranes).toBe(false);
  });
});
