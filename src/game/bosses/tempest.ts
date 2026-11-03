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
// GW6 ("dash in a clumsy manner that is not threatening", "get stuck sometimes", fairness 5, target
// 4): each dash aims at the ship's lead point (ship plus velocity times the dash travel time and the
// wind up left, clamped to the arena); the aim and its marker track through a TEMPESTLING.windupSec
// (0.5 s) wind up and lock at its end. Lines stop with the body edge TEMPESTLING.wallClip from the
// walls. In the rest the part turns to face the ship within TEMPESTLING.turnSec. Slot 1 flanks a
// quarter turn from slot 0 and in a pincer aims TEMPESTLING.cutOff across slot 0's line on the
// ship's sidestep side. Unstuck: near a wall or obstacle (nearWall) for nearSec, or under stuckMove
// moved over a stuckWindow of chase, it steers to the centre for unstuckSec; inside the wall band it
// also heads centreward. A part on the band edge froze before (float32 positions); BAND_EPS fixes it.
// Split scratch per slot k in bs.abl from k * SLOT: move state, its timer, dash clock, Slime clock,
// hit points at the split, fan pending (1) flag, dash heading, marker id, then (GW6) locked line
// length, aim point x and y, near wall seconds, move window clock, window anchor x and y, unstuck
// clock, pincer pair flag.
import { bus } from '../../core/events';
import { confine, createConfineResult, isInside } from '../arena';
import { ENEMY_BULLET_RADIUS, spawnEnemyBullet } from '../enemyBullets';
import * as slime from '../enemies/slime';
import { removeEntity } from '../remove';
import { spawnFromDef } from '../state';
import { angleBetween, moveToHit, stepToward, targetOf } from '../steer';
import { Kind, type World } from '../world';
import { bossEnraged, clearHazards, crackBody, livePart, markerLife, spawnLaneMarker, spawnPart, wallDistance } from './core';
import { pointDist, wrapPi } from './kit';
import { bossTele } from './scale';
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
  setMove(bs, TempestMove.Windup, bossTele(bs));
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

/** Scratch slots per Tempestling in bs.abl, and their offsets (GW6: 20, 8 before; 0 to 7 kept). */
export const SLOT = 20;
const MOVE = 0;
const TIMER = 1;
const DASH = 2;
const SLIME = 3;
const HP0 = 4;
const FAN = 5;
const HEADING = 6;
const MARK = 7;
const LEN = 8;
const AIMX = 9;
const AIMY = 10;
const NEAR = 11;
const WIN = 12;
const ANCX = 13;
const ANCY = 14;
const UNSTUCK = 15;
const PAIR = 16;

/** Offsets inside a Tempestling's scratch slot, for tests and tools (read only). */
export const TEMPESTLING_SLOT = { move: MOVE, timer: TIMER, dash: DASH, heading: HEADING, mark: MARK, len: LEN, aimX: AIMX, aimY: AIMY, near: NEAR, win: WIN, ancX: ANCX, ancY: ANCY, unstuck: UNSTUCK, pair: PAIR } as const;

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

/**
 * Pure: the flank bearing from the ship for slot k, given slot 0's bearing. GW6: slot 1 sits a
 * quarter turn from slot 0 on side (+1 or -1), so its dash line crosses slot 0's at right angles
 * and a sidestep from one runs into the other (opposite before).
 */
export function flankBearing(bearing0: number, k: number, side = 1): number {
  return k === 0 ? bearing0 : wrapPi(bearing0 + (side < 0 ? -1 : 1) * (Math.PI / 2));
}

