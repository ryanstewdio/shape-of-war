// Main menu (docs/01 section 10): title "Shape Legend", Continue (Adventure at the highest
// unlocked level), Level select, Endless, Settings.
// Look (Ryan, wave 2): a centred neon panel with a double glowing border over the grid, the title
// in the game's own neon style, four stacked framed neon rows, the focused or last used row in a
// warm orange frame, the seed and level line under the rows and a thin footer with the build id.
// Rows animate in with a MENU_STAGGER_MS stagger each time the menu opens. Touch only: a tap on a
// row marks it and runs its action; there is no keyboard focus code.
// The geometry comes from the pure menuLayout: one stacked column on the main screen, and on the
// short cover screen the title on the left with the rows and the info line under them on the
// right, so four rows at the 44 px minimum still fit with room to spare.
// How to (Ryan): a row in a yellow frame opens the How to guide. Polish r9: it sits directly above
// Settings, and every row label is drawn in the pixel font.
import type { Insets, Rect } from '../input/types';
import { button, createScreen, el, MIN_HIT_PX, type Screen } from './dom';
import { aspectClass } from './hudFrame';
import { setVectorText } from './vectorFont';

export const GAME_TITLE = 'Shape Legend';
export const SHOW_ENDLESS = true;
/** Delay between one row's entrance and the next. */
export const MENU_STAGGER_MS = 200;
export const MENU_ROWS = 6; // Adventure, Level select, Endless, Free Play, How to, Settings
/** Clear space kept between the panel and the safe area edge: room for the outer border and glow. */
export const MENU_MARGIN = 12;
/**
 * The pixel title is 70 cells wide ("Shape Legend" plus its shadow) at a font size over 10 cells,
 * rounded to whole px: 8.9 em covers the worst rounding (25 px draws 3 px cells) from 18 to 52 px.
 */
export const TITLE_EMS = 8.9;

export interface MenuActions {
  adventure(): void;
  levels(): void;
  endless(): void;
  /** R2: opens the Free Play options screen. */
  freePlay(): void;
  settings(): void;
  /** Opens the How to guide. */
  howTo(): void;
}

/** Label on the How to row. */
export const HOW_TO_LABEL = 'How to';
/** Index of the How to row: directly above Settings, the last row. */
export const HOW_TO_ROW = MENU_ROWS - 2;

export interface MenuScreen extends Screen {
  /** Subtitle under the buttons, for example "Level 3  Seed 42". */
  setInfo(text: string): void;
  /** Label on the Adventure button, for example "Continue  L3". */
  setContinue(text: string): void;
  /** Footer line, for example "v3 build abc123 seed 42" (footerLine). */
  setFooter(text: string): void;
  /** Size the panel for the viewport and its safe area insets (resize, fold and unfold). */
  layout(cssW: number, cssH: number, insets: Insets): void;
  /** Index of the row in the warm frame: the last row tapped, Play or Continue at first. */
  focused(): number;
}

/** The release line printed before the build sha in the menu footer. */
export const FOOTER_VERSION = 'v3';

/**
 * Pure: the short sha from the build id define (vite.config.ts __BUILD_ID__, "<sha> <date>"), or
 * "dev" when the define is missing, empty or the build had no git ("nogit").
 */
export function shortSha(buildId: string | undefined): string {
  const sha = (buildId ?? '').trim().split(/\s+/)[0] ?? '';
  return sha === '' || sha === 'nogit' || sha === 'unknown' ? 'dev' : sha;
}

/** Pure: the menu footer testers screenshot, "v3 build <short sha> seed <run seed>". */
export function footerLine(buildId: string | undefined, runSeed: number): string {
  return `${FOOTER_VERSION} build ${shortSha(buildId)} seed ${runSeed >>> 0}`;
}

/** Pure: Adventure button label. */
export function continueLabel(unlocked: number): string {
  return unlocked > 1 ? `Continue  L${Math.floor(unlocked)}` : 'Adventure';
}

export type MenuArrangement = 'stack' | 'side';

export interface MenuLayout {
  arrangement: MenuArrangement;
  /** Panel border box in CSS px, centred in the safe area. */
  panel: Rect;
  pad: number;
  /** The four row hit rects, top to bottom. */
  rows: Rect[];
  rowH: number;
  rowGap: number;
  /** Gap between the title, rows, info and footer blocks. */
  sectionGap: number;
  /** Side arrangement: width of the title column, the rows column and the gap between them. 0 when stacked. */
  leftW: number;
  rightW: number;
  colGap: number;
  title: Rect;
  info: Rect;
  /** The How to row: under the rows (stack) or under the info line (side). */
  howTo: Rect;
  foot: Rect;
  titleSize: number;
  rowSize: number;
  infoSize: number;
  footSize: number;
  /** True when the panel, its border and glow fit inside the safe area. */
  fits: boolean;
}

interface Tier {
  rowH: number;
  rowGap: number;
  pad: number;
  sectionGap: number;
  titleMax: number;
  rowSize: number;
  infoSize: number;
  footSize: number;
}

