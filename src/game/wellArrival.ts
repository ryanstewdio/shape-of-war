// Wells over time (GW2, Ryan: "wells should also appear over time"). On a level whose spec has at
// least one Gravity well, more wells arrive during play: the first ARRIVE_FIRST_MIN to
// ARRIVE_FIRST_MAX seconds after level start, then one every ARRIVE_GAP_MIN to ARRIVE_GAP_MAX
// seconds. Times and positions are hashed from the level seed and the arrival index (hash01, no
// PRNG). The clock is the wave clock, which pauses during the respawn delay and a boss hold.
//
// An arrival telegraphs for ARRIVE_TELE_SEC: 'sim:wellArrive' { id, x, y, inSec } fires at the
// telegraph start and the well entity exists from then on with gs(w).tele > 0, so it is harmless,
// untargetable and drawn as a telegraph; stepWells skips it. When the telegraph ends the well goes
// live, unless the ship stands too close: then the position is re-hashed (same rules) and the well
// moves there, or the arrival is cancelled when no spot qualifies. The ship is never inside a well
// at creation.
//
// Caps: live wells (telegraphs included) at most the spec well count plus 2 and at most MAX_WELLS;
// wells plus boss hazards plus hazard spawners at most HAZARD_CAP (docs/13). An arrival that falls
// due at a cap, or with no valid spot, is skipped and the next one scheduled. No arrival while a boss
// is alive, during the respawn delay, after the level ends, or in Endless; a due arrival waits.
import { bus } from '../core/events';
import { hash01 } from '../core/rng';
import { isInside } from './arena';
import { bossAlive, countHazards } from './bosses/core';
import { addWell, def as wellDef } from './enemies/gravitywell';
import { removeEntity } from './remove';
import { SHIP_RADIUS } from './ship';
import { gs, MAX_WELLS } from './state';
import { Kind, type World } from './world';

export const ARRIVE_FIRST_MIN = 20;
export const ARRIVE_FIRST_MAX = 30;
export const ARRIVE_GAP_MIN = 25;
export const ARRIVE_GAP_MAX = 35;
/** Telegraph seconds between 'sim:wellArrive' and the live well. */
export const ARRIVE_TELE_SEC = 1.5;
/** Minimum distance from the ship at the telegraph start (and after a re-hash), u. */
export const ARRIVE_SHIP_DIST = 300;
/** Minimum distance from every other well, u. */
export const ARRIVE_WELL_DIST = 250;
/** The well centre stays this far inside the arena edge and obstacles, u. */
export const ARRIVE_MARGIN = 120;
/** At the end of the telegraph the ship must be at least this far from the core edge, u. */
export const ARRIVE_CLEAR = 60;
/** Wells above the spec count that may arrive. */
export const ARRIVE_EXTRA = 2;
/** docs/13 live hazard cap: wells plus boss hazards plus hazard spawners. */
export const HAZARD_CAP = 8;
/** Position candidates per pick (telegraph start, then the re-hash at creation). */
export const ARRIVE_TRIES = 32;

const SALT_TIME = 0x57454c4c; // 'WELL'
const SALT_X = 0x41525858;
const SALT_Y = 0x41525959;

/** Pure: seconds after level start of the first arrival, in [ARRIVE_FIRST_MIN, ARRIVE_FIRST_MAX). */
export function firstArrivalSec(seed: number): number {
  return ARRIVE_FIRST_MIN + (ARRIVE_FIRST_MAX - ARRIVE_FIRST_MIN) * hash01((seed ^ SALT_TIME) >>> 0, 0);
}

/** Pure: seconds from arrival index - 1 to arrival index (index >= 1), in [ARRIVE_GAP_MIN, ARRIVE_GAP_MAX). */
export function arrivalGapSec(seed: number, index: number): number {
  return ARRIVE_GAP_MIN + (ARRIVE_GAP_MAX - ARRIVE_GAP_MIN) * hash01((seed ^ SALT_TIME) >>> 0, index);
}

/** Pure: the wave clock time of arrival index (0 based). */
export function arrivalAtSec(seed: number, index: number): number {
  let t = firstArrivalSec(seed);
  for (let k = 1; k <= index; k++) t += arrivalGapSec(seed, k);
  return t;
}

/** Pure: live well cap for a level whose spec has specWells wells (0 means no arrivals). */
export function arrivalCap(specWells: number): number {
  return specWells > 0 ? Math.min(specWells + ARRIVE_EXTRA, MAX_WELLS) : 0;
}

/** Reused candidate point. */
const spot = { x: 0, y: 0 };

