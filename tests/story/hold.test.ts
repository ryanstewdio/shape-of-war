// Resume bug (brief ledger-scene-revise): after the opening, level 1 showed the pause screen.
// Cause: while a scene held the sim the loop returned before polling the touch input, so a pause
// press latched during the scene (Skip sits where the pause button is) fired on the first live
// step. A second path: the call sign keyboard resized the viewport, flipped the aspect class and
// auto paused the run behind the scene.
import { describe, expect, it } from 'vitest';
import { layoutButtons } from '../../src/input/buttons';
import { createInputState, createModel, pointerDown, pollModel, pointerUp } from '../../src/input/model';
import { resizePauseAllowed, stepInput } from '../../src/story/hold';

function pressPause() {
  const m = createModel(900, 400, { top: 0, right: 0, bottom: 0, left: 0 });
  const r = layoutButtons(900, 400, { top: 0, right: 0, bottom: 0, left: 0 }).pause;
  const x = r.x + r.w / 2;
  const y = r.y + r.h / 2;
  return { m, x, y };
}

describe('story hold', () => {
  it('reproduces the bug: a pause press latched during a scene survives if the poll is skipped', () => {
    const { m, x, y } = pressPause();
    const out = createInputState();
    expect(pointerDown(m, 1, x, y)).toBe('pause');
    // Old loop: scene open, no poll. The scene ends and the first live poll reads the stale press.
    expect(pollModel(m, out).pause).toBe(true);
  });

  it('drops presses made while a scene is open, so play starts unpaused', () => {
    const { m, x, y } = pressPause();
    const out = createInputState();
    const idle = createInputState();
    pointerDown(m, 1, x, y);
    for (let i = 0; i < 3; i++) expect(stepInput(true, () => pollModel(m, out), idle).pause).toBe(false);
    pointerUp(m, 1);
    expect(stepInput(false, () => pollModel(m, out), idle).pause).toBe(false);
  });

  it('passes the live input through when no scene is open', () => {
    const { m, x, y } = pressPause();
    const out = createInputState();
    pointerDown(m, 1, x, y);
    expect(stepInput(false, () => pollModel(m, out), createInputState()).pause).toBe(true);
  });

  it('does not auto pause on a resize while a scene is open', () => {
    expect(resizePauseAllowed(true)).toBe(false);
    expect(resizePauseAllowed(false)).toBe(true);
  });
});
