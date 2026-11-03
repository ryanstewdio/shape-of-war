// R2 (Ryan, build 39d1421): par reward, Free Play and the HUD star line.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadPendingBonus,
  parsePendingBonus,
  parseStartBonus,
  resetProgress,
  savePendingBonus,
  START_BONUS_KEY,
  takePendingBonus,
  type StorageLike,
} from '../../src/core/settings';
import { initialFlow, reduceFlow, simRunning, type FlowState, type LevelResult } from '../../src/ui/flow';
import {
  arenaLabel,
  barriersLabel,
  createFreePlayScreen,
  DEFAULT_FREE_PLAY,
  FREE_PLAY_ARENAS,
  freePlaySummary,
  type FreePlayChoice,
} from '../../src/ui/freePlay';
import { createHud } from '../../src/ui/hud';
import {
  bonusLabel,
  createRewardChooser,
  earnsParReward,
  iconStrokes,
  PAR_REACHED,
  rewardChosenLine,
  rewardOptions,
  WEAPONS,
} from '../../src/ui/parReward';
import { createResultsScreen } from '../../src/ui/results';
import { uiScreenOf } from '../../src/ui/screenEvent';
import { asParent, groupButtons, installFakeDocument, type FakeEl } from './fakeDom';

afterEach(() => vi.unstubAllGlobals());

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const win: LevelResult = { mode: 'adventure', levelIndex: 6, score: 12000, stars: 2, success: true, difficulty: 'normal', par: 10000, best: 12000, newBest: true, hash: 'abcd' };

describe('par reward: who earns it', () => {
  it('a successful Adventure level whose final score reached par', () => {
    expect(earnsParReward(win)).toBe(true);
    expect(earnsParReward({ ...win, score: 10000 })).toBe(true);
    expect(earnsParReward({ ...win, score: 9999 })).toBe(false);
    expect(earnsParReward({ ...win, success: false })).toBe(false);
    expect(earnsParReward({ ...win, mode: 'endless' })).toBe(false);
    expect(earnsParReward({ ...win, mode: 'freeplay' })).toBe(false);
    expect(earnsParReward({ ...win, par: 0 })).toBe(false);
  });

  it('offers a life, a bomb and the four base weapons, each with a word', () => {
    const o = rewardOptions();
    expect(o.map((x) => x.word)).toEqual(['Life', 'Bomb', 'Spread', 'Rapid', 'Pierce', 'Orbit']);
    expect(o.map((x) => x.bonus)).toEqual([
      { kind: 'life' },
      { kind: 'bomb' },
      ...WEAPONS.map((weapon) => ({ kind: 'weapon', weapon })),
    ]);
    expect(bonusLabel({ kind: 'weapon', weapon: 'pierce' })).toBe('Start with Pierce');
    expect(rewardChosenLine({ kind: 'life' }, 7)).toBe('Extra life ready for level 7');
  });

  it('every icon is drawn from strokes inside the unit box', () => {
    for (const o of rewardOptions()) {
      const strokes = iconStrokes(o.icon);
      expect(strokes.length, o.icon).toBeGreaterThan(0);
      for (const k of strokes) {
        const nums = k.t === 'line' ? [k.x1, k.y1, k.x2, k.y2] : k.t === 'circle' ? [k.x - k.r, k.y - k.r, k.x + k.r, k.y + k.r] : [...k.pts];
        for (const n of nums) expect(n >= 0 && n <= 1, `${o.icon} ${n}`).toBe(true);
      }
    }
  });
});

