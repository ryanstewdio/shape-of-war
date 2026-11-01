// Music voices on Web Audio (SPEC 3.9 item 5). Each note is an oscillator or noise source,
// an envelope gain and an output gain, disconnected when the note ends. At most 16 music
// voices sound at once; a voice over the cap steals the oldest kill accent first, then the
// oldest motif voice, and a bed voice only when nothing else sounds. Kill accents ask for
// room first (accentRoom) and are dropped rather than steal, so in play the bed is never cut.
// The graph is
//   bed voices -> layer buses (bass lowpass, pad lowpass with LFO, perc bandpass, hat
//   highpass) -> master lowpass -> limiter -> music gain (at most 0.35) -> synth master;
//   motif, stinger and accent voices (own filter each) -> motif bus -> limiter;
//   echo sends (v3.4): any voice may send to a short slap delay or a long dotted eighth delay
//   with feedback, both returning into the master lowpass. Echo adds no voices.
// v3.4 voice colour (compose.ts NoteFx): pulse leads with a duty cycle (a periodic wave), a two
// operator FM bell, slides, delayed vibrato on held notes, a chip pad that steps one voice through
// the chord, and filtered noise wind under a space pad.
// The context is a narrow structural type: a real AudioContext satisfies it and tests pass a fake.
import { hash01 } from '../../core/rng';
import type { EchoSend, NoteFx } from './compose';
import { MUSIC_MASTER_MAX } from './intensity';
import { midiToHz } from './scale';
import type { PlannedNote } from './scheduler';
import type { Timbre } from './layers';
import type { Layer } from './track';
import { bedWaveTrim, DEFAULT_TUNE, type BedTimbre } from './tunes';

export const MUSIC_VOICE_CAP = 16;
/** Most voices the composed bed holds at once (pad crossfade at a bar line), see layers tests. */
export const BED_VOICE_MAX = 10;
/** Motif voices that fit beside the bed: one per live kind, 6 kinds at most (roster limit). */
export const MOTIF_VOICE_MAX = MUSIC_VOICE_CAP - BED_VOICE_MAX;
const PRUNE_EPS = 1e-6;

export interface ParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
  setTargetAtTime(v: number, t: number, timeConstant: number): unknown;
  cancelScheduledValues(t: number): unknown;
}

export interface NodeLike {
  connect(dest: NodeLike): unknown;
  connect(dest: ParamLike): unknown;
  disconnect(): void;
}

export interface GainLike extends NodeLike {
  readonly gain: ParamLike;
}

export interface FilterLike extends NodeLike {
  type: BiquadFilterType;
  readonly frequency: ParamLike;
  readonly Q: ParamLike;
}

export interface SourceLike extends NodeLike {
  start(t: number): void;
  stop(t: number): void;
  onended: ((ev: Event) => unknown) | null;
}

/** An opaque periodic wave made by the context. */
export type PeriodicWaveLike = object;

export interface OscLike extends SourceLike {
  type: OscillatorType;
  readonly frequency: ParamLike;
  readonly detune: ParamLike;
  /** Every browser oscillator has it; without it a pulse falls back to a square. */
  setPeriodicWave?(wave: PeriodicWaveLike): void;
}

export interface DelayLike extends NodeLike {
  readonly delayTime: ParamLike;
}

export interface BufferLike {
  getChannelData(channel: number): Float32Array;
}

export interface BufferSourceLike extends SourceLike {
  buffer: BufferLike | null;
  loop: boolean;
}

export interface CompressorLike extends NodeLike {
  readonly threshold: ParamLike;
  readonly knee: ParamLike;
  readonly ratio: ParamLike;
  readonly attack: ParamLike;
  readonly release: ParamLike;
}

export interface MusicContext {
  readonly currentTime: number;
  readonly sampleRate: number;
  createGain(): GainLike;
  createOscillator(): OscLike;
  createBiquadFilter(): FilterLike;
  createBufferSource(): BufferSourceLike;
  createBuffer(channels: number, length: number, sampleRate: number): BufferLike;
  /** Every browser AudioContext has it; a context without it runs with no limiter. */
  createDynamicsCompressor?(): CompressorLike;
  /** Every browser AudioContext has it; a context without it runs with no echo. */
  createDelay?(maxDelayTime: number): DelayLike;
  /** Every browser AudioContext has it; a context without it plays pulses as squares. */
  createPeriodicWave?(real: Float32Array, imag: Float32Array): PeriodicWaveLike;
}

/**
 * The music limiter (v2.1 melody): a hard knee compressor on the summed music, before the music
 * volume, so the louder melodic layer can never clip the bus. The layer budget keeps the sum at
 * or under 1.0 already; the limiter catches partner oscillators and envelope overlaps that add
 * in phase. Pure data.
 */
export const LIMITER = Object.freeze({ thresholdDb: -3, kneeDb: 0, ratio: 20, attackSec: 0.003, releaseSec: 0.12 });

// ---------------------------------------------------------------------------------------
// Voice pool: pure bookkeeping, no Web Audio.

