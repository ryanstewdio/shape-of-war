// Brood (tier 1, green, level 10; docs/12 roster row 2, reworked at G3A). It hunts: it prowls
// toward the ship at 75 u/s (turn limited), then winds up for the tier telegraph (1.0 s) with a
// lane marker along its locked heading, then charges across the arena at 320 u/s until a wall or
// 1.8 s stops it, rests 0.6 s and prowls again. Contact with the body kills. Three pods
// (Kind.BossPart, 1 HP each) orbit it at 90 u and shield it: it is immune while any pod lives.
// Kill all three and the core is open for openSec (5 s), flagged exposed for Glow and Chorus; while
// open it flees from the ship and never charges. The pods regrow 9 s after the last died. Every 6 s
// it launches three Darts from the side facing the ship (four every 5 s in phase 2, below 50
// percent), at most 8 live adds, through the normal spawn path.
// Scratch: t0 add clock, t1 open seconds left, t2 regrow countdown, n1 0 shielded or 1 broken,
// angle pod orbit angle, n0 move state, t3 move state clock, dir locked charge heading, n2 marker id.
//
// Split (G3C; boss health, Ryan 2026-11-11): once the body has emptied both its Shield and Health
// bars (clampDamage holds it at SPLIT_HP, never a kill) the body and any pods vanish and three
// Broodlings take over (Kind.BossPart, PartType.Broodling, 20 u, 60 hits each at Normal times hpMul
// and bossScale, slot = role): slot 0 chases the ship, slot 1 orbits it at 200 u and lays Slime
// every 2 s, slot 2 flees and launches Darts every 4 s. They carry their own bar (bs.splitMax).
// Contact with any Broodling kills. The fight ends with the third one, once.
// Split scratch: t0 slime clock, t1 dart clock, angle the orbiter's angle around the ship.
//
// Frenzy (fury three, BROOD_FRENZY): the body has no fury and no break (the split is its mid point).
// The first Broodling death enrages the rest: BossState.fury goes to 2 ('sim:bossFury' on, once; a
// ship death keeps it) and readBoss writes frenzy. Survivors move speedMul faster in their roles, and
// every everySec of attack time two survivors pincer the ship: each stops and faces a point reach u
// past the ship on the far side from the other for aimSec, then drives through it at driveSpeed (at
// most driveSec). A lone survivor keeps the speed and hunts the ship. Frenzy scratch (bs.abl): 0 the
// pincer clock, 1 the pincer stage (0 none, 1 aim, 2 drive), 2 stage seconds left, 3 to 8 each
// slot's drive point (x, y), 9 to 11 1 while that slot still drives.
import { bus } from '../../core/events';
import * as dart from '../enemies/dart';
import { dropSlime } from '../enemies/slime';
import { angleBetween, distBetween, moveHeading, moveTo, moveToHit, stepToward, targetOf, turnToward } from '../steer';
import { Kind, type World } from '../world';
import { bossAdt, clearHazards, countParts, crackBody, livePart, spawnAdd, spawnLaneMarker, spawnPart } from './core';
import { angleToOn, wrapPi } from './kit';
import { bossTele, minionCount } from './scale';
import { bossOf, type BossState } from './state';
import { BROOD, BROOD_FRENZY, BROODLING, MAX_ADDS, MAX_PARTS } from './table';
import { BossMode, PartType, type BossDef } from './types';
import { removeEntity } from '../remove';
import { difficultyOf } from '../difficulty';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** The marker ends just before the wind up does (markerLife); inside this tail its absence is expected. */
const MARKER_GRACE = 0.05;
/** Rear flank directions relative to the heading, used when the ship is too near for a front launch. */
const FLANKS = [Math.PI / 2, -Math.PI / 2, Math.PI, Math.PI * 0.75];

/** Move states (BossState.n0). */
export const enum BroodMove {
  Prowl = 0,
  Windup = 1,
  Charge = 2,
  Recover = 3,
}

