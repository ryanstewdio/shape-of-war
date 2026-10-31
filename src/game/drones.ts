// Drones (docs/01 section 4.4). One per level from LevelDef.drone. Invulnerable, not pulled by
// wells, absent while the ship is dead. Attack orbits and fires; Collect trails and vacuums
// geoms; Ram orbits and charges.
//
// V3 wave D (docs/13 SPEC 3.5 "Drone pickups"): a separate pickup (Kind.DronePickup, first at
// scoring kill 30, then every 40) arms the drone for 20 s in one of four modes chosen by a salted
// hash: homing (its shots home), detach (it leaves the ship for a post and is a decoy: chasers in
// range follow it through targetOf), rapid (10 volleys a second, rapid style) or double (a second
// body, Kind.DroneTwin, at the opposite phase). Armed, every drone type fires one shot per volley at
// the nearest enemy or boss within 450 u. A new pickup replaces the mode and restarts the 20 s.
// The pickup and the twin are stepped here (no registered behaviour), so nothing else changes.
import { bus, DRONE_MODES, type DroneMode } from '../core/events';
import { hash01 } from '../core/rng';
import { confine, createConfineResult } from './arena';
import { BULLET_LIFE, BULLET_SPEED, spawnBullet, STYLE_RAPID } from './bullets';
import { BOSS_DAMAGE } from './bosses/table';
import { isBossTarget } from './bosses/core';
import { damageAny, isTargetable } from './combat';
import type { EnemyDef } from './enemies/types';
import { collectNear, PICKUP_RADIUS } from './geoms';
import { removeEntity } from './remove';
import { gs, spawnFromDef } from './state';
import { setDecoy } from './steer';
import { Kind, spawn, type World } from './world';

export const def: EnemyDef = { kind: Kind.Drone, radius: 8, speed: 0, value: 0, colour: 'white', hp: 1, geoms: 0 };
/** The double mode's second body: invulnerable, not targetable, 8 u. */
export const twinDef: EnemyDef = { kind: Kind.DroneTwin, radius: 8, speed: 0, value: 0, colour: 'white', hp: 1, geoms: 0 };

export const ORBIT_RADIUS = 60;
export const ORBIT_REV_PER_SEC = 1.5;
export const ATTACK_RANGE = 450;
export const ATTACK_RATE = 4;
export const COLLECT_TRAIL = 50;
export const COLLECT_MAGNET = 260;
export const COLLECT_PULL = 900;
export const RAM_RANGE = 400;
export const RAM_CHARGE = 700;
export const RAM_RETURN = 900;
export const RAM_DAMAGE = 2;
export const RAM_COOLDOWN = 1.2;

/** Nearest targetable enemy to (x, y) within range, excluding snake segments and wells. -1 if none. */
export function nearestEnemy(w: World, x: number, y: number, range: number): number {
  let best = -1;
  let bestD = range * range;
  for (let id = 1; id < w.cap; id++) {
    if (!isTargetable(w, id) && !isBossTarget(w, id)) continue;
    const k = w.kind[id] ?? 0;
    if (k === Kind.SnakeBody || k === Kind.GravityWell) continue;
    const dx = (w.x[id] ?? 0) - x;
    const dy = (w.y[id] ?? 0) - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD) {
      bestD = d2;
      best = id;
    }
  }
  return best;
}

function orbit(w: World, id: number, dt: number): void {
  const g = gs(w);
  g.droneAngle = (g.droneAngle + ORBIT_REV_PER_SEC * 2 * Math.PI * dt) % (2 * Math.PI);
  w.x[id] = (w.x[0] ?? 0) + Math.cos(g.droneAngle) * ORBIT_RADIUS;
  w.y[id] = (w.y[0] ?? 0) + Math.sin(g.droneAngle) * ORBIT_RADIUS;
  w.rot[id] = g.droneAngle;
}

