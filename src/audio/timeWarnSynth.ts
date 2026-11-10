// Web Audio backend for the time warning (timeWarnSfx.ts): square oscillators through the sfx
// master, so the effects volume and mute apply. Silent while the context is not running.
import type { Beep, TimeWarnBackend } from './timeWarnSfx';

const FLOOR = 0.0001;

export interface TimeWarnDeps {
  /** The live context and sfx master, or null before unlock, while suspended or at volume 0. */
  graph(): { ctx: AudioContext; master: GainNode } | null;
}

export function createTimeWarnBackend(deps: TimeWarnDeps): TimeWarnBackend {
  return {
    play(beeps: readonly Beep[]): void {
      const g = deps.graph();
      if (!g) return;
      const { ctx, master } = g;
      const t0 = ctx.currentTime;
      for (const b of beeps) {
        const t = t0 + b.at;
        const env = ctx.createGain();
        env.gain.setValueAtTime(b.gain, t);
        env.gain.setValueAtTime(b.gain, t + b.dur * 0.7);
        env.gain.exponentialRampToValueAtTime(FLOOR, t + b.dur);
        env.connect(master);
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(b.hz, t);
        o.connect(env);
        o.onended = (): void => env.disconnect();
        o.start(t);
        o.stop(t + b.dur + 0.005);
      }
    },
  };
}
