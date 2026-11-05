// How to guide (Ryan): nine paged sections opened from the main menu, pixel font headings, short
// plain sentences, neon icons from the game's own shapes, and words from the real data tables.
// Also the level select pixel font check.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTY, DIFFICULTIES } from '../../src/core/difficulty';
import { DRONE_MODES } from '../../src/core/events';
import { INSANE_STARS, STAR_CAP } from '../../src/core/stars';
import { DRONE_ARM_SEC } from '../../src/game/drones';
import { SUPER_DURATION, TURBO_DURATION, TURBO_MAX_TOTAL, TURBO_SCALE } from '../../src/game/supers';
import { COMBO_TABLE, WEAPON_DURATION, WEAPON_KINDS } from '../../src/game/weapons';
import { ENEMY_KINDS, V2_ENEMY_KINDS } from '../../src/levelgen/leveldef';
import { FOE_INFO, type FoeKind } from '../../src/ui/enemyIntro';
import {
  countWords,
  createHowToScreen,
  DRONE_KINDS,
  drawStrokes,
  enemyKinds,
  FOE_GROUPS,
  FOE_WORDS,
  HOW_TO_TITLE,
  howToPages,
  livesWords,
  MAX_SECTION_WORDS,
  pageText,
  sectionText,
  swipeDelta,
  turnPage,
  type DrawId,
} from '../../src/ui/howTo';
import { createLevelSelect, LEVEL_SELECT_TITLE, levelAriaLabel } from '../../src/ui/levelSelect';
import { createMenuScreen, HOW_TO_LABEL, menuLayout } from '../../src/ui/menu';
import { MIN_HIT_PX } from '../../src/ui/dom';
import { asParent, buttonsLabelled, installFakeDocument, type FakeEl } from './fakeDom';

const PAGE_TITLES = [
  'Move and aim',
  'Your goal',
  'Bombs and Super',
  'Weapons',
  'Drones',
  'Enemies',
  'Hazards',
  'Stars, par and rewards',
  'Difficulty and Free Play',
];

const allText = (): string => howToPages().map(pageText).join(' ');
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