function stepAttack(w: World, id: number, dt: number): void {
  const g = gs(w);
  orbit(w, id, dt);
  g.droneCooldown -= dt;
  if (g.droneCooldown > 0) return;
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const target = nearestEnemy(w, x, y, ATTACK_RANGE);
  if (target < 0) {
    g.droneCooldown = 0;
    return;
  }
  const dx = (w.x[target] ?? 0) - x;
  const dy = (w.y[target] ?? 0) - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-6) spawnBullet(w.bullets, x, y, (dx / d) * BULLET_SPEED, (dy / d) * BULLET_SPEED, BULLET_LIFE);
  g.droneCooldown += 1 / ATTACK_RATE;
  if (g.droneCooldown < 0) g.droneCooldown = 0;
}

function stepCollect(w: World, id: number): void {
  const r = w.rot[0] ?? 0;
  const x = (w.x[0] ?? 0) - Math.cos(r) * COLLECT_TRAIL;
  const y = (w.y[0] ?? 0) - Math.sin(r) * COLLECT_TRAIL;
  w.x[id] = x;
  w.y[id] = y;
  w.rot[id] = r;
  const m2 = COLLECT_MAGNET * COLLECT_MAGNET;
  for (let i = 1; i < w.cap; i++) {
    if (w.alive[i] !== 1 || w.kind[i] !== Kind.Geom) continue;
    const dx = x - (w.x[i] ?? 0);
    const dy = y - (w.y[i] ?? 0);
    const d2 = dx * dx + dy * dy;
    if (d2 > m2 || d2 < 1e-9) continue;
    const d = Math.sqrt(d2);
    w.vx[i] = (dx / d) * COLLECT_PULL;
    w.vy[i] = (dy / d) * COLLECT_PULL;
  }
  collectNear(w, x, y, PICKUP_RADIUS);
}

function moveToward(w: World, id: number, tx: number, ty: number, speed: number, dt: number): number {
  const dx = tx - (w.x[id] ?? 0);
  const dy = ty - (w.y[id] ?? 0);
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) return 0;
  const s = Math.min(d, speed * dt);
  w.x[id] = (w.x[id] ?? 0) + (dx / d) * s;
  w.y[id] = (w.y[id] ?? 0) + (dy / d) * s;
  w.rot[id] = Math.atan2(dy, dx);
  return d - s;
}

function stepRam(w: World, id: number, dt: number): void {
  const g = gs(w);
  if (g.droneCooldown > 0) g.droneCooldown -= dt;
  if (g.dronePhase === 1) {
    const t = g.droneTarget;
    if (t <= 0 || !(isTargetable(w, t) || isBossTarget(w, t))) {
      g.dronePhase = 2;
    } else {
      const left = moveToward(w, id, w.x[t] ?? 0, w.y[t] ?? 0, RAM_CHARGE, dt);
      if (left <= def.radius + (w.radius[t] ?? 0)) {
        damageAny(w, t, RAM_DAMAGE, BOSS_DAMAGE.ram, w.x[id] ?? 0, w.y[id] ?? 0); // lands on the drone's side
        g.dronePhase = 2;
        g.droneCooldown = RAM_COOLDOWN;
      }
      return;
    }
  }
  if (g.dronePhase === 2) {
    g.droneAngle = (g.droneAngle + ORBIT_REV_PER_SEC * 2 * Math.PI * dt) % (2 * Math.PI);
    const ox = (w.x[0] ?? 0) + Math.cos(g.droneAngle) * ORBIT_RADIUS;
    const oy = (w.y[0] ?? 0) + Math.sin(g.droneAngle) * ORBIT_RADIUS;
    if (moveToward(w, id, ox, oy, RAM_RETURN, dt) < 4) g.dronePhase = 0;
    return;
  }
  orbit(w, id, dt);
  if (g.droneCooldown > 0) return;
  const t = nearestEnemy(w, w.x[id] ?? 0, w.y[id] ?? 0, RAM_RANGE);
  if (t > 0) {
    g.droneTarget = t;
    g.dronePhase = 1;
  }
}

