// Gravitas (tier 2, violet, level 30; docs/12 roster row 6). Seeks its target at 45 u/s with a
// pull around it (radius 300 u, up to 100 u/s, through the well pull channel). Three anchors
// (Kind.BossPart, 6 HP each) orbit it at 140 u: it takes no damage until all three are gone, and
// each lost anchor weakens the pull by a third (none left, no pull). Every 5 s (4 s in phase 2,
// 3 s in phase 3) a ring collapses onto it from 480 u with a 60 deg gap facing the ship. Anchors
// do not regrow and survive a ship death. Scratch: t0 ring clock, angle anchor orbit, n0 pull id,
// retry the ring recheck.
//
// Split (boss abilities wave): at the stage 2 crack the body splits into two half mass wells
// (Kind.BossPart, PartType.Gravitant, 28 u, 160 hits each, slots 0 and 1) that orbit each other
// round a pair centre seeking the target, each with its own pull at half strength. The rings keep
// collapsing onto the pair centre. Contact with a Gravitant kills. The fight ends with the second,
// once; the bar is the sum of the two. Split scratch: t0 ring clock, t1 and t2 pair centre, t3
// orbit radius (opens from 0), angle orbit angle, n0 and n1 the pull ids of slots 0 and 1, retry.
import { bus } from '../../core/events';
import { angleBetween, distBetween, moveHeading, moveTo, targetOf } from '../steer';
import { Kind, type World } from '../world';
import { bossAdt, clearHazards, countParts, crackBody, HAZARD_OVERLAP, livePart, setPullStrength, spawnPart, spawnPull, spawnRing } from './core';
import { bossOf, type BossState } from './state';
import { GRAVITANT, GRAVITAS, HAZARD_RECHECK_SEC, MAX_PARTS } from './table';
import { BossMode, HazardType, PartType, type BossDef } from './types';
import { removeEntity } from '../remove';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

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
function syncPull(w: World, id: number, bs: BossState, anchors: number): void {
  const p = livePull(w, bs);
  const s = pullFor(anchors);
  if (s <= 0) {
    if (p > 0) removeEntity(w, p);
    bs.n0 = -1;
    return;
  }
  if (p > 0) {
    setPullStrength(w, bs, p, s);
    return;
  }
  bs.n0 = spawnPull(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, GRAVITAS.pullRadius, -1, true, s);
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

export function step(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  const target = targetOf(w, id);
  const heading = angleBetween(w, id, target);
  w.rot[id] = heading;
  if (distBetween(w, id, target) > 1) moveHeading(w, id, heading, GRAVITAS.seekSpeed, dt);
  bs.angle = (bs.angle + GRAVITAS.anchorSpin * dt) % TAU;
  placeAnchors(w, id, bs);
  const n = countParts(w, bs);
  syncPull(w, id, bs, n);
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
  } else {
    bs.t0 += adt;
    const every = ringEveryFor(bs.phase);
    if (bs.t0 >= every) fireRing(w, id, bs, every);
  }
  setWindow(bs, n);
}

export function onPhase(w: World, id: number, bs: BossState, phase: number): void {
  // The ring interval reads bs.phase; keep the clock where it is.
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
    const p = spawnPart(w, bs, k, PartType.Gravitant, x, y, GRAVITANT.hp, GRAVITANT.radius);
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
function syncSplitPull(w: World, bs: BossState, k: number): void {
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
    setPullStrength(w, bs, cur, GRAVITANT.pullMax);
    return;
  }
  const made = spawnPull(w, bs, w.x[p] ?? 0, w.y[p] ?? 0, GRAVITANT.pullRadius, -1, false, GRAVITANT.pullMax);
  if (k === 0) bs.n0 = made;
  else bs.n1 = made;
}

/** The pair's ring: collapses onto the pair centre with its gap facing the ship. */
function fireSplitRing(w: World, bs: BossState, every: number): void {
  const toShip = Math.atan2((w.y[0] ?? 0) - bs.t2, (w.x[0] ?? 0) - bs.t1);
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
  const tx = w.x[t] ?? 0;
  const ty = w.y[t] ?? 0;
  if (Math.hypot(tx - bs.t1, ty - bs.t2) > 1) {
    const a = Math.atan2(ty - bs.t2, tx - bs.t1);
    bs.t1 += Math.cos(a) * GRAVITANT.seekSpeed * dt;
    bs.t2 += Math.sin(a) * GRAVITANT.seekSpeed * dt;
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
  for (let k = 0; k < GRAVITANT.count; k++) syncSplitPull(w, bs, k);
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
  } else {
    bs.t0 += adt;
    const every = ringEveryFor(bs.phase);
    if (bs.t0 >= every) fireSplitRing(w, bs, every);
  }
}

export const def: BossDef = { reset, step, onPhase, entryHome, cracks };
