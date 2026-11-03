// Free Play options, rules side (docs/14): lives, run length, loadout, pickups and drift through
// GameOptions.freePlay. Absent config changes nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { DEFAULT_FREE_PLAY, type FreePlayConfig } from '../../src/core/freeplayConfig';
import { DRIFT_BASE, FREE_PLAY_DRIFT_HIGH, stepDrift } from '../../src/game/drift';
import { droneArm, liveDronePickup } from '../../src/game/drones';
import { evaluateObjective } from '../../src/game/objective';
import { createGame, freePlayLevelRules, scoreAttackLeft, stepGame, type GameOptions } from '../../src/game/game';
import { livePickup, onScoringKill } from '../../src/game/pickup';
import { killShip, RESPAWN_DELAY } from '../../src/game/player';
import { gs } from '../../src/game/state';
import { currentWeapon, WEAPON_DURATION, weaponState, weaponTimeLeft } from '../../src/game/weapons';
import { inlineRectLevel, type World } from '../../src/game/world';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, quietLevel } from './helpers';

afterEach(() => bus.clear());

function fp(patch: Partial<FreePlayConfig> = {}): FreePlayConfig {
  return { ...DEFAULT_FREE_PLAY, ...patch };
}

function game(patch: Partial<FreePlayConfig> = {}, levelPatch: Partial<LevelDef> = {}, opts: GameOptions = {}): World {
  return makeGame(levelPatch, { freePlay: fp(patch), ...opts }).w;
}

function steps(w: World, sec: number): void {
  const n = Math.round(sec / DT);
  const input = idle();
  for (let i = 0; i < n; i++) stepGame(w, DT, input);
}

/** Die and wait out the respawn delay. */
function dieAndRespawn(w: World): void {
  killShip(w);
  steps(w, RESPAWN_DELAY + 0.1);
}

function drumPatch(seed = 7): Partial<LevelDef> {
  const base = inlineRectLevel(seed);
  return { seed, surface: 'cylinder', arena: { ...base.arena, shape: 'rect', width: 1408, height: 896, obstacles: [] } };
}

describe('absent config', () => {
  it('changes nothing: level lives, no time limit, spread, pickups on, level drone and super, drift as today', () => {
    const { w } = makeGame(drumPatch());
    const g = gs(w);
    expect(g.lives).toBe(w.level.lives);
    expect(g.timeLimit).toBe(0);
    expect(scoreAttackLeft(w)).toBeNull();
    expect(currentWeapon(w)).toBe('spread');
    expect(weaponState(w).pickupsOn).toBe(true);
    expect(weaponState(w).permanent).toBeNull();
    expect(w.drift.active).toBe(true);
    expect(w.drift.scale).toBe(1);
    expect(g.deaths).toBe(0);
  });

  it('the default config keeps the level drone and super when they already match', () => {
    const level = quietLevel({ drone: 'attack', superType: 'turbo' });
    expect(freePlayLevelRules(level, DEFAULT_FREE_PLAY)).toBe(level);
  });
});

describe('lives', () => {
  it.each([1, 3, 5] as const)('%i lives start with exactly that many', (n) => {
    const w = game({ lives: n }, { lives: 4 }, { difficulty: 'easy' });
    expect(gs(w).lives).toBe(n);
  });

  it('one life: a death loses the run', () => {
    const w = game({ lives: 1 });
    killShip(w);
    steps(w, DT);
    expect(gs(w).outcome).toBe('lost');
  });

  it('infinite: never lost, deaths still reset the multiplier and are counted', () => {
    const w = game({ lives: 'infinite' });
    const g = gs(w);
    expect(g.lives).toBe(Number.POSITIVE_INFINITY);
    for (let i = 0; i < 6; i++) {
      g.multiplier = 7;
      dieAndRespawn(w);
      expect(g.multiplier).toBe(1);
      expect(g.outcome).toBe('running');
      expect(w.ship.active).toBe(true);
    }
    expect(g.deaths).toBe(6);
    expect(g.lives).toBe(Number.POSITIVE_INFINITY);
  });

  it('infinite in Endless mode is never lost either', () => {
    const w = game({ lives: 'infinite' }, {}, { mode: 'endless' });
    for (let i = 0; i < 4; i++) dieAndRespawn(w);
    expect(gs(w).outcome).toBe('running');
    expect(gs(w).deaths).toBe(4);
  });
});

describe('length', () => {
  it('endless has no time limit', () => {
    const w = game({ length: 'endless' }, {}, { mode: 'endless' });
    expect(scoreAttackLeft(w)).toBeNull();
    w.time = 10_000;
    steps(w, DT);
    expect(gs(w).outcome).toBe('running');
  });

  it.each([180, 300, 600] as const)('a %i s score attack ends with success when the timer runs out', (sec) => {
    const w = game({ length: sec }, {}, { mode: 'endless' });
    let over: { score: number; mode: string } | null = null;
    bus.on('game:over', (p) => {
      over = { score: p.score, mode: p.mode };
    });
    expect(scoreAttackLeft(w)).toBe(sec);
    gs(w).score = 1234;
    w.time = sec - 0.5;
    expect(scoreAttackLeft(w)).toBeCloseTo(0.5, 9);
    steps(w, 0.25);
    expect(gs(w).outcome).toBe('running');
    steps(w, 0.5);
    expect(gs(w).outcome).toBe('won');
    expect(scoreAttackLeft(w)).toBe(0);
    expect(over).toEqual({ score: 1234, mode: 'endless' });
  });

  it('the timer keeps running through a death (time left counts w.time)', () => {
    const w = game({ length: 180, lives: 3 }, {}, { mode: 'endless' });
    steps(w, 1);
    killShip(w);
    steps(w, RESPAWN_DELAY);
    expect(scoreAttackLeft(w)).toBeCloseTo(180 - 1 - RESPAWN_DELAY, 6);
  });

  it('losing every life before the timer still fails', () => {
    const w = game({ length: 300, lives: 1 }, {}, { mode: 'endless' });
    killShip(w);
    steps(w, DT);
    expect(gs(w).outcome).toBe('lost');
  });

  it('pure: evaluateObjective with a time limit', () => {
    const base = { objective: { kind: 'survive', durationSec: 0 } as const, mode: 'endless' as const, score: 0, kills: 0, lives: 3, clock: 0 };
    expect(evaluateObjective({ ...base, timeLimit: 180, elapsed: 179.9 })).toBe('running');
    expect(evaluateObjective({ ...base, timeLimit: 180, elapsed: 180 })).toBe('won');
    expect(evaluateObjective({ ...base, lives: 0, timeLimit: 180, elapsed: 180 })).toBe('lost');
    expect(evaluateObjective({ ...base, timeLimit: 0, elapsed: 1e6 })).toBe('running');
    expect(evaluateObjective({ ...base, lives: Number.POSITIVE_INFINITY })).toBe('running');
  });
});

