// Capture mode (?dev=1&capture=1): a clean screen for scripted clips. The knob rides the dev gate,
// hides only developer readouts and the stick knobs, and never changes the sim or input.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { StickVisuals } from '../../src/input/types';
import { CAPTURE_PARAM, devView, isCapture, stickCircles } from '../../src/ui/capture';
import { DEV_KNOBS, gateSearch } from '../../src/ui/devGate';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

const HELD: StickVisuals = {
  move: { ring: { x: 100, y: 300, r: 60 }, knob: { x: 120, y: 290, r: 30 } },
  aim: { ring: { x: 800, y: 300, r: 60 }, knob: { x: 780, y: 320, r: 30 } },
};

describe('isCapture', () => {
  it('is on only for capture=1 exactly', () => {
    expect(isCapture('?dev=1&capture=1')).toBe(true);
    expect(isCapture('?capture=1&dev=1&boss=3')).toBe(true);
    for (const q of ['?dev=1', '?dev=1&capture=0', '?dev=1&capture=true', '?dev=1&capture=', '?dev=1&capture=11', '?dev=1&capture']) {
      expect(isCapture(q), q).toBe(false);
    }
  });

  it('is off when the gated query is empty', () => {
    expect(isCapture('')).toBe(false);
  });

  it('rides the dev gate: capture=1 without dev=1 is stripped', () => {
    expect(DEV_KNOBS).toContain(CAPTURE_PARAM);
    expect(isCapture(gateSearch('?capture=1', undefined))).toBe(false);
    expect(isCapture(gateSearch('?dev=0&capture=1', undefined))).toBe(false);
    expect(isCapture(gateSearch('?dev=1&capture=1', undefined))).toBe(true);
    expect(isCapture(gateSearch('?capture=1', '1'))).toBe(true); // VITE_SOW_DEV build
  });
});

describe('stickCircles', () => {
  it('still produces the faint knobs when capture is off', () => {
    const c = stickCircles(HELD, false);
    expect(c).toEqual([
      { x: 120, y: 290, r: 18, alpha: 0.3, filled: true },
      { x: 780, y: 320, r: 18, alpha: 0.3, filled: true },
    ]);
  });

  it('skips a stick that is not held', () => {
    expect(stickCircles({ move: HELD.move, aim: null }, false)).toHaveLength(1);
    expect(stickCircles({ move: null, aim: null }, false)).toEqual([]);
  });

  it('draws nothing in capture mode and leaves the visuals untouched', () => {
    const before = JSON.stringify(HELD);
    expect(stickCircles(HELD, true)).toEqual([]);
    expect(JSON.stringify(HELD)).toBe(before);
  });
});

describe('devView', () => {
  it('readouts and the panel gesture need dev on and capture off', () => {
    expect(devView(true, false)).toEqual({ readouts: true, panel: true });
    expect(devView(true, true)).toEqual({ readouts: false, panel: false });
    expect(devView(false, false)).toEqual({ readouts: false, panel: false });
    expect(devView(false, true)).toEqual({ readouts: false, panel: false });
  });
});

describe('capture glue in main.ts', () => {
  const main = read('src/main.ts');

  it('reads capture from the gated query only', () => {
    expect(main).toContain('capture: isCapture(search)');
  });

  it('gates every dev readout and the panel on the capture aware view', () => {
    expect(main).toContain("buildLabel.style.display = view.readouts ? '' : 'none';");
    expect(main).toContain('hud.setDevCode(view.readouts);');
    expect(main).toMatch(/if \(view\.readouts\) \{\s*bus\.on\('game:start'/);
    expect(main).toMatch(/if \(view\.panel\) \{\s*const panel = installDevPanel/);
    expect(main).toContain('!gated.capture && (query.debug || failed)');
    expect(main).toContain('stickCircles(touch.stickVisuals(), gated.capture)');
  });

  it('touch input is attached the same way in every mode', () => {
    expect(main).toContain('attachTouch(renderer.app.canvas, { insets: readInsets })');
    expect(main).not.toMatch(/capture[^\n]*attachTouch|attachTouch[^\n]*capture/);
  });

  it('capture adds no storage key', () => {
    expect(read('src/ui/capture.ts')).not.toMatch(/localStorage|sessionStorage|sow\./);
  });
});
