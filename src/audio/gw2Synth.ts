// Web Audio backend for the GW2 effects (gw2.ts). Native node graphs only: the wobble, pan
// sweep and filter rise are scheduled once at voice start, so nothing runs per frame.
import {
  ARRIVE_GAIN,
  ARRIVE_HI_HZ,
  ARRIVE_SEC,
  ARRIVE_THUD_GAIN,
  NOVA_PAN_DEPTH,
  NOVA_FILTER_HI,
  NOVA_FILTER_LO,
  NOVA_GAIN,
  NOVA_PAN_PERIOD,
  NOVA_RISE_SEC,
  SAW_GAIN,
  SAW_RAMP_IN,
  SAW_WOBBLE_HZ,
  SHATTER_PINGS,
  SHIELD_CHORD,
  SHIELD_HUM_GAIN,
  SHIELD_HUM_HZ,
  SLITHER_SEC,
  sawPair,
  type Gw2Backend,
  type LoopHandle,
  type LoopKind,
  type OneShot,
} from './gw2';
import { attackSec, noiseBandHz, NOISE_LP_HZ } from './tone';

const FLOOR = 0.0001;

export interface Gw2Deps {
  /** The live context and sfx master, or null before unlock (or while the volume is 0). */
  graph(): { ctx: AudioContext; master: GainNode } | null;
  noise(c: AudioContext): AudioBuffer;
  /** Called with each one shot's end time so the shared voice cap counts it. */
  registerOneShot(start: number, end: number, stop: (at: number) => void): void;
}

interface Built {
  /** Output gain the handle ramps. */
  out: GainNode;
  sources: AudioScheduledSourceNode[];
  /** Level the output ramps in to. */
  level: number;
  rampIn: number;
}

function osc(c: AudioContext, type: OscillatorType, hz: number): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  return o;
}

function noiseSrc(c: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const n = c.createBufferSource();
  n.buffer = buf;
  n.loop = true;
  return n;
}

function buildSaw(c: AudioContext, dest: AudioNode): Built {
  const out = c.createGain();
  const wobble = c.createGain();
  wobble.gain.value = 0.5;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2.5;
  const t = c.currentTime;
  // Band pass sweep: a slow up and down, scheduled a few cycles ahead then repeated by an LFO.
  bp.frequency.value = 600;
  const sweep = osc(c, 'triangle', 1 / 0.9);
  const sweepAmt = c.createGain();
  sweepAmt.gain.value = 300;
  sweep.connect(sweepAmt);
  sweepAmt.connect(bp.frequency);
  // 28 Hz amplitude wobble: gain = 0.5 + 0.5 * lfo.
  const lfo = osc(c, 'sine', SAW_WOBBLE_HZ);
  const lfoAmt = c.createGain();
  lfoAmt.gain.value = 0.5;
  lfo.connect(lfoAmt);
  lfoAmt.connect(wobble.gain);
  const [lo, hi] = sawPair();
  const a = osc(c, 'sawtooth', lo);
  const b = osc(c, 'sawtooth', hi);
  a.connect(bp);
  b.connect(bp);
  bp.connect(wobble);
  wobble.connect(out);
  out.connect(dest);
  const sources: AudioScheduledSourceNode[] = [a, b, lfo, sweep];
  for (const s of sources) s.start(t);
  return { out, sources, level: SAW_GAIN, rampIn: SAW_RAMP_IN };
}

function buildNova(c: AudioContext, deps: Gw2Deps, dest: AudioNode, level: number): Built {
  const out = c.createGain();
  const t = c.currentTime;
  const n = noiseSrc(c, deps.noise(c));
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 3;
  lp.frequency.setValueAtTime(NOVA_FILTER_LO, t);
  lp.frequency.exponentialRampToValueAtTime(NOVA_FILTER_HI, t + NOVA_RISE_SEC);
  const body = osc(c, 'sine', 46);
  const bodyGain = c.createGain();
  bodyGain.gain.value = 0.5;
  const pan = c.createStereoPanner();
  const panLfo = osc(c, 'sine', 1 / NOVA_PAN_PERIOD);
  const panAmt = c.createGain();
  panAmt.gain.value = NOVA_PAN_DEPTH;
  panLfo.connect(panAmt);
  panAmt.connect(pan.pan);
  n.connect(lp);
  lp.connect(pan);
  body.connect(bodyGain);
  bodyGain.connect(pan);
  pan.connect(out);
  out.connect(dest);
  const sources: AudioScheduledSourceNode[] = [n, body, panLfo];
  for (const s of sources) s.start(t);
  return { out, sources, level, rampIn: 0.5 };
}

function buildHum(c: AudioContext, dest: AudioNode): Built {
  const out = c.createGain();
  const t = c.currentTime;
  const a = osc(c, 'triangle', SHIELD_HUM_HZ);
  const b = osc(c, 'sine', SHIELD_HUM_HZ * 2.005);
  a.connect(out);
  b.connect(out);
  out.connect(dest);
  a.start(t);
  b.start(t);
  return { out, sources: [a, b], level: SHIELD_HUM_GAIN, rampIn: 0.15 };
}