describe('par reward: the results chooser', () => {
  const rewardRoot = (root: FakeEl): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-results') === 'reward');

  it('shows "Par reached" and six buttons on a par win; one pick only, passed with the next level', () => {
    const root = installFakeDocument();
    const picks: string[] = [];
    const screen = createResultsScreen(asParent(root), {
      next: () => undefined,
      retry: () => undefined,
      menu: () => undefined,
      reward: (b, next) => picks.push(`${JSON.stringify(b)}@${next}`),
    });
    screen.showResult(win);
    const box = rewardRoot(root);
    expect(box?.style.display).toBe('');
    expect(box?.all().some((e) => e.textContent === PAR_REACHED)).toBe(true);
    const weapons = groupButtons(root, 'Start with a weapon');
    expect(weapons.map((b) => b.children[1]?.textContent)).toEqual(['Spread', 'Rapid', 'Pierce', 'Orbit']);
    expect(weapons.every((b) => b.children[0]?.tag === 'canvas')).toBe(true);
    weapons[2]?.tap();
    groupButtons(root, 'Extra life')[0]?.tap(); // ignored: one reward per completion
    expect(picks).toEqual(['{"kind":"weapon","weapon":"pierce"}@7']);
    expect(weapons[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(box?.all().some((e) => e.textContent === 'Start with Pierce ready for level 7')).toBe(true);
  });

  it('is hidden on a loss, below par, in Endless and in Free Play; a new result opens fresh', () => {
    const root = installFakeDocument();
    const picks: string[] = [];
    const screen = createResultsScreen(asParent(root), { next: () => undefined, retry: () => undefined, menu: () => undefined, reward: () => picks.push('x') });
    for (const r of [{ ...win, success: false, stars: 0 as const }, { ...win, score: 10 }, { ...win, mode: 'endless' as const }, { ...win, mode: 'freeplay' as const }]) {
      screen.showResult(r);
      expect(rewardRoot(root)?.style.display).toBe('none');
    }
    screen.showResult(win);
    groupButtons(root, 'Extra bomb')[0]?.tap();
    screen.showResult({ ...win, levelIndex: 7 });
    groupButtons(root, 'Extra life')[0]?.tap();
    expect(picks).toEqual(['x', 'x']);
  });

  it('createRewardChooser reports the pick', () => {
    installFakeDocument();
    const c = createRewardChooser(() => undefined);
    c.open(win);
    expect(c.chosen()).toBeNull();
  });
});

describe('par reward: held for the next level start (sow.progress.startBonus)', () => {
  it('round trips, is taken once by the level it was held for, and a Retry of another level keeps it', () => {
    const s = memory();
    expect(loadPendingBonus(s)).toBeNull();
    savePendingBonus({ level: 7, bonus: { kind: 'weapon', weapon: 'orbit' } }, s);
    expect(loadPendingBonus(s)).toEqual({ level: 7, bonus: { kind: 'weapon', weapon: 'orbit' } });
    expect(takePendingBonus(6, s)).toBeNull();
    expect(loadPendingBonus(s)).not.toBeNull();
    expect(takePendingBonus(7, s)).toEqual({ kind: 'weapon', weapon: 'orbit' });
    expect(takePendingBonus(7, s)).toBeNull();
    expect(s.data.get(START_BONUS_KEY)).toBe('');
  });

  it('rejects malformed values', () => {
    for (const raw of [null, '', '{', '[]', '{"level":0,"bonus":{"kind":"life"}}', '{"level":2.5,"bonus":{"kind":"life"}}', '{"level":2,"bonus":{"kind":"shield"}}', '{"level":2,"bonus":{"kind":"weapon","weapon":"laser"}}']) {
      expect(parsePendingBonus(raw), String(raw)).toBeNull();
    }
    expect(parseStartBonus({ kind: 'bomb' })).toEqual({ kind: 'bomb' });
    expect(parseStartBonus({ kind: 'weapon', weapon: 'rapid' })).toEqual({ kind: 'weapon', weapon: 'rapid' });
  });

  it('reset progress drops it', () => {
    const s = memory();
    savePendingBonus({ level: 2, bonus: { kind: 'life' } }, s);
    resetProgress(s);
    expect(loadPendingBonus(s)).toBeNull();
  });
});

describe('Free Play flow', () => {
  const menu = (): FlowState => initialFlow(3);

  it('menu opens the options screen; Back returns; Start plays a freeplay run', () => {
    const opts = reduceFlow(menu(), { type: 'openFreePlay' });
    expect(opts.screen).toBe('freeplay');
    expect(uiScreenOf(opts)).toBe('menu');
    expect(simRunning(opts)).toBe(false);
    expect(reduceFlow(opts, { type: 'closeFreePlay' }).screen).toBe('menu');
    const run = reduceFlow(opts, { type: 'start', mode: 'freeplay', levelIndex: 9 });
    expect(run).toMatchObject({ screen: 'playing', mode: 'freeplay', levelIndex: 1, run: 1 });
  });

  it('Free Play starts only from its screen; its results offer Retry, never Next', () => {
    expect(reduceFlow(menu(), { type: 'start', mode: 'freeplay', levelIndex: 1 }).screen).toBe('menu');
    const opts = reduceFlow(menu(), { type: 'openFreePlay' });
    expect(reduceFlow(opts, { type: 'start', mode: 'adventure', levelIndex: 1 })).toBe(opts);
    const run = reduceFlow(opts, { type: 'start', mode: 'freeplay', levelIndex: 1 });
    const over = reduceFlow(run, { type: 'over', result: { ...win, mode: 'freeplay', success: false, stars: 0, par: 0 } });
    expect(over.screen).toBe('results');
    expect(reduceFlow(over, { type: 'next' })).toBe(over);
    expect(reduceFlow(over, { type: 'retry' })).toMatchObject({ screen: 'playing', mode: 'freeplay', run: 2 });
  });

  it('the options screen: four difficulties, three arenas, barriers on or off; Start passes the choice', () => {
    const root = installFakeDocument();
    const started: FreePlayChoice[] = [];
    let backs = 0;
    const screen = createFreePlayScreen(asParent(root), { start: (c) => started.push(c), back: () => void backs++ });
    screen.open({ ...DEFAULT_FREE_PLAY, difficulty: 'hard' });
    const diff = groupButtons(root, 'Difficulty');
    const arena = groupButtons(root, 'Arena');
    const barriers = groupButtons(root, 'Barriers');
    expect(diff.map((b) => b.textContent)).toEqual(['Easy', 'Normal', 'Hard', 'Insane']);
    expect(diff.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false']);
    expect(arena.map((b) => b.textContent)).toEqual(['Rectangle', 'Circle', 'Drum']);
    expect(barriers.map((b) => b.textContent)).toEqual(['On', 'Off']);
    arena[2]?.tap();
    barriers[0]?.tap();
    diff[3]?.tap();
    expect(arena.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    root.all().find((e) => e.tag === 'button' && e.textContent === 'Start')?.tap();
    root.all().find((e) => e.tag === 'button' && e.textContent === 'Back')?.tap();
    expect(started).toEqual([{ difficulty: 'insane', arena: 'drum', barriers: true, config: DEFAULT_FREE_PLAY.config }]);
    expect(backs).toBe(1);
    expect(screen.current()).toEqual({ difficulty: 'insane', arena: 'drum', barriers: true, config: DEFAULT_FREE_PLAY.config });
  });

  it('labels and summary', () => {
    expect(FREE_PLAY_ARENAS.map(arenaLabel)).toEqual(['Rectangle', 'Circle', 'Drum']);
    expect([barriersLabel(true), barriersLabel(false)]).toEqual(['On', 'Off']);
    expect(freePlaySummary({ ...DEFAULT_FREE_PLAY, difficulty: 'easy', arena: 'circle', barriers: false })).toBe('Easy, Circle arena, barriers off, Endless');
  });
});

describe('HUD star line', () => {
  it('draws the star line and its two marks under the objective fill, and hides them without stars', () => {
    const root = installFakeDocument();
    const hud = createHud(asParent(root), () => 0);
    const line = root.all().find((e) => e.getAttribute('data-hud') === 'starLine');
    const ticks = root.all().filter((e) => e.classList.contains('sow-hud-tick'));
    const fill = root.all().find((e) => e.classList.contains('sow-hud-fill'));
    hud.setObjective({ label: 'Destroy 312 / 530', fraction: 312 / 530, stars: 0.4, starMarks: [0.25, 0.5] });
    expect(fill?.style.width).toBe('58.9%');
    expect(line?.style.width).toBe('40%');
    expect(line?.style.display).toBe('');
    expect(ticks.map((t) => t.style.left)).toEqual(['25%', '50%']);
    hud.setObjective({ label: 'Endless', fraction: 0, stars: null });
    expect(line?.style.display).toBe('none');
    expect(ticks.map((t) => t.style.display)).toEqual(['none', 'none']);
  });
});
