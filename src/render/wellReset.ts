// GW4: every render side well state in one place, so a level start, restart or retry (the
// renderer's setArena, which main.ts calls for each new world) clears all of it at once: nova slots
// (and so the whirlpool quads, which draw only for live slots), arrival telegraphs, snake emergence
// trails and tracked nova snakes. The lattice dimples are forces re-added each frame from live wells
// and the lattice itself is rebuilt by setArena, so nothing of an old well survives a reset.
// Pure state only (no pixi.js, no PRNG).
import { arriveAny, resetArriveState, resetEmergeState, emergeAny, type ArriveState, type EmergeState } from './wellArrive';
import { novaSnakeCount, resetNovaSnakeState, type NovaSnakeState } from './novaSnake';
import { novaAny, resetNovaState, type NovaState } from './wellNova';

export interface WellVisualState {
  readonly nova: NovaState;
  readonly arrive: ArriveState;
  readonly emerge: EmergeState;
  readonly snakes: NovaSnakeState;
}

/** Clear every render side well state (new level, restart, retry). */
export function resetWellVisuals(s: WellVisualState): void {
  resetNovaState(s.nova);
  resetArriveState(s.arrive);
  resetEmergeState(s.emerge);
  resetNovaSnakeState(s.snakes);
}

/** Pure: true while any well visual (nova, arrival, emergence or nova snake) is live. */
export function wellVisualsLive(s: WellVisualState): boolean {
  return novaAny(s.nova) || arriveAny(s.arrive) || emergeAny(s.emerge) || novaSnakeCount(s.snakes) > 0;
}
