// Warden (tier 1, blue, level 5; docs/12 roster row 1). Seeks its target at 55 u/s, turning at
// most 60 deg/s. Every 4.5 s it fires a ring with a 70 deg gap facing the ship. A shell blocks every
// shot except for 2 s after each ring launches (its telegraph ends), when the core opens. Phase 2
// (below 50 percent): a ring every 3.5 s with two gaps, the second opposite the first.
// Scratch: t0 ring clock, t1 seconds until the launched ring opens the core (-1 idle), t2 open
// seconds left, retry the fairness recheck.
//
// Shield and swarm (GW1: every phase): the first shield goes up 10 s into the fight, then one every
// 14 s, start to start. Warden stops, its core closes for 4 s (BossState.shielded, shieldLeft) and
// it releases 8 Hornets in two bursts of 4, "like bees leaving a hive" (Kind.BossPart
// PartType.Hornet in their own pool of MAX_HORNETS, so other adds never take their slots). When the
// shield drops the core is open for WARDEN_SHIELD.openSec (2.0 s since GW2): a guaranteed window.
// GW1 device report: the shield never showed because it ran only in phase 2 and its clock restarted
// at the phase change, so the first shield came 14 s after half health and the fight ended first.
// Hornets fly straight out, then chase their target at 300 u/s and die on their own after 5 s.
// GW2 (fairness 5 of 5, target 4): 520 hits, rings every 3.7 s (2.8 s in phase 2), 10 Hornets per
// shield in two bursts of 5, a 2.0 s window after the shield, and in phase 2 the dropping shield
// fires one ring of 12 enemy bullets. 'sim:bossShield' fires on every shield edge (shield.ts).
// Ability scratch (bs.abl): 0 shield cycle clock (step seconds since the last shield start), 1
// seconds into the shield, 2 bursts fired, 3 Hornets this shield, 4 shields so far (hash index).
//
// Fury (Ryan 2026-11-11, every mode): when the Shield bar empties (hp below CRACK_AT[0], the stage 1
// crack) Warden breaks. It stops, clears its rings and Hornets, closes its core and takes no damage
// for FURY_BREAK_SEC (clampDamage returns 0); phase 2 starts with the break (phaseOf), and the
// break replaces the phase change pause. Then it is enraged to its death (WARDEN_FURY): faster seek,
// turn and rings, and a dash charge: it stops and aims (heading locked toward the ship), dashes
// along it until a wall or the dash time ends, fires one ring of bullets and opens its core. A dash
// never starts while a shield is up or the ship is respawning, and a shield waits for a dash to end
// (its clock keeps running). BossState.fury and furyT hold the stage; a ship death keeps it.
// Fury scratch (bs.abl): 5 dash clock (seconds to the next dash), 6 dash state (0 idle, 1 aim,
// 2 dash), 7 seconds left in the aim or dash, 8 locked dash heading.
import { removeEntity } from '../remove';
import { angleBetween, distBetween, entityHash, moveHeading, targetOf, turnToward } from '../steer';
import type { World } from '../world';
import { bus } from '../../core/events';
import { moveToHit } from '../steer';
import { bossEnraged, clearHazards, clearHornets, HAZARD_OVERLAP, spawnHornet, spawnRing } from './core';
import { bossTele, minionCount } from './scale';
import { setShield } from './shield';
import { bossOf, type BossState } from './state';
import { ENEMY_BULLET_RADIUS, spawnEnemyBullet } from '../enemyBullets';
import { CRACK_AT, ENRAGE_RATE, FURY_BREAK_SEC, HAZARD, HAZARD_RECHECK_SEC, HORNET, MAX_HORNETS, WARDEN, WARDEN_FURY, WARDEN_SHIELD } from './table';
import { BossMode, type BossDef } from './types';

const TAU = Math.PI * 2;
const CYCLE = 0;
const INTO = 1;
const BURSTS = 2;
const COUNT = 3;
const SHIELDS = 4;
const DASH_CLOCK = 5;
const DASH_STATE = 6;
const DASH_LEFT = 7;
const DASH_HEAD = 8;

