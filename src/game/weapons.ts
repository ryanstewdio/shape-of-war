// Weapon styles and the pickup drop schedule (docs/11 SPEC 3.5, docs/10 "Design: weapons").
// Spread is the v1 weapon and the default; rapid, pierce and orbit come from pickups dropped by
// scoring kills and last 20 s. Weapon state lives in a WeakMap keyed by the World, so this module
// imports World as a type only (world.ts imports ship.ts, which imports this file).
// Determinism: the drop choice is hash01(level.seed, dropIndex). No PRNG, no LevelDef field.
// Nothing here allocates per step.
//
// V3 wave D (docs/13 SPEC 3.5 "Combining"): a second weapon kind collected while one is active makes
// the pair weapon for a fresh 20 s; a third replaces the older ingredient. Spread drops only while a
// weapon is active, and a drop falls due within COMBINE_DROP_KILLS kills while one is. Orbit v2
// (GW1, Ryan): no forward bullet and no push. Two rings of 4 spikes circle the ship in opposite
// directions at 80 u and 100 u; while the aim stick is held the spikes on the aim side stretch along
// their orbit tangent to 2.5x over 0.25 s (and back), a chainsaw arc that hits all it touches.
import { bus, type BaseWeaponKind, type ComboKind, type WeaponKind } from '../core/events';
import { hash01 } from '../core/rng';
import {
  armPierce,
  BULLET_LIFE,
  BULLET_SPEED,
  BULLET_SPEED_MAX,
  fireSpread,
  killBullet,
  MUZZLE_OFFSET,
  spawnBullet,
  PIERCE_HITS,
  SPREAD_RAD,
  STYLE_ORBIT,
  STYLE_RAPID,
  styleRadius,
} from './bullets';
import type { World } from './world';

export interface WeaponSpec {
  kind: BaseWeaponKind;
  /** BulletPool.style written for this weapon's bullets (orbit: the blades). */
  style: number;
  /** Volleys per second before Turbo. */
  rate: number;
  /** Bullet speed before the ship velocity term, u/s. */
  speed: number;
  /** Collision radius, u (orbit: the blade). */
  radius: number;
  /** Bullet life, s (orbit fires no forward bullet any more; blades live for the weapon duration). */
  life: number;
}

/** Starting values from the docs/10 weapons table. */
export const WEAPONS: Readonly<Record<BaseWeaponKind, WeaponSpec>> = {
  spread: { kind: 'spread', style: 0, rate: 12, speed: BULLET_SPEED, radius: 4, life: BULLET_LIFE },
  rapid: { kind: 'rapid', style: 1, rate: 26, speed: 1500, radius: 3, life: 1.0 },
  pierce: { kind: 'pierce', style: 2, rate: 8, speed: 1600, radius: 6, life: 1.0 },
  orbit: { kind: 'orbit', style: 3, rate: 6, speed: BULLET_SPEED, radius: 7, life: BULLET_LIFE },
};

/** Index order matches BulletPool.style and the pickup's w.a value (1 rapid, 2 pierce, 3 orbit). */
export const WEAPON_KINDS: readonly BaseWeaponKind[] = ['spread', 'rapid', 'pierce', 'orbit'];

export const WEAPON_DURATION = 20;
export const FIRST_DROP_KILL = 15;
export const DROP_EVERY = 25;
/** While a non spread weapon is active the next drop falls due within this many scoring kills. */
export const COMBINE_DROP_KILLS = 12;
export const RAPID_OFFSET = 5;
/** Orbit v2: spikes per ring, inner ring radius (turns forward), outer ring radius (turns back). */
export const ORBIT_PER_RING = 4;
export const ORBIT_RADIUS = 80;
export const ORBIT_OUTER = 100;
export const ORBIT_REV_PER_SEC = 2.4;
export const BLADE_COOLDOWN = 0.12;
export const HUD_WEAPON_INTERVAL = 0.1;

