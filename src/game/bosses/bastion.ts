// Bastion (tier 3, red, level 35; docs/12 roster row 7). Holds the arena centre and turns at
// 0.3 rad/s. Four corner turrets (Kind.BossPart, 18 HP each since GW3) sit on the diagonals of its facing and
// take one turn every 1.5 s in order (attack clock, so enrage shortens it); a destroyed turret skips
// its turns, so the total turn rate never changes. A turn fires a lane straight out from the turret.
// The core takes damage only once two turrets are down. Phases follow the turrets (phaseOf): four,
// two, none. Every 12 s a Bulwark joins on the side facing the target. The core never fires.
// Shots (BOSS_SHOTS.bastion, cut 5): each turret alternates a lane and a 200 u/s bullet on its own
// turns, so the turn rate is unchanged, phase 2 has half the bullets and phase 3 none.
// Turret shield and bar (GW3 "turrets too easy, Bastion loses down to 50 percent easily"): each
// turret death shields the live turrets for BASTION.turretShieldSec (hits blocked, partGate) and
// takes BASTION.turretBarShare of maximum hit points off the bar, so turret kills alone move the
// bar 20 percent at most; the old drop to half at waking is gone. Turret shield clock: bs.abl[4].
// Phase 3 (G3C "no longer a threat once disarmed"): when the last turret dies the core wakes. It leaves the centre and pursues
// the target (50 u/s since GW2, see below) with one sweep arm riding the body, and every 5 s (3.5 s after the stage 2
// crack) it stops, shows a lane marker for the tier telegraph and charges along it. Always open.
// Scratch: t0 turn clock, t1 add clock, n0 the turret whose turn is next, n1 the shot bits, retry
// the lane or sweep recheck, shotWait the bullet recheck. Phase 3: t2 charge clock, t3 windup or
// charge seconds left, dir the wake state, angle the charge heading, n2 the sweep id.
// Phase 3 shield (GW2 "unthreatening after its turrets die"): the woken core drifts toward the ship
// at 50 u/s. Every 12 s (start to start, the first 12 s after waking) it stops, raises a shield for
// 3 s (core closed, shots absorbed, 'sim:bossShield') and releases 6 Hornets in two bursts of 3 from
// the shared Hornet pool, then holds still with its core open for 2 s (a timed window). A shield
// that comes due during a wind up or charge waits for it to end. Ability scratch (bs.abl): 0 shield
// cycle clock (step seconds), 1 seconds into the shield, 2 bursts fired, 3 open seconds left.
import * as bulwark from '../enemies/bulwark';
import { angleBetween, moveTo, moveToHit, stepToward, targetOf } from '../steer';
import { Kind, type World } from '../world';
import { countParts, HAZARD_OVERLAP, livePart, spawnAdd, spawnLane, spawnLaneMarker, spawnPart, spawnSweep } from './core';
import { hazardTelegraph, wrapPi } from './kit';
import { setShield } from './shield';
import type { BossState } from './state';
import { fireVolley } from './shots';
import { BASTION, BASTION_SHIELD, BOSS_SHOTS, HAZARD_RECHECK_SEC, SHOT_RECHECK_SEC } from './table';
import { burstSize, releaseHornets } from './warden';
import { BossMode, HazardType, PartType, type BossDef } from './types';

/** Phase 3 wake states (BossState.dir). */
export const enum Wake {
  Pursue = 0,
  Windup = 1,
  Charge = 2,
}

/** Pure: tenths one turret death takes off the bar for a boss of maxHp. */
export function turretBarCut(maxHp: number): number {
  return Math.round(maxHp * BASTION.turretBarShare);
}

/** Pure: the body hit points after a turret death: the cut, never below 1 (a turret never kills the core). */
export function hpAfterTurret(hp: number, maxHp: number): number {
  const left = hp - turretBarCut(maxHp);
  return left > 1 ? left : hp > 1 ? 1 : hp;
}

/** Pure: the turret shield clock after dt seconds. */
export function turretShieldAfter(left: number, dt: number): number {
  return left - dt > 0 ? left - dt : 0;
}

/** Pure: seconds between charges for a crack stage (shorter after the stage 2 crack). */
export function chargeEveryFor(crack: number): number {
  return crack >= 2 ? BASTION.chargeEveryCracked : BASTION.chargeEvery;
}

