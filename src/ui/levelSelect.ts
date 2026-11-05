// Level select (docs/01 section 10): grid of unlocked levels with best stars. Pages of 12, newest
// page first, because page scrolling is blocked by the document touchmove guard.
// R1: a level whose best is an Insane win shows three stars plus the iridescent 4th star.
import type { AdventureScores } from '../core/settings';
import type { StarCount } from '../core/stars';
import { button, createScreen, el, type Screen } from './dom';
import { formatInt, starGlyphs } from './format';
import { fourthStarEl, hasFourthStar } from './fourthStar';
import { setVectorText } from './vectorFont';

export const LEVELS_PER_PAGE = 12;

export interface LevelEntry {
  index: number;
  stars: StarCount;
  best: number;
}

export interface LevelPage {
  entries: LevelEntry[];
  /** 0 based, clamped. */
  page: number;
  pages: number;
}

/** Pure: page count for `unlocked` levels. */
export function pageCount(unlocked: number, perPage = LEVELS_PER_PAGE): number {
  return Math.max(1, Math.ceil(Math.max(1, Math.floor(unlocked)) / perPage));
}

/** Pure: levels 1..unlocked on page `page`, each with its stored best score and stars. */
export function levelPage(unlocked: number, scores: Readonly<AdventureScores>, page: number, perPage = LEVELS_PER_PAGE): LevelPage {
  const top = Math.max(1, Math.floor(unlocked));
  const pages = pageCount(top, perPage);
  const p = Math.min(pages - 1, Math.max(0, Math.floor(page)));
  const entries: LevelEntry[] = [];
  for (let i = p * perPage + 1; i <= Math.min(top, (p + 1) * perPage); i++) {
    const rec = scores[String(i)];
    entries.push({ index: i, stars: rec?.stars ?? 0, best: rec?.best ?? 0 });
  }
  return { entries, page: p, pages };
}

/** Pure: two line label on a level button. Three glyphs at most; the 4th star is its own element. */
export function levelButtonLabel(e: LevelEntry): string {
  return `${e.index}\n${starGlyphs(e.stars)}`;
}

export const LEVEL_SELECT_TITLE = 'Level select';

/** Pure: what a screen reader says for a level button, for example "Level 7, 2 stars". */
export function levelAriaLabel(e: LevelEntry): string {
  return `Level ${e.index}, ${e.stars} ${e.stars === 1 ? 'star' : 'stars'}`;
}

export interface LevelSelectActions {
  play(index: number): void;
  back(): void;
}

export interface LevelSelectScreen extends Screen {
  open(unlocked: number, scores: Readonly<AdventureScores>): void;
}

export function createLevelSelect(parent: HTMLElement, a: LevelSelectActions): LevelSelectScreen {
  const s = createScreen(parent);
  const title = el('div', 'sow-title');
  setVectorText(title, LEVEL_SELECT_TITLE);
  title.style.fontSize = 'clamp(22px, 5vmin, 40px)';
  const grid = el('div', 'sow-grid');
  const info = el('div', 'sow-sub', '');
  const row = el('div', 'sow-row');
  let unlocked = 1;
  let scores: Readonly<AdventureScores> = {};
  let page = 0;
  const pixelButton = (label: string, onTap: () => void): HTMLButtonElement => {
    const b = button('', onTap);
    setVectorText(b, label);
    return b;
  };
  const prev = pixelButton('Prev', () => paint(page - 1));
  const next = pixelButton('Next', () => paint(page + 1));
  row.append(prev, next, pixelButton('Back', a.back));
  s.root.append(title, grid, info, row);

  function paint(p: number): void {
    const lp = levelPage(unlocked, scores, p);
    page = lp.page;
    grid.replaceChildren(
      ...lp.entries.map((e) => {
        // Ryan (font check): the level number is in the pixel font; the star glyphs stay plain.
        const b = button('', () => a.play(e.index));
        const num = el('span', 'sow-level-num');
        setVectorText(num, String(e.index));
        b.append(num, el('span', 'sow-level-stars', starGlyphs(e.stars)));
        b.setAttribute('aria-label', levelAriaLabel(e));
        if (e.best > 0) b.title = `Best ${formatInt(e.best)}`;
        if (hasFourthStar(e.stars)) b.append(fourthStarEl());
        return b;
      }),
    );
    info.textContent = `Page ${lp.page + 1} of ${lp.pages}`;
    prev.style.visibility = lp.page > 0 ? 'visible' : 'hidden';
    next.style.visibility = lp.page < lp.pages - 1 ? 'visible' : 'hidden';
  }

  return {
    ...s,
    open(u, sc) {
      unlocked = u;
      scores = sc;
      paint(pageCount(u) - 1);
      s.show();
    },
  };
}
