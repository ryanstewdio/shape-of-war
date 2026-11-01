// Tempest (tier 3, red, level 40; docs/12 roster row 8). Laps the arena wall at 140 u/s with its
// centre 90 u from the wall, dropping a Slime every 1.0 s along its path (8 of its own live at most,
// inside the 12 total Slime cap). Every 6 s on the lap (5 s, 4 s in phases 2 and 3; attack clock)
// it stops, shows a lane marker toward its target for the tier telegraph, dashes along it to the far
// wall and rests there 1.5 s. Hittable on the lap and in the rest, closed in the wind up and dash.
// A bomb clears the Slime trail (player.ts removes every Slime). Scratch: n0 move state, t3 its
// timer, t0 dash clock, t1 Slime clock, angle lap angle, dir lap direction, t2 dash heading, n2
// the marker id.
//
// Split (GW2): at the stage 2 crack (below 33 percent) the body splits once into two smaller
// Tempests (Kind.BossPart, PartType.Tempestling, slots 0 and 1, TEMPESTLING.sizeShare of the body
// radius) that share the remaining hit points evenly, following the Brood split pattern:
// 'sim:bossSplit' fires once, the bar is the sum of the two, contact with either kills and the fight
// ends with the second. Each laps the wall (the second the other way round), lays Slime and dashes
// at its target like the body, its Slime and dash clocks at TEMPESTLING.rate of the body's. A wind
// up whose marker was cleared (bomb, ship death) goes back to the lap, so no dash is unmarked. Split
// scratch per slot k in bs.abl from k * SLOT: move state, its timer, dash clock, Slime clock, lap
// angle, lap direction, dash heading, marker id.
import { bus } from '../../core/events';
import { isInside } from '../arena';
import * as slime from '../enemies/slime';
import { removeEntity } from '../remove';
import { spawnFromDef } from '../state';
import { angleBetween, moveToHit, stepToward, targetOf } from '../steer';
import { Kind, type World } from '../world';
import { bossEnraged, clearHazards, crackBody, spawnLaneMarker, spawnPart, wallDistance } from './core';
import { hazardTelegraph, wrapPi } from './kit';
import { bossOf, type BossState } from './state';
import { BOSS_TABLE, ENRAGE_RATE, MAX_PARTS, TEMPEST, TEMPESTLING } from './table';
import { BossMode, PartType, type BossDef } from './types';

export const enum TempestMove {
  Lap = 0,
  Windup = 1,
  Dash = 2,
  Rest = 3,
}

/** Pure: seconds of lap between dashes in a phase. */
export function dashEveryFor(phase: number): number {
  if (phase >= 3) return TEMPEST.dashEveryP3;
  if (phase === 2) return TEMPEST.dashEveryP2;
  return TEMPEST.dashEvery;
}

/** Distance from the centre of the lap point at angle a: the centre keeps wallGap from every wall. */
export function lapRadius(w: World, a: number): number {
  return wallDistance(w, a, TEMPEST.wallGap);
}

/** Distance from (x, y) along heading a to where a body of radius r meets the wall. */
export function rayToWall(w: World, x: number, y: number, a: number, r: number): number {
  const arena = w.level.arena;
  const c = Math.cos(a);
  const s = Math.sin(a);
  let lo = 0;
  let hi = Math.hypot(arena.width, arena.height);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (isInside(arena, x + c * mid, y + s * mid, r)) lo = mid;
    else hi = mid;
  }
  return lo;
}

const counts = { total: 0, owned: 0 };

/** Drop a Slime owned by the boss at its position, inside its own cap and the total cap. */
export function dropTrail(w: World, id: number): number {
  slime.countSlime(w, id, counts);
  if (counts.total >= slime.CAP_TOTAL || counts.owned >= TEMPEST.slimeMax) return -1;
  const s = spawnFromDef(w, slime.def, w.x[id] ?? 0, w.y[id] ?? 0, 0);
  if (s < 0) return -1;
  w.a[s] = id;
  return s;
}

function markerAlive(w: World, bs: BossState, m: number): boolean {
  return m > 0 && w.alive[m] === 1 && w.kind[m] === Kind.BossHazard && bs.hzMarker[m] === 1;
}