/** Pure: the core is open (the counter window). */
export function isOpen(broken: number, openLeft: number): boolean {
  return broken === 1 && openLeft > 0;
}

/** Pure: prowl seconds before a wind up in a phase. */
export function prowlSecFor(phase: number): number {
  return phase >= 2 ? BROOD.prowlSecP2 : BROOD.prowlSec;
}

/** Pure: charge speed in a phase, u/s. */
export function chargeSpeedFor(phase: number): number {
  return phase >= 2 ? BROOD.chargeSpeedP2 : BROOD.chargeSpeed;
}

/** Pure: seconds between add waves in a phase. */
export function addEveryFor(phase: number): number {
  return phase >= 2 ? BROOD.addEveryP2 : BROOD.addEvery;
}

/** Pure: adds per wave in a phase. */
export function addsPerWaveFor(phase: number): number {
  return phase >= 2 ? BROOD.addsPerWaveP2 : BROOD.addsPerWave;
}

/** Pure: launch angle of add k of n, fanned around the heading toward the ship. */
export function addAngle(toShip: number, k: number, n: number): number {
  return toShip + (k - (n - 1) / 2) * BROOD.addSpreadDeg * DEG;
}

function podAngle(bs: BossState, slot: number): number {
  return bs.angle + (slot * TAU) / BROOD.podCount;
}

function spawnPods(w: World, id: number, bs: BossState): number {
  let n = 0;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  for (let k = 0; k < BROOD.podCount; k++) {
    const a = podAngle(bs, k);
    const p = spawnPart(w, bs, k, PartType.Pod, x + Math.cos(a) * BROOD.podOrbit, y + Math.sin(a) * BROOD.podOrbit, BROOD.podHp, BROOD.podRadius);
    if (p > 0) {
      w.rot[p] = a;
      n++;
    }
  }
  return n;
}

function placePods(w: World, id: number, bs: BossState): void {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  for (let k = 0; k < BROOD.podCount; k++) {
    const p = livePart(w, bs, k);
    if (p < 0) continue;
    const a = podAngle(bs, k);
    moveTo(w, p, x + Math.cos(a) * BROOD.podOrbit, y + Math.sin(a) * BROOD.podOrbit);
    w.rot[p] = a;
  }
}

function summon(w: World, id: number, bs: BossState): void {
  const def = dart.def;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const n = minionCount(addsPerWaveFor(bs.phase), bs.addScale, MAX_ADDS);
  const d = (w.radius[id] ?? 0) + BROOD.addPad + def.radius;
  const target = targetOf(w, id);
  const front = distBetween(w, id, target) >= BROOD.addFrontMinDist;
  const toShip = angleBetween(w, id, target);
  const rot = w.rot[id] ?? 0;
  for (let k = 0; k < n; k++) {
    const a = front ? addAngle(toShip, k, n) : rot + (FLANKS[k % FLANKS.length] ?? 0);
    spawnAdd(w, bs, def, x + Math.cos(a) * d, y + Math.sin(a) * d); // a Dart homes on the ship from its first step
  }
}

/** True while the charge marker of the current wind up lives. */
function markerLive(w: World, bs: BossState): boolean {
  const m = bs.n2;
  return m > 0 && w.alive[m] === 1 && w.kind[m] === Kind.BossHazard && bs.hzMarker[m] === 1;
}

/** Remove the charge marker if it still lives. */
function dropMarker(w: World, bs: BossState): void {
  if (markerLive(w, bs)) removeEntity(w, bs.n2);
  bs.n2 = -1;
}

function setMove(bs: BossState, state: BroodMove, t: number): void {
  bs.n0 = state;
  bs.t3 = t;
}

