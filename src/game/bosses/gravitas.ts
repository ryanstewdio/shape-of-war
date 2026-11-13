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
// Shelter pools (fury fixes, GRAVITAS_POOL; Ryan 2026-11-12): a pool is Kind.BossHazard,
// HazardType.Pool, never lethal. The core shrinks it over its last fadeSec (w.t its age, w.vx its
// full life). At most max live (the oldest goes first), and a pool is skipped, never a ring or a
// pull, when it would leave fewer than reserve hazard slots. A ship inside one gets no pull or push
// (core.ts bossContacts and pushShip below) and floats (ShipState.float).
//
// Pool orbs (fury orbs, GRAVITAS_ORB; Ryan 2026-11-13, replacing the trail of pools where Gravitas
// stood): enraged, every everySec of attack time Gravitas launches an orb (Kind.BossHazard,
// HazardType.Orb, never lethal, no contact kill) from its body edge toward the ship (after the split
// from the pair centre). w.rot its heading, w.radius its radius, w.t its age (core), w.vx the stop
// distance (share of the distance to the ship at launch, clamped to minDist to maxDist), w.vy the
// distance flown. It flies at speed and where it stops (or at the arena wall) it is removed and a
// pool opens there (dropPool). An orb launches only while the live hazards plus one plus the pool
// reserve fit inside MAX_HAZARDS, so it never takes a ring's slot; it hands its slot to its pool.
// Each launch releases snakesPerOrb Snakes (spawnSnake) beside the orb's path at the body edge,
// enraged as Ember's Leavers are (World.enraged, 'sim:enrage'), at most snakeCap Gravitas Snakes
// alive (heads), both scaled by the difficulty addScale through minionCount, kept in the add slots
// (so a ship death, the break and the defeat treat them as any boss add) and inside maxLiveEnemies.
// Ability scratch (bs.abl): 0 the orb clock.
//
// Bent shots (fury tune, Ryan 2026-11-12 option A; GRAVITAS_BEND): enraged, inside bend radius of each
// live Gravitas pull (the body, then each Gravitant at its own strength) every player bullet but the
// orbit blades and the straight ones (fired from a pool: BulletPool.straight) turns away from the core
// toward the side it is passing, up to rate rad/s at the body edge, falling off to 0 at the radius;
// while the tide pushes it is also pushed outward at up to scatter u/s^2. No PRNG, no allocation.
// The boss sim writes BulletPool.spawnStraight (core.ts bossContacts).
import { bus } from '../../core/events';
import { STYLE_ORBIT } from '../bullets';
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
import {
  FURY_BREAK_SEC,
  GRAVITANT,
  GRAVITAS,
  GRAVITAS_BEND,
  GRAVITAS_FURY,
  GRAVITAS_ORB,
  GRAVITAS_ORB_SNAKE,
  GRAVITAS_POOL,
  HAZARD_RECHECK_SEC,
  MAX_ADDS,
  MAX_HAZARDS,
  MAX_PARTS,
} from './table';
import { BossMode, HazardType, PartType, type BossDef } from './types';
import { removeEntity } from '../remove';
import { splitHp } from './tempest';
import { confineOn, createConfineResult, isInsideOn } from '../arena';
import { def as snakeDef, spawnSnake } from '../enemies/snake';
import { countWaveEnemies, TELEGRAPH_SEC } from '../spawner';
import { minionCount } from './scale';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** bs.abl slot of the orb clock (attack seconds since the last orb). */
const ORB_CLOCK = 0;

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

/** Pure: the bend share at d u from a core of radius coreR: 1 at the body edge, 0 at GRAVITAS_BEND.radius. */
export function bendFalloff(d: number, coreR: number): number {
  const R = GRAVITAS_BEND.radius;
  if (!(d < R)) return 0;
  if (d <= coreR) return 1;
  const span = R - coreR;
  return span > 0 ? (R - d) / span : 1;
}

