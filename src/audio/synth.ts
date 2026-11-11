// Synthesised audio (docs/04 section 12, docs/01 section 13). Oscillators and one shared
// white noise buffer only; no audio files. Subscribes to the core bus and never imports
// src/game or src/ui. The AudioContext is created lazily inside the first user gesture.
import { bus, type Bus } from '../core/events';
import { hash01 } from '../core/rng';
import { installGw2, type Gw2Controller } from './gw2';
import { createGw2Backend } from './gw2Synth';
import { installTurboSfx, type TurboController } from './turboSfx';
import { installScrollTick, type ScrollTickController } from './scrollTick';
import { createScrollTickBackend } from './scrollTickSynth';
import { installTimeWarnSfx, type TimeWarnController } from './timeWarnSfx';
import { createTimeWarnBackend } from './timeWarnSynth';
import { createTurboBackend } from './turboSynth';
import { installRippleSfx, type RippleController } from './rippleSfx';
import { createRippleBackend } from './rippleSynth';
import { installBossTick, type BossTickController } from './bossTick';
import { createBossTickBackend } from './bossTickSynth';
import { installStorySfx, type StoryController } from './storySfx';
import { createStoryBackend } from './storySfxSynth';
import {
  clampVolume,
  CUES,
  createRateLimiter,
  createWindowLimiter,
  cueForHit,
  cueForSfx,
  isBigKillColour,
  MAX_VOICES,
  masterGain,
  RATE_LIMITS,
  VOLUME_DEFAULT,
  voiceToSteal,
  WINDOW_LIMITS,
  type CueName,
  type RateLimiter,
  type VoiceDef,
} from './cues';
import { attackSec, buildToneStage, leadCutoffHz, LEAD_LP_Q, needsLeadFilter, noiseBandHz, NOISE_LP_HZ } from './tone';

export type { CueName } from './cues';

const ATTACK = attackSec(0.005);
const FLOOR = 0.0001;
const NOISE_SEC = 1;

interface Voice {
  start: number;
  end: number;
  sources: { stop(when?: number): void }[];
  out?: GainNode;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let volume = VOLUME_DEFAULT;
let voices: Voice[] = [];
const limiters = new Map<CueName, RateLimiter>();

function limiterFor(cue: CueName): RateLimiter | null {
  const rate = RATE_LIMITS[cue];
  const windowMax = WINDOW_LIMITS[cue];
  if (rate === undefined && windowMax === undefined) return null;
  let l = limiters.get(cue);
  if (!l) {
    l = windowMax !== undefined ? createWindowLimiter(windowMax) : createRateLimiter(rate ?? 0);
    limiters.set(cue, l);
  }
  return l;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = Math.floor(c.sampleRate * NOISE_SEC);
  const b = c.createBuffer(1, len, c.sampleRate);
  const data = b.getChannelData(0);
  // Stateless hash, not a PRNG: white enough for explosions and identical every run.
  for (let i = 0; i < len; i++) data[i] = hash01(i, 0x5eed) * 2 - 1;
  noise = b;
  return b;
}

/** Create or resume the AudioContext. Call from a user gesture handler. */
export async function unlockAudio(): Promise<void> {
  if (typeof AudioContext === 'undefined') return;
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = masterGain(volume);
    // v3.5: sfx and music (which feeds this master) pass the master tone stage.
    master.connect(buildToneStage(ctx, ctx.destination).input);
  }
  if (ctx.state !== 'running') {
    try {
      await ctx.resume();
    } catch {
      // Ignore: the next gesture tries again.
    }
  }
  // A one sample silent buffer fully unlocks some Android builds.
  const b = ctx.createBuffer(1, 1, 22050);
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(ctx.destination);
  s.start(0);
}

export interface AudioGraph {
  readonly ctx: AudioContext;
  readonly master: GainNode;
}

/**
 * The lazily created AudioContext and synth master gain, or null before unlockAudio().
 * Additive for the music engine (docs/10 wave A); cue behaviour is unchanged.
 */
export function getAudioGraph(): AudioGraph | null {
  return ctx && master ? { ctx, master } : null;
}

/** Set the volume 0 to 100 (clamped). Returns the applied value. */
export function setVolume(v: number): number {
  volume = clampVolume(v);
  if (ctx && master) master.gain.setTargetAtTime(masterGain(volume), ctx.currentTime, 0.01);
  return volume;
}

export function getVolume(): number {
  return volume;
}

/** Sound effect cues sounding now, sustained GW2 loops included (tests: the 24 voice cap holds). */
export function sfxVoiceCount(): number {
  const now = ctx?.currentTime ?? 0;
  return voices.filter((vc) => vc.end > now).length + loopCount();
}

