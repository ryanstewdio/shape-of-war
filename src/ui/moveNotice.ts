// Move notice: players on a github.io copy are pointed to the new home. Touch only, no storage
// writes, no network calls. The banner reuses the menu's own classes and fonts.
// Placement: a compact strip at the very top of the menu screen, below the top safe area inset, so it
// never sits on the bottom rows (Settings). A close X at its right end removes it for this page load.
// Geometry: the text part is one compact line (about MOVE_NOTICE_LINE_PX high) so it ends above the first
// menu row on the short cover screen. The X is MIN_HIT_PX square and hangs in the right margin, which
// on the cover screen lies outside the rows column (tests/ui/moveNotice.test.ts checks real layouts).
import { button, el, MIN_HIT_PX } from './dom';

export const MOVE_NOTICE_TEXT =
  'Shape Legend has a new home: play.shapelegend.com. Open it there and add it to your home screen. Progress here does not carry over.';
/** Shorter wording for narrow viewports so the strip stays within two lines. */
export const MOVE_NOTICE_SHORT_TEXT = 'New home: play.shapelegend.com. Tap to open it there. Progress here does not carry over.';
export const NEW_HOME_URL = 'https://play.shapelegend.com/';
/** Below this viewport width in CSS px the short wording is shown (the long one needs two lines). */
export const MOVE_NOTICE_NARROW_PX = 1100;
/** Height of the text part when it fits on one line: 6 px padding twice, a 15 px line, a 1 px border twice. */
export const MOVE_NOTICE_LINE_PX = 29;
/** Gap between the strip and the right screen edge, where the X sits. */
export const MOVE_NOTICE_EDGE_PX = 4;
export const MOVE_NOTICE_CLASS = 'sow-move-notice';
export const MOVE_NOTICE_CLOSE_LABEL = 'X';

/** Pure: true only on a github.io host (any copy of the old Pages site). */
export function shouldShowMoveNotice(hostname: string): boolean {
  return hostname.toLowerCase().endsWith('.github.io');
}

/** Pure: the visible wording for a viewport width in CSS px. */
export function moveNoticeText(cssW: number): string {
  return cssW < MOVE_NOTICE_NARROW_PX ? MOVE_NOTICE_SHORT_TEXT : MOVE_NOTICE_TEXT;
}

function viewportWidth(): number {
  return typeof window === 'undefined' || typeof window.innerWidth !== 'number' ? MOVE_NOTICE_NARROW_PX : window.innerWidth;
}

/**
 * Adds one banner to the main menu root when the page is served from github.io. Safe to call more
 * than once: a second call finds the banner and adds nothing. Returns the banner or null. After the
 * close X is tapped the banner is gone until the page reloads (the closed flag is module memory only).
 */
let dismissed = false;

export function addMoveNotice(menuRoot: HTMLElement, hostname: string = typeof location === 'undefined' ? '' : location.hostname): HTMLElement | null {
  if (!shouldShowMoveNotice(hostname) || dismissed) return null;
  const existing = menuRoot.querySelector<HTMLElement>(`.${MOVE_NOTICE_CLASS}`);
  if (existing !== null) return existing;
  const banner = el('div', `${MOVE_NOTICE_CLASS} sow-menu-info`);
  const s = banner.style;
  s.position = 'absolute';
  s.left = '12px';
  s.right = `${MOVE_NOTICE_EDGE_PX}px`;
  s.gap = '4px';
  s.top = 'env(safe-area-inset-top, 0px)';
  s.display = 'flex';
  s.alignItems = 'flex-start';
  s.boxSizing = 'border-box';
  s.opacity = '1';
  const text = button(moveNoticeText(viewportWidth()), () => {
    window.open(NEW_HOME_URL, '_blank', 'noopener');
  });
  text.setAttribute('aria-label', MOVE_NOTICE_TEXT);
  const t = text.style;
  t.flex = '1 1 auto';
  t.minWidth = '0';
  t.height = 'auto';
  t.padding = '6px 10px';
  t.border = '1px solid hsl(185, 90%, 58%)';
  t.borderRadius = '6px';
  t.overflow = 'hidden';
  t.maxHeight = `${MOVE_NOTICE_LINE_PX + 15}px`; // two lines at most
  t.fontSize = '12px';
  t.lineHeight = '1.25';
  t.boxShadow = 'none';
  t.background = 'rgba(6, 22, 40, 0.94)';
  t.textAlign = 'center';
  const close = button(MOVE_NOTICE_CLOSE_LABEL, () => {
    dismissed = true;
    banner.remove();
  });
  close.setAttribute('aria-label', 'Close');
  const c = close.style;
  c.flex = '0 0 auto';
  c.minWidth = `${MIN_HIT_PX}px`;
  c.width = `${MIN_HIT_PX}px`;
  c.minHeight = `${MIN_HIT_PX}px`;
  c.height = 'auto';
  c.padding = '0';
  c.fontSize = '16px';
  c.fontWeight = '700';
  c.border = '1px solid hsl(185, 90%, 58%)';
  c.borderRadius = '6px';
  c.boxShadow = 'none';
  c.background = 'rgba(6, 22, 40, 0.94)';
  banner.append(text, close);
  menuRoot.append(banner);
  return banner;
}

/** Test hook: forget a close so the next addMoveNotice can add the banner again. */
export function resetMoveNoticeForTests(): void {
  dismissed = false;
}
