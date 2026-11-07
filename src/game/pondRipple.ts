// Pond ripples (T4, Ryan's direction on the T3 device check). A ripple starts only when a Gravity
// well in super nova is destroyed (shot down, cut by orbit blades or blown up at MASS_LIMIT), on the
// same step, at the well centre: 'sim:ripple' { x, y, strength } fires and a ring wave starts there.
// No warning. strength is 0.6 for a base size well up to 1 for a well about to explode (novaStrength).
// The front radius is POND_WAVE_SPEED x age and the wave lives POND_WAVE_LIFE s (age runs on w.time,
// so a wave keeps moving through a respawn pause). A body inside the band (|distance minus front|
// below POND_WAVE_WIDTH) is pushed radially outward at a speed scaled by strength, a raised cosine
// band profile (smooth in and out, so it reads as a wave, not a teleport), a linear age fade and
// the difficulty driftScale. Ship: SHIP_PUSH at strength 1; enemies ENEMY_PUSH (double). Bosses,
// boss parts, hazards, pickups, drones, snake bodies and static kinds are never moved. Every push
// goes through the arena confinement, so walls and obstacles block as usual. Distances use
// surface.delta, so a drum seam is crossed correctly. Live waves stack additively. No PRNG and no
// allocation in the step. With no live wave stepPond returns before touching anything, so a run
// with no nova kill is bit identical to one without this module. Endless has no wells and keeps
// the pond inactive.
import { bus } from '../core/events';
import { POND_WAVE_LIFE, POND_WAVE_SPEED, POND_WAVE_WIDTH } from '../core/pondRipple';
import { confineOn, createConfineResult } from './arena';
import { difficultyOf } from './difficulty';
import { canEnrage, membraneMove } from './membrane';
import { SHIP_SPEED } from './ship';
import { gs } from './state';
import { Kind, type World } from './world';

/** Ship push speed at strength 1, band centre, age 0 (u/s): 1.2 of the ship's top speed. */
export const SHIP_PUSH = SHIP_SPEED * 1.2;
/** Enemy push speed at strength 1, band centre, age 0 (u/s): double the ship's. */
export const ENEMY_PUSH = SHIP_PUSH * 2;
/** Most waves alive at once; the oldest wave is dropped for a newer one past this. */
export const MAX_LIVE_WAVES = 8;
/** Ripple strength of a base size well (no mass) and of a full well (MASS_LIMIT). */
export const STRENGTH_MIN = 0.6;
export const STRENGTH_MAX = 1;

export interface PondState {
  /** False in Endless (no wells): a destroyed well never starts a wave. */
  active: boolean;
  /** Live wave slots: 1 when the slot holds a live wave. */
  slotLive: Uint8Array;
  /** Live wave slots: w.time the wave started. */
  slotStart: Float64Array;
  /** Live wave slots: centre and strength. */
  slotX: Float64Array;
  slotY: Float64Array;
  slotStrength: Float64Array;
}

export function createPond(): PondState {
  return {
    active: true,
    slotLive: new Uint8Array(MAX_LIVE_WAVES),
    slotStart: new Float64Array(MAX_LIVE_WAVES),
    slotX: new Float64Array(MAX_LIVE_WAVES),
    slotY: new Float64Array(MAX_LIVE_WAVES),
    slotStrength: new Float64Array(MAX_LIVE_WAVES),
  };
}

/** Pure: ripple strength of a well of radius r, given its base radius and its radius at MASS_LIMIT. */
export function novaStrength(r: number, base: number, full: number): number {
  const span = full - base;
  const u = span > 0 ? Math.min(1, Math.max(0, (r - base) / span)) : 0;
  return STRENGTH_MIN + (STRENGTH_MAX - STRENGTH_MIN) * u;
}

/** Pure: front radius of a wave age seconds old. */
export function frontRadius(age: number): number {
  return POND_WAVE_SPEED * age;
}

/**
 * Pure: band weight 0 to 1 of a body dist from the centre, wave age seconds old. A raised cosine
 * across the band: 1 on the front, easing smoothly to 0 at POND_WAVE_WIDTH either side.
 */
export function bandWeight(dist: number, age: number): number {
  if (age < 0 || age >= POND_WAVE_LIFE) return 0;
  const off = Math.abs(dist - frontRadius(age));
  return off >= POND_WAVE_WIDTH ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * off) / POND_WAVE_WIDTH);
}

/** Pure: age fade 0 to 1 (1 at the start, 0 at POND_WAVE_LIFE). */
export function ageFade(age: number): number {
  if (age < 0 || age >= POND_WAVE_LIFE) return 0;
  return 1 - age / POND_WAVE_LIFE;
}

/** Pure: outward push speed (u/s) of one wave on a body; base is SHIP_PUSH or ENEMY_PUSH. */
export function pushSpeed(base: number, strength: number, dist: number, age: number, scale: number): number {
  return base * strength * bandWeight(dist, age) * ageFade(age) * scale;
}

/** Pure: kinds a wave pushes besides the ship: moving enemies only, never a boss kind or a static one. */
export function ripplePushes(k: number): boolean {
  return canEnrage(k) && k !== Kind.Spawner;
}

