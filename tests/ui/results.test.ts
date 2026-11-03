import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LevelResult } from '../../src/ui/flow';
import { continueLabel, GAME_TITLE, SHOW_ENDLESS } from '../../src/ui/menu';
import { badgeText, bossLine, createResultsScreen, parFraction, physicsLine, resultLines } from '../../src/ui/results';
import { asParent, installFakeDocument, type FakeEl } from './fakeDom';

const base: LevelResult = {
  mode: 'adventure',
  levelIndex: 2,
  score: 4500,
  stars: 3,
  success: true,
  par: 1000,
  best: 4500,
  newBest: true,
  hash: '0badf00d',
};

describe('results screen text (R2 layout)', () => {
  it('success: headline, title line, score against par, stars, best, hash, Next', () => {
    const t = resultLines({ ...base, arena: 'Circle' });
    expect(t.title).toBe('Level 2 complete');
    expect(t.sub).toBe('Circle arena');
    expect(t.score).toBe('4,500');
    expect(t.par).toBe('Score 4,500 / Par 1,000');
    expect(t.parFill).toBe(1);
    expect(t.showPar).toBe(true);
    expect(t.stars).toBe('★★★');
    expect(t.best).toBe('Best 4,500  New best');
    expect(t.detail).toBe('Level #0badf00d');
    expect(t.parReached).toBe(true);
    expect(t.primary).toBe('next');
  });

  it('failure: no new best flag, no par reward, Retry', () => {
    const t = resultLines({ ...base, success: false, stars: 0, score: 200, best: 4500, newBest: false });
    expect(t.title).toBe('Level 2 failed');
    expect(t.stars).toBe('☆☆☆');
    expect(t.best).toBe('Best 4,500');
    expect(t.parFill).toBeCloseTo(0.2);
    expect(t.parReached).toBe(false);
    expect(t.primary).toBe('retry');
  });

  it('Free Play shows score and time only: no stars, no best, no par', () => {
    const t = resultLines({ ...base, mode: 'freeplay', success: false, stars: 0, par: 0, best: 0, newBest: false, timeSec: 192, arena: 'Drum' });
    expect(t.title).toBe('Free Play over');
    expect(t.sub).toBe('Drum arena');
    expect(t.score).toBe('4,500');
    expect(t.detail).toBe('Time 3:12');
    expect(t.stars).toBe('');
    expect(t.best).toBe('');
    expect(t.showPar).toBe(false);
    expect(t.parReached).toBe(false);
    expect(t.primary).toBe('retry');
  });

  it('parFraction is score over par, clamped, and 0 without par', () => {
    expect(parFraction({ score: 500, par: 1000 })).toBe(0.5);
    expect(parFraction({ score: 5000, par: 1000 })).toBe(1);
    expect(parFraction({ score: 5000, par: 0 })).toBe(0);
  });

  describe('screen', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('two big buttons: Next on a win, Retry on a loss, and Menu', () => {
      const root = installFakeDocument();
      const calls: string[] = [];
      const screen = createResultsScreen(asParent(root), { next: () => calls.push('next'), retry: () => calls.push('retry'), menu: () => calls.push('menu') });
      screen.showResult(base);
      const primary = (): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-results') === 'primary');
      expect(primary()?.textContent).toBe('Next');
      expect(root.all().filter((e) => e.tag === 'button' && e.classList.contains('sow-big')).map((e) => e.textContent)).toEqual(['Next', 'Menu']);
      primary()?.tap();
      screen.showResult({ ...base, success: false, stars: 0 });
      expect(primary()?.textContent).toBe('Retry');
      primary()?.tap();
      root.all().find((e) => e.tag === 'button' && e.textContent === 'Menu')?.tap();
      expect(calls).toEqual(['next', 'retry', 'menu']);
    });

    it('the par bar fills with score against par and hides in Free Play', () => {
      const root = installFakeDocument();
      const screen = createResultsScreen(asParent(root), { next: () => undefined, retry: () => undefined, menu: () => undefined });
      const par = (): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-results') === 'par');
      screen.showResult({ ...base, score: 250 });
      expect(par()?.style.display).toBe('');
      expect(par()?.all().find((e) => e.classList.contains('sow-par-fill'))?.style.width).toBe('25%');
      screen.showResult({ ...base, mode: 'freeplay', par: 0, success: false });
      expect(par()?.style.display).toBe('none');
    });
  });
});

describe('Endless results', () => {
  const endless: LevelResult = { ...base, mode: 'endless', success: false, stars: 0, par: 0, score: 12000, best: 12000, rank: 1, seed: 99 };
  it('new high score badge, seed, no stars', () => {
    const t = resultLines(endless);
    expect(t.title).toBe('Game over');
    expect(t.badge).toBe('New high score');
    expect(t.stars).toBe('');
    expect(t.best).toBe('Best 12,000');
    expect(t.detail).toBe('Endless seed 99');
    expect(resultLines({ ...endless, timeSec: 75 }).detail).toBe('Time 1:15\nEndless seed 99');
  });
  it('lower ranks and misses', () => {
    expect(badgeText({ ...endless, rank: 4 })).toBe('Top 10: #4');
    expect(badgeText({ ...endless, rank: 0 })).toBe('');
    expect(badgeText({ ...base, rank: 1 })).toBe('');
  });
  it('adventure keeps stars and no badge', () => {
    expect(resultLines(base).badge).toBe('');
    expect(resultLines(base).stars).toBe('★★★');
  });
});

