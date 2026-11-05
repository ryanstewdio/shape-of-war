// Pause screen (docs/01 section 10): Resume, Restart level, Settings, Quit to menu.
import { setVectorText } from './vectorFont';
import { button, createScreen, el, type Screen } from './dom';

/** Title of the pause screen, drawn in the pixel font. */
export const PAUSE_TITLE = 'Paused';

export interface PauseActions {
  resume(): void;
  restart(): void;
  settings(): void;
  quit(): void;
}

export function createPauseScreen(parent: HTMLElement, actions: PauseActions): Screen {
  const s = createScreen(parent);
  const row = el('div', 'sow-row');
  row.append(
    button('Resume', actions.resume),
    button('Restart', actions.restart),
    button('Settings', actions.settings),
    button('Quit', actions.quit),
  );
  const title = el('div', 'sow-title');
  setVectorText(title, PAUSE_TITLE, { tone: 'cyan' });
  s.root.append(title, row);
  return s;
}
