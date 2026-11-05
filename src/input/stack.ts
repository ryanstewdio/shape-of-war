// Button sizes and stack spacing, CSS px (thumbs-buttons). Shared by buttons.ts and reach.ts, so
// neither imports the other.
import { STICK_RADIUS } from './stick';

/** Bomb and super hit circles: both at the 64 px floor, so the stack fits the 411 px cover screen. */
export const BOMB_VISUAL = 60;
export const BOMB_HIT = 64;
export const SUPER_VISUAL = 52;
export const SUPER_HIT = 64;
/** Gap between the super and bomb hit circles. */
export const SUPER_GAP = 12;
export const PAUSE_VISUAL = 40;
export const PAUSE_HIT = 56;
export const PAUSE_INSET = 12;
/** Gap between the pause hit rect and the top of the super hit circle at the highest stack. */
export const STACK_TOP_GAP = 4;
/** Bomb and super stack centre, CSS px left of the right edge of the button area. */
export const STACK_RIGHT = 44;
/** Extra room past the aim ring between the rest zone top and the bomb bottom edge. */
export const RING_GAP = 24;
/** Bomb bottom edge sits at least this far above the aim rest zone top: one stick radius plus 24. */
export const STACK_CLEAR = STICK_RADIUS + RING_GAP;
/** Height of the stack from the super top edge to the bomb bottom edge. */
export const STACK_H = SUPER_HIT + SUPER_GAP + BOMB_HIT;

/** Pure: pause hit rect bottom edge below the top of the screen. */
export function pauseBottom(insetTop: number): number {
  return insetTop + PAUSE_INSET + PAUSE_VISUAL / 2 + PAUSE_HIT / 2;
}

/** Pure: highest the super top edge may sit (just under the pause hit rect, below every HUD top band). */
export function stackTopMin(insetTop: number): number {
  return pauseBottom(insetTop) + STACK_TOP_GAP;
}