/** Pure: the quarter turn side (+1 or -1) of slot 0's bearing b0 nearer to slot 1's bearing b1. */
export function flankSide(b0: number, b1: number): number {
  return wrapPi(b1 - b0) >= 0 ? 1 : -1;
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

/**
 * Pure: a pincer may start: the two about a quarter turn apart around the ship (GW6: gap within
 * 45 degrees of 90; over 90 before), or the pincer waited too long. Slot 1 aims at the cut off
 * point beside slot 0's aim, so a sidestep from slot 0's line runs into its line at any gap.
 */
export function pincerReady(gap: number, waited: number): boolean {
  return Math.abs(gap - Math.PI / 2) <= Math.PI / 4 || waited >= TEMPESTLING.flankWait;
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

/** A point (reused, never allocated per step). */
export interface AimPoint {
  x: number;
  y: number;
}

export function createAimPoint(): AimPoint {
  return { x: 0, y: 0 };
}

/**
 * Pure: GW6 lead aim. Where a ship at (sx, sy) moving at (vx, vy) will be when a dash from (px, py)
 * at speed reaches it, extra seconds from now (the wind up left): ship plus velocity times (extra
 * plus the travel time), solved by a few fixed point passes. Writes out and returns it.
 */
export function leadPoint(px: number, py: number, sx: number, sy: number, vx: number, vy: number, speed: number, extra: number, out: AimPoint): AimPoint {
  const sp = speed > 1 ? speed : 1;
  const e = extra > 0 ? extra : 0;
  let tx = sx;
  let ty = sy;
  for (let i = 0; i < LEAD_PASSES; i++) {
    const t = e + Math.hypot(tx - px, ty - py) / sp;
    tx = sx + vx * t;
    ty = sy + vy * t;
  }
  out.x = tx;
  out.y = ty;
  return out;
}

const LEAD_PASSES = 12;

/** leadPoint clamped to the arena: the point kept margin from every wall and obstacle. */
export function leadAim(arena: World['level']['arena'], px: number, py: number, sx: number, sy: number, vx: number, vy: number, speed: number, extra: number, margin: number, out: AimPoint): AimPoint {
  leadPoint(px, py, sx, sy, vx, vy, speed, extra, out);
  const c = confine(arena, out.x, out.y, margin, aimClamp);
  out.x = c.x;
  out.y = c.y;
  return out;
}

const aimClamp = createConfineResult();

/**
 * Pure: GW6 cut off side, +1 or -1: which side of slot 0's line (heading h0) slot 1 aims at. The
 * side the ship moves toward across the line (velocity vx, vy) when that speed is at least
 * sidestepMin, else the side slot 1 stands on (offset dx, dy from slot 0's aim point).
 */
export function cutOffSide(h0: number, vx: number, vy: number, dx: number, dy: number): number {
  const nx = -Math.sin(h0);
  const ny = Math.cos(h0);
  const side = vx * nx + vy * ny;
  if (Math.abs(side) >= TEMPESTLING.sidestepMin) return side > 0 ? 1 : -1;
  return dx * nx + dy * ny >= 0 ? 1 : -1;
}

/** Pure: GW6 cut off point: cutOff to side (+1 or -1) of slot 0's aim (ax, ay) across heading h0. */
export function cutOffPoint(ax: number, ay: number, h0: number, side: number, out: AimPoint): AimPoint {
  const s = side < 0 ? -1 : 1;
  out.x = ax - Math.sin(h0) * TEMPESTLING.cutOff * s;
  out.y = ay + Math.cos(h0) * TEMPESTLING.cutOff * s;
  return out;
}

/** Pure: turn heading cur toward target by at most maxStep radians (the short way round). */
export function turnToward(cur: number, target: number, maxStep: number): number {
  const d = wrapPi(target - cur);
  const m = maxStep > 0 ? maxStep : 0;
  if (Math.abs(d) <= m) return wrapPi(target);
  return wrapPi(cur + (d > 0 ? m : -m));
}

/**
 * Pure: GW6 turn rate after a dash, rad/s: a half turn in two thirds of TEMPESTLING.turnSec, so the
 * part faces the ship within turnSec even while the ship crosses its view.
 */
export function turnRate(): number {
  return (1.5 * Math.PI) / TEMPESTLING.turnSec;
}

/**
 * Pure: GW6 unstuck rule. near is the seconds the part has stood within TEMPESTLING.nearWall of a
 * wall or obstacle; moved the distance it covered over the last chase window, or a negative value
 * while that window is still open. True when it should steer to the centre.
 */
export function unstuckDue(near: number, moved: number): boolean {
  return near >= TEMPESTLING.nearSec || (moved >= 0 && moved < TEMPESTLING.stuckMove);
}

/** Pure: the dash line clip radius for a part of radius r: the body edge keeps wallClip from walls. */
export function clipRadius(r: number): number {
  return r + TEMPESTLING.wallClip;
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
    for (let j = 0; j < SLOT; j++) ab[o + j] = 0;
    ab[o + MOVE] = TempestMove.Lap;
    ab[o + DASH] = firstDashClock(tempestlingDashEvery());
    ab[o + HP0] = w.hp[p] ?? 0;
    ab[o + MARK] = -1;
    ab[o + ANCX] = w.x[p] ?? 0;
    ab[o + ANCY] = w.y[p] ?? 0;
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
 * The flank axis: bearing b0 from the ship (t), turned in AXIS_STEP steps (nearest first) until slot
 * 0's flank point, and slot 1's a quarter turn on side (none when side is 0), sit wallKeep inside the
 * walls, so neither is clamped onto the ship near a wall. b0 itself when no turn fits.
 */
function flankAxis(w: World, t: number, b0: number, side: number): number {
  const arena = w.level.arena;
  const sx = w.x[t] ?? 0;
  const sy = w.y[t] ?? 0;
  const f = TEMPESTLING.flankDist;
  const keep = TEMPESTLING.wallKeep;
  for (let i = 0; i < AXIS_TRIES; i++) {
    const b = b0 + axisStep(i) * AXIS_STEP;
    if (!isInside(arena, sx + Math.cos(b) * f, sy + Math.sin(b) * f, keep)) continue;
    if (side === 0) return b;
    const b1 = flankBearing(b, 1, side);
    if (isInside(arena, sx + Math.cos(b1) * f, sy + Math.sin(b1) * f, keep)) return b;
  }
  return b0;
}

/** GW6: band exits shorter than this (u) count as already out (float32 positions). */
export const BAND_EPS = 0.5;

/** GW6: while unsticking a part steers to a point this far toward the arena centre. */
const UNSTUCK_LOOK = 200;

const AXIS_STEP = Math.PI / 12;
const AXIS_TRIES = 13;

/**
 * Chase step. GW6: while unsticking or inside the wall band (wallKeep), toward the arena centre
 * (kept clear of obstacles). Else toward the flank point for this slot (slot 1 a quarter turn from
 * slot 0), clamped wallKeep from the walls.
 */
function chase(w: World, bs: BossState, id: number, k: number, t: number, dt: number): void {
  const arena = w.level.arena;
  const keep = TEMPESTLING.wallKeep;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const step = tempestlingSpeed(hpShareOf(w.hp[id] ?? 0, bs.abl[k * SLOT + HP0] ?? 0)) * dt;
  const out = confine(arena, x, y, keep, flank);
  // GW6: a part on the band edge (exit under BAND_EPS away) is out of the band. Positions are
  // float32: an exit step of a hair rounded back to the same spot, so the part froze there for good.
  const inBand = out.hit && Math.hypot(out.x - x, out.y - y) > BAND_EPS;
  if ((bs.abl[k * SLOT + UNSTUCK] ?? 0) > 0 || inBand) {
    // Unsticking, or inside the wall band (GW6: the nearest band exit before, which crawled along a
    // wall in the gap between a wall and an obstacle): toward the centre, at a point UNSTUCK_LOOK on
    // the way there pushed wallKeep clear of the walls and obstacles, so the path does not hug one.
    const cx = -x;
    const cy = -y;
    const d = Math.hypot(cx, cy);
    const look = d > UNSTUCK_LOOK ? UNSTUCK_LOOK / d : 1;
    const c = confine(arena, x + cx * look, y + cy * look, keep, flank);
    stepToward(w, id, c.x, c.y, step);
    return;
  }
  const p0 = livePart(w, bs, 0);
  const p1 = livePart(w, bs, 1);
  let b: number;
  if (p0 > 0 && p1 > 0) {
    const b0 = bearingFrom(w, t, p0);
    const side = flankSide(b0, bearingFrom(w, t, p1));
    b = flankBearing(flankAxis(w, t, b0, side), k, side);
  } else {
    b = flankAxis(w, t, bearingFrom(w, t, id), 0);
  }
  const fx = (w.x[t] ?? 0) + Math.cos(b) * TEMPESTLING.flankDist;
  const fy = (w.y[t] ?? 0) + Math.sin(b) * TEMPESTLING.flankDist;
  const f = confine(arena, fx, fy, keep, flank);
  stepToward(w, id, f.x, f.y, step);
}

/**
 * GW6 unstuck bookkeeping, every step: the near wall seconds (any state), and in the chase the
 * movement window and the unstuck clock. Outside the chase the window restarts where the part stands.
 */
function trackStuck(w: World, bs: BossState, id: number, o: number, state: TempestMove, dt: number): void {
  const ab = bs.abl;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  ab[o + NEAR] = isInside(w.level.arena, x, y, TEMPESTLING.nearWall) ? 0 : (ab[o + NEAR] ?? 0) + dt;
  if (state !== TempestMove.Lap) {
    ab[o + WIN] = 0;
    ab[o + ANCX] = x;
    ab[o + ANCY] = y;
    ab[o + UNSTUCK] = 0;
    return;
  }
  const u = (ab[o + UNSTUCK] ?? 0) - dt;
  ab[o + UNSTUCK] = u > 0 ? u : 0;
  const win = (ab[o + WIN] ?? 0) + dt;
  let moved = -1;
  if (win >= TEMPESTLING.stuckWindow) {
    moved = Math.hypot(x - (ab[o + ANCX] ?? 0), y - (ab[o + ANCY] ?? 0));
    ab[o + ANCX] = x;
    ab[o + ANCY] = y;
    ab[o + WIN] = 0;
  } else {
    ab[o + WIN] = win;
  }
  if (u <= 0 && unstuckDue(ab[o + NEAR] ?? 0, moved)) ab[o + UNSTUCK] = TEMPESTLING.unstuckSec;
}

const aim = createAimPoint();

/**
 * GW6: aim part id (slot k) for a dash at target t with extra seconds of wind up left. Slot 0, or a
 * part winding up alone, aims at the ship's lead point; slot 1 in a pincer aims at the cut off point
 * beside slot 0's aim (still tracking in its wind up, or locked in its dash), so its line covers the
 * sidestep out of slot 0's. Writes the heading, the line length (clipped clipRadius from
 * the walls) and the aim point; turns the part and its marker (when alive) to the line.
 */
function aimDash(w: World, bs: BossState, id: number, k: number, t: number, extra: number): void {
  const o = k * SLOT;
  const ab = bs.abl;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const r = w.radius[id] ?? 0;
  const p0 = k === 1 && (ab[o + PAIR] ?? 0) === 1 ? livePart(w, bs, 0) : -1;
  const m0 = ab[MOVE] ?? 0;
  if (p0 > 0 && (m0 === TempestMove.Windup || m0 === TempestMove.Dash)) {
    const ax = ab[AIMX] ?? 0;
    const ay = ab[AIMY] ?? 0;
    const h0 = ab[HEADING] ?? 0;
    cutOffPoint(ax, ay, h0, cutOffSide(h0, w.vx[t] ?? 0, w.vy[t] ?? 0, x - ax, y - ay), aim);
    const c = confine(w.level.arena, aim.x, aim.y, clipRadius(r), aimClamp);
    aim.x = c.x;
    aim.y = c.y;
  } else {
    leadAim(w.level.arena, x, y, w.x[t] ?? 0, w.y[t] ?? 0, w.vx[t] ?? 0, w.vy[t] ?? 0, TEMPESTLING.dashSpeed, extra, clipRadius(r), aim);
  }
  const dx = aim.x - x;
  const dy = aim.y - y;
  const heading = dx * dx + dy * dy > 1e-6 ? Math.atan2(dy, dx) : (ab[o + HEADING] ?? 0);
  ab[o + HEADING] = heading;
  ab[o + LEN] = rayToWall(w, x, y, heading, clipRadius(r));
  ab[o + AIMX] = aim.x;
  ab[o + AIMY] = aim.y;
  w.rot[id] = heading;
  const m = ab[o + MARK] ?? -1;
  if (markerAlive(w, bs, m)) {
    w.rot[m] = heading;
    w.vx[m] = ab[o + LEN] ?? 0;
  }
}

/**
 * Start part id (slot k)'s wind up at target t: a lane marker along its aimed line. False (no
 * change) when that line is shorter than TEMPESTLING.dashMin or there is no marker.
 */
function windup(w: World, bs: BossState, id: number, k: number, t: number, pair = false): boolean {
  const o = k * SLOT;
  const ab = bs.abl;
  const keepHeading = ab[o + HEADING] ?? 0;
  ab[o + MARK] = -1;
  ab[o + PAIR] = pair ? 1 : 0;
  aimDash(w, bs, id, k, t, TEMPESTLING.windupSec);
  const len = ab[o + LEN] ?? 0;
  const heading = ab[o + HEADING] ?? 0;
  if (len < TEMPESTLING.dashMin) {
    ab[o + HEADING] = keepHeading;
    return false; // too short a line: keep chasing
  }
  const m = spawnLaneMarker(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, heading, len, TEMPEST.markerHalfWidth);
  if (m < 0) {
    ab[o + HEADING] = keepHeading;
    return false; // no marker (hazard cap): keep chasing
  }
  // GW4: the marker shows for the whole wind up (TEMPESTLING.windupSec).
  bs.hzTele[m] = TEMPESTLING.windupSec;
  bs.hzLife[m] = markerLife(TEMPESTLING.windupSec);
  ab[o + DASH] = 0;
  ab[o + MARK] = m;
  ab[o + MOVE] = TempestMove.Windup;
  ab[o + TIMER] = TEMPESTLING.windupSec;
  ab[o + UNSTUCK] = 0;
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
  const tele = bossTele(bs);
  const n = TEMPESTLING.fanCount;
  const spread = TEMPESTLING.fanSpreadDeg * DEG;
  let firstId = -1;
  for (let k = 0; k < n; k++) {
    const b = spawnEnemyBullet(w, mx, my, fanHeading(c, k, n, spread), TEMPESTLING.fanSpeed * bs.levelScale, ENEMY_BULLET_RADIUS, tier, tele);
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
 * trail, marked wind up with a tracking lead aim, a dash along the line locked at the wind up end,
 * a rest that turns to face the ship, and the unstuck rule, on its own scratch slot, its clocks at
 * TEMPESTLING.rate. Paused while the ship is down or the boss is staggered.
 */
export function stepTempestling(w: World, id: number, dt: number): void {
  const bs = bossOf(w);
  if (bs === null || bs.status !== 'alive' || !bs.split || !w.ship.active || bs.stagger > 0) return;
  const k = slotOf(bs, id);
  if (k < 0) return;
  const o = k * SLOT;
  const ab = bs.abl;
  const adt = tempestlingAdt(dt, bossEnraged(w)) * bs.cadence;
  let state = (ab[o + MOVE] ?? 0) as TempestMove;
  if (state === TempestMove.Windup && !markerAlive(w, bs, ab[o + MARK] ?? -1) && markerClearedEarly(ab[o + TIMER] ?? 0)) {
    // The marker was cleared (bomb, ship death): no unmarked dash, back to the chase.
    toChase(ab, o);
    state = TempestMove.Lap;
  }
  trackStuck(w, bs, id, o, state, dt);
  if (state !== TempestMove.Rest && state !== TempestMove.Windup) {
    ab[o + SLIME] = (ab[o + SLIME] ?? 0) + adt;
    if ((ab[o + SLIME] ?? 0) >= TEMPEST.slimeEvery) {
      ab[o + SLIME] = (ab[o + SLIME] ?? 0) - TEMPEST.slimeEvery;
      dropTrail(w, id);
    }
  }
  const tgt = targetOf(w, id);
  if (state === TempestMove.Lap) {
    chase(w, bs, id, k, tgt, dt);
    ab[o + DASH] = (ab[o + DASH] ?? 0) + adt;
    const due = (ab[o + DASH] ?? 0) - tempestlingDashEvery();
    if (due < 0 || (ab[o + UNSTUCK] ?? 0) > 0) return; // GW6: no wind up while unsticking
    const other = livePart(w, bs, 1 - k);
    if (other > 0 && k === 1) {
      // Slot 0 leads the pincer while it lives; slot 1 goes alone only when it missed one (a short
      // line) and slot 0 is busy with its own dash.
      if ((ab[MOVE] ?? 0) !== TempestMove.Lap) windup(w, bs, id, 1, tgt);
      return;
    }
    if (other > 0) {
      // The pincer: both wind up together, a quarter turn apart around the ship, once in position.
      // GW4: slot 0 waits for slot 1 to finish its own dash and rest (GW6: and its unstick) first.
      if ((ab[SLOT + MOVE] ?? 0) !== TempestMove.Lap || (ab[SLOT + UNSTUCK] ?? 0) > 0) return;
      const gap = bearingGap(bearingFrom(w, tgt, id), bearingFrom(w, tgt, other));
      if (!pincerReady(gap, due)) return;
      if (!windup(w, bs, id, 0, tgt)) return;
      if ((ab[SLOT + MOVE] ?? 0) === TempestMove.Lap) windup(w, bs, other, 1, tgt, true); // a short line skips this pincer
      return;
    }
    windup(w, bs, id, k, tgt);
    return;
  }
  const t = (ab[o + TIMER] ?? 0) - dt; // sim time: enrage never shortens the telegraph or the rest
  ab[o + TIMER] = t;
  if (state === TempestMove.Windup) {
    // GW6: the aim tracks the lead point; the last aim, at the wind up end, is the locked line.
    aimDash(w, bs, id, k, tgt, t > 0 ? t : 0);
    if (t > 0) return;
    const m = ab[o + MARK] ?? -1;
    if (markerAlive(w, bs, m)) removeEntity(w, m);
    ab[o + MARK] = -1;
    ab[o + MOVE] = TempestMove.Dash;
    ab[o + TIMER] = TEMPEST.dashSecMax;
    return;
  }
  if (state === TempestMove.Dash) {
    const left = ab[o + LEN] ?? 0;
    const full = TEMPESTLING.dashSpeed * dt;
    const v = full < left ? full : left > 0 ? left : 0;
    const h = ab[o + HEADING] ?? 0;
    const hit = moveToHit(w, id, (w.x[id] ?? 0) + Math.cos(h) * v, (w.y[id] ?? 0) + Math.sin(h) * v);
    ab[o + LEN] = left - v;
    if (hit || left - v <= 1e-6 || t <= 0) {
      ab[o + MOVE] = TempestMove.Rest;
      ab[o + TIMER] = TEMPESTLING.restSec;
      ab[o + FAN] = 1;
      if (fireDashFan(w, bs, id, h)) ab[o + FAN] = 0;
      w.rot[id] = turnToward(h, angleBetween(w, id, tgt), turnRate() * dt);
    }
    return;
  }
  // Rest: GW6 turns sharply back to face the ship (any turn within TEMPESTLING.turnSec).
  w.rot[id] = turnToward(w.rot[id] ?? 0, angleBetween(w, id, tgt), turnRate() * dt);
  if ((ab[o + FAN] ?? 0) === 1 && fireDashFan(w, bs, id, ab[o + HEADING] ?? 0)) ab[o + FAN] = 0;
  if (t > 0) return;
  toChase(ab, o);
}

export const def: BossDef = { reset, step, onPhase, entryHome, cracks };