/** Pure: candidate try of arrival index inside the arena bounding box less the margin, into out. */
export function candidateSpot(seed: number, index: number, attempt: number, width: number, height: number, out: { x: number; y: number }): void {
  const k = index * 256 + attempt;
  const hw = Math.max(0, width / 2 - ARRIVE_MARGIN);
  const hh = Math.max(0, height / 2 - ARRIVE_MARGIN);
  out.x = Math.round((hash01((seed ^ SALT_X) >>> 0, k) * 2 - 1) * hw);
  out.y = Math.round((hash01((seed ^ SALT_Y) >>> 0, k) * 2 - 1) * hh);
}

/** True when (x, y) is a valid arrival spot: inside the margin, far from the ship and other wells. */
function spotOk(w: World, x: number, y: number, self: number): boolean {
  if (!isInside(w.level.arena, x, y, ARRIVE_MARGIN)) return false;
  if (w.ship.active) {
    const dx = x - (w.x[0] ?? 0);
    const dy = y - (w.y[0] ?? 0);
    if (dx * dx + dy * dy < ARRIVE_SHIP_DIST * ARRIVE_SHIP_DIST) return false;
  }
  const g = gs(w);
  for (let i = 0; i < g.wellCount; i++) {
    const id = g.wellIds[i] ?? -1;
    if (id <= 0 || id === self) continue;
    const dx = x - (w.x[id] ?? 0);
    const dy = y - (w.y[id] ?? 0);
    if (dx * dx + dy * dy < ARRIVE_WELL_DIST * ARRIVE_WELL_DIST) return false;
  }
  return true;
}

/** First valid candidate from try `from` on, into spot. False when none of ARRIVE_TRIES qualifies. */
function pickSpot(w: World, index: number, from: number, self: number): boolean {
  const a = w.level.arena;
  for (let t = from; t < from + ARRIVE_TRIES; t++) {
    candidateSpot(w.level.seed, index, t, a.width, a.height, spot);
    if (spotOk(w, spot.x, spot.y, self)) return true;
  }
  return false;
}

function liveSpawners(w: World): number {
  let n = 0;
  for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === Kind.Spawner) n++;
  return n;
}

/** True while arrivals must wait: Endless, a boss alive, the respawn delay, or the level over. */
function arrivalsHeld(w: World): boolean {
  const g = gs(w);
  return g.mode === 'endless' || g.outcome !== 'running' || g.deathTimer > 0 || !w.ship.active || bossAlive(w);
}

/** True when one more well fits under the well cap and the hazard cap. */
function roomForWell(w: World, specWells: number): boolean {
  const g = gs(w);
  if (g.wellCount >= arrivalCap(specWells)) return false;
  return g.wellCount + countHazards(w) + liveSpawners(w) < HAZARD_CAP;
}

/** Telegraph end: keep the ship out of the new core, re-hashing the spot or cancelling. */
function settleArrival(w: World): void {
  const g = gs(w);
  const id = g.wellArriving;
  g.wellArriving = -1;
  if (id <= 0 || w.alive[id] !== 1 || w.kind[id] !== Kind.GravityWell || !w.ship.active) return;
  const clear = wellDef.radius + SHIP_RADIUS + ARRIVE_CLEAR;
  const dx = (w.x[id] ?? 0) - (w.x[0] ?? 0);
  const dy = (w.y[id] ?? 0) - (w.y[0] ?? 0);
  if (dx * dx + dy * dy >= clear * clear) return;
  if (pickSpot(w, g.wellArrivals - 1, ARRIVE_TRIES, id)) {
    w.x[id] = spot.x;
    w.y[id] = spot.y;
    w.prevX[id] = spot.x;
    w.prevY[id] = spot.y;
  } else {
    removeEntity(w, id);
  }
}

/** Start arrival index g.wellArrivals if the caps and a spot allow; schedule the next either way. */
function startArrival(w: World, specWells: number): void {
  const g = gs(w);
  const index = g.wellArrivals;
  g.wellArrivals = index + 1;
  g.wellArriveAt += arrivalGapSec(w.level.seed, index + 1);
  if (!roomForWell(w, specWells) || !pickSpot(w, index, 0, -1)) return;
  const id = addWell(w, spot.x, spot.y, ARRIVE_TELE_SEC, specWells + index);
  if (id < 0) return;
  g.wellArriving = id;
  const fx = g.wellArriveFx;
  fx.id = id;
  fx.x = spot.x;
  fx.y = spot.y;
  fx.inSec = ARRIVE_TELE_SEC;
  bus.emit('sim:wellArrive', fx);
}

/** Per step, before stepWells. Allocates nothing. */
export function stepWellArrivals(w: World): void {
  const g = gs(w);
  const pending = g.wellArriving;
  if (pending > 0 && (g.tele[pending] ?? 0) <= 0) settleArrival(w);
  const specWells = w.level.hazards.wells.length;
  if (specWells === 0 || g.mode === 'endless') return;
  if (g.wellArriveAt < 0) g.wellArriveAt = firstArrivalSec(w.level.seed);
  if (g.waveClock < g.wellArriveAt || arrivalsHeld(w)) return;
  startArrival(w, specWells);
}
