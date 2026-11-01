// Master tone stage and per voice tone helpers (mix v3.5, Ryan M1: "sounds and music are likely
// too high of a frequency; with earbuds the sound is slightly sharp and irritating"). Pure numbers
// plus one small graph builder on a structural context, so tests run in node.
//
// The synth master (sfx, and music, which feeds the synth master) passes through
//   high shelf (-6 dB above 5 kHz) -> low pass (9 kHz) -> makeup gain (+1.5 dB) -> destination.
// Per voice: square and sawtooth leads get a low pass that tracks the note (about 6x the note
// frequency, capped at 5 kHz), fast attacks last at least 4 ms, and noise hits are band limited
// below 7 kHz.

/** Master tone stage settings. Pure data. */
export const TONE = Object.freeze({
  shelfHz: 5000,
  shelfDb: -6,
  lowpassHz: 9000,
  /** A Butterworth Q: a gentle low pass, no resonant bump. */
  lowpassQ: 0.707,
  /** Loudness compensation for the removed highs, at most 2 dB (brief). */
  makeupDb: 1.5,
});

/** Lead low pass: cutoff as a multiple of the note frequency ... */
export const LEAD_LP_MUL = 6;
/** ... capped here, Hz ... */
export const LEAD_LP_MAX_HZ = 5000;
/** ... and never under this, so a low sweep (an sfx saw falling to 40 Hz) keeps its body. */
export const LEAD_LP_MIN_HZ = 700;
/** Q of the tracking low pass: flat, so the lead keeps its loudness at the cutoff. */
export const LEAD_LP_Q = 0.6;
/** Shortest attack of any voice, seconds: a faster edge clicks. */
export const MIN_ATTACK_SEC = 0.004;
/** Noise hits are band limited below this, Hz. */
export const NOISE_LP_HZ = 7000;

/** Pure: decibels to a linear gain. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** Pure: the makeup gain of the tone stage (linear). */
export function toneMakeupGain(): number {
  return dbToGain(TONE.makeupDb);
}

/** Pure: the tracking low pass cutoff for a lead at `hz`: 6x the note, 700 Hz to 5 kHz. */
export function leadCutoffHz(hz: number): number {
  if (!(hz > 0) || !Number.isFinite(hz)) return LEAD_LP_MIN_HZ;
  return Math.min(LEAD_LP_MAX_HZ, Math.max(LEAD_LP_MIN_HZ, hz * LEAD_LP_MUL));
}

/** Pure: true for the bright waves that get the tracking low pass. */
export function needsLeadFilter(wave: string): boolean {
  return wave === 'square' || wave === 'sawtooth';
}

/** Pure: an attack time raised to the 4 ms floor. */
export function attackSec(sec: number): number {
  return Number.isFinite(sec) ? Math.max(MIN_ATTACK_SEC, sec) : MIN_ATTACK_SEC;
}

/** Pure: a noise filter frequency held under the noise band limit. */
export function noiseBandHz(hz: number): number {
  return Math.min(NOISE_LP_HZ, Math.max(1, hz));
}

/**
 * Pure: the high shelf's gain at frequency `hz`, dB, for a first order shelf at TONE.shelfHz.
 * Used by tests and the hand-off to show the cut: about -3 dB at the corner, -6 dB well above.
 */
export function shelfGainDbAt(hz: number): number {
  const g = dbToGain(TONE.shelfDb);
  const r = (hz / TONE.shelfHz) ** 2;
  // |H|^2 of a first order shelf: (1 + g^2 r) / (1 + r).
  return 10 * Math.log10((1 + g * g * r) / (1 + r));
}

// ---------------------------------------------------------------------------------------
// Graph builder.

export interface ToneStage {
  /** Connect sources (the synth master) here: the high shelf. */
  readonly input: BiquadFilterNode;
  readonly lowpass: BiquadFilterNode;
  readonly makeup: GainNode;
}

/** Build the tone stage once (at context creation) and connect its output to `dest`. */
export function buildToneStage(c: BaseAudioContext, dest: AudioNode): ToneStage {
  const shelf = c.createBiquadFilter();
  shelf.type = 'highshelf';
  shelf.frequency.value = TONE.shelfHz;
  shelf.gain.value = TONE.shelfDb;
  const lowpass = c.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = TONE.lowpassHz;
  lowpass.Q.value = TONE.lowpassQ;
  const makeup = c.createGain();
  makeup.gain.value = toneMakeupGain();
  shelf.connect(lowpass);
  lowpass.connect(makeup);
  makeup.connect(dest);
  return { input: shelf, lowpass, makeup };
}