const POOL_BAND1: readonly BaseWeaponKind[] = ['rapid'];
const POOL_BAND2: readonly BaseWeaponKind[] = ['rapid', 'pierce'];
const POOL_FULL: readonly BaseWeaponKind[] = ['rapid', 'pierce', 'orbit'];
const POOL_BAND1_S: readonly BaseWeaponKind[] = ['rapid', 'spread'];
const POOL_BAND2_S: readonly BaseWeaponKind[] = ['rapid', 'pierce', 'spread'];
const POOL_FULL_S: readonly BaseWeaponKind[] = ['rapid', 'pierce', 'orbit', 'spread'];

/**
 * Pure: drop pool for a band. Bands 3, 4 and Endless share the full pool. With a non spread weapon
 * active at the moment of the drop, spread joins the pool (docs/13 "Spread as an ingredient"); with
 * spread active the pool is the docs/11 one, so the v2 golden holds.
 */
export function weaponPool(band: number, endless: boolean, armed = false): readonly BaseWeaponKind[] {
  if (endless || band >= 3) return armed ? POOL_FULL_S : POOL_FULL;
  if (band === 2) return armed ? POOL_BAND2_S : POOL_BAND2;
  return armed ? POOL_BAND1_S : POOL_BAND1;
}

/**
 * Pure: the weapon for drop dropIndex. pool[floor(hash01(seed, dropIndex) x len)], stepping one
 * place on when it equals the previous drop (impossible to avoid in a pool of one).
 */
export function chooseDrop(seed: number, dropIndex: number, pool: readonly BaseWeaponKind[], previous: BaseWeaponKind | null): BaseWeaponKind {
  const n = pool.length;
  if (n === 0) return 'spread';
  let i = Math.min(n - 1, Math.floor(hash01(seed, dropIndex) * n));
  if (n > 1 && pool[i] === previous) i = (i + 1) % n;
  return pool[i] ?? 'spread';
}

/** Index of a weapon kind (BulletPool.style, pickup w.a). */
export function weaponIndex(kind: BaseWeaponKind): number {
  return WEAPONS[kind].style;
}

/** Weapon kind for an index, spread when out of range. */
export function weaponAt(index: number): BaseWeaponKind {
  return WEAPON_KINDS[index] ?? 'spread';
}

export interface DropCounter {
  /** Scoring kills counted while pickups are on. */
  kills: number;
  /** Kill count at which the next drop falls due. */
  nextDropAt: number;
  /** A drop fell due while a pickup was live; it spawns at the next kill with none live. */
  pending: boolean;
}

/**
 * Pure: count one scoring kill. Drops fall due at kill 15, 40, 65 and so on; at most one waits.
 * armed: a non spread weapon is active, so the next drop is due within COMBINE_DROP_KILLS kills.
 */
export function countKill(c: DropCounter, armed = false): void {
  c.kills++;
  if (c.kills >= c.nextDropAt) {
    c.pending = true;
    c.nextDropAt += DROP_EVERY;
  }
  if (armed) pullDropIn(c);
}

/** Pure: bring the next drop to within COMBINE_DROP_KILLS kills of now. */
export function pullDropIn(c: DropCounter): void {
  const by = c.kills + COMBINE_DROP_KILLS;
  if (c.nextDropAt > by) c.nextDropAt = by;
}

// ---------------------------------------------------------------------------------------------
// Combined weapons

export interface ComboSpec {
  id: ComboKind;
  /** 1 to 6, BulletPool.combo. */
  index: number;
  name: string;
  /** Ingredients in canonical order (spread, rapid, pierce, orbit). */
  a: BaseWeaponKind;
  b: BaseWeaponKind;
  /** Volleys per second of the forward fire before Turbo. */
  rate: number;
}

/** The six pairs in docs/13 table order. Names are Ryan's (COMBO_NAMES). */
export const COMBO_TABLE: readonly ComboSpec[] = [
  { id: 'spread+rapid', index: 1, name: 'Hail', a: 'spread', b: 'rapid', rate: 22 },
  { id: 'spread+pierce', index: 2, name: 'Trident', a: 'spread', b: 'pierce', rate: 10 },
  { id: 'spread+orbit', index: 3, name: 'Halo', a: 'spread', b: 'orbit', rate: 10 },
  { id: 'rapid+pierce', index: 4, name: 'Needle', a: 'rapid', b: 'pierce', rate: 14 },
  { id: 'rapid+orbit', index: 5, name: 'Whirl', a: 'rapid', b: 'orbit', rate: 18 },
  { id: 'pierce+orbit', index: 6, name: 'Eclipse', a: 'pierce', b: 'orbit', rate: 8 },
];

