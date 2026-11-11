// Ember (tier 2, orange, level 20; docs/12 roster row 4). The body is the weapon. Cycle: wind up
// 0.9 s turning toward its target, the heading locks when the lane marker shows (the last 0.8 s,
// the tier telegraph, never shortened), then a 0.6 s dash at 760 u/s that drops a Mine every 120 u
// (the Mine rules and caps: 6 per owner, 24 in total) and bounces off up to two walls. A dash that
// touched a wall ends in a 2 s stun (a third wall stuns at once); a dash that ends in open floor
// ends in a 1.2 s rest. It is hittable only stunned or resting. Each phase is 15 percent faster:
// dash speed times 1.15^(phase - 1), wind up, dash and rest times divided by it (the wind up never
// under the telegraph). Fan (BOSS_SHOTS.ember, docs/13 boss projectiles): after a dash that ends
// in open floor the rest grows to 1.8 s and three bullets 14 deg apart, the middle one at its
// target, charge from the rest start and launch 0.8 s in. The fan waits and rechecks every 0.3 s
// while the ship is within 300 u of the muzzle, and is skipped if it could no longer launch inside
// the rest. A wall hit stuns with no fan. Scratch: n0 move state, t3 state seconds left, dir dash
// heading, n1 bounces used, t1 1 when this dash touched a wall, t0 dash distance since the last
// Mine, n2 marker id, t2 1 while this rest still owes its fan, shotWait the fan recheck.
//
// Leavers (fury two, EMBER_LEAVERS): every stun releases 2 Leavers at the body, enraged as a
// membrane crossing would (World.enraged, 'sim:enrage'), at most 4 Ember Leavers alive, through the
// add slots and maxLiveEnemies (each spawns with the normal 0.6 s telegraph).
// Fury (shared, fury.ts): at the stage 1 crack Ember breaks (stands still, marker gone, core
// closed, no damage, FURY_BREAK_SEC), phase 2 starts there, then it is enraged to its death
// (EMBER_FURY): dash speed x1.2, up to 3 wall bounces, 3 Leavers per stun.
import { confineOn, createConfineResult } from '../arena';
import { bus } from '../../core/events';
import { dropMine } from '../enemies/mine';
import { def as leaverDef } from '../enemies/leaver';
import { removeEntity } from '../remove';
import { angleBetween, targetOf, turnToward } from '../steer';
import { Kind, type World } from '../world';
import { spawnAdd, spawnLaneMarker } from './core';
import { furyClampDamage, furyDue, furyOnPhase, furyPhaseOf, startFuryBreak, stepFury } from './fury';
import { hazardTelegraph, phaseSpeedUp, reflectHeading } from './kit';
import { bossTele } from './scale';
import { fireVolley } from './shots';
import type { BossState } from './state';
import { BOSS_SHOTS, EMBER, EMBER_FURY, EMBER_LEAVERS, emberFanRest, MAX_ADDS, SHOT_RECHECK_SEC } from './table';
import { BossMode, type BossDef } from './types';

/** Move states (BossState.n0). */
export const enum EmberMove {
  Windup = 0,
  Dash = 1,
  Rest = 2,
  Stun = 3,
}

/** The marker ends just before its telegraph does; inside this tail its absence is expected. */
const MARKER_GRACE = 0.05;
const res = createConfineResult();
const enrageFx = { id: 0, x: 0, y: 0 };
/** Angle between neighbouring Leavers of one release, radians. */
const LEAVER_FAN = Math.PI / 4;

/** Pure: the phase speed factor (1, 1.15, 1.3225). */
export function speedFor(phase: number): number {
  return phaseSpeedUp(EMBER.speedUp, phase);
}

/** Pure: wind up seconds in a phase, never under the tier telegraph (times teleScale, R1 Insane). */
export function windupFor(phase: number, tier: number, teleScale = 1): number {
  const t = EMBER.windupSec / speedFor(phase);
  const tele = hazardTelegraph(tier) * teleScale;
  return t > tele ? t : tele;
}

