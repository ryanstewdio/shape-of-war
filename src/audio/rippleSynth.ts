// Web Audio backend for the pond ripple sound (rippleSfx.ts). Native node graphs, one shot,
// every voice feeds the sfx master so the effects volume and mute apply, and every voice is
// registered with the shared sfx voice cap. Oscillators and noise only.
import { attackSec } from './tone';
import {
  THUMP_F_END,
  THUMP_F_START,
  THUMP_SEC,
  WHOOSH_DELAY_SEC,
  WHOOSH_F0,
  WHOOSH_F1,
  WHOOSH_Q,
  WHOOSH_SEC,
  WHOOSH_SHARE,
  type RippleBackend,
} from './rippleSfx';

const FLOOR = 0.0001;

export interface RippleDeps {
  graph(): { ctx: AudioContext; master: GainNode } | null;
  noise(c: AudioContext): AudioBuffer;
  registerOneShot(start: number, end: number, stop: (at: number) => void): void;
}

export function createRippleBackend(deps: RippleDeps): RippleBackend {
  return {
    playRipple(gain: number): void {
      const g = deps.graph();
      if (!g) return;
      const c = g.ctx;
      const t = c.currentTime;
      const end = t + WHOOSH_DELAY_SEC + WHOOSH_SEC;
      const out = c.createGain();
      out.connect(g.master);
      // Thump: sine, fast drop.
      const env = c.createGain();
      env.gain.setValueAtTime(FLOOR, t);
      env.gain.linearRampToValueAtTime(gain, t + attackSec(0.01));
      env.gain.exponentialRampToValueAtTime(FLOOR, t + THUMP_SEC);
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(THUMP_F_START, t);
      o.frequency.exponentialRampToValueAtTime(THUMP_F_END, t + THUMP_SEC);
      o.connect(env);
      env.connect(out);
      // Whoosh: noise through a band pass that sweeps down while it fades.
      const ns = c.createBufferSource();
      ns.buffer = deps.noise(c);
      ns.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = WHOOSH_Q;
      const w0 = t + WHOOSH_DELAY_SEC;
      bp.frequency.setValueAtTime(WHOOSH_F0, w0);
      bp.frequency.exponentialRampToValueAtTime(WHOOSH_F1, end);
      const ng = c.createGain();
      ng.gain.setValueAtTime(FLOOR, w0);
      ng.gain.linearRampToValueAtTime(gain * WHOOSH_SHARE, w0 + attackSec(0.15));
      ng.gain.exponentialRampToValueAtTime(FLOOR, end);
      ns.connect(bp);
      bp.connect(ng);
      ng.connect(out);
      ns.onended = (): void => out.disconnect();
      o.start(t);
      o.stop(t + THUMP_SEC + 0.02);
      ns.start(w0);
      ns.stop(end + 0.02);
      deps.registerOneShot(t, end + 0.02, (at) => {
        for (const s of [o, ns]) {
          try {
            s.stop(at);
          } catch {
            // Already stopped.
          }
        }
      });
    },
  };
}
