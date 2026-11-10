// hud-clock: the level clock left the objective bar for its own framed pixel clock, with warnings
// at 1:00, 0:30 and every second from 0:10, and one 'ui:timeWarn' per warning second.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Insets } from '../../src/input/types';
import type { ObjectiveDef } from '../../src/levelgen/leveldef';
import { CLOCK_FONT, clockFramePx, clockStyle, CLOCK_PULSE_SCALE, createHud } from '../../src/ui/hud';
import { COVER_LEFT, hudFrame, MAIN_ROWS, overlaps, type HudFrame } from '../../src/ui/hudFrame';
import {
  CLOCK_HIDDEN,
  CLOCK_PULSE_MS,
  clockTier,
  clockView,
  isWarnSecond,
  objectiveProgress,
  tierTone,
  WARN_START,
  warnStep,
  type WarnState,
} from '../../src/ui/objective';
import { cellPx, toneColour } from '../../src/ui/vectorFont';
import { asParent, installFakeDocument, type FakeEl } from './fakeDom';

const sit: ObjectiveDef = { kind: 'scoreInTime', target: 5000, timeLimitSec: 150 };
const surv: ObjectiveDef = { kind: 'survive', durationSec: 75 };
const destroy: ObjectiveDef = { kind: 'destroy', count: 40 };

describe('clock text per objective kind', () => {
  it('scoreInTime and survive count down, rounded up to whole seconds', () => {
    expect(clockView(sit, 0, false)).toMatchObject({ mode: 'countdown', text: '2:30', shownLeft: 150, size: 'normal' });
    expect(clockView(sit, 19.2, false)).toMatchObject({ text: '2:11', shownLeft: 131 });
    expect(clockView(surv, 15, false)).toMatchObject({ mode: 'countdown', text: '1:00', shownLeft: 60 });
    expect(clockView(surv, 200, false)).toMatchObject({ text: '0:00', shownLeft: 0 });
  });

  it('destroy shows time played, smaller and calm', () => {
    expect(clockView(destroy, 0, false)).toMatchObject({ mode: 'elapsed', text: '0:00', size: 'small', tone: 'white', shownLeft: null });
    expect(clockView(destroy, 61.9, false)).toMatchObject({ text: '1:01', size: 'small' });
  });

  it('a boss level shows time played whatever its objective kind', () => {
    for (const obj of [sit, surv, destroy]) {
      expect(clockView(obj, 140, true)).toMatchObject({ mode: 'elapsed', text: '2:20', size: 'small', shownLeft: null });
    }
  });

  it('the hidden clock is hidden', () => {
    expect(CLOCK_HIDDEN.mode).toBe('hidden');
  });
});

describe('warning thresholds and colours', () => {
  it('cyan above a minute, yellow from 1:00, orange from 0:30, red and larger from 0:10', () => {
    const at = (left: number) => clockView(surv, 75 - left, false);
    expect(at(61)).toMatchObject({ tier: 'calm', tone: 'cyan', size: 'normal' });
    expect(at(60)).toMatchObject({ tier: 'minute', tone: 'yellow', size: 'normal' });
    expect(at(59.5)).toMatchObject({ tier: 'minute', tone: 'yellow' });
    expect(at(31)).toMatchObject({ tier: 'minute', tone: 'yellow' });
    expect(at(30)).toMatchObject({ tier: 'half', tone: 'orange', size: 'normal' });
    expect(at(11)).toMatchObject({ tier: 'half', tone: 'orange' });
    expect(at(10)).toMatchObject({ tier: 'final', tone: 'red', size: 'large' });
    expect(at(0.2)).toMatchObject({ tier: 'final', tone: 'red', size: 'large', text: '0:01' });
    expect(at(0)).toMatchObject({ tier: 'final', tone: 'red', text: '0:00' });
  });

  it('tiers map to palette tones', () => {
    expect([61, 60, 30, 10].map(clockTier).map(tierTone)).toEqual(['cyan', 'yellow', 'orange', 'red']);
  });

  it('frame colours come from the palette at the neon saturation, and a pulse glows harder', () => {
    const neon = { saturation: 0.8, glowAlpha: 0.5 };
    const v = clockView(surv, 70, false);
    const st = clockStyle(v, neon);
    expect(st.border).toContain(toneColour('red', 0.8, 0.95));
    expect(st.boxShadow).toContain(toneColour('red', 0.8, 0.8));
    expect(st.fontPx).toBe(CLOCK_FONT.large);
    const blur = (s: string): number => Number(/0 0 ([\d.]+)px/.exec(s)?.[1]);
    expect(blur(clockStyle(v, neon, true).boxShadow)).toBeGreaterThan(blur(st.boxShadow));
  });

  it('digit sizes draw whole px cells: 2, 3 and 4 px', () => {
    expect([CLOCK_FONT.small, CLOCK_FONT.normal, CLOCK_FONT.large].map(cellPx)).toEqual([2, 3, 4]);
  });

  it('warning seconds are 60, 30 and 10 down to 1', () => {
    const all = Array.from({ length: 200 }, (_, i) => i).filter(isWarnSecond);
    expect(all).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 30, 60]);
  });
});

