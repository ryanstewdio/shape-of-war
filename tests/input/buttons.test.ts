import { describe, expect, it } from 'vitest';
import { hitButton, layoutButtons, rectCentre, ZERO_INSETS } from '../../src/input/buttons';
import { createInputState, createModel, pointerDown, pointerUp, pollModel } from '../../src/input/model';
import type { Insets } from '../../src/input/types';

// Representative CSS viewports; real Fold 7 values are measured at G0.
const COVER = { w: 960, h: 412 }; // about 21:9
const MAIN = { w: 840, h: 756 }; // about 10:9
const INSETS: Insets = { top: 10, right: 48, bottom: 20, left: 32 };

describe('layoutButtons', () => {
  // thumbs-buttons: super on top, bomb under it, 64 px hit circles 12 px apart, centre 44 px in from
  // the safe right edge, the bomb bottom edge 144 px (stick radius plus 24) above the aim rest zone.
  it('21:9 without insets: the stack rises to just under pause', () => {
    const r = layoutButtons(COVER.w, COVER.h, ZERO_INSETS);
    // Zone top 348 (trimmed: pause bottom 60 + 4 + 140 stack + 144 clearance), super top 64.
    expect(r.super).toEqual({ x: 884, y: 64, w: 64, h: 64 });
    expect(r.bomb).toEqual({ x: 884, y: 140, w: 64, h: 64 });
    expect(r.pause).toEqual({ x: 900, y: 4, w: 56, h: 56 });
  });

  it('21:9 with insets', () => {
    const r = layoutButtons(COVER.w, COVER.h, INSETS);
    // Centre x 44 in from the safe right edge: 960 - 48 - 44 = 868. Top inset 10 moves it all down 10.
    expect(r.super).toEqual({ x: 836, y: 74, w: 64, h: 64 });
    expect(r.bomb).toEqual({ x: 836, y: 150, w: 64, h: 64 });
    expect(r.pause).toEqual({ x: 852, y: 14, w: 56, h: 56 });
  });

  it('10:9 without insets: the stack sits as low as the ring clearance allows', () => {
    const r = layoutButtons(MAIN.w, MAIN.h, ZERO_INSETS);
    // Zone 688 to 752, bomb bottom 688 - 144 = 544.
    expect(r.super).toEqual({ x: 764, y: 404, w: 64, h: 64 });
    expect(r.bomb).toEqual({ x: 764, y: 480, w: 64, h: 64 });
    expect(r.pause).toEqual({ x: 780, y: 4, w: 56, h: 56 });
  });

  it('10:9 with insets', () => {
    const r = layoutButtons(MAIN.w, MAIN.h, INSETS);
    expect(r.super).toEqual({ x: 716, y: 384, w: 64, h: 64 });
    expect(r.bomb).toEqual({ x: 716, y: 460, w: 64, h: 64 });
    expect(r.pause).toEqual({ x: 732, y: 14, w: 56, h: 56 });
  });

  it('keeps every hit rect on screen and inside insets at the top and bottom', () => {
    for (const vp of [COVER, MAIN]) {
      for (const ins of [ZERO_INSETS, INSETS]) {
        const r = layoutButtons(vp.w, vp.h, ins);
        for (const rect of [r.bomb, r.super, r.pause]) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.w).toBeLessThanOrEqual(vp.w);
          expect(rect.y + rect.h).toBeLessThanOrEqual(vp.h);
        }
        expect(r.bomb.y + r.bomb.h).toBeLessThanOrEqual(vp.h - ins.bottom);
        expect(r.pause.y).toBeGreaterThanOrEqual(ins.top);
        expect(r.pause.x + r.pause.w).toBeLessThanOrEqual(vp.w - ins.right);
        expect(rectCentre(r.super).x).toBe(rectCentre(r.bomb).x);
        expect(rectCentre(r.super).y).toBeLessThan(rectCentre(r.bomb).y);
      }
    }
  });
});

