// Release polish (docs/14 items 1 to 4 and 6): the Shapes of War name everywhere a player sees it,
// the menu footer line testers screenshot, the ?dev=1 gate in front of every test URL knob, the
// title splash and its tap skip, and the difficulty line on the intro card.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDebugFlag } from '../../src/input/debug';
import { debugRequested } from '../../src/render/devpanelState';
import { DEFAULT_BLOOM_KNOBS, parseBloomKnobs } from '../../src/render/layout';
import { parseTiltKnob } from '../../src/render/project';
import { TAP_TO_START } from '../../src/ui/boot';
import { DEV_KNOBS, gateSearch, isDev } from '../../src/ui/devGate';
import { createIntroScreen, difficultyIntroLine, introCard } from '../../src/ui/intro';
import { parseLevelQuery } from '../../src/ui/levelSource';
import { createMenuScreen, footerLine, GAME_TITLE, shortSha } from '../../src/ui/menu';
import { armSplash, createSplashScreen, skipSplash, SPLASH_CLOSED, SPLASH_MS, tickSplash } from '../../src/ui/splash';
import { asParent, installFakeDocument, type FakeEl } from './fakeDom';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

describe('rename to Shapes of War', () => {
  it('the menu, boot and splash title is Shapes of War', () => {
    expect(GAME_TITLE).toBe('Shapes of War');
  });

  it('the document title and the iOS home screen title', () => {
    const html = read('index.html');
    expect(html).toContain('<title>Shapes of War</title>');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Shapes of War" />');
  });

  it('the manifest name and short_name', () => {
    const m = JSON.parse(read('public/manifest.webmanifest')) as { name?: string; short_name?: string };
    expect(m.name).toBe('Shapes of War');
    expect(m.short_name).toBe('Shapes of War');
  });

  it('no player facing file keeps the old name', () => {
    for (const p of ['index.html', 'public/manifest.webmanifest', 'vite.config.ts', 'src/ui/menu.ts', 'src/ui/boot.ts', 'src/ui/splash.ts', 'src/ui/intro.ts']) {
      expect(read(p), p).not.toMatch(/Shape of War\b/);
      expect(read(p).toLowerCase(), p).not.toContain('geometry wars');
    }
  });

  it('the menu screen shows the new title', () => {
    try {
      const root = installFakeDocument();
      createMenuScreen(asParent(root), { adventure: () => undefined, levels: () => undefined, endless: () => undefined, freePlay: () => undefined, settings: () => undefined });
      expect(root.all().some((e) => e.classList.contains('sow-title') && e.textContent === 'Shapes of War')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('menu footer line', () => {
  it('reads v3 build <short sha> seed <run seed>', () => {
    expect(footerLine('abc1234 2026-11-02T10:00Z', 42)).toBe('v3 build abc1234 seed 42');
    expect(footerLine('abc1234 2026-11-02T10:00Z', 4294967295)).toBe('v3 build abc1234 seed 4294967295');
  });

  it('falls back to dev without a usable build id', () => {
    for (const id of [undefined, '', '   ', 'nogit 2026-11-02T10:00Z', 'unknown']) expect(shortSha(id), String(id)).toBe('dev');
    expect(footerLine(undefined, 7)).toBe('v3 build dev seed 7');
  });

  it('keeps the seed an unsigned 32 bit integer', () => {
    expect(footerLine('f00d', -1)).toBe('v3 build f00d seed 4294967295');
  });

  it('the build id comes from the __BUILD_ID__ define in vite.config.ts', () => {
    expect(read('vite.config.ts')).toMatch(/__BUILD_ID__:\s*JSON\.stringify\(currentBuildId\(\)\)/);
    expect(read('src/main.ts')).toContain('menu.setFooter(footerLine(');
  });
});

describe('dev gate for every URL knob', () => {
  it('?dev=1 exactly turns dev on', () => {
    expect(isDev('?dev=1')).toBe(true);
    expect(isDev('?seed=4&dev=1')).toBe(true);
    for (const s of ['', '?dev=0', '?dev=true', '?dev', '?DEV=1', '?debug=1']) expect(isDev(s), s).toBe(false);
  });

  it('lists every knob the brief names', () => {
    for (const k of ['boss', 'tilt', 'seed', 'level', 'debug', 'surface']) expect(DEV_KNOBS).toContain(k);
  });

  it('every knob alone is dropped; with dev=1 it passes through unchanged', () => {
    for (const k of DEV_KNOBS) {
      expect(gateSearch(`?${k}=1`), k).toBe('');
      expect(gateSearch(`?${k}=1&dev=1`), k).toBe(`?${k}=1&dev=1`);
    }
  });

  it('?seed and ?level are ignored without dev=1', () => {
    expect(parseLevelQuery(gateSearch('?seed=1234&level=9'))).toEqual({ seed: null, level: null });
    expect(parseLevelQuery(gateSearch('?seed=1234&level=9&dev=1'))).toEqual({ seed: 1234, level: 9 });
  });

  it('?tilt is ignored without dev=1', () => {
    expect(parseTiltKnob(gateSearch('?tilt=high'))).toBeNull();
    expect(parseTiltKnob(gateSearch('?tilt=high&dev=1'))).toBe('high');
  });

  it('?debug is ignored without dev=1 (touch readout and devpanel)', () => {
    expect(parseDebugFlag(gateSearch('?debug=1'))).toBe(false);
    expect(debugRequested(gateSearch('?debug=1'))).toBe(false);
    expect(parseDebugFlag(gateSearch('?debug=1&dev=1'))).toBe(true);
    expect(debugRequested(gateSearch('?debug=1&dev=1'))).toBe(true);
  });

  it('?boss, ?surface, ?glow, ?stress and ?particles are ignored without dev=1', () => {
    for (const k of ['boss', 'surface', 'glow', 'stress', 'particles']) {
      expect(new URLSearchParams(gateSearch(`?${k}=warden`)).get(k), k).toBeNull();
      expect(new URLSearchParams(gateSearch(`?${k}=warden&dev=1`)).get(k), k).toBe('warden');
    }
  });

  it('the bloom knobs are ignored without dev=1', () => {
    expect(parseBloomKnobs(gateSearch('?bloomRes=0.5&bloomQuality=2&bloomBlur=3'))).toEqual(DEFAULT_BLOOM_KNOBS);
    expect(parseBloomKnobs(gateSearch('?bloomRes=0.5&bloomQuality=2&bloomBlur=3&dev=1'))).not.toEqual(DEFAULT_BLOOM_KNOBS);
  });

  it('main.ts reads the query only through the gate and strips it before other modules read it', () => {
    const main = read('src/main.ts');
    expect(main).toContain('gateSearch(raw)');
    expect(main).toContain('history.replaceState');
    // Only gateLocation reads window.location.search; every knob reader gets gated.search.
    expect(main.match(/window\.location\.search/g)?.length).toBe(1);
    expect(main).toContain('parseLevelQuery(gated.search)');
    expect(main).toContain('readQuery(gated.search)');
    expect(main).toContain('new URLSearchParams(gated.search).get(\'boss\')');
  });

  it('the corner build label is hidden unless dev', () => {
    expect(read('src/main.ts')).toContain("buildLabel.style.display = gated.dev ? '' : 'none';");
  });

  it('Show FPS still defaults to off', async () => {
    const { DEFAULT_SETTINGS } = await import('../../src/core/settings');
    expect(DEFAULT_SETTINGS.showFps).toBe(false);
  });
});

describe('title splash', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('holds for 1.2 s and then closes', () => {
    expect(SPLASH_MS).toBe(1200);
    let g = armSplash();
    expect(g).toEqual({ open: true, leftMs: 1200 });
    g = tickSplash(g, 1000);
    expect(g.open).toBe(true);
    g = tickSplash(g, 200);
    expect(g).toEqual(SPLASH_CLOSED);
  });

  it('a tap skips it at once', () => {
    expect(skipSplash(armSplash())).toEqual(SPLASH_CLOSED);
    expect(skipSplash(SPLASH_CLOSED)).toEqual(SPLASH_CLOSED);
  });

  const build = () => {
    const root = installFakeDocument();
    const timers: (() => void)[] = [];
    let done = 0;
    const splash = createSplashScreen(asParent(root), () => void done++, { after: (_ms, cb) => void timers.push(cb) });
    const screen = root.children[0] as FakeEl;
    return { root, screen, splash, timers, done: () => done };
  };

  it('opens on boot with the neon title and no image', () => {
    const { root, screen } = build();
    expect(screen.classList.contains('sow-open')).toBe(true);
    expect(screen.classList.contains('sow-splash')).toBe(true);
    expect(root.all().some((e) => e.textContent === 'Shapes of War')).toBe(true);
    expect(root.all().some((e) => e.tag === 'img' || e.tag === 'canvas')).toBe(false);
  });

  it('a tap closes it and calls onDone once; the timer later does nothing', () => {
    const { screen, splash, timers, done } = build();
    screen.tap();
    expect(screen.classList.contains('sow-open')).toBe(false);
    expect(splash.gate()).toEqual(SPLASH_CLOSED);
    expect(done()).toBe(1);
    for (const t of timers) t();
    expect(done()).toBe(1);
  });

  it('closes on its own when the timer fires', () => {
    const { screen, timers, done } = build();
    expect(timers.length).toBe(1);
    timers[0]?.();
    expect(screen.classList.contains('sow-open')).toBe(false);
    expect(done()).toBe(1);
    screen.tap();
    expect(done()).toBe(1);
  });

  it('a pointerup without its own pointerdown does not skip (no fall through)', () => {
    const { screen, done } = build();
    screen.fire('pointerup', 3);
    expect(done()).toBe(0);
    screen.fire('pointerdown', 3);
    screen.fire('pointerup', 4);
    expect(done()).toBe(0);
  });

  it('the pulse is CSS only and the boot screen still says tap to start', async () => {
    const { UI_CSS } = await import('../../src/ui/dom');
    expect(UI_CSS).toContain('@keyframes sow-splash-pulse');
    expect(UI_CSS).toMatch(/sow-splash-pulse 1200ms/);
    expect(TAP_TO_START).toBe('Tap to start');
  });
});

describe('difficulty on the intro card', () => {
  afterEach(() => vi.unstubAllGlobals());
  const def = { objective: { kind: 'destroy', count: 40 }, par: 1500, stars: [1500, 3000, 6000], drone: 'collect', superType: 'detonate' } as const;

  it('reads Difficulty: Easy, Normal or Hard; default normal', () => {
    expect(difficultyIntroLine('easy')).toBe('Difficulty: Easy');
    expect(introCard(3, { ...def, stars: [1500, 3000, 6000] }).difficulty).toBe('Difficulty: Normal');
    expect(introCard(3, { ...def, stars: [1500, 3000, 6000] }, 'hard').difficulty).toBe('Difficulty: Hard');
  });

  it('the card screen shows the selector (R1) and hides it on Ready', () => {
    const root = installFakeDocument();
    const screen = createIntroScreen(asParent(root), () => undefined);
    const line = (): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-intro') === 'difficulty');
    screen.showCard(introCard(3, { ...def, stars: [1500, 3000, 6000] }, 'easy'));
    expect(line()?.getAttribute('aria-label')).toBe('Difficulty');
    const on = line()?.all().filter((e) => e.tag === 'button' && e.getAttribute('aria-pressed') === 'true');
    expect(on?.map((e) => e.textContent)).toEqual(['Easy']);
    expect(line()?.style.display).toBe('');
    screen.showReady();
    expect(line()?.style.display).toBe('none');
  });

  it('main.ts passes the run difficulty to every new world, the card and the star cap (R2: the card choice)', () => {
    const main = read('src/main.ts');
    expect(main).toContain('type ReleaseGameOptions = GameOptions & { difficulty: Difficulty; startBonus?: StartBonus };');
    // Each level start snapshots the card's last choice (Free Play: its options) into runDifficulty.
    expect(main).toContain("runDifficulty = mode === 'freeplay' ? freePlayChoice.difficulty : settingsModel.state.difficulty;");
    expect(main).toContain('createGame(level, gameOptions(runDifficulty, runBonus ?? undefined))');
    expect(main).toContain('gameOptions(runDifficulty));');
    expect(main).toContain('introCard(flow.levelIndex, level, runDifficulty, {');
    expect(main).toContain('difficulty: runDifficulty,');
    expect(main).toContain('applySpacePhysics(spaceForDifficulty(runDifficulty));');
    expect(main).toContain('settleAdventure({');
  });
});