function startWindup(w: World, id: number, bs: BossState): void {
  const heading = angleBetween(w, id, targetOf(w, id));
  bs.dir = heading;
  w.rot[id] = heading;
  const length = chargeSpeedFor(bs.phase) * BROOD.chargeSec + (w.radius[id] ?? 0);
  dropMarker(w, bs);
  bs.n2 = spawnLaneMarker(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, heading, length, BROOD.markerHalfWidth);
  setMove(bs, BroodMove.Windup, bossTele(bs));
}

/** Seek the target (flee false) or run from it (flee true), turn limited. */
function prowl(w: World, id: number, speed: number, dt: number, flee: boolean): void {
  const target = targetOf(w, id);
  const toward = angleBetween(w, id, target);
  const rot = turnToward(w.rot[id] ?? 0, flee ? wrapPi(toward + Math.PI) : toward, BROOD.turnRate * dt);
  w.rot[id] = rot;
  if (flee || distBetween(w, id, target) > 1) moveHeading(w, id, rot, speed, dt);
}

/** Movement state machine for one step. open: the core is exposed (no new charges). */
function move(w: World, id: number, bs: BossState, dt: number, adt: number, open: boolean): void {
  const p2 = bs.phase >= 2;
  switch (bs.n0) {
    case BroodMove.Windup:
      if (open) {
        // The pods broke during the wind up: the window wins, the charge is called off.
        dropMarker(w, bs);
        setMove(bs, BroodMove.Prowl, prowlSecFor(bs.phase));
        return;
      }
      if (bs.t3 > MARKER_GRACE && !markerLive(w, bs)) {
        // A bomb or a phase change pause outlasted the marker: wind up again with a fresh one,
        // so a charge never starts without its full telegraph showing.
        startWindup(w, id, bs);
        return;
      }
      bs.t3 -= dt; // the telegraph is never shortened by enrage (fairness rule 5)
      if (bs.t3 <= 0) {
        dropMarker(w, bs);
        setMove(bs, BroodMove.Charge, BROOD.chargeSec);
      }
      return;
    case BroodMove.Charge: {
      const sp = chargeSpeedFor(bs.phase);
      const x = (w.x[id] ?? 0) + Math.cos(bs.dir) * sp * dt;
      const y = (w.y[id] ?? 0) + Math.sin(bs.dir) * sp * dt;
      const hit = moveToHit(w, id, x, y);
      w.rot[id] = bs.dir;
      bs.t3 -= dt;
      if (hit || bs.t3 <= 0) setMove(bs, BroodMove.Recover, BROOD.recoverSec);
      return;
    }
    case BroodMove.Recover:
      bs.t3 -= adt;
      if (bs.t3 <= 0) setMove(bs, BroodMove.Prowl, prowlSecFor(bs.phase));
      return;
    default:
      prowl(w, id, open ? BROOD.exposedSpeed : p2 ? BROOD.prowlSpeedP2 : BROOD.prowlSpeed, dt, open);
      if (open) return; // the prowl clock waits while the core is open
      bs.t3 -= adt;
      if (bs.t3 <= 0) startWindup(w, id, bs);
  }
}

export function reset(w: World, id: number, bs: BossState, first: boolean): void {
  bs.t0 = BROOD.addEvery - BROOD.firstAdds;
  bs.retry = 0;
  bs.n2 = -1; // hazards (the marker too) are cleared by the core before a restart
  w.rot[id] = angleBetween(w, id, targetOf(w, id));
  setMove(bs, BroodMove.Prowl, BROOD.firstCharge);
  if (first) {
    bs.angle = 0;
    bs.n1 = 0;
    bs.t1 = 0;
    bs.t2 = 0;
    spawnPods(w, id, bs);
  }
  setWindow(bs);
}

function setWindow(bs: BossState): void {
  bs.open = isOpen(bs.n1, bs.t1);
  bs.openLeft = bs.open ? bs.t1 : -1;
  if (bs.open) bs.mode = BossMode.Vulnerable;
  else if (bs.n0 === BroodMove.Windup || bs.n0 === BroodMove.Charge) bs.mode = BossMode.Attacking;
  else bs.mode = BossMode.Guarded;
}

