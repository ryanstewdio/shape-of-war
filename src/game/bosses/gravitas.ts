// Gravitas (tier 2, violet, level 30; docs/12 roster row 6). Seeks its target at 45 u/s with a
// pull around it (radius 300 u, up to 100 u/s, through the well pull channel). Three anchors
// (Kind.BossPart, 6 HP each) orbit it at 140 u: it takes no damage until all three are gone, and
// each lost anchor weakens the pull by a third (none left, no pull). Every 5 s (4 s in phase 2,
// 3 s in phase 3) a ring collapses onto it from 480 u with a 60 deg gap facing the ship. Anchors
// do not regrow and survive a ship death. Scratch: t0 ring clock, angle anchor orbit, n0 pull id,
// retry the ring recheck.
//
// Split (boss abilities wave): at the stage 2 crack the body splits into two half mass wells
// (Kind.BossPart, PartType.Gravitant, 28 u, slots 0 and 1; boss health: the body's remaining hit
// points shared evenly, so the bar runs on without a drop) that orbit each other
// round a pair centre seeking the target, each with its own pull at half strength. The rings keep
// collapsing onto the pair centre. Contact with a Gravitant kills. The fight ends with the second,
// once; the bar is the sum of the two. Split scratch: t0 ring clock, t1 and t2 pair centre, t3
// orbit radius (opens from 0), angle orbit angle, n0 and n1 the pull ids of slots 0 and 1, retry.
//
// Fury (shared, fury.ts; fury three): at the stage 1 crack Gravitas breaks (stands still, pull and
// rings gone, core closed, no damage, FURY_BREAK_SEC), phase 2 starts there, then it is enraged to its
// death. Tide (GRAVITAS_FURY): enraged, every pull flips to a push and back every flipSec of furyT at
// the same strength: while it pushes the core pull is held at 0 (hzRate; w.vx keeps the strength for
// render) and the push goes into the ship pull channel with the same falloff and blend, so it never
// moves the ship faster than the pull could. furyT runs on through the stage 2 split (the lead
// Gravitant counts it), so the tide carries onto the pair. Anchors and rings are unchanged.
//
// Shelter pools (fury fixes, GRAVITAS_POOL; Ryan 2026-11-12): enraged, Gravitas leaves a pool
// (Kind.BossHazard, HazardType.Pool, never lethal) where it stands every everySec of attack time,
// after the split at the pair centre. The core shrinks it over its last fadeSec (w.t its age, w.vx its
// full life). At most max live (the oldest goes first), and a pool is skipped, never a ring or a
// pull, when it would leave fewer than reserve hazard slots. A ship inside one gets no pull or push
// (core.ts bossContacts and pushShip below) and floats (ShipState.float). Ability scratch (bs.abl):
// 0 the pool clock.
import { bus } from '../../core/events';
import { pullRetain } from '../enemies/gravitywell';
import { gs } from '../state';
import { angleBetween, distBetween, moveHeading, moveTo, targetOf } from '../steer';
import { Kind, type World } from '../world';
import {
  bossAdt,
  clearHazards,
  countHazards,
  countParts,
  crackBody,
  HAZARD_OVERLAP,
  livePart,
  pullStrength,
  setPullStrength,
  shipSheltered,
  spawnHazard,
  spawnPart,
  spawnPull,
  spawnRing,
} from './core';
import { emitFury, furyClampDamage, furyDue, furyOnPhase, furyPhaseOf, startFuryBreak, stepFury } from './fury';
import { angleToOn, pullSpeed } from './kit';
import { bossOf, type BossState } from './state';
import { FURY_BREAK_SEC, GRAVITANT, GRAVITAS, GRAVITAS_FURY, GRAVITAS_POOL, HAZARD_RECHECK_SEC, MAX_HAZARDS, MAX_PARTS } from './table';
import { BossMode, HazardType, PartType, type BossDef } from './types';
import { removeEntity } from '../remove';
import { splitHp } from './tempest';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** bs.abl slot of the pool clock (attack seconds since the last pool). */
const POOL_CLOCK = 0;

/** Pure: seconds between collapsing rings in a phase. */
export function ringEveryFor(phase: number): number {
  if (phase >= 3) return GRAVITAS.ringEveryP3;
  if (phase === 2) return GRAVITAS.ringEveryP2;
  return GRAVITAS.ringEvery;
}

/** Pure: pull strength (u/s at the centre) with anchors left of the full set: a third less per lost one. */
export function pullFor(anchors: number): number {
  const n = anchors < 0 ? 0 : anchors > GRAVITAS.anchors ? GRAVITAS.anchors : anchors;
  return (GRAVITAS.pullMax * n) / GRAVITAS.anchors;
}