function dropMarker(w: World, bs: BossState): void {
  if (markerAlive(w, bs, bs.n2)) removeEntity(w, bs.n2);
  bs.n2 = -1;
}

/**
 * Move body id one lap step from lap angle a0 in direction dir, at lapSpeed along the path (one
 * secant correction, so the corners of a rect floor are not taken faster). Returns the new angle.
 */
function lapStep(w: World, id: number, a0: number, dir: number, dt: number): number {
  const v = TEMPEST.lapSpeed * dt;
  const r0 = lapRadius(w, a0);
  let da = (dir * v) / (r0 > 60 ? r0 : 60);
  const r1 = lapRadius(w, a0 + da);
  const d = Math.hypot(Math.cos(a0 + da) * r1 - Math.cos(a0) * r0, Math.sin(a0 + da) * r1 - Math.sin(a0) * r0);
  if (d > 1e-6) da *= v / d;
  const a = wrapPi(a0 + da);
  const rr = lapRadius(w, a);
  stepToward(w, id, Math.cos(a) * rr, Math.sin(a) * rr, TEMPEST.lapSpeed * TEMPEST.catchUp * dt);
  w.rot[id] = wrapPi(a + (dir * Math.PI) / 2);
  return a;
}

function setMove(bs: BossState, state: TempestMove, t: number): void {
  bs.n0 = state;
  bs.t3 = t;
  const open = state === TempestMove.Lap || state === TempestMove.Rest;
  bs.open = open;
  bs.openLeft = state === TempestMove.Rest ? t : -1;
  bs.mode = state === TempestMove.Rest ? BossMode.Vulnerable : BossMode.Attacking;
}

function lap(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  bs.angle = lapStep(w, id, bs.angle, bs.dir, dt);
  bs.t0 += adt;
  if (bs.t0 < dashEveryFor(bs.phase)) return;
  bs.t0 = 0;
  const heading = angleBetween(w, id, targetOf(w, id)); // locked at the wind up start
  bs.t2 = heading;
  w.rot[id] = heading;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  bs.n2 = spawnLaneMarker(w, bs, x, y, heading, rayToWall(w, x, y, heading, w.radius[id] ?? 0), TEMPEST.markerHalfWidth);
  setMove(bs, TempestMove.Windup, hazardTelegraph(bs.row.tier));
}

export function reset(w: World, id: number, bs: BossState, first: boolean): void {
  bs.angle = Math.atan2(w.y[id] ?? 0, w.x[id] ?? 0);
  if (first) bs.dir = 1;
  bs.t0 = TEMPEST.dashEvery - TEMPEST.firstDash;
  bs.t1 = 0;
  bs.t2 = 0;
  bs.n2 = -1; // the core clears hazards (the marker too) before a restart
  bs.retry = 0;
  setMove(bs, TempestMove.Lap, 0);
}

export function step(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  const state = bs.n0 as TempestMove;
  if (state !== TempestMove.Rest && state !== TempestMove.Windup) {
    bs.t1 += adt;
    if (bs.t1 >= TEMPEST.slimeEvery) {
      bs.t1 -= TEMPEST.slimeEvery;
      dropTrail(w, id);
    }
  }
  if (state === TempestMove.Lap) {
    lap(w, id, bs, dt, adt);
    return;
  }
  bs.t3 -= dt; // sim time: enrage never shortens the telegraph or the rest
  if (state === TempestMove.Windup) {
    if (bs.t3 > 0) return;
    dropMarker(w, bs);
    setMove(bs, TempestMove.Dash, TEMPEST.dashSecMax);
    return;
  }
  if (state === TempestMove.Dash) {
    const v = TEMPEST.dashSpeed * dt;
    const hit = moveToHit(w, id, (w.x[id] ?? 0) + Math.cos(bs.t2) * v, (w.y[id] ?? 0) + Math.sin(bs.t2) * v);
    if (hit || bs.t3 <= 0) setMove(bs, TempestMove.Rest, TEMPEST.restSec);
    return;
  }
  // Rest at the far wall: the counter window. Then back to the lap from where it stands.
  bs.openLeft = bs.t3 > 0 ? bs.t3 : 0;
  if (bs.t3 > 0) return;
  bs.angle = Math.atan2(w.y[id] ?? 0, w.x[id] ?? 0);
  setMove(bs, TempestMove.Lap, 0);
}

