import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UI_CSS } from '../../src/ui/dom';
import { inline } from '../../src/ui/details';
import type { LevelResult } from '../../src/ui/flow';
import { continueLabel, GAME_TITLE, SHOW_ENDLESS } from '../../src/ui/menu';
import {
  badgeText,
  BAR_THIRD_AT,
  bossLine,
  createResultsScreen,
  detailItems,
  parFraction,
  physicsLine,
  resultLines,
  scoreBar,
} from '../../src/ui/results';
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

const full: LevelResult = {
  ...base,
  arena: 'Circle',
  difficulty: 'normal',
  stars: 2,
  par: 3_300_000,
  score: 3_500_000,
  best: 3_500_000,
  bestStars: 2,
  starTargets: [3_300_000, 4_100_000, 5_000_000],
  kills: 412,
  geoms: 980,
  peakMultiplier: 14,
  timeSec: 211,
  seed: 42,
  build: 'abc1234',
};

const noop = { next: () => undefined, retry: () => undefined, menu: () => undefined };
const by = (root: FakeEl, k: string): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-results') === k);
const leaves = (e: FakeEl | undefined): string[] => (e?.all() ?? []).filter((x) => x.children.length === 0 && x.textContent !== '').map((x) => x.textContent);

describe('R5 results text', () => {
  it('headline, level and difficulty; Par as "Par 3.3M"; stars earned with the "up to" cap; Best with its stars', () => {
    const t = resultLines(full);
    expect(t.title).toBe('Victory');
    expect(t.sub).toBe('Level 2  Circle arena');
    expect(t.difficulty).toBe('Difficulty Normal');
    expect(t.score).toBe('3,500,000');
    expect(t.par).toBe('Par 3.3M');
    expect(t.stars).toBe('★★☆');
    expect(t.starCap).toBe('Normal: up to 2 stars');
    expect(t.best).toBe('3,500,000');
    expect(t.bestStars).toBe('★★☆');
    expect(t.newBest).toBe(true);
    expect(t.primary).toBe('next');
  });

  it('the bar puts the third target at 85 percent, labels each tick and marks the score', () => {
    const t = resultLines(full);
    expect(t.showBar).toBe(true);
    expect(t.bar.ticks.map((k) => [k.label, k.value, k.hit])).toEqual([
      ['1 star', '3.3M', true],
      ['2 stars', '4.1M', false],
      ['3 stars', '5M', false],
    ]);
    expect(t.bar.ticks[2]?.at).toBeCloseTo(BAR_THIRD_AT);
    expect(t.bar.fill).toBeCloseTo((3_500_000 / 5_000_000) * BAR_THIRD_AT);
    expect(scoreBar({ score: 500, par: 1000 })).toEqual({ fill: 0.5, ticks: [] });
    expect(scoreBar({ score: 99e6, par: 1, starTargets: [1, 2, 3] }).fill).toBe(1);
  });

  it('Details holds everything else, each value labelled: "Seed 42", "Kills 412", "Time 3:31"', () => {
    const d = detailItems({ ...full, space: 'medium', bossBonus: 1000, bossName: 'Warden', typedSeed: true }).map(inline);
    expect(d).toEqual([
      'Time 3:31',
      'Kills 412',
      'Geoms 980',
      'Best multiplier x14',
      'Boss bonus 1,000 (Warden defeated)',
      'Space physics Medium',
      'Seed 42 (typed)',
      'Level code 0badf00d',
      'Build abc1234',
    ]);
    expect(detailItems(base).map(inline)).toEqual(['Level code 0badf00d']);
  });

  it('no unlabelled text: every detail has a label and a value, every line starts with its label', () => {
    const results: LevelResult[] = [
      { ...full, space: 'high', bossBonus: 0 },
      { ...full, mode: 'endless', success: false, rank: 3 },
      { ...full, mode: 'freeplay', success: false, par: 0, scoreAttackSec: 300 },
    ];
    for (const r of results) {
      const t = resultLines(r);
      for (const v of t.details) {
        expect(v.label, inline(v)).toMatch(/^[A-Z][A-Za-z ]+$/);
        expect(v.value, inline(v)).not.toBe('');
      }
      for (const line of [t.par, t.difficulty].filter((x) => x !== '')) expect(line).toMatch(/^(Par|Difficulty) \S/);
    }
  });

  it('failure: Defeated, no par reward, Retry', () => {
    const t = resultLines({ ...base, success: false, stars: 0, score: 200, newBest: false });
    expect(t.title).toBe('Defeated');
    expect(t.stars).toBe('☆☆☆');
    expect(t.newBest).toBe(false);
    expect(t.parReached).toBe(false);
    expect(t.primary).toBe('retry');
  });

  it('Free Play: score only, no stars, no best, no bar; time and the rest in Details', () => {
    const t = resultLines({ ...base, mode: 'freeplay', success: false, stars: 0, par: 0, best: 0, newBest: false, timeSec: 192, arena: 'Drum' });
    expect(t.title).toBe('Game over');
    expect(t.sub).toBe('Free Play  Drum arena');
    expect(t.stars).toBe('');
    expect(t.best).toBe('');
    expect(t.showBar).toBe(false);
    expect(t.details.map(inline)).toEqual(['Time 3:12', 'Level code 0badf00d']);
  });

  it('parFraction is score over par, clamped, and 0 without par', () => {
    expect(parFraction({ score: 500, par: 1000 })).toBe(0.5);
    expect(parFraction({ score: 5000, par: 1000 })).toBe(1);
    expect(parFraction({ score: 5000, par: 0 })).toBe(0);
  });

  it('the card is padded 24 px with 24 px between blocks, and blocks never shrink into each other', () => {
    expect(UI_CSS).toContain('.sow-card.sow-results { padding: 24px; gap: 24px; }');
    expect(UI_CSS).toContain('.sow-card > * { flex-shrink: 0;');
  });
});