/** Pure: the core takes damage only once every anchor is gone. */
export function isOpen(anchors: number): boolean {
  return anchors <= 0;
}

/** Pure: the tide in a fury stage furyT seconds in: 1 pull, -1 push, 0 when not enraged. */
export function tideAt(fury: number, furyT: number): -1 | 0 | 1 {
  if (fury < 2) return 0;
  const t = Number.isFinite(furyT) && furyT > 0 ? furyT : 0;
  return Math.floor(t / GRAVITAS_FURY.flipSec + 1e-9) % 2 === 0 ? 1 : -1;
}

/** Pure: seconds to the next tide flip in a fury stage furyT seconds in, -1 when not enraged. */
export function tideFlipInAt(fury: number, furyT: number): number {
  if (fury < 2) return -1;
  const t = Number.isFinite(furyT) && furyT > 0 ? furyT : 0;
  const into = t - Math.floor(t / GRAVITAS_FURY.flipSec + 1e-9) * GRAVITAS_FURY.flipSec;
  const left = GRAVITAS_FURY.flipSec - (into > 0 ? into : 0);
  return left > 0 ? left : GRAVITAS_FURY.flipSec;
}

/** Pure: true while Glow should flash the flip ring (the last telegraphSec before a flip). */
export function tideTelegraph(flipIn: number): boolean {
  return flipIn >= 0 && flipIn <= GRAVITAS_FURY.telegraphSec + 1e-9;
}

/** The tide of Gravitas now (readBoss): 0 for any other guardian or before the fury. */
export function tideOf(bs: BossState): -1 | 0 | 1 {
  return bs.spec.id === 'gravitas' ? tideAt(bs.fury, bs.furyT) : 0;
}

/** Seconds to the next tide flip of Gravitas now (readBoss), -1 when none. */
export function tideFlipInOf(bs: BossState): number {
  return bs.spec.id === 'gravitas' ? tideFlipInAt(bs.fury, bs.furyT) : -1;
}

/** Push the ship out from pull p at strength s: the core pull's falloff and blend, reversed. */
function pushShip(w: World, p: number, s: number, dt: number): void {
  if (!w.ship.active || shipSheltered(w)) return; // a ship in a shelter pool feels no push
  const v = pullSpeed(distBetween(w, p, 0), w.radius[p] ?? 0, s);
  if (v <= 0) return;
  const a = angleBetween(w, 0, p);
  const blend = 1 - pullRetain(dt);
  const g = gs(w);
  g.shipPullX -= Math.cos(a) * v * blend;
  g.shipPullY -= Math.sin(a) * v * blend;
}

/** Set pull p to strength s under the tide: a pull as before, or held at 0 in the core while it pushes. */
function holdPull(w: World, bs: BossState, p: number, s: number, dt: number): void {
  setPullStrength(w, bs, p, s); // w.vx keeps the strength for render either way
  if (tideAt(bs.fury, bs.furyT) >= 0) return;
  bs.hzRate[p] = 0; // the core pull is off: the push replaces it
  pushShip(w, p, pullStrength(s), dt);
}

/** Live shelter pools now. */
export function countPools(w: World): number {
  let n = 0;
  for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Pool) n++;
  return n;
}

/**
 * Leave a pool at (x, y): at the cap the oldest goes first. Skipped (never a ring or a pull) when it
 * would leave fewer than GRAVITAS_POOL.reserve hazard slots free. Returns the id or -1.
 */
export function dropPool(w: World, bs: BossState, x: number, y: number): number {
  let n = 0;
  let oldest = -1;
  let age = -1;
  for (let h = 1; h < w.cap; h++) {
    if (w.alive[h] !== 1 || w.kind[h] !== Kind.BossHazard || w.a[h] !== HazardType.Pool) continue;
    n++;
    if ((w.t[h] ?? 0) > age) {
      age = w.t[h] ?? 0;
      oldest = h;
    }
  }
  const full = n >= GRAVITAS_POOL.max && oldest > 0;
  if (countHazards(w) - (full ? 1 : 0) + 1 + GRAVITAS_POOL.reserve > MAX_HAZARDS) return -1;
  if (full) removeEntity(w, oldest);
  const life = GRAVITAS_POOL.lifeSec;
  return spawnHazard(w, bs, HazardType.Pool, x, y, 0, GRAVITAS_POOL.radius, life, 0, 0, life, false);
}