/** Pure: dash speed in a phase and fury stage (enraged: EMBER_FURY.dashSpeedMul), u/s. */
export function dashSpeedFor(phase: number, fury = 0): number {
  const v = EMBER.dashSpeed * speedFor(phase);
  return fury >= 2 ? v * EMBER_FURY.dashSpeedMul : v;
}

/** Pure: wall bounces a dash may take in a fury stage. */
export function bouncesFor(fury: number): number {
  return fury >= 2 ? EMBER_FURY.bounces : EMBER.bounces;
}

/** Pure: Leavers one stun releases in a fury stage. */
export function leaversPerStun(fury: number): number {
  return fury >= 2 ? EMBER_FURY.leaversPerStun : EMBER_LEAVERS.perStun;
}

/** Pure: Leavers a stun may release with live Ember Leavers already alive (the cap holds). */
export function leaversToRelease(fury: number, live: number): number {
  const room = EMBER_LEAVERS.cap - (live > 0 ? live : 0);
  const n = leaversPerStun(fury);
  return room <= 0 ? 0 : n < room ? n : room;
}

/** Pure: dash seconds in a phase (the dash length stays 456 u). */
export function dashSecFor(phase: number): number {
  return EMBER.dashSec / speedFor(phase);
}

/** Pure: rest seconds in a phase, for a rest of base seconds. */
export function restFor(phase: number, base: number): number {
  return base / speedFor(phase);
}

/** Pure: the counter window, open only stunned or resting. */
export function isOpen(state: number): boolean {
  return state === EmberMove.Rest || state === EmberMove.Stun;
}

function markerLive(w: World, bs: BossState): boolean {
  const m = bs.n2;
  return m > 0 && w.alive[m] === 1 && w.kind[m] === Kind.BossHazard && bs.hzMarker[m] === 1;
}

function dropMarker(w: World, bs: BossState): void {
  if (markerLive(w, bs)) removeEntity(w, bs.n2);
  bs.n2 = -1;
}

function setMove(bs: BossState, state: EmberMove, t: number): void {
  bs.n0 = state;
  bs.t3 = t;
}

/** Lock the heading on the target and show the marker. False when no marker could be placed. */
function lockOn(w: World, id: number, bs: BossState): boolean {
  const heading = angleBetween(w, id, targetOf(w, id));
  const length = dashSpeedFor(bs.phase, bs.fury) * dashSecFor(bs.phase) + (w.radius[id] ?? 0);
  const m = spawnLaneMarker(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, heading, length, EMBER.markerHalfWidth);
  if (m < 0) return false;
  bs.n2 = m;
  bs.dir = heading;
  w.rot[id] = heading;
  return true;
}

function startWindup(bs: BossState, extra: number): void {
  bs.n2 = -1;
  setMove(bs, EmberMove.Windup, extra + windupFor(bs.phase, bs.row.tier, bs.teleScale));
}

/** Called when a dash ends. wall: the dash touched a wall (stun, no fan); else rest, with the fan if its row exists. */
function endDash(w: World, id: number, bs: BossState, wall: boolean): void {
  bs.shotWait = 0;
  if (wall) {
    bs.t2 = 0;
    setMove(bs, EmberMove.Stun, EMBER.stunSec);
    releaseLeavers(w, id, bs);
    return;
  }
  const fan = BOSS_SHOTS.ember !== undefined;
  bs.t2 = fan ? 1 : 0;
  setMove(bs, EmberMove.Rest, restFor(bs.phase, fan ? emberFanRest() : EMBER.restSec));
}