describe('hitButton', () => {
  const r = layoutButtons(COVER.w, COVER.h, ZERO_INSETS);

  it('hits each button at its centre', () => {
    const c = (k: 'bomb' | 'super' | 'pause'): [number, number] => {
      const p = rectCentre(r[k]);
      return [p.x, p.y];
    };
    expect(hitButton(r, ...c('bomb'))).toBe('bomb');
    expect(hitButton(r, ...c('super'))).toBe('super');
    expect(hitButton(r, ...c('pause'))).toBe('pause');
  });

  it('counts the whole hit rect for bomb and super, corners included (G2.1)', () => {
    expect(hitButton(r, r.bomb.x + 1, r.bomb.y + r.bomb.h - 1)).toBe('bomb');
    expect(hitButton(r, r.super.x + 1, r.super.y + 1)).toBe('super');
    expect(hitButton(r, r.bomb.x - 1, r.bomb.y + r.bomb.h - 1)).toBeNull();
  });

  it('leaves a 12 px dead gap between super and bomb', () => {
    const b = rectCentre(r.bomb);
    expect(r.bomb.y - (r.super.y + r.super.h)).toBe(12);
    expect(hitButton(r, b.x, r.super.y + r.super.h - 1)).toBe('super');
    expect(hitButton(r, b.x, r.super.y + r.super.h + 6)).toBeNull();
    expect(hitButton(r, b.x, r.bomb.y + 1)).toBe('bomb');
  });

  it('misses open arena', () => {
    expect(hitButton(r, 200, 200)).toBeNull();
  });
});

describe('edge trigger', () => {
  it('fires once per press', () => {
    const m = createModel(COVER.w, COVER.h);
    const out = createInputState();
    const b = rectCentre(m.buttons.bomb);
    pointerDown(m, 7, b.x, b.y);
    expect(pollModel(m, out).bomb).toBe(true);
    expect(pollModel(m, out).bomb).toBe(false);
    expect(pollModel(m, out).bomb).toBe(false); // still held
    pointerUp(m, 7);
    expect(pollModel(m, out).bomb).toBe(false);
    pointerDown(m, 8, b.x, b.y);
    expect(pollModel(m, out).bomb).toBe(true);
    expect(pollModel(m, out).bomb).toBe(false);
  });

  it('a second finger on a held button does not fire again', () => {
    const m = createModel(COVER.w, COVER.h);
    const out = createInputState();
    const s = rectCentre(m.buttons.super);
    pointerDown(m, 1, s.x, s.y);
    expect(pollModel(m, out).superPressed).toBe(true);
    pointerDown(m, 2, s.x, s.y);
    expect(pollModel(m, out).superPressed).toBe(false);
    pointerUp(m, 2); // not the owner, button stays held
    expect(m.latch.super.id).toBe(1);
  });

  it('a press between polls is not lost even if released before the poll', () => {
    const m = createModel(COVER.w, COVER.h);
    const out = createInputState();
    const p = rectCentre(m.buttons.pause);
    pointerDown(m, 3, p.x, p.y);
    pointerUp(m, 3);
    expect(pollModel(m, out).pause).toBe(true);
    expect(pollModel(m, out).pause).toBe(false);
  });

  it('a button press never creates a stick', () => {
    const m = createModel(COVER.w, COVER.h);
    const b = rectCentre(m.buttons.bomb);
    expect(pointerDown(m, 1, b.x, b.y)).toBe('bomb');
    expect(m.move.active || m.aim.active).toBe(false);
  });

  it('pause works inside the right edge guard strip', () => {
    const m = createModel(COVER.w, COVER.h);
    expect(pointerDown(m, 1, COVER.w - 10, 30)).toBe('pause');
  });

  it('buttons coexist with held sticks', () => {
    const m = createModel(COVER.w, COVER.h);
    const out = createInputState();
    pointerDown(m, 1, 200, 200);
    pointerDown(m, 2, 700, 200);
    const b = rectCentre(m.buttons.bomb);
    pointerDown(m, 3, b.x, b.y);
    const s = pollModel(m, out);
    expect(s.bomb).toBe(true);
    expect(s.move.active && s.aim.active).toBe(true);
  });
});