/** The pool clock: enraged only, a pool at (x, y) every everySec of attack time. */
function stepPools(w: World, bs: BossState, x: number, y: number, adt: number): void {
  if (bs.fury !== 2) return;
  const c = (bs.abl[POOL_CLOCK] ?? 0) + adt;
  if (c < GRAVITAS_POOL.everySec) {
    bs.abl[POOL_CLOCK] = c;
    return;
  }
  bs.abl[POOL_CLOCK] = c - GRAVITAS_POOL.everySec;
  dropPool(w, bs, x, y);
}

/** The live pull id, or -1. */
export function livePull(w: World, bs: BossState): number {
  const id = bs.n0;
  return id > 0 && w.alive[id] === 1 && w.kind[id] === Kind.BossHazard && w.a[id] === HazardType.Pull ? id : -1;
}

function anchorAngle(bs: BossState, slot: number): number {
  return bs.angle + (slot * TAU) / GRAVITAS.anchors;
}

function spawnAnchors(w: World, id: number, bs: BossState): void {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  for (let k = 0; k < GRAVITAS.anchors; k++) {
    const a = anchorAngle(bs, k);
    const p = spawnPart(w, bs, k, PartType.Anchor, x + Math.cos(a) * GRAVITAS.anchorOrbit, y + Math.sin(a) * GRAVITAS.anchorOrbit, GRAVITAS.anchorHp, GRAVITAS.anchorRadius);
    if (p > 0) w.rot[p] = a;
  }
}

function placeAnchors(w: World, id: number, bs: BossState): void {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  for (let k = 0; k < GRAVITAS.anchors; k++) {
    const p = livePart(w, bs, k);
    if (p < 0) continue;
    const a = anchorAngle(bs, k);
    moveTo(w, p, x + Math.cos(a) * GRAVITAS.anchorOrbit, y + Math.sin(a) * GRAVITAS.anchorOrbit);
    w.rot[p] = a;
  }
}

/** Keep the pull matched to the anchors: weaker per lost anchor, removed with none left. */
function syncPull(w: World, id: number, bs: BossState, anchors: number, dt: number): void {
  const p = livePull(w, bs);
  const s = pullFor(anchors);
  if (s <= 0) {
    if (p > 0) removeEntity(w, p);
    bs.n0 = -1;
    return;
  }
  if (p > 0) {
    holdPull(w, bs, p, s, dt);
    return;
  }
  bs.n0 = spawnPull(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, GRAVITAS.pullRadius, -1, true, s);
  if (bs.n0 > 0) holdPull(w, bs, bs.n0, s, dt);
}

function fireRing(w: World, id: number, bs: BossState, every: number): void {
  // The gap faces the ship, never the decoy: a ring must always leave the ship a route.
  const h = spawnRing(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, GRAVITAS.ringStart, angleBetween(w, id, 0), (GRAVITAS.gapDeg * DEG) / 2, 1, -GRAVITAS.ringCollapse);
  if (h === HAZARD_OVERLAP) {
    bs.retry = HAZARD_RECHECK_SEC;
    return;
  }
  bs.t0 -= every;
  if (bs.t0 < 0) bs.t0 = 0;
}

function setWindow(bs: BossState, anchors: number): void {
  bs.open = isOpen(anchors);
  bs.openLeft = -1;
  bs.mode = bs.open ? BossMode.Vulnerable : BossMode.Guarded;
}

export function reset(w: World, id: number, bs: BossState, first: boolean): void {
  bs.t0 = GRAVITAS.ringEvery - GRAVITAS.firstRing;
  bs.retry = 0;
  bs.n0 = -1; // the core clears hazards (the pull too) before a restart
  if (first) {
    bs.angle = 0;
    spawnAnchors(w, id, bs);
  }
  // The pull comes back on the first step, which runs only while the ship is active (boss rule 6).
  setWindow(bs, countParts(w, bs));
}

/** Gravitas's own break reset: the pull and any ring are gone (clearHazards). */
function onBreak(w: World, id: number, bs: BossState): void {
  bs.n0 = -1;
  bs.retry = 0;
}

export function step(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  // The break: Gravitas stands still, no pull, no rings, core closed; then it is enraged.
  if (stepFury(w, id, bs, dt, null)) return;
  const target = targetOf(w, id);
  const heading = angleBetween(w, id, target);
  w.rot[id] = heading;
  if (distBetween(w, id, target) > 1) moveHeading(w, id, heading, GRAVITAS.seekSpeed, dt);
  bs.angle = (bs.angle + GRAVITAS.anchorSpin * dt) % TAU;
  placeAnchors(w, id, bs);
  const n = countParts(w, bs);
  syncPull(w, id, bs, n, dt);
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
  } else {
    bs.t0 += adt;
    const every = ringEveryFor(bs.phase);
    if (bs.t0 >= every) fireRing(w, id, bs, every);
  }
  stepPools(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, adt);
  setWindow(bs, n);
}