/** Live Leavers this boss summoned (its add slots). */
export function emberLeavers(w: World, bs: BossState): number {
  let n = 0;
  for (let i = 0; i < MAX_ADDS; i++) {
    const a = bs.addIds[i] ?? -1;
    if (a > 0 && w.alive[a] === 1 && w.kind[a] === Kind.Leaver && bs.addKind[i] === Kind.Leaver) n++;
  }
  return n;
}

/**
 * A stun: enraged Leavers fan out from the body toward the arena centre, as many as the cap, the
 * add slots and maxLiveEnemies allow. Returns the number released.
 */
export function releaseLeavers(w: World, id: number, bs: BossState): number {
  const n = leaversToRelease(bs.fury, emberLeavers(w, bs));
  if (n <= 0) return 0;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const d = (w.radius[id] ?? 0) + EMBER_LEAVERS.spawnPad + leaverDef.radius;
  const base = Math.atan2(-y, -x);
  let made = 0;
  for (let k = 0; k < n; k++) {
    const a = base + (k - (n - 1) / 2) * LEAVER_FAN;
    const l = spawnAdd(w, bs, leaverDef, x + Math.cos(a) * d, y + Math.sin(a) * d);
    if (l < 0) break;
    w.enraged[l] = 1;
    enrageFx.id = l;
    enrageFx.x = w.x[l] ?? 0;
    enrageFx.y = w.y[l] ?? 0;
    bus.emit('sim:enrage', enrageFx);
    made++;
  }
  return made;
}

/** The fan owed by this rest: fire it once the ship is out of range, while it can still launch inside the rest. */
function stepFan(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  if (bs.t2 !== 1) return;
  const row = BOSS_SHOTS.ember;
  if (row === undefined) {
    bs.t2 = 0;
    return;
  }
  if (bs.shotWait > 0) {
    bs.shotWait = bs.shotWait - dt > 0 ? bs.shotWait - dt : 0;
    if (bs.shotWait > 0) return;
  }
  const rate = dt > 0 ? adt / dt : 1;
  if (bs.t3 / rate < bossTele(bs)) {
    bs.t2 = 0; // too late to launch inside the rest: no fan this time
    return;
  }
  if (!fireVolley(w, id, bs, row, speedFor(bs.phase))) {
    bs.shotWait = SHOT_RECHECK_SEC;
    return;
  }
  bs.t2 = 0;
}

function windup(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  const tele = bossTele(bs);
  if (bs.n2 < 0) {
    const rot = turnToward(w.rot[id] ?? 0, angleBetween(w, id, targetOf(w, id)), EMBER.turnRate * dt);
    w.rot[id] = rot;
    bs.t3 -= adt;
    if (bs.t3 > tele) return;
    bs.t3 = tele;
    if (!lockOn(w, id, bs)) return; // hazard cap: hold, the dash never starts without its telegraph
  } else if (bs.t3 > MARKER_GRACE && !markerLive(w, bs)) {
    // A bomb or a phase change pause outlasted the marker: lock again with a fresh one.
    bs.n2 = -1;
    bs.t3 = tele;
    if (!lockOn(w, id, bs)) return;
  }
  bs.t3 -= dt; // the telegraph is never shortened by enrage (fairness rule 5)
  if (bs.t3 > 0) return;
  dropMarker(w, bs);
  bs.n1 = 0;
  bs.t1 = 0;
  bs.t0 = 0;
  setMove(bs, EmberMove.Dash, dashSecFor(bs.phase));
}

