// Mirage (tier 2, magenta, level 25; docs/12 roster row 5). Every 3.0 s (2.5 s in phase 2, 2.0 s
// in phase 3) it warps to a point 200 to 300 u from its target. A ring marks the landing point
// 0.5 s early (a marker: telegraph only, never lethal). On landing eight lanes radiate from it,
// one aimed through the ship's position (fury fixes, Ryan 2026-11-12: laneOffsetDeg 0). The aimed
// lane telegraphs MIRAGE.aimedTeleSec (fury tune: 1.2 s, times the Insane scale; w.vy carries it, the
// Lane contract), the other seven the tier telegraph (0.8 s at Normal, w.vy 0), each then 0.3 s
// lethal, so the ship steps out of the aimed lane inside its telegraph; the burst never waits on it. A landing waits 0.3 s and picks
// again while the ship is on the spot. Its shield ring blocks every shot except through a 180 deg
// open arc centred on w.rot, turning at 0.8 rad/s (the gate below). Scratch: t0 warp clock, t1 and
// t2 landing point, t3 marker countdown, n0 marker id, n1 warp counter (hash index), n2 0 idle,
// 1 marked (2 lanes waiting is no longer entered), angle arc centre, retry the old lane recheck.
//
// Mirrors (boss abilities wave): at the stage 2 crack Mirage leaves two mirror images (Kind.BossPart,
// PartType.Mirror, 1 HP, body radius, slots 0 and 1, no contact kill) while the real body keeps
// warping. Each warp records where Mirage left from; 0.6 s later mirror 0 moves to its last position
// and mirror 1 to the one before. Shooting a mirror pops it (parts score 0). Missing mirrors come
// back every 6 s while Mirage lives. 'sim:bossSplit' fires once, at the crack; the body stays (it is
// not a body split: bs.split stays false). Ability scratch (bs.abl): 0 and 1 last position, 2 and 3
// the one before, 4 copy countdown (0 idle), 5 respawn clock, 6 1 once split, 7 positions known.
//
// Fury (shared, fury.ts; fury three): at the stage 1 crack Mirage breaks (stands still, markers and
// lanes gone, core closed, no damage, FURY_BREAK_SEC), phase 2 starts there, then it is enraged to
// its death. False landings (MIRAGE_FURY): every enraged warp shows up to rings landing ring markers
// on the warp candidates (same distance rule), each at least fakeGap u from the others. Which one is
// real reads the world clock and the warp counter through hash01, never the PRNG. The fakes are
// markers only and vanish fakeFadeSec before the landing. Lanes, mirrors and the gate are unchanged.
// Ability scratch: 8 fakes shown, 9 to 12 the fake points (x, y), 13 and 14 the fake marker ids.
import { bus } from '../../core/events';
import { hash01 } from '../../core/rng';
import { isInsideOn } from '../arena';
import type { Surface } from '../../core/surface';
import { removeEntity } from '../remove';
import { SHIP_RADIUS } from '../ship';
import { angleBetween, entityHash, inFrontArc, moveTo, targetOf } from '../steer';
import { Kind, type World } from '../world';
import { crackBody, HAZARD_OVERLAP, livePart, spawnLane, spawnPart, spawnRingMarker } from './core';
import { furyClampDamage, furyDue, furyOnPhase, furyPhaseOf, startFuryBreak, stepFury } from './fury';
import { pointDistOn, wrapPi } from './kit';
import type { BossState } from './state';
import { HAZARD, HAZARD_RECHECK_SEC, MIRAGE, MIRAGE_FURY, MIRROR } from './table';
import { BossMode, PartType, type BossDef } from './types';

const H0X = 0;
const H0Y = 1;
const H1X = 2;
const H1Y = 3;
const COPY = 4;
const RESPAWN = 5;
const SPLIT = 6;
const KNOWN = 7;
const FAKES = 8;
const FAKE_X = 9;
const FAKE_ID = 13;
/** Fake rings at most (MIRAGE_FURY.rings less the real one; the scratch holds two). */
const MAX_FAKES = 2;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** Warp states (BossState.n2). */
export const enum MirageWarp {
  Idle = 0,
  Marked = 1,
  Lanes = 2,
}

