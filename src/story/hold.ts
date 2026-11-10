// Story hold (brief ledger-scene-revise). While a story scene is open it owns the screen: the sim
// is held, so presses made now must be dropped, the way the intro card drops them. Pure helpers,
// so the rule is testable without the DOM.
import type { InputState } from '../input/types';

/**
 * Pure: the input for one sim step. The poll always runs, so a press latched while a scene was open
 * (Skip sits where the pause button is) is consumed and gone. While a scene is open the result is
 * `idle`, never the polled state.
 */
export function stepInput(sceneOpen: boolean, poll: () => InputState, idle: InputState): InputState {
  const polled = poll();
  return sceneOpen ? idle : polled;
}

/**
 * Pure: whether a resize driven fold check may pause the run. The call sign keyboard changes the
 * viewport and can flip the aspect class; that must not pause the level behind the scene.
 */
export function resizePauseAllowed(sceneOpen: boolean): boolean {
  return !sceneOpen;
}