const CYCLE = 0;
const INTO = 1;
const BURSTS = 2;
const OPEN = 3;
/** bs.abl slot of the turret shield clock (seconds left). */
export const TURRET_SHIELD = 4;

/** Pure: the phase 3 shield cycle clock at waking, so the first shield comes firstSec after it. */
export function shieldClockStart(): number {
  return BASTION_SHIELD.everySec - BASTION_SHIELD.firstSec;
}

function wakeReset(w: World, id: number, bs: BossState): void {
  bs.t2 = BASTION.chargeEvery - BASTION.firstCharge;
  bs.t3 = 0;
  bs.dir = Wake.Pursue;
  bs.n2 = -1;
  bs.retry = 0;
  bs.abl[CYCLE] = shieldClockStart();
  bs.abl[INTO] = 0;
  bs.abl[BURSTS] = 0;
  bs.abl[OPEN] = 0;
  setShield(bs, false, w.x[id] ?? 0, w.y[id] ?? 0, 0);
}

/**
 * Phase 3 shield step. Returns true while the shield is up or its open window runs (Bastion holds
 * still, no charge). The cycle clock runs on step time through everything, so shields keep their
 * cadence; a due shield waits only while a wind up or charge is under way.
 */
function stepShield(w: World, id: number, bs: BossState, dt: number): boolean {
  bs.abl[CYCLE] = (bs.abl[CYCLE] ?? 0) + dt;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  if (!bs.shielded) {
    const open = bs.abl[OPEN] ?? 0;
    if (open > 0) {
      const left = open - dt > 0 ? open - dt : 0;
      bs.abl[OPEN] = left;
      if (left > 0) {
        bs.open = true;
        bs.openLeft = left;
        bs.mode = BossMode.Vulnerable;
        return true;
      }
    }
    if ((bs.abl[CYCLE] ?? 0) < BASTION_SHIELD.everySec - 1e-9 || bs.dir !== Wake.Pursue) return false;
    bs.abl[CYCLE] = (bs.abl[CYCLE] ?? 0) - BASTION_SHIELD.everySec;
    bs.abl[INTO] = 0;
    bs.abl[BURSTS] = 0;
    setShield(bs, true, x, y, BASTION_SHIELD.shieldSec);
  }
  const into = (bs.abl[INTO] ?? 0) + dt;
  bs.abl[INTO] = into;
  const at = BASTION_SHIELD.burstAt;
  let b = bs.abl[BURSTS] ?? 0;
  while (b < at.length && into >= (at[b] ?? Infinity)) {
    releaseHornets(w, id, bs, burstSize(BASTION_SHIELD.hornets, b), b);
    b++;
  }
  bs.abl[BURSTS] = b;
  const left = BASTION_SHIELD.shieldSec - into;
  if (left > 0) {
    bs.shieldLeft = left;
    bs.open = false;
    bs.openLeft = -1;
    bs.mode = BossMode.Guarded;
    return true;
  }
  // The shield drops: the open window starts now.
  setShield(bs, false, x, y, 0);
  bs.abl[OPEN] = BASTION_SHIELD.openSec;
  bs.open = true;
  bs.openLeft = BASTION_SHIELD.openSec;
  bs.mode = BossMode.Vulnerable;
  return true;
}

function sweepAlive(w: World, bs: BossState): boolean {
  const h = bs.n2;
  return h > 0 && w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Sweep;
}

/** Keep the sweep arm on the body (it returns after a bomb), born pointing away from the target. */
function ensureSweep(w: World, id: number, bs: BossState, dt: number): void {
  if (sweepAlive(w, bs)) return;
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
    return;
  }
  const a = wrapPi(angleBetween(w, id, targetOf(w, id)) + Math.PI);
  const r = spawnSweep(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, a, 1, BASTION.sweepLength, BASTION.sweepRate, true);
  if (r === HAZARD_OVERLAP) bs.retry = HAZARD_RECHECK_SEC;
  else if (r > 0) bs.n2 = r;
}