/** Pure: seconds between warps in a phase. */
export function warpEveryFor(phase: number): number {
  if (phase >= 3) return MIRAGE.warpEveryP3;
  if (phase === 2) return MIRAGE.warpEveryP2;
  return MIRAGE.warpEvery;
}

/** Pure: half of the open arc, radians. */
export function arcHalf(): number {
  return (MIRAGE.arcDeg * DEG) / 2;
}

/** Pure: true when a hit at (hx, hy) on a body at (x, y) whose arc centre is rot gets through. */
export function throughArc(x: number, y: number, rot: number, hx: number, hy: number, surface?: Surface): boolean {
  return inFrontArc(x, y, rot, hx, hy, arcHalf(), surface);
}

/** Pure: the first lane's angle for a burst, given the bearing from the boss to the ship. */
export function laneStart(toShip: number): number {
  return wrapPi(toShip + MIRAGE.laneOffsetDeg * DEG);
}

/**
 * Pure: candidate landing point k of a warp around a target at (tx, ty), written into out.
 * h1 and h2 in [0, 1) choose the bearing and the distance (200 to 300 u).
 */
export function warpCandidate(tx: number, ty: number, h1: number, h2: number, k: number, out: { x: number; y: number }): void {
  const a = h1 * TAU + (k * TAU) / MIRAGE.warpTries;
  const d = MIRAGE.warpMin + (MIRAGE.warpMax - MIRAGE.warpMin) * h2;
  out.x = tx + Math.cos(a) * d;
  out.y = ty + Math.sin(a) * d;
}

/**
 * Pure: which of n landing rings is the real one, from the world clock (seconds) and the warp
 * counter: hash01 of the clock in whole milliseconds and the counter, never the PRNG.
 */
export function realRingIndex(clock: number, warp: number, n: number): number {
  if (!(n > 1)) return 0;
  const ms = Number.isFinite(clock) && clock > 0 ? Math.floor(clock * 1000) : 0;
  const k = Math.floor(hash01(ms >>> 0, warp >>> 0) * n);
  return k < 0 ? 0 : k >= n ? n - 1 : k;
}

/** Pure: landing rings a warp shows in a fury stage (rings enraged, else 1). */
export function ringsFor(fury: number): number {
  return fury >= 2 ? Math.min(MIRAGE_FURY.rings, MAX_FAKES + 1) : 1;
}

/** Pure: seconds a fake ring shows: the real warning less the fade, so it is gone before the landing. */
export function fakeLife(markSec: number): number {
  const v = markSec - MIRAGE_FURY.fakeFadeSec;
  return v > 0 ? v : 0;
}

const cand = { x: 0, y: 0 };
/** Up to MIRAGE_FURY.rings fitted landing points of one enraged warp (x, y pairs), set at load. */
const ringPts = new Float64Array(2 * (MAX_FAKES + 1));
/** The marker ends with its countdown; inside this tail its absence is expected. */
const MARKER_GRACE = 0.05;

function markerLive(w: World, bs: BossState): boolean {
  const m = bs.n0;
  return m > 0 && w.alive[m] === 1 && w.kind[m] === Kind.BossHazard && bs.hzMarker[m] === 1;
}

function dropMarker(w: World, bs: BossState): void {
  if (markerLive(w, bs)) removeEntity(w, bs.n0);
  bs.n0 = -1;
}

/** Remove the live fake rings and forget them. */
function dropFakes(w: World, bs: BossState): void {
  for (let k = 0; k < MAX_FAKES; k++) {
    const m = bs.abl[FAKE_ID + k] ?? -1;
    if (m > 0 && w.alive[m] === 1 && w.kind[m] === Kind.BossHazard && bs.hzMarker[m] === 1) removeEntity(w, m);
    bs.abl[FAKE_ID + k] = -1;
  }
}

