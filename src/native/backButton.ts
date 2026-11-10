import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export type BackResult = 'handled' | 'exit';
export type BackHandler = () => BackResult;

/**
 * Listens for the Android back gesture. Does nothing on the web or iOS.
 * Calls App.exitApp() only when the handler returns 'exit'.
 * Returns an uninstall function.
 */
export function installBackButton(handler: BackHandler): () => void {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return () => {};
  }
  let removed = false;
  let remove: (() => Promise<void>) | null = null;
  void App.addListener('backButton', () => {
    if (handler() === 'exit') void App.exitApp();
  }).then((h) => {
    if (removed) void h.remove();
    else remove = () => h.remove();
  });
  return () => {
    removed = true;
    if (remove) void remove();
    remove = null;
  };
}

export const DOUBLE_BACK_WINDOW_MS = 2000;

export interface DoubleBackState {
  /** Time of the first back on the menu, or null when no confirm is pending. */
  readonly armedAt: number | null;
}

export type DoubleBackOutcome = 'confirm' | 'exit';

export const initialDoubleBack: DoubleBackState = { armedAt: null };

/**
 * Pure double back rule for the main menu. First back returns 'confirm'
 * (show "Press back again to exit"); a second back within the window
 * returns 'exit'. After the window lapses the next back confirms again.
 */
export function pressBackOnMenu(
  state: DoubleBackState,
  now: number,
  windowMs: number = DOUBLE_BACK_WINDOW_MS,
): { state: DoubleBackState; outcome: DoubleBackOutcome } {
  if (state.armedAt !== null && now - state.armedAt <= windowMs) {
    return { state: initialDoubleBack, outcome: 'exit' };
  }
  return { state: { armedAt: now }, outcome: 'confirm' };
}

/** Stateful wrapper over pressBackOnMenu with an injected clock. */
export function createDoubleBack(
  clock: () => number,
  windowMs: number = DOUBLE_BACK_WINDOW_MS,
): () => DoubleBackOutcome {
  let state = initialDoubleBack;
  return () => {
    const r = pressBackOnMenu(state, clock(), windowMs);
    state = r.state;
    return r.outcome;
  };
}
