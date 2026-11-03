// Turbo, G3A then R3 ("needs to be longer and more valuable"): for its 10 s the ship fires 2.5x as
// fast, its speed cap is 35 percent higher, and each spread, rapid or drone bullet fired in the
// window passes through two enemies before it stops. Each scored kill adds 0.25 s, 15 s in all.
// 'fx:turbo' marks start and end.
import { afterEach, describe, expect, it } from 'vitest';
import { bus, type Events } from '../../src/core/events';
import { createBulletPool, passThrough, spawnBullet } from '../../src/game/bullets';
import { rebuild } from '../../src/game/collide';
import { bulletHits, killEnemy } from '../../src/game/combat';
import * as charger from '../../src/game/enemies/charger';
import * as grunt from '../../src/game/enemies/grunt';
import { stepGame } from '../../src/game/game';
import { SUPER_CHARGE_MAX } from '../../src/game/geoms';
import { SHIP_SPEED } from '../../src/game/ship';
import { gs } from '../../src/game/state';
import { stepSupers, SUPER_DURATION, superTimeLeft, triggerSuper } from '../../src/game/supers';
import {
  TURBO_DURATION,
  TURBO_KILL_BONUS,
  TURBO_MAX_TOTAL,
  TURBO_PIERCE,
  TURBO_SCALE,
  TURBO_SPEED_SCALE,
  turboKill,
} from '../../src/game/turbo';
import { Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

function turboOn(w: World): void {
  gs(w).superCharge = SUPER_CHARGE_MAX;
  expect(triggerSuper(w)).toBe(true);
}

function moveRight(): InputState {
  const i = idle();
  i.move = { active: true, x: 1, y: 0 };
  return i;
}

describe('passThrough (pure on the pool)', () => {
  it('v1 bullets never pass; a Turbo bullet (R3: pierce 2) passes two enemies, not a third', () => {
    const p = createBulletPool(4);
    const a = spawnBullet(p, 0, 0, 1, 0, 1);
    expect(passThrough(p, a, 7)).toBe(false);
    p.spawnExtra = TURBO_PIERCE;
    const b = spawnBullet(p, 0, 0, 1, 0, 1);
    expect(p.extra[b]).toBe(2);
    expect(passThrough(p, b, 7)).toBe(true);
    expect(passThrough(p, b, 7)).toBe(true); // still inside the same enemy: no charge spent
    expect(passThrough(p, b, 8)).toBe(true);
    expect(passThrough(p, b, 9)).toBe(false);
  });
});

describe('turbo', () => {
  it('emits fx:turbo on and off at the ship and keeps 10 s (R3)', () => {
    const log: Events['fx:turbo'][] = [];
    bus.on('fx:turbo', (e) => log.push({ ...e }));
    const { w } = makeGame({ superType: 'turbo' });
    w.x[0] = 40;
    turboOn(w);
    expect(log).toEqual([{ active: true, x: 40, y: 0 }]);
    for (let i = 0; i < Math.round(TURBO_DURATION * 120) - 1; i++) stepSupers(w, DT);
    expect(log).toHaveLength(1);
    stepSupers(w, DT);
    stepSupers(w, DT);
    expect(log.map((e) => e.active)).toEqual([true, false]);
    expect(w.ship.speedScale).toBe(1);
    expect(w.bullets.spawnExtra).toBe(0);
  });

  it('raises the speed cap 35 percent (space physics off), and only while it runs', () => {
    const { w } = makeGame({ superType: 'turbo' });
    w.ship.invuln = 1e9;
    stepGame(w, DT, moveRight());
    expect(w.vx[0]).toBeCloseTo(SHIP_SPEED, 5);
    turboOn(w);
    stepGame(w, DT, moveRight());
    expect(w.vx[0]).toBeCloseTo(SHIP_SPEED * TURBO_SPEED_SCALE, 5);
    for (let i = 0; i < TURBO_DURATION * 120 + 2; i++) {
      stepGame(w, DT, moveRight());
      w.x[0] = 0; // stay off the wall
    }
    expect(w.vx[0]).toBeCloseTo(SHIP_SPEED, 5);
  });

  it('raises the speed cap 35 percent under space physics', () => {
    const top = (turbo: boolean): number => {
      const { w } = makeGame({ superType: 'turbo' });
      w.ship.invuln = 1e9;
      w.ship.space = 'medium';
      if (turbo) turboOn(w);
      let v = 0;
      for (let i = 0; i < 120 * 4; i++) {
        stepGame(w, DT, moveRight());
        v = Math.max(v, Math.hypot(w.vx[0] ?? 0, w.vy[0] ?? 0));
        w.x[0] = 0; // stay off the wall
      }
      return v;
    };
    expect(top(true) / top(false)).toBeCloseTo(TURBO_SPEED_SCALE, 2);
  });

  it('R3: a Turbo bullet kills three lined up Grunts of four; a normal bullet kills one', () => {
    const shoot = (turbo: boolean): number => {
      const { w } = makeGame({ superType: 'turbo' });
      if (turbo) turboOn(w);
      const ids = [put(w, grunt.def, 300, 0), put(w, grunt.def, 300, 0), put(w, grunt.def, 300, 0), put(w, grunt.def, 300, 0)];
      spawnBullet(w.bullets, 300, 0, 0, 0, 1);
      rebuild(w.grid, w);
      bulletHits(w);
      return ids.filter((id) => !(w.kind[id] === Kind.Grunt && w.alive[id] === 1)).length;
    };
    expect(shoot(false)).toBe(1);
    expect(shoot(true)).toBe(3);
  });

  it('passes through a two hit enemy once, damaging it once, then stops on the next', () => {
    const { w } = makeGame({ superType: 'turbo' });
    turboOn(w);
    const c = put(w, charger.def, 300, 0);
    const bullet = spawnBullet(w.bullets, 300, 0, 0, 0, 1);
    rebuild(w.grid, w);
    bulletHits(w);
    expect(w.alive[c]).toBe(1);
    expect(w.hp[c]).toBe(charger.def.hp - 1);
    expect(w.bullets.alive[bullet]).toBe(1);
    bulletHits(w); // still overlapping the same Charger: no second hit
    expect(w.hp[c]).toBe(charger.def.hp - 1);
    // R3 pierce 2: the second pass goes through one Grunt and stops on the next. Both are placed
    // together so the second never reuses the first one's slot (which the bullet remembers).
    const g2 = put(w, grunt.def, 300, 0);
    const g3 = put(w, grunt.def, 300, 0);
    rebuild(w.grid, w);
    bulletHits(w);
    expect(w.kind[g2]).not.toBe(Kind.Grunt);
    expect(w.kind[g3]).not.toBe(Kind.Grunt);
    expect(w.bullets.alive[bullet]).toBe(0);
  });

  it('is deterministic: two identical Turbo runs give identical bullets and ship', () => {
    const runOnce = (): number[] => {
      const { w } = makeGame({ superType: 'turbo' });
      w.ship.invuln = 1e9;
      turboOn(w);
      const i = moveRight();
      i.aim = { active: true, x: 0, y: 1 };
      for (let k = 0; k < 600; k++) stepGame(w, DT, i);
      return [w.x[0] ?? 0, w.y[0] ?? 0, w.bullets.liveCount, gs(w).kills];
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe('R3: longer and more valuable Turbo', () => {
  it('pins the numbers: 10 s, fire rate 2.5x, speed 1.35x, pierce 2, +0.25 s per kill, 15 s cap', () => {
    expect(TURBO_DURATION).toBe(10);
    expect(TURBO_SCALE).toBe(2.5);
    expect(TURBO_SPEED_SCALE).toBe(1.35);
    expect(TURBO_PIERCE).toBe(2);
    expect(TURBO_KILL_BONUS).toBe(0.25);
    expect(TURBO_MAX_TOTAL).toBe(15);
    expect(SUPER_DURATION).toBe(5); // Homing keeps 5 s
  });

  it('sets fire rate, speed and pierce on start and clears them on the end', () => {
    const { w } = makeGame({ superType: 'turbo' });
    turboOn(w);
    expect(w.ship.fireRateScale).toBe(2.5);
    expect(w.ship.speedScale).toBe(1.35);
    expect(w.bullets.spawnExtra).toBe(2);
    expect(superTimeLeft(w)).toBe(10);
    for (let i = 0; i < 10 * 120 + 2; i++) stepSupers(w, DT);
    expect(w.ship.fireRateScale).toBe(1);
    expect(w.ship.speedScale).toBe(1);
    expect(w.bullets.spawnExtra).toBe(0);
  });

  it('each scored kill during Turbo adds 0.25 s', () => {
    const { w } = makeGame({ superType: 'turbo' });
    turboOn(w);
    for (let i = 0; i < 120; i++) stepSupers(w, DT);
    const before = superTimeLeft(w);
    for (let k = 0; k < 4; k++) killEnemy(w, put(w, grunt.def, 300, 0), true);
    expect(superTimeLeft(w)).toBeCloseTo(before + 4 * 0.25, 9);
    // An unscored removal adds nothing.
    killEnemy(w, put(w, grunt.def, 300, 0), false);
    expect(superTimeLeft(w)).toBeCloseTo(before + 1, 9);
  });

  it('kills outside Turbo add nothing and do not start it', () => {
    const { w } = makeGame({ superType: 'turbo' });
    killEnemy(w, put(w, grunt.def, 300, 0), true);
    expect(gs(w).superActive).toBeNull();
    expect(superTimeLeft(w)).toBe(0);
    const g = gs(w);
    expect(turboKill(g)).toBe(0);
  });

  it('caps the total at 15 s: 30 kills at once give only +5 s', () => {
    const { w } = makeGame({ superType: 'turbo' });
    turboOn(w);
    for (let k = 0; k < 30; k++) killEnemy(w, put(w, grunt.def, 300, 0), true);
    expect(superTimeLeft(w)).toBeCloseTo(15, 9);
    expect(gs(w).turboTotal).toBeCloseTo(15, 9);
  });

  it('the cap counts elapsed time: kills late in the run never push the total past 15 s', () => {
    const log: boolean[] = [];
    bus.on('fx:turbo', (e) => log.push(e.active));
    const { w } = makeGame({ superType: 'turbo' });
    turboOn(w);
    let steps = 0;
    // A kill every 0.1 s for the whole run: +2.5 s of bonus per second, so the cap binds.
    while (gs(w).superActive === 'turbo' && steps < 20 * 120) {
      if (steps % 12 === 0) killEnemy(w, put(w, grunt.def, 300, 0), true);
      stepSupers(w, DT);
      steps++;
    }
    expect(steps * DT).toBeGreaterThanOrEqual(15 - 2 * DT);
    expect(steps * DT).toBeLessThanOrEqual(15 + 2 * DT);
    expect(log).toEqual([true, false]); // fx:turbo still fires once on start and once on end
  });

  it('a second Turbo after the first ends starts fresh at 10 s with a new 15 s cap', () => {
    const { w } = makeGame({ superType: 'turbo' });
    turboOn(w);
    for (let k = 0; k < 30; k++) killEnemy(w, put(w, grunt.def, 300, 0), true);
    for (let i = 0; i < 16 * 120; i++) stepSupers(w, DT);
    expect(gs(w).superActive).toBeNull();
    expect(gs(w).turboTotal).toBe(0);
    turboOn(w);
    expect(superTimeLeft(w)).toBe(10);
    killEnemy(w, put(w, grunt.def, 300, 0), true);
    expect(superTimeLeft(w)).toBeCloseTo(10.25, 9);
  });
});