/** Show the fake rings recorded for this warp (markers only; they vanish fakeFadeSec before the landing). */
function showFakes(w: World, id: number, bs: BossState): void {
  dropFakes(w, bs);
  const n = bs.abl[FAKES] ?? 0;
  const life = fakeLife(MIRAGE.markSec);
  for (let k = 0; k < n && k < MAX_FAKES; k++) {
    bs.abl[FAKE_ID + k] = life > 0 ? spawnRingMarker(w, bs, bs.abl[FAKE_X + 2 * k] ?? 0, bs.abl[FAKE_X + 2 * k + 1] ?? 0, w.radius[id] ?? 0, life) : -1;
  }
}

/**
 * Enraged warp: gather up to rings landing points from the candidates (inside the arena, at least
 * fakeGap u apart), pick the real one by realRingIndex, mark it and show the rest as fakes.
 */
function markFury(w: World, id: number, bs: BossState, tx: number, ty: number, h1: number, h2: number, n: number): boolean {
  const r = w.radius[id] ?? 0;
  const want = ringsFor(bs.fury);
  let got = 0;
  for (let k = 0; k < MIRAGE.warpTries && got < want; k++) {
    warpCandidate(tx, ty, h1, h2, k, cand);
    w.surface.wrap(cand);
    if (!isInsideOn(w.surface, w.level.arena, cand.x, cand.y, r)) continue;
    let near = false;
    for (let j = 0; j < got; j++) {
      if (pointDistOn(w.surface, cand.x, cand.y, ringPts[2 * j] ?? 0, ringPts[2 * j + 1] ?? 0) < MIRAGE_FURY.fakeGap) near = true;
    }
    if (near) continue;
    ringPts[2 * got] = cand.x;
    ringPts[2 * got + 1] = cand.y;
    got++;
  }
  if (got === 0) return false;
  const real = realRingIndex(w.time, n, got);
  const x = ringPts[2 * real] ?? 0;
  const y = ringPts[2 * real + 1] ?? 0;
  const m = spawnRingMarker(w, bs, x, y, r, MIRAGE.markSec);
  if (m < 0) return false; // hazard cap: never warp unmarked
  bs.t1 = x;
  bs.t2 = y;
  bs.n0 = m;
  bs.t3 = MIRAGE.markSec;
  bs.n2 = MirageWarp.Marked;
  let f = 0;
  for (let j = 0; j < got; j++) {
    if (j === real) continue;
    bs.abl[FAKE_X + 2 * f] = ringPts[2 * j] ?? 0;
    bs.abl[FAKE_X + 2 * f + 1] = ringPts[2 * j + 1] ?? 0;
    f++;
  }
  bs.abl[FAKES] = f;
  showFakes(w, id, bs); // a fake that hits the hazard cap is skipped: the real ring always shows
  return true;
}

/** Pick a landing point inside the arena and mark it. False when none fits (try again later). */
function mark(w: World, id: number, bs: BossState): boolean {
  const t = targetOf(w, id);
  const tx = w.x[t] ?? 0;
  const ty = w.y[t] ?? 0;
  const r = w.radius[id] ?? 0;
  const n = bs.n1;
  bs.n1 = n + 1;
  const h1 = entityHash(w, id, n * 2);
  const h2 = entityHash(w, id, n * 2 + 1);
  if (bs.fury >= 2) return markFury(w, id, bs, tx, ty, h1, h2, n);
  for (let k = 0; k < MIRAGE.warpTries; k++) {
    warpCandidate(tx, ty, h1, h2, k, cand);
    w.surface.wrap(cand); // R6 drum: a landing point past the seam is its image on the strip (flat: no op)
    if (!isInsideOn(w.surface, w.level.arena, cand.x, cand.y, r)) continue;
    const m = spawnRingMarker(w, bs, cand.x, cand.y, r, MIRAGE.markSec);
    if (m < 0) return false; // hazard cap: never warp unmarked
    bs.t1 = cand.x;
    bs.t2 = cand.y;
    bs.n0 = m;
    bs.t3 = MIRAGE.markSec;
    bs.n2 = MirageWarp.Marked;
    return true;
  }
  return false;
}

