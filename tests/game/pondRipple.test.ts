// T4 pond ripples: a Gravity well in super nova that is destroyed starts a ring wave at its centre
// on that step ('sim:ripple'), pushing the ship and enemies radially outward. No LevelDef schedule,
// no warning. Hand built levels, plus the generated drum level for the seam.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { DEFAULT_FREE_PLAY } from '../../src/core/freeplayConfig';
import { POND_WAVE_LIFE, POND_WAVE_SPEED, POND_WAVE_WIDTH } from '../../src/core/pondRipple';
import { spawnBullet } from '../../src/game/bullets';
import { killEnemy } from '../../src/game/combat';
import * as well from '../../src/game/enemies/gravitywell';
import * as grunt from '../../src/game/enemies/grunt';
import { createGame, setInvulnerable, stepGame } from '../../src/game/game';
import { killShip, triggerBomb } from '../../src/game/player';
import {
  ageFade,
  bandWeight,
  ENEMY_PUSH,
  frontRadius,
  hasLiveWave,
  novaStrength,
  pondPush,
  pushSpeed,
  ripplePushes,
  SHIP_PUSH,
  startRipple,
  stepPond,
  STRENGTH_MAX,
  STRENGTH_MIN,
} from '../../src/game/pondRipple';
import { SHIP_SPEED } from '../../src/game/ship';
import { gs } from '../../src/game/state';
import { resetWellState } from '../../src/game/wellArrival';
import { Kind, spawn, type World } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put, quietLevel } from './helpers';

afterEach(() => bus.clear());

const BIG = { shape: 'rect' as const, width: 2400, height: 1400, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };
const WAVE_STEPS = Math.ceil(POND_WAVE_LIFE / DT) + 2;

interface Rip {
  x: number;
  y: number;
  strength: number;
  time: number;
}

function listen(w: World): Rip[] {
  const out: Rip[] = [];
  bus.on('sim:ripple', (e) => out.push({ x: e.x, y: e.y, strength: e.strength, time: w.time }));
  return out;
}

function placeShip(w: World, x: number, y: number): void {
  w.x[0] = x;
  w.y[0] = y;
  w.prevX[0] = x;
  w.prevY[0] = y;
}

/** Big empty arena, invulnerable ship at the origin, optional difficulty. */
function bigGame(difficulty: 'normal' | 'hard' = 'normal'): World {
  const { w } = makeGame({ arena: BIG }, { difficulty });
  setInvulnerable(w, true);
  w.ship.invuln = 1e9;
  return w;
}

/** bigGame plus one live well at (x, y), in nova when nova is true. Ship parked far away. */
function wellGame(x: number, y: number, nova: boolean): { w: World; id: number } {
  const w = bigGame();
  const id = well.addWell(w, x, y, 0, 0);
  if (nova) gs(w).wellNova[0] = 1;
  placeShip(w, 1100, 600);
  return { w, id };
}

/** Drive stepPond alone, advancing w.time by DT each step. */
function podStep(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    stepPond(w, DT);
    w.time += DT;
  }
}

