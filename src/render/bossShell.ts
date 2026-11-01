// Look GW2: the boss shield shell. While a boss shield is up (Warden's BossView.shielded and
// shieldLeft, or 'sim:bossShield' up for any boss) a hexagonal shell in the Bulwark white turns
// slowly round the body, its rim pulsing bright on every absorbed hit, the core dimmed behind it.
// When the shield drops the shell shatters into 6 outline shards and the open core pulses bright
// with a ring that shrinks over the open window, so the player sees the window closing. Small fixed
// state and pure maths; the renderer owns the Graphics.
import type { Bus, EventKey } from '../core/events';
import { hslToRgbInt } from './color';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** Bulwark shield white, hsl 0 0 95 percent. */
export const SHELL_WHITE: number = hslToRgbInt(0, 0, 0.95);
export const SHELL_SIDES = 6;
/** Shell radius as a multiple of the boss body radius, and its slow turn (rad/s). */
export const SHELL_PAD = 1.32;
export const SHELL_SPIN = 0.4;
/** Rim pulse decay time constant (s) after an absorbed hit. */
export const SHELL_HIT_TAU = 0.12;
/** Core alpha multiplier behind the raised shell (the dim veil alpha is 1 minus this). */
export const SHELL_CORE_DIM = 0.35;
/** Shatter: seconds the shards fly, and how far (x the shell radius) they drift out. */
export const SHATTER_SEC = 0.75;
export const SHATTER_DRIFT = 0.7;
/** Open window length when the sim does not give one (Warden WARDEN_SHIELD.openSec). */
export const SHELL_OPEN_SEC = 2.5;
/** The window ring shrinks from this to the core share (both x the body radius). */
export const WINDOW_RING_R0 = 1.25;
export const WINDOW_RING_R1 = 0.3;

export interface ShellState {
  /** Shield up as last seen. */
  up: boolean;
  /** Up flag from 'sim:bossShield' (any boss). */
  evUp: boolean;
  /** Seconds since the last absorbed hit while up. */
  hitAge: number;
  /** Seconds since the shield dropped (Infinity when no shatter is running). */
  dropAge: number;
  /** Open window seconds left after the drop, and its full length. */
  openLeft: number;
  openTotal: number;
}

export function createShellState(): ShellState {
  return { up: false, evUp: false, hitAge: Number.POSITIVE_INFINITY, dropAge: Number.POSITIVE_INFINITY, openLeft: 0, openTotal: SHELL_OPEN_SEC };
}

export function resetShellState(s: ShellState): void {
  s.up = false;
  s.evUp = false;
  s.hitAge = Number.POSITIVE_INFINITY;
  s.dropAge = Number.POSITIVE_INFINITY;
  s.openLeft = 0;
  s.openTotal = SHELL_OPEN_SEC;
}

/**
 * Advance one frame. shielded: the view's flag (or false); openSec: the sim's open seconds left
 * when known (exposedLeft), else a negative number. On the up to down edge the shatter starts and
 * the window runs for openSec (or SHELL_OPEN_SEC).
 */
export function stepShell(s: ShellState, shielded: boolean, openSec: number, dt: number): void {
  const d = Math.max(0, fin(dt, 0));
  const now = shielded || s.evUp;
  if (s.up && !now) {
    s.dropAge = 0;
    s.openTotal = openSec > 0 && Number.isFinite(openSec) ? openSec : SHELL_OPEN_SEC;
    s.openLeft = s.openTotal;
  } else {
    if (Number.isFinite(s.dropAge)) s.dropAge = s.dropAge + d > SHATTER_SEC ? Number.POSITIVE_INFINITY : s.dropAge + d;
    s.openLeft = Math.max(0, s.openLeft - d);
  }
  if (now && !s.up) {
    s.openLeft = 0;
    s.dropAge = Number.POSITIVE_INFINITY;
  }
  s.up = now;
  s.hitAge += d;
}

/** An absorbed hit: pulse the rim (only while the shell is up). */
export function shellHit(s: ShellState): void {
  if (s.up) s.hitAge = 0;
}