/**
 * Pure: the way a shot with velocity (vx, vy) turns, given (rx, ry) from the shot to the core: away
 * from the core toward the side it is passing, -1 clockwise, 1 counter clockwise. A dead centre shot
 * turns counter clockwise.
 */
export function bendSide(vx: number, vy: number, rx: number, ry: number): -1 | 1 {
  return vx * ry - vy * rx > 0 ? -1 : 1;
}

/** Scratch for the shot to core delta. */
const bv = { x: 0, y: 0 };

/**
 * Bend every bendable player shot near core (the body or a Gravitant) whose pull is p: strength is
 * the pull's (w.vx keeps it through the tide) over the full GRAVITAS.pullMax. Enraged only.
 */
export function bendShots(w: World, bs: BossState, core: number, p: number, dt: number): void {
  if (p <= 0) return;
  bendAt(w, bs, core, (w.vx[p] ?? 0) / GRAVITAS.pullMax, dt);
}

/**
 * Bend at strength share k (1 is the full body pull). Ryan 2026-11-12: with no anchors left the
 * enraged body has no pull but keeps a full bend field (k 1), so shots bend from the break on.
 */
export function bendAt(w: World, bs: BossState, core: number, k: number, dt: number): void {
  if (bs.fury !== 2 || core <= 0 || w.alive[core] !== 1) return;
  if (!(k > 0)) return;
  const b = w.bullets;
  const cx = w.x[core] ?? 0;
  const cy = w.y[core] ?? 0;
  const coreR = w.radius[core] ?? 0;
  const push = tideAt(bs.fury, bs.furyT) < 0;
  const rate = GRAVITAS_BEND.rate * k * dt;
  const scatter = GRAVITAS_BEND.scatter * k * dt;
  for (let i = 0; i < b.cap; i++) {
    if (b.alive[i] !== 1 || b.style[i] === STYLE_ORBIT || b.straight[i] === 1) continue;
    w.surface.delta(b.x[i] ?? 0, b.y[i] ?? 0, cx, cy, bv);
    const d = Math.hypot(bv.x, bv.y);
    const f = bendFalloff(d, coreR);
    if (f <= 0) continue;
    let vx = b.vx[i] ?? 0;
    let vy = b.vy[i] ?? 0;
    const a = bendSide(vx, vy, bv.x, bv.y) * rate * f;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const nx = vx * c - vy * s;
    vy = vx * s + vy * c;
    vx = nx;
    if (push && d > 0) {
      vx -= (bv.x / d) * scatter * f;
      vy -= (bv.y / d) * scatter * f;
    }
    b.vx[i] = vx;
    b.vy[i] = vy;
  }
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

/** Live orbs now. */
export function countOrbs(w: World): number {
  let n = 0;
  for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Orb) n++;
  return n;
}

/** Pure: how far an orb flies, d u from the ship at launch: share of d, clamped to minDist to maxDist. */
export function orbStopDist(d: number): number {
  const v = Number.isFinite(d) && d > 0 ? d * GRAVITAS_ORB.share : 0;
  return v < GRAVITAS_ORB.minDist ? GRAVITAS_ORB.minDist : v > GRAVITAS_ORB.maxDist ? GRAVITAS_ORB.maxDist : v;
}

/** Pure: true when an orb may launch with live hazards up: it and the pool reserve still fit. */
export function orbFits(live: number): boolean {
  return live + 1 + GRAVITAS_POOL.reserve <= MAX_HAZARDS;
}

/** Pure: Gravitas Snakes allowed alive at addScale (snakeCap scaled, inside the add slots). */
export function snakeCapFor(addScale: number): number {
  return minionCount(GRAVITAS_ORB.snakeCap, addScale, MAX_ADDS);
}

/** Pure: Snakes one launch releases at addScale with live Gravitas Snakes already alive (the cap holds). */
export function snakesToRelease(addScale: number, live: number): number {
  const cap = snakeCapFor(addScale);
  const room = cap - (live > 0 ? live : 0);
  const n = minionCount(GRAVITAS_ORB.snakesPerOrb, addScale, cap);
  return room <= 0 ? 0 : n < room ? n : room;
}