/** Sustained loops sounding now: GW2 (saw, whirlpools, shield hum) and the Turbo hum (R3). */
function loopCount(): number {
  return gw2Backend.activeLoops() + turboBackend.activeLoops();
}

// GW2 and Turbo effects share the master gain (so the volume setting applies) and the voice cap:
// a sustained loop counts as a voice, and a one shot steals the oldest when the cap is reached.
// Five slots stay reserved for the sustained loops (1 saw, 2 whirlpools, 1 shield hum, 1 Turbo
// hum), so loops that start later cannot push the total over the cap.
const LOOP_RESERVE = 5;
const sfxGraph = (): { ctx: AudioContext; master: GainNode } | null => (ctx && master && ctx.state === 'running' && volume > 0 ? { ctx, master } : null);

function registerOneShot(start: number, end: number, stop: (at: number) => void): void {
  const now = start;
  voices = voices.filter((vc) => vc.end > now);
  for (let steal = voiceToSteal(voices.map((vc) => vc.start), MAX_VOICES - LOOP_RESERVE); steal >= 0; steal = voiceToSteal(voices.map((vc) => vc.start), MAX_VOICES - LOOP_RESERVE)) {
    const old = voices[steal];
    if (old) stopVoice(old, now);
    voices.splice(steal, 1);
  }
  voices.push({ start, end, sources: [{ stop }] });
}

const gw2Backend = createGw2Backend({ graph: sfxGraph, noise: noiseBuffer, registerOneShot });
const turboBackend = createTurboBackend({ graph: sfxGraph, noise: noiseBuffer, registerOneShot });
const rippleBackend = createRippleBackend({ graph: sfxGraph, noise: noiseBuffer, registerOneShot });
const scrollTickBackend = createScrollTickBackend({ graph: sfxGraph });
const bossTickBackend = createBossTickBackend({ graph: sfxGraph });
const storyBackend = createStoryBackend({ graph: sfxGraph });
const timeWarnBackend = createTimeWarnBackend({ graph: sfxGraph });

function stopVoice(vc: Voice, at: number): void {
  for (const s of vc.sources) {
    try {
      s.stop(at);
    } catch {
      // Already stopped.
    }
  }
}

function buildVoice(c: AudioContext, out: AudioNode, d: VoiceDef, t: number): AudioScheduledSourceNode {
  const env = c.createGain();
  env.gain.setValueAtTime(FLOOR, t);
  env.gain.linearRampToValueAtTime(d.gain, t + ATTACK);
  env.gain.exponentialRampToValueAtTime(FLOOR, t + d.dur);
  env.connect(out);
  let src: AudioScheduledSourceNode;
  if (d.wave === 'noise') {
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c);
    n.loop = true;
    src = n;
  } else {
    const o = c.createOscillator();
    o.type = d.wave;
    o.frequency.setValueAtTime(d.f0, t);
    if (d.steps && d.stepSec) {
      d.steps.forEach((f, i) => o.frequency.setValueAtTime(f, t + i * (d.stepSec ?? 0)));
    } else if (d.f1 !== d.f0) {
      o.frequency.exponentialRampToValueAtTime(Math.max(1, d.f1), t + d.dur);
    }
    src = o;
  }
  // v3.5 tone: a noise hit is band limited below 7 kHz; a square or saw without its own filter
  // gets a low pass that tracks its sweep (6x the pitch, capped at 5 kHz).
  let head: AudioNode = env;
  if (d.wave === 'noise' && !(d.filter?.type === 'lowpass' && d.filter.f0 <= NOISE_LP_HZ)) {
    const band = c.createBiquadFilter();
    band.type = 'lowpass';
    band.frequency.value = NOISE_LP_HZ;
    band.connect(head);
    head = band;
  }
  if (d.filter) {
    const f = c.createBiquadFilter();
    f.type = d.filter.type;
    const noisy = d.wave === 'noise';
    f.frequency.setValueAtTime(noisy ? noiseBandHz(d.filter.f0) : d.filter.f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(1, noisy ? noiseBandHz(d.filter.f1) : d.filter.f1), t + d.dur);
    f.connect(head);
    head = f;
  } else if (needsLeadFilter(d.wave)) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = LEAD_LP_Q;
    f.frequency.setValueAtTime(leadCutoffHz(d.f0), t);
    if (d.steps && d.stepSec) {
      const sec = d.stepSec;
      d.steps.forEach((hz, i) => f.frequency.setValueAtTime(leadCutoffHz(hz), t + i * sec));
    } else if (d.f1 !== d.f0) {
      f.frequency.exponentialRampToValueAtTime(leadCutoffHz(d.f1), t + d.dur);
    }
    f.connect(head);
    head = f;
  }
  src.connect(head);
  src.start(t);
  src.stop(t + d.dur + 0.02);
  return src;
}