export function step(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  move(w, id, bs, dt, adt, isOpen(bs.n1, bs.t1));
  bs.angle = wrapPi(bs.angle + BROOD.podSpin * dt);
  placePods(w, id, bs);
  if (bs.n1 === 0 && countParts(w, bs) === 0) {
    bs.n1 = 1;
    bs.t1 = BROOD.openSec;
    bs.t2 = BROOD.regrowSec;
  }
  if (bs.n1 === 1) {
    if (bs.t1 > 0) bs.t1 = bs.t1 - dt > 0 ? bs.t1 - dt : 0;
    bs.t2 -= dt;
    if (bs.t2 <= 0) {
      bs.t2 = 0;
      if (spawnPods(w, id, bs) > 0) {
        bs.n1 = 0;
        bs.t1 = 0;
      }
    }
  }
  bs.t0 += adt;
  const every = addEveryFor(bs.phase);
  if (bs.t0 >= every) {
    bs.t0 -= every;
    summon(w, id, bs);
  }
  setWindow(bs);
}

export function onPhase(w: World, id: number, bs: BossState, phase: number): void {
  // Phase 2 reads bs.phase: faster prowl and charge, shorter prowl, four Darts every 5 s.
}

export function entryHome(d: number): number {
  return d - BROOD.entrySlide;
}

// ---------------------------------------------------------------------------------------------
// Split into Broodlings

/** Broodling roles, by part slot. */
export const enum BroodlingRole {
  Chase = 0,
  Orbit = 1,
  Flee = 2,
}

/** Pure: heading of a fleeing Broodling. Away from the ship, bent toward the arena centre (at most 90 degrees) as it nears a wall. */
export function fleeHeading(away: number, toCentre: number, fromCentre: number): number {
  const k = Math.min(1, Math.max(0, (fromCentre - 250) / 250));
  const side = Math.min(Math.PI / 2, Math.max(-Math.PI / 2, wrapPi(toCentre - away)));
  return wrapPi(away + side * k);
}

/** Body hit points (tenths) Brood is held at when both its bars are empty: it splits there, never dies. */
export const SPLIT_HP = 1;

/**
 * Pure: stored hit points of one Broodling for the boss's hpMul times bossScale (mul) and its armour:
 * BROODLING.hp scaled like the body, at least 1. Armour already stretches every hit on a split
 * part, so it is divided back out.
 */
export function broodlingHp(mul: number, armour: number): number {
  const m = Number.isFinite(mul) && mul > 0 ? mul : 1;
  const a = armour > 1 ? armour : 1;
  const v = Math.round((BROODLING.hp * m) / a);
  return v < 1 ? 1 : v;
}

/** A hit never takes the body below SPLIT_HP: the last tenth goes to the split, not a kill. */
export function clampDamage(w: World, id: number, bs: BossState, amount: number): number {
  if (bs.split) return amount;
  const room = (w.hp[id] ?? 0) - SPLIT_HP;
  return amount < room ? amount : room > 0 ? room : 0;
}

