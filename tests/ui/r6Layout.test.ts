// R6 (Ryan, gate R5): the Details toggle looks like Next and Menu, the difficulty is a bare chip on
// intro and results, the intro has a Goal and Victory label grid and a "Level N" title with the
// arena in Details, and par and the star targets follow the run's difficulty (parScale).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTIES, DIFFICULTY, type Difficulty } from '../../src/core/difficulty';
import { awardStars, parScaleFor, scaleTarget, targetsFor, type ParScaleTable } from '../../src/core/stars';
import { starsFor } from '../../src/game/objective';
import { UI_CSS } from '../../src/ui/dom';
import { formatCompact } from '../../src/ui/format';
import type { LevelResult } from '../../src/ui/flow';
import { ARENA_LABEL, createIntroScreen, endlessIntroCard, GOAL_LABEL, introCard, introDetails, VICTORY_LABEL } from '../../src/ui/intro';
import { createResultsScreen, resultLines } from '../../src/ui/results';
import { asParent, installFakeDocument, type FakeEl } from './fakeDom';

const STUB: ParScaleTable = { easy: { parScale: 0.2 }, normal: { parScale: 1 }, hard: { parScale: 1.5 }, insane: { parScale: 2 } };
const LEVEL = { par: 751000, stars: [751000, 938750, 1126500] as [number, number, number] };
const arena = { shape: 'circle', width: 900, height: 860, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } } as const;
const def = { objective: { kind: 'destroy', count: 5 } as const, par: LEVEL.par, stars: LEVEL.stars, drone: 'attack' as const, superType: 'turbo' as const, arena: { ...arena, obstacles: [] } };

describe('par and stars follow difficulty (stubbed table)', () => {
  it('parScaleFor reads the table and falls back to 1 on a bad entry', () => {
    expect(DIFFICULTIES.map((d) => parScaleFor(d, STUB))).toEqual([0.2, 1, 1.5, 2]);
    for (const d of DIFFICULTIES) expect(parScaleFor(d)).toBe(DIFFICULTY[d].parScale);
    const bad = { ...STUB, easy: { parScale: 0 }, hard: { parScale: Number.NaN }, insane: { parScale: -2 } };
    expect(parScaleFor('easy', bad)).toBe(1);
    expect(parScaleFor('hard', bad)).toBe(1);
    expect(parScaleFor('insane', bad)).toBe(1);
  });

  it('targetsFor scales par and all three targets, rounded to whole points', () => {
    expect(targetsFor(LEVEL, 'easy', STUB)).toEqual({ par: 150200, stars: [150200, 187750, 225300] });
    expect(targetsFor(LEVEL, 'normal', STUB)).toEqual(LEVEL);
    expect(targetsFor(LEVEL, 'insane', STUB)).toEqual({ par: 1502000, stars: [1502000, 1877500, 2253000] });
    expect(targetsFor({ par: 1001, stars: [1001, 1001, 1001] }, 'hard', STUB).par).toBe(1502);
  });

  it('no par stays no par (Endless, Free Play)', () => {
    expect(targetsFor({ par: 0, stars: [0, 0, 0] }, 'easy', STUB)).toEqual({ par: 0, stars: [0, 0, 0] });
    expect(scaleTarget(Number.NaN, 2)).toBeNaN();
  });

  it('with today\'s table (all 1) nothing changes', () => {
    for (const d of DIFFICULTIES as readonly Difficulty[]) if (DIFFICULTY[d].parScale === 1) expect(targetsFor(LEVEL, d)).toEqual(LEVEL);
  });

  it('scoring: level 1 Easy, 129k now earns the star a scaled par allows', () => {
    const t = targetsFor({ par: 120000, stars: [120000, 150000, 180000] }, 'easy', { ...STUB, easy: { parScale: 1 } });
    expect(starsFor(129000, t.stars)).toBe(1);
    expect(starsFor(129000, LEVEL.stars)).toBe(0);
    const easy = targetsFor(LEVEL, 'easy', STUB);
    expect(awardStars(starsFor(160000, easy.stars), 'easy', true)).toBe(1);
  });

  it('the intro star targets use the scaled numbers', () => {
    expect(introCard(1, def, 'easy', {}, STUB).stars).toEqual(introCard(1, { ...def, par: 150200, stars: [150200, 187750, 225300] }, 'normal').stars);
    expect(introCard(1, def, 'easy', {}, STUB).stars[0]?.value).toBe(formatCompact(150200));
    expect(introCard(1, def, 'insane', {}, STUB).stars).toEqual(introCard(1, { ...def, par: 1502000, stars: [1502000, 1877500, 2253000] }, 'normal').stars);
  });

  it('main.ts applies the scaled targets to the HUD, the intro, the results and the stars scored', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/main.ts', import.meta.url)), 'utf8');
    expect(src).toContain('targets = targetsFor(level, runDifficulty);');
    expect(src).toContain('hud.setLevel(index, targets.par, pick.hash);');
    expect(src).toContain('alive, targets.stars, bossBar)');
    expect(src).toContain('scoreStars: starsFor(p.score, targets.stars),');
    expect(src).toContain('par: targets.par,');
    expect(src).toContain('starTargets: targets.stars,');
    expect(src).toContain('starsFor(score, targets.stars)');
    expect(src).toContain('introCard(flow.levelIndex, level, runDifficulty, {');
    expect(src).not.toMatch(/level\.stars\b/);
    expect(src).not.toMatch(/hud\.setLevel\([^)]*level\.par/);
  });
});