/** Play a cue now. Silent until unlockAudio has run; rate limited cues may be dropped. */
export function play(cue: CueName): void {
  const c = ctx;
  const m = master;
  if (!c || !m || c.state !== 'running' || volume === 0) return;
  const now = c.currentTime;
  const lim = limiterFor(cue);
  if (lim && !lim.allow(now)) return;
  voices = voices.filter((vc) => vc.end > now);
  // A loop that started since the last cue can leave the list one over: steal until it fits.
  for (let steal = voiceToSteal(voices.map((vc) => vc.start), MAX_VOICES - loopCount()); steal >= 0 && voices.length > 0; steal = voiceToSteal(voices.map((vc) => vc.start), MAX_VOICES - loopCount())) {
    const old = voices[steal];
    if (old) stopVoice(old, now);
    voices.splice(steal, 1);
  }
  const def = CUES[cue];
  const out = c.createGain();
  out.connect(m);
  let end = now;
  const sources: AudioScheduledSourceNode[] = [];
  for (const d of def.voices) {
    sources.push(buildVoice(c, out, d, now));
    end = Math.max(end, now + d.dur + 0.02);
  }
  const vc: Voice = { start: now, end, sources, out };
  const last = sources[sources.length - 1];
  if (last) last.onended = (): void => out.disconnect();
  voices.push(vc);
}

export interface AudioOptions {
  volume: number;
  /** Bus to listen on; defaults to the core bus. */
  bus?: Bus;
}

/**
 * Wire audio: volume, first gesture unlock, visibility suspend, and bus subscriptions.
 * Returns an uninstall function.
 */
export function installAudio(opts: AudioOptions): () => void {
  const b = opts.bus ?? bus;
  setVolume(opts.volume);
  let bigKill = false;
  // A boss death emits 'sim:bossDown' then sfx explode in the same step: the boss death cue
  // replaces that explode, so the small kill sound never doubles it.
  let bossDown = false;
  const gw2: Gw2Controller = installGw2(b, gw2Backend);
  // R3 Turbo: ignition sweep, engine hum, power down sweep (turboSfx.ts).
  const turbo: TurboController = installTurboSfx(b, turboBackend);
  // Tester 2: a quiet retro tick while info screens scroll (scrollTick.ts).
  const scrollTick: ScrollTickController = installScrollTick(b, scrollTickBackend);
  // Tester 3: pond ripple thump and whoosh (rippleSfx.ts).
  const ripple: RippleController = installRippleSfx(b, rippleBackend);
  // Boss shot tick on 'sim:bossHit' (bossTick.ts).
  const bossTick: BossTickController = installBossTick(b, bossTickBackend);
  // P1 story scene cues: reveal, guardian drone, freed chord, panel tick (storySfx.ts).
  const story: StoryController = installStorySfx(b, storyBackend);
  // HUD clock warnings at 60, 30 and the last 10 seconds (timeWarnSfx.ts).
  const timeWarn: TimeWarnController = installTimeWarnSfx(b, timeWarnBackend);
  const offs = [
    gw2.dispose,
    story.dispose,
    ripple.dispose,
    bossTick.dispose,
    turbo.dispose,
    scrollTick.dispose,
    timeWarn.dispose,
    // combat emits fx:kill then sfx explode, so the colour decides the explode sound.
    b.on('fx:kill', (p) => {
      bigKill = isBigKillColour(p.colour);
      bossDown = false;
    }),
    b.on('sfx', (name) => {
      if (name === 'explode' && bossDown) {
        bossDown = false;
        bigKill = false;
        return;
      }
      play(cueForSfx(name, bigKill));
      if (name === 'explode') bigKill = false;
    }),
    b.on('game:start', () => play('levelStart')),
    // v3 boss sound effects. Payload objects are reused by the sim: read the fields here.
    b.on('sim:bossEnter', () => play('bossRumble')),
    b.on('sim:bossDown', () => {
      play('bossDeath');
      bossDown = true;
    }),
    b.on('fx:hit', (p) => {
      const cue = cueForHit(p.kind, p.blocked);
      if (cue !== null) play(cue);
    }),
    b.on('fx:bossShot', () => play('bossShot')),
  ];
  const onGesture = (): void => {
    if (ctx && ctx.state === 'running') return;
    void unlockAudio();
  };
  const gestureOpts: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener('pointerdown', onGesture, gestureOpts);
  const onVisibility = (): void => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    for (const off of offs) off();
    window.removeEventListener('pointerdown', onGesture, gestureOpts);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
