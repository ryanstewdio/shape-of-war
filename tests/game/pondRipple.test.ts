// Tester 3 pond ripples: LevelDef.ripples ring waves that warn, start and push the ship and
// enemies radially outward. Hand built LevelDefs (Foundry's generator lands in parallel).
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { DEFAULT_FREE_PLAY } from '../../src/core/freeplayConfig';
import { POND_WAVE_LIFE, POND_WAVE_SPEED, POND_WAVE_WIDTH, RIPPLE_WARN_SEC } from '../../src/core/pondRipple';
import * as grunt from '../../src/game/enemies/grunt';
import { createGame, stepGame } from '../../src/game/game';
import {
  ageFade,
  bandWeight,
  createPond,
  ENEMY_PUSH,
  frontRadius,
  pushSpeed,
  ripplePushes,
  SHIP_PUSH,
  sortedRipples,
  stepPond,
} from '../../src/game/pondRipple';
import { SHIP_SPEED } from '../../src/game/ship';
import { gs } from '../../src/game/state';
import { Kind, spawn, type World } from '../../src/game/world';
import type { RippleEvent } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put, quietLevel } from './helpers';

afterEach(() => bus.clear());

function pondGame(ripples: RippleEvent[] | undefined, difficulty: 'normal' | 'hard' = 'normal'): World {
  const { w } = makeGame(ripples === undefined ? {} : { ripples }, { difficulty });
  gs(w).invulnerable = true;
  return w;
}

/** Step the game until the wave clock reaches t. */
function runClock(w: World, t: number): void {
  while (gs(w).waveClock < t - 1e-9) stepGame(w, DT, idle());
}

/** Drive stepPond alone: advance w.time and the wave clock by DT each step. */
function podStep(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    stepPond(w, DT);
    w.time += DT;
    gs(w).waveClock += DT;
  }
}

describe('pure profile', () => {
  it('front radius grows at POND_WAVE_SPEED', () => {
    expect(frontRadius(0)).toBe(0);
    expect(frontRadius(1)).toBe(POND_WAVE_SPEED);
  });

  it('band weight is 1 on the front, 0 at the band edge and outside life', () => {
    expect(bandWeight(POND_WAVE_SPEED, 1)).toBe(1);
    expect(bandWeight(POND_WAVE_SPEED + POND_WAVE_WIDTH / 2, 1)).toBeCloseTo(0.5, 9);
    expect(bandWeight(POND_WAVE_SPEED - POND_WAVE_WIDTH / 2, 1)).toBeCloseTo(0.5, 9);
    expect(bandWeight(POND_WAVE_SPEED + POND_WAVE_WIDTH, 1)).toBe(0);
    expect(bandWeight(0, POND_WAVE_LIFE)).toBe(0);
    expect(bandWeight(0, -0.1)).toBe(0);
  });

  it('fades linearly with age to 0 at POND_WAVE_LIFE', () => {
    expect(ageFade(0)).toBe(1);
    expect(ageFade(POND_WAVE_LIFE / 2)).toBeCloseTo(0.5, 9);
    expect(ageFade(POND_WAVE_LIFE)).toBe(0);
  });

  it('ship push is a quarter of top speed at strength 1, enemies double, both scaled', () => {
    expect(SHIP_PUSH).toBeCloseTo(SHIP_SPEED / 4, 9);
    expect(ENEMY_PUSH).toBeCloseTo(SHIP_PUSH * 2, 9);
    expect(pushSpeed(SHIP_PUSH, 1, 0, 0, 1)).toBeCloseTo(SHIP_PUSH, 9);
    expect(pushSpeed(SHIP_PUSH, 0.5, 0, 0, 1)).toBeCloseTo(SHIP_PUSH / 2, 9);
    expect(pushSpeed(SHIP_PUSH, 1, 0, 0, 1.3)).toBeCloseTo(SHIP_PUSH * 1.3, 9);
  });

  it('pushes moving enemies only, never boss kinds, hazards or pickups', () => {
    expect(ripplePushes(Kind.Grunt)).toBe(true);
    expect(ripplePushes(Kind.Leaver)).toBe(true);
    for (const k of [Kind.Boss, Kind.BossPart, Kind.BossHazard, Kind.GravityWell, Kind.Spawner, Kind.Geom, Kind.Drone, Kind.SnakeBody, Kind.Mine]) {
      expect(ripplePushes(k)).toBe(false);
    }
  });

  it('sorts out of order ripples by atSec and treats absent as none', () => {
    const lv = quietLevel({ ripples: [{ atSec: 9, x: 0, y: 0, strength: 1 }, { atSec: 3, x: 0, y: 0, strength: 1 }] });
    expect(sortedRipples(lv).map((r) => r.atSec)).toEqual([3, 9]);
    expect(createPond(quietLevel()).active).toBe(false);
    expect(createPond(quietLevel({ ripples: [] })).active).toBe(false);
  });
});

