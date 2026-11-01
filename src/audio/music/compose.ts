// Composed song form (v3.4 music, Ryan 2026-11-01: "melodies are too similar, need more creative
// compositions and at times a space and sci-fi feel"). Pure data helpers, no Web Audio, no PRNG.
//
// A tune with a form plays a written lead line instead of the hashed arp figure. The loop is a
// list of 4 bar sections: A, B, a bridge C, and S, the sparse space breakdown (held pads, long
// echo, no drums). Each section has one 4 bar phrase of lead notes written in scale degrees of
// the tune's mode, so a phrase transposes into the tune's key. Beats are fitted to the chord of
// their bar (harmony.ts fitPitch) like every other melodic voice.
//
// The signature helpers (contour and rhythm per phrase) back the variety test: no two tunes may
// share a phrase signature.
import { chordToneMidi, fitPitch, harmonyForBar, STEPS_PER_BAR, type Key } from './harmony';
import type { Tune } from './tunes';

/** One 4 bar block of the form. S is the space breakdown. */
export type Section = 'A' | 'B' | 'C' | 'S';

/** Bars in one section (one phrase). */
export const SECTION_BARS = 4;
/** Steps in one phrase. */
export const PHRASE_STEPS = SECTION_BARS * STEPS_PER_BAR;

/** One lead note of a phrase. */
export interface LeadNote {
  /** Step from the phrase start, 0 to 63. */
  readonly at: number;
  /** Scale degree above the tune root in the tune's mode (0 the tonic, 7 an octave up on a 7 note mode). */
  readonly deg: number;
  /** Length, steps. A note never rings past the next one. */
  readonly dur: number;
  /** Slide into this note from the previous one (a pitch bend, the classic portamento). */
  readonly slide: boolean;
}

export type Phrase = readonly LeadNote[];

/** Lead waves: a pulse with a duty cycle, a triangle, a saw, or a two operator FM bell. */
export type LeadWave = 'pulse' | 'triangle' | 'sawtooth' | 'bell';

/** Echo send of a voice: none, a short slap, or a long dotted eighth echo with feedback. */
export type EchoSend = 0 | 1 | 2;

export interface LeadVoice {
  readonly wave: LeadWave;
  /** Pulse duty in the A and C sections (0.125, 0.25 or 0.5). Ignored by other waves. */
  readonly duty: number;
  /** Pulse duty in the B section: the duty cycle change. */
  readonly dutyB: number;
  /** Vibrato depth on held notes, cents. */
  readonly vibrato: number;
  /** Echo send of the lead outside the space breakdown (the breakdown always sends long). */
  readonly echo: EchoSend;
}

/**
 * Per note colour for the engine (bed lead, pads and kill accents). Pure data. A note without it
 * plays as before.
 */
export interface NoteFx {
  readonly echo: EchoSend;
  /** Pitch the note slides from, MIDI, or null. */
  readonly slideFrom: number | null;
  /** Delayed vibrato depth on a held note, cents (0 for none). */
  readonly vibrato: number;
  /** Pulse duty (0.125 to 0.5), or 0 for the layer's own wave. */
  readonly duty: number;
  /** Two operator FM bell in place of the wave. */
  readonly bell: boolean;
  /** Notes a single voice steps through quickly (a chip chord arpeggio), MIDI, or null. */
  readonly chord: readonly number[] | null;
  /** Seconds per arpeggio note when `chord` is set. */
  readonly chordSec: number;
  /** Filtered noise wind under a pad. */
  readonly wind: boolean;
}

/** A note with no colour. */
export const PLAIN_FX: NoteFx = Object.freeze({ echo: 0, slideFrom: null, vibrato: 0, duty: 0, bell: false, chord: null, chordSec: 0, wind: false });

/** Pure: a NoteFx from PLAIN_FX with some fields set. */
export function fx(p: Partial<NoteFx>): NoteFx {
  return { ...PLAIN_FX, ...p };
}

/** How the pad plays: a held detuned chord, or a fast chip arpeggio of the chord on one voice. */
export type PadStyle = 'held' | 'chip';

/** Mode names, for the hand-off, the debug overlay and the variety test. */
export type ModeName = 'aeolian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'harmonic' | 'wholetone';

export interface Form {
  readonly mode: ModeName;
  /** One section per 4 bars of the loop; the loop is 4 x sections.length bars. */
  readonly sections: readonly Section[];
  readonly phrases: Readonly<Partial<Record<Section, Phrase>>>;
  readonly lead: LeadVoice;
  readonly pad: PadStyle;
  /** A space piece: filtered noise wind under the pad on every bar, not only in the breakdown. */
  readonly space: boolean;
}

/** Semitone steps of every mode above its tonic. */
export const MODE_STEPS: Readonly<Record<ModeName, readonly number[]>> = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  wholetone: [0, 2, 4, 6, 8, 10],
};

/** Pure: the scale pitch classes of a mode on a tonic, tonic first. */
export function modeScale(tonic: number, mode: ModeName): number[] {
  return MODE_STEPS[mode].map((s) => (tonic + s) % 12);
}

/** Pure: a scale degree as MIDI in a key, degree 0 at `root` (a MIDI note on the key tonic). */
export function scaleMidi(deg: number, key: Key, root: number): number {
  const steps = key.scale.map((pc) => (pc - key.tonic + 12) % 12).sort((a, b) => a - b);
  const n = Math.max(1, steps.length);
  const d = Math.trunc(deg);
  const oct = Math.floor(d / n);
  return root + oct * 12 + (steps[d - oct * n] ?? 0);
}

/** Pure: a lead note from [at, deg, dur] with an optional slide flag (1). */
export function ln(at: number, deg: number, dur: number, slide = 0): LeadNote {
  return { at, deg, dur, slide: slide === 1 };
}

