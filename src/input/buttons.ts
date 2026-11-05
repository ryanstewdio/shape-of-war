// Pure on screen button layout and hit testing (docs/04 section 10). CSS px throughout.
import { aimRestZone } from './reach';
import {
  BOMB_HIT,
  PAUSE_INSET,
  PAUSE_VISUAL,
  PAUSE_HIT,
  STACK_CLEAR,
  STACK_H,
  STACK_RIGHT,
  stackTopMin,
  SUPER_GAP,
  SUPER_HIT,
} from './stack';
import type { ButtonId, ButtonRects, Insets, Rect } from './types';

export {
  BOMB_HIT,
  BOMB_VISUAL,
  PAUSE_HIT,
  PAUSE_INSET,
  PAUSE_VISUAL,
  RING_GAP,
  STACK_CLEAR,
  STACK_H,
  STACK_RIGHT,
  STACK_TOP_GAP,
  SUPER_GAP,
  SUPER_HIT,
  SUPER_VISUAL,
} from './stack';

export const ZERO_INSETS: Readonly<Insets> = { top: 0, right: 0, bottom: 0, left: 0 };

function centred(cx: number, cy: number, size: number): Rect {
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
}

export function rectCentre(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * Pure: centre x of the bomb and super stack. The stack hugs the right edge, STACK_RIGHT in from
 * the right edge of the button area, but never pokes out of the area on either side (a narrow HUD
 * column clamps it so both hit circles stay inside the column).
 */
export function stackCentreX(cssW: number, insets: Insets): number {
  const right = cssW - insets.right;
  const half = Math.max(BOMB_HIT, SUPER_HIT) / 2;
  const lo = insets.left + half;
  const hi = right - half;
  return Math.max(lo, Math.min(hi, right - STACK_RIGHT));
}

/**
 * Pure: top edge of the super hit circle. The stack sits as low as it can while its bomb bottom
 * edge stays STACK_CLEAR above the aim rest zone (reach.ts), so the stretch from the zone is as
 * short as the ring clearance allows; it never rises above stackTopMin (just under pause).
 */
export function stackTop(cssW: number, cssH: number, insets: Insets): number {
  const zone = aimRestZone(cssW, cssH, insets);
  return Math.max(stackTopMin(insets.top), zone.y - STACK_CLEAR - STACK_H);
}

/**
 * Hit rects inside the button area (canvas minus `insets`): super on top and bomb under it in a
 * vertical stack on the right edge, high above the aim rest zone, and pause top right. The aim
 * rest zone uses only the right, top and bottom insets, which the HUD button insets share with the
 * real safe area, so the same zone holds for the bare and the HUD layouts.
 */
export function layoutButtons(cssW: number, cssH: number, insets: Insets): ButtonRects {
  const cx = stackCentreX(cssW, insets);
  const top = stackTop(cssW, cssH, insets);
  const superCy = top + SUPER_HIT / 2;
  const bombCy = top + SUPER_HIT + SUPER_GAP + BOMB_HIT / 2;
  const pauseCx = cssW - insets.right - PAUSE_INSET - PAUSE_VISUAL / 2;
  const pauseCy = insets.top + PAUSE_INSET + PAUSE_VISUAL / 2;
  return {
    bomb: centred(cx, bombCy, BOMB_HIT),
    super: centred(cx, superCy, SUPER_HIT),
    pause: centred(pauseCx, pauseCy, PAUSE_HIT),
  };
}

/** Distance to the centre if inside the hit rect, else Infinity. */
function rectDist(r: Rect, x: number, y: number): number {
  if (!inRect(r, x, y)) return Infinity;
  const c = rectCentre(r);
  return Math.hypot(x - c.x, y - c.y);
}

function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/**
 * Which button a point hits, or null. Any start inside a hit rect is that button, never a stick
 * (G2.1: the corners count too, so no stick can begin inside a button rect). The bomb and super
 * rects are 12 px apart now, but the nearer centre still wins if they ever touch.
 */
export function hitButton(rects: ButtonRects, x: number, y: number): ButtonId | null {
  if (inRect(rects.pause, x, y)) return 'pause';
  const db = rectDist(rects.bomb, x, y);
  const ds = rectDist(rects.super, x, y);
  if (db === Infinity && ds === Infinity) return null;
  return db <= ds ? 'bomb' : 'super';
}

/** Edge trigger state per button: owning pointer and a press waiting to be taken. */
export interface ButtonLatch {
  id: number;
  pending: boolean;
}

export function createLatch(): ButtonLatch {
  return { id: -1, pending: false };
}

/** Press latches once. A second finger on an already held button is swallowed. */
export function pressLatch(l: ButtonLatch, id: number): void {
  if (l.id !== -1) return;
  l.id = id;
  l.pending = true;
}

/** Returns true if this pointer owned the button. */
export function releaseLatch(l: ButtonLatch, id: number): boolean {
  if (l.id !== id) return false;
  l.id = -1;
  return true;
}

/** True exactly once per press. */
export function takeLatch(l: ButtonLatch): boolean {
  const p = l.pending;
  l.pending = false;
  return p;
}
