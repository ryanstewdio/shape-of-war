// Weapon pickup entity (docs/11 SPEC 3.5 rules 1 and 2). Dropped at a scoring kill position on
// the drop schedule in weapons.ts, lives 8 s, collected within 28 u of the ship centre. One live at
// a time. Bombs, wells, drones and ship death leave it alone; level end clears it.
// Render contract (docs/10): w.a = weapon index (0 spread, 1 rapid, 2 pierce, 3 orbit), w.t =
// seconds of life left, w.radius = 14. V3 wave D: spread drops only while a weapon is active, a
// collection goes through the combining rules, and the drone pickup counts the same kills.
import { bus } from '../core/events';
import { onDroneKill } from './drones';
import { removeEntity } from './remove';
import { gs } from './state';
import { chooseDrop, countKill, equipWeapon, weaponArmed, weaponAt, weaponIndex, weaponPool, weaponState } from './weapons';
import { Kind, spawn, type World } from './world';

export const PICKUP_LIFE = 8;
export const PICKUP_COLLECT_RADIUS = 28;
export const PICKUP_RADIUS = 14;

/** Live pickup id, or -1. */
export function livePickup(w: World): number {
  const id = weaponState(w).pickupId;
  return id > 0 && w.alive[id] === 1 && w.kind[id] === Kind.WeaponPickup ? id : -1;
}

/** Spawn the next scheduled drop at (x, y). Returns the id or -1 (world full). */
export function spawnPickup(w: World, x: number, y: number): number {
  const s = weaponState(w);
  const pool = weaponPool(w.level.band, gs(w).mode === 'endless', weaponArmed(w));
  const kind = chooseDrop(w.level.seed, s.dropIndex, pool, s.lastDrop);
  const id = spawn(w, Kind.WeaponPickup, x, y);
  if (id < 0) return -1;
  w.radius[id] = PICKUP_RADIUS;
  w.t[id] = PICKUP_LIFE;
  w.a[id] = weaponIndex(kind);
  s.pickupId = id;
  s.dropIndex++;
  s.lastDrop = kind;
  s.pending = false;
  return id;
}

/**
 * Scoring kill hook (combat.killEnemy). Counts the kill and spawns a due drop at the kill
 * position when no pickup is live. Does nothing while pickups are off.
 */
export function onScoringKill(w: World, x: number, y: number): void {
  const s = weaponState(w);
  if (!s.pickupsOn) return;
  countKill(s, weaponArmed(w));
  if (s.pending && livePickup(w) < 0) spawnPickup(w, x, y);
  onDroneKill(w, x, y);
}

/**
 * Collect the pickup: equip or combine its weapon, emit 'fx:pickup', remove it. A spread pickup
 * with no weapon active changes nothing: no timer, no event (docs/13 "Combining" rule 2).
 */
export function collectPickup(w: World, id: number): void {
  const s = weaponState(w);
  const kind = weaponAt(w.a[id] ?? 0);
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  removeEntity(w, id);
  s.pickupId = -1;
  if (!equipWeapon(w, kind, x, y)) return;
  s.pickupFx.x = x;
  s.pickupFx.y = y;
  s.pickupFx.weapon = kind;
  bus.emit('fx:pickup', s.pickupFx);
}

/** Scratch for surface deltas. */
const pd = { x: 0, y: 0 };

/** Behaviour step: count life down, expire, or collect when the live ship is within 28 u. */
export function step(w: World, id: number, dt: number): void {
  const t = (w.t[id] ?? 0) - dt;
  if (t <= 0) {
    removeEntity(w, id);
    return;
  }
  w.t[id] = t;
  if (!w.ship.active) return;
  w.surface.delta(w.x[id] ?? 0, w.y[id] ?? 0, w.x[0] ?? 0, w.y[0] ?? 0, pd);
  const dx = pd.x;
  const dy = pd.y;
  if (dx * dx + dy * dy <= PICKUP_COLLECT_RADIUS * PICKUP_COLLECT_RADIUS) collectPickup(w, id);
}

/** Remove the live pickup (level end). */
export function clearPickup(w: World): void {
  const id = livePickup(w);
  if (id > 0) removeEntity(w, id);
  weaponState(w).pickupId = -1;
}
