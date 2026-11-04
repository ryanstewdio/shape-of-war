// Vector headline font: glyph coverage, the fallback box, layout width, the neon stylesheet and
// the accessible text every vector headline keeps.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bus } from '../../src/core/events';
import type { Insets } from '../../src/input/types';
import { createBootScreen } from '../../src/ui/boot';
import { createDetails, DETAILS_LABEL, detailsDrawn } from '../../src/ui/details';
import type { LevelResult } from '../../src/ui/flow';
import { createFreePlayScreen, FREE_PLAY_TITLE } from '../../src/ui/freePlay';
import { createHud, HUD_SCORE_MIN_CAP, vectorScoreFits } from '../../src/ui/hud';
import { hudFrame } from '../../src/ui/hudFrame';
import { createIntroScreen, introCard, READY_TEXT, START_LABEL } from '../../src/ui/intro';
import { createMenuScreen, GAME_TITLE, TITLE_EMS } from '../../src/ui/menu';
import { PAR_REACHED } from '../../src/ui/parReward';
import { createResultsScreen, headlineTone } from '../../src/ui/results';
import { createSplashScreen } from '../../src/ui/splash';
import {
  FALLBACK_GLYPH,
  GLYPHS,
  glyphAdvance,
  glyphAt,
  glyphFor,
  layoutVector,
  placePath,
  SUPPORTED_CHARS,
  vectorBox,
  vectorFontCss,
} from '../../src/ui/vectorFont';
import { asParent, installFakeDocument, type FakeEl } from './fakeDom';

afterEach(() => {
  vi.unstubAllGlobals();
});

const REQUIRED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:!?-+/%#x ';
const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Every coordinate pair after M or L in a path. */
function points(d: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /[ML](-?[\d.]+) (-?[\d.]+)/g;
  for (let m = re.exec(d); m !== null; m = re.exec(d)) out.push([Number(m[1]), Number(m[2])]);
  return out;
}

describe('glyph table', () => {
  it('covers A to Z, 0 to 9, the punctuation set, x and space', () => {
    for (const ch of REQUIRED) expect(SUPPORTED_CHARS.includes(ch), JSON.stringify(ch)).toBe(true);
  });

  it('every supported glyph has a path (space aside) and a positive advance', () => {
    for (const ch of SUPPORTED_CHARS) {
      const g = glyphFor(ch);
      expect(g).toBe(GLYPHS[ch]);
      if (ch !== ' ') expect(g.d.length, ch).toBeGreaterThan(0);
      expect(g.w, ch).toBeGreaterThan(0);
      expect(glyphAdvance(ch), ch).toBeGreaterThan(0);
    }
  });

  it('every point stays on the 4 x 6 grid (the comma tail may dip one unit)', () => {
    for (const ch of SUPPORTED_CHARS) {
      const g = glyphFor(ch);
      for (const [x, y] of points(g.d)) {
        expect(x, ch).toBeGreaterThanOrEqual(0);
        expect(x, ch).toBeLessThanOrEqual(g.w);
        expect(y, ch).toBeGreaterThanOrEqual(0);
        expect(y, ch).toBeLessThanOrEqual(ch === ',' ? 7 : 6);
      }
    }
  });

  it('uses only straight segments and arcs', () => {
    for (const ch of SUPPORTED_CHARS) expect(GLYPHS[ch]?.d, ch).toMatch(/^[MLAZ\d. -]*$/);
    expect(Object.values(GLYPHS).some((g) => g.d.includes('A'))).toBe(true);
  });

  it('lower case draws as capitals, but a lone x is the small multiply sign', () => {
    expect(glyphFor('a')).toBe(GLYPHS.A);
    expect(glyphFor('z')).toBe(GLYPHS.Z);
    expect(glyphFor('x')).not.toBe(GLYPHS.X);
    expect(glyphAt([...'Next'], 2)).toBe(GLYPHS.X);
    expect(glyphAt([...'xenon'], 0)).toBe(GLYPHS.X);
    expect(glyphAt([...'x3'], 0)).toBe(GLYPHS.x);
    expect(glyphAt([...'3 x 4'], 2)).toBe(GLYPHS.x);
    expect(layoutVector('Next', 6).d).toBe(layoutVector('NEXT', 6).d);
  });

  it('unknown characters fall back to a box', () => {
    for (const ch of ['~', '★', '@', 'é', ' ']) expect(glyphFor(ch)).toBe(FALLBACK_GLYPH);
    expect(FALLBACK_GLYPH.d).toMatch(/Z$/);
    expect(layoutVector('~', 6).d).toBe(placePath(FALLBACK_GLYPH.d, 1, 0));
  });
});