function makeHandle(c: AudioContext, built: Built, onStop: () => void): LoopHandle {
  const { out, sources } = built;
  const t = c.currentTime;
  out.gain.setValueAtTime(FLOOR, t);
  out.gain.linearRampToValueAtTime(built.level, t + built.rampIn);
  let stopped = false;
  return {
    stop(releaseSec: number): void {
      if (stopped) return;
      stopped = true;
      const now = c.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(Math.max(out.gain.value, FLOOR), now);
      out.gain.linearRampToValueAtTime(0, now + releaseSec);
      for (const s of sources) {
        try {
          s.stop(now + releaseSec + 0.02);
        } catch {
          // Already stopped.
        }
      }
      const last = sources[sources.length - 1];
      if (last) last.onended = (): void => out.disconnect();
      onStop();
    },
  };
}

/** A decaying pitched ping, one oscillator through its own gain. */
function ping(c: AudioContext, dest: AudioNode, hz: number, t: number, dur: number, gain: number, type: OscillatorType): AudioScheduledSourceNode {
  const g = c.createGain();
  g.gain.setValueAtTime(FLOOR, t);
  g.gain.linearRampToValueAtTime(gain, t + attackSec(0.005));
  g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  const o = osc(c, type, hz);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
  return o;
}

function noiseBurst(
  c: AudioContext,
  deps: Gw2Deps,
  dest: AudioNode,
  t: number,
  dur: number,
  gain: number,
  type: BiquadFilterType,
  f0: number,
  f1: number,
): AudioScheduledSourceNode {
  const n = noiseSrc(c, deps.noise(c));
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = type === 'bandpass' ? 4 : 0.7;
  f.frequency.setValueAtTime(noiseBandHz(f0), t);
  f.frequency.exponentialRampToValueAtTime(noiseBandHz(f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(FLOOR, t);
  g.gain.linearRampToValueAtTime(gain, t + attackSec(Math.min(0.02, dur / 4)));
  g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  n.connect(f);
  // v3.5 tone: every noise hit is band limited below 7 kHz, whatever its own filter does.
  const band = c.createBiquadFilter();
  band.type = 'lowpass';
  band.frequency.value = NOISE_LP_HZ;
  f.connect(band);
  band.connect(g);
  g.connect(dest);
  n.start(t);
  n.stop(t + dur + 0.02);
  return n;
}

export function createGw2Backend(deps: Gw2Deps): Gw2Backend & { activeLoops(): number } {
  let active = 0;
  return {
    activeLoops: () => active,
    startLoop(kind: LoopKind, level?: number): LoopHandle | null {
      const g = deps.graph();
      if (!g) return null;
      const dest = g.master;
      const built = kind === 'saw' ? buildSaw(g.ctx, dest) : kind === 'nova' ? buildNova(g.ctx, deps, dest, level ?? NOVA_GAIN) : buildHum(g.ctx, dest);
      active++;
      return makeHandle(g.ctx, built, () => {
        active--;
      });
    },
    playOnce(kind: OneShot): void {
      const g = deps.graph();
      if (!g) return;
      const { ctx: c, master: m } = g;
      const t = c.currentTime;
      const out = c.createGain();
      out.connect(m);
      const srcs: AudioScheduledSourceNode[] = [];
      let dur = 0.3;
      if (kind === 'arrive') {
        dur = ARRIVE_SEC;
        // Rising whoosh: noise through a band pass climbing, then a soft low thud at the end.
        srcs.push(noiseBurst(c, deps, out, t, ARRIVE_SEC * 0.85, ARRIVE_GAIN, 'bandpass', 180, ARRIVE_HI_HZ));
        srcs.push(ping(c, out, 70, t + ARRIVE_SEC * 0.85, ARRIVE_SEC * 0.15 + 0.1, ARRIVE_THUD_GAIN, 'sine'));
        dur = ARRIVE_SEC + 0.12;
      } else if (kind === 'slither') {
        dur = SLITHER_SEC;
        srcs.push(noiseBurst(c, deps, out, t, SLITHER_SEC, 0.12, 'bandpass', 3200, 380));
      } else if (kind === 'shieldUp') {
        dur = 0.7;
        SHIELD_CHORD.forEach((hz, i) => srcs.push(ping(c, out, hz, t + i * 0.025, 0.65 - i * 0.025, 0.045, 'sine')));
      } else {
        dur = 0.6;
        srcs.push(noiseBurst(c, deps, out, t, 0.35, 0.18, 'highpass', 1800, 6000));
        SHATTER_PINGS.forEach((hz, i) => srcs.push(ping(c, out, hz, t + i * 0.06, 0.3, 0.05, 'triangle')));
      }
      const last = srcs[srcs.length - 1];
      if (last) last.onended = (): void => out.disconnect();
      deps.registerOneShot(t, t + dur, (at) => {
        for (const s of srcs) {
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
