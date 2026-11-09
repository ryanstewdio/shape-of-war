// Move notice: players on a github.io copy are pointed to the new home. Touch only, no storage
// writes, no network calls. The banner reuses the menu's own classes and fonts.
import { button } from './dom';

export const MOVE_NOTICE_TEXT =
  'Shape Legend has a new home: play.shapelegend.com. Open it there and add it to your home screen. Progress here does not carry over.';
export const NEW_HOME_URL = 'https://play.shapelegend.com/';

/** Pure: true only on a github.io host (any copy of the old Pages site). */
export function shouldShowMoveNotice(hostname: string): boolean {
  return hostname.toLowerCase().endsWith('.github.io');
}

/**
 * Adds one banner to the main menu root when the page is served from github.io. Safe to call more
 * than once: a second call finds the banner and adds nothing. Returns the banner or null.
 */
export function addMoveNotice(menuRoot: HTMLElement, hostname: string = typeof location === 'undefined' ? '' : location.hostname): HTMLElement | null {
  if (!shouldShowMoveNotice(hostname)) return null;
  const existing = menuRoot.querySelector<HTMLElement>('.sow-move-notice');
  if (existing !== null) return existing;
  const banner = button(MOVE_NOTICE_TEXT, () => {
    window.open(NEW_HOME_URL, '_blank', 'noopener');
  });
  banner.classList.add('sow-move-notice', 'sow-menu-info');
  const s = banner.style;
  s.position = 'absolute';
  s.left = '12px';
  s.right = '12px';
  s.bottom = '12px';
  s.height = 'auto';
  s.padding = '8px 12px';
  s.fontSize = '12px';
  s.opacity = '1';
  menuRoot.append(banner);
  return banner;
}