describe('layoutVector', () => {
  it('scales the grid to the cap height and keeps one stroke width', () => {
    const L = layoutVector('L', 60);
    expect(L.height).toBe(60);
    expect(L.unit).toBe(10);
    expect(L.d).toBe('M0 0 L0 60 L40 60');
    expect(L.stroke).toBeCloseTo(6);
    expect(layoutVector('W', 12).stroke).toBeCloseTo(layoutVector('I', 12).stroke);
  });

  it('places the second glyph one gap plus the letter spacing after the first', () => {
    const L = layoutVector('LL', 6, 2);
    expect(L.d).toBe('M0 0 L0 6 L4 6 M7 0 L7 6 L11 6');
    expect(L.width).toBe(11);
  });

  it('scales arcs with the grid', () => {
    expect(placePath('M0 2 A2 2 0 0 1 4 2', 2, 10)).toBe('M10 4 A4 4 0 0 1 18 4');
  });

  it('width grows with every added character', () => {
    const text = 'SHAPES OF WAR 1,234! x3 50% #?~';
    for (const spacing of [0, 1.5, -4]) {
      let last = -1;
      for (let n = 1; n <= text.length; n += 1) {
        const w = layoutVector(text.slice(0, n), 24, spacing).width;
        expect(w).toBeGreaterThan(last);
        last = w;
      }
    }
  });

  it('empty text and bad sizes give an empty layout', () => {
    expect(layoutVector('', 20)).toMatchObject({ d: '', width: 0 });
    expect(layoutVector('A', Number.NaN).width).toBe(0);
  });

  it('the menu title fits the width the menu layout plans for it', () => {
    expect(vectorBox(GAME_TITLE).wEm).toBeLessThanOrEqual(TITLE_EMS);
  });
});

describe('neon stylesheet', () => {
  it('has a rule per tone and a glow that grows with the neon glow alpha', () => {
    const lo = vectorFontCss(1, 0);
    const hi = vectorFontCss(1, 0.9);
    for (const t of ['cyan', 'white', 'yellow', 'green', 'red']) expect(lo).toContain(`.sow-vec.sow-vec-${t}`);
    const blur = (css: string): number => Number(/drop-shadow\(0 0 ([\d.]+)px/.exec(css)?.[1]);
    expect(blur(hi)).toBeGreaterThan(blur(lo));
    expect(vectorFontCss(0, 0.5)).toContain('hsla(185, 0%');
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
    createMenuScreen(asParent(root), { adventure: vi.fn(), levels: vi.fn(), endless: vi.fn(), freePlay: vi.fn(), settings: vi.fn() });
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
  it('draws the score in the vector font and keeps it readable', () => {
    const root = installFakeDocument();
    const hud = createHud(asParent(root), () => 0);
    hud.listen(new Bus());
    hud.update({ score: 98765, multiplier: 3, lives: 3, bombs: 2, superCharge: 0 });
    const host = vectorHosts(root).find((e) => spoken(e) === '98,765');
    expect(host).toBeDefined();
    expect(host?.textContent).toBe('98,765');
  });

  it('is tall enough and wide enough on the cover and main screens', () => {
    const cover = hudFrame(960, 411, ZERO, 1800, 1000);
    const main = hudFrame(832, 750, ZERO, 1800, 1000);
    expect(cover.cls).toBe('cover');
    expect(main.cls).toBe('main');
    for (const f of [cover, main]) expect(vectorScoreFits(f.boxes.score)).toBe(true);
    expect(vectorScoreFits({ ...cover.boxes.score, size: HUD_SCORE_MIN_CAP })).toBe(false);
  });
});
