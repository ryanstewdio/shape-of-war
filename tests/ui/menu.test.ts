// Wave 2 main menu: neon panel over the grid, five stacked framed rows (R2 adds Free Play), warm frame on the focused or
// last used row, info and footer lines, 200 ms entrance stagger, touch only. Pure layout and the
// screen on the fake DOM.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Insets, Rect } from '../../src/input/types';
import { MIN_HIT_PX, UI_CSS } from '../../src/ui/dom';
import { overlaps } from '../../src/ui/hudFrame';
import {
  continueLabel,
  createMenuScreen,
  GAME_TITLE,
  MENU_MARGIN,
  MENU_ROWS,
  MENU_STAGGER_MS,
  menuLayout,
  rowDelay,
  TITLE_EMS,
  type MenuLayout,
} from '../../src/ui/menu';
import { asParent, buttonsLabelled, installFakeDocument, type FakeEl } from './fakeDom';

const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const COVER_VIEWS: Array<[number, number]> = [
  [960, 411],
  [904, 388],
  [1176, 504],
  [840, 360],
];
const MAIN_VIEWS: Array<[number, number]> = [
  [832, 750],
  [794, 716],
  [1092, 984],
  [884, 800],
];
const INSETS: Insets[] = [ZERO, { top: 0, right: 0, bottom: 0, left: 32 }, { top: 24, right: 0, bottom: 16, left: 0 }, { top: 0, right: 48, bottom: 0, left: 48 }];

function layouts(views: Array<[number, number]>): Array<{ L: MenuLayout; W: number; H: number; ins: Insets; name: string }> {
  const out = [];
  for (const [W, H] of views) for (const ins of INSETS) out.push({ L: menuLayout(W, H, ins), W, H, ins, name: `${W}x${H} ${JSON.stringify(ins)}` });
  return out;
}

function inside(a: Rect, b: Rect, eps = 1e-6): boolean {
  return a.x >= b.x - eps && a.y >= b.y - eps && a.x + a.w <= b.x + b.w + eps && a.y + a.h <= b.y + b.h + eps;
}

describe('menu layout', () => {
  const all = [...layouts(COVER_VIEWS), ...layouts(MAIN_VIEWS)];

  it('cover puts the title beside the rows; main stacks everything', () => {
    for (const { L, name } of layouts(COVER_VIEWS)) expect(L.arrangement, name).toBe('side');
    for (const { L, name } of layouts(MAIN_VIEWS)) expect(L.arrangement, name).toBe('stack');
  });

  it('the panel, its outer border and glow fit inside the safe area on both screens', () => {
    for (const { L, W, H, ins, name } of all) {
      expect(L.fits, name).toBe(true);
      const safe = { x: ins.left + MENU_MARGIN, y: ins.top + MENU_MARGIN, w: W - ins.left - ins.right - 2 * MENU_MARGIN, h: H - ins.top - ins.bottom - 2 * MENU_MARGIN };
      expect(inside(L.panel, safe), name).toBe(true);
    }
  });

  it('the panel is centred in the safe area', () => {
    for (const { L, W, H, ins, name } of all) {
      expect(L.panel.x + L.panel.w / 2, name).toBeCloseTo(ins.left + (W - ins.left - ins.right) / 2, 6);
      expect(L.panel.y + L.panel.h / 2, name).toBeCloseTo(ins.top + (H - ins.top - ins.bottom) / 2, 6);
    }
  });

  it('five rows, every one at least 44 px high and wide enough to tap, stacked top to bottom without overlap', () => {
    expect(MIN_HIT_PX).toBe(44);
    for (const { L, name } of all) {
      expect(L.rows, name).toHaveLength(MENU_ROWS);
      expect(MENU_ROWS).toBe(6);
      for (const r of L.rows) {
        expect(r.h, name).toBeGreaterThanOrEqual(MIN_HIT_PX);
        expect(r.w, name).toBeGreaterThanOrEqual(160);
        expect(inside(r, L.panel), name).toBe(true);
      }
      for (let i = 1; i < L.rows.length; i++) {
        const a = L.rows[i - 1] as Rect;
        const b = L.rows[i] as Rect;
        expect(b.y, name).toBeGreaterThanOrEqual(a.y + a.h);
        expect(b.x, name).toBe(a.x);
      }
    }
  });

  it('the main screen gets the roomy 56 px rows; the cover keeps at least the minimum', () => {
    for (const { L, name } of layouts(MAIN_VIEWS)) expect(L.rowH, name).toBe(56);
    for (const { L, name } of layouts(COVER_VIEWS)) expect(L.rowH, name).toBeGreaterThanOrEqual(MIN_HIT_PX);
  });

  it('title, rows, info and footer are separate blocks inside the panel; info sits under the rows (stack) or the title (side, R2) and the footer at the bottom', () => {
    for (const { L, name } of all) {
      const blocks: Array<[string, Rect]> = [['title', L.title], ['info', L.info], ['foot', L.foot], ...L.rows.map((r, i): [string, Rect] => [`row${i}`, r])];
      for (const [id, b] of blocks) expect(inside(b, L.panel), `${name} ${id}`).toBe(true);
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const [ia, a] = blocks[i] as [string, Rect];
          const [ib, b] = blocks[j] as [string, Rect];
          expect(overlaps(a, b), `${name} ${ia} vs ${ib}`).toBe(false);
        }
      }
      const lastRow = L.rows[L.rows.length - 1] as Rect;
      if (L.arrangement === 'side') expect(L.info.y, name).toBeGreaterThanOrEqual(L.title.y + L.title.h);
      else expect(L.info.y, name).toBeGreaterThanOrEqual(lastRow.y + lastRow.h);
      if (L.arrangement === 'stack') expect(L.foot.y, name).toBeGreaterThanOrEqual(lastRow.y + lastRow.h);
      expect(L.foot.y, name).toBeGreaterThanOrEqual(L.info.y + L.info.h);
    }
  });

  it('the title is readable and fits its column', () => {
    for (const { L, name } of all) {
      expect(L.titleSize, name).toBeGreaterThanOrEqual(20);
      expect(L.titleSize * TITLE_EMS, name).toBeLessThanOrEqual(L.title.w + 1e-6);
      expect(L.rowSize, name).toBeGreaterThanOrEqual(15);
      expect(L.footSize, name).toBeGreaterThanOrEqual(10);
    }
  });

  it('degrades without throwing on a tiny or odd viewport', () => {
    const L = menuLayout(0, 0, ZERO);
    expect(L.rows).toHaveLength(MENU_ROWS);
    for (const r of L.rows) expect(r.h).toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(menuLayout(300, 200, ZERO).fits).toBe(false);
  });

  it('rows enter with a 200 ms stagger', () => {
    expect(MENU_STAGGER_MS).toBe(200);
    expect([0, 1, 2, 3, 4].map(rowDelay)).toEqual(['0ms', '200ms', '400ms', '600ms', '800ms']);
  });
});

