// GW1 nova snakes: a Gravity well is a time bomb. 3 to 4 s after it enters nova (hashed per well) a
// Snake emerges from the well centre, then one every 6 s, at most 2 live per well and within the
// snake slots and entity caps. They die normally; the well's explosion removes its snakes wherever
// they are. 'sim:wellSpawn' { id, x, y, kind } fires once per emergence.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { killEnemy } from '../../src/game/combat';
import * as well from '../../src/game/enemies/gravitywell';
import {
  emergenceDue,
  explode,
  NOVA_SNAKE_EVERY,
  NOVA_SNAKE_MAX,
  novaSecFor,
  novaSnakeDelayFor,
  wellSnakeCount,
} from '../../src/game/enemies/gravitywell';
import { spawnSnake } from '../../src/game/enemies/snake';
import { setInvulnerable, stepGame } from '../../src/game/game';
import { gs, SNAKE_SLOTS } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

const BIG = { shape: 'rect' as const, width: 2400, height: 1400, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };

interface Spawned {
  t: number;
  id: number;
  x: number;
  y: number;
  kind: Kind;
  head: number;
  hx: number;
  hy: number;
}

/** Big empty arena, one well at (wx, wy) in slot 0, invulnerable ship parked far away. Logs events. */
function wellGame(wx = 0, wy = 0): { w: World; id: number; spawns: Spawned[]; nova: number[]; clock: { t: number } } {
  const { w } = makeGame({ arena: BIG, drone: 'collect' });
  setInvulnerable(w, true);
  w.ship.invuln = 1e9;
  const id = put(w, well.def, wx, wy);
  gs(w).wellIds[gs(w).wellCount++] = id;
  w.x[0] = 1100;
  w.y[0] = 600;
  w.prevX[0] = 1100;
  w.prevY[0] = 600;
  const clock = { t: 0 };
  const spawns: Spawned[] = [];
  const nova: number[] = [];
  bus.on('sim:wellNova', () => nova.push(clock.t));
  bus.on('sim:wellSpawn', (e) => {
    // The newest snake head is the one in the slot this well owns with the youngest age.
    let head = -1;
    for (let s = 0; s < SNAKE_SLOTS; s++) {
      const h = gs(w).snakeHead[s] ?? -1;
      if (h > 0 && gs(w).snakeWell[s] === e.id && (head < 0 || (w.t[h] ?? 0) <= (w.t[head] ?? 0))) head = h;
    }
    spawns.push({ t: clock.t, id: e.id, x: e.x, y: e.y, kind: e.kind, head, hx: w.x[head] ?? NaN, hy: w.y[head] ?? NaN });
  });
  return { w, id, spawns, nova, clock };
}

function run(w: World, clock: { t: number }, secs: number): void {
  const n = Math.round(secs * 120);
  for (let i = 0; i < n; i++) {
    clock.t += DT;
    stepGame(w, DT, idle());
  }
}

function snakeHeads(w: World): number {
  let n = 0;
  for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === Kind.SnakeHead) n++;
  return n;
}