/** Spawn or hide the drone with the ship, then run its behaviour. Call after stepWorld. */
export function stepDrone(w: World, dt: number): void {
  const g = gs(w);
  stepDronePickup(w, dt);
  if (!w.ship.active || g.outcome !== 'running') {
    if (g.droneId > 0) removeEntity(w, g.droneId);
    dropArm(w);
    return;
  }
  let id = g.droneId;
  if (id <= 0 || w.alive[id] !== 1 || w.kind[id] !== Kind.Drone) {
    // Absent (Detonate): no decoy and no twin while it is gone; the arm timer keeps running.
    const s = droneArm(w);
    if (s.detach !== Detach.None) {
      s.detach = Detach.None;
      setDecoy(w, -1);
    }
    removeTwin(w);
    if (s.mode !== null) {
      s.timer -= dt;
      if (s.timer <= 1e-9) disarm(w, s, true);
    }
    if (g.droneAbsent > 0) return; // Detonate: back at the ship once the absence ends
    id = spawnFromDef(w, def, (w.x[0] ?? 0) + ORBIT_RADIUS, w.y[0] ?? 0, 0);
    g.droneId = id;
    g.droneCooldown = 0;
    g.dronePhase = 0;
    g.droneTarget = -1;
    if (id < 0) return;
  }
  const armed = droneArm(w).mode !== null;
  // A detached (or returning) drone only holds its post and fires: no vacuum, no ram, no own gun.
  if (!stepArmed(w, id, dt)) {
    switch (w.level.drone) {
      case 'attack':
        if (armed) orbit(w, id, dt);
        else stepAttack(w, id, dt); // armed, the attack drone's own shot is the armed volley
        break;
      case 'collect':
        stepCollect(w, id);
        break;
      case 'ram':
        stepRam(w, id, dt);
        break;
    }
  }
  if (w.alive[id] === 1) stepArmedGun(w, id, dt);
  // The twin follows the drone's orbit angle of this step (set by the behaviour above).
  if (droneArm(w).mode === 'double') stepTwin(w, droneArm(w), dt);
}

// ---------------------------------------------------------------------------------------------
// Drone pickups and armed modes (v3 wave D)

export const DRONE_ARM_SEC = 20;
export const FIRST_DRONE_DROP = 30;
export const DRONE_DROP_EVERY = 40;
export const DRONE_PICKUP_LIFE = 8;
export const DRONE_PICKUP_COLLECT = 28;
export const DRONE_PICKUP_RADIUS = 14;
/** Salt of the mode hash: 'DRON'. */
export const DRONE_SALT = 0x44524f4e;
export const DRONE_HUD_INTERVAL = 0.1;

export interface DroneModeSpec {
  /** Volleys a second of the armed gun. */
  rate: number;
}

/** Starting numbers (docs/13 "Drone pickups" rule 4), tuned at G3D. */
export const DRONE_MODE_TABLE: Readonly<Record<DroneMode, DroneModeSpec>> = {
  homing: { rate: 4 },
  detach: { rate: 4 },
  rapid: { rate: 10 },
  double: { rate: 4 },
};
/** Display names Ryan edits. */
export const DRONE_MODE_NAMES: Readonly<Record<DroneMode, string>> = { homing: 'Homing', detach: 'Detach', rapid: 'Rapid', double: 'Double' };
/** Detach: the post sits this far from the ship along the aim; out and back speeds. */
export const DETACH_POST = 280;
export const DETACH_OUT = RAM_CHARGE;
export const DETACH_BACK = RAM_RETURN;
/** Aimed boss bullets take their aim from targetOf too (boss code reads it; this documents the default). */
export const DECOY_DIVERTS_BOSS_AIM = true;

/** Detach states. */
export const enum Detach {
  None = 0,
  /** Leaving for the post or holding it: the decoy is live. */
  Out = 1,
  /** Coming back to the orbit after expiry or replacement: no decoy. */
  Back = 2,
}