/** Pure: index of the oldest entry `prefer` accepts, or `fallback` when none does. */
export function oldestPreferred<T>(entries: readonly PoolEntry<T>[], prefer: (d: T) => boolean, fallback: number): number {
  let best = -1;
  let bestStart = Infinity;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e || !prefer(e.data) || e.start >= bestStart) continue;
    best = i;
    bestStart = e.start;
  }
  return best >= 0 ? best : fallback;
}

/** Pure: the entry with the lowest rank, the oldest among equal ranks, or null when empty. */
export function lowestRanked<T>(entries: readonly PoolEntry<T>[], rank: (d: T) => number): PoolEntry<T> | null {
  let best: PoolEntry<T> | null = null;
  let bestRank = Infinity;
  for (const e of entries) {
    const r = rank(e.data);
    if (r < bestRank || (r === bestRank && best !== null && e.start < best.start)) {
      best = e;
      bestRank = r;
    }
  }
  return best;
}

export interface PoolEntry<T> {
  readonly start: number;
  readonly end: number;
  readonly data: T;
}

/** Pure: true when an entry sounds at instant x (start inclusive, end exclusive, with slack). */
function liveAt<T>(e: PoolEntry<T>, x: number): boolean {
  return e.start <= x + PRUNE_EPS && e.end > x + PRUNE_EPS;
}

/**
 * Pure: the most entries sounding at once inside [start, end), and the instant it happens.
 * Concurrency only rises at a start time, so checking `start` and every entry start inside
 * the span is exact. `filter` limits the count to some entries.
 */
export function peakIn<T>(
  entries: readonly PoolEntry<T>[],
  start: number,
  end: number,
  filter?: (d: T) => boolean,
): { count: number; at: number } {
  let best = { count: 0, at: start };
  const probe = (x: number): void => {
    let n = 0;
    for (const e of entries) if ((!filter || filter(e.data)) && liveAt(e, x)) n++;
    if (n > best.count) best = { count: n, at: x };
  };
  probe(start);
  for (const e of entries) if (e.start > start && e.start < end - PRUNE_EPS) probe(e.start);
  return best;
}

/**
 * Voice bookkeeping. Voices may be added out of start order (kill accents land inside the
 * already scheduled window), so the cap is checked as the peak concurrency over the new
 * voice's span, not as the number of entries. Entries are kept until the audio clock passes
 * their end.
 */
export class VoicePool<T> {
  private entries: PoolEntry<T>[] = [];

  constructor(readonly cap: number = MUSIC_VOICE_CAP) {}

  /** Forget voices that have ended by `now` (with a microsecond of slack for float rounding). */
  prune(now: number): void {
    this.entries = this.entries.filter((e) => e.end > now + PRUNE_EPS);
  }

  /** Most voices (optionally of some kind) sounding at once inside [start, end). */
  peak(start: number, end: number, filter?: (d: T) => boolean): number {
    return peakIn(this.entries, start, end, filter).count;
  }

  /**
   * Add a voice. While the new voice would push the peak over the cap, the oldest voice
   * sounding at the peak instant (the oldest `prefer` accepts, when there is one) is removed.
   * Returns the removed voices so the caller can silence them.
   */
  insert(start: number, end: number, data: T, prefer?: (d: T) => boolean): T[] {
    const stolen: T[] = [];
    for (let guard = 0; guard <= this.cap; guard++) {
      const pk = peakIn(this.entries, start, end);
      if (pk.count < this.cap) break;
      const live = this.entries.filter((e) => liveAt(e, pk.at));
      const fallback = oldestPreferred(live, () => true, -1);
      const pick = prefer ? oldestPreferred(live, prefer, fallback) : fallback;
      const victim = live[pick];
      if (!victim) break;
      this.entries.splice(this.entries.indexOf(victim), 1);
      stolen.push(victim.data);
    }
    this.entries.push({ start, end, data });
    return stolen;
  }

  /**
   * As insert, but the victim is the voice sounding at the peak instant with the lowest rank,
   * the oldest among equal ranks (v3 boss music: accents, then enemy motifs, then boss, then bed).
   */
  insertRanked(start: number, end: number, data: T, rank: (d: T) => number): T[] {
    const stolen: T[] = [];
    for (let guard = 0; guard <= this.cap; guard++) {
      const pk = peakIn(this.entries, start, end);
      if (pk.count < this.cap) break;
      const live = this.entries.filter((e) => liveAt(e, pk.at));
      const victim = lowestRanked(live, rank);
      if (!victim) break;
      this.entries.splice(this.entries.indexOf(victim), 1);
      stolen.push(victim.data);
    }
    this.entries.push({ start, end, data });
    return stolen;
  }

  /** As insert, returning only the first stolen voice (or null). */
  add(start: number, end: number, data: T, prefer?: (d: T) => boolean): T | null {
    return this.insert(start, end, data, prefer)[0] ?? null;
  }

  /** Remove every voice and return them. */
  drain(): T[] {
    const out = this.entries.map((e) => e.data);
    this.entries = [];
    return out;
  }

  get size(): number {
    return this.entries.length;
  }

  list(): readonly PoolEntry<T>[] {
    return this.entries;
  }
}

// ---------------------------------------------------------------------------------------
// Voice shapes per layer. Times in seconds. Pure data, read by the builders below.