/** True when the ship (never the decoy) is clear of the landing spot. */
function spotClear(w: World, bs: BossState, r: number): boolean {
  if (!w.ship.active) return true;
  return pointDistOn(w.surface, w.x[0] ?? 0, w.y[0] ?? 0, bs.t1, bs.t2) > r + SHIP_RADIUS + MIRAGE.landPad;
}

/**
 * One lane of a burst along a. A lane that covers the ship now (the aimed one) is born along the
 * opposite bearing and turned onto a at once: the core refuses a hazard born on the ship, but this
 * lane is meant to cross it, and its full telegraph still runs from its birth before it is lethal.
 * Skipped only when both bearings cover the ship (it is inside the body). Returns the id or -1.
 */
function aimedLane(w: World, bs: BossState, x: number, y: number, a: number): number {
  const h = spawnLane(w, bs, x, y, a, MIRAGE.laneLength, MIRAGE.laneHalfWidth);
  if (h !== HAZARD_OVERLAP) return h;
  const back = spawnLane(w, bs, x, y, wrapPi(a + Math.PI), MIRAGE.laneLength, MIRAGE.laneHalfWidth);
  if (back < 0) return -1;
  w.rot[back] = a;
  return back;
}

/** Pure: the aimed lane's telegraph, s: MIRAGE.aimedTeleSec times the boss telegraph scale (Insane cut). */
export function aimedTele(teleScale: number): number {
  return MIRAGE.aimedTeleSec * teleScale;
}

/**
 * Give lane h the aimed lane's own telegraph: lethal only after aimedTele, then HAZARD.laneLethalSec,
 * and w.vy carries the telegraph seconds (the Lane contract: 0 means the tier telegraph).
 */
function aimLaneTele(w: World, bs: BossState, h: number): void {
  if (h <= 0) return;
  const tele = aimedTele(bs.teleScale);
  bs.hzTele[h] = tele;
  bs.hzLife[h] = tele + HAZARD.laneLethalSec;
  w.vy[h] = tele;
}

/** Fire the eight lane burst, one lane through the ship's position. It never waits on the ship. */
function burst(w: World, id: number, bs: BossState): void {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const a0 = laneStart(angleBetween(w, id, 0)); // lanes are aimed by the ship, never the decoy
  const n = MIRAGE.lanes;
  for (let k = 0; k < n; k++) {
    const h = aimedLane(w, bs, x, y, wrapPi(a0 + (k * TAU) / n));
    if (k === 0) aimLaneTele(w, bs, h); // lane 0 runs through the ship (laneOffsetDeg 0)
  }
  bs.retry = 0;
  bs.n2 = MirageWarp.Idle;
}

export function reset(w: World, id: number, bs: BossState, first: boolean): void {
  if (first) {
    bs.angle = w.rot[id] ?? 0;
    bs.n1 = 0;
  }
  bs.n0 = -1; // the core clears hazards (the marker too) before a restart
  bs.n2 = MirageWarp.Idle;
  bs.t0 = warpEveryFor(bs.phase) - MIRAGE.markSec - MIRAGE.firstWarp;
  bs.t3 = 0;
  bs.retry = 0;
  bs.open = true;
  bs.openLeft = -1;
  bs.mode = BossMode.Attacking;
}

/** Mirage's own break reset: markers and lanes are gone (clearHazards), no warp is pending. */
function onBreak(w: World, id: number, bs: BossState): void {
  bs.n0 = -1;
  bs.n2 = MirageWarp.Idle;
  bs.t3 = 0;
  bs.retry = 0;
  bs.abl[FAKES] = 0;
  dropFakes(w, bs);
}

/** Enraged: the first false landing marks after the entrance lead (firstWarp). */
function onEnrage(w: World, id: number, bs: BossState): void {
  bs.n2 = MirageWarp.Idle;
  bs.t0 = warpEveryFor(bs.phase) - MIRAGE.markSec - MIRAGE.firstWarp;
}