/** Pure: rim pulse 0 to 1 at seconds since the last absorbed hit. */
export function shellRimPulse(hitAge: number): number {
  const a = fin(hitAge, Number.POSITIVE_INFINITY);
  return a < 0 ? 0 : Math.exp(-a / SHELL_HIT_TAU);
}

/** Pure: shell rotation at timeSec. */
export function shellRot(timeSec: number): number {
  return fin(timeSec, 0) * SHELL_SPIN;
}

/** Pure: shell vertex k at rotation rot and radius R, about the origin, into out[0..1]. */
export function shellVertex(k: number, rot: number, R: number, out: Float32Array): Float32Array {
  const a = rot + (k * Math.PI * 2) / SHELL_SIDES;
  out[0] = Math.cos(a) * R;
  out[1] = Math.sin(a) * R;
  return out;
}

/** Pure: breathing alpha 0.75 to 1 of the raised shell (slow, so it reads as alive). */
export function shellBreath(timeSec: number): number {
  return 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(fin(timeSec, 0) * 4));
}

export interface Shard {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Alpha 0 to 1. */
  a: number;
}

/**
 * Pure: shard k (one hexagon edge) at age seconds after the drop, about the origin, shell radius R,
 * rotation rot at the drop: the edge drifts out from the centre, tumbles and fades.
 */
export function shellShard(k: number, age: number, rot: number, R: number, out: Shard): Shard {
  const u = Math.max(0, Math.min(1, fin(age, SHATTER_SEC) / SHATTER_SEC));
  const a0 = rot + (k * Math.PI * 2) / SHELL_SIDES;
  const a1 = rot + ((k + 1) * Math.PI * 2) / SHELL_SIDES;
  const mx = ((Math.cos(a0) + Math.cos(a1)) / 2) * R;
  const my = ((Math.sin(a0) + Math.sin(a1)) / 2) * R;
  const ml = Math.hypot(mx, my) || 1;
  const ease = 1 - (1 - u) * (1 - u);
  const off = SHATTER_DRIFT * R * ease;
  const cx = mx + (mx / ml) * off;
  const cy = my + (my / ml) * off;
  // Half edge vector, shrunk and tumbled (alternate shards spin opposite ways).
  const hx = ((Math.cos(a1) - Math.cos(a0)) / 2) * R * (1 - 0.4 * u);
  const hy = ((Math.sin(a1) - Math.sin(a0)) / 2) * R * (1 - 0.4 * u);
  const t = (k % 2 === 0 ? 1 : -1) * 2.2 * ease;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const rx = hx * c - hy * s;
  const ry = hx * s + hy * c;
  out.x0 = cx - rx;
  out.y0 = cy - ry;
  out.x1 = cx + rx;
  out.y1 = cy + ry;
  out.a = 1 - u;
  return out;
}

/** Pure: window share 1 (just opened) to 0 (closing) of the open window. */
export function windowShare(openLeft: number, openTotal: number): number {
  const T = openTotal > 0 ? openTotal : SHELL_OPEN_SEC;
  return Math.max(0, Math.min(1, fin(openLeft, 0) / T));
}

/** Pure: window ring radius (x the body radius) at a window share: shrinks onto the core. */
export function windowRingR(share: number): number {
  const s = Math.max(0, Math.min(1, fin(share, 0)));
  return WINDOW_RING_R1 + (WINDOW_RING_R0 - WINDOW_RING_R1) * s;
}

/** Pure: open core pulse 0.6 to 1, beating faster as the window closes. */
export function windowCorePulse(timeSec: number, share: number): number {
  const hz = 3 + 5 * (1 - Math.max(0, Math.min(1, fin(share, 0))));
  return 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(fin(timeSec, 0) * hz * Math.PI * 2));
}

// Bus

export const BOSS_SHIELD_EVENT = 'sim:bossShield';
type ShieldKey = Extract<EventKey, typeof BOSS_SHIELD_EVENT>;

export function onBossShield(b: Bus, h: (up: boolean) => void): () => void {
  return b.on<ShieldKey>(BOSS_SHIELD_EVENT, (p) => h(p.up));
}