const FLOOR = 0.0001;
const STEAL_TC = 0.008;
const STEAL_STOP = 0.05;

export const BASS_LP_HZ = 240;
export const PAD_LP_HZ = 900;
export const PAD_LFO_HZ = 0.125;
export const PAD_LFO_DEPTH_HZ = 450;
export const PAD_DETUNE_CENTS = 9;
export const HAT_HP_HZ = 7000;
export const KICK_F0 = 120;
export const KICK_F1 = 45;
export const KICK_SWEEP_SEC = 0.12;
export const KICK_DECAY_SEC = 0.32;
export const HAT_DECAY_SEC = 0.045;
export const PERC_DECAY_SEC = 0.14;
export const PERC_BP_HZ = 1700;
export const ARP_DECAY_SEC = 0.11;
/** Most of a sixteenth an arp voice lasts before its 10 ms tail. */
export const ARP_LEN_FRAC = 0.88;
export const PAD_ATTACK_SEC = 0.25;
export const PAD_RELEASE_SEC = 0.4;
/** Slap echo: delay, feedback and return level. */
export const SLAP_SEC = 0.11;
export const SLAP_FEEDBACK = 0.15;
export const SLAP_WET = 0.3;
/** Long echo: a dotted eighth (3 sixteenths) with feedback through a lowpass. */
export const LONG_ECHO_STEPS = 3;
export const LONG_FEEDBACK = 0.42;
export const LONG_WET = 0.35;
export const LONG_LP_HZ = 2400;
/** Longest delay line, seconds (a dotted eighth at 100 BPM is 0.45 s). */
export const ECHO_MAX_SEC = 1;
/** Harmonics in a pulse wave. */
export const PULSE_HARMONICS = 24;
/** FM bell: modulator ratio, start and end modulation index. */
export const BELL_RATIO = 3.5;
export const BELL_INDEX_START = 2.5;
export const BELL_INDEX_END = 0.15;
/** Delayed vibrato: rate, onset and the time it takes to reach full depth. */
export const VIBRATO_HZ = 5.5;
export const VIBRATO_DELAY_SEC = 0.14;
export const VIBRATO_RISE_SEC = 0.2;
/** A slide reaches its pitch in at most this long. */
export const SLIDE_SEC = 0.07;
/** Lead notes longer than this (seconds) hold, with a release, instead of plucking. */
export const LEAD_HOLD_SEC = 0.16;
/** A chip pad is one pulse voice at this share of the pad layer gain. */
export const CHIP_PAD_PEAK = 0.5;
/** Duty of the chip pad's pulse. */
export const CHIP_PAD_DUTY = 0.25;
/** Noise wind: share of the pad note's peak, bandpass Q and its sweep (Hz). */
export const WIND_LEVEL = 0.6;
export const WIND_Q = 3;
export const WIND_LO_HZ = 350;
export const WIND_HI_HZ = 1400;
/** Notes per pad chord, so the pad layer gain is shared by its three notes. */
const PAD_NOTES = 3;
const NOISE_SEC = 1;

/** Pure: how long a voice of this layer lasts, seconds, from its start time. */
export function voiceLength(layer: Layer, dur: number): number {
  switch (layer) {
    case 'pad':
      return dur + PAD_RELEASE_SEC;
    case 'kick':
      return KICK_DECAY_SEC;
    case 'hat':
      return HAT_DECAY_SEC;
    case 'perc':
      return PERC_DECAY_SEC;
    case 'arp':
      // A sixteenth is shorter than a sixteenth at every tune tempo (up to 150 BPM), so arp
      // notes never overlap; a written lead's held note rings for most of its length.
      return dur > LEAD_HOLD_SEC ? dur * 0.92 : Math.min(dur * ARP_LEN_FRAC, ARP_DECAY_SEC) + 0.01;
    case 'bass':
      return dur * 0.9;
  }
}

/** Pure: the envelope peak for one voice of a planned note. */
export function voicePeak(layer: Layer, gain: number): number {
  return layer === 'pad' ? gain / PAD_NOTES : gain;
}

/** Pure: the cosine coefficients of a pulse wave of duty d (0 to 1), index 0 the DC term (0). */
export function pulseCoefficients(duty: number, harmonics: number = PULSE_HARMONICS): Float32Array {
  const d = Math.min(0.95, Math.max(0.05, duty));
  const out = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) out[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * d);
  return out;
}

/** Pure: the long echo's delay for a tempo: a dotted eighth, capped to the delay line. */
export function longEchoSec(stepSec: number): number {
  return Math.min(ECHO_MAX_SEC, Math.max(0.05, LONG_ECHO_STEPS * stepSec));
}

/**
 * Pure: the frequency schedule of a chip arpeggio on one voice: each note for `noteSec`, cycling
 * through the notes for `len` seconds (cycle false: once through, the last note held).
 */
