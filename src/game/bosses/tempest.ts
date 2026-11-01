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
// ends with the second. GW3 ("smaller Tempests non threatening, abandon their dash, drift at the
// edge"): between dashes each chases a flank point TEMPESTLING.flankDist from the ship at
// TEMPESTLING.chaseSpeed, slot 0 on its own side of the ship and slot 1 on
// the opposite side, the point kept TEMPESTLING.wallKeep from every wall. Slot 0 leads a pincer:
// when its dash clock is due and the two are on opposite sides of the ship (or flankWait has run
// out) both wind up together, so their dash lines come from opposite sides. Every marker is followed
// by a committed dash through the ship at TEMPESTLING.dashSpeed (to the wall, at least dashMin long;
// the old code dropped the dash when the marker expired a hair before the wind up ended). Only a
// marker cleared early (bomb, ship death) sends the part back to its chase, so no dash is unmarked.
// Lays Slime, clocks at TEMPESTLING.rate. Move state TempestMove.Lap means the chase for a part.
// GW4 ("no dashing, just pursuing the ship"): the pincer came about every 9 s (the body's phase 3
// dashEvery of chase, then a 2.5 s flank wait that always ran out against a circling ship), and on an
// obstacle floor rayToWall's bisection could jump past an obstacle, so a marked dash stopped short.
// Now TEMPESTLING.dashEvery of chase, a 1 s flank wait, slot 0 waits for slot 1 to be back in its
// chase, rayToWall marches, and the wind up is TEMPESTLING.windupSec with its marker throughout.
// GW5 ("a little too easy", fairness 5, target 4): dash every TEMPESTLING.dashEvery (2.6 s), dash
// 10 percent faster, the chase speeds up from chaseSpeed to chaseSpeedMax as the part loses its hit
// points, and each dash ends with a fan of TEMPESTLING.fanCount bullets fired back along its path in
// the rest (only while the ship is at least ENEMY_BULLET_MIN_RANGE from the muzzle).
// Split scratch per slot k in bs.abl from k * SLOT: move state, its timer, dash clock, Slime clock,
// hit points at the split, fan pending (1) flag, dash heading, marker id.
import { bus } from '../../core/events';
import { confine, createConfineResult, isInside } from '../arena';
import { ENEMY_BULLET_RADIUS, spawnEnemyBullet } from '../enemyBullets';
import * as slime from '../enemies/slime';
import { removeEntity } from '../remove';
import { spawnFromDef } from '../state';
import { angleBetween, moveToHit, stepToward, targetOf } from '../steer';
import { Kind, type World } from '../world';
import { bossEnraged, clearHazards, crackBody, livePart, markerLife, spawnLaneMarker, spawnPart, wallDistance } from './core';
import { hazardTelegraph, pointDist, wrapPi } from './kit';
import { fanHeading, inShotRange } from './shots';
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

/** March step for rayToWall, u: thinner than any obstacle, so none is stepped over. */
export const RAY_STEP = 8;

/**
 * Distance from (x, y) along heading a to where a body of radius r first meets a wall or an
 * obstacle. GW4: it marches in RAY_STEP steps before refining, since a plain bisection could land
 * beyond an obstacle and promise a dash line the dash then stopped short of.
 */