describe('warn and start timing', () => {
  it('emits rippleWarn RIPPLE_WARN_SEC before atSec and ripple at atSec', () => {
    const w = pondGame([{ atSec: 3, x: 100, y: -50, strength: 0.7 }]);
    const warns: { t: number; x: number; y: number; inSec: number; strength: number }[] = [];
    const starts: { t: number; x: number; y: number; strength: number }[] = [];
    bus.on('sim:rippleWarn', (e) => warns.push({ t: gs(w).waveClock, ...e }));
    bus.on('sim:ripple', (e) => starts.push({ t: gs(w).waveClock, ...e }));
    runClock(w, 3 - RIPPLE_WARN_SEC - 0.05);
    expect(warns).toHaveLength(0);
    runClock(w, 3 - 0.05);
    expect(warns).toHaveLength(1);
    expect(warns[0]?.t).toBeCloseTo(3 - RIPPLE_WARN_SEC, 1);
    expect(warns[0]).toMatchObject({ x: 100, y: -50, inSec: RIPPLE_WARN_SEC, strength: 0.7 });
    expect(starts).toHaveLength(0);
    runClock(w, 3.05);
    expect(starts).toHaveLength(1);
    expect(starts[0]?.t).toBeCloseTo(3, 1);
    expect(starts[0]).toMatchObject({ x: 100, y: -50, strength: 0.7 });
    runClock(w, 10);
    expect(warns).toHaveLength(1);
    expect(starts).toHaveLength(1);
  });
});

describe('push', () => {
  it('pushes the ship radially outward as the front passes, then stops', () => {
    const w = pondGame([{ atSec: 0, x: -300, y: -300, strength: 1 }]);
    podStep(w, 1);
    expect(w.pond.slotEvent[0]).toBe(0);
    const x0 = w.x[0] ?? 0;
    const y0 = w.y[0] ?? 0;
    podStep(w, Math.ceil(POND_WAVE_LIFE / DT) + 2);
    const dx = (w.x[0] ?? 0) - x0;
    const dy = (w.y[0] ?? 0) - y0;
    expect(dx).toBeGreaterThan(5);
    expect(dy).toBeCloseTo(dx, 3); // along the 45 degree ray from the centre
    const after = w.x[0] ?? 0;
    podStep(w, 60);
    expect(w.x[0]).toBe(after); // wave dead, no more push
  });

  it('does nothing outside the band and before the front arrives', () => {
    const w = pondGame([{ atSec: 0, x: -600, y: 0, strength: 1 }]);
    // the front reaches the band edge at (600 - WIDTH) / SPEED s
    const n = Math.floor((600 - POND_WAVE_WIDTH) / POND_WAVE_SPEED / DT) - 2;
    podStep(w, n);
    expect(w.x[0]).toBe(0);
    podStep(w, 30);
    expect(w.x[0] ?? 0).toBeGreaterThan(0);
  });

  it('falls off with age: a far body moves less than a near one', () => {
    const near = pondGame([{ atSec: 0, x: -200, y: 0, strength: 1 }]);
    const far = pondGame([{ atSec: 0, x: -500, y: 0, strength: 1 }]);
    podStep(near, Math.ceil(POND_WAVE_LIFE / DT) + 2);
    podStep(far, Math.ceil(POND_WAVE_LIFE / DT) + 2);
    expect(near.x[0] ?? 0).toBeGreaterThan(far.x[0] ?? 0);
    expect(far.x[0] ?? 0).toBeGreaterThan(0);
  });

  it('scales with strength and difficulty driftScale', () => {
    const run = (strength: number, diff: 'normal' | 'hard'): number => {
      const w = pondGame([{ atSec: 0, x: -300, y: 0, strength }], diff);
      podStep(w, Math.ceil(POND_WAVE_LIFE / DT) + 2);
      return w.x[0] ?? 0;
    };
    const full = run(1, 'normal');
    expect(run(0.5, 'normal')).toBeLessThan(full);
    expect(run(1, 'hard')).toBeGreaterThan(full);
  });

  it('pushes enemies about double the ship, bosses and boss parts not at all', () => {
    const w = pondGame([{ atSec: 0, x: 0, y: 300, strength: 1 }]);
    const g = spawn(w, Kind.Grunt, -300, 300);
    const boss = spawn(w, Kind.Boss, 300, 300);
    const part = spawn(w, Kind.BossPart, 0, 0);
    podStep(w, Math.ceil(POND_WAVE_LIFE / DT) + 2);
    const gruntMoved = -300 - (w.x[g] ?? 0);
    const shipMoved = -(w.y[0] ?? 0);
    expect(gruntMoved).toBeGreaterThan(0);
    expect(shipMoved).toBeGreaterThan(0);
    expect(gruntMoved).toBeGreaterThan(shipMoved * 1.5);
    expect(w.x[boss]).toBe(300);
    expect(w.y[boss]).toBe(300);
    expect(w.x[part]).toBe(0);
    expect(w.y[part]).toBe(0);
  });

  it('walls still block: a body at the wall stays inside the arena', () => {
    const w = pondGame([{ atSec: 0, x: 0, y: 0, strength: 1 }]);
    const half = w.level.arena.width / 2;
    w.x[0] = half - 30;
    for (let k = 0; k < 4; k++) {
      w.pond.nextWarn = 0;
      w.pond.nextStart = 0;
      w.time = 0;
      gs(w).waveClock = 0;
      w.pond.slotEvent.fill(-1);
      podStep(w, Math.ceil(POND_WAVE_LIFE / DT) + 2);
    }
    expect(w.x[0] ?? 0).toBeLessThanOrEqual(half);
  });

  it('stacks live waves additively', () => {
    const one = pondGame([{ atSec: 0, x: -300, y: 0, strength: 0.5 }]);
    const two = pondGame([
      { atSec: 0, x: -300, y: 0, strength: 0.5 },
      { atSec: 0, x: -300, y: 0, strength: 0.5 },
    ]);
    podStep(one, 60);
    podStep(two, 60);
    expect(two.x[0] ?? 0).toBeCloseTo(2 * (one.x[0] ?? 0), 2);
  });
});