function dash(w: World, id: number, bs: BossState, dt: number): void {
  const step = dashSpeedFor(bs.phase, bs.fury) * dt;
  const r = confineOn(w.surface, w.level.arena, (w.x[id] ?? 0) + Math.cos(bs.dir) * step, (w.y[id] ?? 0) + Math.sin(bs.dir) * step, w.radius[id] ?? 0, res);
  w.x[id] = r.x;
  w.y[id] = r.y;
  w.rot[id] = bs.dir;
  bs.t0 += step;
  while (bs.t0 >= EMBER.mineEvery) {
    bs.t0 -= EMBER.mineEvery;
    dropMine(w, id, w.x[id] ?? 0, w.y[id] ?? 0); // -1 at a Mine cap: skipped
  }
  if (r.hit) {
    bs.t1 = 1;
    bs.n1++;
    if (bs.n1 > bouncesFor(bs.fury)) {
      endDash(w, id, bs, true);
      return;
    }
    bs.dir = reflectHeading(bs.dir, r.nx, r.ny);
  }
  bs.t3 -= dt;
  if (bs.t3 <= 0) endDash(w, id, bs, bs.t1 === 1);
}

function setWindow(bs: BossState): void {
  bs.open = isOpen(bs.n0);
  bs.openLeft = bs.open ? (bs.t3 > 0 ? bs.t3 : 0) : -1;
  bs.mode = bs.n0 === EmberMove.Stun ? BossMode.Stunned : bs.n0 === EmberMove.Rest ? BossMode.Vulnerable : BossMode.Attacking;
}

export function reset(w: World, id: number, bs: BossState, first: boolean): void {
  bs.retry = 0;
  bs.n1 = 0;
  bs.t1 = 0;
  bs.t0 = 0;
  bs.t2 = 0;
  bs.shotWait = 0;
  bs.dir = w.rot[id] ?? 0;
  startWindup(bs, first ? EMBER.firstDash : 0);
  setWindow(bs);
}

/** Ember's own break reset: the marker is gone (clearHazards), no fan is owed. */
function onBreak(w: World, id: number, bs: BossState): void {
  bs.n2 = -1;
  bs.t2 = 0;
  bs.shotWait = 0;
}

/** Enraged: a fresh wind up. */
function onEnrage(w: World, id: number, bs: BossState): void {
  bs.n1 = 0;
  bs.t1 = 0;
  bs.t0 = 0;
  startWindup(bs, 0);
}

export function step(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  // The break: Ember stands still, core closed; then it is enraged.
  if (stepFury(w, id, bs, dt, onEnrage)) return;
  const prev = bs.n0;
  switch (bs.n0) {
    case EmberMove.Windup:
      windup(w, id, bs, dt, adt);
      break;
    case EmberMove.Dash:
      dash(w, id, bs, dt);
      break;
    case EmberMove.Stun:
      bs.t3 -= dt;
      if (bs.t3 <= 0) startWindup(bs, 0);
      break;
    default:
      stepFan(w, id, bs, dt, adt);
      bs.t3 -= adt;
      if (bs.t3 <= 0) startWindup(bs, 0);
  }
  // The fan charges from the start of the rest: the step the dash ends in open floor.
  if (prev === EmberMove.Dash && bs.n0 === EmberMove.Rest) stepFan(w, id, bs, dt, adt);
  setWindow(bs);
}

export function onPhase(w: World, id: number, bs: BossState, phase: number): void {
  // Speeds and timings read bs.phase from the next state on. The break is the phase 2 pause.
  furyOnPhase(bs, phase);
}

/** Hit hook: the break takes no damage, and the crossing hit stops at the stage 1 crack. */
export function clampDamage(w: World, id: number, bs: BossState, amount: number): number {
  return furyClampDamage(w, id, bs, amount);
}

/** After a hit Ember lived: the break starts the moment the stage 1 bar is empty. */
export function afterDamage(w: World, id: number, bs: BossState): void {
  if (furyDue(w, id, bs)) startFuryBreak(w, id, bs, onBreak);
}

/** Phase hook: phase 2 starts at the break, phase 3 from hit points. */
export function phaseOf(w: World, id: number, bs: BossState, hp: number): number {
  return furyPhaseOf(w, id, bs, hp);
}

export function entryHome(d: number): number {
  return d * EMBER.entryHome;
}

export const def: BossDef = { reset, step, onPhase, entryHome, clampDamage, afterDamage, phaseOf, fury: true };