/** abl slot of the dash clock (tests hold the dash to isolate the shield or the rings). */
export const DASH_CLOCK_SLOT = DASH_CLOCK;
/** abl slot of the shield cycle clock (tests hold the shield to isolate the dash). */
export const SHIELD_CLOCK_SLOT = CYCLE;

/** Dash states (abl[DASH_STATE]). */
const IDLE = 0;
const AIM = 1;
const DASH = 2;

const DEG = Math.PI / 180;

/** Pure: seconds between rings in a phase, and fury stage (2 enraged: WARDEN_FURY.ringEvery). */
export function ringEvery(phase: number, fury = 0): number {
  if (fury >= 2) return WARDEN_FURY.ringEvery;
  return phase >= 2 ? WARDEN.ringEveryP2 : WARDEN.ringEvery;
}

/** Pure: seek speed, u/s, in a fury stage (enraged from stage 2). */
export function seekSpeedFor(fury: number): number {
  return fury >= 2 ? WARDEN_FURY.seekSpeed : WARDEN.seekSpeed;
}

/** Pure: turn rate, rad/s, in a fury stage (enraged from stage 2). */
export function turnRateFor(fury: number): number {
  return fury >= 2 ? WARDEN_FURY.turnRate : WARDEN.turnRate;
}

/**
 * Pure: the hit points (tenths) Warden's body stops at when the Shield bar empties: the largest whole
 * value below CRACK_AT[0] of maxHp, so the stage 1 crack and the break land on the same hit.
 */
export function furyBreakHp(maxHp: number): number {
  if (!(maxHp > 0)) return 0;
  const v = Math.ceil(maxHp * CRACK_AT[0] - 1e-9) - 1;
  return v > 0 ? v : 0;
}

/** Pure: tenths of a hit of amount that land on a body at hp in fury stage fury (maxHp its maximum). */
export function furyClamp(fury: number, hp: number, maxHp: number, amount: number): number {
  if (fury === 1) return 0; // the break: no hit moves the bar
  if (fury !== 0) return amount;
  const room = hp - furyBreakHp(maxHp);
  return room > 0 && amount > room ? room : amount; // the crossing hit stops where the Shield bar empties
}

/** Seconds of dash aim left, -1 when not aiming (BossView.dashAim). */
export function dashAimOf(bs: BossState): number {
  return (bs.abl[DASH_STATE] ?? IDLE) === AIM ? (bs.abl[DASH_LEFT] ?? 0) : -1;
}

/** The locked dash heading in radians (BossView.dashHeading). */
export function dashHeadingOf(bs: BossState): number {
  return bs.abl[DASH_HEAD] ?? 0;
}

/** True while Warden aims or dashes. */
export function dashing(bs: BossState): boolean {
  return (bs.abl[DASH_STATE] ?? IDLE) !== IDLE;
}

/** Pure: gaps per ring in a phase. */
export function ringGaps(phase: number): number {
  return phase >= 2 ? WARDEN.gapsP2 : 1;
}

/** Pure: the shield is part of Warden's cycle in every phase (GW1). */
export function shieldActive(phase: number): boolean {
  return phase >= 1;
}

/** Pure: the shield cycle clock at the start of the fight, so the first shield comes at firstSec. */
export function shieldClockStart(): number {
  return WARDEN_SHIELD.everySec - WARDEN_SHIELD.firstSec;
}

/** Pure: Hornets for a shield from a hash value h in [0, 1), within hornetsMin to hornetsMax. */
export function hornetsFor(h: number): number {
  const span = WARDEN_SHIELD.hornetsMax - WARDEN_SHIELD.hornetsMin + 1;
  const k = Math.floor((Number.isFinite(h) ? h : 0) * span);
  return WARDEN_SHIELD.hornetsMin + (k < 0 ? 0 : k >= span ? span - 1 : k);
}

/** Pure: Hornets in burst b (0 or 1) of a shield releasing total: the first burst takes the larger half. */
export function burstSize(total: number, b: number): number {
  const first = Math.ceil(total / 2);
  return b === 0 ? first : total - first;
}