/** Split the body into three Broodlings. Called once, when the body's bars are empty. */
function splitBody(w: World, id: number, bs: BossState): void {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const lead = angleBetween(w, id, targetOf(w, id));
  dropMarker(w, bs);
  clearHazards(w);
  for (let k = 0; k < MAX_PARTS; k++) {
    const p = livePart(w, bs, k);
    if (p > 0) removeEntity(w, p); // pods go with the body (no fx: the body burst is the crack)
    bs.parts[k] = -1;
  }
  removeEntity(w, id);
  bs.id = -1;
  bs.split = true;
  bs.open = false;
  bs.openLeft = -1;
  bs.mode = BossMode.Attacking;
  bs.t0 = BROODLING.firstDelay;
  bs.t1 = BROODLING.firstDelay;
  const hp = broodlingHp(bs.spec.hpMul * difficultyOf(w).bossScale, bs.armour);
  let made = 0;
  let sum = 0;
  for (let k = 0; k < BROODLING.count; k++) {
    const a = lead + (k * TAU) / BROODLING.count;
    const p = spawnPart(w, bs, k, PartType.Broodling, x + Math.cos(a) * BROODLING.spawnRing, y + Math.sin(a) * BROODLING.spawnRing, hp, BROODLING.radius);
    if (p < 0) continue;
    w.rot[p] = a;
    made++;
    sum += hp;
    if (k === BroodlingRole.Orbit) bs.angle = angleToOn(w.surface, w.x[0] ?? 0, w.y[0] ?? 0, w.x[p] ?? 0, w.y[p] ?? 0);
  }
  bs.splitMax = sum > 0 ? sum : 1;
  bs.splitEv.parts = made;
  bus.emit('sim:bossSplit', bs.splitEv);
}

/** Core hook after the body took damage and lived: report the cracks, split once both bars are empty. */
export function cracks(w: World, id: number, bs: BossState): void {
  const hp = w.hp[id] ?? 0;
  crackBody(bs, 0, hp, bs.maxHp, w.x[id] ?? 0, w.y[id] ?? 0);
  if (!bs.split && hp <= SPLIT_HP) splitBody(w, id, bs);
}

function slotOf(bs: BossState, id: number): number {
  for (let k = 0; k < MAX_PARTS; k++) if (bs.parts[k] === id) return k;
  return -1;
}

/** Launch Darts from a Broodling toward the ship, through the normal spawn path. */
function launchDarts(w: World, id: number, bs: BossState): void {
  const d = (w.radius[id] ?? 0) + BROOD.addPad + dart.def.radius;
  const toShip = angleBetween(w, id, targetOf(w, id));
  const n = minionCount(BROODLING.dartsPerWave, bs.addScale, MAX_ADDS);
  for (let k = 0; k < n; k++) {
    const a = toShip + (k - (n - 1) / 2) * BROODLING.dartSpreadDeg * DEG;
    spawnAdd(w, bs, dart.def, (w.x[id] ?? 0) + Math.cos(a) * d, (w.y[id] ?? 0) + Math.sin(a) * d);
  }
}

/** One step of a Broodling (Kind.BossPart, PartType.Broodling). Paused while the ship is down or the boss is staggered. */
export function stepBroodling(w: World, id: number, dt: number): void {
  const bs = bossOf(w);
  if (bs === null || bs.status !== 'alive' || !bs.split) return;
  if (!w.ship.active) {
    bs.abl[P_STAGE] = Pincer.None; // a pincer in flight is called off while the ship is down
    return;
  }
  if (bs.stagger > 0) return;
  const adt = bossAdt(w, bs, dt);
  const ship = targetOf(w, id);
  const slot = slotOf(bs, id);
  if (bs.fury === 2 && stepFrenzy(w, id, bs, slot, dt, adt)) return;
  const fury = bs.fury;
  switch (slot) {
    case BroodlingRole.Chase: {
      const rot = turnToward(w.rot[id] ?? 0, angleBetween(w, id, ship), BROODLING.turnRate * dt);
      w.rot[id] = rot;
      moveHeading(w, id, rot, frenzySpeed(BROODLING.chaseSpeed, fury), dt);
      return;
    }
    case BroodlingRole.Orbit: {
      bs.angle = wrapPi(bs.angle + BROODLING.orbitRate * dt);
      const tx = (w.x[ship] ?? 0) + Math.cos(bs.angle) * BROODLING.orbitRadius;
      const ty = (w.y[ship] ?? 0) + Math.sin(bs.angle) * BROODLING.orbitRadius;
      w.rot[id] = angleToOn(w.surface, w.x[id] ?? 0, w.y[id] ?? 0, tx, ty);
      stepToward(w, id, tx, ty, frenzySpeed(BROODLING.orbitSpeed, fury) * dt);
      bs.t0 -= adt;
      if (bs.t0 <= 0) {
        bs.t0 += BROODLING.slimeEvery;
        dropSlime(w, id, w.x[id] ?? 0, w.y[id] ?? 0);
      }
      return;
    }
    case BroodlingRole.Flee: {
      const x = w.x[id] ?? 0;
      const y = w.y[id] ?? 0;
      // R6 drum: no u walls, so the centre it bends toward is the drum's middle line (v = 0).
      const cx = w.surface.topology.wrapU ? 0 : x;
      const want = fleeHeading(angleBetween(w, ship, id), Math.atan2(-y, -cx), Math.sqrt(cx * cx + y * y));
      const rot = turnToward(w.rot[id] ?? 0, want, BROODLING.fleeTurnRate * dt);
      w.rot[id] = rot;
      moveHeading(w, id, rot, frenzySpeed(BROODLING.fleeSpeed, fury), dt);
      bs.t1 -= adt;
      if (bs.t1 <= 0) {
        bs.t1 += BROODLING.dartEvery;
        launchDarts(w, id, bs);
      }
      return;
    }
    default:
  }
}

