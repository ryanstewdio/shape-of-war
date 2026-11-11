// Web Audio backend for the boss shot tick (bossTick.ts): one sine blip through a low pass into
// the sfx master, so the effects volume and mute apply. Silent while the context is not running.
import type { BossTickBackend, BossTickParams } from './bossTick';

const FLOOR = 0.0001;

export interface BossTickDeps {
  /** The live context and sfx master, or null before unlock, while suspended or at volume 0. */
  graph(): { ctx: AudioContext; master: GainNode } | null;
}

export function createBossTickBackend(deps: BossTickDeps): BossTickBackend {
  return {
    play(p: BossTickParams): void {
      const g = deps.graph();
      if (!g) return;
      const { ctx, master } = g;
      const t = ctx.currentTime;
      const env = ctx.createGain();
      env.gain.setValueAtTime(p.gain, t);
      env.gain.exponentialRampToValueAtTime(FLOOR, t + p.dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(p.cutoff, t);
      lp.connect(env);
      env.connect(master);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(p.f0, t);
      o.frequency.exponentialRampToValueAtTime(p.f1, t + p.dur);
      o.connect(lp);
      o.onended = (): void => env.disconnect();
      o.start(t);
      o.stop(t + p.dur + 0.005);
    },
  };
}
