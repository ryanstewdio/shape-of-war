// Screen announcements for Chorus (wave 6 contract). main.ts feeds the flow after each change and
// emits 'ui:screen' when the visible screen group changed. Pure: no bus, no DOM.
import type { Events } from '../core/events';
import type { FlowState } from './flow';

export type UiScreen = Events['ui:screen']['screen'];

/**
 * Pure: the announced screen for a flow state. boot is title; menu, level select and the Free Play options (R2) are menu;
 * playing and paused are play (a paused run is still the run); settings and results map to themselves.
 */
export function uiScreenOf(s: FlowState): UiScreen {
  switch (s.screen) {
    case 'boot':
      return 'title';
    case 'menu':
    case 'levels':
    case 'freeplay':
      return 'menu';
    case 'playing':
    case 'paused':
      return 'play';
    case 'settings':
      return 'settings';
    case 'results':
      return 'results';
  }
}

/** Calls `emit` once per change of announced screen, never twice in a row for the same one. */
export function createScreenAnnouncer(emit: (screen: UiScreen) => void): (s: FlowState) => void {
  let last: UiScreen | null = null;
  return (s) => {
    const next = uiScreenOf(s);
    if (next === last) return;
    last = next;
    emit(next);
  };
}
