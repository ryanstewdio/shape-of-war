import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LevelResult } from '../../src/ui/flow';
import { continueLabel, GAME_TITLE, SHOW_ENDLESS } from '../../src/ui/menu';
import { labelled } from '../../src/ui/intro';
import { badgeText, bossLine, createResultsScreen, parFraction, physicsLine, resultLines, scoreBar } from '../../src/ui/results';
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

describe('results screen text (R3 layout)', () => {
  it('success: Victory, title line, labelled score block, stars earned with the cap, best, level code, Next', () => {
    const t = resultLines({ ...base, arena: 'Circle', difficulty: 'normal', stars: 2, starTargets: [1000, 2000, 4000] });
    expect(t.title).toBe('Victory');
    expect(t.sub).toBe('Level 2  Circle arena');
    expect(t.score).toBe('4,500');
    expect(t.par).toBe('Par: 1,000');
    expect(t.parFill).toBe(1);
    expect(t.parMarks).toEqual([0.25, 0.5, 1]);
    expect(t.showPar).toBe(true);
    expect(t.targets.map((c) => [labelled(c), c.hit])).toEqual([
      ['1 star: 1,000', true],
      ['2 stars: 2,000', true],
      ['3 stars: 4,000', true],
    ]);
    expect(t.stars).toBe('★★☆');
    expect(t.starCap).toBe('Normal: max 2 stars');
    expect(t.best).toBe('Best: 4,500  New best');
    expect(t.detail).toBe('Level code: 0badf00d');
    expect(t.parReached).toBe(true);
    expect(t.primary).toBe('next');
  });

  it('the bar runs against the third star target; targets not reached are not lit', () => {
    const t = resultLines({ ...base, score: 1500, starTargets: [1000, 1250, 2000] });
    expect(t.parFill).toBe(0.75);
    expect(t.parMarks).toEqual([0.5, 0.625, 1]);
    expect(t.targets.map((c) => c.hit)).toEqual([true, true, false]);
    expect(scoreBar({ score: 500, par: 1000 })).toEqual({ fill: 0.5, marks: [] });
  });

  it('failure: Defeated, no new best flag, no par reward, Retry', () => {
    const t = resultLines({ ...base, success: false, stars: 0, score: 200, best: 4500, newBest: false });
    expect(t.title).toBe('Defeated');
    expect(t.stars).toBe('☆☆☆');
    expect(t.best).toBe('Best: 4,500');
    expect(t.parFill).toBeCloseTo(0.2);
    expect(t.parReached).toBe(false);
    expect(t.primary).toBe('retry');
  });

  it('Free Play shows score and time only: no stars, no best, no par', () => {
    const t = resultLines({ ...base, mode: 'freeplay', success: false, stars: 0, par: 0, best: 0, newBest: false, timeSec: 192, arena: 'Drum' });
    expect(t.title).toBe('Game over');
    expect(t.sub).toBe('Free Play  Drum arena');
    expect(t.score).toBe('4,500');
    expect(t.detail).toBe('Time: 3:12');
    expect(t.stars).toBe('');
    expect(t.best).toBe('');
    expect(t.showPar).toBe(false);
    expect(t.parReached).toBe(false);
    expect(t.primary).toBe('retry');
  });

  it('every shown line carries a label: no unlabelled run of words', () => {
    const lines = (r: LevelResult): string[] => {
      const t = resultLines(r);
      return [t.par, t.best, t.boss, t.physics, t.difficulty, ...t.detail.split('\n')].filter((x) => x !== '');
    };
    const all = [
      ...lines({ ...base, difficulty: 'hard', space: 'medium', bossBonus: 500, bossName: 'Warden', starTargets: [1000, 2000, 4000] }),
      ...lines({ ...base, mode: 'endless', success: false, seed: 4, timeSec: 61 }),
      ...lines({ ...base, mode: 'freeplay', success: false, par: 0, timeSec: 61 }),
    ];
    for (const l of all) expect(l, l).toMatch(/^[A-Z][A-Za-z ]+: /);
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

    it('R3 order: headline, score block, best, details, reward, buttons; the bar has marks at the first two targets', () => {
      const root = installFakeDocument();
      const screen = createResultsScreen(asParent(root), { next: () => undefined, retry: () => undefined, menu: () => undefined });
      screen.showResult({ ...base, difficulty: 'normal', stars: 2, starTargets: [1000, 2000, 4000] });
      const card = root.children[0]?.children[0];
      const tag = (e: FakeEl): string => e.getAttribute('data-results') ?? (e.all().some((x) => x.getAttribute('data-results') === 'title') ? 'head' : e.all().some((x) => x.getAttribute('data-results') === 'primary') ? 'buttons' : '');
      expect((card?.children ?? []).map(tag)).toEqual(['head', 'scoreBlock', 'best', 'boss', 'detail', 'physics', 'reward', 'buttons']);
      const block = card?.children[1];
      const leaves = (block?.all() ?? []).filter((e) => e.children.length === 0 && e.textContent !== '').map((e) => e.textContent);
      expect(leaves.slice(0, 3)).toEqual(['Score', '4,500', 'Par: 1,000']);
      expect(leaves).toContain('1 star');
      expect(leaves).toContain('Stars earned: ');
      expect(leaves).toContain('Normal: max 2 stars');
      const marks = root.all().filter((e) => e.getAttribute('data-results') === 'mark').map((e) => e.style.left);
      expect(marks).toEqual(['calc(25% - 1px)', 'calc(50% - 1px)']);
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
    expect(t.best).toBe('Best: 12,000');
    expect(t.detail).toBe('Seed: 99');
    expect(resultLines({ ...endless, timeSec: 75 }).detail).toBe('Time: 1:15\nSeed: 99');
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

// V3-A: the boss bonus line on a win with a boss (docs/13 SPEC 3.6 rule 6); R3 labels it "Boss bonus: N".
describe('boss results line', () => {
  afterEach(() => vi.unstubAllGlobals());
  const bossWin: LevelResult = { ...base, levelIndex: 5, par: 4000, score: 9000, bossBonus: 1000 };
  const bossEl = (root: FakeEl): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-results') === 'boss');
  const screenOf = (root: FakeEl): ReturnType<typeof createResultsScreen> =>
    createResultsScreen(asParent(root), { next: () => undefined, retry: () => undefined, menu: () => undefined });

  it('reads "Boss bonus: N (boss defeated)" with thousands separators on a win with a boss', () => {
    expect(bossLine(bossWin)).toBe('Boss bonus: 1,000 (boss defeated)');
    expect(resultLines(bossWin).boss).toBe('Boss bonus: 1,000 (boss defeated)');
    expect(bossLine({ ...bossWin, bossBonus: 500 })).toBe('Boss bonus: 500 (boss defeated)');
    expect(bossLine({ ...bossWin, bossBonus: 12500 })).toBe('Boss bonus: 12,500 (boss defeated)');
  });

  it('a bonus of 0 still reports the kill', () => {
    expect(bossLine({ ...bossWin, bossBonus: 0 })).toBe('Boss bonus: 0 (boss defeated)');
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
    expect(a.title).toBe('Victory');
    expect(bossLine({ ...bossWin, bossName: 'Warden' })).toBe('Boss bonus: 1,000 (Warden defeated)');
  });

  it('the screen draws the line and hides it on the next result without a boss', () => {
    const root = installFakeDocument();
    const screen = screenOf(root);
    screen.showResult(bossWin);
    expect(bossEl(root)?.textContent).toBe('Boss bonus: 1,000 (boss defeated)');
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
