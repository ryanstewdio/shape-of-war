// Spindle (tier 1, yellow, level 15; docs/12 roster row 3). Circles the arena centre at radius
// 200 u, 0.4 rad/s. Two sweep arms of 380 u turn at the shot row's rate (0.4 rad/s, the pellet
// trade; 0.5 without it), reversing every 5 s. Each reversal is a fresh sweep, so its 1.0 s
// telegraph (arms frozen, thin and dim) shows the change before the arms move again. Always
// hittable; the arms leave 180 deg gaps. Phase 2 starts at the fury break (below).
// Pellet (BOSS_SHOTS.spindle, docs/13 boss projectiles): one bullet at its target every 3.0 s
// (3.6 s in phase 2), never while an arm telegraph shows or would start before the pellet
// launches, and only with the ship 300 u or more from the muzzle (else it rechecks every 0.3 s).
// Scratch: angle orbit phase, t0 reversal clock, t1 arm angle, dir arm direction (+1 or -1), n0
// live sweep id, n1 rebuild flag, retry the fairness recheck, shotT and shotWait the pellet.
//
// Needles (fury two, SPINDLE_NEEDLES): every arm fights. Each arm tip sheds one enemy bullet every
// 1.2 s of attack time, flung along the sweep tangent, charging for the tier telegraph first. A tip
// within 150 u of the ship or off the floor sheds nothing that time; frozen arms shed nothing.
// Fury (shared, fury.ts): at the stage 1 crack Spindle breaks (stands still, arms gone, core closed,
// no damage, FURY_BREAK_SEC), phase 2 starts there, then it is enraged to its death (SPINDLE_FURY):
// a fourth arm, each sweep at a hashed rate of 0.4 to 0.6 rad/s, a reversal every 3 s (the arm
// telegraph is never shortened) and needles every 0.9 s.
// Ability scratch (bs.abl): 0 needle clock (attack seconds), 1 sweeps built (rate hash index).
import { isInsideOn } from '../arena';
import { ENEMY_BULLET_RADIUS, spawnEnemyBullet } from '../enemyBullets';
import { angleBetween, entityHash, stepToward } from '../steer';
import { Kind, type World } from '../world';
import { HAZARD_OVERLAP, spawnSweep } from './core';
import { furyClampDamage, furyDue, furyOnPhase, furyPhaseOf, startFuryBreak, stepFury } from './fury';
import { pointDistOn, wrapPi } from './kit';
import { bossTele } from './scale';
import { fireVolley } from './shots';
import type { BossState } from './state';
import { BOSS_SHOTS, HAZARD_RECHECK_SEC, SHOT_RECHECK_SEC, SPINDLE, SPINDLE_FURY, SPINDLE_NEEDLES, spindleArmRate, type ShotRow } from './table';
import { BossMode, HazardType, type BossDef } from './types';
import { removeEntity } from '../remove';

const TAU = Math.PI * 2;
const NEEDLE = 0;
const SWEEPS = 1;

/** abl slot of the needle clock (tests hold the needles to isolate the pellet: set it far below 0). */
export const NEEDLE_CLOCK_SLOT = NEEDLE;

/** Pure: arm count in a phase and fury stage (2 enraged: SPINDLE_FURY.arms). */
export function armsFor(phase: number, fury = 0): number {
  if (fury >= 2) return SPINDLE_FURY.arms;
  return phase >= 2 ? SPINDLE.armsP2 : SPINDLE.arms;
}

/** Pure: seconds between reversals in a fury stage. */
export function reverseFor(fury: number): number {
  return fury >= 2 ? SPINDLE_FURY.reverseEvery : SPINDLE.reverseEvery;
}

/** Pure: arm turn rate, rad/s, in a fury stage; enraged from a hash value h in [0, 1). */
export function armRateFor(fury: number, h: number): number {
  if (fury < 2) return spindleArmRate();
  const u = Number.isFinite(h) ? (h < 0 ? 0 : h > 1 ? 1 : h) : 0;
  return SPINDLE_FURY.armRateMin + (SPINDLE_FURY.armRateMax - SPINDLE_FURY.armRateMin) * u;
}

/** Pure: attack seconds between needles from each arm tip in a fury stage. */
export function needleEvery(fury: number): number {
  return fury >= 2 ? SPINDLE_NEEDLES.everyFury : SPINDLE_NEEDLES.every;
}