export function step(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  // The break: Mirage stands still, no warps, core closed; then it is enraged.
  if (stepFury(w, id, bs, dt, onEnrage)) return;
  stepWarp(w, id, bs, dt, adt);
  if ((bs.abl[SPLIT] ?? 0) === 1) stepMirrors(w, id, bs, dt);
}

function stepWarp(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  bs.angle = wrapPi(bs.angle + MIRAGE.arcRate * dt);
  w.rot[id] = bs.angle;
  bs.open = true;
  bs.openLeft = -1;
  bs.mode = BossMode.Attacking;
  const every = warpEveryFor(bs.phase);
  if (bs.n2 === MirageWarp.Lanes) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
    if (bs.retry <= 0) burst(w, id, bs);
    return;
  }
  if (bs.n2 === MirageWarp.Marked) {
    if (bs.t3 > MARKER_GRACE && !markerLive(w, bs)) {
      // A bomb or a phase change pause removed the marker: show it again for the full warning.
      const m = spawnRingMarker(w, bs, bs.t1, bs.t2, w.radius[id] ?? 0, MIRAGE.markSec);
      if (m < 0) return;
      bs.n0 = m;
      bs.t3 = MIRAGE.markSec;
      if (bs.fury >= 2) showFakes(w, id, bs); // the false landings show again with it
    }
    bs.t3 -= dt; // the landing warning is never shortened by enrage
    if (bs.t3 > 0) return;
    dropMarker(w, bs);
    dropFakes(w, bs); // already gone by their life; a stale id is cleared
    bs.abl[FAKES] = 0;
    const r = w.radius[id] ?? 0;
    if (!spotClear(w, bs, r)) {
      // The ship is on the spot: wait 0.3 s, then pick and mark a fresh one.
      bs.n2 = MirageWarp.Idle;
      bs.t0 = every - MIRAGE.markSec - HAZARD_RECHECK_SEC;
      return;
    }
    recordDeparture(bs, w.x[id] ?? 0, w.y[id] ?? 0);
    moveTo(w, id, bs.t1, bs.t2);
    bs.t0 = 0;
    burst(w, id, bs);
    return;
  }
  bs.t0 += adt;
  if (bs.t0 < every - MIRAGE.markSec) return;
  if (!mark(w, id, bs)) bs.t0 = every - MIRAGE.markSec - HAZARD_RECHECK_SEC;
}

export function onPhase(w: World, id: number, bs: BossState, phase: number): void {
  // The warp interval reads bs.phase from the next warp on. The break is the phase 2 pause.
  furyOnPhase(bs, phase);
}

/** Hit hook: the break takes no damage, and the crossing hit stops at the stage 1 crack. */
export function clampDamage(w: World, id: number, bs: BossState, amount: number): number {
  return furyClampDamage(w, id, bs, amount);
}

/** After a hit Mirage lived: the break starts the moment the stage 1 bar is empty. */
export function afterDamage(w: World, id: number, bs: BossState): void {
  if (furyDue(w, id, bs)) startFuryBreak(w, id, bs, onBreak);
}

/** Phase hook: phase 2 starts at the break, phase 3 from hit points. */
export function phaseOf(w: World, id: number, bs: BossState, hp: number): number {
  return furyPhaseOf(w, id, bs, hp);
}

/** Shield arc: a hit counts only through the open arc. */
export function gate(w: World, id: number, bs: BossState, hx: number, hy: number): boolean {
  return throughArc(w.x[id] ?? 0, w.y[id] ?? 0, w.rot[id] ?? 0, hx, hy, w.surface);
}

export function entryHome(d: number): number {
  return d * MIRAGE.entryHome;
}

// ---------------------------------------------------------------------------------------------
// Mirrors