describe('How to content', () => {
  it('has the nine pages in the brief order', () => {
    expect(howToPages().map((p) => p.title)).toEqual(PAGE_TITLES);
    expect(new Set(howToPages().map((p) => p.id)).size).toBe(9);
    expect(HOW_TO_TITLE).toBe('How to');
  });

  it('every page has sections, and no section is over 40 words', () => {
    expect(MAX_SECTION_WORDS).toBe(40);
    for (const p of howToPages()) {
      expect(p.sections.length, p.title).toBeGreaterThan(0);
      for (const s of p.sections) {
        expect(s.heading.length, p.title).toBeGreaterThan(0);
        expect(s.lines.length + s.items.length, `${p.title} ${s.heading}`).toBeGreaterThan(0);
        expect(countWords(sectionText(s)), `${p.title} ${s.heading}: ${sectionText(s)}`).toBeLessThanOrEqual(MAX_SECTION_WORDS);
      }
    }
  });

  it('short plain sentences: one idea per line, no line over 16 words', () => {
    for (const p of howToPages())
      for (const s of p.sections) for (const line of s.lines) expect(countWords(line), line).toBeLessThanOrEqual(16);
  });

  it('every enemy kind appears with its name, a few words and its own icon', () => {
    const kinds: FoeKind[] = [...ENEMY_KINDS, ...V2_ENEMY_KINDS, 'spawner'];
    expect(new Set(enemyKinds())).toEqual(new Set(kinds));
    const page = howToPages().find((p) => p.id === 'enemies');
    const items = page?.sections.flatMap((s) => s.items) ?? [];
    for (const k of kinds) {
      const it = items.find((i) => i.icon.t === 'foe' && i.icon.kind === k);
      expect(it, k).toBeDefined();
      expect(it?.name).toBe(FOE_INFO[k].name);
      expect(it?.text).toBe(FOE_WORDS[k]);
    }
    expect(items).toHaveLength(kinds.length);
    // Groups follow the intro card's one word types.
    for (const s of page?.sections ?? []) expect(FOE_GROUPS.map((g) => g.heading)).toContain(s.heading);
  });

  it('the gravity well, mines, slime, membranes and drums are on the Hazards page', () => {
    const p = howToPages().find((x) => x.id === 'hazards');
    expect(p?.sections.map((s) => s.heading)).toEqual(['Gravity wells', 'Mines and slime', 'Membranes', 'Drums']);
    expect(p?.sections[0]?.icon).toEqual({ t: 'foe', kind: 'well' });
    expect(pageText(p ?? { id: '', title: '', sections: [] })).toMatch(/snakes/);
  });

  it('every weapon and every super weapon appears, from the weapon tables', () => {
    const p = howToPages().find((x) => x.id === 'weapons');
    const text = pageText(p ?? { id: '', title: '', sections: [] });
    const items = p?.sections.flatMap((s) => s.items) ?? [];
    for (const w of WEAPON_KINDS) {
      expect(items.some((i) => i.icon.t === 'reward' && i.icon.icon === w && cap(w) === i.name), w).toBe(true);
    }
    for (const c of COMBO_TABLE) expect(text).toContain(`${cap(c.a)} + ${cap(c.b)} = ${c.name}`);
    expect(text).toContain(`${WEAPON_DURATION} seconds`);
  });

  it('super, Turbo and drone numbers come from the game tables', () => {
    const text = allText();
    expect(text).toContain(`Homing: your shots chase enemies for ${SUPER_DURATION} seconds.`);
    expect(text).toContain(`shoot ${TURBO_SCALE} times as fast for ${TURBO_DURATION} seconds`);
    expect(text).toContain(`up to ${TURBO_MAX_TOTAL}`);
    expect(text).toContain(`${DRONE_ARM_SEC} seconds`);
    for (const d of DRONE_KINDS) expect(text).toContain(cap(d));
    for (const m of DRONE_MODES) expect(text).toContain(`${cap(m)}:`);
  });

  it('goal page names Survive, Destroy and Score', () => {
    const p = howToPages().find((x) => x.id === 'goal');
    expect(p?.sections.map((s) => s.heading)).toEqual(expect.arrayContaining(['Survive', 'Destroy', 'Score']));
  });

  it('stars follow the difficulty caps, Insane gives the 4th, par earns a life, bomb or weapon', () => {
    const p = howToPages().find((x) => x.id === 'stars');
    const text = pageText(p ?? { id: '', title: '', sections: [] });
    expect(text).toContain(`Easy: up to ${STAR_CAP.easy} star.`);
    expect(text).toContain(`Normal: up to ${STAR_CAP.normal} stars.`);
    expect(text).toContain(`Hard: up to ${STAR_CAP.hard} stars.`);
    expect(text).toContain(`Insane: win to get ${INSANE_STARS} stars.`);
    const rewards = p?.sections.find((s) => s.heading === 'Rewards')?.items.map((i) => i.name);
    expect(rewards).toEqual(['Life', 'Bomb', 'Weapon']);
  });

  it('difficulty lines read the lives from the table', () => {
    const text = allText();
    for (const d of DIFFICULTIES) expect(text).toContain(livesWords(DIFFICULTY[d].extraLives));
    expect(livesWords(2)).toBe('2 extra lives');
    expect(livesWords(1)).toBe('1 extra life');
    expect(livesWords(-1)).toBe('1 less life');
    expect(livesWords(0)).toBe('normal lives');
    expect(text).toMatch(/Free Play/);
  });

  it('every drawn icon has strokes inside the unit box', () => {
    const ids: DrawId[] = ['moveStick', 'aimStick', 'superRing', 'membrane', 'drift', 'star', 'star4', 'goal'];
    for (const id of ids) {
      const d = drawStrokes(id);
      expect(d.strokes.length, id).toBeGreaterThan(0);
      for (const s of d.strokes) {
        const pts = s.t === 'line' ? [s.x1, s.y1, s.x2, s.y2] : s.t === 'circle' ? [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r] : [...s.pts];
        for (const v of pts) {
          expect(v, id).toBeGreaterThanOrEqual(-1e-9);
          expect(v, id).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });

  it('no em or en dashes in any text', () => {
    expect(allText()).not.toMatch(/[\u2013\u2014]/);
  });

  it('counts words, turns pages and reads swipes', () => {
    expect(countWords('Spread + Rapid = Hail')).toBe(3);
    expect(countWords('  Chases you.  ')).toBe(2);
    expect(turnPage(0, 1, 9)).toBe(1);
    expect(turnPage(0, -1, 9)).toBe(0);
    expect(turnPage(8, 1, 9)).toBe(8);
    expect(turnPage(4, 0, 9)).toBe(4);
    expect(swipeDelta(-80, 10)).toBe(-1);
    expect(swipeDelta(80, -10)).toBe(1);
    expect(swipeDelta(30, 0)).toBe(0);
    expect(swipeDelta(-80, 120)).toBe(0);
    expect(swipeDelta(Number.NaN, 0)).toBe(0);
  });
});

describe('How to screen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const hosts = (root: FakeEl, cls: string): FakeEl[] => root.all().filter((e) => e.classList.contains(cls));
  const label = (e: FakeEl | undefined): string | null => e?.getAttribute('aria-label') ?? null;

  function build() {
    const root = installFakeDocument();
    const close = vi.fn();
    const screen = createHowToScreen(asParent(root), { close });
    const body = hosts(root, 'sow-howto-body')[0];
    const title = root.all().find((e) => e.classList.contains('sow-title'));
    return { root, screen, close, body, title };
  }

  it('every page renders with pixel font headings that expose their text', () => {
    const { root, screen, body, title } = build();
    screen.open();
    const pages = howToPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (p === undefined) throw new Error('page');
      expect(screen.page()).toBe(i);
      expect(body?.getAttribute('data-page')).toBe(p.id);
      expect(label(title)).toBe(p.title);
      expect(title?.classList.contains('sow-vec-host')).toBe(true);
      expect(title?.all().some((e) => e.tag === 'svg')).toBe(true);
      const heads = hosts(root, 'sow-howto-head');
      expect(heads.map(label)).toEqual(p.sections.map((s) => s.heading));
      for (const h of heads) {
        expect(h.classList.contains('sow-vec-host')).toBe(true);
        expect(h.all().find((e) => e.classList.contains('sow-sr'))?.textContent).toBe(h.getAttribute('aria-label'));
      }
      const lines = hosts(root, 'sow-howto-line').map((e) => e.textContent);
      expect(lines).toEqual(p.sections.flatMap((s) => [...s.lines]));
      const names = hosts(root, 'sow-howto-name').map((e) => e.textContent);
      expect(names).toEqual(p.sections.flatMap((s) => s.items.map((it) => it.name)));
      // Every section with an icon and every item draws one canvas icon.
      const icons = root.all().filter((e) => e.tag === 'canvas' && e.getAttribute('data-howto-icon') !== null);
      expect(icons).toHaveLength(p.sections.reduce((n, s) => n + (s.icon === undefined ? 0 : 1) + s.items.length, 0));
      buttonsLabelled(root, 'Next')[0]?.tap();
    }
    expect(screen.page()).toBe(pages.length - 1);
  });

  it('the Enemies page draws every enemy icon', () => {
    const { root, screen } = build();
    screen.open(5);
    const drawn = root.all().flatMap((e) => (e.tag === 'canvas' ? [e.getAttribute('data-howto-icon')] : []));
    for (const k of enemyKinds()) expect(drawn).toContain(`foe:${k}`);
    for (const k of enemyKinds()) expect(drawn.filter((d) => d === `foe:${k}`)).toHaveLength(1);
  });

  it('Back and Next walk the pages; Back hides on the first page, Next on the last; a dot per page marks the page', () => {
    const { root, screen } = build();
    screen.open();
    const back = buttonsLabelled(root, 'Back')[0];
    const next = buttonsLabelled(root, 'Next')[0];
    const dots = hosts(root, 'sow-howto-dot');
    expect(dots).toHaveLength(9);
    expect(back?.style.visibility).toBe('hidden');
    expect(next?.style.visibility).toBe('visible');
    expect(dots.map((d) => d.classList.contains('sow-on'))).toEqual([true, false, false, false, false, false, false, false, false]);
    next?.tap();
    next?.tap();
    expect(screen.page()).toBe(2);
    expect(dots[2]?.classList.contains('sow-on')).toBe(true);
    expect(back?.style.visibility).toBe('visible');
    back?.tap();
    expect(screen.page()).toBe(1);
    screen.open(8);
    expect(next?.style.visibility).toBe('hidden');
    next?.tap();
    expect(screen.page()).toBe(8);
    screen.open();
    expect(screen.page()).toBe(0);
  });

  it('a swipe left turns to the next page and a swipe right goes back', () => {
    const { root, screen } = build();
    screen.open(3);
    const card = hosts(root, 'sow-howto-card')[0];
    card?.fire('pointerdown', 1, 300);
    card?.fire('pointerup', 1, 200);
    expect(screen.page()).toBe(4);
    card?.fire('pointerdown', 1, 100);
    card?.fire('pointerup', 1, 260);
    expect(screen.page()).toBe(3);
    card?.fire('pointerdown', 1, 100);
    card?.fire('pointerup', 1, 120);
    expect(screen.page()).toBe(3);
    card?.fire('pointerdown', 1, 300);
    card?.fire('pointerup', 2, 100);
    expect(screen.page()).toBe(3);
  });

  it('Close calls the action and open shows the screen', () => {
    const { root, screen, close } = build();
    screen.open();
    expect(root.all().find((e) => e.classList.contains('sow-screen'))?.classList.contains('sow-open')).toBe(true);
    buttonsLabelled(root, 'Close')[0]?.tap();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('touch only: no keyboard, mouse or gamepad handling in the source', () => {
    const src = readFileSync(new URL('../../src/ui/howTo.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/keydown|keyup|keypress|mousedown|mouseup|'click'|\.focus\(|tabIndex|gamepad/i);
    expect(src).not.toMatch(/Math\.random/);
  });
});

describe('How to on the main menu', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a How to row opens the guide', () => {
    const root = installFakeDocument();
    const howTo = vi.fn();
    createMenuScreen(asParent(root), { adventure: vi.fn(), levels: vi.fn(), endless: vi.fn(), freePlay: vi.fn(), settings: vi.fn(), howTo });
    const b = buttonsLabelled(root, HOW_TO_LABEL)[0];
    expect(b?.classList.contains('sow-menu-row')).toBe(true);
    b?.tap();
    expect(howTo).toHaveBeenCalledTimes(1);
  });

  it('the How to row is a full size tap target on both screens and the menu still fits', () => {
    for (const [W, H] of [
      [960, 411],
      [840, 360],
      [832, 750],
      [1092, 984],
    ] as const) {
      const L = menuLayout(W, H, { top: 0, right: 0, bottom: 0, left: 0 });
      expect(L.fits, `${W}x${H}`).toBe(true);
      expect(L.howTo.h).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(L.howTo.w).toBeGreaterThanOrEqual(160);
    }
  });
});

describe('level select pixel font', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('title, level numbers and the Prev, Next and Back labels are pixel font hosts with their text', () => {
    const root = installFakeDocument();
    const play = vi.fn();
    const screen = createLevelSelect(asParent(root), { play, back: vi.fn() });
    screen.open(14, { '2': { best: 900, stars: 2 } });
    const vec = root.all().filter((e) => e.classList.contains('sow-vec-host'));
    const spoken = vec.map((e) => e.getAttribute('aria-label'));
    expect(spoken).toContain(LEVEL_SELECT_TITLE);
    for (const l of ['Prev', 'Next', 'Back']) expect(spoken).toContain(l);
    // Last page first: levels 13 and 14.
    const nums = root.all().filter((e) => e.classList.contains('sow-level-num'));
    expect(nums.map((n) => n.getAttribute('aria-label'))).toEqual(['13', '14']);
    expect(nums.every((n) => n.classList.contains('sow-vec-host') && n.all().some((e) => e.tag === 'svg'))).toBe(true);
    buttonsLabelled(root, 'Prev')[0]?.tap();
    const btn = root.all().find((e) => e.tag === 'button' && e.getAttribute('aria-label') === 'Level 2, 2 stars');
    expect(btn).toBeDefined();
    btn?.tap();
    expect(play).toHaveBeenCalledWith(2);
  });

  it('level button labels', () => {
    expect(levelAriaLabel({ index: 7, stars: 1, best: 0 })).toBe('Level 7, 1 star');
    expect(levelAriaLabel({ index: 9, stars: 4, best: 10 })).toBe('Level 9, 4 stars');
  });
});
