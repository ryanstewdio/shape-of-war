// V3 wave D: drone pickups (docs/13 SPEC 3.5 "Drone pickups"). A separate pickup, first at scoring
// kill 30 then every 40, arms the drone for 20 s in one of four hashed modes: homing, detach (a decoy
// that chasers in range follow through targetOf), rapid and double (a second body). A new pickup
// replaces the mode. 'fx:droneArm' on collection, 'fx:droneExpire' at expiry (not on death).
import { afterEach, describe, expect, it } from 'vitest';
import { bus, DRONE_MODES, type DroneMode } from '../../src/core/events';
import { hash01 } from '../../src/core/rng';
import { STYLE_RAPID } from '../../src/game/bullets';
import * as drones from '../../src/game/drones';
import * as grunt from '../../src/game/enemies/grunt';
import { setInvulnerable, stepGame } from '../../src/game/game';
import { onScoringKill } from '../../src/game/pickup';
import { killShip } from '../../src/game/player';
import { gs } from '../../src/game/state';
import { DECOY_LURE_RANGE, targetOf } from '../../src/game/steer';
import { setWeaponPickups } from '../../src/game/weapons';
import { Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { DT, dist, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

function armed(mode: DroneMode, drone: 'attack' | 'collect' | 'ram' = 'attack'): World {
  const { w } = makeGame({ drone });
  setInvulnerable(w, true);
  drones.stepDrone(w, DT);
  drones.armDrone(w, mode, 0, 0);
  return w;
}

function aimRight(): InputState {
  const i = idle();
  i.aim.active = true;
  i.aim.x = 1;
  i.aim.y = 0;
  return i;
}

/** Bullets spawned over secs of drone steps (no bullet movement, so they only accumulate). */
function shotsOver(w: World, secs: number): number {
  const start = w.bullets.liveCount;
  for (let i = 0; i < secs * 120; i++) drones.stepDrone(w, DT);
  return w.bullets.liveCount - start;
}

describe('drone pickup schedule and mode', () => {
  it('first at scoring kill 30, then every 40, one live at a time', () => {
    const { w } = makeGame();
    const at: number[] = [];
    for (let k = 1; k <= 115; k++) {
      const before = drones.droneArm(w).dropIndex;
      onScoringKill(w, 10, 20);
      if (drones.droneArm(w).dropIndex > before) {
        at.push(k);
        const id = drones.liveDronePickup(w);
        expect(w.kind[id]).toBe(Kind.DronePickup);
        expect(w.radius[id]).toBe(drones.DRONE_PICKUP_RADIUS);
        expect(w.t[id]).toBe(drones.DRONE_PICKUP_LIFE);
        w.t[id] = 1e-9; // let it lapse on the next pickup step
        drones.stepDrone(w, DT);
      }
    }
    expect(at).toEqual([30, 70, 110]);
  });

  it('the mode is DRONE_MODES[floor(hash01(seed ^ salt, n) x 4)], skipping a repeat, stored in w.a', () => {
    for (let seed = 1; seed < 40; seed++) {
      let prev: DroneMode | null = null;
      for (let n = 0; n < 12; n++) {
        let i = Math.min(3, Math.floor(hash01((seed ^ 0x44524f4e) >>> 0, n) * 4));
        if (DRONE_MODES[i] === prev) i = (i + 1) % 4;
        const m = drones.chooseDroneMode(seed, n, prev);
        expect(m).toBe(DRONE_MODES[i]);
        expect(m).not.toBe(prev);
        prev = m;
      }
    }
    const { w } = makeGame();
    const id = drones.spawnDronePickup(w, 0, 0);
    expect(w.a[id]).toBe(DRONE_MODES.indexOf(drones.chooseDroneMode(w.level.seed, 0, null)));
  });

  it('weapon pickups off: no drone pickup either', () => {
    const { w } = makeGame();
    setWeaponPickups(w, false);
    for (let k = 0; k < 100; k++) onScoringKill(w, 0, 0);
    expect(drones.liveDronePickup(w)).toBe(-1);
    expect(drones.droneArm(w).kills).toBe(0);
  });

  it('collecting within 28 u arms the drone for 20 s and emits fx:droneArm', () => {
    const { w } = makeGame({ drone: 'attack' });
    const arms: { mode: DroneMode; secondsLeft: number }[] = [];
    bus.on('fx:droneArm', (e) => arms.push({ mode: e.mode, secondsLeft: e.secondsLeft }));
    const id = drones.spawnDronePickup(w, 20, 0);
    const mode = DRONE_MODES[w.a[id] ?? 0];
    stepGame(w, DT, idle());
    expect(drones.liveDronePickup(w)).toBe(-1);
    expect(drones.droneArm(w).mode).toBe(mode);
    expect(drones.droneArm(w).timer).toBeLessThanOrEqual(drones.DRONE_ARM_SEC);
    expect(arms).toEqual([{ mode, secondsLeft: 20 }]);
  });
});

describe('drone modes', () => {
  it('armed, any drone type fires 4 volleys a second at the nearest enemy in 450 u (the attack drone does not fire twice)', () => {
    for (const type of ['attack', 'collect', 'ram'] as const) {
      const w = armed('double', type);
      drones.armDrone(w, 'homing', 0, 0);
      const g = put(w, grunt.def, 300, 0);
      w.hp[g] = 100; // survives a Ram charge, so the gun keeps a target
      const id = gs(w).droneId;
      expect(id).toBeGreaterThan(0);
      const n = shotsOver(w, 1);
      if (type === 'ram') expect(n).toBeGreaterThanOrEqual(3);
      else expect(n).toBe(4);
    }
  });

  it('homing marks its shots homing', () => {
    const w = armed('homing');
    put(w, grunt.def, 300, 0);
    shotsOver(w, 0.5);
    let homing = 0;
    for (let b = 0; b < w.bullets.cap; b++) if (w.bullets.alive[b] === 1 && w.bullets.homing[b] === 1) homing++;
    expect(homing).toBeGreaterThanOrEqual(2);
  });

  it('rapid fires 10 rapid style volleys a second', () => {
    const w = armed('rapid');
    put(w, grunt.def, 300, 0);
    expect(shotsOver(w, 1)).toBe(10);
    for (let b = 0; b < w.bullets.cap; b++) if (w.bullets.alive[b] === 1) expect(w.bullets.style[b]).toBe(STYLE_RAPID);
  });

  it('double adds a twin at the opposite phase that also fires; replacement removes it', () => {
    const w = armed('double');
    put(w, grunt.def, 300, 0);
    drones.stepDrone(w, DT);
    const twin = gs(w).droneTwinId;
    const id = gs(w).droneId;
    expect(w.kind[twin]).toBe(Kind.DroneTwin);
    expect(dist(w, 0, twin)).toBeCloseTo(drones.ORBIT_RADIUS, 3);
    // Opposite phase: ship, drone and twin are in a line with the ship in the middle.
    expect(dist(w, id, twin)).toBeCloseTo(2 * drones.ORBIT_RADIUS, 3);
    expect(shotsOver(w, 1)).toBe(8);
    drones.armDrone(w, 'rapid', 0, 0);
    expect(w.alive[twin] === 1 && w.kind[twin] === Kind.DroneTwin).toBe(false);
    expect(gs(w).droneTwinId).toBe(-1);
  });

  it('a new pickup replaces the mode and restarts the 20 s, even the same mode', () => {
    const w = armed('rapid');
    for (let i = 0; i < 120 * 5; i++) drones.stepDrone(w, DT);
    expect(drones.droneArm(w).timer).toBeCloseTo(15, 2);
    drones.armDrone(w, 'rapid', 0, 0);
    expect(drones.droneArm(w).timer).toBe(20);
    drones.armDrone(w, 'homing', 0, 0);
    expect(drones.droneArm(w).mode).toBe('homing');
  });

  it('expiry after 20 s emits fx:droneExpire; a ship death ends the mode with no expiry event', () => {
    const expired: DroneMode[] = [];
    bus.on('fx:droneExpire', (e) => expired.push(e.mode));
    const w = armed('double');
    for (let i = 0; i < 120 * 20 + 2; i++) drones.stepDrone(w, DT);
    expect(drones.droneArm(w).mode).toBeNull();
    expect(expired).toEqual(['double']);
    expect(gs(w).droneTwinId).toBe(-1);
    const { w: w2 } = makeGame({ drone: 'attack' });
    drones.stepDrone(w2, DT);
    drones.armDrone(w2, 'detach', 0, 0);
    killShip(w2);
    drones.stepDrone(w2, DT);
    expect(drones.droneArm(w2).mode).toBeNull();
    expect(expired).toEqual(['double']);
  });
});

describe('detach and the decoy', () => {
  it('leaves for a post 280 u along the aim, is a decoy there, and returns at expiry', () => {
    const { w } = makeGame({ drone: 'collect' });
    setInvulnerable(w, true);
    stepGame(w, DT, aimRight());
    drones.armDrone(w, 'detach', 0, 0);
    const s = drones.droneArm(w);
    expect(s.postX).toBeCloseTo((w.x[0] ?? 0) + drones.DETACH_POST, 3);
    for (let i = 0; i < 120; i++) drones.stepDrone(w, DT);
    const id = gs(w).droneId;
    expect(Math.hypot((w.x[id] ?? 0) - s.postX, (w.y[id] ?? 0) - s.postY)).toBeLessThan(1);
    // A chaser within 640 u of the decoy targets it; one beyond targets the ship.
    const near = put(w, grunt.def, s.postX, s.postY + 300);
    const far = put(w, grunt.def, s.postX - DECOY_LURE_RANGE - 200, s.postY);
    expect(targetOf(w, near)).toBe(id);
    expect(targetOf(w, far)).toBe(0);
    // The near Grunt heads straight for the decoy (straight up), not for the ship (up and left).
    stepGame(w, DT, idle());
    const toDecoy = Math.atan2((w.y[id] ?? 0) - (w.y[near] ?? 0), (w.x[id] ?? 0) - (w.x[near] ?? 0));
    const toShip = Math.atan2((w.y[0] ?? 0) - (w.y[near] ?? 0), (w.x[0] ?? 0) - (w.x[near] ?? 0));
    expect(Math.abs((w.rot[near] ?? 0) - toDecoy)).toBeLessThan(0.02);
    expect(Math.abs(toShip - toDecoy)).toBeGreaterThan(0.3);
    for (let i = 0; i < 120 * 20; i++) stepGame(w, DT, idle());
    expect(s.mode).toBeNull();
    expect(targetOf(w, near)).toBe(0);
    expect(dist(w, 0, id)).toBeCloseTo(drones.COLLECT_TRAIL, 0); // home again: a Collect drone trails the ship
  });

  it('replacing detach ends the decoy at once', () => {
    const w = armed('detach', 'attack');
    for (let i = 0; i < 60; i++) drones.stepDrone(w, DT);
    const g = put(w, grunt.def, 100, 100);
    expect(targetOf(w, g)).toBe(gs(w).droneId);
    drones.armDrone(w, 'homing', 0, 0);
    expect(targetOf(w, g)).toBe(0);
  });

  it('with no decoy live targetOf is the ship for every entity', () => {
    const { w } = makeGame({ drone: 'attack' });
    for (let i = 0; i < 20; i++) put(w, grunt.def, i * 40 - 400, 100);
    for (let i = 0; i < 60; i++) stepGame(w, DT, idle());
    for (let id = 1; id < w.cap; id++) expect(targetOf(w, id)).toBe(0);
    drones.stepDrone(w, DT);
    drones.armDrone(w, 'double', 0, 0);
    for (let id = 1; id < w.cap; id++) expect(targetOf(w, id)).toBe(0);
  });
});

describe('drone mode determinism', () => {
  it('two identical runs through every mode end in identical state', () => {
    const once = (): string => {
      const { w } = makeGame({ drone: 'attack' });
      setInvulnerable(w, true);
      for (let i = 0; i < 8; i++) put(w, grunt.def, -500 + i * 130, 250);
      for (let i = 0; i < 120 * 16; i++) {
        if (i % 480 === 0) drones.armDrone(w, DRONE_MODES[(i / 480) % 4] ?? 'homing', 0, 0);
        stepGame(w, DT, aimRight());
      }
      const id = gs(w).droneId;
      const s = drones.droneArm(w);
      const out = `${s.mode}|${s.timer}|${s.detach}|${w.x[id]},${w.y[id]}|${gs(w).droneTwinId}|${w.bullets.liveCount}`;
      bus.clear();
      return out;
    };
    expect(once()).toBe(once());
  });
});