describe('nova snakes: pure rules', () => {
  it('the first emergence is hashed into 3 to 4 s after the nova, per well position and seed', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed < 60; seed++) {
      for (const [x, y] of [[0, 0], [300, -200], [-450, 120]] as const) {
        const d = novaSnakeDelayFor(seed, x, y);
        expect(d).toBeGreaterThanOrEqual(3);
        expect(d).toBeLessThan(4);
        expect(novaSnakeDelayFor(seed, x, y)).toBe(d);
        seen.add(Math.round(d * 100));
      }
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('an emergence falls due once at first, then every 6 s', () => {
    expect(emergenceDue(3.4, 3.5, 3.5, 6)).toBe(true);
    expect(emergenceDue(3.5, 3.6, 3.5, 6)).toBe(false);
    expect(emergenceDue(3.0, 3.4, 3.5, 6)).toBe(false);
    expect(emergenceDue(9.45, 9.55, 3.5, 6)).toBe(true);
    expect(emergenceDue(9.55, 15.4, 3.5, 6)).toBe(false);
    expect(emergenceDue(15.4, 15.5, 3.5, 6)).toBe(true);
    let n = 0;
    for (let t = 0; t < 30; t += DT) if (emergenceDue(t, t + DT, 3.5, 6)) n++;
    expect(n).toBe(5); // 3.5, 9.5, 15.5, 21.5, 27.5
  });
});

describe('nova snakes in the sim', () => {
  it('the first snake emerges at the hashed delay after the nova, head at the well, then 6 s later', () => {
    const { w, id, spawns, nova, clock } = wellGame(120, -80);
    run(w, clock, 18);
    expect(nova.length).toBe(1);
    expect(nova[0] ?? 0).toBeCloseTo(novaSecFor(w.level.seed, 0), 1);
    const delay = novaSnakeDelayFor(w.level.seed, 120, -80);
    expect(spawns.length).toBe(2);
    expect((spawns[0]?.t ?? 0) - (nova[0] ?? 0)).toBeCloseTo(delay, 1);
    expect((spawns[1]?.t ?? 0) - (spawns[0]?.t ?? 0)).toBeCloseTo(NOVA_SNAKE_EVERY, 1);
    for (const e of spawns) {
      expect(e).toMatchObject({ id, x: 120, y: -80, kind: Kind.SnakeHead });
      expect(e.head).toBeGreaterThan(0);
      expect(e.hx).toBe(120);
      expect(e.hy).toBe(-80);
    }
    expect(wellSnakeCount(gs(w), id)).toBe(2);
  });

  it('no snake before the nova, and none with the nova switched off', () => {
    const a = wellGame();
    run(a.w, a.clock, novaSecFor(a.w.level.seed, 0) + 2.9);
    expect(a.spawns.length).toBe(0);
    bus.clear();
    const { w } = makeGame({ arena: BIG }, { wellNova: false });
    setInvulnerable(w, true);
    const id = put(w, well.def, 0, 0);
    gs(w).wellIds[gs(w).wellCount++] = id;
    let n = 0;
    bus.on('sim:wellSpawn', () => n++);
    for (let i = 0; i < 120 * 30; i++) stepGame(w, DT, idle());
    expect(n).toBe(0);
  });

  it('at most 2 live per well: a due emergence with two alive is skipped; a kill makes room', () => {
    const { w, id, spawns, nova, clock } = wellGame();
    run(w, clock, 30);
    expect(wellSnakeCount(gs(w), id)).toBe(NOVA_SNAKE_MAX);
    expect(spawns.length).toBe(2); // due at d, d + 6, d + 12, d + 18: only the first two had room
    expect(snakeHeads(w)).toBe(2);
    // A normal kill frees a place; the next due emergence fills it.
    const head = spawns[0]?.head ?? -1;
    killEnemy(w, head, true);
    expect(wellSnakeCount(gs(w), id)).toBe(1);
    const d = novaSnakeDelayFor(w.level.seed, 0, 0);
    const since = clock.t - (nova[0] ?? 0);
    const next = d + Math.ceil((since - d) / NOVA_SNAKE_EVERY) * NOVA_SNAKE_EVERY;
    run(w, clock, next - since + 0.1);
    expect(spawns.length).toBe(3);
    expect(wellSnakeCount(gs(w), id)).toBe(2);
  });

  it('stays within the snake slots: with every slot taken nothing emerges and no event fires', () => {
    const { w, id, spawns, clock } = wellGame();
    for (let s = 0; s < SNAKE_SLOTS; s++) expect(spawnSnake(w, -900 + s * 40, 500, 0)).toBeGreaterThan(0);
    run(w, clock, 20);
    expect(spawns.length).toBe(0);
    expect(wellSnakeCount(gs(w), id)).toBe(0);
  });

  it('the well explosion removes its snakes wherever they are, and frees their slots', () => {
    const { w, id, spawns, clock } = wellGame();
    run(w, clock, 18);
    expect(spawns.length).toBe(2);
    // Carry one snake far outside the 220 u blast.
    const far = spawns[0]?.head ?? -1;
    w.x[far] = -1000;
    w.y[far] = 600;
    const normal = spawnSnake(w, 900, -600, 0);
    expect(normal).toBeGreaterThan(0);
    explode(w, id);
    for (const e of spawns) expect(w.alive[e.head] === 1 && w.kind[e.head] === Kind.SnakeHead).toBe(false);
    expect(snakeHeads(w)).toBe(1); // the normal snake lives on
    expect(w.alive[normal]).toBe(1);
    expect(Array.from(gs(w).snakeWell).every((v) => v === -1)).toBe(true);
    let segs = 0;
    for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === Kind.SnakeBody) segs++;
    expect(segs).toBe(12);
    run(w, clock, 10);
    expect(spawns.length).toBe(2); // the well is gone: no more emergences
  });

  it('two identical runs give identical emergences and snakes, with no Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in sim code');
    });
    const once = (): string => {
      const { w, spawns, clock } = wellGame(-200, 150);
      run(w, clock, 25);
      const heads: string[] = [];
      for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === Kind.SnakeHead) heads.push(`${w.x[i]},${w.y[i]}`);
      const out = `${spawns.map((e) => `${e.t.toFixed(4)}:${e.head}`).join(';')}|${heads.join(';')}`;
      bus.clear();
      return out;
    };
    const a = once();
    expect(a).toBe(once());
    expect(a.split('|')[0]?.split(';').length).toBe(2);
    spy.mockRestore();
  });
});