/** Pure: the side offset (radians) of the k-th Snake of a launch: +s, -s, +2s, -2s and so on. */
export function snakeSide(k: number): number {
  const step = GRAVITAS_ORB_SNAKE.sideDeg * DEG * (1 + Math.floor(k / 2));
  return k % 2 === 0 ? step : -step;
}

/** Live Gravitas Snakes (heads in this boss's add slots). */
export function gravitasSnakes(w: World, bs: BossState): number {
  let n = 0;
  for (let i = 0; i < MAX_ADDS; i++) {
    const a = bs.addIds[i] ?? -1;
    if (a > 0 && w.alive[a] === 1 && w.kind[a] === Kind.SnakeHead && bs.addKind[i] === Kind.SnakeHead) n++;
  }
  return n;
}

const cres = createConfineResult();
const enrageFx = { id: 0, x: 0, y: 0 };

/**
 * A Snake as a boss add: a free add slot, room under maxLiveEnemies, then spawnSnake (the normal
 * telegraph; its own slot and entity checks). Kept in the add slots. Returns the head id or -1.
 */
function spawnSnakeAdd(w: World, bs: BossState, x: number, y: number): number {
  let slot = -1;
  for (let i = 0; i < MAX_ADDS && slot < 0; i++) {
    const id = bs.addIds[i] ?? -1;
    if (!(id > 0 && w.alive[id] === 1 && w.kind[id] === bs.addKind[i])) slot = i;
  }
  if (slot < 0) return -1;
  if (countWaveEnemies(w) >= w.level.waves.maxLiveEnemies) return -1;
  const c = confineOn(w.surface, w.level.arena, x, y, snakeDef.radius, cres);
  const head = spawnSnake(w, c.x, c.y, TELEGRAPH_SEC);
  if (head < 0) return -1;
  bs.addIds[slot] = head;
  bs.addKind[slot] = Kind.SnakeHead;
  return head;
}

/**
 * Release the enraged Snakes of a launch from a centre (cx, cy) along heading a: at edge u plus the
 * pad, beside the orb's path. Returns the number released.
 */
export function releaseSnakes(w: World, bs: BossState, cx: number, cy: number, a: number, edge: number): number {
  const n = snakesToRelease(bs.addScale, gravitasSnakes(w, bs));
  const d = edge + GRAVITAS_ORB_SNAKE.spawnPad + snakeDef.radius;
  let made = 0;
  for (let k = 0; k < n; k++) {
    const s = a + snakeSide(k);
    const head = spawnSnakeAdd(w, bs, cx + Math.cos(s) * d, cy + Math.sin(s) * d);
    if (head < 0) break;
    w.enraged[head] = 1;
    enrageFx.id = head;
    enrageFx.x = w.x[head] ?? 0;
    enrageFx.y = w.y[head] ?? 0;
    bus.emit('sim:enrage', enrageFx);
    made++;
  }
  return made;
}

/** Scratch for the orb's moves (read both fields before the next call). */
const ov = { x: 0, y: 0 };

/**
 * Launch an orb from (cx, cy), edge u out toward the ship, with its Snakes. Skipped (no orb, no
 * Snakes) while it would touch the pool reserve or the world is full. Returns the orb id or -1.
 */
export function launchOrb(w: World, bs: BossState, cx: number, cy: number, orbEdge: number, snakeEdge: number): number {
  if (!w.ship.active || !orbFits(countHazards(w))) return -1;
  const a = angleToOn(w.surface, cx, cy, w.x[0] ?? 0, w.y[0] ?? 0);
  ov.x = cx + Math.cos(a) * orbEdge;
  ov.y = cy + Math.sin(a) * orbEdge;
  w.surface.wrap(ov);
  const ox = ov.x;
  const oy = ov.y;
  w.surface.delta(ox, oy, w.x[0] ?? 0, w.y[0] ?? 0, ov);
  const stop = orbStopDist(Math.hypot(ov.x, ov.y));
  const h = spawnHazard(w, bs, HazardType.Orb, ox, oy, a, GRAVITAS_ORB.radius, stop, 0, 0, -1, false);
  if (h <= 0) return -1;
  releaseSnakes(w, bs, cx, cy, a, snakeEdge);
  return h;
}

