// Web Audio backend for the pond ripple sounds (rippleSfx.ts). Native node graphs, one shot,
// every voice feeds the sfx master so the effects volume applies, and every voice is registered
// with the shared sfx voice cap.
import { attackSec, leadCutoffHz, LEAD_LP_Q, NOISE_LP_HZ } from './tone';
import {
  SPLASH_F_END,
  SPLASH_F_PEAK,
  SPLASH_SEC,
  SPLASH_TAIL_F0,
  SPLASH_TAIL_F1,
  SPLASH_TAIL_SEC,
  SPLASH_TAIL_SHARE,
  WARN_GAIN,
  WARN_SEC,
  WARN_STEP_SEC,
  WARN_STEPS,
  type RippleBackend,
} from './rippleSfx';

const FLOOR = 0.0001;

export interface RippleDeps {
  graph(): { ctx: AudioContext; master: GainNode } | null;
  noise(c: AudioContext): AudioBuffer;
  registerOneShot(start: number, end: number, stop: (at: number) => void): void;
}

function register(deps: RippleDeps, start: number, end: number, sources: AudioScheduledSourceNode[]): void {
  deps.registerOneShot(start, end, (at) => {
    for (const s of sources) {
      try {
        s.stop(at);
      } catch {
        // Already stopped.
      }
    }
  });
}

export function createRippleBackend(deps: RippleDeps): RippleBackend {
  return {
    playWarn(): void {
      const g = deps.graph();
      if (!g) return;
      const c = g.ctx;
      const t = c.currentTime;
      const end = t + WARN_SEC;
      const env = c.createGain();
      env.gain.setValueAtTime(FLOOR, t);
      env.gain.linearRampToValueAtTime(WARN_GAIN, t + attackSec(0.01));
      env.gain.setValueAtTime(WARN_GAIN, end - 0.1);
      env.gain.exponentialRampToValueAtTime(FLOOR, end);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = LEAD_LP_Q;
      const o = c.createOscillator();
      o.type = 'square';
      WARN_STEPS.forEach((hz, i) => {
        o.frequency.setValueAtTime(hz, t + i * WARN_STEP_SEC);
        lp.frequency.setValueAtTime(leadCutoffHz(hz), t + i * WARN_STEP_SEC);
      });
      o.connect(lp);
      lp.connect(env);
      env.connect(g.master);
      o.onended = (): void => env.disconnect();
      o.start(t);
      o.stop(end + 0.02);
      register(deps, t, end + 0.02, [o]);
    },
    playSplash(gain: number): void {
      const g = deps.graph();
      if (!g) return;
      const c = g.ctx;
      const t = c.currentTime;
      const end = t + SPLASH_TAIL_SEC;
      const out = c.createGain();
      out.connect(g.master);
      // Bloop: a quick rise to the peak, then a fall.
      const env = c.createGain();
      env.gain.setValueAtTime(FLOOR, t);
      env.gain.linearRampToValueAtTime(gain, t + attackSec(0.012));
      env.gain.exponentialRampToValueAtTime(FLOOR, t + SPLASH_SEC);
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(SPLASH_F_PEAK * 0.5, t);
      o.frequency.exponentialRampToValueAtTime(SPLASH_F_PEAK, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(SPLASH_F_END, t + SPLASH_SEC);
      o.connect(env);
      env.connect(out);
      // Tail: noise through a falling low pass, under the 7 kHz limit.
      const ns = c.createBufferSource();
      ns.buffer = deps.noise(c);
      ns.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(SPLASH_TAIL_F0, NOISE_LP_HZ), t);
      lp.frequency.exponentialRampToValueAtTime(SPLASH_TAIL_F1, end);
      const ng = c.createGain();
      ng.gain.setValueAtTime(FLOOR, t);
      ng.gain.linearRampToValueAtTime(gain * SPLASH_TAIL_SHARE, t + attackSec(0.02));
      ng.gain.exponentialRampToValueAtTime(FLOOR, end);
      ns.connect(lp);
      lp.connect(ng);
      ng.connect(out);
      ns.onended = (): void => out.disconnect();
      o.start(t);
      o.stop(t + SPLASH_SEC + 0.02);
      ns.start(t);
      ns.stop(end + 0.02);
      register(deps, t, end + 0.02, [o, ns]);
    },
  };
}