/** Pure: the heading of a needle shed from an arm at angle a turning at rate (the sweep tangent). */
export function needleHeading(a: number, rate: number): number {
  return a + (rate < 0 ? -Math.PI / 2 : Math.PI / 2);
}

/** Pure: the first arm angle of a fresh sweep of n arms set clear of the ship at bearing toShip. */
export function clearArmAngle(toShip: number, n: number): number {
  return wrapPi(toShip + Math.PI / (n > 0 ? n : 1));
}

/** The live sweep id, or -1. */
export function liveSweep(w: World, bs: BossState): number {
  const id = bs.n0;
  return id > 0 && w.alive[id] === 1 && w.kind[id] === Kind.BossHazard && w.a[id] === HazardType.Sweep ? id : -1;
}

export function reset(w: World, id: number, bs: BossState, first: boolean): void {
  bs.angle = Math.atan2(w.y[id] ?? 0, w.x[id] ?? 0);
  if (first) {
    bs.dir = 1;
    // Start the arms square to the ship so the first sweep is never created on it.
    bs.t1 = wrapPi(angleBetween(w, id, 0) + Math.PI / 2);
    bs.abl[SWEEPS] = 0;
  }
  bs.abl[NEEDLE] = 0;
  bs.n0 = -1;
  bs.n1 = 0;
  bs.t0 = 0;
  bs.retry = 0;
  bs.shotT = 0;
  bs.shotWait = 0;
  bs.open = true;
  bs.openLeft = -1;
  bs.mode = BossMode.Attacking;
}

/**
 * True while an arm telegraph shows (a fresh sweep frozen and dim), is waiting to be placed, or
 * would start before a pellet charged now could launch. old is the live sweep id or -1.
 */
export function armTelegraphNear(w: World, bs: BossState, old: number, dt: number, adt: number): boolean {
  if (old < 0 || bs.retry > 0 || bs.n1 !== 0) return true;
  if ((w.t[old] ?? 0) < (bs.hzTele[old] ?? 0)) return true;
  const rate = dt > 0 ? adt / dt : 1;
  return bs.t0 + bossTele(bs) * rate >= reverseFor(bs.fury);
}

/** Pure: seconds between pellets in a phase for a shot row. */
export function pelletEvery(row: ShotRow, phase: number): number {
  return phase >= 2 ? row.everyP2 : row.every;
}

function stepPellet(w: World, id: number, bs: BossState, old: number, dt: number, adt: number): void {
  const row = BOSS_SHOTS.spindle;
  if (row === undefined || !(row.every > 0)) return; // cut 5: no row, no pellet
  const every = pelletEvery(row, bs.phase);
  if (bs.shotT < every) {
    bs.shotT += adt;
    if (bs.shotT < every) return;
  }
  if (bs.shotWait > 0) {
    bs.shotWait = bs.shotWait - dt > 0 ? bs.shotWait - dt : 0;
    if (bs.shotWait > 0) return;
  }
  if (armTelegraphNear(w, bs, old, dt, adt) || !fireVolley(w, id, bs, row, 1)) {
    bs.shotWait = SHOT_RECHECK_SEC;
    return;
  }
  bs.shotT = 0;
}

/**
 * Needles: once every needleEvery attack seconds each arm tip of the live, turning sweep sheds one
 * enemy bullet along the sweep tangent. A tip off the floor or within shipClear of the ship skips.
 */
function stepNeedles(w: World, id: number, bs: BossState, old: number, adt: number): void {
  if (old < 0 || (w.t[old] ?? 0) < (bs.hzTele[old] ?? 0)) return; // no arms, or frozen in the telegraph
  const every = needleEvery(bs.fury);
  const clock = (bs.abl[NEEDLE] ?? 0) + adt;
  if (clock < every) {
    bs.abl[NEEDLE] = clock;
    return;
  }
  bs.abl[NEEDLE] = clock - every < every ? clock - every : 0;
  shedNeedles(w, id, bs, old);
}