/** Fly orb h for dt: where it stops (its distance flown, or the arena wall next) a pool opens. */
export function stepOrb(w: World, bs: BossState, h: number, dt: number): void {
  const x = w.x[h] ?? 0;
  const y = w.y[h] ?? 0;
  const stop = w.vx[h] ?? 0;
  const flown = w.vy[h] ?? 0;
  const left = stop - flown;
  const move = GRAVITAS_ORB.speed * (dt > 0 ? dt : 0);
  const m = move < left ? move : left > 0 ? left : 0;
  const a = w.rot[h] ?? 0;
  ov.x = x + Math.cos(a) * m;
  ov.y = y + Math.sin(a) * m;
  w.surface.wrap(ov);
  const wall = !isInsideOn(w.surface, w.level.arena, ov.x, ov.y, GRAVITAS_ORB.radius);
  if (!wall) {
    w.x[h] = ov.x;
    w.y[h] = ov.y;
    w.vy[h] = flown + m;
  }
  if (!wall && flown + m < stop - 1e-9) return;
  const px = w.x[h] ?? 0;
  const py = w.y[h] ?? 0;
  removeEntity(w, h);
  dropPool(w, bs, px, py);
}

/** Every live orb flies one step. */
function stepOrbs(w: World, bs: BossState, dt: number): void {
  for (let h = 1; h < w.cap; h++) {
    if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Orb) stepOrb(w, bs, h, dt);
  }
}

/** The orb clock: enraged only, an orb from (cx, cy) every everySec of attack time; live orbs fly. */
function stepOrbClock(w: World, bs: BossState, cx: number, cy: number, orbEdge: number, snakeEdge: number, dt: number, adt: number): void {
  stepOrbs(w, bs, dt);
  if (bs.fury !== 2) return;
  const c = (bs.abl[ORB_CLOCK] ?? 0) + adt;
  if (c < GRAVITAS_ORB.everySec) {
    bs.abl[ORB_CLOCK] = c;
    return;
  }
  bs.abl[ORB_CLOCK] = c - GRAVITAS_ORB.everySec;
  launchOrb(w, bs, cx, cy, orbEdge, snakeEdge);
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
  const bp = livePull(w, bs);
  bendAt(w, bs, id, bp > 0 ? (w.vx[bp] ?? 0) / GRAVITAS.pullMax : 1, dt); // no anchors: a bend field, no pull
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
  } else {
    bs.t0 += adt;
    const every = ringEveryFor(bs.phase);
    if (bs.t0 >= every) fireRing(w, id, bs, every);
  }
  const r = w.radius[id] ?? 0;
  stepOrbClock(w, bs, w.x[id] ?? 0, w.y[id] ?? 0, r + GRAVITAS_ORB.radius, r, dt, adt);
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
  for (let k = 0; k < GRAVITANT.count; k++) {
    syncSplitPull(w, bs, k, dt);
    bendShots(w, bs, livePart(w, bs, k), pullAt(w, k === 0 ? bs.n0 : bs.n1), dt);
  }
  if (bs.retry > 0) {
    bs.retry = bs.retry - dt > 0 ? bs.retry - dt : 0;
  } else {
    bs.t0 += adt;
    const every = ringEveryFor(bs.phase);
    if (bs.t0 >= every) fireSplitRing(w, bs, every);
  }
  stepOrbClock(w, bs, bs.t1, bs.t2, 0, bs.t3 + GRAVITANT.radius, dt, adt); // from the pair centre
}

export const def: BossDef = { reset, step, onPhase, entryHome, cracks, clampDamage, afterDamage, phaseOf, fury: true };
