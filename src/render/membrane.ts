// Pure membrane bar styling (glow-membrane brief). An Obstacle with membrane true blocks the ship and
// its bullets but lets enemies squeeze through, so it draws as a translucent shimmering bar instead of
// a solid wall. No pixi import, no PRNG: ripple and flash are functions of time and slot only.
import type { ArenaDef, Obstacle } from '../levelgen/leveldef';

/** Fill alpha of the bar. */
export const MEMBRANE_FILL_ALPHA = 0.12;
/** The outline is the arena wall colour lifted this share toward white. */
export const MEMBRANE_LIFT = 0.2;
/** Ripple amplitude in arena units, ripple speed in cycles per second, wavelength in arena units. */
export const MEMBRANE_RIPPLE_AMP = 3;
export const MEMBRANE_RIPPLE_HZ = 0.35;
export const MEMBRANE_WAVELENGTH = 140;
/** Dash pattern on the sample grid: on, then off, samples. */
export const MEMBRANE_DASH_ON = 2;
export const MEMBRANE_DASH_OFF = 1;
/** Seconds the overlap brightening takes to fade. */
export const MEMBRANE_FLASH_SEC = 0.35;
/** Extra fill alpha at full flash. */
export const MEMBRANE_FLASH_FILL = 0.45;

export type ObstacleStyle = 'membrane' | 'solid';

/** Pure: which style an obstacle takes. */
export function obstacleStyle(o: Obstacle): ObstacleStyle {
  return o.membrane === true ? 'membrane' : 'solid';
}

/** Pure: the solid obstacles of an arena (membrane bars are drawn by the membrane layer). */
export function solidObstacles(a: ArenaDef): Obstacle[] {
  return a.obstacles.filter((o) => o.membrane !== true);
}

/** Pure: the membrane obstacles of an arena. */
export function membraneObstacles(a: ArenaDef): Obstacle[] {
  return a.obstacles.filter((o) => o.membrane === true);
}

/** Pure: the arena wall colour lifted 20 percent toward white (0xRRGGBB). */
export function liftColour(colour: number, amount: number = MEMBRANE_LIFT): number {
  const r = (colour >> 16) & 0xff;
  const g = (colour >> 8) & 0xff;
  const b = colour & 0xff;
  const l = (c: number): number => Math.round(c + (255 - c) * amount);
  return (l(r) << 16) | (l(g) << 8) | l(b);
}

/** Pure: ripple offset in arena units at distance s along the bar, time t seconds, per bar phase. */
export function membraneRipple(s: number, t: number, phase: number): number {
  return MEMBRANE_RIPPLE_AMP * Math.sin((s / MEMBRANE_WAVELENGTH) * Math.PI * 2 - t * MEMBRANE_RIPPLE_HZ * Math.PI * 2 + phase);
}

/** Pure: true when dash sample i is drawn. Shift scrolls the pattern slowly along the bar. */
export function dashOn(i: number, shift: number): boolean {
  const period = MEMBRANE_DASH_ON + MEMBRANE_DASH_OFF;
  const m = (((i + shift) % period) + period) % period;
  return m < MEMBRANE_DASH_ON;
}

/** Pure: number of samples along a bar of the given length, clamped. */
export function membraneSamples(length: number): number {
  return Math.max(4, Math.min(48, Math.ceil(length / 12)));
}

/** Pure: does a circle overlap an obstacle rectangle? */
export function circleOverlapsObstacle(o: Obstacle, x: number, y: number, r: number): boolean {
  const dx = Math.abs(x - o.cx) - o.w / 2;
  const dy = Math.abs(y - o.cy) - o.h / 2;
  const ox = dx > 0 ? dx : 0;
  const oy = dy > 0 ? dy : 0;
  return ox * ox + oy * oy <= r * r;
}

/** Pure: flash level after dt seconds of decay, raised to 1 when hit. */
export function stepFlash(flash: number, dt: number, hit: boolean): number {
  if (hit) return 1;
  const next = flash - dt / MEMBRANE_FLASH_SEC;
  return next > 0 ? next : 0;
}
