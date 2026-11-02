// Title splash on open (docs/14 item 2): the neon title over black with one slow glow pulse for
// SPLASH_MS, then the boot "Tap to start" screen. A tap skips it. DOM only, no image files: the
// pulse is the shared .sow-splash CSS animation in dom.ts. The tap that skips is a pointerup
// after a pointerdown on the splash itself, so it never falls through to the boot screen.
import { createScreen, el, type Screen } from './dom';
import { GAME_TITLE } from './menu';

/** How long the splash holds before it closes on its own. */
export const SPLASH_MS = 1200;

export interface SplashGate {
  readonly open: boolean;
  /** Milliseconds left. */
  readonly leftMs: number;
}

export const SPLASH_CLOSED: SplashGate = { open: false, leftMs: 0 };

/** Pure: the gate at boot. */
export function armSplash(ms = SPLASH_MS): SplashGate {
  return ms > 0 ? { open: true, leftMs: ms } : SPLASH_CLOSED;
}

/** Pure: advance by dtMs. Closes when the time runs out. */
export function tickSplash(g: SplashGate, dtMs: number): SplashGate {
  if (!g.open) return SPLASH_CLOSED;
  const left = g.leftMs - Math.max(0, dtMs);
  return left > 0 ? { open: true, leftMs: left } : SPLASH_CLOSED;
}

/** Pure: a tap closes the splash at once. */
export function skipSplash(_g: SplashGate): SplashGate {
  return SPLASH_CLOSED;
}

export interface SplashTimer {
  after(ms: number, cb: () => void): void;
}

export interface SplashScreen extends Screen {
  /** Current gate, for tests and main.ts. */
  gate(): SplashGate;
}

/**
 * DOM edge. Opens at once and calls onDone exactly once, on a tap or after SPLASH_MS, whichever
 * comes first. The timer is injected so tests do not wait.
 */
export function createSplashScreen(parent: HTMLElement, onDone: () => void, timer: SplashTimer): SplashScreen {
  const s = createScreen(parent);
  s.root.classList.add('sow-splash');
  s.root.style.background = '#000';
  s.root.append(el('div', 'sow-title sow-splash-title', GAME_TITLE));
  let gate = armSplash();
  const close = (next: SplashGate): void => {
    if (!gate.open) return;
    gate = next;
    if (gate.open) return;
    s.hide();
    onDone();
  };
  let armed = -1;
  s.root.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    armed = e.pointerId;
  });
  s.root.addEventListener('pointerup', (e) => {
    e.preventDefault();
    if (armed !== e.pointerId) return;
    armed = -1;
    close(skipSplash(gate));
  });
  s.root.addEventListener('pointercancel', () => {
    armed = -1;
  });
  s.show();
  timer.after(SPLASH_MS, () => close(tickSplash(gate, SPLASH_MS)));
  return { ...s, gate: () => gate };
}