/** Roomiest first; the first tier that fits wins, the last is the fallback. */
const TIERS: readonly Tier[] = [
  { rowH: 56, rowGap: 12, pad: 22, sectionGap: 14, titleMax: 52, rowSize: 18, infoSize: 15, footSize: 11 },
  { rowH: 48, rowGap: 10, pad: 18, sectionGap: 10, titleMax: 40, rowSize: 16, infoSize: 14, footSize: 11 },
  { rowH: MIN_HIT_PX, rowGap: 6, pad: 12, sectionGap: 6, titleMax: 30, rowSize: 15, infoSize: 13, footSize: 10 },
  // Six rows on the short cover screen: the last tier trims the gaps, never the 44 px hit height.
  { rowH: MIN_HIT_PX, rowGap: 3, pad: 8, sectionGap: 4, titleMax: 30, rowSize: 15, infoSize: 12, footSize: 10 },
];

const lineH = (size: number, k: number): number => Math.round(size * k);
/** Footer height: one line plus its 4 px top padding and 1 px top rule. */
const footH = (size: number): number => lineH(size, 1.4) + 5;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function build(safe: Rect, arrangement: MenuArrangement, t: Tier): MenuLayout {
  const rowsH = MENU_ROWS * t.rowH + (MENU_ROWS - 1) * t.rowGap;
  const panelW = Math.max(0, Math.min(safe.w - 2 * MENU_MARGIN, arrangement === 'side' ? 640 : 440));
  const innerW = Math.max(0, panelW - 2 * t.pad);
  const colGap = arrangement === 'side' ? 20 : 0;
  const leftW = arrangement === 'side' ? Math.round((innerW - colGap) * 0.46) : 0;
  const rightW = arrangement === 'side' ? innerW - colGap - leftW : innerW;
  const titleSize = Math.floor(clamp((arrangement === 'side' ? leftW : innerW) / TITLE_EMS, 18, t.titleMax));
  const titleH = lineH(titleSize, 1.25);
  const infoH = lineH(t.infoSize, 1.5) * 2; // room for two lines (pre-line), the seed note can wrap
  const fH = footH(t.footSize);
  let bodyH: number;
  // R2: five rows. On the cover screen the info line sits under the title in the left column, so the
  // rows column holds only the rows and the panel still fits the short screen.
  // Cover screen: the footer joins the title column, so six 44 px rows still fit the short screen.
  const leftH = titleH + t.sectionGap + infoH + t.sectionGap + fH;
  if (arrangement === 'side') bodyH = Math.max(leftH, rowsH);
  else bodyH = titleH + t.sectionGap + rowsH + t.sectionGap + infoH;
  const panelH = 2 * t.pad + bodyH + (arrangement === 'side' ? 0 : t.sectionGap + fH);
  const panel: Rect = { x: safe.x + (safe.w - panelW) / 2, y: safe.y + (safe.h - panelH) / 2, w: panelW, h: panelH };
  const ix = panel.x + t.pad;
  const iy = panel.y + t.pad;
  let rowsX: number;
  let rowsY: number;
  let title: Rect;
  let info: Rect;
  if (arrangement === 'side') {
    rowsX = ix + leftW + colGap;
    rowsY = iy + (bodyH - rowsH) / 2;
    title = { x: ix, y: iy + (bodyH - leftH) / 2, w: leftW, h: titleH };
    info = { x: ix, y: title.y + titleH + t.sectionGap, w: leftW, h: infoH };
  } else {
    rowsX = ix;
    rowsY = iy + titleH + t.sectionGap;
    title = { x: ix, y: iy, w: innerW, h: titleH };
    info = { x: ix, y: rowsY + rowsH + t.sectionGap, w: innerW, h: infoH };
  }
  const rows: Rect[] = [];
  for (let i = 0; i < MENU_ROWS; i++) rows.push({ x: rowsX, y: rowsY + i * (t.rowH + t.rowGap), w: rightW, h: t.rowH });
  // How to is the fifth row, directly above Settings; the rect is kept for callers that name it.
  const howTo = rows[HOW_TO_ROW] as Rect;
  const foot: Rect =
    arrangement === 'side' ? { x: ix, y: info.y + infoH + t.sectionGap, w: leftW, h: fH } : { x: ix, y: iy + bodyH + t.sectionGap, w: innerW, h: fH };
  const fits =
    panel.x >= safe.x + MENU_MARGIN - 1e-6 &&
    panel.y >= safe.y + MENU_MARGIN - 1e-6 &&
    panel.x + panel.w <= safe.x + safe.w - MENU_MARGIN + 1e-6 &&
    panel.y + panel.h <= safe.y + safe.h - MENU_MARGIN + 1e-6 &&
    rightW >= 160 &&
    howTo.w >= 160;
  return {
    arrangement,
    panel,
    pad: t.pad,
    rows,
    rowH: t.rowH,
    rowGap: t.rowGap,
    sectionGap: t.sectionGap,
    leftW,
    rightW: arrangement === 'side' ? rightW : 0,
    colGap,
    title,
    info,
    howTo,
    foot,
    titleSize,
    rowSize: t.rowSize,
    infoSize: t.infoSize,
    footSize: t.footSize,
    fits,
  };
}