/** Phase 3: pursue, wind up behind a lane marker, charge. */
function stepAwake(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  ensureSweep(w, id, bs, dt);
  if (stepShield(w, id, bs, dt)) return;
  if (bs.dir === Wake.Windup) {
    bs.t3 -= adt;
    if (bs.t3 > 0) return;
    bs.dir = Wake.Charge;
    bs.t3 = BASTION.chargeSec;
    return;
  }
  if (bs.dir === Wake.Charge) {
    const s = BASTION.chargeSpeed * dt;
    const hit = moveToHit(w, id, (w.x[id] ?? 0) + Math.cos(bs.angle) * s, (w.y[id] ?? 0) + Math.sin(bs.angle) * s);
    bs.t3 -= dt;
    if (hit || bs.t3 <= 0) bs.dir = Wake.Pursue;
    return;
  }
  const tgt = targetOf(w, id);
  stepToward(w, id, w.x[tgt] ?? 0, w.y[tgt] ?? 0, BASTION.wakeSpeed * dt);
  bs.t2 += adt;
  if (bs.t2 < chargeEveryFor(bs.crack[0] ?? 0)) return;
  const a = angleBetween(w, id, tgt);
  const len = BASTION.chargeSpeed * BASTION.chargeSec + (w.radius[id] ?? 0);
  if (spawnLaneMarker(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, a, len, BASTION.chargeMarkerHalf) < 0) {
    bs.t2 -= HAZARD_RECHECK_SEC; // no marker, no charge: try again shortly
    return;
  }
  bs.t2 = 0;
  bs.angle = a;
  bs.dir = Wake.Windup;
  bs.t3 = hazardTelegraph(bs.row.tier);
}

const QUARTER = Math.PI / 2;

/** Pure: the phase for live turrets: 1 with three or four, 2 with one or two, 3 with none. */
export function phaseForTurrets(turrets: number): number {
  if (turrets > BASTION.openAtTurrets) return 1;
  return turrets > 0 ? 2 : 3;
}

/** Pure: the core takes damage once two turrets are down. */
export function isOpen(turrets: number): boolean {
  return turrets <= BASTION.openAtTurrets;
}

/** Pure: the outward angle of turret slot k for a core facing rot. */
export function turretAngle(rot: number, k: number): number {
  return wrapPi(rot + QUARTER / 2 + k * QUARTER);
}

function placeTurrets(w: World, id: number, bs: BossState, spawnNew: boolean): void {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const rot = w.rot[id] ?? 0;
  for (let k = 0; k < BASTION.turrets; k++) {
    const a = turretAngle(rot, k);
    const tx = x + Math.cos(a) * BASTION.turretOffset;
    const ty = y + Math.sin(a) * BASTION.turretOffset;
    let p = livePart(w, bs, k);
    if (p < 0 && spawnNew) p = spawnPart(w, bs, k, PartType.Turret, tx, ty, BASTION.turretHp, BASTION.turretRadius);
    if (p < 0) continue;
    moveTo(w, p, tx, ty);
    w.rot[p] = a;
  }
}

function setWindow(bs: BossState, turrets: number): void {
  bs.open = isOpen(turrets);
  bs.openLeft = -1;
  bs.mode = bs.open ? BossMode.Vulnerable : BossMode.Guarded;
}

/** Pure: with the shot row, turret k fires a bullet on this turn (its turns alternate, a lane first). */
export function isShotTurn(toggles: number, k: number, hasRow: boolean): boolean {
  return hasRow && (toggles & (1 << k)) !== 0;
}

/**
 * Turret p (slot k)'s action on its turn. True once done (or dropped at a cap); false when it must
 * wait and recheck (the lane would cover the ship now, or the ship is within 300 u of the muzzle).
 * With the shot row each turret alternates a lane and a bullet on its own turns (BossState.n1 holds
 * one bit per turret); the bullet's heading is fixed now, at the charge start, toward targetOf.
 */
function fireTurret(w: World, bs: BossState, p: number, k: number): boolean {
  const row = BOSS_SHOTS.bastion;
  const hasRow = row !== undefined && row.pattern === 'turret';
  if (row !== undefined && isShotTurn(bs.n1, k, hasRow)) {
    if (!fireVolley(w, p, bs, row, 1)) {
      bs.shotWait = SHOT_RECHECK_SEC;
      return false;
    }
    bs.n1 &= ~(1 << k);
    return true;
  }
  if (!fireLane(w, bs, p)) return false;
  if (hasRow) bs.n1 |= 1 << k;
  return true;
}

