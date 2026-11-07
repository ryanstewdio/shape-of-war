// Scroll tick (Tester 2: "some kind of cool retro scrolling noise"): a short 8 bit blip while an
// info screen scrolls. Ledger's src/ui/scrollbar.ts emits 'ui:scroll' { delta, progress } at most
// once per frame; this turns the scrolled distance into ticks, one per TICK_PX, capped in rate.
// Pure parameters plus the event controller; no Web Audio here, so tests run in node.
// scrollTickSynth.ts supplies the backend that makes sound.
import type { Bus } from '../core/events';

/** One tick per this many CSS px scrolled. */
export const TICK_PX = 48;
/** At most this many ticks per second; distance past the cap is dropped, never queued. */
export const MAX_TICKS_PER_SEC = 8;
/** Blip length, seconds (20 to 30 ms). */
export const TICK_SEC = 0.025;
/** Peak level: well under uiTap (0.05) and the geom pickup (0.05). */
export const TICK_GAIN = 0.02;
/** Pitch at the top of the page, Hz (A4). */
export const TICK_BASE_HZ = 440;
/** Major pentatonic steps in semitones; the last is the octave, reached at the bottom. */
export const PENTATONIC_SEMITONES: readonly number[] = [0, 2, 4, 7, 9, 12];

/** Pure: the tick pitch for scroll progress 0 (top) to 1 (bottom), quantised to the pentatonic scale. */
export function tickHz(progress: number): number {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const i = Math.round(p * (PENTATONIC_SEMITONES.length - 1));
  const semis = PENTATONIC_SEMITONES[i] ?? 0;
  return TICK_BASE_HZ * Math.pow(2, semis / 12);
}

/** What the controller needs from the sound side. A no-op when audio is not running. */
export interface ScrollTickBackend {
  tick(hz: number): void;
}

export interface ScrollTickController {
  dispose(): void;
}

/** Wire 'ui:scroll' on `b` to `backend`. `now` is a clock in seconds (injectable for tests). */
export function installScrollTick(b: Bus, backend: ScrollTickBackend, now: () => number = defaultNow): ScrollTickController {
  let acc = 0;
  let last = -Infinity;
  const minGap = 1 / MAX_TICKS_PER_SEC;
  const off = b.on('ui:scroll', (p) => {
    const d = Math.abs(p.delta);
    if (!Number.isFinite(d)) return;
    acc += d;
    if (acc < TICK_PX) return;
    // Whole ticks are consumed either way; what the rate cap refuses is dropped.
    acc %= TICK_PX;
    const t = now();
    if (t - last < minGap) return;
    last = t;
    backend.tick(tickHz(p.progress));
  });
  return { dispose: off };
}

function defaultNow(): number {
  return performance.now() / 1000;
}