describe('pure profile', () => {
  it('front radius grows at POND_WAVE_SPEED', () => {
    expect(frontRadius(0)).toBe(0);
    expect(frontRadius(1)).toBe(POND_WAVE_SPEED);
  });

  it('band weight is a smooth raised cosine: 1 on the front, 0 at the edge, flat at both ends', () => {
    expect(bandWeight(POND_WAVE_SPEED, 1)).toBe(1);
    expect(bandWeight(POND_WAVE_SPEED + POND_WAVE_WIDTH / 2, 1)).toBeCloseTo(0.5, 9);
    expect(bandWeight(POND_WAVE_SPEED - POND_WAVE_WIDTH / 2, 1)).toBeCloseTo(0.5, 9);
    expect(bandWeight(POND_WAVE_SPEED + POND_WAVE_WIDTH, 1)).toBe(0);
    // Smooth in and out: near the edge the weight is tiny, near the front it is close to 1.
    expect(bandWeight(POND_WAVE_SPEED + POND_WAVE_WIDTH * 0.9, 1)).toBeLessThan(0.03);
    expect(bandWeight(POND_WAVE_SPEED + POND_WAVE_WIDTH * 0.1, 1)).toBeGreaterThan(0.97);
    expect(bandWeight(0, POND_WAVE_LIFE)).toBe(0);
    expect(bandWeight(0, -0.1)).toBe(0);
  });

  it('fades linearly with age to 0 at POND_WAVE_LIFE', () => {
    expect(ageFade(0)).toBe(1);
    expect(ageFade(POND_WAVE_LIFE / 2)).toBeCloseTo(0.5, 9);
    expect(ageFade(POND_WAVE_LIFE)).toBe(0);
  });

  it('enemies push double the ship, scaled by strength and driftScale', () => {
    expect(SHIP_PUSH).toBeLessThan(SHIP_SPEED);
    expect(ENEMY_PUSH).toBeCloseTo(SHIP_PUSH * 2, 9);
    expect(pushSpeed(SHIP_PUSH, 1, 0, 0, 1)).toBeCloseTo(SHIP_PUSH, 9);
    expect(pushSpeed(SHIP_PUSH, 0.5, 0, 0, 1)).toBeCloseTo(SHIP_PUSH / 2, 9);
    expect(pushSpeed(SHIP_PUSH, 1, 0, 0, 1.3)).toBeCloseTo(SHIP_PUSH * 1.3, 9);
  });

  it('strength runs 0.6 for a base well to 1 for a full well, clamped', () => {
    const base = well.def.radius;
    const full = well.FULL_RADIUS;
    expect(novaStrength(base, base, full)).toBe(STRENGTH_MIN);
    expect(novaStrength(full, base, full)).toBe(STRENGTH_MAX);
    expect(novaStrength((base + full) / 2, base, full)).toBeCloseTo(0.8, 9);
    expect(novaStrength(base - 10, base, full)).toBe(STRENGTH_MIN);
    expect(novaStrength(full + 10, base, full)).toBe(STRENGTH_MAX);
    expect(STRENGTH_MIN).toBe(0.6);
    expect(STRENGTH_MAX).toBe(1);
  });

  it('pushes moving enemies only, never boss kinds, hazards, pickups or segments', () => {
    expect(ripplePushes(Kind.Grunt)).toBe(true);
    expect(ripplePushes(Kind.Leaver)).toBe(true);
    for (const k of [
      Kind.Boss,
      Kind.BossPart,
      Kind.BossHazard,
      Kind.GravityWell,
      Kind.Spawner,
      Kind.Geom,
      Kind.WeaponPickup,
      Kind.DronePickup,
      Kind.Drone,
      Kind.SnakeBody,
      Kind.Mine,
    ]) {
      expect(ripplePushes(k)).toBe(false);
    }
  });
});

describe('ripple on nova well death', () => {
  it('a nova well shot down by a bullet ripples at its centre on that same step', () => {
    const { w, id } = wellGame(-200, 100, true);
    const rips = listen(w);
    w.hp[id] = 1;
    spawnBullet(w.bullets, -200, 100, 0, 0, 1);
    let diedAt = -1;
    for (let i = 0; i < 4 && diedAt < 0; i++) {
      stepGame(w, DT, idle());
      if (gs(w).wellCount === 0) diedAt = w.time; // the id is reused by a dropped geom
    }
    expect(diedAt).toBeGreaterThan(0);
    expect(rips).toHaveLength(1);
    expect(rips[0]).toMatchObject({ x: -200, y: 100, strength: STRENGTH_MIN });
    expect(rips[0]?.time).toBe(diedAt);
    expect(hasLiveWave(w.pond)).toBe(true);
  });

  it('a scored kill of a nova well (orbit blades, drones) ripples with strength from its size', () => {
    const { w, id } = wellGame(0, 0, true);
    const rips = listen(w);
    w.radius[id] = (well.def.radius + well.FULL_RADIUS) / 2;
    killEnemy(w, id, true);
    expect(rips).toHaveLength(1);
    expect(rips[0]?.strength).toBeCloseTo(0.8, 9);
  });

  it('a nova well exploding at MASS_LIMIT ripples at full strength', () => {
    const { w, id } = wellGame(50, -50, true);
    const rips = listen(w);
    for (let m = 0; m < well.MASS_LIMIT; m++) well.feed(w, id, put(w, grunt.def, 600, 600));
    expect(gs(w).wellCount).toBe(0);
    expect(rips).toHaveLength(1);
    expect(rips[0]).toMatchObject({ x: 50, y: -50, strength: 1 });
  });

  it('a well destroyed before its nova makes no ripple', () => {
    const { w, id } = wellGame(0, 0, false);
    const rips = listen(w);
    w.hp[id] = 1;
    spawnBullet(w.bullets, 0, 0, 0, 0, 1);
    expect(w.kind[id]).toBe(Kind.GravityWell);
    for (let i = 0; i < 4; i++) stepGame(w, DT, idle());
    expect(gs(w).wellCount).toBe(0);
    expect(rips).toHaveLength(0);
    const b = wellGame(0, 0, false);
    const rips2 = listen(b.w);
    for (let m = 0; m < well.MASS_LIMIT; m++) well.feed(b.w, b.id, put(b.w, grunt.def, 600, 600));
    expect(gs(b.w).wellCount).toBe(0);
    expect(rips2).toHaveLength(0);
    expect(hasLiveWave(b.w.pond)).toBe(false);
  });

  it('level reset, unscored removal, ship death, bomb and level end make no ripple', () => {
    const { w, id } = wellGame(0, 0, true);
    const rips = listen(w);
    setInvulnerable(w, false);
    w.ship.invuln = 0;
    killShip(w); // wells survive a death
    expect(w.alive[id]).toBe(1);
    gs(w).bombs = 1;
    gs(w).bombCooldown = 0;
    w.ship.active = true;
    triggerBomb(w); // a bomb resets a well, it does not destroy it
    expect(w.alive[id]).toBe(1);
    resetWellState(w); // level start, Restart and Retry
    expect(gs(w).wellCount).toBe(0);
    const b = wellGame(0, 0, true);
    const rips2 = listen(b.w);
    killEnemy(b.w, b.id, false);
    const c = wellGame(0, 0, true);
    const rips3 = listen(c.w);
    gs(c.w).outcome = 'won';
    c.w.hp[c.id] = 1;
    spawnBullet(c.w.bullets, 0, 0, 0, 0, 1);
    for (let i = 0; i < 4; i++) stepGame(c.w, DT, idle());
    expect(rips).toHaveLength(0);
    expect(rips2).toHaveLength(0);
    expect(rips3).toHaveLength(0);
  });

  it('plays in Adventure and Free Play, never in Endless', () => {
    const lv = quietLevel();
    expect(createGame(lv).pond.active).toBe(true);
    expect(createGame(lv, { freePlay: DEFAULT_FREE_PLAY }).pond.active).toBe(true);
    const en = createGame(lv, { mode: 'endless' });
    expect(en.pond.active).toBe(false);
    let n = 0;
    bus.on('sim:ripple', () => n++);
    startRipple(en, 0, 0, 1);
    expect(n).toBe(0);
    expect(hasLiveWave(en.pond)).toBe(false);
  });

});

