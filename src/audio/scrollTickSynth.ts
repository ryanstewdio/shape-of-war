// Web Audio backend for the scroll tick (scrollTick.ts): one square blip through the sfx master,
// so the effects volume and mute apply. Silent while the context is not running.
import { TICK_GAIN, TICK_SEC, type ScrollTickBackend } from './scrollTick';

const FLOOR = 0.0001;

export interface ScrollTickDeps {
  /** The live context and sfx master, or null before unlock, while suspended or at volume 0. */
  graph(): { ctx: AudioContext; master: GainNode } | null;
}

export function createScrollTickBackend(deps: ScrollTickDeps): ScrollTickBackend {
  return {
    tick(hz: number): void {
      const g = deps.graph();
      if (!g) return;
      const { ctx, master } = g;
      const t = ctx.currentTime;
      const env = ctx.createGain();
      env.gain.setValueAtTime(TICK_GAIN, t);
      env.gain.exponentialRampToValueAtTime(FLOOR, t + TICK_SEC);
      env.connect(master);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(hz, t);
      o.connect(env);
      o.onended = (): void => env.disconnect();
      o.start(t);
      o.stop(t + TICK_SEC + 0.005);
    },
  };
}