export function reset(w: World, id: number, bs: BossState, first: boolean): void {
  bs.t0 = WARDEN.ringEvery - WARDEN.firstRing;
  bs.t1 = -1;
  bs.t2 = 0;
  bs.retry = 0;
  bs.open = false;
  bs.openLeft = -1;
  bs.mode = BossMode.Guarded;
  // Boss rule 6: the cycle restarts, the shield clock too (Hornets are cleared with the adds), so
  // the first shield after a restart also comes firstSec in.
  bs.abl[CYCLE] = shieldClockStart();
  bs.abl[INTO] = 0;
  bs.abl[BURSTS] = 0;
  setShield(bs, false, w.x[id] ?? 0, w.y[id] ?? 0, 0);
  if (first) bs.abl[SHIELDS] = 0;
  // Fury: the stage reached survives a ship death restart; the dash cycle restarts, its first dash
  // dashFirst after the restart. The entrance (first) starts with no fury.
  if (first) {
    bs.fury = 0;
    bs.furyT = 0;
    bs.abl[DASH_HEAD] = 0;
  }
  bs.abl[DASH_CLOCK] = WARDEN_FURY.dashFirst;
  bs.abl[DASH_STATE] = IDLE;
  bs.abl[DASH_LEFT] = 0;
}

function emitFury(w: World, id: number, bs: BossState, stage: 'break' | 'on', sec: number): void {
  const e = bs.furyEv;
  e.id = bs.spec.id;
  e.stage = stage;
  e.sec = sec;
  e.x = w.x[id] ?? 0;
  e.y = w.y[id] ?? 0;
  bus.emit('sim:bossFury', e);
}

/** The Shield bar emptied: the invincible break starts ('sim:bossFury' break, once). */
function startBreak(w: World, id: number, bs: BossState): void {
  bs.fury = 1;
  bs.furyT = 0;
  clearHazards(w); // Warden's own live rings
  clearHornets(w, bs);
  setShield(bs, false, w.x[id] ?? 0, w.y[id] ?? 0, 0);
  bs.abl[INTO] = 0;
  bs.abl[BURSTS] = 0;
  bs.abl[DASH_STATE] = IDLE;
  bs.t1 = -1;
  bs.t2 = 0;
  bs.retry = 0;
  bs.open = false;
  bs.openLeft = -1;
  bs.mode = BossMode.Guarded;
  emitFury(w, id, bs, 'break', FURY_BREAK_SEC);
}

/** Hit hook: the break takes no damage, and the crossing hit stops where the Shield bar empties. */
export function clampDamage(w: World, id: number, bs: BossState, amount: number): number {
  return furyClamp(bs.fury, w.hp[id] ?? 0, bs.maxHp, amount);
}

/** After a hit Warden lived: the break starts the moment the Shield bar is empty. */
export function afterDamage(w: World, id: number, bs: BossState): void {
  if (bs.fury === 0 && (w.hp[id] ?? 0) <= furyBreakHp(bs.maxHp)) startBreak(w, id, bs);
}

/** Phase hook: phase 2 starts at the break (not at half health). */
export function phaseOf(w: World, id: number, bs: BossState): number {
  return bs.fury >= 1 ? 2 : 1;
}

/** Release burst b: Hornets spread evenly round the body, flying straight out. */
function releaseBurst(w: World, id: number, bs: BossState, b: number): void {
  releaseHornets(w, id, bs, burstSize(bs.abl[COUNT] ?? WARDEN_SHIELD.hornetsMin, b), b);
}

/**
 * Release n Hornets from boss id, spread evenly round the body and flying straight out, into the
 * shared Hornet pool (MAX_HORNETS). Burst b above 0 sits between the first burst's lanes. Bastion's
 * phase 3 shield uses it too (GW2).
 */