export interface DroneArmState {
  /** Armed mode, null when unarmed. */
  mode: DroneMode | null;
  timer: number;
  kills: number;
  nextDropAt: number;
  pending: boolean;
  dropIndex: number;
  lastDrop: DroneMode | null;
  pickupId: number;
  detach: Detach;
  postX: number;
  postY: number;
  gunCool: number;
  twinCool: number;
  hudTimer: number;
  armFx: { x: number; y: number; mode: DroneMode; secondsLeft: number };
  expireFx: { x: number; y: number; mode: DroneMode };
  hud: { mode: DroneMode; remaining: number; total: number };
}

const arms = new WeakMap<World, DroneArmState>();

/** The drone arming state of a world, created on first use. */
export function droneArm(w: World): DroneArmState {
  let s = arms.get(w);
  if (s === undefined) {
    s = {
      mode: null,
      timer: 0,
      kills: 0,
      nextDropAt: FIRST_DRONE_DROP,
      pending: false,
      dropIndex: 0,
      lastDrop: null,
      pickupId: -1,
      detach: Detach.None,
      postX: 0,
      postY: 0,
      gunCool: 0,
      twinCool: 0,
      hudTimer: 0,
      armFx: { x: 0, y: 0, mode: 'homing', secondsLeft: DRONE_ARM_SEC },
      expireFx: { x: 0, y: 0, mode: 'homing' },
      hud: { mode: 'homing', remaining: 0, total: DRONE_ARM_SEC },
    };
    arms.set(w, s);
  }
  return s;
}

/**
 * Pure: the mode of drone drop dropIndex: DRONE_MODES[floor(hash01(seed ^ DRONE_SALT, n) x 4)],
 * stepping one place on when it repeats the previous drop.
 */
export function chooseDroneMode(seed: number, dropIndex: number, previous: DroneMode | null): DroneMode {
  const n = DRONE_MODES.length;
  let i = Math.min(n - 1, Math.floor(hash01((seed ^ DRONE_SALT) >>> 0, dropIndex) * n));
  if (DRONE_MODES[i] === previous) i = (i + 1) % n;
  return DRONE_MODES[i] ?? 'homing';
}

/** Live drone pickup id, or -1. */
export function liveDronePickup(w: World): number {
  const id = droneArm(w).pickupId;
  return id > 0 && w.alive[id] === 1 && w.kind[id] === Kind.DronePickup ? id : -1;
}

/** Spawn the next drone drop at (x, y). Render contract: w.a mode index, w.t life left, radius 14. */
export function spawnDronePickup(w: World, x: number, y: number): number {
  const s = droneArm(w);
  const mode = chooseDroneMode(w.level.seed, s.dropIndex, s.lastDrop);
  const id = spawn(w, Kind.DronePickup, x, y);
  if (id < 0) return -1;
  w.radius[id] = DRONE_PICKUP_RADIUS;
  w.t[id] = DRONE_PICKUP_LIFE;
  w.a[id] = DRONE_MODES.indexOf(mode);
  w.vx[id] = 0;
  w.vy[id] = 0;
  s.pickupId = id;
  s.dropIndex++;
  s.lastDrop = mode;
  s.pending = false;
  return id;
}

/** Scoring kill hook (from pickup.onScoringKill, which returns early with pickups off). */
export function onDroneKill(w: World, x: number, y: number): void {
  const s = droneArm(w);
  s.kills++;
  if (s.kills >= s.nextDropAt) {
    s.pending = true;
    s.nextDropAt += DRONE_DROP_EVERY;
  }
  if (s.pending && liveDronePickup(w) < 0) spawnDronePickup(w, x, y);
}

function removeTwin(w: World): void {
  const g = gs(w);
  const t = g.droneTwinId;
  if (t > 0 && w.alive[t] === 1 && w.kind[t] === Kind.DroneTwin) removeEntity(w, t);
  g.droneTwinId = -1;
}

const postRes = createConfineResult();

/** The detach post: DETACH_POST from the ship along the aim (the facing if the stick is idle), inside the arena. */
function setPost(w: World, s: DroneArmState): void {
  const a = w.ship.firing ? w.ship.aimAngle : (w.rot[0] ?? 0);
  const r = confine(w.level.arena, (w.x[0] ?? 0) + Math.cos(a) * DETACH_POST, (w.y[0] ?? 0) + Math.sin(a) * DETACH_POST, def.radius, postRes);
  s.postX = r.x;
  s.postY = r.y;
}