export function onPhase(w: World, id: number, bs: BossState, phase: number): void {
  // The ring interval reads bs.phase; keep the clock where it is. The break is the phase 2 pause.
  furyOnPhase(bs, phase);
}

/** Hit hook: the break takes no damage, and the crossing hit stops at the stage 1 crack. */
export function clampDamage(w: World, id: number, bs: BossState, amount: number): number {
  return furyClampDamage(w, id, bs, amount);
}

/** After a hit Gravitas lived: the break starts the moment the stage 1 bar is empty. */
export function afterDamage(w: World, id: number, bs: BossState): void {
  if (furyDue(w, id, bs)) startFuryBreak(w, id, bs, onBreak);
}

/** Phase hook: phase 2 starts at the break, phase 3 from hit points. */
export function phaseOf(w: World, id: number, bs: BossState, hp: number): number {
  return furyPhaseOf(w, id, bs, hp);
}

export function entryHome(d: number): number {
  return d * GRAVITAS.entryHome;
}

// ---------------------------------------------------------------------------------------------
// Split into Gravitants

/** Pure: the orbit radius after dt, opening toward target at GRAVITANT.orbitGrow u/s (closing as fast). */
export function orbitToward(r: number, target: number, dt: number): number {
  const step = GRAVITANT.orbitGrow * (dt > 0 ? dt : 0);
  if (r < target) return r + step > target ? target : r + step;
  return r - step < target ? target : r - step;
}

/** A pull id kept in scratch, or -1. */
function pullAt(w: World, id: number): number {
  return id > 0 && w.alive[id] === 1 && w.kind[id] === Kind.BossHazard && w.a[id] === HazardType.Pull ? id : -1;
}

/** Split the body into two Gravitants. Called once, from the stage 2 crack. */
function splitBody(w: World, id: number, bs: BossState): void {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const hp = w.hp[id] ?? 0;
  clearHazards(w); // the body pull and any ring go with the body
  for (let k = 0; k < MAX_PARTS; k++) {
    const p = livePart(w, bs, k);
    if (p > 0) removeEntity(w, p);
    bs.parts[k] = -1;
  }
  const lead = angleBetween(w, id, targetOf(w, id)) + Math.PI / 2;
  removeEntity(w, id);
  bs.id = -1;
  bs.split = true;
  bs.open = false;
  bs.openLeft = -1;
  bs.mode = BossMode.Attacking;
  bs.t0 = 0;
  bs.t1 = x;
  bs.t2 = y;
  bs.t3 = 0;
  bs.angle = lead;
  bs.n0 = -1;
  bs.n1 = -1;
  bs.retry = 0;
  let made = 0;
  for (let k = 0; k < GRAVITANT.count; k++) {
    const p = spawnPart(w, bs, k, PartType.Gravitant, x, y, Math.max(1, splitHp(hp, k, GRAVITANT.count)), GRAVITANT.radius);
    if (p < 0) continue;
    w.rot[p] = lead + k * Math.PI;
    made++;
  }
  bs.splitEv.parts = made;
  bus.emit('sim:bossSplit', bs.splitEv);
}

/** Core hook after the body took damage and lived: report the cracks, split once at stage 2. */
export function cracks(w: World, id: number, bs: BossState): void {
  crackBody(bs, 0, w.hp[id] ?? 0, bs.maxHp, w.x[id] ?? 0, w.y[id] ?? 0);
  if (!bs.split && (bs.crack[0] ?? 0) >= 2) splitBody(w, id, bs);
}

/** Keep slot k's pull on its Gravitant at half strength, or remove it with the Gravitant gone. */
function syncSplitPull(w: World, bs: BossState, k: number, dt: number): void {
  const p = livePart(w, bs, k);
  const cur = pullAt(w, k === 0 ? bs.n0 : bs.n1);
  if (p < 0) {
    if (cur > 0) removeEntity(w, cur);
    if (k === 0) bs.n0 = -1;
    else bs.n1 = -1;
    return;
  }
  if (cur > 0) {
    w.x[cur] = w.x[p] ?? 0;
    w.y[cur] = w.y[p] ?? 0;
    holdPull(w, bs, cur, GRAVITANT.pullMax, dt);
    return;
  }
  const made = spawnPull(w, bs, w.x[p] ?? 0, w.y[p] ?? 0, GRAVITANT.pullRadius, -1, false, GRAVITANT.pullMax);
  if (k === 0) bs.n0 = made;
  else bs.n1 = made;
  if (made > 0) holdPull(w, bs, made, GRAVITANT.pullMax, dt);
}