export function releaseHornets(w: World, id: number, bs: BossState, n: number, b: number): void {
  if (n <= 0) return;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const d = (w.radius[id] ?? 0) + HORNET.spawnPad + HORNET.radius;
  // The second burst sits between the first burst's lanes.
  const a0 = angleBetween(w, id, targetOf(w, id)) + (b === 0 ? 0 : Math.PI / n);
  for (let k = 0; k < n; k++) {
    const a = a0 + (k * TAU) / n;
    if (spawnHornet(w, bs, x + Math.cos(a) * d, y + Math.sin(a) * d, a) < 0) return; // Hornet cap or full world
  }
}

function startShield(w: World, id: number, bs: BossState): void {
  const n = bs.abl[SHIELDS] ?? 0;
  bs.abl[SHIELDS] = n + 1;
  // R1: the Hornet count scales with the difficulty's addScale, inside the Hornet pool.
  bs.abl[COUNT] = minionCount(hornetsFor(entityHash(w, id, 1000 + n)), bs.addScale, MAX_HORNETS);
  bs.abl[INTO] = 0;
  bs.abl[BURSTS] = 0;
  setShield(bs, true, w.x[id] ?? 0, w.y[id] ?? 0, WARDEN_SHIELD.shieldSec);
  // The core closes: any open window or pending ring window ends.
  bs.t1 = -1;
  bs.t2 = 0;
}

/**
 * One shield step. Returns true while the shield is up (the rest of the cycle waits). The clock runs
 * on step time (dt, not the enraged rate) and keeps running through the shield, so shields start
 * exactly everySec apart whatever the add pressure.
 */
function stepShield(w: World, id: number, bs: BossState, dt: number): boolean {
  if (!shieldActive(bs.phase)) return false;
  bs.abl[CYCLE] = (bs.abl[CYCLE] ?? 0) + dt;
  if (!bs.shielded) {
    if (dashing(bs)) return false; // a due shield waits for the dash to end; its clock keeps running
    if ((bs.abl[CYCLE] ?? 0) < WARDEN_SHIELD.everySec - 1e-9) return false;
    bs.abl[CYCLE] = (bs.abl[CYCLE] ?? 0) - WARDEN_SHIELD.everySec;
    startShield(w, id, bs);
  }
  const into = (bs.abl[INTO] ?? 0) + dt;
  bs.abl[INTO] = into;
  const burstAt = WARDEN_SHIELD.burstAt;
  let b = bs.abl[BURSTS] ?? 0;
  while (b < burstAt.length && into >= (burstAt[b] ?? Infinity)) {
    releaseBurst(w, id, bs, b);
    b++;
  }
  bs.abl[BURSTS] = b;
  const left = WARDEN_SHIELD.shieldSec - into;
  if (left > 0) {
    bs.shieldLeft = left;
    return true;
  }
  // The shield drops: a guaranteed window, and in phase 2 a ring of bullets.
  setShield(bs, false, w.x[id] ?? 0, w.y[id] ?? 0, 0);
  bs.t2 = WARDEN_SHIELD.openSec;
  if (dropRingActive(bs.phase)) fireDropRing(w, id, bs);
  return false;
}

/** Pure: the dropping shield fires its bullet ring in phase 2 only (GW2). */
export function dropRingActive(phase: number): boolean {
  return phase >= 2;
}

/** Pure: heading of bullet k of the drop ring, the first one facing heading (spacing TAU / n). */
export function dropRingHeading(heading: number, k: number, n: number): number {
  return heading + (k * TAU) / (n > 0 ? n : 1);
}

/**
 * Phase 2 shield drop (GW2): dropRingBullets enemy bullets evenly round the body edge, the first
 * facing the target, each charging for the tier telegraph before it launches (a charging bullet never
 * collides). fx:bossShot fires once at launch through the shared volley report.
 */
function fireDropRing(w: World, id: number, bs: BossState): void {
  fireBulletRing(w, id, bs, WARDEN_SHIELD.dropRingBullets, WARDEN_SHIELD.dropRingSpeed);
}