describe('weapon', () => {
  it('null starts with spread', () => {
    expect(currentWeapon(game({ weapon: null }))).toBe('spread');
  });

  it('with pickups on the weapon lasts its normal duration', () => {
    const w = game({ weapon: 'pierce', pickups: true });
    expect(currentWeapon(w)).toBe('pierce');
    expect(weaponTimeLeft(w)).toBe(WEAPON_DURATION);
    steps(w, WEAPON_DURATION + 0.5);
    expect(currentWeapon(w)).toBe('spread');
  });

  it('with pickups off the weapon lasts the whole run, through deaths', () => {
    const w = game({ weapon: 'rapid', pickups: false, lives: 'infinite' });
    expect(currentWeapon(w)).toBe('rapid');
    steps(w, WEAPON_DURATION * 2);
    expect(currentWeapon(w)).toBe('rapid');
    expect(weaponTimeLeft(w)).toBe(WEAPON_DURATION);
    killShip(w);
    expect(currentWeapon(w)).toBe('spread');
    steps(w, RESPAWN_DELAY + 0.1);
    expect(currentWeapon(w)).toBe('rapid');
  });

  it('orbit with pickups off keeps its shield', () => {
    const w = game({ weapon: 'orbit', pickups: false });
    steps(w, WEAPON_DURATION + 1);
    expect(currentWeapon(w)).toBe('orbit');
    expect(weaponState(w).hitters).toBeGreaterThan(0);
  });

  it('spread as the starting weapon changes nothing', () => {
    const w = game({ weapon: 'spread', pickups: false });
    expect(currentWeapon(w)).toBe('spread');
    expect(weaponState(w).permanent).toBeNull();
  });
});

describe('pickups', () => {
  it('off: no weapon or drone pickups drop however many kills', () => {
    const w = game({ pickups: false }, {}, { weaponPickups: true });
    for (let i = 0; i < 200; i++) onScoringKill(w, 0, 0);
    expect(livePickup(w)).toBe(-1);
    expect(liveDronePickup(w)).toBe(-1);
    expect(weaponState(w).dropIndex).toBe(0);
    expect(droneArm(w).dropIndex).toBe(0);
  });

  it('on: both drop as today', () => {
    const w = game({ pickups: true }, {}, { weaponPickups: false });
    for (let i = 0; i < 40; i++) onScoringKill(w, 0, 0);
    expect(weaponState(w).dropIndex).toBeGreaterThan(0);
    expect(droneArm(w).dropIndex).toBeGreaterThan(0);
  });
});

describe('drone and super', () => {
  it('override the level kinds without touching the caller level', () => {
    const level = quietLevel({ drone: 'attack', superType: 'turbo' });
    const w = createGame(level, { freePlay: fp({ drone: 'ram', superType: 'detonate' }) });
    expect(w.level.drone).toBe('ram');
    expect(w.level.superType).toBe('detonate');
    expect(level.drone).toBe('attack');
    expect(level.superType).toBe('turbo');
  });

  it.each(['attack', 'collect', 'ram'] as const)('drone %s', (d) => {
    expect(game({ drone: d }, { drone: d === 'attack' ? 'ram' : 'attack' }).level.drone).toBe(d);
  });

  it.each(['homing', 'detonate', 'turbo'] as const)('super %s', (k) => {
    expect(game({ superType: k }, { superType: k === 'turbo' ? 'homing' : 'turbo' }).level.superType).toBe(k);
  });
});

describe('drift', () => {
  function driftSpeed(w: World): number {
    gs(w).invulnerable = true;
    stepDrift(w, DT);
    return w.drift.speed;
  }

  it('off: the drum does not drift', () => {
    expect(game({ drift: 'off' }, drumPatch()).drift.active).toBe(false);
  });

  it('low: as today', () => {
    const w = game({ drift: 'low' }, drumPatch());
    expect(w.drift.active).toBe(true);
    expect(driftSpeed(w)).toBeCloseTo(DRIFT_BASE, 9);
  });

  it('high: 2x every speed', () => {
    const w = game({ drift: 'high' }, drumPatch());
    expect(w.drift.active).toBe(true);
    expect(driftSpeed(w)).toBeCloseTo(DRIFT_BASE * FREE_PLAY_DRIFT_HIGH, 9);
  });

  it('drum only: high on a flat arena stays still', () => {
    expect(game({ drift: 'high' }).drift.active).toBe(false);
  });
});