/** Scratch for surface deltas (read both fields before the next call). */
const dv = { x: 0, y: 0 };

/** The pair's ring: collapses onto the pair centre with its gap facing the ship. */
function fireSplitRing(w: World, bs: BossState, every: number): void {
  const toShip = angleToOn(w.surface, bs.t1, bs.t2, w.x[0] ?? 0, w.y[0] ?? 0);
  const h = spawnRing(w, bs, bs.t1, bs.t2, GRAVITAS.ringStart, toShip, (GRAVITAS.gapDeg * DEG) / 2, 1, -GRAVITAS.ringCollapse);
  if (h === HAZARD_OVERLAP) {
    bs.retry = HAZARD_RECHECK_SEC;
    return;
  }
  bs.t0 -= every;
  if (bs.t0 < 0) bs.t0 = 0;
}

/**
 * One step of a Gravitant (Kind.BossPart, PartType.Gravitant). The first live slot leads: it moves
 * the pair centre toward the target, turns the orbit, places both wells, keeps their pulls and runs
 * the ring clock; the other returns at once. Paused while the ship is down or the boss is staggered.
 */
export function stepGravitant(w: World, id: number, dt: number): void {
  const bs = bossOf(w);
  if (bs === null || bs.status !== 'alive' || !bs.split || !w.ship.active || bs.stagger > 0) return;
  let lead = -1;
  let live = 0;
  for (let k = 0; k < GRAVITANT.count; k++) {
    const p = livePart(w, bs, k);
    if (p < 0) continue;
    live++;
    if (lead < 0) lead = p;
  }
  if (lead !== id) return;
  const adt = bossAdt(w, bs, dt);
  const t = targetOf(w, id);
  let tx = w.x[t] ?? 0;
  let ty = w.y[t] ?? 0;
  const drum = w.surface.topology.wrapU;
  if (drum) {
    // R6 drum: seek the target's image nearest the pair centre (the short way across the seam).
    w.surface.delta(bs.t1, bs.t2, tx, ty, dv);
    tx = bs.t1 + dv.x;
    ty = bs.t2 + dv.y;
  }
  if (Math.hypot(tx - bs.t1, ty - bs.t2) > 1) {
    const a = Math.atan2(ty - bs.t2, tx - bs.t1);
    bs.t1 += Math.cos(a) * GRAVITANT.seekSpeed * dt;
    bs.t2 += Math.sin(a) * GRAVITANT.seekSpeed * dt;
  }
  if (drum) {
    dv.x = bs.t1;
    dv.y = bs.t2;
    w.surface.wrap(dv);
    bs.t1 = dv.x;
  }
  // Two wells orbit each other; the survivor of a pair closes onto the centre.
  bs.t3 = orbitToward(bs.t3, live >= 2 ? GRAVITANT.orbit : 0, dt);
  bs.angle = (bs.angle + GRAVITANT.spin * dt) % TAU;
  for (let k = 0; k < GRAVITANT.count; k++) {
    const p = livePart(w, bs, k);
    if (p < 0) continue;
    const a = bs.angle + k * Math.PI;
    moveTo(w, p, bs.t1 + Math.cos(a) * bs.t3, bs.t2 + Math.sin(a) * bs.t3);
    w.rot[p] = a;
  }
  if (bs.fury === 1) {
    // A split that lands in the break (only a hit past both cracks at once): the pair finishes it.
    bs.furyT += dt;
    if (bs.furyT >= FURY_BREAK_SEC - 1e-9) {
      bs.fury = 2;
      bs.furyT = 0;
      emitFury(w, id, bs, 'on', 0);
    }
  } else if (bs.fury === 2) {
    bs.furyT += dt; // the tide carries on through the split
  }
  for (let k = 0; k < GRAVITANT.count; k++) syncSplitPull(w, bs, k, dt);
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
  } else {
    bs.t0 += adt;
    const every = ringEveryFor(bs.phase);
    if (bs.t0 >= every) fireSplitRing(w, bs, every);
  }
  stepPools(w, bs, bs.t1, bs.t2, adt);
}

export const def: BossDef = { reset, step, onPhase, entryHome, cracks, clampDamage, afterDamage, phaseOf, fury: true };
