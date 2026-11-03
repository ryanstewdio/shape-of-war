// R2: an enemy that fully crosses a membrane is enraged for the rest of its life: speed x1.5,
// turn rate x1.3, World.enraged[id] 1 for the renderer, and one 'sim:enrage' as it emerges.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import * as grunt from '../../src/game/enemies/grunt';
import * as wanderer from '../../src/game/enemies/wanderer';
import { isEnraged, stepGame } from '../../src/game/game';
import { canEnrage, ENRAGE_SPEED, ENRAGE_TURN, membraneSide } from '../../src/game/membrane';
import { enemySpeedScale, gs, turnScale } from '../../src/game/state';
import { moveTo } from '../../src/game/steer';
import { inlineRectLevel, kill, Kind, spawn, type World } from '../../src/game/world';
import type { LevelDef, Obstacle } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

const BAR_X = 200;
const BAR_W = 40;

function barPatch(): Partial<LevelDef> {
  const base = inlineRectLevel(7);
  const bar: Obstacle = { cx: BAR_X, cy: 0, w: BAR_W, h: 900, membrane: true };
  return { drone: 'collect', arena: { ...base.arena, shape: 'rectObstacles', obstacles: [bar] } };
}

function game(patch: Partial<LevelDef> = barPatch()): World {
  const { w } = makeGame(patch);
  gs(w).invulnerable = true;
  w.drift.active = false;
  return w;
}

type EnrageEvt = { id: number; x: number; y: number };
function listen(): EnrageEvt[] {
  const got: EnrageEvt[] = [];
  bus.on('sim:enrage', (e) => got.push({ id: e.id, x: e.x, y: e.y }));
  return got;
}

describe('pure', () => {
  it('canEnrage: moving enemies only, never bosses, parts, hazards or snake bodies', () => {
    for (const k of [Kind.Grunt, Kind.Wanderer, Kind.Weaver, Kind.Pinwheel, Kind.Dart, Kind.SnakeHead, Kind.Spawner, Kind.Charger, Kind.Bulwark, Kind.Blink, Kind.Swirl, Kind.Sower, Kind.Splime]) {
      expect(canEnrage(k)).toBe(true);
    }
    for (const k of [Kind.Ship, Kind.SnakeBody, Kind.Mine, Kind.Slime, Kind.GravityWell, Kind.Geom, Kind.Drone, Kind.Boss, Kind.BossPart, Kind.BossHazard]) {
      expect(canEnrage(k)).toBe(false);
    }
  });

  it('membraneSide reads the thin axis of the bar', () => {
    const tall: Obstacle = { cx: 0, cy: 0, w: 40, h: 900, membrane: true };
    const wide: Obstacle = { cx: 0, cy: 0, w: 900, h: 40, membrane: true };
    expect(membraneSide(tall, -30, 400)).toBe(-1);
    expect(membraneSide(tall, 30, -400)).toBe(1);
    expect(membraneSide(wide, 400, -30)).toBe(-1);
    expect(membraneSide(wide, -400, 30)).toBe(1);
  });
});

describe('crossing a membrane', () => {
  it('a grunt that crosses is enraged once, with one event as it emerges', () => {
    const w = game();
    const got = listen();
    const id = put(w, grunt.def, BAR_X + 150, 0); // right of the bar, the ship at the origin on the left
    let at = -1;
    for (let i = 0; i < 600 && at < 0; i++) {
      stepGame(w, DT, idle());
      if (isEnraged(w, id)) at = i;
    }
    expect(at).toBeGreaterThan(0);
    expect(w.enraged[id]).toBe(1);
    expect(got.length).toBe(1);
    expect(got[0]?.id).toBe(id);
    // Emerged: the event position is fully past the bar on the ship side.
    expect(got[0]?.x ?? 0).toBeLessThanOrEqual(BAR_X - BAR_W / 2 - grunt.def.radius + 1e-3);
    expect(got[0]?.x).toBeCloseTo(w.x[id] ?? 0, 6);
    for (let i = 0; i < 240; i++) stepGame(w, DT, idle());
    expect(got.length).toBe(1);
    expect(w.enraged[id]).toBe(1);
  });

  it('entering and backing out the same side does not enrage', () => {
    const w = game();
    const got = listen();
    const id = put(w, grunt.def, BAR_X + 60, 0);
    for (let i = 0; i < 10; i++) moveTo(w, id, (w.x[id] ?? 0) - 5, 0); // into the bar
    expect(w.memIn[id]).not.toBe(0);
    for (let i = 0; i < 40; i++) moveTo(w, id, (w.x[id] ?? 0) + 5, 0); // back out to the right
    expect(w.memIn[id]).toBe(0);
    expect(w.enraged[id]).toBe(0);
    expect(got.length).toBe(0);
  });

  it('a boss kind never crosses or enrages', () => {
    const w = game();
    const got = listen();
    const id = spawn(w, Kind.Boss, BAR_X + 60, 0);
    w.radius[id] = 20;
    for (let i = 0; i < 100; i++) moveTo(w, id, (w.x[id] ?? 0) - 5, 0);
    expect(w.x[id] ?? 0).toBeGreaterThan(BAR_X);
    expect(w.enraged[id]).toBe(0);
    expect(got.length).toBe(0);
  });

  it('a freed slot respawns calm', () => {
    const w = game();
    const id = put(w, grunt.def, 0, 300);
    w.enraged[id] = 1;
    w.memIn[id] = 1;
    kill(w, id);
    const again = put(w, grunt.def, 0, 300);
    expect(again).toBe(id);
    expect(w.enraged[again]).toBe(0);
    expect(w.memIn[again]).toBe(0);
  });
});