describe('push', () => {
  it('shoves an idle ship 300 u from the centre at least 150 u outward at strength 1', () => {
    const w = bigGame();
    startRipple(w, -300, 0, 1);
    for (let i = 0; i < WAVE_STEPS; i++) stepGame(w, DT, idle());
    expect(w.x[0] ?? 0).toBeGreaterThanOrEqual(150);
    expect(Math.abs(w.y[0] ?? 0)).toBeLessThan(1e-9);
    expect(hasLiveWave(w.pond)).toBe(false);
    const after = w.x[0];
    for (let i = 0; i < 60; i++) stepGame(w, DT, idle());
    expect(w.x[0]).toBe(after); // wave dead, no more push
  });

  it('ramps in and out smoothly: no jump between steps, never faster than SHIP_PUSH', () => {
    const w = bigGame();
    startRipple(w, -300, 0, 1);
    const v: number[] = [];
    for (let i = 0; i < WAVE_STEPS; i++) {
      const x = w.x[0] ?? 0;
      stepGame(w, DT, idle());
      v.push(((w.x[0] ?? 0) - x) / DT);
    }
    const peak = Math.max(...v);
    expect(peak).toBeLessThanOrEqual(SHIP_PUSH + 1e-6);
    expect(peak).toBeGreaterThan(SHIP_PUSH * 0.5);
    for (let i = 1; i < v.length; i++) expect(Math.abs((v[i] ?? 0) - (v[i - 1] ?? 0))).toBeLessThan(peak * 0.03);
    expect(v[0]).toBe(0); // the front starts 300 u away
  });

  it('scales with strength and difficulty driftScale', () => {
    const run = (strength: number, diff: 'normal' | 'hard'): number => {
      const w = bigGame(diff);
      startRipple(w, -300, 0, strength);
      podStep(w, WAVE_STEPS);
      return w.x[0] ?? 0;
    };
    const full = run(1, 'normal');
    expect(run(0.6, 'normal')).toBeLessThan(full);
    expect(run(0.6, 'normal')).toBeGreaterThan(0);
    expect(run(1, 'hard')).toBeGreaterThan(full);
  });

  it('pushes enemies about double the ship', () => {
    const w = bigGame();
    placeShip(w, 0, -300);
    const g = spawn(w, Kind.Grunt, -300, 0);
    startRipple(w, 0, 0, 1);
    podStep(w, WAVE_STEPS);
    const gruntMoved = -300 - (w.x[g] ?? 0);
    const shipMoved = -300 - (w.y[0] ?? 0);
    expect(shipMoved).toBeGreaterThanOrEqual(150);
    expect(gruntMoved).toBeGreaterThan(shipMoved * 1.5);
  });

  it('bosses, boss parts, wells, geoms, pickups, drones, snake bodies and mines stay put', () => {
    const w = bigGame();
    const kinds = [Kind.Boss, Kind.BossPart, Kind.GravityWell, Kind.Geom, Kind.WeaponPickup, Kind.DronePickup, Kind.Drone, Kind.SnakeBody, Kind.Mine];
    const ids = kinds.map((k, i) => spawn(w, k, -300 + 30 * i, 200));
    startRipple(w, -150, 0, 1);
    podStep(w, WAVE_STEPS);
    ids.forEach((id, i) => {
      expect(w.x[id]).toBe(-300 + 30 * i);
      expect(w.y[id]).toBe(200);
    });
  });

  it('walls block: a body by the wall stays inside the arena', () => {
    const w = bigGame();
    const half = BIG.width / 2;
    placeShip(w, half - 40, 0);
    const g = spawn(w, Kind.Grunt, half - 60, 100);
    for (let k = 0; k < 3; k++) {
      startRipple(w, half - 340, 0, 1);
      podStep(w, WAVE_STEPS);
    }
    expect(w.x[0] ?? 0).toBeLessThanOrEqual(half);
    expect(w.x[g] ?? 0).toBeLessThanOrEqual(half);
  });

  it('obstacles block', () => {
    const wall = { cx: 150, cy: 0, w: 40, h: 600 };
    const { w } = makeGame({ arena: { ...BIG, shape: 'rectObstacles', obstacles: [wall] } });
    setInvulnerable(w, true);
    startRipple(w, -300, 0, 1);
    podStep(w, WAVE_STEPS);
    expect(w.x[0] ?? 0).toBeGreaterThan(30);
    expect(w.x[0] ?? 0).toBeLessThan(130);
  });

  it('stacks live waves additively', () => {
    const one = bigGame();
    const two = bigGame();
    startRipple(one, -300, 0, 0.5);
    startRipple(two, -300, 0, 0.5);
    startRipple(two, -300, 0, 0.5);
    one.time = 0.8;
    two.time = 0.8;
    const a = pondPush(one, 0, 0, SHIP_PUSH, 1, { x: 0, y: 0 });
    const b = pondPush(two, 0, 0, SHIP_PUSH, 1, { x: 0, y: 0 });
    expect(a.x).toBeGreaterThan(0);
    expect(b.x).toBeCloseTo(2 * a.x, 9);
  });
});