/**
 * Pure: menu geometry for a viewport and its safe area insets. The cover screen (21:9) puts the
 * title beside the rows; the main screen stacks everything. Rows never go below MIN_HIT_PX high.
 */
export function menuLayout(cssW: number, cssH: number, ins: Insets): MenuLayout {
  const W = Math.max(1, cssW);
  const H = Math.max(1, cssH);
  const safe: Rect = { x: ins.left, y: ins.top, w: Math.max(1, W - ins.left - ins.right), h: Math.max(1, H - ins.top - ins.bottom) };
  const arrangement: MenuArrangement = aspectClass(W, H) === 'cover' ? 'side' : 'stack';
  let last: MenuLayout | null = null;
  for (const t of TIERS) {
    last = build(safe, arrangement, t);
    if (last.fits) return last;
  }
  return last ?? build(safe, arrangement, TIERS[TIERS.length - 1] as Tier);
}

/** Pure: entrance delay for row i in CSS time. */
export function rowDelay(i: number): string {
  return `${Math.max(0, Math.floor(i)) * MENU_STAGGER_MS}ms`;
}

export function createMenuScreen(parent: HTMLElement, actions: MenuActions): MenuScreen {
  const s = createScreen(parent);
  s.root.classList.add('sow-menu');
  const panel = el('div', 'sow-menu-panel');
  const title = el('div', 'sow-title');
  setVectorText(title, GAME_TITLE);
  title.style.gridArea = 'title';
  const rowsBox = el('div', 'sow-menu-rows');
  rowsBox.style.gridArea = 'rows';
  let focus = 0;
  const rows: HTMLButtonElement[] = [];
  const paintFocus = (): void => {
    rows.forEach((r, i) => r.classList.toggle('sow-focus', i === focus));
  };
  const row = (label: string, act: () => void): HTMLButtonElement => {
    const index = rows.length;
    const b = button('', () => {
      focus = index;
      paintFocus();
      act();
    });
    setVectorText(b, label, { tone: 'white' });
    b.classList.add('sow-menu-row');
    b.style.animationDelay = rowDelay(index);
    rows.push(b);
    return b;
  };
  const adventure = row('Adventure', () => actions.adventure());
  const levels = row('Level select', () => actions.levels());
  const endless = row('Endless', () => actions.endless());
  const freePlay = row('Free Play', () => actions.freePlay());
  const howTo = row(HOW_TO_LABEL, () => actions.howTo());
  howTo.classList.add('sow-menu-howto');
  const settings = row('Settings', () => actions.settings());
  endless.style.display = SHOW_ENDLESS ? '' : 'none';
  rowsBox.append(adventure, levels, endless, freePlay, howTo, settings);
  paintFocus();
  const info = el('div', 'sow-menu-info', '');
  info.style.gridArea = 'info';
  const foot = el('div', 'sow-menu-foot', '');
  foot.style.gridArea = 'foot';
  panel.append(title, rowsBox, info, foot);
  s.root.append(panel);
  return {
    ...s,
    setInfo(text) {
      info.textContent = text;
    },
    setContinue(text) {
      setVectorText(adventure, text, { tone: 'white' });
    },
    setFooter(text) {
      foot.textContent = text;
    },
    focused: () => focus,
    layout(cssW, cssH, insets) {
      const L = menuLayout(cssW, cssH, insets);
      const p = panel.style;
      p.width = `${L.panel.w}px`;
      p.padding = `${L.pad}px`;
      p.rowGap = `${L.sectionGap}px`;
      if (L.arrangement === 'side') {
        p.gridTemplateColumns = `${L.leftW}px ${L.rightW}px`;
        p.gridTemplateRows = 'auto auto auto';
        p.gridTemplateAreas = '"title rows" "info rows" "foot rows"';
        p.columnGap = `${L.colGap}px`;
        title.style.alignSelf = 'end';
        info.style.alignSelf = 'start';
      } else {
        p.gridTemplateColumns = '1fr';
        p.gridTemplateRows = 'auto';
        p.gridTemplateAreas = '"title" "rows" "info" "foot"';
        p.columnGap = '0px';
        title.style.alignSelf = '';
        info.style.alignSelf = '';
      }
      title.style.fontSize = `${L.titleSize}px`;
      rowsBox.style.gap = `${L.rowGap}px`;
      for (const r of rows) {
        r.style.height = `${L.rowH}px`;
        r.style.minHeight = `${L.rowH}px`;
        r.style.fontSize = `${L.rowSize}px`;
      }
      info.style.fontSize = `${L.infoSize}px`;
      foot.style.fontSize = `${L.footSize}px`;
    },
  };
}
