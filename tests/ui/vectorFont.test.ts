// Pixel headline font: glyph coverage on the 5 x 7 grid, whole px cells at every call site size,
// the neon stylesheet and shadow, the accessible text every headline keeps, and the plain HUD score.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bus } from '../../src/core/events';
import { UI_CSS } from '../../src/ui/dom';
import type { Insets } from '../../src/input/types';
import { createBootScreen } from '../../src/ui/boot';
import { createDetails, DETAILS_LABEL, detailsDrawn } from '../../src/ui/details';
import type { LevelResult } from '../../src/ui/flow';
import { createFreePlayScreen, FREE_PLAY_TITLE } from '../../src/ui/freePlay';
import { createHud, HUD_SCORE_SAMPLE, hudScoreFits, hudScorePx } from '../../src/ui/hud';
import { hudFrame } from '../../src/ui/hudFrame';
import { createIntroScreen, introCard, READY_TEXT, START_LABEL } from '../../src/ui/intro';
import { createMenuScreen, GAME_TITLE, TITLE_EMS } from '../../src/ui/menu';
import { PAR_REACHED } from '../../src/ui/parReward';
import { createResultsScreen, headlineTone } from '../../src/ui/results';
import { createSplashScreen } from '../../src/ui/splash';
import {
  CELL_EM,
  cellPx,
  FALLBACK_GLYPH,
  GLYPHS,
  GRID_H,
  GRID_W,
  glyphAdvance,
  glyphAt,
  glyphFor,
  glyphRuns,
  layoutPixels,
  PIXEL_SITES,
  pixelBox,
  pixelWidthPx,
  runsPath,
  shadowColour,
  SUPPORTED_CHARS,
  toneColour,
  VECTOR_TONES,
  vectorFontCss,
  type VectorTone,
} from '../../src/ui/vectorFont';
import { asParent, installFakeDocument, type FakeEl } from './fakeDom';

afterEach(() => {
  vi.unstubAllGlobals();
});

const REQUIRED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:!?-+/%#x ';
const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Parse hsla(h, s%, l%, a) into numbers. */
function hslaOf(css: string): [number, number, number, number] {
  const m = /hsla\(([\d.]+), ([\d.]+)%, ([\d.]+)%, ([\d.]+)\)/.exec(css);
  return [Number(m?.[1]), Number(m?.[2]), Number(m?.[3]), Number(m?.[4])];
}

describe('glyph table on the 5 x 7 grid', () => {
  it('covers A to Z, 0 to 9, the punctuation set, x and space', () => {
    for (const ch of REQUIRED) expect(SUPPORTED_CHARS.includes(ch), JSON.stringify(ch)).toBe(true);
    expect(SUPPORTED_CHARS.length).toBe(REQUIRED.length);
  });

  it('every glyph is 7 rows of cells, at most 5 wide, rows all the same width', () => {
    for (const glyph of [...Object.values(GLYPHS), FALLBACK_GLYPH]) {
      expect(glyph.rows.length).toBe(GRID_H);
      expect(glyph.w).toBeGreaterThan(0);
      expect(glyph.w).toBeLessThanOrEqual(GRID_W);
      for (const row of glyph.rows) {
        expect(row.length).toBe(glyph.w);
        expect(row).toMatch(/^[#.]+$/);
      }
    }
  });

  it('every glyph but space lights at least one cell, and space lights none', () => {
    for (const ch of SUPPORTED_CHARS) {
      const runs = glyphRuns(glyphFor(ch));
      if (ch === ' ') expect(runs).toEqual([]);
      else expect(runs.length, ch).toBeGreaterThan(0);
      expect(glyphAdvance(ch), ch).toBeGreaterThan(0);
    }
  });

  it('letters and digits are full height: they touch the cap line and the baseline', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      const rows = glyphFor(ch).rows;
      expect(rows[0]?.includes('#'), ch).toBe(true);
      expect(rows[GRID_H - 1]?.includes('#'), ch).toBe(true);
    }
  });

  it('no two glyphs share a bitmap', () => {
    const seen = new Map<string, string>();
    for (const ch of SUPPORTED_CHARS) {
      const key = glyphFor(ch).rows.join('/');
      expect(seen.get(key), `${ch} repeats ${seen.get(key) ?? ''}`).toBeUndefined();
      seen.set(key, ch);
    }
  });

  it('digits share one width so scores do not jitter', () => {
    for (const ch of '0123456789') expect(glyphFor(ch).w).toBe(GRID_W);
  });

  it('lower case draws as capitals, but a lone x is the small multiply sign', () => {
    expect(glyphFor('a')).toBe(GLYPHS.A);
    expect(glyphFor('z')).toBe(GLYPHS.Z);
    expect(glyphFor('x')).not.toBe(GLYPHS.X);
    expect(glyphAt([...'Next'], 2)).toBe(GLYPHS.X);
    expect(glyphAt([...'xenon'], 0)).toBe(GLYPHS.X);
    expect(glyphAt([...'x3'], 0)).toBe(GLYPHS.x);
    expect(glyphAt([...'3 x 4'], 2)).toBe(GLYPHS.x);
    expect(layoutPixels('Next').runs).toEqual(layoutPixels('NEXT').runs);
  });

  it('unknown characters fall back to a hollow box', () => {
    for (const ch of ['~', '@', 'é']) expect(glyphFor(ch)).toBe(FALLBACK_GLYPH);
    expect(layoutPixels('~').runs).toEqual(glyphRuns(FALLBACK_GLYPH));
  });
});