/** Pure: a phrase from up to 4 bars of [step, deg, dur, slide?] cells, each bar from its own step 0. */
export function phrase(...bars: readonly (readonly (readonly number[])[])[]): LeadNote[] {
  const out: LeadNote[] = [];
  bars.forEach((cells, b) => {
    for (const c of cells) out.push(ln(b * STEPS_PER_BAR + (c[0] ?? 0), c[1] ?? 0, c[2] ?? 1, c[3] ?? 0));
  });
  return out;
}

/** Pure: the loop bars of a form. */
export function formBars(f: Form): number {
  return f.sections.length * SECTION_BARS;
}

/** Pure: the section a loop bar is in, or null for a tune without a form. */
export function sectionOf(t: Tune, loopBar: number): Section | null {
  const f = t.form;
  if (f === undefined) return null;
  const n = f.sections.length;
  const i = Math.floor(loopBar / SECTION_BARS);
  return f.sections[((i % n) + n) % n] ?? null;
}

/** Pure: true on a space breakdown bar. */
export function isSpaceBar(t: Tune, loopBar: number): boolean {
  return sectionOf(t, loopBar) === 'S';
}

/** A lead note placed in one bar, pitched and ready for the track. */
export interface PlacedLead {
  /** Step inside the bar. */
  readonly step: number;
  readonly midi: number;
  readonly dur: number;
  /** Pitch to slide from, or null. */
  readonly slideFrom: number | null;
  /** Velocity: strong steps and long notes a touch louder. */
  readonly vel: number;
}

/** Pure: the sounding pitch of a phrase note starting at absolute step `abs`. */
export function leadPitch(n: LeadNote, abs: number, t: Tune): number {
  return fitPitch(scaleMidi(n.deg, t.key, t.root), abs, t.key);
}

/**
 * Pure: the lead notes that start in one loop bar, pitched in the bar's harmony. A slide reads
 * the previous note of the phrase, so the bend starts where the line was.
 */
export function leadForBar(t: Tune, loopBar: number): PlacedLead[] {
  const sec = sectionOf(t, loopBar);
  const ph = sec === null ? undefined : t.form?.phrases[sec];
  if (ph === undefined) return [];
  const phraseBar = ((loopBar % SECTION_BARS) + SECTION_BARS) % SECTION_BARS;
  const start = (loopBar - phraseBar) * STEPS_PER_BAR;
  const lo = phraseBar * STEPS_PER_BAR;
  const out: PlacedLead[] = [];
  for (let i = 0; i < ph.length; i++) {
    const n = ph[i];
    if (n === undefined || n.at < lo || n.at >= lo + STEPS_PER_BAR) continue;
    const midi = leadPitch(n, start + n.at, t);
    const prev = i > 0 ? ph[i - 1] : undefined;
    const from = n.slide && prev !== undefined ? leadPitch(prev, start + prev.at, t) : null;
    const strong = n.at % 4 === 0;
    out.push({ step: n.at - lo, midi, dur: n.dur, slideFrom: from === midi ? null : from, vel: strong || n.dur >= 4 ? 0.95 : 0.75 });
  }
  return out;
}

/** Pure: the chord tones (MIDI) a chip pad cycles through in a bar: root, third, fifth, root up. */
export function chipChord(t: Tune, loopBar: number, base: number): number[] {
  const h = harmonyForBar(loopBar, t.key);
  return [0, 1, 2, 3].map((d) => chordToneMidi(h, d, base));
}

// ---------------------------------------------------------------------------------------
// Signatures (the variety test).

/** Pure: the sounding pitches of a phrase placed at a phrase start (absolute step). */
export function phrasePitches(ph: Phrase, start: number, t: Tune): number[] {
  return ph.map((n) => leadPitch(n, start + n.at, t));
}

/**
 * Pure: the interval contour of a pitch line: u (up), d (down) or s (same) per interval, with a
 * capital letter for a leap of more than 2 semitones.
 */
export function contourSignature(pitches: readonly number[]): string {
  let out = '';
  for (let i = 1; i < pitches.length; i++) {
    const d = (pitches[i] ?? 0) - (pitches[i - 1] ?? 0);
    const c = d > 0 ? 'u' : d < 0 ? 'd' : 's';
    out += Math.abs(d) > 2 ? c.toUpperCase() : c;
  }
  return out;
}

/** Pure: the rhythm of a phrase: each onset and length, in steps. */
export function rhythmSignature(ph: Phrase): string {
  return ph.map((n) => `${n.at}:${n.dur}`).join(' ');
}

/** Pure: the rhythm cell of one bar of a phrase (onsets inside the bar). */
export function rhythmCell(ph: Phrase, bar: number): string {
  const lo = bar * STEPS_PER_BAR;
  return ph
    .filter((n) => n.at >= lo && n.at < lo + STEPS_PER_BAR)
    .map((n) => `${n.at - lo}:${n.dur}`)
    .join(' ');
}

/** Pure: the chord numerals of a run of bars of a key, joined. */
export function progressionSignature(key: Key, fromBar: number, bars: number): string {
  const out: string[] = [];
  for (let b = fromBar; b < fromBar + bars; b++) out.push(harmonyForBar(b, key).numeral);
  return out.join(' ');
}

/** Pure: the first loop bar of each distinct section of a form, in order of appearance. */
export function sectionStarts(f: Form): Partial<Record<Section, number>> {
  const out: Partial<Record<Section, number>> = {};
  f.sections.forEach((s, i) => {
    if (out[s] === undefined) out[s] = i * SECTION_BARS;
  });
  return out;
}