const startFx = { x: 0, y: 0, strength: 1 };
const d = { x: 0, y: 0 };
const push = { x: 0, y: 0 };
const res = createConfineResult();

/** Put a wave in a free slot, or in the oldest slot when every slot is live. */
function takeSlot(p: PondState): number {
  let pick = 0;
  let oldest = Number.POSITIVE_INFINITY;
  for (let s = 0; s < MAX_LIVE_WAVES; s++) {
    if (p.slotLive[s] !== 1) return s;
    const t = p.slotStart[s] ?? 0;
    if (t < oldest) {
      oldest = t;
      pick = s;
    }
  }
  return pick;
}

/** Start a wave at (x, y) now and emit 'sim:ripple'. No op while the pond is inactive. */
export function startRipple(w: World, x: number, y: number, strength: number): void {
  const p = w.pond;
  if (!p.active) return;
  const s = takeSlot(p);
  p.slotLive[s] = 1;
  p.slotStart[s] = w.time;
  p.slotX[s] = x;
  p.slotY[s] = y;
  p.slotStrength[s] = strength;
  startFx.x = x;
  startFx.y = y;
  startFx.strength = strength;
  bus.emit('sim:ripple', startFx);
}

/** True when well entity id is in a live well slot that has erupted. */
function inNova(w: World, id: number): boolean {
  const g = gs(w);
  for (let i = 0; i < g.wellCount; i++) if (g.wellIds[i] === id) return g.wellNova[i] === 1;
  return false;
}

/**
 * Well death hook: call while well id is still alive and in the well list, just before it is
 * removed by a destroying kill. Starts a ripple when the well is in nova; nothing otherwise.
 */
export function wellDeathRipple(w: World, id: number, base: number, full: number): void {
  if (!w.pond.active || w.kind[id] !== Kind.GravityWell || w.alive[id] !== 1 || !inNova(w, id)) return;
  startRipple(w, w.x[id] ?? 0, w.y[id] ?? 0, novaStrength(w.radius[id] ?? base, base, full));
}

/** Drop waves past POND_WAVE_LIFE. */
function expire(p: PondState, now: number): void {
  for (let s = 0; s < MAX_LIVE_WAVES; s++) {
    if (p.slotLive[s] === 1 && now - (p.slotStart[s] ?? 0) >= POND_WAVE_LIFE) p.slotLive[s] = 0;
  }
}

/** Sum of every live wave's outward push velocity on a body at (x, y), written into out. */
export function pondPush(w: World, x: number, y: number, base: number, scale: number, out: { x: number; y: number }): { x: number; y: number } {
  const p = w.pond;
  out.x = 0;
  out.y = 0;
  for (let s = 0; s < MAX_LIVE_WAVES; s++) {
    if (p.slotLive[s] !== 1) continue;
    w.surface.delta(p.slotX[s] ?? 0, p.slotY[s] ?? 0, x, y, d);
    const dist = Math.hypot(d.x, d.y);
    if (dist < 1e-6) continue;
    const v = pushSpeed(base, p.slotStrength[s] ?? 0, dist, w.time - (p.slotStart[s] ?? 0), scale);
    if (v === 0) continue;
    out.x += (d.x / dist) * v;
    out.y += (d.y / dist) * v;
  }
  return out;
}

/** True while at least one wave is live. */
export function hasLiveWave(p: PondState): boolean {
  for (let s = 0; s < MAX_LIVE_WAVES; s++) if (p.slotLive[s] === 1) return true;
  return false;
}

/** Move entity id by (dx, dy) through the arena confinement (membranes included). */
function nudge(w: World, id: number, dx: number, dy: number): void {
  const nx = (w.x[id] ?? 0) + dx;
  const ny = (w.y[id] ?? 0) + dy;
  const r = w.membranes ? membraneMove(w, id, nx, ny, res) : confineOn(w.surface, w.level.arena, nx, ny, w.radius[id] ?? 0, res);
  w.x[id] = r.x;
  w.y[id] = r.y;
}

/** Called by stepGame right after stepWorld: expire old waves, then push. No op with no live wave. */
export function stepPond(w: World, dt: number): void {
  const p = w.pond;
  if (!hasLiveWave(p)) return;
  expire(p, w.time);
  if (!hasLiveWave(p)) return;
  const g = gs(w);
  const scale = difficultyOf(w).driftScale;
  if (w.ship.active && w.alive[0] === 1) {
    pondPush(w, w.x[0] ?? 0, w.y[0] ?? 0, SHIP_PUSH, scale, push);
    if (push.x !== 0 || push.y !== 0) nudge(w, 0, push.x * dt, push.y * dt);
  }
  for (let id = 1; id < w.cap; id++) {
    if (w.alive[id] !== 1 || !ripplePushes(w.kind[id] ?? 0)) continue;
    if ((g.tele[id] ?? 0) > 0) continue; // still telegraphing its spawn
    pondPush(w, w.x[id] ?? 0, w.y[id] ?? 0, ENEMY_PUSH, scale, push);
    if (push.x !== 0 || push.y !== 0) nudge(w, id, push.x * dt, push.y * dt);
  }
}
