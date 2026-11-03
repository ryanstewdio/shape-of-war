// Web Audio backend for the Turbo sound effects (turboSfx.ts). Native node graphs only: the
// sweeps and the hum's throb are scheduled once at start, so nothing runs per frame. Every voice
// feeds the sfx master, so the sfx volume (and its master tone stage) applies.
import { attackSec, leadCutoffHz, LEAD_LP_Q, noiseBandHz, NOISE_LP_HZ } from './tone';
import {
  HUM_GAIN,
  HUM_LP_HZ,
  HUM_RAMP_IN,
  HUM_THROB_DEPTH,
  HUM_THROB_HZ,
  humPair,
  sweepNoise,
  sweepParams,
  type TurboBackend,
  type TurboHandle,
  type TurboSweep,
} from './turboSfx';

const FLOOR = 0.0001;

export interface TurboDeps {
  /** The live context and sfx master, or null before unlock (or while the volume is 0). */
  graph(): { ctx: AudioContext; master: GainNode } | null;
  noise(c: AudioContext): AudioBuffer;
  /** Called with each sweep's span so the shared sfx voice cap counts it. */
  registerOneShot(start: number, end: number, stop: (at: number) => void): void;
}

/** A handle that fades `out` to silence over the release and stops every source after it. */
function handle(c: AudioContext, out: GainNode, sources: AudioScheduledSourceNode[], onStop: () => void): TurboHandle {
  let stopped = false;
  const last = sources[sources.length - 1];
  if (last) last.onended = (): void => out.disconnect();
  return {
    stop(releaseSec: number): void {
      if (stopped) return;
      stopped = true;
      const now = c.currentTime;
      const r = Math.max(0.01, releaseSec);
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(Math.max(out.gain.value, FLOOR), now);
      out.gain.linearRampToValueAtTime(0, now + r);
      for (const s of sources) {
        try {
          s.stop(now + r + 0.02);
        } catch {
          // Already stopped.
        }
      }
      onStop();
    },
  };
}

/** The engine hum: two detuned saws through a low pass, an LFO throbbing the level. */
function buildHum(c: AudioContext, dest: AudioNode): { out: GainNode; sources: AudioScheduledSourceNode[] } {
  const t = c.currentTime;
  const out = c.createGain();
  out.gain.setValueAtTime(FLOOR, t);
  out.gain.linearRampToValueAtTime(HUM_GAIN, t + HUM_RAMP_IN);
  const throb = c.createGain();
  throb.gain.value = 1 - HUM_THROB_DEPTH / 2;
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = HUM_THROB_HZ;
  const depth = c.createGain();
  depth.gain.value = HUM_THROB_DEPTH / 2;
  lfo.connect(depth);
  depth.connect(throb.gain);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = HUM_LP_HZ;
  lp.Q.value = 0.8;
  const [lo, hi] = humPair();
  const a = c.createOscillator();
  a.type = 'sawtooth';
  a.frequency.value = lo;
  const b = c.createOscillator();
  b.type = 'sawtooth';
  b.frequency.value = hi;
  a.connect(lp);
  b.connect(lp);
  lp.connect(throb);
  throb.connect(out);
  out.connect(dest);
  const sources: AudioScheduledSourceNode[] = [a, b, lfo];
  for (const s of sources) s.start(t);
  return { out, sources };
}

/** A sweep: a saw gliding f0 to f1 through a tracking low pass, and a band passed noise whoosh. */
function buildSweep(c: AudioContext, deps: TurboDeps, dest: AudioNode, kind: TurboSweep): { out: GainNode; sources: AudioScheduledSourceNode[]; end: number } {
  const t = c.currentTime;
  const p = sweepParams(kind);
  const n = sweepNoise(kind);
  const end = t + p.dur;
  const out = c.createGain();
  out.gain.value = 1;
  out.connect(dest);
  // Tone: saw glide, a sub sine an octave down for body.
  const env = c.createGain();
  env.gain.setValueAtTime(FLOOR, t);
  if (kind === 'ignition') {
    env.gain.linearRampToValueAtTime(p.gain * 0.3, t + attackSec(0.01));
    env.gain.linearRampToValueAtTime(p.gain, t + p.dur * 0.85);
    env.gain.exponentialRampToValueAtTime(FLOOR, end);
  } else {
    env.gain.linearRampToValueAtTime(p.gain, t + attackSec(0.006));
    env.gain.exponentialRampToValueAtTime(FLOOR, end);
  }
  const saw = c.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(p.f0, t);
  saw.frequency.exponentialRampToValueAtTime(p.f1, end);
  const sub = c.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(p.f0 / 2, t);
  sub.frequency.exponentialRampToValueAtTime(p.f1 / 2, end);
  // v3.5 tone: the saw passes a low pass tracking its glide (6x the pitch, at most 5 kHz).
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = LEAD_LP_Q;
  lp.frequency.setValueAtTime(leadCutoffHz(p.f0), t);
  lp.frequency.exponentialRampToValueAtTime(leadCutoffHz(p.f1), end);
  const subGain = c.createGain();
  subGain.gain.value = 0.6;
  saw.connect(lp);
  lp.connect(env);
  sub.connect(subGain);
  subGain.connect(env);
  env.connect(out);
  // Whoosh: noise through a moving band pass, band limited below 7 kHz.
  const ns = c.createBufferSource();
  ns.buffer = deps.noise(c);
  ns.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(noiseBandHz(n.f0), t);
  bp.frequency.exponentialRampToValueAtTime(noiseBandHz(n.f1), end);
  const band = c.createBiquadFilter();
  band.type = 'lowpass';
  band.frequency.value = NOISE_LP_HZ;
  const ng = c.createGain();
  ng.gain.setValueAtTime(FLOOR, t);
  if (kind === 'ignition') {
    ng.gain.linearRampToValueAtTime(n.gain, t + p.dur * 0.85);
  } else {
    ng.gain.linearRampToValueAtTime(n.gain, t + attackSec(0.01));
  }
  ng.gain.exponentialRampToValueAtTime(FLOOR, end);
  ns.connect(bp);
  bp.connect(band);
  band.connect(ng);
  ng.connect(out);
  const sources: AudioScheduledSourceNode[] = [saw, sub, ns];
  for (const s of sources) {
    s.start(t);
    s.stop(end + 0.02);
  }
  return { out, sources, end };
}

export function createTurboBackend(deps: TurboDeps): TurboBackend & { activeLoops(): number } {
  let hums = 0;
  return {
    activeLoops: () => hums,
    startHum(): TurboHandle | null {
      const g = deps.graph();
      if (!g) return null;
      const built = buildHum(g.ctx, g.master);
      hums++;
      return handle(g.ctx, built.out, built.sources, () => {
        hums--;
      });
    },
    playSweep(kind: TurboSweep): TurboHandle | null {
      const g = deps.graph();
      if (!g) return null;
      const t = g.ctx.currentTime;
      const built = buildSweep(g.ctx, deps, g.master, kind);
      const h = handle(g.ctx, built.out, built.sources, () => undefined);
      deps.registerOneShot(t, built.end + 0.02, (at) => {
        for (const s of built.sources) {
          try {
            s.stop(at);
          } catch {
            // Already stopped.
          }
        }
      });
      return h;
    },
  };
}