describe('R5 results screen', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('order: headline, score block, best, reward, buttons, Details last', () => {
    const root = installFakeDocument();
    const screen = createResultsScreen(asParent(root), noop);
    screen.showResult(full);
    const card = root.children[0]?.children[0];
    expect((card?.children ?? []).map((e) => e.getAttribute('data-results'))).toEqual(['head', 'scoreBlock', 'best', 'reward', 'buttons', 'details']);
    expect(leaves(by(root, 'head'))).toEqual(['Victory', 'Level 2  Circle arena', 'Difficulty Normal']);
  });

  it('score block: label, big score, "Par" then "3.3M", three labelled ticks, the marker, stars earned and the cap', () => {
    const root = installFakeDocument();
    const screen = createResultsScreen(asParent(root), noop);
    screen.showResult(full);
    const block = leaves(by(root, 'scoreBlock'));
    expect(block.slice(0, 4)).toEqual(['Score', '3,500,000', 'Par', '3.3M']);
    expect(leaves(by(root, 'bar'))).toEqual(['1★', '3.3M', '2★', '4.1M', '3★', '5M']);
    const labels = root.all().filter((e) => e.getAttribute('data-results') === 'tickLabel').map((e) => e.getAttribute('aria-label'));
    expect(labels).toEqual(['1 star 3.3M', '2 stars 4.1M', '3 stars 5M']);
    expect(root.all().filter((e) => e.getAttribute('data-results') === 'tick')).toHaveLength(3);
    expect(by(root, 'marker')?.style.left).toBe('59.5%');
    expect(by(root, 'marker')?.getAttribute('aria-label')).toBe('Your score');
    expect(block).toContain('Stars earned');
    expect(block).toContain('Normal: up to 2 stars');
    expect(leaves(by(root, 'best'))).toEqual(['Best', '3,500,000', '★★☆', 'New best']);
  });

  it('Details is collapsed by default, opens on tap, shows labelled rows, and closes again on the next result', () => {
    const root = installFakeDocument();
    const screen = createResultsScreen(asParent(root), noop);
    screen.showResult(full);
    const body = (): FakeEl | undefined => by(root, 'detailsBody');
    const toggle = by(root, 'detailsToggle');
    expect(toggle?.textContent).toBe('Details');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(body()?.style.display).toBe('none');
    toggle?.tap();
    expect(body()?.style.display).toBe('');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    const rows = (body()?.children ?? []).map((r) => r.children.map((c) => c.textContent));
    expect(rows).toContainEqual(['Seed', '42']);
    expect(rows).toContainEqual(['Kills', '412']);
    expect(rows).toContainEqual(['Time', '3:31']);
    for (const r of rows) expect(r).toHaveLength(2);
    screen.showResult(full);
    expect(body()?.style.display).toBe('none');
  });

  it('no developer values outside Details: seed, level code and build appear only in the Details body', () => {
    const root = installFakeDocument();
    const screen = createResultsScreen(asParent(root), noop);
    screen.showResult(full);
    const card = root.children[0]?.children[0];
    const outside = (card?.children ?? []).filter((e) => e.getAttribute('data-results') !== 'details').flatMap((e) => leaves(e));
    for (const dev of ['42', '0badf00d', 'abc1234', '412']) expect(outside).not.toContain(dev);
  });

  it('two big buttons: Next on a win, Retry on a loss, and Menu', () => {
    const root = installFakeDocument();
    const calls: string[] = [];
    const screen = createResultsScreen(asParent(root), { next: () => calls.push('next'), retry: () => calls.push('retry'), menu: () => calls.push('menu') });
    screen.showResult(base);
    const primary = (): FakeEl | undefined => by(root, 'primary');
    expect(primary()?.textContent).toBe('Next');
    expect(root.all().filter((e) => e.tag === 'button' && e.classList.contains('sow-big')).map((e) => e.textContent)).toEqual(['Next', 'Menu']);
    primary()?.tap();
    screen.showResult({ ...base, success: false, stars: 0 });
    expect(primary()?.textContent).toBe('Retry');
    primary()?.tap();
    root.all().find((e) => e.tag === 'button' && e.textContent === 'Menu')?.tap();
    expect(calls).toEqual(['next', 'retry', 'menu']);
  });

  it('the bar and best hide in Free Play', () => {
    const root = installFakeDocument();
    const screen = createResultsScreen(asParent(root), noop);
    screen.showResult({ ...base, score: 250 });
    expect(by(root, 'bar')?.style.display).toBe('');
    screen.showResult({ ...base, mode: 'freeplay', par: 0, success: false });
    expect(by(root, 'bar')?.style.display).toBe('none');
    expect(by(root, 'best')?.style.display).toBe('none');
  });
});