describe('B13 Space physics on the results screen', () => {
  it('shows the level in effect when the run ended, omitted when Off or absent', () => {
    expect(physicsLine('medium')).toBe('Space physics: Medium');
    expect(physicsLine('low')).toBe('Space physics: Low');
    expect(physicsLine('high')).toBe('Space physics: High');
    expect(physicsLine('off')).toBe('');
    expect(physicsLine(undefined)).toBe('');
  });

  it('both modes carry the line and leave the other lines as they were', () => {
    const a = resultLines({ ...base, space: 'medium' });
    expect(a.physics).toBe('Space physics: Medium');
    expect(a.detail).toBe(resultLines(base).detail);
    expect(resultLines(base).physics).toBe('');
    const e = resultLines({ ...base, mode: 'endless', success: false, seed: 5, space: 'high' });
    expect(e.physics).toBe('Space physics: High');
  });

  describe('screen', () => {
    afterEach(() => vi.unstubAllGlobals());
    const physicsEl = (root: FakeEl): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-results') === 'physics');

    it('draws the line under the detail and hides it when Off', () => {
      const root = installFakeDocument();
      const screen = createResultsScreen(asParent(root), { next: () => undefined, retry: () => undefined, menu: () => undefined });
      screen.showResult({ ...base, space: 'medium' });
      expect(physicsEl(root)?.textContent).toBe('Space physics: Medium');
      expect(physicsEl(root)?.style.display).toBe('');
      screen.showResult({ ...base, space: 'off' });
      expect(physicsEl(root)?.textContent).toBe('');
      expect(physicsEl(root)?.style.display).toBe('none');
    });
  });

  it('main.ts fills the result from the run difficulty at game over (R2: space physics follows difficulty)', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/main.ts', import.meta.url)), 'utf8');
    expect(src).toContain('const space = spaceForDifficulty(runDifficulty);');
    expect(src.match(/^\s+space,$/gm)?.length).toBe(2);
    expect(src).not.toContain('settingsModel.state.spacePhysics');
  });
});

// V3-A: "Boss defeated, bonus N" on a win with a boss (docs/13 SPEC 3.6 rule 6).
describe('boss results line', () => {
  afterEach(() => vi.unstubAllGlobals());
  const bossWin: LevelResult = { ...base, levelIndex: 5, par: 4000, score: 9000, bossBonus: 1000 };
  const bossEl = (root: FakeEl): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-results') === 'boss');
  const screenOf = (root: FakeEl): ReturnType<typeof createResultsScreen> =>
    createResultsScreen(asParent(root), { next: () => undefined, retry: () => undefined, menu: () => undefined });

  it('reads "Boss defeated, bonus N" with thousands separators on a win with a boss', () => {
    expect(bossLine(bossWin)).toBe('Boss defeated, bonus 1,000');
    expect(resultLines(bossWin).boss).toBe('Boss defeated, bonus 1,000');
    expect(bossLine({ ...bossWin, bossBonus: 500 })).toBe('Boss defeated, bonus 500');
    expect(bossLine({ ...bossWin, bossBonus: 12500 })).toBe('Boss defeated, bonus 12,500');
  });

  it('a bonus of 0 still reports the kill', () => {
    expect(bossLine({ ...bossWin, bossBonus: 0 })).toBe('Boss defeated, bonus 0');
  });

  it('no line without a boss: a normal win, a normal loss', () => {
    expect(bossLine(base)).toBe('');
    expect(resultLines(base).boss).toBe('');
    expect(resultLines({ ...base, success: false, stars: 0 }).boss).toBe('');
  });

  it('no line on a loss, even if a bonus field is present', () => {
    expect(bossLine({ ...bossWin, success: false })).toBe('');
  });

  it('no line in Endless', () => {
    const endless: LevelResult = { ...bossWin, mode: 'endless', success: false, par: 0, rank: 1, seed: 7 };
    expect(resultLines(endless).boss).toBe('');
    expect(resultLines({ ...endless, success: true }).boss).toBe('');
  });

  it('leaves every other line as it was', () => {
    const a = resultLines(bossWin);
    const b = resultLines({ ...bossWin, bossBonus: undefined });
    expect({ ...a, boss: '' }).toEqual(b);
    expect(a.title).toBe('Level 5 complete');
  });

  it('the screen draws the line and hides it on the next result without a boss', () => {
    const root = installFakeDocument();
    const screen = screenOf(root);
    screen.showResult(bossWin);
    expect(bossEl(root)?.textContent).toBe('Boss defeated, bonus 1,000');
    expect(bossEl(root)?.style.display).toBe('');
    screen.showResult(base);
    expect(bossEl(root)?.textContent).toBe('');
    expect(bossEl(root)?.style.display).toBe('none');
    screen.showResult({ ...bossWin, success: false });
    expect(bossEl(root)?.style.display).toBe('none');
  });

  it('main.ts reports the bonus only for a win where this run saw sim:bossDown', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/main.ts', import.meta.url)), 'utf8');
    expect(src).toMatch(/if \(success && bossDown\) result\.bossBonus = bossBonus\(level\.par, 'adventure', level\.boss\?\.tier \?\? 0\)/);
    expect(src).toMatch(/bus\.on\('sim:bossDown'/);
    expect(src).toMatch(/hud\.clearBoss\(\)/);
  });
});

describe('menu', () => {
  it('title is Shapes of War and Endless is shown', () => {
    expect(GAME_TITLE).toBe('Shapes of War');
    expect(SHOW_ENDLESS).toBe(true);
  });
  it('continue label names the highest unlocked level', () => {
    expect(continueLabel(1)).toBe('Adventure');
    expect(continueLabel(4)).toBe('Continue  L4');
  });
});