/** One needle from each arm tip of sweep old that is on the floor and clear of the ship. */
export function shedNeedles(w: World, id: number, bs: BossState, old: number): number {
  const n = w.vy[old] ?? 0;
  const len = w.vx[old] ?? 0;
  const rot = w.rot[old] ?? 0;
  const rate = bs.hzRate[old] ?? 0;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const sx = w.x[0] ?? 0;
  const sy = w.y[0] ?? 0;
  const tele = bossTele(bs);
  const speed = SPINDLE_NEEDLES.speed * bs.levelScale;
  let shed = 0;
  for (let k = 0; k < n; k++) {
    const a = rot + (k * TAU) / n;
    const tx = x + Math.cos(a) * len;
    const ty = y + Math.sin(a) * len;
    if (!isInsideOn(w.surface, w.level.arena, tx, ty, ENEMY_BULLET_RADIUS)) continue;
    if (w.ship.active && pointDistOn(w.surface, tx, ty, sx, sy) < SPINDLE_NEEDLES.shipClear) continue;
    if (spawnEnemyBullet(w, tx, ty, needleHeading(a, rate), speed, ENEMY_BULLET_RADIUS, bs.row.tier, tele) >= 0) shed++;
  }
  return shed;
}

/** Spindle's own break reset: the arms are gone (clearHazards), the clocks restart. */
function onBreak(w: World, id: number, bs: BossState): void {
  bs.n0 = -1;
  bs.n1 = 0;
  bs.t0 = 0;
  bs.shotWait = 0;
  bs.abl[NEEDLE] = 0;
}

/** Enraged: a fresh four arm sweep, its arms set clear of the ship. */
function onEnrage(w: World, id: number, bs: BossState): void {
  bs.n1 = 1;
  bs.t0 = 0;
  bs.t1 = clearArmAngle(angleBetween(w, id, 0), SPINDLE_FURY.arms);
}

export function step(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  // The break: Spindle stands still, no arms, no shots, core closed; then it is enraged.
  if (stepFury(w, id, bs, dt, onEnrage)) return;
  bs.angle = wrapPi(bs.angle + SPINDLE.orbitRate * dt);
  stepToward(w, id, Math.cos(bs.angle) * SPINDLE.orbitRadius, Math.sin(bs.angle) * SPINDLE.orbitRadius, SPINDLE.approachSpeed * dt);
  w.rot[id] = wrapPi(bs.angle + Math.PI / 2);
  bs.open = true;
  bs.openLeft = -1;
  bs.mode = BossMode.Attacking;

  const old = liveSweep(w, bs);
  if (old > 0) bs.t1 = w.rot[old] ?? bs.t1;
  stepPellet(w, id, bs, old, dt, adt);
  stepNeedles(w, id, bs, old, adt);
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
    return;
  }
  bs.t0 += adt;
  const every = reverseFor(bs.fury);
  const reverse = bs.t0 >= every;
  if (old > 0 && !reverse && bs.n1 === 0) return;
  const dir = reverse && old > 0 ? -bs.dir : bs.dir;
  const enrage = dt > 0 ? adt / dt : 1;
  const k = bs.abl[SWEEPS] ?? 0;
  const rate = armRateFor(bs.fury, entityHash(w, id, 7000 + k));
  const h = spawnSweep(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, bs.t1, armsFor(bs.phase, bs.fury), SPINDLE.armLength, dir * rate * enrage, true);
  if (h === HAZARD_OVERLAP) {
    bs.retry = HAZARD_RECHECK_SEC;
    return;
  }
  if (reverse) bs.t0 -= every;
  if (h < 0) return; // hazard cap or a full world: keep the old arms, try at the next reversal
  if (old > 0) removeEntity(w, old);
  bs.n0 = h;
  bs.dir = dir;
  bs.n1 = 0;
  bs.abl[SWEEPS] = k + 1;
}

export function onPhase(w: World, id: number, bs: BossState, phase: number): void {
  bs.n1 = 1; // rebuild the sweep with the phase 2 arm count, same direction
  furyOnPhase(bs, phase); // the break is the phase pause
}

/** Hit hook: the break takes no damage, and the crossing hit stops at the stage 1 crack. */
export function clampDamage(w: World, id: number, bs: BossState, amount: number): number {
  return furyClampDamage(w, id, bs, amount);
}

/** After a hit Spindle lived: the break starts the moment the stage 1 bar is empty. */
export function afterDamage(w: World, id: number, bs: BossState): void {
  if (furyDue(w, id, bs)) startFuryBreak(w, id, bs, onBreak);
}

/** Phase hook: phase 2 starts at the break. */
export function phaseOf(w: World, id: number, bs: BossState, hp: number): number {
  return furyPhaseOf(w, id, bs, hp);
}

export function entryHome(d: number): number {
  return Math.min(d, SPINDLE.orbitRadius);
}

export const def: BossDef = { reset, step, onPhase, entryHome, clampDamage, afterDamage, phaseOf, fury: true };
