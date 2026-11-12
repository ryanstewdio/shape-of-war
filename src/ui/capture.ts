// Capture mode (Ryan, 2026-11-12): ?dev=1&capture=1 gives a clean screen for scripted gameplay
// clips. It hides only developer readouts and the stick knobs; the sim and input are untouched.
// Pure: no DOM. Rides the dev gate, so it reads the gated query (empty without ?dev=1).

import type { StickVisuals } from '../input/types';
import type { StickCircleLike } from '../render/renderer';

export const CAPTURE_PARAM = 'capture';

/** Pure: true only for capture=1 exactly in the gated query. */
export function isCapture(gatedSearch: string): boolean {
  return new URLSearchParams(gatedSearch).get(CAPTURE_PARAM) === '1';
}

/**
 * Glue: Thumbs stick visuals to Glow stick circles. Knobs only, 0.6 radius, faint fill
 * (G3 feedback: no ring outline under the thumbs). Capture mode draws none; the sticks still work.
 */
export function stickCircles(v: StickVisuals, capture: boolean): StickCircleLike[] {
  if (capture) return [];
  const out: StickCircleLike[] = [];
  for (const sv of [v.move, v.aim]) {
    if (sv === null) continue;
    out.push({ x: sv.knob.x, y: sv.knob.y, r: sv.knob.r * 0.6, alpha: 0.3, filled: true });
  }
  return out;
}

/** What a session shows: each dev readout needs dev on and capture off. */
export interface DevView {
  /** Corner build label, HUD level code, dev fight timer toast and results line. */
  readouts: boolean;
  /** Two finger long press that opens the dev panel. */
  panel: boolean;
}

export function devView(dev: boolean, capture: boolean): DevView {
  const on = dev && !capture;
  return { readouts: on, panel: on };
}