/** n enemy bullets evenly round the body edge, the first facing the target (drop ring, dash ring). */
function fireBulletRing(w: World, id: number, bs: BossState, n: number, speed: number): void {
  const r = (w.radius[id] ?? 0) + ENEMY_BULLET_RADIUS;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const a0 = angleBetween(w, id, targetOf(w, id));
  const tele = bossTele(bs);
  let firstId = -1;
  for (let k = 0; k < n; k++) {
    const a = dropRingHeading(a0, k, n);
    const b = spawnEnemyBullet(w, x + Math.cos(a) * r, y + Math.sin(a) * r, a, speed * bs.levelScale, ENEMY_BULLET_RADIUS, bs.row.tier, tele);
    if (firstId < 0) firstId = b;
  }
  if (firstId >= 0) {
    bs.shotId = firstId;
    bs.shotEv.x = x;
    bs.shotEv.y = y;
  }
}

function fireRing(w: World, id: number, bs: BossState, every: number): void {
  // The gap faces the ship, never the decoy: a hazard must always leave the ship a route.
  const h = spawnRing(
    w,
    bs,
    w.x[id] ?? 0,
    w.y[id] ?? 0,
    (w.radius[id] ?? 0) + WARDEN.ringStartPad,
    angleBetween(w, id, 0),
    (WARDEN.gapDeg * DEG) / 2,
    ringGaps(bs.phase),
    HAZARD.ringGrowth,
  );
  if (h === HAZARD_OVERLAP) {
    bs.retry = HAZARD_RECHECK_SEC;
    return;
  }
  bs.t0 -= every;
  if (bs.t0 < 0) bs.t0 = 0;
  if (h > 0) bs.t1 = bossTele(bs);
}

/** Open-window and ring-window clocks (shared by the normal step and the dash). */
function stepWindows(bs: BossState, dt: number, adt: number): void {
  if (bs.t2 > 0) bs.t2 = bs.t2 - dt > 0 ? bs.t2 - dt : 0;
  if (bs.t1 >= 0) {
    bs.t1 -= adt;
    if (bs.t1 < 0) {
      bs.t1 = -1;
      // A ring window never shortens a longer one already open (the window after a shield).
      if (bs.t2 < WARDEN.openSec) bs.t2 = WARDEN.openSec;
    }
  }
}

function setOpenFromWindow(bs: BossState): void {
  bs.open = bs.t2 > 0;
  bs.openLeft = bs.open ? bs.t2 : -1;
  bs.mode = bs.open ? BossMode.Vulnerable : BossMode.Guarded;
}

/** Start the dash aim: Warden stops, the heading locks toward the ship. */
function startAim(w: World, id: number, bs: BossState): void {
  const head = angleBetween(w, id, 0);
  bs.abl[DASH_STATE] = AIM;
  bs.abl[DASH_LEFT] = WARDEN_FURY.aimSec;
  bs.abl[DASH_HEAD] = head;
  bs.abl[DASH_CLOCK] = WARDEN_FURY.dashEvery; // start to start
  w.rot[id] = head;
}

/** One aim or dash step. The rings wait; the window clocks run; the shield clock keeps running. */
function stepDash(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  if (shieldActive(bs.phase)) bs.abl[CYCLE] = (bs.abl[CYCLE] ?? 0) + dt;
  bs.abl[DASH_CLOCK] = (bs.abl[DASH_CLOCK] ?? 0) - dt;
  stepWindows(bs, dt, adt);
  const head = bs.abl[DASH_HEAD] ?? 0;
  w.rot[id] = head;
  const left = (bs.abl[DASH_LEFT] ?? 0) - dt; // never shortened by enrage (the aim is a telegraph)
  if ((bs.abl[DASH_STATE] ?? IDLE) === AIM) {
    if (left > 0) {
      bs.abl[DASH_LEFT] = left;
    } else {
      bs.abl[DASH_STATE] = DASH;
      bs.abl[DASH_LEFT] = WARDEN_FURY.dashSec;
    }
  } else {
    const sp = WARDEN_FURY.dashSpeed;
    const hit = moveToHit(w, id, (w.x[id] ?? 0) + Math.cos(head) * sp * dt, (w.y[id] ?? 0) + Math.sin(head) * sp * dt);
    bs.abl[DASH_LEFT] = left;
    if (hit || left <= 0) {
      bs.abl[DASH_STATE] = IDLE;
      bs.abl[DASH_LEFT] = 0;
      fireBulletRing(w, id, bs, WARDEN_FURY.dashRingBullets, WARDEN_FURY.dashRingSpeed);
      if (bs.t2 < WARDEN_FURY.openSec) bs.t2 = WARDEN_FURY.openSec; // the reward window
    }
  }
  setOpenFromWindow(bs);
}