/** Display names Ryan can edit. */
export const COMBO_NAMES: Readonly<Record<ComboKind, string>> = {
  'spread+rapid': 'Hail',
  'spread+pierce': 'Trident',
  'spread+orbit': 'Halo',
  'rapid+pierce': 'Needle',
  'rapid+orbit': 'Whirl',
  'pierce+orbit': 'Eclipse',
};

/** Pair bullet numbers. Hail: rapid bullet, 3 at 5 deg, life 0.9. Trident: pierce r5, 2 hits. Needle and Eclipse: 3 hits. */
export const HAIL_DEG = 5;
export const HAIL_LIFE = 0.9;
export const TRIDENT_DEG = 8;
export const TRIDENT_RADIUS = 5;
export const TRIDENT_HITS = 2;
export const NEEDLE_RADIUS = 4;
export const NEEDLE_HITS = 3;
export const ECLIPSE_HITS = 3;

/** Pure: true for a pair id. */
export function isCombo(kind: WeaponKind): kind is ComboKind {
  return kind.indexOf('+') > 0;
}

/** Pure: the pair spec of a kind, or null for a base weapon. */
export function comboSpec(kind: WeaponKind): ComboSpec | null {
  for (const c of COMBO_TABLE) if (c.id === kind) return c;
  return null;
}

/** Pure: the pair made of two different base weapons (any order), or null when they are the same. */
export function comboOf(x: BaseWeaponKind, y: BaseWeaponKind): ComboKind | null {
  if (x === y) return null;
  const ix = WEAPON_KINDS.indexOf(x);
  const iy = WEAPON_KINDS.indexOf(y);
  const lo = ix < iy ? x : y;
  const hi = ix < iy ? y : x;
  for (const c of COMBO_TABLE) if (c.a === lo && c.b === hi) return c.id;
  return null;
}

/** Pure: BulletPool.combo for a kind (0 for a base weapon). */
export function comboIndex(kind: WeaponKind): number {
  return comboSpec(kind)?.index ?? 0;
}

/** Pure: the collision radius of a bullet of style fired by pair combo (Trident and Needle are their own). */
export function bulletRadiusOf(style: number, combo: number): number {
  if (combo === 2) return TRIDENT_RADIUS;
  if (combo === 4) return NEEDLE_RADIUS;
  return styleRadius(style);
}

/** Pure: the hud name of a weapon kind (base kinds read as themselves). */
export function weaponName(kind: WeaponKind): string {
  return isCombo(kind) ? COMBO_NAMES[kind] : kind;
}

/** Pure: true when a kind carries the orbit shield (orbit and the three orbit pairs). */
export function hasShield(kind: WeaponKind): boolean {
  return kind === 'orbit' || kind === 'spread+orbit' || kind === 'rapid+orbit' || kind === 'pierce+orbit';
}

// ---------------------------------------------------------------------------------------------
// Orbit v2 (GW1): two counter rotating rings of spikes, chainsaw stretch on the aim side

export interface ShieldSpec {
  /** Spikes per ring. Hitters 0 to perRing - 1 are the inner ring, the rest the outer ring. */
  perRing: number;
  /** Inner ring radius (turns at +rev) and outer ring radius (turns at -rev), u. */
  inner: number;
  outer: number;
  /** Revolutions per second of each ring. */
  rev: number;
  /** Seconds a spike rests after it strikes. */
  cooldown: number;
  /** Eclipse: a resting spike hits every enemy it touches (up to SPIKE_PIERCE), not just the first. */
  piercing: boolean;
}