export function rayToWall(w: World, x: number, y: number, a: number, r: number): number {
  const arena = w.level.arena;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const far = Math.hypot(arena.width, arena.height);
  let lo = 0;
  let hi = far;
  for (let d = RAY_STEP; d < far; d += RAY_STEP) {
    if (!isInside(arena, x + c * d, y + s * d, r)) {
      hi = d;
      break;
    }
    lo = d;
  }
  for (let i = 0; i < 12; i++) {
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
const HP0 = 4;
const FAN = 5;
const HEADING = 6;
const MARK = 7;

/** A marker gone with more wind up than this left was cleared early (bomb, ship death), not expired. */
export const MARKER_SLACK = 0.05;

/**
 * Pure: a Tempestling's chase speed, u/s, for the share of its split hit points it still holds:
 * chaseSpeed at full, chaseSpeedMax at none, linear between (GW5). Out of range shares clamp.
 */
export function tempestlingSpeed(hpShare = 1): number {
  const s = hpShare > 1 ? 1 : hpShare > 0 ? hpShare : 0;
  return TEMPESTLING.chaseSpeedMax + (TEMPESTLING.chaseSpeed - TEMPESTLING.chaseSpeedMax) * s;
}

/** Pure: the share of its split hit points a part holds (1 when the split value is unknown). */
export function hpShareOf(hp: number, hp0: number): number {
  if (!(hp0 > 0)) return 1;
  const s = hp / hp0;
  return s > 1 ? 1 : s > 0 ? s : 0;
}

/** Pure: the centre heading of the post dash fan: back along the dash path (GW5). */
export function fanCentre(dashHeading: number): number {
  return wrapPi(dashHeading + Math.PI);
}

/** Pure: the flank bearing from the ship for slot k, given slot 0's bearing: the two are opposite. */
export function flankBearing(bearing0: number, k: number): number {
  return k === 0 ? bearing0 : wrapPi(bearing0 + Math.PI);
}

/** Pure: true when a wind up with t seconds left lost its marker early (cleared, not expired). */
export function markerClearedEarly(t: number): boolean {
  return t > MARKER_SLACK;
}

/** Pure: chase seconds between a Tempestling's dashes (GW4: one value in every phase). */
export function tempestlingDashEvery(): number {
  return TEMPESTLING.dashEvery;
}

/** Pure: the dash clock at the split (both slots: slot 0 leads a pincer). */
export function firstDashClock(every: number): number {
  return every - TEMPESTLING.firstDash;
}

/** Pure: absolute angle between two bearings, in [0, pi]. */
export function bearingGap(a: number, b: number): number {
  return Math.abs(wrapPi(a - b));
}

/** Pure: a pincer may start: the two on opposite sides of the ship (gap over 90 degrees), or waited too long. */
export function pincerReady(gap: number, waited: number): boolean {
  return gap > Math.PI / 2 || waited >= TEMPESTLING.flankWait;
}

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
    ab[o + DASH] = firstDashClock(tempestlingDashEvery());
    ab[o + SLIME] = 0;
    ab[o + HP0] = w.hp[p] ?? 0;
    ab[o + FAN] = 0;
    ab[o + HEADING] = 0;
    ab[o + MARK] = -1;
    w.rot[p] = wrapPi(bs.angle + (side * bs.dir * Math.PI) / 2);
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

const flank = createConfineResult();

/** Bearing from the ship (target t) to part p, or 0 when they coincide. */
function bearingFrom(w: World, t: number, p: number): number {
  const dx = (w.x[p] ?? 0) - (w.x[t] ?? 0);
  const dy = (w.y[p] ?? 0) - (w.y[t] ?? 0);
  return dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx);
}

/** Pure: the i th axis try: 0, +1, -1, +2, -2 ... steps. */
export function axisStep(i: number): number {
  const j = (i + 1) >> 1;
  return i % 2 === 1 ? j : -j;
}

/**
 * The flank axis: the bearing from the ship (t) to part p0, turned in AXIS_STEP steps (nearest
 * first) until both flank points sit wallKeep inside the walls, so neither is clamped onto the
 * ship near a wall. The bearing itself when no turn fits.
 */
function flankAxis(w: World, t: number, p0: number): number {
  const arena = w.level.arena;
  const b0 = bearingFrom(w, t, p0);
  const sx = w.x[t] ?? 0;
  const sy = w.y[t] ?? 0;
  const f = TEMPESTLING.flankDist;
  const keep = TEMPESTLING.wallKeep;
  for (let i = 0; i < AXIS_TRIES; i++) {
    const b = b0 + axisStep(i) * AXIS_STEP;
    const c = Math.cos(b) * f;
    const s = Math.sin(b) * f;
    if (isInside(arena, sx + c, sy + s, keep) && isInside(arena, sx - c, sy - s, keep)) return b;
  }
  return b0;
}

const AXIS_STEP = Math.PI / 12;
const AXIS_TRIES = 13;

/**
 * Chase step: inside the wall band head straight out of it (nearest point wallKeep from the walls),
 * else toward the flank point on this slot's side of the ship, clamped wallKeep from the walls.
 */
function chase(w: World, bs: BossState, id: number, k: number, t: number, dt: number): void {
  const arena = w.level.arena;
  const keep = TEMPESTLING.wallKeep;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const step = tempestlingSpeed(hpShareOf(w.hp[id] ?? 0, bs.abl[k * SLOT + HP0] ?? 0)) * dt;
  const out = confine(arena, x, y, keep, flank);
  if (out.hit) {
    stepToward(w, id, out.x, out.y, step);
    return;
  }
  const p0 = livePart(w, bs, 0);
  const b = flankBearing(flankAxis(w, t, p0 > 0 ? p0 : id), p0 > 0 ? k : 0);
  const fx = (w.x[t] ?? 0) + Math.cos(b) * TEMPESTLING.flankDist;
  const fy = (w.y[t] ?? 0) + Math.sin(b) * TEMPESTLING.flankDist;
  const f = confine(arena, fx, fy, keep, flank);
  stepToward(w, id, f.x, f.y, step);
}

/**
 * Start part id (slot k)'s wind up at target t: a lane marker along the line through t to the wall.
 * False (no change) when that line is shorter than TEMPESTLING.dashMin or there is no marker.
 */
function windup(w: World, bs: BossState, id: number, k: number, t: number): boolean {
  const o = k * SLOT;
  const ab = bs.abl;
  const heading = angleBetween(w, id, t);
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const len = rayToWall(w, x, y, heading, w.radius[id] ?? 0);
  if (len < TEMPESTLING.dashMin) return false; // too short a line: keep chasing
  const m = spawnLaneMarker(w, bs, x, y, heading, len, TEMPEST.markerHalfWidth);
  if (m < 0) return false; // no marker (hazard cap): keep chasing
  // GW4: the marker shows for the whole wind up (TEMPESTLING.windupSec, longer than the tier telegraph).
  bs.hzTele[m] = TEMPESTLING.windupSec;
  bs.hzLife[m] = markerLife(TEMPESTLING.windupSec);
  ab[o + DASH] = 0;
  ab[o + HEADING] = heading;
  ab[o + MARK] = m;
  w.rot[id] = heading;
  ab[o + MOVE] = TempestMove.Windup;
  ab[o + TIMER] = TEMPESTLING.windupSec;
  return true;
}

function toChase(ab: Float64Array, o: number): void {
  ab[o + MOVE] = TempestMove.Lap;
  ab[o + MARK] = -1;
  ab[o + TIMER] = 0;
  ab[o + FAN] = 0;
}

const DEG = Math.PI / 180;

/**
 * GW5: part id's post dash fan, TEMPESTLING.fanCount bullets centred back along its dash heading,
 * charging for the tier telegraph at the body edge. False, firing nothing, while the ship is
 * within ENEMY_BULLET_MIN_RANGE of the muzzle (the rest rechecks every step). No allocation.
 */
export function fireDashFan(w: World, bs: BossState, id: number, dashHeading: number): boolean {
  const c = fanCentre(dashHeading);
  const r = w.radius[id] ?? 0;
  const bx = w.x[id] ?? 0;
  const by = w.y[id] ?? 0;
  let mx = bx + Math.cos(c) * r;
  let my = by + Math.sin(c) * r;
  if (!isInside(w.level.arena, mx, my, ENEMY_BULLET_RADIUS)) {
    mx = bx;
    my = by;
  }
  if (w.ship.active && !inShotRange(pointDist(mx, my, w.x[0] ?? 0, w.y[0] ?? 0))) return false;
  const tier = bs.row.tier;
  const tele = hazardTelegraph(tier);
  const n = TEMPESTLING.fanCount;
  const spread = TEMPESTLING.fanSpreadDeg * DEG;
  let firstId = -1;
  for (let k = 0; k < n; k++) {
    const b = spawnEnemyBullet(w, mx, my, fanHeading(c, k, n, spread), TEMPESTLING.fanSpeed, ENEMY_BULLET_RADIUS, tier, tele);
    if (firstId < 0) firstId = b;
  }
  if (firstId >= 0) {
    bs.shotId = firstId;
    bs.shotEv.x = mx;
    bs.shotEv.y = my;
  }
  return true;
}

/**
 * One step of a Tempestling (Kind.BossPart, PartType.Tempestling): chase its flank point, Slime
 * trail, marked wind up, committed dash and rest, on its own scratch slot, its clocks at
 * TEMPESTLING.rate. Paused while the ship is down or the boss is staggered.
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
  if (state === TempestMove.Windup && !markerAlive(w, bs, ab[o + MARK] ?? -1) && markerClearedEarly(ab[o + TIMER] ?? 0)) {
    // The marker was cleared (bomb, ship death): no unmarked dash, back to the chase.
    toChase(ab, o);
    state = TempestMove.Lap;
  }
  if (state !== TempestMove.Rest && state !== TempestMove.Windup) {
    ab[o + SLIME] = (ab[o + SLIME] ?? 0) + adt;
    if ((ab[o + SLIME] ?? 0) >= TEMPEST.slimeEvery) {
      ab[o + SLIME] = (ab[o + SLIME] ?? 0) - TEMPEST.slimeEvery;
      dropTrail(w, id);
    }
  }
  if (state === TempestMove.Lap) {
    const tgt = targetOf(w, id);
    chase(w, bs, id, k, tgt, dt);
    ab[o + DASH] = (ab[o + DASH] ?? 0) + adt;
    const due = (ab[o + DASH] ?? 0) - tempestlingDashEvery();
    if (due < 0) return;
    const other = livePart(w, bs, 1 - k);
    if (other > 0 && k === 1) {
      // Slot 0 leads the pincer while it lives; slot 1 goes alone only when it missed one (a short
      // line) and slot 0 is busy with its own dash.
      if ((ab[MOVE] ?? 0) !== TempestMove.Lap) windup(w, bs, id, 1, tgt);
      return;
    }
    if (other > 0) {
      // The pincer: both wind up together from opposite sides of the ship, once in position. GW4:
      // slot 0 waits for slot 1 to finish its own dash and rest first, so neither misses a pincer.
      if ((ab[SLOT + MOVE] ?? 0) !== TempestMove.Lap) return;
      const gap = bearingGap(bearingFrom(w, tgt, id), bearingFrom(w, tgt, other));
      if (!pincerReady(gap, due)) return;
      if (!windup(w, bs, id, 0, tgt)) return;
      if ((ab[SLOT + MOVE] ?? 0) === TempestMove.Lap) windup(w, bs, other, 1, tgt); // a short line skips this pincer
      return;
    }
    windup(w, bs, id, k, tgt);
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
    const v = TEMPESTLING.dashSpeed * dt;
    const h = ab[o + HEADING] ?? 0;
    const hit = moveToHit(w, id, (w.x[id] ?? 0) + Math.cos(h) * v, (w.y[id] ?? 0) + Math.sin(h) * v);
    if (hit || t <= 0) {
      ab[o + MOVE] = TempestMove.Rest;
      ab[o + TIMER] = TEMPESTLING.restSec;
      ab[o + FAN] = 1;
      if (fireDashFan(w, bs, id, h)) ab[o + FAN] = 0;
    }
    return;
  }
  if ((ab[o + FAN] ?? 0) === 1 && fireDashFan(w, bs, id, ab[o + HEADING] ?? 0)) ab[o + FAN] = 0;
  if (t > 0) return;
  toChase(ab, o);
}

export const def: BossDef = { reset, step, onPhase, entryHome, cracks };