function fireLane(w: World, bs: BossState, p: number): boolean {
  const a = w.rot[p] ?? 0;
  const x = (w.x[p] ?? 0) + Math.cos(a) * BASTION.turretRadius;
  const y = (w.y[p] ?? 0) + Math.sin(a) * BASTION.turretRadius;
  if (spawnLane(w, bs, x, y, a, BASTION.laneLength, BASTION.laneHalfWidth) === HAZARD_OVERLAP) {
    bs.retry = HAZARD_RECHECK_SEC;
    return false;
  }
  return true;
}

/** One turn every turnEvery seconds, the turrets in order; a destroyed turret's turn passes silently. */
function stepTurns(w: World, bs: BossState, dt: number, adt: number): void {
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
    if (bs.retry > 0) return;
  } else if (bs.shotWait > 0) {
    bs.shotWait = bs.shotWait - dt > 0 ? bs.shotWait - dt : 0;
    if (bs.shotWait > 0) return;
  } else {
    bs.t0 += adt;
    if (bs.t0 < BASTION.turnEvery) return;
  }
  const k = bs.n0;
  const p = livePart(w, bs, k);
  if (p > 0 && !fireTurret(w, bs, p, k)) return;
  bs.n0 = (k + 1) % BASTION.turrets;
  bs.t0 -= BASTION.turnEvery;
  if (bs.t0 < 0) bs.t0 = 0;
}

function summon(w: World, id: number, bs: BossState): void {
  const a = angleBetween(w, id, targetOf(w, id));
  const d = (w.radius[id] ?? 0) + BASTION.addPad + bulwark.def.radius;
  spawnAdd(w, bs, bulwark.def, (w.x[id] ?? 0) + Math.cos(a) * d, (w.y[id] ?? 0) + Math.sin(a) * d);
}

export function reset(w: World, id: number, bs: BossState, first: boolean): void {
  bs.t0 = BASTION.turnEvery - BASTION.firstTurn;
  bs.n0 = 0;
  bs.retry = 0;
  bs.shotT = 0;
  bs.shotWait = 0;
  if (first) {
    bs.t1 = 0;
    bs.n1 = 0;
    placeTurrets(w, id, bs, true);
  }
  wakeReset(w, id, bs); // phase 3 restarts its cycle too (the core clears the sweep)
  setWindow(bs, countParts(w, bs));
}

export function step(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  bs.abl[TURRET_SHIELD] = turretShieldAfter(bs.abl[TURRET_SHIELD] ?? 0, dt);
  w.rot[id] = wrapPi((w.rot[id] ?? 0) + BASTION.turnRate * dt);
  placeTurrets(w, id, bs, false);
  const n = countParts(w, bs);
  setWindow(bs, n);
  if (n > 0) stepTurns(w, bs, dt, adt);
  else stepAwake(w, id, bs, dt, adt);
  bs.t1 += adt;
  if (bs.t1 >= BASTION.addEvery) {
    bs.t1 -= BASTION.addEvery;
    summon(w, id, bs);
  }
}

export function onPhase(w: World, id: number, bs: BossState, phase: number): void {
  // Phases read the turrets; the turn clock keeps running. Phase 3 wakes the core.
  if (phase < 3) return;
  wakeReset(w, id, bs);
}

export function phaseOf(w: World, id: number, bs: BossState, hp: number): number {
  return phaseForTurrets(countParts(w, bs));
}

export function entryHome(d: number): number {
  return 0;
}

/**
 * A turret break updates the window at once, so the hit that follows lands even before the next
 * step; it takes its share off the bar and shields the turrets left. Runs before the core syncs the
 * phase and the cracks, so both read the new hit points.
 */
export function onPartDamage(w: World, bs: BossState, part: number, applied: number, broke: boolean): void {
  if (!broke) return;
  const id = bs.id;
  if (id > 0 && w.alive[id] === 1) w.hp[id] = hpAfterTurret(w.hp[id] ?? 0, bs.maxHp);
  const n = countParts(w, bs);
  if (n > 0) bs.abl[TURRET_SHIELD] = BASTION.turretShieldSec;
  setWindow(bs, n);
}

/** Pure: a turret hit lands only when the turret shield is down. */
export function turretOpen(shieldLeft: number): boolean {
  return shieldLeft <= 0;
}

export function partGate(w: World, bs: BossState, part: number): boolean {
  return turretOpen(bs.abl[TURRET_SHIELD] ?? 0);
}

export const def: BossDef = { reset, step, onPhase, entryHome, phaseOf, onPartDamage, partGate };
