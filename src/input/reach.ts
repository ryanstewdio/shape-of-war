// Pure right thumb reach model (thumbs-buttons). CSS px throughout.
// Floating sticks anchor where the thumb lands, so there is no fixed stick position. The aim rest
// zone is the region where a right thumb typically lands for the aim stick: low on the right, a
// little in from the right edge, where Ryan found the old bomb and super sat under his thumb. It is
// measured from the safe area right and bottom edges because a thumb rests a physical distance in
// from the edge the hand holds, not a fraction of the screen.
// The bomb and super stack now sits high on the right edge, above the zone: the bomb bottom edge
// is STACK_CLEAR (stick radius plus 24) above the zone top, so the aim ring at full deflection from
// any anchor in the zone stays at least 24 px clear of both buttons. On a short screen (the 411 px
// cover with top and bottom insets) the stack cannot rise above the pause button, so the zone top
// is trimmed down to keep that clearance instead (never below REST_MIN_H tall).
// Fold 7 scale: about 63 CSS px per cm on the cover, 55 on the main screen.
import { STACK_CLEAR, STACK_H, stackTopMin } from './stack';
import { STICK_RADIUS } from './stick';
import type { Insets, Rect } from './types';

/** Zone right edge, CSS px left of the safe area right edge (about 1.5 cm cover, 1.7 cm main). */
export const REST_RIGHT = 96;
/** Zone bottom edge, CSS px above the safe area bottom edge. */
export const REST_BOTTOM = 4;
/** Zone size, extending up and left of its bottom right corner (about 1 cm tall). */
export const REST_W = 160;
export const REST_H = 64;
/**
 * Smallest zone height the trimmed cover layout may give. thumbs-button-look: the super label
 * pushes the cover stack 8 px lower, so the worst inset case (24 top, 16 bottom) leaves 11 px.
 */
export const REST_MIN_H = 8;

/**
 * Comfortable thumb stretch from the rest zone to the near edge of a button hit circle. The minimum
 * is the ring clearance itself; 240 px is about 3.8 cm on the cover and 4.4 cm on the main screen,
 * inside an adult thumb's sweep from a resting pad without moving the hand.
 */
export const REACH_MIN = STACK_CLEAR;
export const REACH_MAX = 240;

/** Pure: lowest the zone top may sit for the stack to fit under the pause button with its clearance. */
export function zoneTopMin(insets: Insets): number {
  return stackTopMin(insets.top) + STACK_H + STACK_CLEAR;
}

/** Pure: the aim stick rest zone for a viewport and its safe area insets. */
export function aimRestZone(cssW: number, cssH: number, insets: Insets): Rect {
  const right = cssW - insets.right - REST_RIGHT;
  const bottom = cssH - insets.bottom - REST_BOTTOM;
  const top = Math.min(bottom, Math.max(bottom - REST_H, zoneTopMin(insets)));
  return { x: right - REST_W, y: top, w: REST_W, h: bottom - top };
}

/** Pure: shortest distance from a point to a rect (0 inside). */
export function distToRect(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * Pure: thumb stretch from the nearest point of the zone to the near edge of a circular hit area
 * (the inscribed circle of `hit`). Negative means the zone reaches into the button.
 */
export function reachGap(zone: Rect, hit: Rect): number {
  return distToRect(zone, hit.x + hit.w / 2, hit.y + hit.h / 2) - hit.w / 2;
}

/**
 * Pure: clearance between the aim ring at full deflection (STICK_RADIUS) from the worst anchor in
 * the zone and a circular hit area. Zero or more means no anchor in the zone puts the ring over it.
 */
export function ringClearance(zone: Rect, hit: Rect, radius = STICK_RADIUS): number {
  return reachGap(zone, hit) - radius;
}
