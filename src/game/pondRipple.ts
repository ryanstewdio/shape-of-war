// Tester 3 pond ripples (wave T3). LevelDef.ripples schedules ring waves on the wave clock: at
// atSec minus RIPPLE_WARN_SEC the sim emits 'sim:rippleWarn', at atSec it emits 'sim:ripple' and a
// wave starts at (x, y). The front radius is POND_WAVE_SPEED x age and the wave lives
// POND_WAVE_LIFE s (age runs on w.time, so a wave keeps moving through a respawn pause). A body
// inside the band (|distance minus front| below POND_WAVE_WIDTH) is pushed radially outward at
// a speed scaled by strength, a triangular band falloff, a linear age fade and the difficulty
// driftScale. Ship: SHIP_PUSH at strength 1; enemies ENEMY_PUSH (double). Bosses, boss parts,
// hazards, pickups, drones, snake bodies and static kinds are never moved. Every push goes
// through the arena confinement, so walls and obstacles block as usual. Live waves stack
// additively. No PRNG and no allocation in the step. Levels without ripples, Free Play and
// Endless leave the state inactive and stepGame never calls stepPond.
import { bus } from '../core/events';
import { POND_WAVE_LIFE, POND_WAVE_SPEED, POND_WAVE_WIDTH, RIPPLE_WARN_SEC } from '../core/pondRipple';
import type { LevelDef, RippleEvent } from '../levelgen/leveldef';
import { confineOn, createConfineResult } from './arena';
import { difficultyOf } from './difficulty';
import { canEnrage, membraneMove } from './membrane';
import { SHIP_SPEED } from './ship';
import { gs } from './state';
import { Kind, type World } from './world';

/** Ship push speed at strength 1, band centre, age 0 (u/s): a quarter of the ship's top speed. */
export const SHIP_PUSH = SHIP_SPEED * 0.25;
/** Enemy push speed at strength 1, band centre, age 0 (u/s): double the ship's. */
export const ENEMY_PUSH = SHIP_PUSH * 2;
/** Most waves alive at once; an older wave is dropped for a newer one past this. */
export const MAX_LIVE_WAVES = 8;

export interface PondState {
  /** True when the level has at least one ripple and the mode plays them. */
  active: boolean;
  /** The level's ripples sorted by atSec (empty when none). */
  events: readonly RippleEvent[];
  /** Index of the next event to warn. */
  nextWarn: number;
  /** Index of the next event to start. */
  nextStart: number;
  /** Live wave slots: event index, or -1 for an empty slot. */
  slotEvent: Int32Array;
  /** Live wave slots: w.time the wave started. */
  slotStart: Float64Array;
}

/** Pure: the level's ripples sorted by atSec (a copy only when out of order). */
export function sortedRipples(level: LevelDef): readonly RippleEvent[] {
  const r = level.ripples;
  if (r === undefined || r.length === 0) return [];
  for (let i = 1; i < r.length; i++) {
    if ((r[i]?.atSec ?? 0) < (r[i - 1]?.atSec ?? 0)) return [...r].sort((a, b) => a.atSec - b.atSec);
  }
  return r;
}

export function createPond(level: LevelDef): PondState {
  const events = sortedRipples(level);
  return {
    active: events.length > 0,
    events,
    nextWarn: 0,
    nextStart: 0,
    slotEvent: new Int32Array(MAX_LIVE_WAVES).fill(-1),
    slotStart: new Float64Array(MAX_LIVE_WAVES),
  };
}

/** Pure: front radius of a wave age seconds old. */
export function frontRadius(age: number): number {
  return POND_WAVE_SPEED * age;
}

/** Pure: band weight 0 to 1 of a body dist from the centre, wave age seconds old (1 on the front). */
export function bandWeight(dist: number, age: number): number {
  if (age < 0 || age >= POND_WAVE_LIFE) return 0;
  const off = Math.abs(dist - frontRadius(age));
  return off >= POND_WAVE_WIDTH ? 0 : 1 - off / POND_WAVE_WIDTH;
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

const warnFx = { x: 0, y: 0, inSec: RIPPLE_WARN_SEC, strength: 1 };
const startFx = { x: 0, y: 0, strength: 1 };
const d = { x: 0, y: 0 };
const push = { x: 0, y: 0 };
const res = createConfineResult();

/** Emit due warnings and starts at wave clock `clock`, and drop waves past POND_WAVE_LIFE. */
export function advancePond(p: PondState, clock: number, now: number): void {
  const ev = p.events;
  while (p.nextWarn < ev.length) {
    const e = ev[p.nextWarn];
    if (e === undefined || clock < e.atSec - RIPPLE_WARN_SEC) break;
    p.nextWarn++;
    warnFx.x = e.x;
    warnFx.y = e.y;
    warnFx.strength = e.strength;
    warnFx.inSec = e.atSec >= RIPPLE_WARN_SEC ? RIPPLE_WARN_SEC : Math.max(0, e.atSec - clock);
    bus.emit('sim:rippleWarn', warnFx);
  }
  for (let s = 0; s < MAX_LIVE_WAVES; s++) {
    if ((p.slotEvent[s] ?? -1) >= 0 && now - (p.slotStart[s] ?? 0) >= POND_WAVE_LIFE) p.slotEvent[s] = -1;
  }
  while (p.nextStart < ev.length) {
    const e = ev[p.nextStart];
    if (e === undefined || clock < e.atSec) break;
    startWave(p, p.nextStart, now);
    p.nextStart++;
    startFx.x = e.x;
    startFx.y = e.y;
    startFx.strength = e.strength;
    bus.emit('sim:ripple', startFx);
  }
}

/** Put event i in a free slot, or in the oldest slot when every slot is live. */
function startWave(p: PondState, i: number, now: number): void {
  let pick = 0;
  let oldest = Number.POSITIVE_INFINITY;
  for (let s = 0; s < MAX_LIVE_WAVES; s++) {
    if ((p.slotEvent[s] ?? -1) < 0) {
      pick = s;
      break;
    }
    const t = p.slotStart[s] ?? 0;
    if (t < oldest) {
      oldest = t;
      pick = s;
    }
  }
  p.slotEvent[pick] = i;
  p.slotStart[pick] = now;
}

/** Sum of every live wave's outward push velocity on a body at (x, y), written into out. */
export function pondPush(w: World, x: number, y: number, base: number, scale: number, out: { x: number; y: number }): { x: number; y: number } {
  const p = w.pond;
  out.x = 0;
  out.y = 0;
  for (let s = 0; s < MAX_LIVE_WAVES; s++) {
    const i = p.slotEvent[s] ?? -1;
    if (i < 0) continue;
    const e = p.events[i];
    if (e === undefined) continue;
    w.surface.delta(e.x, e.y, x, y, d);
    const dist = Math.hypot(d.x, d.y);
    if (dist < 1e-6) continue;
    const v = pushSpeed(base, e.strength, dist, w.time - (p.slotStart[s] ?? 0), scale);
    if (v === 0) continue;
    out.x += (d.x / dist) * v;
    out.y += (d.y / dist) * v;
  }
  return out;
}

function hasLiveWave(p: PondState): boolean {
  for (let s = 0; s < MAX_LIVE_WAVES; s++) if ((p.slotEvent[s] ?? -1) >= 0) return true;
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

/** Called by stepGame right after stepWorld when the pond is active: schedule, then push. */
export function stepPond(w: World, dt: number): void {
  const p = w.pond;
  const g = gs(w);
  advancePond(p, g.waveClock, w.time);
  if (!hasLiveWave(p)) return;
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