describe('layoutPixels and the path', () => {
  it('runs merge neighbouring cells and the path is integer rectangles', () => {
    expect(glyphRuns(GLYPHS.T ?? FALLBACK_GLYPH)[0]).toEqual([0, 0, 5]);
    expect(runsPath([[2, 3, 4]])).toBe('M2 3h4v1h-4z');
    const d = pixelBox('Shape Legend 1,234!').d;
    expect(d).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
  });

  it('the second glyph starts one gap after the first', () => {
    const L = layoutPixels('LL');
    expect(L.width).toBe(11);
    expect(L.runs.filter(([x]) => x === 6).length).toBeGreaterThan(0);
  });

  it('width grows with every added character', () => {
    const text = 'SHAPES OF WAR 1,234! x3 50% #?~';
    let last = -1;
    for (let n = 1; n <= text.length; n += 1) {
      const w = layoutPixels(text.slice(0, n)).width;
      expect(w).toBeGreaterThan(last);
      last = w;
    }
  });

  it('the box adds one shadow cell right and down', () => {
    const b = pixelBox('A');
    expect(b).toMatchObject({ wCells: 6, hCells: 8, viewBox: '0 0 6 8' });
    expect(layoutPixels('')).toEqual({ runs: [], width: 0 });
  });
});

describe('whole px cells at every call site size', () => {
  it('cellPx is an integer of at least 1 for any input', () => {
    for (const v of [0, -4, Number.NaN, Number.POSITIVE_INFINITY, 0.3, 7, 15.5]) {
      expect(Number.isInteger(cellPx(v)), String(v)).toBe(true);
      expect(cellPx(v)).toBeGreaterThanOrEqual(1);
    }
  });

  it('every call site size draws integer cells at least 2 px with capitals near 0.7 em', () => {
    for (const [name, r] of Object.entries(PIXEL_SITES)) {
      for (let px = r.min; px <= r.max; px += 1) {
        const c = cellPx(px);
        expect(Number.isInteger(c), `${name} ${px}`).toBe(true);
        expect(c, `${name} ${px}`).toBeGreaterThanOrEqual(2);
        const cap = (c * GRID_H) / px;
        expect(cap, `${name} ${px}`).toBeGreaterThanOrEqual(0.55);
        expect(cap, `${name} ${px}`).toBeLessThanOrEqual(0.85);
        expect(Math.abs(c - px * CELL_EM), `${name} ${px}`).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('the menu title fits the width the menu layout plans for it at every title size', () => {
    for (let px = PIXEL_SITES.menuTitle.min; px <= PIXEL_SITES.menuTitle.max; px += 1) {
      expect(pixelWidthPx(GAME_TITLE, px), String(px)).toBeLessThanOrEqual(px * TITLE_EMS);
    }
  });

  it('the stylesheet sizes the SVG from the same rounding', () => {
    expect(UI_CSS).toContain('round(calc(1em / 10), 1px)');
    expect(UI_CSS).toContain('var(--sow-cw)');
  });
});

describe('neon stylesheet and shadow', () => {
  it('has rules per tone and a glow that grows with the neon glow alpha', () => {
    const lo = vectorFontCss(1, 0);
    const hi = vectorFontCss(1, 0.9);
    for (const t of ['cyan', 'white', 'yellow', 'green', 'red']) {
      expect(lo).toContain(`.sow-vec.sow-vec-${t} {`);
      expect(lo).toContain(`.sow-vec.sow-vec-${t} .sow-vec-fg`);
      expect(lo).toContain(`.sow-vec.sow-vec-${t} .sow-vec-sh`);
    }
    const blur = (css: string): number => Number(/drop-shadow\(0 0 ([\d.]+)px/.exec(css)?.[1]);
    expect(blur(hi)).toBeGreaterThan(blur(lo));
    expect(vectorFontCss(0, 0.5)).toContain('hsla(185, 0%');
  });

  it('the shadow is a darker shade of the same hue at low alpha, never black', () => {
    for (const t of Object.keys(VECTOR_TONES) as VectorTone[]) {
      const [fh, fs, fl] = hslaOf(toneColour(VECTOR_TONES[t].fill, 1));
      const [sh, ss, sl, sa] = hslaOf(shadowColour(t, 1));
      expect(sh, t).toBe(fh);
      expect(ss, t).toBe(fs);
      expect(sl, t).toBeLessThan(fl);
      expect(sl, t).toBeGreaterThanOrEqual(15);
      expect(sa, t).toBeGreaterThan(0);
      expect(sa, t).toBeLessThanOrEqual(0.6);
    }
  });
});

/** The element's spoken text: its aria-label, and the visually hidden span must agree with it. */
function spoken(e: FakeEl | undefined): string | null {
  if (e === undefined) return null;
  const label = e.getAttribute('aria-label');
  const sr = e.children.find((c) => c.classList.contains('sow-sr'));
  const svg = e.children.find((c) => c.tag === 'svg');
  if (sr === undefined || svg === undefined || svg.getAttribute('aria-hidden') !== 'true') return null;
  return sr.textContent === label ? label : null;
}

const vectorHosts = (root: FakeEl): FakeEl[] => root.all().filter((e) => e.classList.contains('sow-vec-host'));

describe('headlines expose their text', () => {
  const result: LevelResult = { mode: 'adventure', levelIndex: 12, score: 1234567, stars: 3, success: true, par: 1000, best: 1234567, newBest: true, hash: 'abcd' };

  it('splash, boot and menu titles', () => {
    const root = installFakeDocument();
    createSplashScreen(asParent(root), () => undefined, { after: () => undefined });
    createBootScreen(asParent(root), () => undefined);
    createMenuScreen(asParent(root), { adventure: vi.fn(), levels: vi.fn(), endless: vi.fn(), freePlay: vi.fn(), settings: vi.fn(), howTo: vi.fn() });
    const titles = vectorHosts(root).filter((e) => e.classList.contains('sow-title'));
    expect(titles.map(spoken)).toEqual([GAME_TITLE, GAME_TITLE, GAME_TITLE]);
    expect(titles.every((t) => t.textContent === GAME_TITLE)).toBe(true);
  });

  it('intro title, Ready and Start', () => {
    const root = installFakeDocument();
    const intro = createIntroScreen(asParent(root), () => undefined);
    const def = { objective: { kind: 'destroy', count: 5 } as const, par: 100, stars: [100, 200, 300] as [number, number, number], drone: 'attack' as const, superType: 'turbo' as const };
    intro.showCard(introCard(12, def, 'normal'));
    const head = root.all().find((e) => e.getAttribute('data-intro') === 'title');
    expect(spoken(head)).toBe('Level 12');
    expect(spoken(root.all().find((e) => e.getAttribute('data-intro') === 'start'))).toBe(START_LABEL);
    intro.showReady();
    expect(spoken(head)).toBe(READY_TEXT);
  });

  it('results: headline, big score, Next, Menu, Details and Par reached', () => {
    const root = installFakeDocument();
    const screen = createResultsScreen(asParent(root), { next: vi.fn(), retry: vi.fn(), menu: vi.fn() });
    screen.showResult(result);
    const by = (k: string): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-results') === k);
    expect(spoken(by('title'))).toBe('Victory');
    expect(by('title')?.children.find((c) => c.tag === 'svg')?.getAttribute('class')).toContain('sow-vec-green');
    expect(spoken(by('score'))).toBe('1,234,567');
    expect(spoken(by('primary'))).toBe('Next');
    const spokenAll = vectorHosts(root).map(spoken);
    expect(spokenAll).toEqual(expect.arrayContaining(['Menu', DETAILS_LABEL, PAR_REACHED]));
    screen.showResult({ ...result, success: false, stars: 0 });
    expect(spoken(by('title'))).toBe('Defeated');
    expect(spoken(by('primary'))).toBe('Retry');
  });

  it('the Details toggle draws its + or - suffix but speaks only its label', () => {
    installFakeDocument();
    const d = createDetails('data-x');
    const toggle = (d.root as unknown as FakeEl).children[0];
    const drawn = (): string | null | undefined => toggle?.children.find((c) => c.tag === 'svg')?.getAttribute('data-vec');
    expect(drawn()).toBe(detailsDrawn(false));
    expect(detailsDrawn(false)).toBe('Details +');
    d.setOpen(true);
    expect(drawn()).toBe('Details -');
    expect(spoken(toggle)).toBe(DETAILS_LABEL);
  });

  it('Free Play title and Start', () => {
    const root = installFakeDocument();
    createFreePlayScreen(asParent(root), { start: vi.fn(), back: vi.fn() });
    expect(vectorHosts(root).map(spoken)).toContain(FREE_PLAY_TITLE);
    // Start keeps its richer label ("Start: Normal, Circle, ..."); the hidden span still reads Start.
    const start = vectorHosts(root).find((e) => e.tag === 'button');
    expect(start?.getAttribute('aria-label')?.startsWith('Start: ')).toBe(true);
    expect(start?.children.find((c) => c.classList.contains('sow-sr'))?.textContent).toBe('Start');
    expect(start?.textContent).toBe('Start');
  });

  it('headline tone: green win and red loss in Adventure, cyan elsewhere', () => {
    expect(headlineTone({ mode: 'adventure', success: true })).toBe('green');
    expect(headlineTone({ mode: 'adventure', success: false })).toBe('red');
    expect(headlineTone({ mode: 'endless', success: false })).toBe('cyan');
  });
});

describe('HUD score', () => {
  it('uses the plain font: text in the element, no pixel SVG', () => {
    const root = installFakeDocument();
    const hud = createHud(asParent(root), () => 0);
    hud.listen(new Bus());
    hud.update({ score: 98765, multiplier: 3, lives: 3, bombs: 2, superCharge: 0 });
    const host = root.all().find((e) => e.textContent === '98,765' && e.classList.contains('sow-hud-score'));
    expect(host).toBeDefined();
    expect(host?.children.length).toBe(0);
    expect(host?.classList.contains('sow-vec-host')).toBe(false);
    expect(root.all().some((e) => e.tag === 'svg' && e.getAttribute('data-vec') === '98,765')).toBe(false);
  });

  it('is larger and bolder with tabular digits, and fits on the cover and main screens', () => {
    const root = installFakeDocument();
    const hud = createHud(asParent(root), () => 0);
    const cover = hudFrame(960, 411, ZERO, 1800, 1000);
    const main = hudFrame(832, 750, ZERO, 1800, 1000);
    expect(cover.cls).toBe('cover');
    expect(main.cls).toBe('main');
    for (const f of [cover, main]) {
      const b = f.boxes.score;
      expect(hudScorePx(b)).toBeGreaterThan(b.size);
      expect(hudScorePx(b)).toBeLessThanOrEqual(b.h);
      expect(Number.isInteger(hudScorePx(b))).toBe(true);
      expect(hudScoreFits(b, HUD_SCORE_SAMPLE), f.cls).toBe(true);
      hud.layout(f, true);
      const el = root.all().find((e) => e.classList.contains('sow-hud-score'));
      expect(el?.style.fontSize).toBe(`${hudScorePx(b)}px`);
      expect(el?.style.fontWeight).toBe('800');
      expect(el?.style.fontVariantNumeric).toBe('tabular-nums');
    }
    expect(hudScorePx(cover.boxes.score)).toBeGreaterThanOrEqual(22);
    expect(hudScorePx(main.boxes.score)).toBeGreaterThanOrEqual(30);
  });
});
