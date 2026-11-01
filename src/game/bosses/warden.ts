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
import { removeEntity } from '../remove';
import { angleBetween, distBetween, entityHash, moveHeading, targetOf, turnToward } from '../steer';
import type { World } from '../world';
import { bossEnraged, HAZARD_OVERLAP, spawnHornet, spawnRing } from './core';
import { hazardTelegraph } from './kit';
import { setShield } from './shield';
import { bossOf, type BossState } from './state';
import { ENEMY_BULLET_RADIUS, spawnEnemyBullet } from '../enemyBullets';
import { ENRAGE_RATE, HAZARD, HAZARD_RECHECK_SEC, HORNET, WARDEN, WARDEN_SHIELD } from './table';
import { BossMode, type BossDef } from './types';

const TAU = Math.PI * 2;
const CYCLE = 0;
const INTO = 1;
const BURSTS = 2;
const COUNT = 3;
const SHIELDS = 4;

const DEG = Math.PI / 180;

/** Pure: seconds between rings in a phase. */
export function ringEvery(phase: number): number {
  return phase >= 2 ? WARDEN.ringEveryP2 : WARDEN.ringEvery;
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
  bs.abl[COUNT] = hornetsFor(entityHash(w, id, 1000 + n));
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
  const n = WARDEN_SHIELD.dropRingBullets;
  const r = (w.radius[id] ?? 0) + ENEMY_BULLET_RADIUS;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const a0 = angleBetween(w, id, targetOf(w, id));
  const tele = hazardTelegraph(bs.row.tier);
  let firstId = -1;
  for (let k = 0; k < n; k++) {
    const a = dropRingHeading(a0, k, n);
    const b = spawnEnemyBullet(w, x + Math.cos(a) * r, y + Math.sin(a) * r, a, WARDEN_SHIELD.dropRingSpeed, ENEMY_BULLET_RADIUS, bs.row.tier, tele);
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
  if (h > 0) bs.t1 = hazardTelegraph(bs.row.tier);
}

export function step(w: World, id: number, bs: BossState, dt: number, adt: number): void {
  if (stepShield(w, id, bs, dt)) {
    // Shielded: Warden stops, no rings, the core stays closed.
    bs.open = false;
    bs.openLeft = -1;
    bs.mode = BossMode.Guarded;
    return;
  }
  const target = targetOf(w, id);
  const rot = turnToward(w.rot[id] ?? 0, angleBetween(w, id, target), WARDEN.turnRate * dt);
  w.rot[id] = rot;
  if (distBetween(w, id, target) > 1) moveHeading(w, id, rot, WARDEN.seekSpeed, dt);

  if (bs.t2 > 0) bs.t2 = bs.t2 - dt > 0 ? bs.t2 - dt : 0;
  if (bs.t1 >= 0) {
    bs.t1 -= adt;
    if (bs.t1 < 0) {
      bs.t1 = -1;
      // A ring window never shortens a longer one already open (the window after a shield).
      if (bs.t2 < WARDEN.openSec) bs.t2 = WARDEN.openSec;
    }
  }
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
  } else {
    bs.t0 += adt;
    const every = ringEvery(bs.phase);
    if (bs.t0 >= every) fireRing(w, id, bs, every);
  }
  bs.open = bs.t2 > 0;
  bs.openLeft = bs.open ? bs.t2 : -1;
  bs.mode = bs.open ? BossMode.Vulnerable : BossMode.Guarded;
}

export function onPhase(w: World, id: number, bs: BossState, phase: number): void {
  // The next ring uses the phase 2 interval and gaps; keep the ring clock where it is. The shield
  // clock keeps running too (GW1: restarting it here is what hid the shield on device).
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

export const def: BossDef = { reset, step, onPhase, entryHome };