export const ORBIT_SHIELD: ShieldSpec = { perRing: ORBIT_PER_RING, inner: ORBIT_RADIUS, outer: ORBIT_OUTER, rev: ORBIT_REV_PER_SEC, cooldown: BLADE_COOLDOWN, piercing: false };
export const WHIRL_SHIELD: ShieldSpec = { perRing: ORBIT_PER_RING, inner: ORBIT_RADIUS, outer: ORBIT_OUTER, rev: 3.0, cooldown: BLADE_COOLDOWN, piercing: false };
export const ECLIPSE_SHIELD: ShieldSpec = { perRing: ORBIT_PER_RING, inner: ORBIT_RADIUS, outer: ORBIT_OUTER, rev: 2.0, cooldown: 0.15, piercing: true };
/** Most hitters (both rings) any shield has. */
export const MAX_HITTERS = 8;
/** Spike length at rest along its orbit tangent, u, and the capsule radius of its hit test. */
export const SPIKE_LEN = 24;
export const SPIKE_RADIUS = 7;
/** Eclipse resting spikes pierce up to this many enemies. */
export const SPIKE_PIERCE = 3;
/**
 * Chainsaw: while the aim stick is held the saw level rises 0 to 1 over STRETCH_SEC (and falls as
 * fast on release); aim side spikes are SPIKE_LEN x (1 + (SPIKE_STRETCH - 1) x level x weight) long.
 * A level, not a per spike ramp, because a spike crosses the cone in about 0.14 s at 2.4 rev/s.
 */
export const SPIKE_STRETCH = 2.5;
export const STRETCH_SEC = 0.25;
/** A spike within this angle of the aim (rad, 60 deg) saws while the aim stick is held. */
export const SAW_CONE = Math.PI / 3;
/** Full stretch inside this angle of the aim (rad, 50 deg); it fades to none at SAW_CONE. */
export const SAW_FULL = (50 * Math.PI) / 180;
/** A spike stretched past this multiplier is a chainsaw: it hits every enemy along its length. */
export const SAW_AT = 1.05;

/** Pure: the shield of a kind (orbit and Halo share the orbit numbers), or null. */
export function shieldOf(kind: WeaponKind): ShieldSpec | null {
  if (kind === 'orbit' || kind === 'spread+orbit') return ORBIT_SHIELD;
  if (kind === 'rapid+orbit') return WHIRL_SHIELD;
  if (kind === 'pierce+orbit') return ECLIPSE_SHIELD;
  return null;
}

/** Pure: the ring (0 inner, 1 outer) of hitter i. */
export function ringOf(sh: ShieldSpec, i: number): number {
  return i < sh.perRing ? 0 : 1;
}

/** Pure: turn direction of a ring: the inner ring turns forward, the outer ring back. */
export function ringDir(ring: number): number {
  return ring === 0 ? 1 : -1;
}

/** Pure: angle of hitter i at orbit phase ph. The outer ring sits half a gap off the inner one. */
export function spikeAngle(sh: ShieldSpec, i: number, ph: number): number {
  const ring = ringOf(sh, i);
  const k = ring === 0 ? i : i - sh.perRing;
  return ringDir(ring) * ph + ((k + ring * 0.5) * 2 * Math.PI) / sh.perRing;
}

/** Pure: a wrapped to (-PI, PI]. */
function wrapAngle(a: number): number {
  let v = a % (2 * Math.PI);
  if (v > Math.PI) v -= 2 * Math.PI;
  else if (v <= -Math.PI) v += 2 * Math.PI;
  return v;
}

/** Pure: how much a spike at angle a joins the saw: 1 within SAW_FULL of aim, 0 at SAW_CONE and beyond. */
export function sawWeight(a: number, aim: number): number {
  const rel = Math.abs(wrapAngle(a - aim));
  if (rel <= SAW_FULL) return 1;
  if (rel >= SAW_CONE) return 0;
  return (SAW_CONE - rel) / (SAW_CONE - SAW_FULL);
}

/** Pure: the saw level one step later: toward 1 while held, toward 0 otherwise, over STRETCH_SEC. */
export function stepSaw(level: number, held: boolean, dt: number): number {
  const rate = dt / STRETCH_SEC;
  if (held) return level + rate >= 1 - 1e-9 ? 1 : level + rate;
  return level - rate <= 1e-9 ? 0 : level - rate;
}

/** Pure: length multiplier of a spike at saw level and weight (1 to SPIKE_STRETCH). */
export function spikeStretch(level: number, weight: number): number {
  return 1 + (SPIKE_STRETCH - 1) * level * weight;
}

