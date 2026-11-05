// Button sizes and stack spacing, CSS px (thumbs-buttons). Shared by buttons.ts and reach.ts, so
// neither imports the other.
import { STICK_RADIUS } from './stick';

/**
 * Bomb and super: one size for both (thumbs-button-look, Ryan found the 60 and 52 px rings uneven).
 * Hit circles at the 64 px floor, so the stack fits the 411 px cover screen; the drawn disc is 4 px
 * inside the hit circle all round, which leaves room for the label between the two buttons.
 */
export const BUTTON_VISUAL = 56;
export const BUTTON_HIT = 64;
export const BOMB_VISUAL = BUTTON_VISUAL;
export const BOMB_HIT = BUTTON_HIT;
export const SUPER_VISUAL = BUTTON_VISUAL;
export const SUPER_HIT = BUTTON_HIT;
/** Gap between the super and bomb hit circles. */
export const SUPER_GAP = 12;
export const PAUSE_VISUAL = 40;
export const PAUSE_HIT = 56;
export const PAUSE_INSET = 12;
/** Gap between the pause hit rect and the top of the super label at the highest stack. */
export const STACK_TOP_GAP = 0;
/**
 * Pixel font label over each button (2 px cells, 7 rows plus the 1 cell shadow): its bottom edge
 * sits on the top of the drawn disc, so it rises LABEL_RISE above the hit circle top. The bomb
 * label fills the gap between the super hit circle and the bomb disc exactly.
 */
export const LABEL_H = 16;
export const LABEL_RISE = LABEL_H - (BUTTON_HIT - BUTTON_VISUAL) / 2;
/**
 * Bomb and super stack centre, CSS px left of the right edge of the button area: half the widest
 * cover label (96 px, "DETONATE") plus 2, so that label stays inside the safe area.
 */
export const STACK_RIGHT = 50;
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

/** Pure: highest the super top edge may sit (its label just under the pause hit rect, below every HUD top band). */
export function stackTopMin(insetTop: number): number {
  return pauseBottom(insetTop) + STACK_TOP_GAP + LABEL_RISE;
}