describe('drum seam', () => {
  const GEN = generateLevel(42, 16);
  const HALF = GEN.arena.width / 2;

  it('measures distance across the seam with surface.delta', () => {
    expect(GEN.surface).toBe('cylinder');
    const level: LevelDef = {
      ...GEN,
      arena: { ...GEN.arena, obstacles: [] },
      waves: { ...GEN.waves, waves: [], loopFromIndex: -1, loopPeriodSec: 0 },
      hazards: { wells: [], spawners: [] },
      boss: undefined,
    };
    const { w } = makeGame(level);
    setInvulnerable(w, true);
    placeShip(w, -HALF + 250, 0);
    // The centre sits 50 u left of the seam, so the ship is 300 u to its right through the seam.
    startRipple(w, HALF - 50, 0, 1);
    podStep(w, WAVE_STEPS);
    const sd = { x: 0, y: 0 };
    w.surface.delta(HALF - 50, 0, w.x[0] ?? 0, w.y[0] ?? 0, sd);
    expect(sd.x).toBeGreaterThanOrEqual(300 + 150);
    expect(Math.abs(w.y[0] ?? 0)).toBeLessThan(1e-6);
  });
});

describe('determinism', () => {
  /** A run that shoots a nova well down mid fight, with two grunts about. */
  function run(nova: boolean, pondOn: boolean): number[] {
    const w = bigGame();
    w.pond.active = pondOn;
    const id = well.addWell(w, -250, 0, 0, 0);
    if (nova) gs(w).wellNova[0] = 1;
    placeShip(w, 100, 0);
    put(w, grunt.def, 300, 200);
    put(w, grunt.def, -400, -300);
    const out: number[] = [];
    for (let i = 0; i < 720; i++) {
      if (i === 60) {
        w.hp[id] = 1;
        spawnBullet(w.bullets, -250, 0, 0, 0, 1);
      }
      stepGame(w, DT, idle());
      for (let e = 0; e < 4; e++) out.push(w.x[e] ?? 0, w.y[e] ?? 0);
    }
    return out;
  }

  it('two runs with a nova kill are bit identical', () => {
    expect(run(true, true)).toEqual(run(true, true));
  });

  it('a nova kill moves bodies; a run with no nova kill matches a pond switched off', () => {
    expect(run(true, true)).not.toEqual(run(true, false));
    expect(run(false, true)).toEqual(run(false, false));
  });
});