/**
 * Pure: true when a circle (px, py, pr) touches the capsule centred on (cx, cy) along unit tangent
 * (tx, ty), half length half, radius r.
 */
export function capsuleHits(px: number, py: number, pr: number, cx: number, cy: number, tx: number, ty: number, half: number, r: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  let u = dx * tx + dy * ty;
  if (u > half) u = half;
  else if (u < -half) u = -half;
  const ex = dx - tx * u;
  const ey = dy - ty * u;
  const rr = r + pr;
  return ex * ex + ey * ey <= rr * rr;
}

export interface WeaponState extends DropCounter {
  /** The active weapon: spread (none), a base weapon or a pair. */
  kind: WeaponKind;
  /** Ingredients: older (collected first) and newer; newer is null for a single weapon. */
  older: BaseWeaponKind | null;
  newer: BaseWeaponKind | null;
  /** Seconds left on a non spread weapon. */
  timer: number;
  /** Settings "Weapon pickups". Off: no pickups spawn and the counter does not run. */
  pickupsOn: boolean;
  /** Drops spawned so far (the hash01 index). */
  dropIndex: number;
  /** Weapon of the previous drop, null before the first. */
  lastDrop: BaseWeaponKind | null;
  /** Live pickup entity id, -1 for none (validate against w.kind before use). */
  pickupId: number;
  /** Pool bullet id per spike (inner ring first, then outer), -1 for none. */
  blades: Int32Array;
  /** Seconds until each hitter may damage again. */
  bladeCool: Float32Array;
  /** Length multiplier of each spike (1 at rest, up to SPIKE_STRETCH while it saws). */
  stretch: Float32Array;
  /** Live hitters of the current shield (both rings), 0 without one. */
  hitters: number;
  /** Orbit phase, rad: the inner ring sits at +orbitPhase, the outer ring at -orbitPhase. */
  orbitPhase: number;
  /** Chainsaw level 0 to 1 (rises while the aim stick is held, falls on release). */
  saw: number;
  hudTimer: number;
  hud: { kind: WeaponKind; remaining: number; total: number; title: string };
  pickupFx: { x: number; y: number; weapon: WeaponKind };
  combineFx: { x: number; y: number; kind: ComboKind; a: BaseWeaponKind; b: BaseWeaponKind };
  expireFx: { kind: WeaponKind };
}

function createWeaponState(): WeaponState {
  return {
    kind: 'spread',
    older: null,
    newer: null,
    timer: 0,
    pickupsOn: true,
    kills: 0,
    nextDropAt: FIRST_DROP_KILL,
    pending: false,
    dropIndex: 0,
    lastDrop: null,
    pickupId: -1,
    blades: new Int32Array(MAX_HITTERS).fill(-1),
    bladeCool: new Float32Array(MAX_HITTERS),
    stretch: new Float32Array(MAX_HITTERS).fill(1),
    hitters: 0,
    orbitPhase: 0,
    saw: 0,
    hudTimer: 0,
    hud: { kind: 'spread', remaining: 0, total: WEAPON_DURATION, title: 'spread' },
    pickupFx: { x: 0, y: 0, weapon: 'spread' },
    combineFx: { x: 0, y: 0, kind: 'spread+rapid', a: 'spread', b: 'rapid' },
    expireFx: { kind: 'spread' },
  };
}

const states = new WeakMap<World, WeaponState>();

/** Weapon state for a world, created on first use. */
export function weaponState(w: World): WeaponState {
  let s = states.get(w);
  if (s === undefined) {
    s = createWeaponState();
    states.set(w, s);
  }
  return s;
}

/** Settings port (default on). Off also cancels a waiting drop; a live pickup runs out normally. */
export function setWeaponPickups(w: World, on: boolean): void {
  const s = weaponState(w);
  s.pickupsOn = on;
  if (!on) s.pending = false;
}

export function currentWeapon(w: World): WeaponKind {
  return weaponState(w).kind;
}

/** True while a non spread weapon (single or pair) is active. */
export function weaponArmed(w: World): boolean {
  return weaponState(w).kind !== 'spread';
}