/** Record the position Mirage warps away from: the last position becomes the one before. */
export function recordDeparture(bs: BossState, x: number, y: number): void {
  bs.abl[H1X] = bs.abl[H0X] ?? 0;
  bs.abl[H1Y] = bs.abl[H0Y] ?? 0;
  bs.abl[H0X] = x;
  bs.abl[H0Y] = y;
  const known = bs.abl[KNOWN] ?? 0;
  bs.abl[KNOWN] = known >= 2 ? 2 : known + 1;
  if ((bs.abl[SPLIT] ?? 0) === 1) bs.abl[COPY] = MIRROR.delaySec;
}

/** Where mirror k stands: its recorded position, or beside the body while too few are known. */
function mirrorSpot(w: World, id: number, bs: BossState, k: number, out: { x: number; y: number }): void {
  if ((bs.abl[KNOWN] ?? 0) > k) {
    out.x = bs.abl[k === 0 ? H0X : H1X] ?? 0;
    out.y = bs.abl[k === 0 ? H0Y : H1Y] ?? 0;
    return;
  }
  const a = (w.rot[id] ?? 0) + Math.PI / 2 + k * Math.PI;
  out.x = (w.x[id] ?? 0) + Math.cos(a) * MIRROR.fallbackOffset;
  out.y = (w.y[id] ?? 0) + Math.sin(a) * MIRROR.fallbackOffset;
}

const spot = { x: 0, y: 0 };

/** Spawn the missing mirrors at their spots. Returns how many were made. */
function spawnMirrors(w: World, id: number, bs: BossState): number {
  let made = 0;
  for (let k = 0; k < MIRROR.count; k++) {
    if (livePart(w, bs, k) > 0) continue;
    mirrorSpot(w, id, bs, k, spot);
    const p = spawnPart(w, bs, k, PartType.Mirror, spot.x, spot.y, MIRROR.hp, w.radius[id] ?? 0);
    if (p < 0) continue;
    w.rot[p] = w.rot[id] ?? 0;
    made++;
  }
  return made;
}

/** Leave the two mirrors. Called once, from the stage 2 crack. */
function splitMirrors(w: World, id: number, bs: BossState): void {
  bs.abl[SPLIT] = 1;
  bs.abl[COPY] = 0;
  bs.abl[RESPAWN] = 0;
  bs.splitEv.parts = spawnMirrors(w, id, bs);
  bus.emit('sim:bossSplit', bs.splitEv);
}

/** Mirrors follow the delayed copy, take the arc facing, and come back every respawnSec. */
function stepMirrors(w: World, id: number, bs: BossState, dt: number): void {
  const copy = bs.abl[COPY] ?? 0;
  if (copy > 0) {
    const left = copy - dt;
    bs.abl[COPY] = left > 0 ? left : 0;
    if (left <= 0) {
      for (let k = 0; k < MIRROR.count; k++) {
        const p = livePart(w, bs, k);
        if (p < 0) continue;
        mirrorSpot(w, id, bs, k, spot);
        moveTo(w, p, spot.x, spot.y);
      }
    }
  }
  const r = (bs.abl[RESPAWN] ?? 0) + dt;
  if (r >= MIRROR.respawnSec) {
    bs.abl[RESPAWN] = r - MIRROR.respawnSec;
    spawnMirrors(w, id, bs);
  } else {
    bs.abl[RESPAWN] = r;
  }
  for (let k = 0; k < MIRROR.count; k++) {
    const p = livePart(w, bs, k);
    if (p > 0) w.rot[p] = w.rot[id] ?? 0;
  }
}

/** Core hook after the body took damage and lived: report the cracks, leave the mirrors once at stage 2. */
export function cracks(w: World, id: number, bs: BossState): void {
  crackBody(bs, 0, w.hp[id] ?? 0, bs.maxHp, w.x[id] ?? 0, w.y[id] ?? 0);
  if ((bs.abl[SPLIT] ?? 0) === 0 && (bs.crack[0] ?? 0) >= 2) splitMirrors(w, id, bs);
}

export const def: BossDef = { reset, step, onPhase, entryHome, gate, cracks, clampDamage, afterDamage, phaseOf, fury: true };
