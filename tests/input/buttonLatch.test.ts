import { describe, expect, it } from 'vitest';
import {
  createLatch,
  pressLatch,
  releaseLatch,
  takeLatch,
  stackTop,
  layoutButtons,
  ZERO_INSETS,
  type ButtonLatch,
} from '../../src/input/buttons';
import { STACK_CLEAR, STACK_H, stackTopMin } from '../../src/input/stack';
import { aimRestZone } from '../../src/input/reach';
import type { Insets } from '../../src/input/types';

const INSETS: Insets = { top: 10, right: 48, bottom: 20, left: 32 };

describe('button latch helpers', () => {
  it('creates a fresh, unowned latch for each call', () => {
    const first: ButtonLatch = createLatch();
    const second: ButtonLatch = createLatch();
    expect(first).toEqual({ id: -1, pending: false });
    expect(second).toEqual({ id: -1, pending: false });
    expect(first).not.toBe(second);
  });

  it('arms a fresh latch and swallows a second press while held', () => {
    const latch = createLatch();
    pressLatch(latch, 7);
    expect(latch).toEqual({ id: 7, pending: true });
    pressLatch(latch, 9);
    expect(latch).toEqual({ id: 7, pending: true });
  });

  it('takes each press exactly once without changing the owner', () => {
    const latch = createLatch();
    expect(takeLatch(latch)).toBe(false);
    expect(latch).toEqual({ id: -1, pending: false });
    pressLatch(latch, 7);
    expect(takeLatch(latch)).toBe(true);
    expect(latch).toEqual({ id: 7, pending: false });
    expect(takeLatch(latch)).toBe(false);
    expect(latch).toEqual({ id: 7, pending: false });
    expect(releaseLatch(latch, 7)).toBe(true);
    pressLatch(latch, 9);
    expect(takeLatch(latch)).toBe(true);
    expect(takeLatch(latch)).toBe(false);
    expect(latch).toEqual({ id: 9, pending: false });
  });

  it('does not rearm a held button for a second finger after taking', () => {
    const latch = createLatch();
    pressLatch(latch, 7);
    expect(takeLatch(latch)).toBe(true);
    pressLatch(latch, 9);
    expect(latch).toEqual({ id: 7, pending: false });
    expect(takeLatch(latch)).toBe(false);
  });

  it('releases only the owning pointer and leaves a fresh latch alone', () => {
    const latch = createLatch();
    expect(releaseLatch(latch, 5)).toBe(false);
    expect(latch).toEqual({ id: -1, pending: false });
    pressLatch(latch, 7);
    expect(releaseLatch(latch, 9)).toBe(false);
    expect(latch).toEqual({ id: 7, pending: true });
    expect(releaseLatch(latch, 7)).toBe(true);
    expect(latch).toEqual({ id: -1, pending: true });
  });

  it('preserves a press released before it is taken', () => {
    const latch = createLatch();
    pressLatch(latch, 3);
    expect(releaseLatch(latch, 3)).toBe(true);
    expect(latch).toEqual({ id: -1, pending: true });
    expect(takeLatch(latch)).toBe(true);
    expect(takeLatch(latch)).toBe(false);
    expect(latch).toEqual({ id: -1, pending: false });
  });

  it('treats pointer zero as an owner', () => {
    const latch = createLatch();
    pressLatch(latch, 0);
    expect(latch).toEqual({ id: 0, pending: true });
    pressLatch(latch, 4);
    expect(latch).toEqual({ id: 0, pending: true });
    expect(releaseLatch(latch, 4)).toBe(false);
    expect(latch).toEqual({ id: 0, pending: true });
    expect(releaseLatch(latch, 0)).toBe(true);
    expect(latch).toEqual({ id: -1, pending: true });
  });
});

describe('stackTop', () => {
  it.each([
    { cssW: 960, cssH: 412, insets: ZERO_INSETS, expected: 72 },
    { cssW: 960, cssH: 412, insets: INSETS, expected: 82 },
    { cssW: 840, cssH: 756, insets: ZERO_INSETS, expected: 404 },
    { cssW: 840, cssH: 756, insets: INSETS, expected: 384 },
  ])('pins $cssW x $cssH at $expected and agrees with clearance and layout', ({ cssW, cssH, insets, expected }) => {
    const top = stackTop(cssW, cssH, insets);
    expect(top).toBe(expected);
    expect(top).toBe(Math.max(
      stackTopMin(insets.top),
      aimRestZone(cssW, cssH, insets).y - STACK_CLEAR - STACK_H,
    ));
    expect(top).toBe(layoutButtons(cssW, cssH, insets).super.y);
  });

  it('holds the floor on short screens and accounts for the top inset', () => {
    expect(stackTopMin(0)).toBe(72);
    expect(stackTop(960, 200, ZERO_INSETS)).toBe(stackTopMin(0));
    expect(stackTop(960, 412, { top: 24, right: 0, bottom: 16, left: 0 })).toBe(96);
  });

  it('is independent of width and horizontal insets', () => {
    expect(stackTop(400, 756, ZERO_INSETS)).toBe(404);
    expect(stackTop(2000, 756, ZERO_INSETS)).toBe(404);
    expect(stackTop(840, 756, { top: 0, right: 60, bottom: 0, left: 90 })).toBe(404);
  });

  it('follows the screen bottom above the floor', () => {
    expect(stackTop(840, 757, ZERO_INSETS)).toBe(405);
    expect(stackTop(840, 756, { top: 0, right: 0, bottom: 20, left: 0 })).toBe(384);
  });
});