function emitDroneHud(s: DroneArmState): void {
  s.hudTimer = DRONE_HUD_INTERVAL;
  if (s.mode !== null) s.hud.mode = s.mode;
  s.hud.remaining = s.mode === null ? 0 : Math.max(0, s.timer);
  bus.emit('hud:droneWeapon', s.hud);
}

/** End the armed mode: the decoy goes home, the twin goes. expired emits 'fx:droneExpire'. */
function disarm(w: World, s: DroneArmState, expired: boolean): void {
  const mode = s.mode;
  if (mode === null) return;
  if (s.detach === Detach.Out) s.detach = Detach.Back;
  setDecoy(w, -1);
  removeTwin(w);
  s.mode = null;
  s.timer = 0;
  if (expired) {
    const d = gs(w).droneId;
    s.expireFx.x = d > 0 ? (w.x[d] ?? 0) : (w.x[0] ?? 0);
    s.expireFx.y = d > 0 ? (w.y[d] ?? 0) : (w.y[0] ?? 0);
    s.expireFx.mode = mode;
    bus.emit('fx:droneExpire', s.expireFx);
  }
  emitDroneHud(s);
}

/** Arm the drone with mode for 20 s (a new pickup replaces the old mode, docs/13 rule 7). */
export function armDrone(w: World, mode: DroneMode, x: number, y: number): void {
  const s = droneArm(w);
  if (s.mode === 'double' && mode !== 'double') removeTwin(w);
  if (s.mode === 'detach' && mode !== 'detach') {
    s.detach = Detach.Back;
    setDecoy(w, -1);
  }
  s.mode = mode;
  s.timer = DRONE_ARM_SEC;
  s.gunCool = 0;
  s.twinCool = 0;
  if (mode === 'detach') {
    setPost(w, s);
    s.detach = Detach.Out;
  }
  s.armFx.x = x;
  s.armFx.y = y;
  s.armFx.mode = mode;
  s.armFx.secondsLeft = DRONE_ARM_SEC;
  bus.emit('fx:droneArm', s.armFx);
  emitDroneHud(s);
}

/** Drone pickup step: count its life down, expire, or arm when the live ship is within 28 u. */
function stepDronePickup(w: World, dt: number): void {
  const s = droneArm(w);
  const id = liveDronePickup(w);
  if (id < 0) return;
  const t = (w.t[id] ?? 0) - dt;
  if (t <= 0) {
    removeEntity(w, id);
    s.pickupId = -1;
    return;
  }
  w.t[id] = t;
  if (!w.ship.active) return;
  const dx = (w.x[0] ?? 0) - (w.x[id] ?? 0);
  const dy = (w.y[0] ?? 0) - (w.y[id] ?? 0);
  if (dx * dx + dy * dy > DRONE_PICKUP_COLLECT * DRONE_PICKUP_COLLECT) return;
  const mode = DRONE_MODES[w.a[id] ?? 0] ?? 'homing';
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  removeEntity(w, id);
  s.pickupId = -1;
  armDrone(w, mode, x, y);
}

/** One armed shot from (x, y) at the nearest enemy or boss in range. Returns true if it fired. */
function armedShot(w: World, x: number, y: number, mode: DroneMode): boolean {
  const target = nearestEnemy(w, x, y, ATTACK_RANGE);
  if (target < 0) return false;
  const dx = (w.x[target] ?? 0) - x;
  const dy = (w.y[target] ?? 0) - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= 1e-6) return false;
  const b = spawnBullet(w.bullets, x, y, (dx / d) * BULLET_SPEED, (dy / d) * BULLET_SPEED, BULLET_LIFE);
  if (b < 0) return true;
  if (mode === 'homing') w.bullets.homing[b] = 1;
  if (mode === 'rapid') w.bullets.style[b] = STYLE_RAPID;
  return true;
}

