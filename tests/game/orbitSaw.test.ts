// GW2 orbit feel (rated 2 of 5): 'sim:saw' { on } marks the saw level leaving 0 and returning to 0;
// while the level is above 0.5 the spikes deal 1.5x damage (1 and 2 alternately, HP is integer) and
// rest 30 percent less. At or below 0.5, and at rest, the spikes behave as before.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { killBullet } from '../../src/game/bullets';
import { orbitHits } from '../../src/game/combat';
import * as pinwheel from '../../src/game/enemies/pinwheel';
import { setInvulnerable, stepGame } from '../../src/game/game';
import { killShip } from '../../src/game/player';
import {
  equipWeapon,
  ORBIT_RADIUS,
  ORBIT_SHIELD,
  placeBlades,
  SAW_COOL_MULT,
  SAW_DAMAGE_MULT,
  SAW_POWER_AT,
  sawPowered,
  STRETCH_SEC,
  weaponState,
} from '../../src/game/weapons';
import type { World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

function aimHeld(): InputState {
  const i = idle();
  i.aim.active = true;
  i.aim.x = 1;
  i.aim.y = 0;
  return i;
}

function sawLog(): boolean[] {
  const log: boolean[] = [];
  bus.on('sim:saw', (e) => log.push(e.on));
  return log;
}

describe('sim:saw edges', () => {
  it('fires on once when the level leaves 0 and off once when it is back to 0', () => {
    const { w } = makeGame();
    setInvulnerable(w, true);
    equipWeapon(w, 'orbit');
    const log = sawLog();
    const s = weaponState(w);
    for (let i = 0; i < 60; i++) stepGame(w, DT, aimHeld());
    expect(s.saw).toBe(1);
    expect(log).toEqual([true]);
    // Release: falls back over STRETCH_SEC, one off at 0.
    let offAt = -1;
    for (let i = 0; i < 60; i++) {
      stepGame(w, DT, idle());
      if (offAt < 0 && log.length === 2) offAt = (i + 1) * DT;
    }
    expect(s.saw).toBe(0);
    expect(log).toEqual([true, false]);
    expect(offAt).toBeCloseTo(STRETCH_SEC, 1);
    // A short tap still pairs on and off.
    for (let i = 0; i < 5; i++) stepGame(w, DT, aimHeld());
    for (let i = 0; i < 60; i++) stepGame(w, DT, idle());
    expect(log).toEqual([true, false, true, false]);
  });

  it('losing the weapon mid saw (ship death) fires off', () => {
    const { w } = makeGame();
    equipWeapon(w, 'orbit');
    const log = sawLog();
    w.ship.invuln = 0;
    for (let i = 0; i < 20; i++) stepGame(w, DT, aimHeld());
    expect(log).toEqual([true]);
    killShip(w);
    expect(weaponState(w).saw).toBe(0);
    expect(log).toEqual([true, false]);
  });

  it('spread never fires it', () => {
    const { w } = makeGame();
    setInvulnerable(w, true);
    const log = sawLog();
    for (let i = 0; i < 120; i++) stepGame(w, DT, i < 60 ? aimHeld() : idle());
    expect(log).toEqual([]);
  });
});

describe('saw power', () => {
  it('powered above 0.5 only', () => {
    expect(SAW_POWER_AT).toBe(0.5);
    expect(sawPowered(0)).toBe(false);
    expect(sawPowered(0.5)).toBe(false);
    expect(sawPowered(0.51)).toBe(true);
    expect(sawPowered(1)).toBe(true);
    expect(SAW_DAMAGE_MULT).toBe(1.5);
    expect(SAW_COOL_MULT).toBeCloseTo(0.7, 9);
  });

  /** Orbit with only inner spike 0 at (80, 0), saw level as given, one pinwheel (hp 100) on it. */
  function oneSpike(level: number): { w: World; id: number } {
    const { w } = makeGame();
    equipWeapon(w, 'orbit');
    const s = weaponState(w);
    s.orbitPhase = 0;
    s.saw = level;
    w.ship.aimAngle = 0;
    placeBlades(w);
    for (let i = 1; i < s.hitters; i++) killBullet(w.bullets, s.blades[i] ?? -1);
    const id = put(w, pinwheel.def, ORBIT_RADIUS, 0);
    w.hp[id] = 100;
    return { w, id };
  }

  /** Strike n times, waiting out the cooldown between strikes; returns damage per strike and cooldowns. */
  function strikes(w: World, id: number, n: number): { dmg: number[]; cool: number[] } {
    const s = weaponState(w);
    const dmg: number[] = [];
    const cool: number[] = [];
    for (let k = 0; k < n; k++) {
      const before = w.hp[id] ?? 0;
      orbitHits(w, DT);
      dmg.push(before - (w.hp[id] ?? 0));
      cool.push(s.bladeCool[0] ?? 0);
      s.bladeCool[0] = 0;
    }
    return { dmg, cool };
  }

  it('above 0.5: 1.5x damage on average and a 30 percent shorter rest', () => {
    const { w, id } = oneSpike(1);
    const { dmg, cool } = strikes(w, id, 6);
    expect(dmg).toEqual([1, 2, 1, 2, 1, 2]);
    expect(dmg.reduce((a, b) => a + b, 0) / dmg.length).toBe(SAW_DAMAGE_MULT);
    for (const c of cool) expect(c).toBeCloseTo(ORBIT_SHIELD.cooldown * SAW_COOL_MULT, 6);
  });

  it('at 0.5 and at rest: 1 damage and the full shield cooldown, as before', () => {
    for (const level of [0, 0.5]) {
      const { w, id } = oneSpike(level);
      const { dmg, cool } = strikes(w, id, 4);
      expect(dmg).toEqual([1, 1, 1, 1]);
      for (const c of cool) expect(c).toBeCloseTo(ORBIT_SHIELD.cooldown, 6);
      bus.clear();
    }
  });
});