export function onPhase(w: World, id: number, bs: BossState, phase: number): void {
  // The dash interval reads bs.phase; a wind up or dash under way finishes.
}

export function entryHome(d: number): number {
  const home = d - (TEMPEST.wallGap - BOSS_TABLE.tempest.radius);
  return home > 0 ? home : 0;
}

// ---------------------------------------------------------------------------------------------
// Split into Tempestlings (GW2)

/** Scratch slots per Tempestling in bs.abl, and their offsets. */
export const SLOT = 8;
const MOVE = 0;
const TIMER = 1;
const DASH = 2;
const SLIME = 3;
const ANGLE = 4;
const DIR = 5;
const HEADING = 6;
const MARK = 7;

/** Pure: hit points of part k of count after a split of hp: even shares, part 0 takes the remainder. */
export function splitHp(hp: number, k: number, count: number): number {
  const n = count > 0 ? count : 1;
  const h = hp > 0 ? Math.floor(hp) : 0;
  const each = Math.floor(h / n);
  return k === 0 ? h - each * (n - 1) : each;
}

/** Pure: radius of a Tempestling for a body radius r. */
export function tempestlingRadius(r: number): number {
  return r * TEMPESTLING.sizeShare;
}

/** Pure: attack time of a Tempestling for step time dt (enraged or not): TEMPESTLING.rate of the body's. */
export function tempestlingAdt(dt: number, enraged: boolean): number {
  return (enraged ? dt * ENRAGE_RATE : dt) * TEMPESTLING.rate;
}

/** Split the body into two Tempestlings. Called once, from the stage 2 crack. */
function splitBody(w: World, id: number, bs: BossState): void {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const hp = w.hp[id] ?? 0;
  const r = tempestlingRadius(w.radius[id] ?? BOSS_TABLE.tempest.radius);
  dropMarker(w, bs);
  clearHazards(w); // the marker goes with the body
  for (let k = 0; k < MAX_PARTS; k++) bs.parts[k] = -1;
  removeEntity(w, id);
  bs.id = -1;
  bs.split = true;
  bs.open = false;
  bs.openLeft = -1;
  bs.mode = BossMode.Attacking;
  // The two spawn either side of the body along its lap, one ahead and one behind.
  const tan = bs.angle + Math.PI / 2;
  const off = r + 4;
  let made = 0;
  for (let k = 0; k < TEMPESTLING.count; k++) {
    const side = k === 0 ? 1 : -1;
    const px = x + Math.cos(tan) * off * side * bs.dir;
    const py = y + Math.sin(tan) * off * side * bs.dir;
    const p = spawnPart(w, bs, k, PartType.Tempestling, px, py, splitHp(hp, k, TEMPESTLING.count), r);
    if (p < 0) continue;
    made++;
    const o = k * SLOT;
    const ab = bs.abl;
    ab[o + MOVE] = TempestMove.Lap;
    ab[o + TIMER] = 0;
    ab[o + DASH] = dashEveryFor(bs.phase) - TEMPESTLING.firstDash;
    ab[o + SLIME] = 0;
    ab[o + ANGLE] = Math.atan2(w.y[p] ?? 0, w.x[p] ?? 0);
    ab[o + DIR] = k === 0 ? bs.dir : -bs.dir;
    ab[o + HEADING] = 0;
    ab[o + MARK] = -1;
    w.rot[p] = wrapPi((ab[o + ANGLE] ?? 0) + ((ab[o + DIR] ?? 1) * Math.PI) / 2);
  }
  bs.splitEv.parts = made;
  bus.emit('sim:bossSplit', bs.splitEv);
}

/** Core hook after the body took damage and lived: report the cracks, split once at stage 2. */
export function cracks(w: World, id: number, bs: BossState): void {
  crackBody(bs, 0, w.hp[id] ?? 0, bs.maxHp, w.x[id] ?? 0, w.y[id] ?? 0);
  if (!bs.split && (bs.crack[0] ?? 0) >= 2) splitBody(w, id, bs);
}

