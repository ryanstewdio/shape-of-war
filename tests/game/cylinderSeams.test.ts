// Cylinder phase C1 (D13): enemies, drones and supers see across the u seam. Every scenario runs
// the real step loop on the cylinder arena of the generated seed 42 level 16 (1216 by 860, rect).
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { spawnBullet } from '../../src/game/bullets';
import { stepDrone } from '../../src/game/drones';
import * as blink from '../../src/game/enemies/blink';
import * as bulwark from '../../src/game/enemies/bulwark';
import * as charger from '../../src/game/enemies/charger';
import * as dart from '../../src/game/enemies/dart';
import * as grunt from '../../src/game/enemies/grunt';
import * as well from '../../src/game/enemies/gravitywell';
import * as pinwheel from '../../src/game/enemies/pinwheel';
import * as slime from '../../src/game/enemies/slime';
import * as snake from '../../src/game/enemies/snake';
import * as sower from '../../src/game/enemies/sower';
import * as splime from '../../src/game/enemies/splime';
import * as swirl from '../../src/game/enemies/swirl';
import * as weaver from '../../src/game/enemies/weaver';
import { setInvulnerable, stepGame } from '../../src/game/game';
import { SUPER_CHARGE_MAX } from '../../src/game/geoms';
import { gs, SNAKE_SEGMENTS } from '../../src/game/state';
import { stepSupers, triggerSuper } from '../../src/game/supers';
import { Kind, type World } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

const GEN = generateLevel(42, 16);
const W = GEN.arena.width;
const HALF = W / 2;

/** The generated cylinder level with no waves and no hazards, so only the scenario acts (a collect drone never attacks). */
function calm(patch: Partial<LevelDef> = {}): LevelDef {
  return { ...GEN, waves: { ...GEN.waves, waves: [], loopFromIndex: -1, loopPeriodSec: 0 }, hazards: { wells: [], spawners: [] }, drone: 'collect', ...patch };
}