export function step(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  if (bs.fury === 1) {
    // The break: Warden stands still, core closed, no rings, no shield; then it is enraged.
    bs.furyT += dt;
    bs.open = false;
    bs.openLeft = -1;
    bs.mode = BossMode.Guarded;
    if (bs.furyT < FURY_BREAK_SEC - 1e-9) return;
    bs.fury = 2;
    bs.furyT = 0;
    bs.abl[DASH_CLOCK] = WARDEN_FURY.dashFirst;
    bs.abl[DASH_STATE] = IDLE;
    emitFury(w, id, bs, 'on', 0);
    return;
  }
  if (bs.fury === 2) bs.furyT += dt;
  if (dashing(bs)) {
    stepDash(w, id, bs, dt, adt);
    return;
  }
  if (stepShield(w, id, bs, dt)) {
    // Shielded: Warden stops, no rings, the core stays closed.
    bs.open = false;
    bs.openLeft = -1;
    bs.mode = BossMode.Guarded;
    return;
  }
  if (bs.fury === 2) {
    // Enraged: the dash comes due on step time; never while the ship is respawning (invulnerable).
    const clock = (bs.abl[DASH_CLOCK] ?? 0) - dt;
    bs.abl[DASH_CLOCK] = clock;
    if (clock <= 0 && w.ship.active && w.ship.invuln <= 0) {
      startAim(w, id, bs);
      stepWindows(bs, dt, adt);
      setOpenFromWindow(bs);
      return;
    }
  }
  const target = targetOf(w, id);
  const rot = turnToward(w.rot[id] ?? 0, angleBetween(w, id, target), turnRateFor(bs.fury) * dt);
  w.rot[id] = rot;
  if (distBetween(w, id, target) > 1) moveHeading(w, id, rot, seekSpeedFor(bs.fury), dt);

  stepWindows(bs, dt, adt);
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
  } else {
    bs.t0 += adt;
    const every = ringEvery(bs.phase, bs.fury);
    if (bs.t0 >= every) fireRing(w, id, bs, every);
  }
  setOpenFromWindow(bs);
}

export function onPhase(w: World, id: number, bs: BossState, phase: number): void {
  // The next ring uses the phase 2 interval and gaps; keep the ring clock where it is. The shield
  // clock keeps running too (GW1: restarting it here is what hid the shield on device). Fury: phase
  // 2 starts with the break, which is the pause (Warden stands still), so no second pause stacks.
  if (bs.fury >= 1) bs.phaseT = 0;
}

/**
 * One step of a Hornet (Kind.BossPart, PartType.Hornet): straight out of the hive for leaveSec,
 * then turn limited chase of its target at full speed, gone on its own at lifeSec. Paused while the
 * boss is staggered (a bomb clears them anyway). Its age is w.t (the part pulse clock).
 */
export function stepHornet(w: World, id: number, dt: number): void {
  const bs = bossOf(w);
  if (bs === null || bs.status !== 'alive' || !w.ship.active || bs.stagger > 0) return;
  const age = w.t[id] ?? 0;
  if (age >= HORNET.lifeSec) {
    removeEntity(w, id);
    return;
  }
  const rate = bossEnraged(w) ? ENRAGE_RATE : 1;
  let rot = w.rot[id] ?? 0;
  if (age >= HORNET.leaveSec) {
    rot = turnToward(rot, angleBetween(w, id, targetOf(w, id)), HORNET.turnRate * rate * dt);
    w.rot[id] = rot;
  }
  moveHeading(w, id, rot, HORNET.speed, dt);
}

export function entryHome(d: number): number {
  return d * WARDEN.entryHome;
}

export const def: BossDef = { reset, step, onPhase, entryHome, clampDamage, afterDamage, phaseOf };