/** Seconds left on the current weapon, 0 for spread. */
export function weaponTimeLeft(w: World): number {
  const s = weaponState(w);
  return s.kind === 'spread' ? 0 : s.timer;
}

/** Volleys per second of the current weapon before Turbo. Spread returns the v1 12. */
export function weaponRate(w: World): number {
  const k = weaponState(w).kind;
  const c = comboSpec(k);
  return c !== null ? c.rate : WEAPONS[k as BaseWeaponKind].rate;
}

/** Emit 'hud:weapon' now and restart the 100 ms throttle. The payload object is reused. */
export function emitWeaponHud(w: World): void {
  const s = weaponState(w);
  s.hud.kind = s.kind;
  s.hud.title = weaponName(s.kind);
  s.hud.remaining = s.kind === 'spread' ? 0 : Math.max(0, s.timer);
  s.hud.total = WEAPON_DURATION;
  s.hudTimer = HUD_WEAPON_INTERVAL;
  bus.emit('hud:weapon', s.hud);
}

function removeBlades(w: World): void {
  const s = weaponState(w);
  const p = w.bullets;
  for (let i = 0; i < MAX_HITTERS; i++) {
    const b = s.blades[i] ?? -1;
    if (b >= 0 && p.alive[b] === 1 && p.style[b] === STYLE_ORBIT) killBullet(p, b);
    s.blades[i] = -1;
    s.bladeCool[i] = 0;
    s.stretch[i] = 1;
  }
  s.hitters = 0;
  s.saw = 0;
}

/** Switch the active kind, swapping the shield when it changes. */
function setKind(w: World, kind: WeaponKind): void {
  const s = weaponState(w);
  if (s.kind === kind) return;
  const had = shieldOf(s.kind);
  const next = shieldOf(kind);
  if (had !== next && had !== null) removeBlades(w);
  s.kind = kind;
  if (next !== null && had !== next) {
    s.orbitPhase = 0;
    placeBlades(w);
  }
}

/**
 * Collect a weapon (docs/13 "Combining" rule 2). Nothing active: equip X (spread does nothing).
 * The active single or one of the pair's ingredients: refresh. A different single: combine. A pair
 * and a third kind: X replaces the older ingredient. Returns true when anything changed (a refresh
 * counts), false for a spread pickup with nothing active.
 */
export function equipWeapon(w: World, kind: BaseWeaponKind, x = 0, y = 0): boolean {
  const s = weaponState(w);
  if (s.kind === 'spread') {
    if (kind === 'spread') return false;
    s.older = kind;
    s.newer = null;
    s.timer = WEAPON_DURATION;
    setKind(w, kind);
    pullDropIn(s);
    emitWeaponHud(w);
    return true;
  }
  s.timer = WEAPON_DURATION;
  if (kind === s.older || kind === s.newer) {
    emitWeaponHud(w); // a refresh: no combine event, the order of collection stays
    return true;
  }
  const keep: BaseWeaponKind = s.newer === null ? (s.older ?? 'spread') : s.newer;
  const pair = comboOf(keep, kind);
  if (pair === null) {
    emitWeaponHud(w);
    return true;
  }
  s.older = keep;
  s.newer = kind;
  setKind(w, pair);
  const c = comboSpec(pair);
  s.combineFx.x = x;
  s.combineFx.y = y;
  s.combineFx.kind = pair;
  s.combineFx.a = c?.a ?? keep;
  s.combineFx.b = c?.b ?? kind;
  bus.emit('fx:weaponCombine', s.combineFx);
  emitWeaponHud(w);
  return true;
}

/** Back to spread. expired: the timer ran out ('fx:weaponExpire'); a ship death passes false. */
export function resetWeapon(w: World, expired = false): void {
  const s = weaponState(w);
  const was = s.kind;
  if (shieldOf(was) !== null) removeBlades(w);
  const changed = was !== 'spread';
  s.kind = 'spread';
  s.older = null;
  s.newer = null;
  s.timer = 0;
  if (changed && expired) {
    s.expireFx.kind = was;
    bus.emit('fx:weaponExpire', s.expireFx);
  }
  if (changed) emitWeaponHud(w);
}

