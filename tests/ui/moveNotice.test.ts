import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_HIT_PX } from '../../src/ui/dom';
import { menuLayout } from '../../src/ui/menu';
import {
  addMoveNotice,
  MOVE_NOTICE_CLASS,
  MOVE_NOTICE_EDGE_PX,
  MOVE_NOTICE_LINE_PX,
  MOVE_NOTICE_SHORT_TEXT,
  MOVE_NOTICE_TEXT,
  moveNoticeText,
  NEW_HOME_URL,
  resetMoveNoticeForTests,
  shouldShowMoveNotice,
} from '../../src/ui/moveNotice';
import { FakeEl } from './fakeDom';

describe('shouldShowMoveNotice', () => {
  it('is true on github.io copies', () => {
    expect(shouldShowMoveNotice('stoopstoop.github.io')).toBe(true);
    expect(shouldShowMoveNotice('ryanstewdio.github.io')).toBe(true);
  });
  it('is false on the new home and local hosts', () => {
    expect(shouldShowMoveNotice('play.shapelegend.com')).toBe(false);
    expect(shouldShowMoveNotice('localhost')).toBe(false);
    expect(shouldShowMoveNotice('github.io.evil.com')).toBe(false);
  });
});

describe('moveNoticeText', () => {
  it('uses the short wording on narrow viewports only', () => {
    expect(moveNoticeText(412)).toBe(MOVE_NOTICE_SHORT_TEXT);
    expect(moveNoticeText(960)).toBe(MOVE_NOTICE_SHORT_TEXT);
    expect(moveNoticeText(1200)).toBe(MOVE_NOTICE_TEXT);
  });
});

/** FakeEl plus the few tree calls the notice uses (the shared fake has no parent or remove). */
class Node extends FakeEl {
  parent: Node | null = null;
  override append(...nodes: FakeEl[]): void {
    for (const n of nodes) (n as Node).parent = this;
    super.append(...nodes);
  }
  remove(): void {
    const i = this.parent?.children.indexOf(this) ?? -1;
    if (i >= 0) this.parent?.children.splice(i, 1);
    this.parent = null;
  }
  querySelector<T>(sel: string): T | null {
    const cls = sel.replace(/^\./, '');
    return (this.all().find((e) => e !== this && e.classList.contains(cls)) as unknown as T | undefined) ?? null;
  }
}

const GH = 'someone.github.io';

describe('addMoveNotice (fake DOM)', () => {
  let root: Node;
  const add = (host = GH): HTMLElement | null => addMoveNotice(root as unknown as HTMLElement, host);
  const banners = (): FakeEl[] => root.children.filter((c) => c.classList.contains(MOVE_NOTICE_CLASS));

  beforeEach(() => {
    resetMoveNoticeForTests();
    vi.stubGlobal('document', { createElement: (tag: string) => new Node(tag) });
    vi.stubGlobal('window', { innerWidth: 960, open: vi.fn() });
    root = new Node('div');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adds one banner at the top with a close control of at least the minimum hit size', () => {
    expect(add()).not.toBeNull();
    expect(banners()).toHaveLength(1);
    const b = banners()[0] as FakeEl;
    expect(b.style['top']).toContain('safe-area-inset-top');
    expect(b.style['bottom']).toBeUndefined();
    const close = b.children.find((c) => c.textContent === 'X') as FakeEl;
    expect(close).toBeDefined();
    expect(parseInt(close.style['minWidth'] ?? '0', 10)).toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(parseInt(close.style['minHeight'] ?? '0', 10)).toBeGreaterThanOrEqual(MIN_HIT_PX);
  });

  it('tapping the text opens the new home and keeps the banner', () => {
    add();
    const text = (banners()[0] as FakeEl).children[0] as FakeEl;
    text.tap();
    expect(window.open).toHaveBeenCalledWith(NEW_HOME_URL, '_blank', 'noopener');
    expect(banners()).toHaveLength(1);
  });

  it('tapping close removes the banner without opening anything', () => {
    add();
    const close = (banners()[0] as FakeEl).children[1] as FakeEl;
    close.tap();
    expect(banners()).toHaveLength(0);
    expect(window.open).not.toHaveBeenCalled();
    expect(add()).toBeNull(); // closed for the rest of this page load
  });

  it('a second call adds nothing', () => {
    const first = add();
    expect(add()).toBe(first);
    expect(banners()).toHaveLength(1);
  });

  it('adds nothing on a non github.io hostname', () => {
    expect(add('play.shapelegend.com')).toBeNull();
    expect(add('localhost')).toBeNull();
    expect(banners()).toHaveLength(0);
  });
});

describe('strip clearance', () => {
  // Text part: MOVE_NOTICE_LINE_PX high from the top inset, full width. X: MIN_HIT_PX square in the
  // right margin. Neither may reach a menu row.
  const cases: Array<[string, number, number, number]> = [
    ['Fold 7 cover, landscape', 960, 412, 0],
    ['Fold 7 cover with a status bar inset', 960, 412, 24],
    ['narrowest cover shape 742x412', 742, 412, 0],
    ['phone landscape 844x390', 844, 390, 0],
    ['phone portrait', 412, 915, 24],
    ['Fold 7 inner', 790, 820, 24],
  ];
  for (const [name, w, h, top] of cases) {
    it(`does not cover a row: ${name}`, () => {
      const L = menuLayout(w, h, { top, right: 0, bottom: 0, left: 0 });
      const firstY = Math.min(...L.rows.map((r) => r.y));
      expect(firstY - top).toBeGreaterThanOrEqual(MOVE_NOTICE_LINE_PX);
      if (L.arrangement === 'stack') {
        expect(firstY - top).toBeGreaterThanOrEqual(MIN_HIT_PX);
      } else {
        const rowsRight = Math.max(...L.rows.map((r) => r.x + r.w));
        expect(w - MOVE_NOTICE_EDGE_PX - MIN_HIT_PX).toBeGreaterThanOrEqual(rowsRight);
      }
    });
  }
});