// ---------------------------------------------------------------------------------------------
// Frenzy

const P_CLOCK = 0;
const P_STAGE = 1;
const P_LEFT = 2;
const P_PT = 3;
const P_DRIVE = 9;

/** Pincer stages (bs.abl[P_STAGE]). */
export const enum Pincer {
  None = 0,
  Aim = 1,
  Drive = 2,
}

/** Pure: a Broodling speed in a fury stage (enraged: times BROOD_FRENZY.speedMul). */
export function frenzySpeed(speed: number, fury: number): number {
  return fury >= 2 ? speed * BROOD_FRENZY.speedMul : speed;
}

/**
 * Pure: the drive point of a Broodling whose partner is at (ox, oy), with the ship at (sx, sy):
 * reach u past the ship on the far side from the partner, written into out (flat offsets).
 */
export function pincerPoint(sx: number, sy: number, ox: number, oy: number, out: { x: number; y: number }): void {
  let dx = sx - ox;
  let dy = sy - oy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-6) {
    dx /= d;
    dy /= d;
  } else {
    dx = 1;
    dy = 0;
  }
  out.x = sx + dx * BROOD_FRENZY.reach;
  out.y = sy + dy * BROOD_FRENZY.reach;
}

const fev = { x: 0, y: 0 };
const pt = { x: 0, y: 0 };

/** The Broodlings enrage: the first death after the split ('sim:bossFury' on, once). */
function enrageBroodlings(bs: BossState, x: number, y: number): void {
  bs.fury = 2;
  bs.furyT = 0;
  bs.abl[P_CLOCK] = 0;
  bs.abl[P_STAGE] = Pincer.None;
  const e = bs.furyEv;
  e.id = bs.spec.id;
  e.stage = 'on';
  e.sec = 0;
  e.x = x;
  e.y = y;
  bus.emit('sim:bossFury', e);
}

/** Part hook: the first Broodling to die enrages the others (pods never do). */
export function onPartDamage(w: World, bs: BossState, part: number, applied: number, broke: boolean): void {
  if (!broke || !bs.split || bs.fury !== 0 || bs.status !== 'alive') return;
  enrageBroodlings(bs, w.x[part] ?? 0, w.y[part] ?? 0);
}