/** Ship speed along the aim added to base, clamped to [0, max(BULLET_SPEED_MAX, base)]. */
function muzzleSpeed(w: World, ax: number, ay: number, base: number): number {
  const along = (w.vx[0] ?? 0) * ax + (w.vy[0] ?? 0) * ay;
  const cap = base > BULLET_SPEED_MAX ? base : BULLET_SPEED_MAX;
  let speed = base + along;
  if (speed > cap) speed = cap;
  if (speed < 0) speed = 0;
  return speed;
}

function fireRapid(w: World, x: number, y: number, aim: number, combo = 0): void {
  const spec = WEAPONS.rapid;
  const ax = Math.cos(aim);
  const ay = Math.sin(aim);
  const speed = muzzleSpeed(w, ax, ay, spec.speed);
  const mx = x + ax * MUZZLE_OFFSET;
  const my = y + ay * MUZZLE_OFFSET;
  // Perpendicular to the aim is (-ay, ax).
  for (let k = -1; k <= 1; k += 2) {
    const ox = -ay * RAPID_OFFSET * k;
    const oy = ax * RAPID_OFFSET * k;
    const id = spawnBullet(w.bullets, mx + ox, my + oy, ax * speed, ay * speed, spec.life);
    if (id >= 0) {
      w.bullets.style[id] = STYLE_RAPID;
      w.bullets.combo[id] = combo;
    }
  }
}

function firePierce(w: World, x: number, y: number, aim: number, combo = 0, hits = PIERCE_HITS): void {
  const spec = WEAPONS.pierce;
  const ax = Math.cos(aim);
  const ay = Math.sin(aim);
  const speed = muzzleSpeed(w, ax, ay, spec.speed);
  const id = spawnBullet(w.bullets, x + ax * MUZZLE_OFFSET, y + ay * MUZZLE_OFFSET, ax * speed, ay * speed, spec.life);
  if (id >= 0) {
    armPierce(w.bullets, id);
    w.bullets.pierce[id] = hits;
    w.bullets.combo[id] = combo;
  }
}

/** A 3 way fan of bullets (Hail, Trident, Halo): style, speed, life, half angle step, pierce hits (0 none). */
function fireFan(w: World, x: number, y: number, aim: number, combo: number, style: number, base: number, life: number, step: number, hits: number): void {
  const ax = Math.cos(aim);
  const ay = Math.sin(aim);
  const speed = muzzleSpeed(w, ax, ay, base);
  const mx = x + ax * MUZZLE_OFFSET;
  const my = y + ay * MUZZLE_OFFSET;
  for (let k = -1; k <= 1; k++) {
    const a = aim + k * step;
    const id = spawnBullet(w.bullets, mx, my, Math.cos(a) * speed, Math.sin(a) * speed, life);
    if (id < 0) continue;
    if (hits > 0) {
      armPierce(w.bullets, id);
      w.bullets.pierce[id] = hits;
    } else {
      w.bullets.style[id] = style;
    }
    w.bullets.combo[id] = combo;
  }
}

/** Needle: two parallel pierce bullets 5 u either side of the aim, 3 hits each, radius 4. */
function fireNeedle(w: World, x: number, y: number, aim: number): void {
  const ax = Math.cos(aim);
  const ay = Math.sin(aim);
  const speed = muzzleSpeed(w, ax, ay, WEAPONS.pierce.speed);
  const mx = x + ax * MUZZLE_OFFSET;
  const my = y + ay * MUZZLE_OFFSET;
  for (let k = -1; k <= 1; k += 2) {
    const id = spawnBullet(w.bullets, mx - ay * RAPID_OFFSET * k, my + ax * RAPID_OFFSET * k, ax * speed, ay * speed, WEAPONS.pierce.life);
    if (id < 0) continue;
    armPierce(w.bullets, id);
    w.bullets.pierce[id] = NEEDLE_HITS;
    w.bullets.combo[id] = 4;
  }
}

/**
 * One volley of the current weapon from the ship at (x, y). Spread is exactly fireSpread. Orbit
 * fires nothing forward (Ryan's redesign: the shield is the weapon).
 */