/** The armed gun of a body at (x, y) on cooldown cool; returns the new cooldown. */
function armedGun(w: World, x: number, y: number, mode: DroneMode, cool: number, dt: number): number {
  let c = cool - dt;
  if (c > 0) return c;
  if (!armedShot(w, x, y, mode)) return 0;
  c += 1 / DRONE_MODE_TABLE[mode].rate;
  return c < 0 ? 0 : c;
}

/** Detach: fly out to the post (decoy live) or back to the orbit. Returns true while it owns the drone. */
function stepDetach(w: World, id: number, s: DroneArmState, dt: number): boolean {
  if (s.detach === Detach.Out) {
    moveToward(w, id, s.postX, s.postY, DETACH_OUT, dt);
    return true;
  }
  if (s.detach === Detach.Back) {
    const g = gs(w);
    g.droneAngle = (g.droneAngle + ORBIT_REV_PER_SEC * 2 * Math.PI * dt) % (2 * Math.PI);
    const ox = (w.x[0] ?? 0) + Math.cos(g.droneAngle) * ORBIT_RADIUS;
    const oy = (w.y[0] ?? 0) + Math.sin(g.droneAngle) * ORBIT_RADIUS;
    if (moveToward(w, id, ox, oy, DETACH_BACK, dt) < 4) s.detach = Detach.None;
    return true;
  }
  return false;
}

/** Double: keep the twin at the opposite phase of the orbit (spawning it when missing). */
function stepTwin(w: World, s: DroneArmState, dt: number): void {
  const g = gs(w);
  let t = g.droneTwinId;
  const a = g.droneAngle + Math.PI;
  const x = (w.x[0] ?? 0) + Math.cos(a) * ORBIT_RADIUS;
  const y = (w.y[0] ?? 0) + Math.sin(a) * ORBIT_RADIUS;
  if (t <= 0 || w.alive[t] !== 1 || w.kind[t] !== Kind.DroneTwin) {
    t = spawnFromDef(w, twinDef, x, y, 0);
    g.droneTwinId = t;
    if (t < 0) return;
  }
  w.x[t] = x;
  w.y[t] = y;
  w.rot[t] = a;
  s.twinCool = armedGun(w, x, y, 'double', s.twinCool, dt);
}

/** Arm timer, the expiry, the hud and the armed behaviour for one step. id is the live drone. */
function stepArmed(w: World, id: number, dt: number): boolean {
  const s = droneArm(w);
  if (s.mode === null) return s.detach !== Detach.None && stepDetach(w, id, s, dt);
  s.timer -= dt;
  if (s.timer <= 1e-9) {
    disarm(w, s, true);
    return s.detach !== Detach.None && stepDetach(w, id, s, dt);
  }
  s.hudTimer -= dt;
  if (s.hudTimer <= 0) emitDroneHud(s);
  const mode = s.mode;
  let owned = false;
  if (mode === 'detach') {
    if (s.detach === Detach.None) {
      // Back from a Detonate absence: the mode applies again, so it departs again.
      setPost(w, s);
      s.detach = Detach.Out;
    }
    owned = stepDetach(w, id, s, dt);
    setDecoy(w, s.detach === Detach.Out ? id : -1);
  } else if (s.detach !== Detach.None) {
    owned = stepDetach(w, id, s, dt);
  }
  return owned;
}

/** Armed gun of the main body after its own behaviour moved it. */
function stepArmedGun(w: World, id: number, dt: number): void {
  const s = droneArm(w);
  if (s.mode === null) return;
  s.gunCool = armedGun(w, w.x[id] ?? 0, w.y[id] ?? 0, s.mode, s.gunCool, dt);
}

/** Ship death or level end: the mode ends with no expiry event, the decoy and twin go. */
function dropArm(w: World): void {
  const s = droneArm(w);
  if (s.mode !== null) disarm(w, s, false);
  s.detach = Detach.None;
  setDecoy(w, -1);
  removeTwin(w);
}