function slotOf(bs: BossState, id: number): number {
  for (let k = 0; k < TEMPESTLING.count; k++) if (bs.parts[k] === id) return k;
  return -1;
}

/**
 * One step of a Tempestling (Kind.BossPart, PartType.Tempestling): the body's lap, Slime trail,
 * marked wind up, dash and rest, on its own scratch slot, with its clocks at TEMPESTLING.rate.
 * Paused while the ship is down or the boss is staggered.
 */
export function stepTempestling(w: World, id: number, dt: number): void {
  const bs = bossOf(w);
  if (bs === null || bs.status !== 'alive' || !bs.split || !w.ship.active || bs.stagger > 0) return;
  const k = slotOf(bs, id);
  if (k < 0) return;
  const o = k * SLOT;
  const ab = bs.abl;
  const adt = tempestlingAdt(dt, bossEnraged(w));
  let state = (ab[o + MOVE] ?? 0) as TempestMove;
  if (state === TempestMove.Windup && !markerAlive(w, bs, ab[o + MARK] ?? -1)) {
    // The marker was cleared (bomb, ship death): no unmarked dash, back to the lap.
    state = TempestMove.Lap;
    ab[o + MOVE] = state;
    ab[o + MARK] = -1;
    ab[o + ANGLE] = Math.atan2(w.y[id] ?? 0, w.x[id] ?? 0);
  }
  if (state !== TempestMove.Rest && state !== TempestMove.Windup) {
    ab[o + SLIME] = (ab[o + SLIME] ?? 0) + adt;
    if ((ab[o + SLIME] ?? 0) >= TEMPEST.slimeEvery) {
      ab[o + SLIME] = (ab[o + SLIME] ?? 0) - TEMPEST.slimeEvery;
      dropTrail(w, id);
    }
  }
  if (state === TempestMove.Lap) {
    ab[o + ANGLE] = lapStep(w, id, ab[o + ANGLE] ?? 0, ab[o + DIR] ?? 1, dt);
    ab[o + DASH] = (ab[o + DASH] ?? 0) + adt;
    if ((ab[o + DASH] ?? 0) < dashEveryFor(bs.phase)) return;
    const heading = angleBetween(w, id, targetOf(w, id));
    const x = w.x[id] ?? 0;
    const y = w.y[id] ?? 0;
    const m = spawnLaneMarker(w, bs, x, y, heading, rayToWall(w, x, y, heading, w.radius[id] ?? 0), TEMPEST.markerHalfWidth);
    if (m < 0) return; // no marker (hazard cap): keep lapping and try next step
    ab[o + DASH] = 0;
    ab[o + HEADING] = heading;
    ab[o + MARK] = m;
    w.rot[id] = heading;
    ab[o + MOVE] = TempestMove.Windup;
    ab[o + TIMER] = hazardTelegraph(bs.row.tier);
    return;
  }
  const t = (ab[o + TIMER] ?? 0) - dt; // sim time: enrage never shortens the telegraph or the rest
  ab[o + TIMER] = t;
  if (state === TempestMove.Windup) {
    if (t > 0) return;
    const m = ab[o + MARK] ?? -1;
    if (markerAlive(w, bs, m)) removeEntity(w, m);
    ab[o + MARK] = -1;
    ab[o + MOVE] = TempestMove.Dash;
    ab[o + TIMER] = TEMPEST.dashSecMax;
    return;
  }
  if (state === TempestMove.Dash) {
    const v = TEMPEST.dashSpeed * dt;
    const h = ab[o + HEADING] ?? 0;
    const hit = moveToHit(w, id, (w.x[id] ?? 0) + Math.cos(h) * v, (w.y[id] ?? 0) + Math.sin(h) * v);
    if (hit || t <= 0) {
      ab[o + MOVE] = TempestMove.Rest;
      ab[o + TIMER] = TEMPEST.restSec;
    }
    return;
  }
  if (t > 0) return;
  ab[o + ANGLE] = Math.atan2(w.y[id] ?? 0, w.x[id] ?? 0);
  ab[o + MOVE] = TempestMove.Lap;
  ab[o + TIMER] = 0;
}

export const def: BossDef = { reset, step, onPhase, entryHome, cracks };