export function fireWeapon(w: World, x: number, y: number, aim: number): void {
  switch (weaponState(w).kind) {
    case 'spread':
      fireSpread(w, x, y, aim);
      return;
    case 'rapid':
      fireRapid(w, x, y, aim);
      return;
    case 'pierce':
      firePierce(w, x, y, aim);
      return;
    case 'orbit':
      return;
    case 'spread+rapid':
      fireFan(w, x, y, aim, 1, STYLE_RAPID, WEAPONS.rapid.speed, HAIL_LIFE, (HAIL_DEG * Math.PI) / 180, 0);
      return;
    case 'spread+pierce':
      fireFan(w, x, y, aim, 2, 0, WEAPONS.pierce.speed, WEAPONS.pierce.life, (TRIDENT_DEG * Math.PI) / 180, TRIDENT_HITS);
      return;
    case 'spread+orbit':
      fireFan(w, x, y, aim, 3, 0, BULLET_SPEED, BULLET_LIFE, SPREAD_RAD, 0);
      return;
    case 'rapid+pierce':
      fireNeedle(w, x, y, aim);
      return;
    case 'rapid+orbit':
      fireRapid(w, x, y, aim, 5);
      return;
    case 'pierce+orbit':
      firePierce(w, x, y, aim, 6, ECLIPSE_HITS);
      return;
  }
}

/**
 * Place the spikes around the ship at orbitPhase: the inner ring turning forward, the outer ring
 * back. Over dt the saw level moves toward 1 while the aim stick is held (0 otherwise) and each spike
 * within SAW_CONE of the aim stretches with it. Writes the render contract: style 3,
 * phase (angle round the ship), vx and vy along the orbit tangent, spikeLen. Spawns any spike that is
 * missing (pool full earlier). prevX and prevY keep the last spot for render.
 */
export function placeBlades(w: World, dt = 0): void {
  const s = weaponState(w);
  const sh = shieldOf(s.kind);
  if (sh === null) return;
  const p = w.bullets;
  const sx = w.x[0] ?? 0;
  const sy = w.y[0] ?? 0;
  const held = w.ship.firing;
  const aim = w.ship.aimAngle;
  const combo = comboIndex(s.kind);
  const n = sh.perRing * 2;
  s.hitters = n;
  s.saw = stepSaw(s.saw, held, dt);
  for (let i = 0; i < n; i++) {
    const ring = ringOf(sh, i);
    const a = spikeAngle(sh, i, s.orbitPhase);
    const m = spikeStretch(s.saw, sawWeight(a, aim));
    s.stretch[i] = m;
    const r = ring === 0 ? sh.inner : sh.outer;
    const omega = ringDir(ring) * sh.rev * 2 * Math.PI;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const x = sx + c * r;
    const y = sy + sn * r;
    let b = s.blades[i] ?? -1;
    if (b < 0 || p.alive[b] !== 1 || p.style[b] !== STYLE_ORBIT) {
      b = spawnBullet(p, x, y, 0, 0, s.timer);
      s.blades[i] = b;
      if (b < 0) continue;
      p.style[b] = STYLE_ORBIT;
      s.bladeCool[i] = 0;
    } else {
      p.prevX[b] = p.x[b] ?? x;
      p.prevY[b] = p.y[b] ?? y;
      p.x[b] = x;
      p.y[b] = y;
    }
    p.phase[b] = a;
    p.vx[b] = -sn * omega * r;
    p.vy[b] = c * omega * r;
    p.life[b] = s.timer;
    p.combo[b] = combo;
    p.spikeLen[b] = SPIKE_LEN * m;
  }
}

/** Weapon timer, the shield and the throttled 'hud:weapon'. Call after stepWorld. */
export function stepWeapons(w: World, dt: number): void {
  const s = weaponState(w);
  if (s.kind === 'spread') return;
  s.timer -= dt;
  if (s.timer <= 1e-9) {
    resetWeapon(w, true);
    return;
  }
  const sh = shieldOf(s.kind);
  if (sh !== null && w.ship.active) {
    s.orbitPhase = (s.orbitPhase + sh.rev * 2 * Math.PI * dt) % (2 * Math.PI);
    placeBlades(w, dt);
  }
  s.hudTimer -= dt;
  if (s.hudTimer <= 0) emitWeaponHud(w);
}