/** Start a pincer: each of the two survivors locks a point past the ship on the far side from the other. */
function startPincer(w: World, bs: BossState, a: number, b: number): void {
  const sx = w.x[0] ?? 0;
  const sy = w.y[0] ?? 0;
  for (let k = 0; k < MAX_PARTS && k < BROODLING.count; k++) bs.abl[P_DRIVE + k] = 0;
  for (let i = 0; i < 2; i++) {
    const self = i === 0 ? a : b;
    const other = i === 0 ? b : a;
    const k = slotOf(bs, self);
    if (k < 0 || k >= BROODLING.count) continue;
    // The partner's offset from the ship on the surface (the short way across a drum seam).
    w.surface.delta(sx, sy, w.x[other] ?? 0, w.y[other] ?? 0, fev);
    pincerPoint(sx, sy, sx + fev.x, sy + fev.y, pt);
    w.surface.wrap(pt);
    bs.abl[P_PT + 2 * k] = pt.x;
    bs.abl[P_PT + 2 * k + 1] = pt.y;
    bs.abl[P_DRIVE + k] = 1;
  }
  bs.abl[P_STAGE] = Pincer.Aim;
  bs.abl[P_LEFT] = BROOD_FRENZY.aimSec;
}

/** The pincer clock, run once per step by the first live Broodling. */
function stepPincerClock(w: World, bs: BossState, dt: number, adt: number, a: number, b: number): void {
  const stage = bs.abl[P_STAGE] ?? 0;
  if (stage === Pincer.None) {
    const c = (bs.abl[P_CLOCK] ?? 0) + adt;
    if (c < BROOD_FRENZY.everySec || b < 0) {
      bs.abl[P_CLOCK] = c < BROOD_FRENZY.everySec ? c : BROOD_FRENZY.everySec;
      return;
    }
    bs.abl[P_CLOCK] = c - BROOD_FRENZY.everySec;
    startPincer(w, bs, a, b);
    return;
  }
  const left = (bs.abl[P_LEFT] ?? 0) - dt;
  if (left > 0) {
    bs.abl[P_LEFT] = left;
    return;
  }
  if (stage === Pincer.Aim) {
    bs.abl[P_STAGE] = Pincer.Drive;
    bs.abl[P_LEFT] = BROOD_FRENZY.driveSec;
    return;
  }
  bs.abl[P_STAGE] = Pincer.None;
}

/**
 * Frenzy movement of Broodling id in slot k. Returns true when it replaced the role step: a lone
 * survivor hunting, or a pincer aim or drive in progress.
 */
function stepFrenzy(w: World, id: number, bs: BossState, k: number, dt: number, adt: number): boolean {
  let a = -1;
  let b = -1;
  for (let j = 0; j < BROODLING.count; j++) {
    const p = livePart(w, bs, j);
    if (p < 0) continue;
    if (a < 0) a = p;
    else if (b < 0) b = p;
  }
  if (id === a) {
    bs.furyT += dt;
    stepPincerClock(w, bs, dt, adt, a, b);
  }
  if (b < 0) {
    // A lone survivor hunts the ship at the frenzy speed.
    const rot = turnToward(w.rot[id] ?? 0, angleBetween(w, id, targetOf(w, id)), BROODLING.turnRate * dt);
    w.rot[id] = rot;
    moveHeading(w, id, rot, frenzySpeed(BROODLING.chaseSpeed, bs.fury), dt);
    return true;
  }
  const stage = bs.abl[P_STAGE] ?? 0;
  if (stage === Pincer.None || k < 0 || k >= BROODLING.count || (bs.abl[P_DRIVE + k] ?? 0) !== 1) return false;
  const px = bs.abl[P_PT + 2 * k] ?? 0;
  const py = bs.abl[P_PT + 2 * k + 1] ?? 0;
  const to = angleToOn(w.surface, w.x[id] ?? 0, w.y[id] ?? 0, px, py);
  w.rot[id] = to;
  if (stage === Pincer.Aim) return true; // it stops and faces its point
  const step = BROOD_FRENZY.driveSpeed * dt;
  if (stepToward(w, id, px, py, step) <= step) bs.abl[P_DRIVE + k] = 0; // through its point: back to its role
  return true;
}

export const def: BossDef = { reset, step, onPhase, entryHome, clampDamage, cracks, onPartDamage };