describe('menu stylesheet', () => {
  const rule = (sel: string): string => {
    const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(UI_CSS)?.[1] ?? '';
  };

  it('a double glowing border: a border, an offset outline and a glow', () => {
    const r = rule('.sow-menu-panel');
    expect(r).toMatch(/border: 2px solid/);
    expect(r).toMatch(/outline: 2px solid/);
    expect(r).toMatch(/outline-offset: 5px/);
    expect(r).toMatch(/box-shadow:/);
    expect(5 + 2 + 4).toBeLessThanOrEqual(MENU_MARGIN); // outline offset and width plus some glow stay in the margin
  });

  it('framed neon rows with a glow, the focused row in a warm orange frame, an entrance animation', () => {
    expect(rule('.sow-btn.sow-menu-row')).toMatch(/border: 2px solid hsl\(185/);
    expect(rule('.sow-btn.sow-menu-row')).toMatch(/box-shadow:/);
    expect(rule('.sow-btn.sow-menu-row')).toMatch(/animation: sow-row-in/);
    expect(rule('.sow-btn.sow-menu-row.sow-focus')).toMatch(/border-color: hsl\(28, 100%/);
    expect(UI_CSS).toMatch(/@keyframes sow-row-in/);
  });

  it('the menu screen dims less than other screens, so the grid shows through', () => {
    expect(rule('.sow-screen.sow-menu')).toMatch(/background: rgba\(2, 4, 12, 0\.38\)/);
  });

  it('no keyboard, mouse or focus handling in the menu source', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../src/ui/menu.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/keydown|keyup|keypress|mousedown|mouseup|click|\.focus\(|tabIndex|gamepad/i);
  });
});

describe('menu screen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function build() {
    const root = installFakeDocument();
    const calls: string[] = [];
    const menu = createMenuScreen(asParent(root), {
      adventure: () => calls.push('adventure'),
      levels: () => calls.push('levels'),
      endless: () => calls.push('endless'),
      freePlay: () => calls.push('freePlay'),
      settings: () => calls.push('settings'),
      howTo: () => calls.push('howTo'),
    });
    const rows = root.all().filter((e) => e.classList.contains('sow-menu-row'));
    return { root, menu, calls, rows };
  }

  const focused = (rows: FakeEl[]): number[] => rows.flatMap((r, i) => (r.classList.contains('sow-focus') ? [i] : []));

  it('builds the title, six rows in order (R2: Free Play), the info line and the footer inside one panel', () => {
    const { root, rows } = build();
    const panel = root.all().find((e) => e.classList.contains('sow-menu-panel'));
    expect(panel).toBeDefined();
    expect(panel?.all().find((e) => e.classList.contains('sow-title'))?.textContent).toBe(GAME_TITLE);
    expect(rows.map((r) => r.textContent)).toEqual(['Adventure', 'Level select', 'Endless', 'Free Play', 'How to', 'Settings']);
    expect(rows.every((r) => r.tag === 'button')).toBe(true);
    expect(panel?.all().some((e) => e.classList.contains('sow-menu-info'))).toBe(true);
    expect(panel?.all().some((e) => e.classList.contains('sow-menu-foot'))).toBe(true);
    expect(root.all().find((e) => e.classList.contains('sow-screen'))?.classList.contains('sow-menu')).toBe(true);
  });

  it('polish r9: every button label is drawn in the pixel font and How to sits directly above Settings', () => {
    const { rows, menu } = build();
    for (const r of rows) {
      expect(r.classList.contains('sow-vec-host'), r.textContent).toBe(true);
      expect(r.all().some((e) => e.tag === 'svg')).toBe(true);
    }
    const labels = rows.map((r) => r.textContent);
    expect(labels.indexOf('How to')).toBe(labels.indexOf('Settings') - 1);
    menu.setContinue('Continue  L3');
    expect(rows[0]?.textContent).toBe('Continue  L3');
    expect(rows[0]?.all().some((e) => e.tag === 'svg')).toBe(true);
  });

  it('every row keeps its callback', () => {
    const { root, calls } = build();
    for (const label of ['Adventure', 'Level select', 'Endless', 'Free Play', 'How to', 'Settings']) buttonsLabelled(root, label)[0]?.tap();
    expect(calls).toEqual(['adventure', 'levels', 'endless', 'freePlay', 'howTo', 'settings']);
  });

  it('Play or Continue is in the warm frame at first; a tap moves the frame to the last row used', () => {
    const { rows, menu } = build();
    expect(focused(rows)).toEqual([0]);
    expect(menu.focused()).toBe(0);
    rows[3]?.tap();
    expect(focused(rows)).toEqual([3]);
    expect(menu.focused()).toBe(3);
    rows[1]?.tap();
    expect(focused(rows)).toEqual([1]);
  });

  it('a press that ends on another pointer does not act or move the frame', () => {
    const { rows, calls } = build();
    rows[2]?.fire('pointerdown', 1);
    rows[2]?.fire('pointerup', 2);
    expect(calls).toEqual([]);
    expect(focused(rows)).toEqual([0]);
  });

  it('rows carry the 200 ms entrance stagger', () => {
    const { rows } = build();
    expect(rows.map((r) => r.style.animationDelay)).toEqual(['0ms', '200ms', '400ms', '600ms', '800ms', '1000ms']);
  });

  it('setContinue, setInfo and setFooter fill their lines', () => {
    const { root, menu, rows } = build();
    menu.setContinue(continueLabel(4));
    menu.setInfo('Level 4  Seed 42');
    menu.setFooter('build abc123');
    expect(rows[0]?.textContent).toBe('Continue  L4');
    expect(root.all().find((e) => e.classList.contains('sow-menu-info'))?.textContent).toBe('Level 4  Seed 42');
    expect(root.all().find((e) => e.classList.contains('sow-menu-foot'))?.textContent).toBe('build abc123');
  });

  it('layout applies the pure geometry: row heights at or above 44 px on both screens', () => {
    for (const [W, H] of [...COVER_VIEWS, ...MAIN_VIEWS]) {
      const { root, menu, rows } = build();
      menu.layout(W, H, ZERO);
      const L = menuLayout(W, H, ZERO);
      const panel = root.all().find((e) => e.classList.contains('sow-menu-panel'));
      expect(panel?.style.width).toBe(`${L.panel.w}px`);
      expect(panel?.style.gridTemplateAreas).toBe(L.arrangement === 'side' ? '"title rows" "info rows" "foot rows"' : '"title" "rows" "info" "foot"');
      for (const r of rows) {
        expect(Number.parseFloat(r.style.minHeight ?? '0')).toBeGreaterThanOrEqual(MIN_HIT_PX);
        expect(r.style.height).toBe(`${L.rowH}px`);
      }
      vi.unstubAllGlobals();
    }
  });
});