describe('R6 intro layout', () => {
  afterEach(() => vi.unstubAllGlobals());
  const byIntro = (root: FakeEl, k: string): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-intro') === k);

  it('the title is "Level 12" only; the arena type and size are a Details row, before the seed', () => {
    const c = introCard(12, def, 'normal', { seed: '5' });
    expect(c.title).toBe('Level 12');
    const rows = introDetails(c);
    expect(rows).toContainEqual({ label: ARENA_LABEL, value: 'Circle 900 x 860' });
    expect(rows.map((r) => r.label).slice(-2)).toEqual([ARENA_LABEL, 'Seed']);
    expect(introCard(3, { ...def, arena: { ...arena, obstacles: [] }, surface: 'cylinder' }).arena).toBe('Drum 900 x 860');
    expect(endlessIntroCard({}).arena).toBe('');
    expect(introDetails(endlessIntroCard({})).map((r) => r.label)).toEqual([VICTORY_LABEL]);
  });

  it('focused stack: one plain goal line on the card, the victory text moved into Details', () => {
    const root = installFakeDocument();
    const screen = createIntroScreen(asParent(root), () => undefined);
    screen.showCard(introCard(12, def, 'normal'));
    expect(byIntro(root, 'title')?.textContent).toBe('Level 12');
    const goal = byIntro(root, 'goal');
    expect((goal?.children ?? []).map((e) => e.textContent)).toEqual(['Destroy 5 enemies before your lives run out']);
    expect(goal?.all().some((e) => e.textContent === GOAL_LABEL)).toBe(false);
    expect(introDetails(introCard(12, def, 'normal'))[0]).toEqual({ label: VICTORY_LABEL, value: '5 kills with a life left' });
  });

  it('the difficulty chips carry no "Difficulty" label', () => {
    const root = installFakeDocument();
    const screen = createIntroScreen(asParent(root), () => undefined);
    screen.showCard(introCard(1, def, 'hard'));
    const leaves = (byIntro(root, 'difficulty')?.all() ?? []).filter((e) => e.children.length === 0).map((e) => e.textContent);
    expect(leaves).not.toContain('Difficulty');
    expect(leaves.slice(0, 4)).toEqual(['Easy', 'Normal', 'Hard', 'Insane']);
  });

  it('the intro Details toggle is a big button like Start', () => {
    const root = installFakeDocument();
    const screen = createIntroScreen(asParent(root), () => undefined);
    screen.showCard(introCard(1, def, 'normal', { seed: '1' }));
    expect(byIntro(root, 'detailsToggle')?.classList.contains('sow-big')).toBe(true);
  });
});

describe('R6 results layout', () => {
  afterEach(() => vi.unstubAllGlobals());
  const by = (root: FakeEl, k: string): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-results') === k);
  const r: LevelResult = { mode: 'adventure', levelIndex: 1, score: 129000, stars: 1, success: true, difficulty: 'easy', par: 150200, best: 129000, newBest: true, hash: 'ABCD1234', starTargets: [150200, 187750, 225300] };
  const noop = { next: () => undefined, retry: () => undefined, menu: () => undefined };

  it('Details is styled like Next and Menu and still collapsed by default', () => {
    const root = installFakeDocument();
    const screen = createResultsScreen(asParent(root), noop);
    screen.showResult(r);
    const toggle = by(root, 'detailsToggle');
    const menu = root.all().find((e) => e.tag === 'button' && e.textContent === 'Menu');
    for (const c of ['sow-btn', 'sow-big']) {
      expect(toggle?.classList.contains(c), c).toBe(true);
      expect(menu?.classList.contains(c), c).toBe(true);
    }
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(by(root, 'detailsBody')?.style.display).toBe('none');
    toggle?.tap();
    expect(toggle?.classList.contains('sow-on')).toBe(false); // open never reads as a selected chip
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    // No rule thins the border or drops the glow on the toggle any more.
    expect(UI_CSS).not.toMatch(/\.sow-details-toggle[^{]*\{[^}]*(box-shadow: none|border-width: 1px|background: transparent)/);
  });

  it('the difficulty is a chip with the setting alone', () => {
    expect(resultLines(r).difficulty).toBe('Easy');
    const root = installFakeDocument();
    const screen = createResultsScreen(asParent(root), noop);
    screen.showResult(r);
    const chip = by(root, 'difficulty');
    expect(chip?.textContent).toBe('Easy');
    expect(chip?.classList.contains('sow-diff-chip')).toBe(true);
    expect(chip?.classList.contains('sow-diff-insane')).toBe(false);
    screen.showResult({ ...r, difficulty: 'insane', stars: 4 });
    expect(chip?.textContent).toBe('Insane');
    expect(chip?.classList.contains('sow-diff-insane')).toBe(true);
    expect(root.all().some((e) => e.children.length === 0 && /Difficulty/.test(e.textContent))).toBe(false);
  });

  it('the results bar shows the scaled targets main.ts passes', () => {
    const t = resultLines(r);
    expect(t.par).toBe(`Par ${formatCompact(150200)}`);
    expect(t.bar.ticks.map((k) => k.value)).toEqual([150200, 187750, 225300].map(formatCompact));
  });
});