export function arpSchedule(midis: readonly number[], noteSec: number, len: number, cycle: boolean): { at: number; midi: number }[] {
  const out: { at: number; midi: number }[] = [];
  if (midis.length === 0 || !(noteSec > 0)) return out;
  const count = cycle ? Math.max(1, Math.ceil(len / noteSec)) : midis.length;
  for (let i = 0; i < count; i++) {
    const at = i * noteSec;
    if (at >= len && i > 0) break;
    out.push({ at, midi: midis[i % midis.length] ?? 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Engine.

/**
 * bed: the base track. motif: enemy motifs and stingers. accent: kill notes, kill chords, hit
 * ticks and deflects. boss: the boss motif and the boss stingers (v3).
 */
export type VoiceClass = 'bed' | 'motif' | 'accent' | 'boss';

/**
 * Who loses a voice first when the pool is full: accents, then enemy motifs, then boss voices,
 * then the bed (docs/13 SPEC 3.9 item 5: boss voices steal enemy motif voices first).
 */
export const STEAL_RANK: Readonly<Record<VoiceClass, number>> = { accent: 0, motif: 1, boss: 2, bed: 3 };

/** Most boss voices at once: the motif's main line plus one per phase, stingers included (docs/13). */
export const BOSS_VOICE_MAX = 3;
/** Enemy motif voices beside a boss: the bed, the boss and the enemy motifs share the 16. */
export const ENEMY_MOTIF_SLOTS_WITH_BOSS = MOTIF_VOICE_MAX - BOSS_VOICE_MAX;

/** Voice spans for tests and the debug overlay: a start, and a cut when a voice is stolen. */
export interface VoiceTrace {
  start(id: number, cls: VoiceClass, start: number, end: number, scheduledAt: number): void;
  cut(id: number, at: number): void;
}

export interface EngineOptions {
  readonly trace?: VoiceTrace;
}

interface Voice {
  id: number;
  cls: VoiceClass;
  sources: SourceLike[];
  nodes: NodeLike[];
  out: GainLike;
}

/** A motif or stinger note for the engine: absolute audio time, seconds, gain already mixed. */
export interface VoiceNote {
  readonly time: number;
  /** Seconds; the voice is silent at time + dur. */
  readonly dur: number;
  readonly midi: number;
  /** Glide start pitch, or null. */
  readonly fromMidi: number | null;
  readonly gain: number;
  readonly timbre: Timbre;
  /** Echo send (v3.4 kill variation). Default none. */
  readonly echo?: EchoSend;
  /** A fast arpeggio the voice steps through once, last note held (v3.4 kill arpeggio). */
  readonly arp?: readonly number[];
  /** Seconds per arpeggio note. */
  readonly arpSec?: number;
}

export interface VoiceShape {
  readonly attack: number;
  readonly release: number;
  readonly glide: number;
  /** Envelope peak per oscillator. */
  readonly peak: number;
}

/** Pure: envelope and glide times for a motif voice, fitted inside its duration. */
export function voiceShape(n: VoiceNote): VoiceShape {
  const len = Math.max(0.01, n.dur);
  const attack = Math.min(n.timbre.attack, len * 0.3);
  const release = Math.max(0.004, Math.min(n.timbre.release, len - attack - 0.002));
  const glide = n.fromMidi === null ? 0 : Math.min(n.timbre.glideSec, len * 0.6);
  const peak = n.gain / (n.timbre.partner ? 2 : 1);
  return { attack, release, glide, peak };
}

const isMotif = (v: Voice): boolean => v.cls === 'motif';
const isBoss = (v: Voice): boolean => v.cls === 'boss';
const stealRank = (v: Voice): number => STEAL_RANK[v.cls];

/** Voices kept free for a stinger, which can arrive at any moment and is never dropped. */
export const STINGER_RESERVE = 1;

/** A voice that will sound but is not scheduled yet: bed and motif notes past the horizon. */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/**
 * Pure: free voices for kill accents over [t, t + len). Counts the peak of every voice already
 * scheduled plus every bed and motif note that will start in the span but is not scheduled
 * yet (the track is composed, so it is known), and keeps STINGER_RESERVE free. Accents only
 * take what is left, so they never force a steal.
 */
export function accentRoomFor<T>(scheduled: readonly PoolEntry<T>[], upcoming: readonly Span[], t: number, len: number): number {
  const all: PoolEntry<null>[] = [];
  for (const e of scheduled) all.push({ start: e.start, end: e.end, data: null });
  for (const u of upcoming) all.push({ start: u.start, end: u.end, data: null });
  const peak = peakIn(all, t, t + Math.max(0.01, len)).count;
  return Math.max(0, MUSIC_VOICE_CAP - STINGER_RESERVE - peak);
}

export interface MusicEngine {
  /** Schedule one planned bed note on the audio clock, with the active tune's bed waves (default the original). */
  play(n: PlannedNote, bed?: BedTimbre): void;
  /**
   * Schedule one motif, stinger (class 'motif', the default), kill accent (class 'accent') or
   * boss voice (class 'boss'). When the pool is full the oldest accent is stolen first, then the
   * oldest enemy motif voice, then the oldest boss voice, then the bed (STEAL_RANK).
   */
  playVoice(n: VoiceNote, cls?: 'motif' | 'accent' | 'boss'): void;
  /** Voices kill accents may take over [t, t + len), given the notes not scheduled yet. */
  accentRoom(t: number, len: number, upcoming: readonly Span[]): number;
  /** Set the long echo to a dotted eighth of this sixteenth length (a no op when unchanged). */
  setStepSec(sec: number): void;
  /** Music master gain, clamped to 0 to 0.35, ramped from the current time. */
  setMaster(gain: number): void;
  /** Master lowpass cutoff, Hz, ramped from the current time. */
  setCutoff(hz: number): void;
  /** Fade out and stop every voice, including notes scheduled ahead. */
  silence(): void;
  /** Silence and disconnect everything. The engine is unusable afterwards. */
  dispose(): void;
  readonly voiceCount: number;
  /** Voices in the pool that are motifs or stingers. */
  readonly motifVoiceCount: number;
  /** Most boss voices that will sound at once from now on. */
  readonly bossVoiceCount: number;
  /** Voices stolen since creation, split by the class that lost the voice. */
  readonly steals: Readonly<Record<VoiceClass, number>>;
}

function safeStop(s: SourceLike, t: number): void {
  try {
    s.stop(t);
  } catch {
    // Already stopped.
  }
}

function disconnectAll(nodes: readonly NodeLike[]): void {
  for (const n of nodes) {
    try {
      n.disconnect();
    } catch {
      // Already disconnected.
    }
  }
}

/** One noise buffer per context, built once at engine creation (never during a tick). */
const noiseCache = new WeakMap<MusicContext, BufferLike>();

function noiseFor(ctx: MusicContext): BufferLike {
  const hit = noiseCache.get(ctx);
  if (hit) return hit;
  const len = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SEC));
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = b.getChannelData(0);
  // Stateless hash, not a PRNG, salted apart from the sfx noise.
  for (let i = 0; i < len; i++) data[i] = hash01(i, 0x6d75) * 2 - 1;
  noiseCache.set(ctx, b);
  return b;
}

function filter(ctx: MusicContext, type: BiquadFilterType, hz: number, q = 0.707): FilterLike {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

/** The limiter node with LIMITER settings, or null when the context cannot make one. */
function makeLimiter(ctx: MusicContext): CompressorLike | null {
  if (typeof ctx.createDynamicsCompressor !== 'function') return null;
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = LIMITER.thresholdDb;
  c.knee.value = LIMITER.kneeDb;
  c.ratio.value = LIMITER.ratio;
  c.attack.value = LIMITER.attackSec;
  c.release.value = LIMITER.releaseSec;
  return c;
}

export function createMusicEngine(ctx: MusicContext, destination: NodeLike, masterGain = 0, opts: EngineOptions = {}): MusicEngine {
  const pool = new VoicePool<Voice>(MUSIC_VOICE_CAP);
  const trace = opts.trace ?? null;
  const out = ctx.createGain();
  out.gain.value = Math.min(MUSIC_MASTER_MAX, Math.max(0, masterGain));
  const master = filter(ctx, 'lowpass', 600);
  const bassBus = filter(ctx, 'lowpass', BASS_LP_HZ);
  const padBus = filter(ctx, 'lowpass', PAD_LP_HZ, 1.2);
  const hatBus = filter(ctx, 'highpass', HAT_HP_HZ);
  const percBus = filter(ctx, 'bandpass', PERC_BP_HZ, 0.9);
  // Bed and melody meet in the limiter (when the context has one), then the music volume.
  const limiter = makeLimiter(ctx);
  const sum: NodeLike = limiter ?? out;
  if (limiter) limiter.connect(out);
  master.connect(sum);
  out.connect(destination);
  bassBus.connect(master);
  padBus.connect(master);
  hatBus.connect(master);
  percBus.connect(master);
  // Motifs, stingers and accents carry their own filters and skip the threat lowpass, so a lone
  // enemy's motif is audible at low threat.
  const motifBus = ctx.createGain();
  motifBus.gain.value = 1;
  motifBus.connect(sum);
  // One slow LFO shared by every pad note, so the filter sweep is continuous across chords.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = PAD_LFO_HZ;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = PAD_LFO_DEPTH_HZ;
  lfo.connect(lfoDepth);
  lfoDepth.connect(padBus.frequency);
  lfo.start(ctx.currentTime);
  const graph: NodeLike[] = [lfo, lfoDepth, bassBus, padBus, hatBus, percBus, motifBus, master, out];
  if (limiter) graph.push(limiter);
  // Echo buses, built once (never during a tick). They return into the master lowpass.
  let slapIn: NodeLike | null = null;
  let longIn: NodeLike | null = null;
  let longDelay: DelayLike | null = null;
  let echoStep = 0;
  if (typeof ctx.createDelay === 'function') {
    const mk = (sec: number, fb: number, wet: number, lpHz: number | null): { input: GainLike; delay: DelayLike } => {
      const input = ctx.createGain();
      input.gain.value = 1;
      const delay = (ctx.createDelay as (m: number) => DelayLike)(ECHO_MAX_SEC);
      delay.delayTime.value = sec;
      const feedback = ctx.createGain();
      feedback.gain.value = fb;
      const ret = ctx.createGain();
      ret.gain.value = wet;
      input.connect(delay);
      const tail: NodeLike = lpHz === null ? delay : filter(ctx, 'lowpass', lpHz);
      if (tail !== delay) {
        delay.connect(tail);
        graph.push(tail);
      }
      tail.connect(feedback);
      feedback.connect(delay);
      tail.connect(ret);
      ret.connect(master);
      graph.push(input, delay, feedback, ret);
      return { input, delay };
    };
    slapIn = mk(SLAP_SEC, SLAP_FEEDBACK, SLAP_WET, null).input;
    const long = mk(longEchoSec(DEFAULT_TUNE.stepSec), LONG_FEEDBACK, LONG_WET, LONG_LP_HZ);
    longIn = long.input;
    longDelay = long.delay;
    echoStep = DEFAULT_TUNE.stepSec;
  }
  // Pulse waves by duty, made on first use (a handful per session).
  const pulses = new Map<number, PeriodicWaveLike>();
  const pulseFor = (duty: number): PeriodicWaveLike | null => {
    if (typeof ctx.createPeriodicWave !== 'function') return null;
    const hit = pulses.get(duty);
    if (hit) return hit;
    const real = pulseCoefficients(duty);
    const w = ctx.createPeriodicWave(real, new Float32Array(real.length));
    pulses.set(duty, w);
    return w;
  };
  const echoBus = (e: EchoSend | undefined): NodeLike | null => (e === 1 ? slapIn : e === 2 ? longIn : null);
  const noise = noiseFor(ctx);
  let disposed = false;
  let nextId = 1;
  const stealCount: Record<VoiceClass, number> = { bed: 0, motif: 0, accent: 0, boss: 0 };

  const busFor = (layer: Layer): NodeLike => {
    if (layer === 'bass') return bassBus;
    if (layer === 'pad') return padBus;
    if (layer === 'hat') return hatBus;
    if (layer === 'perc') return percBus;
    return master;
  };

  function osc(type: OscillatorType, hz: number, t: number): OscLike {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    return o;
  }

  /** A pulse oscillator of a duty (a square without periodic waves). */
  function pulse(duty: number, hz: number, t: number): OscLike {
    const o = osc('square', hz, t);
    const w = duty === 0.5 ? null : pulseFor(duty);
    if (w !== null && typeof o.setPeriodicWave === 'function') o.setPeriodicWave(w);
    return o;
  }

  /** Slide an oscillator (started at the pitch it slides from) into `hz`. */
  function slide(o: OscLike, hz: number, t: number, len: number): void {
    o.frequency.exponentialRampToValueAtTime(hz, t + Math.min(SLIDE_SEC, len * 0.3));
  }

  /** Delayed vibrato on an oscillator's detune: an LFO source and its depth node. */
  function vibrato(o: OscLike, cents: number, t: number, len: number, sources: SourceLike[], chain: NodeLike[]): void {
    const on = t + VIBRATO_DELAY_SEC;
    if (!(cents > 0) || len <= VIBRATO_DELAY_SEC + 0.05) return;
    const l = osc('sine', VIBRATO_HZ, t);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, on);
    depth.gain.linearRampToValueAtTime(cents, Math.min(t + len, on + VIBRATO_RISE_SEC));
    l.connect(depth);
    depth.connect(o.detune);
    sources.push(l);
    chain.push(depth);
  }

  /** Step one oscillator through a list of pitches (a chip arpeggio). */
  function stepPitches(o: OscLike, midis: readonly number[], noteSec: number, t: number, len: number, cycle: boolean): void {
    for (const e of arpSchedule(midis, noteSec, len, cycle)) o.frequency.setValueAtTime(midiToHz(e.midi), t + e.at);
  }

  /** A two operator FM bell: a sine carrier, a sine modulator at BELL_RATIO whose index decays. */
  function bell(hz: number, t: number, len: number, sources: SourceLike[], chain: NodeLike[]): OscLike {
    const car = osc('sine', hz, t);
    const mod = osc('sine', hz * BELL_RATIO, t);
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(hz * BELL_INDEX_START, t);
    idx.gain.exponentialRampToValueAtTime(Math.max(1, hz * BELL_INDEX_END), t + Math.max(0.05, len));
    mod.connect(idx);
    idx.connect(car.frequency);
    sources.push(car, mod);
    chain.push(idx);
    return car;
  }

  /** Filtered noise wind under a pad: a swept bandpass on the noise loop, into the voice env. */
  function wind(env: GainLike, t: number, len: number, sources: SourceLike[], chain: NodeLike[]): void {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = filter(ctx, 'bandpass', WIND_LO_HZ, WIND_Q);
    bp.frequency.setValueAtTime(WIND_LO_HZ, t);
    bp.frequency.linearRampToValueAtTime(WIND_HI_HZ, t + len * 0.5);
    bp.frequency.linearRampToValueAtTime(WIND_LO_HZ, t + len);
    const lvl = ctx.createGain();
    lvl.gain.value = WIND_LEVEL;
    src.connect(bp);
    bp.connect(lvl);
    lvl.connect(env);
    sources.push(src);
    chain.push(bp, lvl);
  }

  function envelope(peak: number, t: number, attack: number, hold: number, release: number): GainLike {
    const g = ctx.createGain();
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.linearRampToValueAtTime(Math.max(FLOOR, peak), t + attack);
    if (hold > attack) g.gain.setValueAtTime(Math.max(FLOOR, peak), t + hold);
    g.gain.exponentialRampToValueAtTime(FLOOR, t + Math.max(hold, attack) + release);
    return g;
  }

  function sourcesFor(n: PlannedNote, t: number, bed: BedTimbre): SourceLike[] {
    const hz = n.midi === null ? 0 : midiToHz(n.midi);
    switch (n.layer) {
      case 'bass':
        return [osc(bed.bass, hz, t)];
      case 'arp':
        return [osc(bed.arp, hz, t)];
      case 'pad': {
        const a = osc(bed.pad, hz, t);
        const b = osc(bed.pad, hz, t);
        a.detune.setValueAtTime(-bed.padDetune, t);
        b.detune.setValueAtTime(bed.padDetune, t);
        return [a, b];
      }
      case 'kick': {
        const k = osc('sine', KICK_F0, t);
        k.frequency.exponentialRampToValueAtTime(KICK_F1, t + KICK_SWEEP_SEC);
        return [k];
      }
      case 'hat':
      case 'perc': {
        const s = ctx.createBufferSource();
        s.buffer = noise;
        s.loop = true;
        return [s];
      }
    }
  }

  function envFor(n: PlannedNote, t: number, len: number, bed: BedTimbre): GainLike {
    // A brighter bed wave than the original track's is pulled back to its loudness (tunes.ts).
    const peak = voicePeak(n.layer, n.gain * bedWaveTrim(n.layer, bed));
    switch (n.layer) {
      case 'pad':
        return envelope(peak / 2, t, PAD_ATTACK_SEC, n.dur, PAD_RELEASE_SEC);
      case 'bass':
        return envelope(peak, t, 0.006, len * 0.5, len * 0.5);
      default:
        return envelope(peak, t, 0.002, 0, len - 0.002);
    }
  }

  function steal(v: Voice, now: number): void {
    v.out.gain.cancelScheduledValues(now);
    v.out.gain.setTargetAtTime(0, now, STEAL_TC);
    for (const s of v.sources) safeStop(s, now + STEAL_STOP);
    trace?.cut(v.id, now + STEAL_STOP);
  }

  /**
   * Wire sources into env, env into a fresh output gain, the output into `bus`, add the voice
   * to the pool (counting from t to t + len, the audible span) and start it. The pool is
   * pruned at the audio clock, not at t, because accents can land before notes already
   * scheduled ahead.
   */
  function launch(cls: VoiceClass, sources: SourceLike[], chain: NodeLike[], env: GainLike, bus: NodeLike, t: number, len: number, echo?: EchoSend): void {
    const now = ctx.currentTime;
    const vout = ctx.createGain();
    vout.gain.value = 1;
    env.connect(vout);
    vout.connect(bus);
    const send = echoBus(echo);
    if (send !== null) vout.connect(send);
    const nodes: NodeLike[] = [...sources, ...chain, env, vout];
    const voice: Voice = { id: nextId++, cls, sources, nodes, out: vout };
    pool.prune(now);
    for (const stolen of pool.insertRanked(t, t + len, voice, stealRank)) {
      stealCount[stolen.cls] += 1;
      steal(stolen, now);
    }
    trace?.start(voice.id, cls, t, t + len, now);
    for (const s of sources) {
      s.start(t);
      s.stop(t + len + 0.02);
    }
    const last = sources[sources.length - 1];
    if (last) last.onended = (): void => disconnectAll(nodes);
  }

  /** A bed lead or pad note with v3.4 colour (compose.ts NoteFx). */
  function playColoured(n: PlannedNote, f: NoteFx, bed: BedTimbre): void {
    const t = Math.max(ctx.currentTime, n.time);
    const len = voiceLength(n.layer, n.dur);
    const hz = n.midi === null ? 0 : midiToHz(n.midi);
    const sources: SourceLike[] = [];
    const chain: NodeLike[] = [];
    const trim = bedWaveTrim(n.layer, bed);
    let env: GainLike;
    let bus: NodeLike;
    if (n.layer === 'pad' && f.chord !== null) {
      // Chip pad: one pulse voice stepping through the chord, straight to the master.
      const o = pulse(CHIP_PAD_DUTY, hz, t);
      stepPitches(o, f.chord, f.chordSec, t, len, true);
      sources.push(o);
      env = envelope(n.gain * trim * CHIP_PAD_PEAK, t, 0.01, n.dur, PAD_RELEASE_SEC);
      o.connect(env);
      bus = master;
    } else if (n.layer === 'pad') {
      const peak = voicePeak('pad', n.gain * trim) / 2;
      env = envelope(peak, t, PAD_ATTACK_SEC, n.dur, PAD_RELEASE_SEC);
      for (const d of [-bed.padDetune, bed.padDetune]) {
        const o = osc(bed.pad, hz, t);
        o.detune.setValueAtTime(d, t);
        o.connect(env);
        sources.push(o);
      }
      if (f.wind) wind(env, t, len, sources, chain);
      bus = padBus;
    } else {
      const peak = n.gain * trim;
      const held = n.dur > LEAD_HOLD_SEC;
      if (f.bell) {
        env = envelope(peak, t, 0.003, 0, len - 0.003);
        const car = bell(hz, t, len, sources, chain);
        car.connect(env);
      } else {
        env = held ? envelope(peak, t, 0.005, len * 0.7, len * 0.3) : envelope(peak, t, 0.002, 0, len - 0.002);
        const startHz = f.slideFrom === null ? hz : midiToHz(f.slideFrom);
        const o = f.duty > 0 ? pulse(f.duty, startHz, t) : osc(bed.arp, startHz, t);
        if (f.slideFrom !== null) slide(o, hz, t, len);
        vibrato(o, f.vibrato, t, len, sources, chain);
        sources.unshift(o);
        o.connect(env);
      }
      bus = master;
    }
    launch('bed', sources, chain, env, bus, t, len, f.echo);
  }

  return {
    play(n: PlannedNote, bed: BedTimbre = DEFAULT_TUNE.bed): void {
      if (disposed || !(n.gain > 0)) return;
      if (n.fx !== undefined && (n.layer === 'arp' || n.layer === 'pad')) {
        playColoured(n, n.fx, bed);
        return;
      }
      const t = Math.max(ctx.currentTime, n.time);
      const len = voiceLength(n.layer, n.dur);
      const env = envFor(n, t, len, bed);
      const sources = sourcesFor(n, t, bed);
      for (const s of sources) s.connect(env);
      launch('bed', sources, [], env, busFor(n.layer), t, len);
    },
    playVoice(n: VoiceNote, cls: 'motif' | 'accent' | 'boss' = 'motif'): void {
      if (disposed || !(n.gain > 0) || !(n.dur > 0)) return;
      const t = Math.max(ctx.currentTime, n.time);
      const sh = voiceShape(n);
      const len = Math.max(0.01, n.dur);
      const tb = n.timbre;
      const hz = midiToHz(n.midi);
      const f = filter(ctx, tb.filter, tb.filterHz, tb.q);
      const env = envelope(sh.peak, t, sh.attack, len - sh.release, sh.release);
      const mk = (wave: OscillatorType, detune: number): OscLike => {
        const o = ctx.createOscillator();
        o.type = wave;
        if (n.fromMidi !== null && sh.glide > 0) {
          o.frequency.setValueAtTime(midiToHz(n.fromMidi), t);
          o.frequency.exponentialRampToValueAtTime(hz, t + sh.glide);
        } else {
          o.frequency.setValueAtTime(hz, t);
        }
        if (detune !== 0) o.detune.setValueAtTime(detune, t);
        o.connect(f);
        return o;
      };
      const oscs: OscLike[] = [mk(tb.wave, 0)];
      if (tb.partner) oscs.push(mk(tb.partner.wave, tb.partner.detune));
      const arp = n.arp;
      if (arp !== undefined && arp.length > 0) {
        // A fast arpeggio on the one voice: the oscillators step through the notes together.
        const sec = n.arpSec ?? len / arp.length;
        for (const o of oscs) stepPitches(o, arp, sec, t, len, false);
      }
      const sources: SourceLike[] = oscs;
      f.connect(env);
      launch(cls, sources, [f], env, motifBus, t, len, n.echo);
    },
    accentRoom(t: number, len: number, upcoming: readonly Span[]): number {
      if (disposed) return 0;
      pool.prune(ctx.currentTime);
      return accentRoomFor(pool.list(), upcoming, t, len);
    },
    setStepSec(sec: number): void {
      if (disposed || longDelay === null || !(sec > 0) || sec === echoStep) return;
      echoStep = sec;
      longDelay.delayTime.setTargetAtTime(longEchoSec(sec), ctx.currentTime, 0.05);
    },
    setMaster(gain: number): void {
      if (disposed) return;
      const g = Math.min(MUSIC_MASTER_MAX, Math.max(0, Number.isFinite(gain) ? gain : 0));
      out.gain.setTargetAtTime(g, ctx.currentTime, 0.02);
    },
    setCutoff(hz: number): void {
      if (disposed || !(hz > 0)) return;
      master.frequency.setTargetAtTime(hz, ctx.currentTime, 0.05);
    },
    silence(): void {
      const now = ctx.currentTime;
      for (const v of pool.drain()) steal(v, now);
    },
    dispose(): void {
      if (disposed) return;
      const now = ctx.currentTime;
      for (const v of pool.drain()) {
        for (const s of v.sources) safeStop(s, now);
        disconnectAll(v.nodes);
        trace?.cut(v.id, now);
      }
      safeStop(lfo, now);
      disconnectAll(graph);
      disposed = true;
    },
    get voiceCount(): number {
      // Most voices that will sound at once from now on, counting notes scheduled ahead.
      return pool.peak(ctx.currentTime, Infinity);
    },
    get motifVoiceCount(): number {
      return pool.peak(ctx.currentTime, Infinity, isMotif);
    },
    get bossVoiceCount(): number {
      return pool.peak(ctx.currentTime, Infinity, isBoss);
    },
    get steals(): Readonly<Record<VoiceClass, number>> {
      return { ...stealCount };
    },
  };
}