function game(patch: Partial<LevelDef> = {}): World {
  const { w } = makeGame(calm(patch));
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

/** Shortest distance between entities a and b on the world surface. */
function wrapDist(w: World, a: number, b: number): number {
  w.surface.delta(w.x[a] ?? 0, w.y[a] ?? 0, w.x[b] ?? 0, w.y[b] ?? 0, sd);
  return Math.hypot(sd.x, sd.y);
}

describe('the generated level', () => {
  it('is a cylinder whose width is a whole number of hash cells', () => {
    expect(GEN.surface).toBe('cylinder');
    expect(W % 64).toBe(0);
  });
});

describe('enemies seek the short way across the seam', () => {
  const SEEKERS: [string, (w: World, x: number, y: number) => number][] = [
    ['grunt', (w, x, y) => put(w, grunt.def, x, y)],
    ['dart', (w, x, y) => put(w, dart.def, x, y)],
    ['weaver', (w, x, y) => put(w, weaver.def, x, y)],
    ['bulwark', (w, x, y) => put(w, bulwark.def, x, y)],
    ['blink', (w, x, y) => put(w, blink.def, x, y)],
    ['splime', (w, x, y) => put(w, splime.def, x, y)],
    ['snake head', (w, x, y) => snake.spawnSnake(w, x, y, 0)],
    ['swirl', (w, x, y) => put(w, swirl.def, x, y)],
  ];
  for (const [name, spawnAt] of SEEKERS) {
    it(`${name} closes the wrapped gap`, () => {
      const w = game();
      placeShip(w, HALF - 80, 0);
      const id = spawnAt(w, -HALF + 120, 0); // 200 u from the ship across the seam, 1016 u the long way
      if (name === 'bulwark') w.rot[id] = Math.PI; // it may turn only 70 deg/s, so face the short way
      const start = wrapDist(w, id, 0);
      expect(start).toBeCloseTo(200, 3);
      for (let s = 0; s < 30; s++) stepGame(w, DT, idle());
      expect(w.alive[id]).toBe(1);
      expect(wrapDist(w, id, 0)).toBeLessThan(start - 4);
    });
  }

  it('charger winds up, then dashes across the seam at the ship', () => {
    const w = game();
    placeShip(w, HALF - 80, 0);
    const id = put(w, charger.def, -HALF + 120, 0);
    w.rot[id] = Math.PI / 2; // the windup turn must go to pi (short way), not to 0
    let min = Infinity;
    for (let s = 0; s < 240; s++) {
      stepGame(w, DT, idle());
      min = Math.min(min, wrapDist(w, id, 0));
    }
    expect(min).toBeLessThan(60);
  });

  it('a slime puddle across the seam slows the ship', () => {
    const w = game();
    placeShip(w, HALF - 10, 0);
    const id = put(w, slime.def, -HALF + 10, 0);
    expect(slime.overlapsShip(w, id)).toBe(true);
  });

  it('a bulwark shield blocks a hit that arrives across the seam', () => {
    const w = game();
    const id = put(w, bulwark.def, -HALF + 10, 0);
    w.rot[id] = Math.PI; // facing -x, which is across the seam
    expect(bulwark.shieldBlocks(w, id, HALF - 10, 0)).toBe(true);
    w.rot[id] = 0;
    expect(bulwark.shieldBlocks(w, id, HALF - 10, 0)).toBe(false);
  });

  it('a blink chooses a destination near the ship on either side of the seam', () => {
    const w = game();
    placeShip(w, HALF - 20, 0);
    const id = put(w, blink.def, 0, 0);
    for (let c = 0; c < 8; c++) {
      blink.chooseDestination(w, id, c);
      w.surface.delta(w.x[0] ?? 0, w.y[0] ?? 0, w.vx[id] ?? 0, w.vy[id] ?? 0, sd);
      const d = Math.hypot(sd.x, sd.y);
      expect(d).toBeGreaterThan(blink.JUMP_MIN - 1);
      expect(d).toBeLessThan(blink.JUMP_MAX + 1);
    }
  });

  it('a snake body trails its head across the seam without a gap', () => {
    const w = game();
    placeShip(w, 0, 300);
    const head = snake.spawnSnake(w, HALF - 5, 0, 0);
    w.rot[head] = 0;
    for (let s = 0; s < 240; s++) stepGame(w, DT, idle());
    for (let i = 1; i < w.cap; i++) {
      if (w.alive[i] !== 1 || w.kind[i] !== Kind.SnakeBody) continue;
      expect(wrapDist(w, i, head)).toBeLessThan(snake.SPACING * SNAKE_SEGMENTS + 40);
    }
  });
});

describe('sower on the cylinder', () => {
  it('dives to the centre the short way and hugs the rims, not the seam', () => {
    const w = game();
    const out = { heading: 0, side: 0 };
    sower.inwardHeading(w, HALF + 100, 0, sower.def.radius, 0, out); // canonical x is -HALF + 100
    expect(Math.cos(out.heading)).toBeGreaterThan(0.99);
    const dir = { x: 0, y: 0 };
    sower.sowerDirection(w, HALF - 1, 0, sower.def.radius, dir);
    expect(Math.abs(dir.y)).toBeCloseTo(1, 6);
  });

  it('roams for ten seconds, stays inside the rims and keeps a canonical x', () => {
    const w = game();
    placeShip(w, 0, 0);
    const id = put(w, sower.def, HALF - 30, 200);
    for (let s = 0; s < 1200; s++) stepGame(w, DT, idle());
    expect(w.alive[id]).toBe(1);
    expect(Math.abs(w.y[id] ?? 0)).toBeLessThanOrEqual(GEN.arena.height / 2);
    expect(Math.abs(w.x[id] ?? 0)).toBeLessThanOrEqual(HALF + 1);
  });
});

describe('gravity well across the seam', () => {
  it('pulls the ship across the seam the short way', () => {
    const w = game();
    placeShip(w, HALF - 100, 0);
    const id = put(w, well.def, -HALF + 30, 0); // 130 u away across the seam
    gs(w).wellIds[gs(w).wellCount++] = id;
    const start = wrapDist(w, id, 0);
    expect(start).toBeCloseTo(130, 3);
    let crossed = false;
    for (let s = 0; s < 240; s++) {
      stepGame(w, DT, idle());
      if ((w.x[0] ?? 0) < 0) crossed = true;
    }
    expect(crossed).toBe(true);
    expect(wrapDist(w, id, 0)).toBeLessThan(start - 20);
  });

  it('pulls an enemy across the seam too', () => {
    const w = game();
    placeShip(w, 0, 300);
    const id = put(w, well.def, -HALF + 30, 0);
    gs(w).wellIds[gs(w).wellCount++] = id;
    const e = put(w, pinwheel.def, HALF - 100, 0); // drifts with zero velocity until the well pulls it
    const start = wrapDist(w, id, e);
    for (let s = 0; s < 60; s++) stepGame(w, DT, idle());
    expect(wrapDist(w, id, e)).toBeLessThan(start - 5);
  });
});

describe('drone across the seam', () => {
  it('orbits the ship with no jump while the ship sits on the seam', () => {
    const w = game({ drone: 'collect' });
    placeShip(w, HALF - 3, 0);
    stepGame(w, DT, idle());
    const drone = gs(w).droneId;
    expect(drone).toBeGreaterThan(0);
    w.surface.delta(w.x[0] ?? 0, w.y[0] ?? 0, w.x[drone] ?? 0, w.y[drone] ?? 0, sd);
    expect(Math.hypot(sd.x, sd.y)).toBeLessThan(120);
    let px = w.x[drone] ?? 0;
    let py = w.y[drone] ?? 0;
    for (let s = 0; s < 300; s++) {
      stepGame(w, DT, idle());
      w.surface.delta(px, py, w.x[drone] ?? 0, w.y[drone] ?? 0, sd);
      expect(Math.hypot(sd.x, sd.y)).toBeLessThan(30);
      px = w.x[drone] ?? 0;
      py = w.y[drone] ?? 0;
    }
  });

  it('an attack drone aims across the seam the short way', () => {
    const w = game({ drone: 'attack' });
    placeShip(w, HALF - 5, 0);
    put(w, grunt.def, -HALF + 100, 0);
    stepDrone(w, DT);
    let found = false;
    for (let b = 0; b < w.bullets.cap; b++) {
      if (w.bullets.alive[b] !== 1) continue;
      found = true;
      expect(w.bullets.vx[b] ?? 0).toBeGreaterThan(0);
    }
    expect(found).toBe(true);
  });

  it('a collect drone vacuums a geom lying across the seam', () => {
    const w = game({ drone: 'collect' });
    placeShip(w, HALF - 5, 0);
    stepGame(w, DT, idle());
    const geom = put(w, grunt.def, -HALF + 60, 0);
    w.kind[geom] = Kind.Geom;
    stepDrone(w, DT);
    expect(w.vx[geom] ?? 0).toBeLessThan(0); // the geom lies at u = -HALF + 60, so its short way home is toward smaller u
  });
});

describe('supers across the seam', () => {
  it('detonate catches an enemy on the far side of the seam', () => {
    const w = game({ superType: 'detonate', drone: 'attack' });
    placeShip(w, HALF - 20, 0);
    stepDrone(w, DT);
    const near = put(w, grunt.def, -HALF + 150, 0);
    const far = put(w, grunt.def, 0, 0);
    gs(w).superCharge = SUPER_CHARGE_MAX;
    expect(triggerSuper(w)).toBe(true);
    expect(w.alive[near] === 1 && w.kind[near] === Kind.Grunt).toBe(false);
    expect(w.kind[far]).toBe(Kind.Grunt);
  });

  it('a homing bullet turns toward a target across the seam', () => {
    const w = game({ superType: 'homing' });
    placeShip(w, 0, 300);
    put(w, grunt.def, -HALF + 80, 40);
    const b = spawnBullet(w.bullets, HALF - 40, 0, 0, 100, 1);
    w.bullets.homing[b] = 1;
    for (let s = 0; s < 3; s++) stepSupers(w, DT);
    expect(w.bullets.vx[b] ?? 0).toBeGreaterThan(0);
  });
});

describe('determinism on the generated cylinder level', () => {
  function run(): number[] {
    const { w } = makeGame(GEN);
    setInvulnerable(w, true);
    w.ship.invuln = 1e9;
    const trace: number[] = [];
    for (let s = 0; s < 1800; s++) {
      const a = s * 0.011;
      const i = idle();
      i.move = { active: true, x: Math.cos(a), y: Math.sin(a * 0.7) };
      i.aim = { active: true, x: Math.sin(a), y: Math.cos(a) };
      stepGame(w, DT, i);
      if (s % 60 === 0) {
        let h = 0x811c9dc5;
        for (let id = 0; id < w.cap; id++) {
          if (w.alive[id] !== 1) continue;
          h = Math.imul(h ^ Math.round((w.x[id] ?? 0) * 1000), 0x01000193) >>> 0;
          h = Math.imul(h ^ Math.round((w.y[id] ?? 0) * 1000), 0x01000193) >>> 0;
        }
        trace.push(h, w.bullets.liveCount);
      }
    }
    return trace;
  }

  it('two runs hash equal', () => {
    expect(run()).toEqual(run());
  });
});