describe('Endless results', () => {
  const endless: LevelResult = { ...base, mode: 'endless', success: false, stars: 0, par: 0, score: 12000, best: 12000, rank: 1, seed: 99 };
  it('new high score badge, best, seed in Details, no stars', () => {
    const t = resultLines(endless);
    expect(t.title).toBe('Game over');
    expect(t.badge).toBe('New high score');
    expect(t.stars).toBe('');
    expect(t.best).toBe('12,000');
    expect(t.details.map(inline)).toEqual(['Seed 99', 'Level code 0badf00d']);
    expect(resultLines({ ...endless, timeSec: 75 }).details.map(inline)[0]).toBe('Time 1:15');
  });
  it('lower ranks and misses', () => {
    expect(badgeText({ ...endless, rank: 4 })).toBe('Top 10: #4');
    expect(badgeText({ ...endless, rank: 0 })).toBe('');
    expect(badgeText({ ...base, rank: 1 })).toBe('');
  });
});

describe('B13 Space physics in Details', () => {
  it('shows the level in effect when the run ended, omitted when Off or absent', () => {
    expect(physicsLine('medium')).toBe('Space physics Medium');
    expect(physicsLine('high')).toBe('Space physics High');
    expect(physicsLine('off')).toBe('');
    expect(physicsLine(undefined)).toBe('');
    expect(detailItems({ ...base, space: 'low' }).map(inline)).toContain('Space physics Low');
  });

  it('main.ts fills the result from the run difficulty at game over (R2: space physics follows difficulty)', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/main.ts', import.meta.url)), 'utf8');
    expect(src).toContain('const space = spaceForDifficulty(runDifficulty);');
    expect(src.match(/^\s+space,$/gm)?.length).toBe(2);
    expect(src).not.toContain('settingsModel.state.spacePhysics');
  });

  it('main.ts fills kills, geoms, best multiplier and build into every result', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/main.ts', import.meta.url)), 'utf8');
    expect(src).toContain('peakMult = Math.max(peakMult, scoreOf(world).multiplier);');
    expect(src.match(/\.\.\.stats/g)?.length).toBe(3);
  });
});

// V3-A: the boss bonus on a win with a boss (docs/13 SPEC 3.6 rule 6); R5 moves it into Details.
describe('boss bonus detail', () => {
  const bossWin: LevelResult = { ...base, levelIndex: 5, par: 4000, score: 9000, bossBonus: 1000 };

  it('reads "Boss bonus 1,000 (boss defeated)" with thousands separators on a win with a boss', () => {
    expect(bossLine(bossWin)).toBe('Boss bonus 1,000 (boss defeated)');
    expect(bossLine({ ...bossWin, bossBonus: 12500, bossName: 'Warden' })).toBe('Boss bonus 12,500 (Warden defeated)');
    expect(bossLine({ ...bossWin, bossBonus: 0 })).toBe('Boss bonus 0 (boss defeated)');
  });

  it('no line without a boss, on a loss, or in Endless', () => {
    expect(bossLine(base)).toBe('');
    expect(bossLine({ ...bossWin, success: false })).toBe('');
    expect(bossLine({ ...bossWin, mode: 'endless' })).toBe('');
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
