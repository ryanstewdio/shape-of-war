// Release polish: membrane gaps (docs/14 item 9). An obstacle with membrane true is a wall for the
// ship, player bullets, enemy bullets and boss entities (every confineOn caller by default). Enemy
// moves that go through moveTo, moveToHit or driftEntity pass through it instead, at
// MEMBRANE_SPEED of their step while their circle overlaps it. Levels without a membrane never
// reach this module (World.membranes false), so they stay bit identical. No allocation.
// R2 enrage: an enemy that fully crosses a membrane (enters it from one side and leaves it on the
// other, along the bar's thin axis) is enraged for the rest of its life: World.enraged[id] is 1,
// its move speed is ENRAGE_SPEED x and its turn rate ENRAGE_TURN x (enemySpeedScale and turnScale
// with the id), and 'sim:enrage' fires once as it emerges. Attack timings are unchanged.
import { bus } from '../core/events';
import type { ArenaDef, Obstacle } from '../levelgen/leveldef';
import { confineOn, overlapsMembrane, type ConfineResult } from './arena';
import { Kind, type World } from './world';

/** Fraction of an enemy's step kept while it overlaps a membrane. */
export const MEMBRANE_SPEED = 0.35;
/** R2: move speed multiplier of an enraged enemy. */
export const ENRAGE_SPEED = 1.5;
/** R2: turn rate multiplier of an enraged enemy. */
export const ENRAGE_TURN = 1.3;

/** Pure: true when the arena has at least one membrane obstacle. */
export function hasMembrane(arena: ArenaDef): boolean {
  const obs = arena.obstacles;
  for (let i = 0; i < obs.length; i++) if (obs[i]?.membrane === true) return true;
  return false;
}

/**
 * Pure: kinds that squeeze through membranes: the wave enemies, the hazard spawner and the V2
 * enemies and hazards. Not the ship, drones, geoms, pickups, wells or any boss entity.
 */
export function passesMembrane(k: number): boolean {
  return (k >= Kind.Grunt && k <= Kind.SnakeBody) || k === Kind.Spawner || (k >= Kind.Charger && k <= Kind.Slime);
}

/**
 * Pure: kinds that can enrage: those that pass membranes and move on their own. Not snake body
 * segments (they follow the head), Mines or Slime (static), and never a boss kind.
 */
export function canEnrage(k: number): boolean {
  return passesMembrane(k) && k !== Kind.SnakeBody && k !== Kind.Mine && k !== Kind.Slime;
}

/** R2: move speed multiplier of entity id: ENRAGE_SPEED when enraged, else 1. */
export function enrageSpeed(w: World, id: number): number {
  return w.enraged[id] === 1 ? ENRAGE_SPEED : 1;
}

/** R2: turn rate multiplier of entity id: ENRAGE_TURN when enraged, else 1. */
export function enrageTurn(w: World, id: number): number {
  return w.enraged[id] === 1 ? ENRAGE_TURN : 1;
}

/** True when entity id is enraged (render: hot red). */
export function isEnraged(w: World, id: number): boolean {
  return w.enraged[id] === 1;
}

const d = { x: 0, y: 0 };
const enrageFx = { id: 0, x: 0, y: 0 };

/** Pure: true when a circle at offset (lx, ly) from the box centre overlaps the box. */
function overlapsBox(o: Obstacle, lx: number, ly: number, r: number): boolean {
  const hw = o.w / 2;
  const hh = o.h / 2;
  const dx = lx < -hw ? lx + hw : lx > hw ? lx - hw : 0;
  const dy = ly < -hh ? ly + hh : ly > hh ? ly - hh : 0;
  return dx * dx + dy * dy < r * r || (dx === 0 && dy === 0);
}

/** Pure: the side of the box a point at offset (lx, ly) is on, along the box's thin axis: 1 or -1. */
export function membraneSide(o: Obstacle, lx: number, ly: number): number {
  const v = o.w <= o.h ? lx : ly;
  return v < 0 ? -1 : 1;
}

/** Index of the first membrane the circle at (x, y) overlaps, or -1. Offsets go through the surface. */
export function membraneAt(w: World, x: number, y: number, r: number): number {
  const obs = w.level.arena.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (o === undefined || o.membrane !== true) continue;
    w.surface.delta(o.cx, o.cy, x, y, d);
    if (overlapsBox(o, d.x, d.y, r)) return i;
  }
  return -1;
}

function sideOf(w: World, i: number, x: number, y: number): number {
  const o = w.level.arena.obstacles[i];
  if (o === undefined) return 1;
  w.surface.delta(o.cx, o.cy, x, y, d);
  return membraneSide(o, d.x, d.y);
}

/**
 * Track entity id against the membranes after a move from (x0, y0) to (x1, y1). Entering records
 * the side it came from; leaving on the other side enrages it (once) and emits 'sim:enrage'.
 */
export function trackCrossing(w: World, id: number, x0: number, y0: number, x1: number, y1: number): void {
  const r = w.radius[id] ?? 0;
  const now = membraneAt(w, x1, y1, r);
  const inside = w.memIn[id] ?? 0;
  const was = inside === 0 ? -1 : Math.abs(inside) - 1;
  if (now === was) return;
  if (was >= 0) {
    const entered = inside < 0 ? -1 : 1;
    if (w.enraged[id] !== 1 && sideOf(w, was, x1, y1) !== entered) {
      w.enraged[id] = 1;
      enrageFx.id = id;
      enrageFx.x = x1;
      enrageFx.y = y1;
      bus.emit('sim:enrage', enrageFx);
    }
  }
  w.memIn[id] = now < 0 ? 0 : (now + 1) * sideOf(w, now, x0, y0);
}

/**
 * Confined move of entity id to (nx, ny) on a level with membranes. A kind that passes slows to
 * MEMBRANE_SPEED of the step while it overlaps a membrane and ignores membranes when confined;
 * any other kind is confined exactly as confineOn does. A kind that can enrage is tracked across
 * membranes (trackCrossing).
 */
export function membraneMove(w: World, id: number, nx: number, ny: number, out: ConfineResult): ConfineResult {
  const r = w.radius[id] ?? 0;
  const k = w.kind[id] ?? 0;
  if (!passesMembrane(k)) return confineOn(w.surface, w.level.arena, nx, ny, r, out);
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  let tx = nx;
  let ty = ny;
  if (overlapsMembrane(w.surface, w.level.arena, x, y, r)) {
    w.surface.delta(x, y, nx, ny, d);
    tx = x + d.x * MEMBRANE_SPEED;
    ty = y + d.y * MEMBRANE_SPEED;
  }
  confineOn(w.surface, w.level.arena, tx, ty, r, out, true);
  if (canEnrage(k)) trackCrossing(w, id, x, y, out.x, out.y);
  return out;
}
