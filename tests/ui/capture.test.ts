// Capture mode (?dev=1&capture=1): a clean screen for scripted clips. The knob rides the dev gate,
// hides only developer readouts and the stick knobs, and never changes the sim or input.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { StickVisuals } from '../../src/input/types';
import { CAPTURE_PARAM, devView, isCapture, stickCircles } from '../../src/ui/capture';
import { DEV_KNOBS, gateSearch } from '../../src/ui/devGate';
import type { LevelResult } from '../../src/ui/flow';
import { createResultsScreen, resultLines } from '../../src/ui/results';
import { captureShowFps, createSettingsModel, type SettingsEffects } from '../../src/ui/settings';
import { asParent, installFakeDocument, type FakeEl } from './fakeDom';

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

function fpsFx(capture: boolean, seen: boolean[]): SettingsEffects {
  return {
    setShowFps: captureShowFps((on) => seen.push(on), capture),
    setGlowPath: () => undefined,
    applyNeon: () => undefined,
    setVolume: () => undefined,
    setWeaponPickups: () => undefined,
    setEffectsTier: () => undefined,
    setTilt: () => undefined,
    setMusicVolume: () => undefined,
    requestFrame: () => undefined,
  };
}

function memory(init: Record<string, string> = {}): { data: Map<string, string>; getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const data = new Map(Object.entries(init));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('capture mode: fps readout', () => {
  it('captureShowFps passes through when capture is off', () => {
    const seen: boolean[] = [];
    const f = captureShowFps((on) => seen.push(on), false);
    f(true);
    f(false);
    expect(seen).toEqual([true, false]);
  });

  it('never shows the readout in capture mode and keeps the stored Show FPS on', () => {
    const seen: boolean[] = [];
    const store = memory();
    const first = createSettingsModel(fpsFx(false, []), store);
    first.setShowFps(true);
    const stored = new Map(store.data);
    const m = createSettingsModel(fpsFx(true, seen), store);
    expect(m.state.showFps).toBe(true);
    m.applyBoot();
    m.toggleShowFps();
    m.toggleShowFps();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((on) => !on)).toBe(true);
    expect(m.state.showFps).toBe(true);
    expect(store.data).toEqual(stored); // the toggle round trip leaves storage as it was
  });

  it('main.ts wraps Glow setShowFps with the capture flag', () => {
    expect(read('src/main.ts')).toContain('setShowFps: captureShowFps(setShowFps, gated.capture)');
  });
});

describe('capture mode: results fight line', () => {
  const r: LevelResult = { mode: 'adventure', levelIndex: 1, score: 10, success: true, par: 1000, best: 10, newBest: false, hash: 'H', stars: 1, fightLine: 'Warden 1:05' };
  const fight = (root: FakeEl): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-results') === 'fightLine');

  it('resultLines blanks the fight line only in capture mode', () => {
    expect(resultLines(r).fightLine).toBe('Warden 1:05');
    expect(resultLines(r, true).fightLine).toBe('');
  });

  it('the results screen hides the line in capture mode and shows it otherwise', () => {
    try {
      for (const capture of [false, true]) {
        const root = installFakeDocument();
        const s = createResultsScreen(asParent(root), { next: () => undefined, retry: () => undefined, menu: () => undefined }, { capture });
        s.showResult(r);
        const el = fight(root);
        expect(el?.textContent ?? '').toBe(capture ? '' : 'Warden 1:05');
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('main.ts passes the capture flag to the results screen', () => {
    expect(read('src/main.ts')).toContain('}, { capture: gated.capture });');
  });
});