describe('enraged speed and turn', () => {
  it('scales speed x1.5 and turn x1.3 for the enraged id only', () => {
    const w = game();
    const a = put(w, grunt.def, -300, 300);
    const b = put(w, grunt.def, -300, -300);
    w.enraged[a] = 1;
    expect(ENRAGE_SPEED).toBe(1.5);
    expect(ENRAGE_TURN).toBe(1.3);
    expect(enemySpeedScale(w, a)).toBeCloseTo(enemySpeedScale(w) * 1.5, 12);
    expect(turnScale(w, a)).toBeCloseTo(turnScale(w) * 1.3, 12);
    expect(enemySpeedScale(w, b)).toBe(enemySpeedScale(w));
    expect(turnScale(w, b)).toBe(turnScale(w));
  });

  it('an enraged grunt chases 1.5 x as fast', () => {
    const w = game();
    const a = put(w, grunt.def, -400, 300);
    const b = put(w, grunt.def, -400, -300);
    w.enraged[a] = 1;
    const ax = w.x[a] ?? 0;
    const ay = w.y[a] ?? 0;
    const bx = w.x[b] ?? 0;
    const by = w.y[b] ?? 0;
    stepGame(w, DT, idle());
    const da = Math.hypot((w.x[a] ?? 0) - ax, (w.y[a] ?? 0) - ay);
    const db = Math.hypot((w.x[b] ?? 0) - bx, (w.y[b] ?? 0) - by);
    expect(db).toBeGreaterThan(0);
    expect(da / db).toBeCloseTo(1.5, 3);
  });

  it('an enraged wanderer drifts 1.5 x as fast', () => {
    const w = game();
    const a = put(w, wanderer.def, -400, 300);
    const b = put(w, wanderer.def, -400, -300);
    w.vx[a] = 100;
    w.vy[a] = 0;
    w.vx[b] = 100;
    w.vy[b] = 0;
    w.enraged[a] = 1;
    const ax = w.x[a] ?? 0;
    const bx = w.x[b] ?? 0;
    stepGame(w, DT, idle());
    expect(((w.x[a] ?? 0) - ax) / ((w.x[b] ?? 0) - bx)).toBeCloseTo(1.5, 3);
  });
});

describe('levels without membranes', () => {
  it('never enrage: a flat level with waves runs with no event and no flag', () => {
    const { w } = makeGame({ waves: { ...inlineRectLevel(7).waves, waves: [] } });
    gs(w).invulnerable = true;
    const got = listen();
    const ids: number[] = [];
    for (let i = 0; i < 6; i++) ids.push(put(w, grunt.def, -500 + i * 200, 350));
    for (let i = 0; i < 600; i++) stepGame(w, DT, idle());
    expect(w.membranes).toBe(false);
    expect(got.length).toBe(0);
    expect(w.enraged.every((v) => v === 0)).toBe(true);
    expect(w.memIn.every((v) => v === 0)).toBe(true);
  });

  it('a solid bar is not a membrane: no crossing, no enrage', () => {
    const base = inlineRectLevel(7);
    const w = game({ drone: 'collect', arena: { ...base.arena, shape: 'rectObstacles', obstacles: [{ cx: BAR_X, cy: 0, w: BAR_W, h: 900 }] } });
    const got = listen();
    const id = put(w, grunt.def, BAR_X + 150, 0);
    for (let i = 0; i < 600; i++) stepGame(w, DT, idle());
    expect(w.enraged[id]).toBe(0);
    expect(got.length).toBe(0);
  });
});