describe('no ripples, Free Play and Endless', () => {
  function trace(w: World): number[] {
    put(w, grunt.def, 300, 200);
    put(w, grunt.def, -400, -100);
    const out: number[] = [];
    for (let i = 0; i < 600; i++) {
      stepGame(w, DT, idle());
      out.push(w.x[0] ?? 0, w.y[0] ?? 0, w.x[1] ?? 0, w.y[1] ?? 0, w.x[2] ?? 0, w.y[2] ?? 0);
    }
    return out;
  }

  it('absent and empty ripples are identical and never emit', () => {
    let n = 0;
    bus.on('sim:rippleWarn', () => n++);
    bus.on('sim:ripple', () => n++);
    const a = trace(pondGame(undefined));
    const b = trace(pondGame([]));
    expect(b).toEqual(a);
    expect(n).toBe(0);
  });

  it('Free Play and Endless ignore ripples', () => {
    const rip = { ripples: [{ atSec: 0.5, x: 0, y: 0, strength: 1 }] };
    const fp = createGame(quietLevel(rip), { freePlay: DEFAULT_FREE_PLAY });
    const en = createGame(quietLevel(rip), { mode: 'endless' });
    expect(fp.pond.active).toBe(false);
    expect(en.pond.active).toBe(false);
    expect(createGame(quietLevel(rip)).pond.active).toBe(true);
  });
});

describe('determinism', () => {
  it('two runs of the same ripple level are bit identical', () => {
    const ripples: RippleEvent[] = [
      { atSec: 1.2, x: -200, y: 100, strength: 1 },
      { atSec: 1.6, x: 250, y: -150, strength: 0.6 },
      { atSec: 3, x: 0, y: 0, strength: 0.3 },
    ];
    const run = (): number[] => {
      const w = pondGame(ripples);
      put(w, grunt.def, 300, 200);
      put(w, grunt.def, -400, -100);
      const out: number[] = [];
      for (let i = 0; i < 720; i++) {
        stepGame(w, DT, idle());
        for (let id = 0; id < 3; id++) out.push(w.x[id] ?? 0, w.y[id] ?? 0);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});