/** Run warnStep over a list of objective clock readings, as emitHud does, and collect the warnings. */
function run(obj: ObjectiveDef, elapsed: readonly number[], bossLevel = false): number[] {
  let st: WarnState = { ...WARN_START };
  const out: number[] = [];
  for (const e of elapsed) {
    const r = warnStep(st, clockView(obj, e, bossLevel).shownLeft);
    st = r.state;
    if (r.warn !== null) out.push(r.warn);
  }
  return out;
}

/** Readings every 100 ms from a to b. */
function ticks(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = Math.round(a * 10); i <= Math.round(b * 10); i++) out.push(i / 10);
  return out;
}

const EXPECTED = [60, 30, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

describe("'ui:timeWarn' emits once per threshold", () => {
  it('a straight run warns at 60, 30 and 10 down to 1, in order, once each', () => {
    expect(run(surv, ticks(0, 80))).toEqual(EXPECTED);
  });

  it('pause and resume: paused readings repeat the same clock and warn for nothing', () => {
    const paused = (at: number): number[] => Array.from({ length: 50 }, () => at);
    // Pause right on a warning second (60 and 5 left), and mid second (25.4 left).
    const seq = [...ticks(0, 15), ...paused(15), ...ticks(15, 49.6), ...paused(49.6), ...ticks(49.6, 70), ...paused(70), ...ticks(70, 80)];
    expect(run(surv, seq)).toEqual(EXPECTED);
  });

  it('a long frame that skips warning seconds warns only for the lowest one crossed, never twice', () => {
    expect(run(surv, [0, 10, 70, 71, 80])).toEqual([5, 4, 1]);
    expect(run(surv, [0, 66.5, 67, 67.2])).toEqual([9, 8]);
  });

  it('a level that starts under a minute does not warn for 60', () => {
    const short: ObjectiveDef = { kind: 'survive', durationSec: 45 };
    expect(run(short, ticks(0, 50))).toEqual([30, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('a clock that goes back up never repeats a warning it already gave', () => {
    expect(run(surv, [0, 15, 14, 15, 16])).toEqual([60]);
  });

  it('time played (destroy, boss levels) never warns', () => {
    expect(run(destroy, ticks(0, 200))).toEqual([]);
    expect(run(surv, ticks(0, 80), true)).toEqual([]);
  });

  it('a scoreInTime level warns on its time limit too', () => {
    expect(run(sit, ticks(0, 151))).toEqual(EXPECTED);
  });
});

describe('the objective bar keeps goal progress only', () => {
  it('no clock in any bar label', () => {
    for (const [obj, e] of [[sit, 19], [surv, 15], [destroy, 30]] as const) {
      const label = objectiveProgress(obj, { elapsedSec: e, score: 1234, kills: 3, lives: 3 }).label;
      expect(label, label).not.toMatch(/\d:\d\d/);
    }
  });
});

const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const COVER_VIEWS: Array<[number, number]> = [[960, 411], [904, 388], [1176, 504], [840, 360], [780, 360]];
const MAIN_VIEWS: Array<[number, number]> = [[832, 750], [794, 716], [1092, 984], [884, 800]];
const INSETS: Insets[] = [ZERO, { top: 0, right: 0, bottom: 0, left: 32 }, { top: 24, right: 20, bottom: 16, left: 32 }];

function frames(views: Array<[number, number]>): HudFrame[] {
  const out: HudFrame[] = [];
  for (const [w, h] of views) for (const ins of INSETS) for (const strip of [true, false]) out.push(hudFrame(w, h, ins, 1600, 1000, { bossStrip: strip }));
  return out;
}

describe('clock box placement', () => {
  const all = [...frames(COVER_VIEWS), ...frames(MAIN_VIEWS)];
  const lab = (f: HudFrame): string => `${f.cssW}x${f.cssH} ${JSON.stringify(f.insets)}`;

  it('overlaps no other HUD box, no button, the play rect or the banner', () => {
    for (const f of all) {
      const c = f.boxes.clock;
      for (const [id, b] of Object.entries(f.boxes)) {
        if (id === 'clock' || b.w <= 0 || b.h <= 0) continue;
        expect(overlaps(c, b), `${lab(f)} clock vs ${id}`).toBe(false);
      }
      for (const k of ['bomb', 'super', 'pause'] as const) expect(overlaps(c, f.buttons[k]), `${lab(f)} vs ${k}`).toBe(false);
      expect(overlaps(c, f.playRect), lab(f)).toBe(false);
      expect(overlaps(c, f.banner), lab(f)).toBe(false);
    }
  });

  it('fits the largest drawn clock: 0:10 in big digits, 9:59 normal, 59:59 time played', () => {
    for (const f of all) {
      const c = f.boxes.clock;
      for (const [text, size] of [['0:10', 'large'], ['9:59', 'normal'], ['59:59', 'small']] as const) {
        const px = clockFramePx(text, size);
        expect(px.w, `${lab(f)} ${text}`).toBeLessThanOrEqual(c.w);
        expect(px.h, `${lab(f)} ${text}`).toBeLessThanOrEqual(c.h);
      }
    }
  });

  it('cover: above the objective bar in the left column, never beside the score', () => {
    for (const f of frames(COVER_VIEWS)) {
      const { clock, bar, score, mult, droneBar } = f.boxes;
      expect(clock.y + clock.h, lab(f)).toBeLessThanOrEqual(bar.y);
      expect(clock.y, lab(f)).toBeGreaterThanOrEqual(Math.max(score.y + score.h, mult.y + mult.h, droneBar.y + droneBar.h));
      expect(clock.x + clock.w, lab(f)).toBeLessThanOrEqual(f.insets.left + COVER_LEFT);
    }
  });

  it('main: beside the objective bar inside the top band, right of the score', () => {
    for (const f of frames(MAIN_VIEWS)) {
      const { clock, bar, score } = f.boxes;
      expect(clock.x + clock.w, lab(f)).toBeLessThanOrEqual(bar.x);
      expect(clock.x, lab(f)).toBeGreaterThanOrEqual(score.x + score.w);
      expect(clock.y + clock.h, lab(f)).toBeLessThanOrEqual(f.insets.top + MAIN_ROWS);
    }
  });

  it('does not move the arena: play rects are as before', () => {
    expect(hudFrame(960, 411, ZERO, 1600, 1000, { bossStrip: false }).playRect).toEqual({ x: 160, y: 0, w: 688, h: 411 });
    expect(hudFrame(832, 750, ZERO, 1800, 1000).playRect).toEqual({ x: 0, y: 60, w: 832 - 68, h: 690 });
  });
});

describe('clock DOM', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function build() {
    const root = installFakeDocument();
    const hud = createHud(asParent(root), () => 0);
    const find = (name: string): FakeEl => {
      const e = root.all().find((n) => n.getAttribute('data-hud') === name);
      if (e === undefined) throw new Error(`no element ${name}`);
      return e;
    };
    hud.layout(hudFrame(960, 411, ZERO, 1600, 1000), true);
    return { hud, host: find('clock'), frame: find('clock-frame'), digits: find('clock-digits') };
  }

  it('hidden until set, shows the text in the pixel font, hides again', () => {
    const { hud, host, digits } = build();
    expect(host.style.display).toBe('none');
    hud.setClock(clockView(surv, 0, false));
    expect(host.style.display).toBe('flex');
    expect(digits.getAttribute('aria-label')).toBe('1:15');
    expect(digits.style.fontSize).toBe(`${CLOCK_FONT.normal}px`);
    hud.setClock(clockView(surv, 70, false));
    expect(digits.getAttribute('aria-label')).toBe('0:05');
    expect(digits.style.fontSize).toBe(`${CLOCK_FONT.large}px`);
    hud.setClock(CLOCK_HIDDEN);
    expect(host.style.display).toBe('none');
  });

  it('a pulse scales the frame up, then settles within the pulse length', () => {
    vi.useFakeTimers();
    const { hud, frame } = build();
    hud.setClock(clockView(surv, 15, false), true);
    expect(frame.style.transform).toBe(`scale(${CLOCK_PULSE_SCALE})`);
    hud.setClock(clockView(surv, 15.1, false)); // a plain update mid pulse keeps the pulse
    expect(frame.style.transform).toBe(`scale(${CLOCK_PULSE_SCALE})`);
    vi.advanceTimersByTime(CLOCK_PULSE_MS);
    expect(frame.style.transform).toBe('scale(1)');
    expect(CLOCK_PULSE_MS).toBeLessThanOrEqual(1000); // at most one pulse a second, under the 3 a second cap
  });
});
