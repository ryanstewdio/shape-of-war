// The tune library (v3.4 music, Ryan 2026-11-01: "melodies are too similar, need more creative
// compositions and at times a space and sci-fi feel to the music ... should resemble classic
// video game music from years 1980 to 2000"). Pure data and pure helpers, no Web Audio, no PRNG.
//
// Every tune here is an original composition written for Shape of War in the idiom of 1980 to
// 2000 console and arcade music: pulse leads with duty cycle changes, a triangle bass, noise
// drums, fast chip arpeggios for chords, slides and delayed vibrato on held notes, and later 16
// bit style FM bells and pads. None quotes or paraphrases an existing game theme.
//
// Each tune has a form (compose.ts): 4 bar sections A, B, a bridge C and S, the sparse space
// breakdown (held pads, long echo, filtered noise wind, no drums). Each has its own mode, tempo,
// lead voice and chord plan, and no two tunes share a phrase contour, a phrase rhythm or a chord
// progression (tests/audio/music/variety.test.ts). Ten level tunes rotate (three of them, Nebula
// Drift, Event Horizon and Aurora Veil, are slow space pieces), and three battle tracks stay minor.
//
// Everything melodic (motifs, entrance phrases, kill notes, chord hits, hit ticks) reads the
// active tune's key through harmony.ts, so every contribution transposes into the tune's chords.
//
// Voice budget rules every tune keeps (the bed peak test checks them at full threat):
// - nothing but the pad release, the new pad, bass, kick, hat and lead may sound across a bar line
//   (a kick needs 0.32 s before the next downbeat, a clap 0.14 s);
// - no clap in steps 0 to 3 (the old pad is still releasing);
// - kicks may overlap one other kick only in the middle of a bar.
import { SECTION_BARS, type Form, type LeadVoice, type ModeName, type Phrase, type Section, phrase, modeScale } from './compose';
import { DEFAULT_KEY, HARMONIES, triad, type ChordName, type Harmony, type Key } from './harmony';
import { pentatonicMidi } from './scale';
import type { Layer } from './track';

export const TUNE_IDS = ['neon', 'tide', 'ember', 'orbit', 'nebula', 'horizon', 'charge', 'foundry', 'aurora', 'pixel'] as const;
export type TuneId = (typeof TUNE_IDS)[number];

/** The boss battle tracks (G3C retest: boss fights get their own music, at least three tracks). */
export const BATTLE_IDS = ['verdict', 'meridian', 'requiem'] as const;
export type BattleId = (typeof BATTLE_IDS)[number];
/** Any track the music can play: a level tune or a battle track. */
export type TrackId = TuneId | BattleId;

/** Tempo range every tune keeps (v3.4 brief: 100 to 150 BPM). */
export const BPM_MIN = 100;
export const BPM_MAX = 150;

export interface DrumHit {
  readonly step: number;
  readonly vel: number;
}

export interface HatHit extends DrumHit {
  /** In between sixteenth, gated by intensity (mix.hat16). */
  readonly sub: boolean;
}

/** One bass note: a chord degree counted from the chord's bass root (0 root, 1 third, 2 fifth, 3 octave). */
export interface BassHit {
  readonly step: number;
  readonly deg: number;
  readonly dur: number;
  readonly vel: number;
}

/**
 * An arp figure: two contours in pentatonic degrees relative to the chord anchor (even bars,
 * odd bars), steps that always rest (never 0 or 8) and the chance that another weak step rests.
 * With a form the figure plays only on a varied pass, in place of the B section's lead.
 */
export interface ArpFigure {
  readonly a: readonly number[];
  readonly b: readonly number[];
  readonly rests: readonly number[];
  readonly restP: number;
}

export interface Drums {
  readonly kick: readonly DrumHit[];
  /** Added in the last bar of the loop. */
  readonly kickTurn: readonly DrumHit[];
  /** The clap, heard only under the high threat lift. */
  readonly perc: readonly DrumHit[];
  /** Added to the clap in odd bars. */
  readonly percOdd: readonly DrumHit[];
  readonly hat: readonly HatHit[];
}

/**
 * A hook (battle polish, tunes without a form): one bar the lead plays verbatim on the first bar
 * of every 8. A tune with a form needs none: its A phrase opens every 8 bars.
 */
export interface HookLine {
  readonly steps: readonly number[];
  readonly degs: readonly number[];
}

/** One stab of a battle track's intro hit: chord degrees (0 root, 1 third, 2 fifth, 3 octave) at a step. */
export interface IntroHit {
  readonly step: number;
  readonly degs: readonly number[];
  readonly dur: number;
  readonly vel: number;
}

/** Oscillator waves of the bed. Pure data, read by the engine. */
export interface BedTimbre {
  readonly bass: OscillatorType;
  readonly pad: OscillatorType;
  /** The lead's fallback wave (a pulse falls back to square, a bell to sine) and its loudness trim. */
  readonly arp: OscillatorType;
  /** Cents each of the two pad oscillators is detuned, one up and one down. */
  readonly padDetune: number;
}

/** How the track voices one chord. */
export interface ChordVoicing {
  readonly name: ChordName;
  readonly harmony: Harmony;
  /** Sub bass root, MIDI. */
  readonly bass: number;
  /** Pad voicing, three notes, MIDI. */
  readonly pad: readonly number[];
  /** Arp and motif anchor as a pentatonic degree above the tune root. */
  readonly arpAnchor: number;
}

export interface Tune {
  readonly id: TrackId;
  readonly name: string;
  /** One line on the character, for the hand-off and the debug overlay. */
  readonly mood: string;
  readonly bpm: number;
  /** Seconds per sixteenth. */
  readonly stepSec: number;
  /** MIDI note of the tonic (lead degree 0, pentatonic degree 0), within a fourth of A4. */
  readonly root: number;
  readonly key: Key;
  /** Bars in the loop, key.bars.length. */
  readonly loopBars: number;
  /** Voicing per chord name used in the key. */
  readonly voicings: Readonly<Record<string, ChordVoicing>>;
  readonly bass: readonly BassHit[];
  /** The bass line of a varied pass. */
  readonly bassAlt: readonly BassHit[];
  readonly arp: ArpFigure;
  /** The arp figure of a varied pass. */
  readonly arpAlt: ArpFigure;
  readonly drums: Drums;
  readonly bed: BedTimbre;
  /** The written song form: sections, lead phrases, lead voice, mode, pad style. */
  readonly form?: Form;
  /** Set on a boss battle track (BATTLE_TUNES). Absent on the level tunes. */
  readonly battle?: true;
  /** Tunes without a form: the hook the lead plays on bar 0 of every 8 (battle polish). */
  readonly hook?: HookLine;
  /** Battle tracks: the bass line of bars 4 and 8 of each 8, with its octave jumps. */
  readonly bassJump?: readonly BassHit[];
  /** Battle tracks: the one bar signature hit played on the cross fade (join) bar. */
  readonly intro?: readonly IntroHit[];
}

/** A level tune (TUNES): its id is one of TUNE_IDS. */
export interface LevelTune extends Tune {
  readonly id: TuneId;
}

const hit = (step: number, vel: number): DrumHit => ({ step, vel });
const bh = (step: number, deg: number, dur: number, vel: number): BassHit => ({ step, deg, dur, vel });
const hh = (step: number, vel: number, sub: boolean): HatHit => ({ step, vel, sub });
const ih = (step: number, degs: readonly number[], dur: number, vel: number): IntroHit => ({ step, degs, dur, vel });

/** Pure: the sub bass root of a chord, E2 to D#3. */
export function bassRoot(h: Harmony): number {
  return 40 + ((h.root - 4 + 12) % 12);
}

/** Pure: a close pad voicing, every chord tone between G3 and F#4, ascending. */
export function padVoicing(h: Harmony): number[] {
  return h.tones.map((pc) => 55 + ((pc - 7 + 12) % 12)).sort((a, b) => a - b);
}

/** Pure: an augmented triad (the whole tone chord). */
export function aug(name: ChordName, numeral: string, root: number): Harmony {
  const intervals = [0, 4, 8];
  return { name, numeral, root, intervals, tones: intervals.map((i) => (root + i) % 12) };
}

/**
 * Pure: the arp anchor of a chord: the pentatonic degree above the tune root (from -1 to 4) whose
 * pitch class is nearest the chord root, so the hashed arp and the hit ticks sit on the chord.
 */
export function anchorFor(h: Harmony, root: number): number {
  let best = 0;
  let bestD = 99;
  for (let d = -1; d <= 4; d++) {
    const pc = ((pentatonicMidi(d, root) % 12) + 12) % 12;
    const diff = Math.abs(pc - h.root);
    const dist = Math.min(diff, 12 - diff);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

/** Pure: a voicing from a chord and its arp anchor. */
function voiced(harmony: Harmony, arpAnchor: number): ChordVoicing {
  return { name: harmony.name, harmony, bass: bassRoot(harmony), pad: padVoicing(harmony), arpAnchor };
}

/** Pure: a voicing table for every chord of a key. */
function voicingsOf(key: Key, root: number): Record<string, ChordVoicing> {
  const out: Record<string, ChordVoicing> = {};
  for (const h of key.bars) if (out[h.name] === undefined) out[h.name] = voiced(h, anchorFor(h, root));
  return out;
}

/** Pure: a key from a mode, a form and four chords (one a bar) per section. */
export function formKey(tonic: number, mode: ModeName, sections: readonly Section[], chords: Readonly<Partial<Record<Section, readonly Harmony[]>>>): Key {
  const bars: Harmony[] = [];
  for (const s of sections) {
    const c = chords[s] ?? [];
    for (let i = 0; i < SECTION_BARS; i++) bars.push(c[i] ?? c[c.length - 1] ?? HARMONIES.Am);
  }
  return { tonic, scale: modeScale(tonic, mode), bars };
}

const STEPS16: readonly number[] = Array.from({ length: 16 }, (_, s) => s);
const ODD_STEPS: readonly number[] = STEPS16.filter((s) => s % 2 === 1);
const EIGHTHS: readonly number[] = STEPS16.filter((s) => s % 2 === 0);

const lead = (wave: LeadVoice['wave'], duty: number, dutyB: number, vibrato: number, echo: LeadVoice['echo']): LeadVoice => ({ wave, duty, dutyB, vibrato, echo });

interface TuneInput {
  readonly id: TrackId;
  readonly name: string;
  readonly mood: string;
  readonly bpm: number;
  readonly root: number;
  readonly mode: ModeName;
  readonly sections: readonly Section[];
  readonly chords: Readonly<Partial<Record<Section, readonly Harmony[]>>>;
  readonly phrases: Readonly<Partial<Record<Section, Phrase>>>;
  readonly lead: LeadVoice;
  readonly pad: Form['pad'];
  /** A space piece (wind on every bar). Default false. */
  readonly space?: boolean;
  readonly bass: readonly BassHit[];
  readonly bassAlt: readonly BassHit[];
  readonly arp: ArpFigure;
  readonly arpAlt: ArpFigure;
  readonly drums: Drums;
  readonly bed: BedTimbre;
}

/** Pure: a tune from its parts; the key, loop and voicings follow from the form. */
function song(i: TuneInput): Tune {
  const key = formKey(i.root % 12, i.mode, i.sections, i.chords);
  const form: Form = { mode: i.mode, sections: i.sections, phrases: i.phrases, lead: i.lead, pad: i.pad, space: i.space === true };
  return {
    id: i.id,
    name: i.name,
    mood: i.mood,
    bpm: i.bpm,
    stepSec: 60 / i.bpm / 4,
    root: i.root,
    key,
    loopBars: key.bars.length,
    voicings: voicingsOf(key, i.root),
    bass: i.bass,
    bassAlt: i.bassAlt,
    arp: i.arp,
    arpAlt: i.arpAlt,
    drums: i.drums,
    bed: i.bed,
    form,
  };
}

function level(i: TuneInput & { readonly id: TuneId }): LevelTune {
  return { ...song(i), id: i.id };
}

/** The drive form: A, B, the space breakdown, the bridge, A again (20 bars). */
const DRIVE_FORM: readonly Section[] = ['A', 'B', 'S', 'C', 'A'];
/** The space form: an 8 bar breakdown in the middle (24 bars). */
const SPACE_FORM: readonly Section[] = ['A', 'B', 'S', 'S', 'C', 'A'];

// ---------------------------------------------------------------------------------------
// Neon Drive: A aeolian, 138 BPM. A square lead that thins to a 25 percent pulse in B, a fast
// chip arpeggio for the chords, four on the floor. Its A phrase is a 3 3 2 push.

const N = {
  am: triad('Am', 'i', 9, 3),
  f: triad('F', 'VI', 5, 4),
  g: triad('G', 'VII', 7, 4),
  em: triad('Em', 'v', 4, 3),
  dm: triad('Dm', 'iv', 2, 3),
  c: triad('C', 'III', 0, 4),
};

const NEON: LevelTune = level({
  id: 'neon',
  name: 'Neon Drive',
  mood: 'driving arcade run, A aeolian, square lead over a chip arpeggio, 3 3 2 push',
  bpm: 138,
  root: 69,
  mode: 'aeolian',
  sections: DRIVE_FORM,
  chords: { A: [N.am, N.f, N.g, N.em], B: [N.dm, N.g, N.c, N.f], S: [N.f, N.f, N.dm, N.em], C: [N.c, N.em, N.f, N.g] },
  phrases: {
    A: phrase(
      [[0, 4, 3], [3, 2, 3], [6, 0, 2], [8, 4, 2], [10, 5, 2], [12, 4, 4]],
      [[0, 5, 3], [3, 7, 3], [6, 5, 2], [8, 4, 2], [10, 2, 2], [12, 0, 4, 1]],
      [[0, 6, 3], [3, 4, 3], [6, 3, 2], [8, 1, 2], [10, 3, 2], [12, 1, 4, 1]],
      [[0, 4, 6], [6, 6, 2], [8, 8, 8, 1]],
    ),
    B: phrase(
      [[0, 3, 6], [6, 5, 2], [8, 7, 4, 1], [12, 5, 2], [14, 3, 2]],
      [[0, 3, 2], [2, 1, 2], [4, 3, 4], [8, 6, 8, 1]],
      [[0, 2, 1], [1, 3, 1], [2, 4, 1], [3, 6, 1], [4, 7, 6], [10, 6, 2], [12, 4, 4]],
      [[0, 5, 8], [8, 2, 2], [10, 3, 2], [12, 5, 4, 1]],
    ),
    S: phrase([[0, 9, 10]], [[4, 7, 4], [8, 9, 8, 1]], [[0, 10, 12]], [[8, 8, 8, 1]]),
    C: phrase(
      [[0, 9, 2], [2, 7, 2], [4, 6, 2], [6, 4, 2], [8, 7, 2], [10, 6, 2], [12, 4, 2], [14, 2, 2]],
      [[0, 4, 4], [4, 1, 4], [8, 4, 6], [14, 6, 2]],
      [[0, 7, 2], [2, 5, 2], [4, 3, 2], [6, 2, 2], [8, 5, 2], [10, 3, 2], [12, 2, 2], [14, 0, 2]],
      [[0, 1, 4], [4, 3, 4], [8, 6, 8, 1]],
    ),
  },
  lead: lead('pulse', 0.5, 0.25, 18, 1),
  pad: 'chip',
  bass: EIGHTHS.map((s) => bh(s, 0, 2, s % 8 === 0 ? 1 : 0.78)),
  bassAlt: [bh(0, 0, 2, 1), bh(2, 3, 1, 0.7), bh(3, 0, 1, 0.75), bh(4, 3, 2, 0.8), bh(6, 0, 2, 0.75), bh(8, 0, 2, 1), bh(10, 3, 2, 0.75), bh(12, 2, 2, 0.8), bh(14, 3, 2, 0.75)],
  arp: {
    a: [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 5, 4, 2, 1, 2],
    b: [4, 2, 0, 2, 3, 1, -1, 1, 0, 2, 4, 6, 5, 4, 2, 1],
    rests: [],
    restP: 0.12,
  },
  arpAlt: {
    a: [0, 0, 2, 2, 4, 4, 5, 5, 4, 4, 2, 2, 3, 3, 1, 1],
    b: [5, 5, 4, 4, 2, 2, 0, 0, 1, 1, 3, 3, 4, 4, 2, 2],
    rests: ODD_STEPS,
    restP: 0.08,
  },
  drums: {
    kick: [hit(0, 1), hit(4, 0.9), hit(8, 0.9), hit(12, 0.9)],
    kickTurn: [hit(10, 0.7)],
    perc: [hit(4, 1), hit(12, 1)],
    percOdd: [hit(14, 0.45)],
    hat: STEPS16.map((s) => (s % 2 === 1 ? hh(s, 0.45, true) : hh(s, s % 4 === 2 ? 1 : 0.6, false))),
  },
  bed: { bass: 'triangle', pad: 'square', arp: 'square', padDetune: 9 },
});

// ---------------------------------------------------------------------------------------
// Glass Tide: B dorian, 112 BPM, half time. A triangle lead on the off beat pushes, a soft
// detuned pad, the raised sixth giving the major IV (E).

const T = {
  bm: triad('Bm', 'i', 11, 3),
  e: triad('E', 'IV', 4, 4),
  a: triad('A', 'VII', 9, 4),
  d: triad('D', 'III', 2, 4),
  fsm: triad('F#m', 'v', 6, 3),
};

const TIDE: LevelTune = level({
  id: 'tide',
  name: 'Glass Tide',
  mood: 'half time and floating, B dorian, triangle lead on off beat pushes over a soft pad',
  bpm: 112,
  root: 71,
  mode: 'dorian',
  sections: DRIVE_FORM,
  chords: { A: [T.bm, T.e, T.bm, T.a], B: [T.d, T.a, T.e, T.fsm], S: [T.d, T.d, T.a, T.bm], C: [T.fsm, T.e, T.d, T.e] },
  phrases: {
    A: phrase(
      [[0, 4, 4], [4, 3, 2], [6, 2, 2], [8, 0, 6], [14, 2, 2]],
      [[0, 3, 4], [4, 5, 2], [6, 4, 2], [8, 3, 4], [12, 1, 4]],
      [[0, 2, 2], [2, 4, 2], [4, 7, 4], [8, 6, 2], [10, 4, 2], [12, 2, 4]],
      [[0, 1, 8, 1], [8, 6, 8]],
    ),
    B: phrase(
      [[0, 2, 2], [2, 4, 4], [6, 6, 4], [10, 4, 2], [12, 2, 4]],
      [[2, 1, 4], [6, 3, 4], [10, 6, 6]],
      [[0, 5, 2], [2, 7, 4], [6, 8, 4], [10, 7, 2], [12, 5, 4]],
      [[2, 4, 6], [8, 6, 2], [10, 8, 6, 1]],
    ),
    S: phrase([[0, 9, 6], [8, 11, 8, 1]], [[8, 9, 8]], [[0, 8, 4], [4, 6, 12]], [[4, 7, 12, 1]]),
    C: phrase(
      [[0, 11, 3], [3, 10, 1], [4, 8, 4], [8, 10, 3], [11, 8, 1], [12, 6, 4]],
      [[0, 7, 3], [3, 5, 1], [4, 3, 4], [8, 5, 3], [11, 3, 1], [12, 1, 4]],
      [[0, 4, 3], [3, 2, 1], [4, 0, 4], [8, 2, 3], [11, 4, 1], [12, 6, 4]],
      [[0, 5, 12, 1], [12, 3, 4]],
    ),
  },
  lead: lead('triangle', 0.5, 0.5, 14, 2),
  pad: 'held',
  bass: [bh(0, 0, 3, 1), bh(3, 0, 3, 0.7), bh(6, 2, 2, 0.75), bh(8, 0, 4, 0.9), bh(12, 3, 2, 0.7), bh(14, 2, 2, 0.65)],
  bassAlt: [bh(0, 0, 6, 1), bh(6, 0, 2, 0.7), bh(8, 1, 4, 0.85), bh(12, 2, 4, 0.8)],
  arp: {
    a: [0, 0, 2, 2, 3, 3, 5, 5, 4, 4, 2, 2, 3, 3, 1, 1],
    b: [5, 5, 3, 3, 2, 2, 0, 0, 1, 1, 2, 2, 4, 4, 2, 2],
    rests: ODD_STEPS,
    restP: 0.1,
  },
  arpAlt: {
    a: [0, 2, 4, 0, 2, 4, 5, 4, 2, 4, 5, 7, 5, 4, 2, 1],
    b: [5, 4, 2, 5, 4, 2, 1, 2, 0, 1, 2, 4, 2, 1, 0, -1],
    rests: [3, 7, 11, 15],
    restP: 0.1,
  },
  drums: {
    kick: [hit(0, 1), hit(10, 0.85)],
    kickTurn: [hit(12, 0.65)],
    perc: [hit(8, 1)],
    percOdd: [hit(6, 0.4)],
    hat: [hh(2, 1, false), hh(3, 0.5, true), hh(6, 1, false), hh(7, 0.5, true), hh(10, 1, false), hh(11, 0.5, true), hh(12, 0.4, true), hh(14, 1, false), hh(15, 0.5, true)],
  },
  bed: { bass: 'triangle', pad: 'triangle', arp: 'triangle', padDetune: 6 },
});

// ---------------------------------------------------------------------------------------
// Ember Gate: E phrygian, 144 BPM, a galloping lead (an eighth and two sixteenths) on a bright
// saw, the flat second (F) leaning on the tonic, a chip arpeggio for the chords.

const E = {
  em: triad('Em', 'i', 4, 3),
  f: triad('F', 'bII', 5, 4),
  dm: triad('Dm', 'vii', 2, 3),
  am: triad('Am', 'iv', 9, 3),
  c: triad('C', 'VI', 0, 4),
};

const EMBER: LevelTune = level({
  id: 'ember',
  name: 'Ember Gate',
  mood: 'dark and urgent, E phrygian, galloping saw lead and a chip arpeggio',
  bpm: 144,
  root: 64,
  mode: 'phrygian',
  sections: DRIVE_FORM,
  chords: { A: [E.em, E.f, E.dm, E.em], B: [E.am, E.c, E.dm, E.f], S: [E.c, E.c, E.f, E.f], C: [E.dm, E.c, E.f, E.em] },
  phrases: {
    A: phrase(
      [[0, 0, 2], [2, 0, 1], [3, 1, 1], [4, 0, 2], [6, 0, 1], [7, 1, 1], [8, 2, 2], [10, 1, 2], [12, 0, 4]],
      [[0, 1, 2], [2, 1, 1], [3, 2, 1], [4, 1, 2], [6, 3, 1], [7, 2, 1], [8, 5, 4], [12, 3, 4]],
      [[0, 3, 2], [2, 3, 1], [3, 4, 1], [4, 3, 2], [6, 6, 1], [7, 5, 1], [8, 6, 4], [12, 8, 4, 1]],
      [[0, 7, 8], [8, 6, 2], [10, 5, 2], [12, 4, 4]],
    ),
    B: phrase(
      [[0, 7, 2], [4, 10, 2], [6, 9, 2], [8, 7, 6], [14, 5, 2]],
      [[0, 4, 2], [4, 9, 2], [6, 7, 2], [8, 5, 8, 1]],
      [[0, 6, 2], [4, 8, 2], [6, 10, 2], [8, 13, 6, 1], [14, 12, 2]],
      [[0, 10, 4], [4, 12, 4], [8, 8, 8]],
    ),
    S: phrase([[0, 12, 16]], [[8, 11, 4], [12, 9, 4]], [[0, 8, 16, 1]], [[4, 10, 4], [8, 12, 8]]),
    C: phrase(
      [[0, 6, 1], [1, 7, 1], [2, 8, 1], [3, 7, 1], [4, 6, 2], [6, 3, 2], [8, 6, 1], [9, 7, 1], [10, 8, 1], [11, 10, 1], [12, 8, 4]],
      [[0, 7, 6], [6, 5, 2], [8, 2, 2], [10, 4, 2], [12, 5, 4]],
      [[0, 5, 1], [1, 6, 1], [2, 7, 1], [3, 6, 1], [4, 5, 2], [6, 3, 2], [8, 8, 2], [10, 10, 2], [12, 12, 4]],
      [[0, 11, 4], [4, 9, 4], [8, 7, 8, 1]],
    ),
  },
  lead: lead('sawtooth', 0.5, 0.5, 25, 1),
  pad: 'chip',
  bass: [bh(0, 0, 1, 1), bh(2, 0, 1, 0.7), bh(3, 0, 1, 0.8), bh(4, 3, 1, 0.8), bh(6, 0, 1, 0.7), bh(7, 0, 1, 0.75), bh(8, 0, 1, 0.95), bh(10, 0, 1, 0.7), bh(11, 0, 1, 0.8), bh(12, 3, 1, 0.8), bh(14, 2, 1, 0.75), bh(15, 0, 1, 0.7)],
  bassAlt: EIGHTHS.map((s) => bh(s, s % 4 === 2 ? 3 : 0, 2, s % 8 === 0 ? 1 : 0.8)),
  arp: {
    a: [0, 1, 2, 1, 0, 1, 3, 2, 0, 1, 2, 4, 3, 2, 1, 0],
    b: [2, 1, 0, -1, 0, 1, 2, 1, 3, 2, 1, 0, 1, 2, 3, 2],
    rests: [6, 14],
    restP: 0.1,
  },
  arpAlt: {
    a: [0, 2, 2, 3, 3, 5, 4, 4, 0, 2, 2, 3, 4, 4, 2, 2],
    b: [4, 3, 3, 2, 2, 0, 1, 1, 2, 1, 1, 0, -1, -1, 0, 0],
    rests: [2, 5, 10, 13],
    restP: 0.05,
  },
  drums: {
    kick: [hit(0, 1), hit(3, 0.8), hit(8, 0.95), hit(11, 0.8)],
    kickTurn: [hit(10, 0.7)],
    perc: [hit(4, 1), hit(12, 1)],
    percOdd: [hit(14, 0.45)],
    hat: STEPS16.filter((s) => s % 4 !== 0).map((s) => hh(s, s % 4 === 2 ? 1 : 0.45, s % 2 === 1)),
  },
  bed: { bass: 'sawtooth', pad: 'square', arp: 'sawtooth', padDetune: 12 },
});

// ---------------------------------------------------------------------------------------
// Low Orbit: F mixolydian, 126 BPM, a bright heroic pulse lead (25 percent, thinning to 12.5
// in B) with wide vibrato, a broken beat, the flat seventh (Eb) under the tonic.

const O = {
  f: triad('F', 'I', 5, 4),
  eb: triad('Eb', 'bVII', 3, 4),
  bb: triad('Bb', 'IV', 10, 4),
  dm: triad('Dm', 'vi', 2, 3),
  gm: triad('Gm', 'ii', 7, 3),
  cm: triad('Cm', 'v', 0, 3),
};

const ORBIT: LevelTune = level({
  id: 'orbit',
  name: 'Low Orbit',
  mood: 'bright and heroic, F mixolydian, thin pulse lead with wide vibrato over a broken beat',
  bpm: 126,
  root: 65,
  mode: 'mixolydian',
  sections: DRIVE_FORM,
  chords: { A: [O.f, O.eb, O.bb, O.f], B: [O.dm, O.gm, O.cm, O.eb], S: [O.bb, O.bb, O.eb, O.f], C: [O.gm, O.dm, O.eb, O.bb] },
  phrases: {
    A: phrase(
      [[0, 4, 6], [6, 5, 2], [8, 4, 4], [12, 2, 4]],
      [[0, 1, 4], [4, 3, 2], [6, 6, 2], [8, 4, 8, 1]],
      [[0, 3, 2], [2, 4, 2], [4, 5, 2], [6, 7, 2], [8, 8, 6], [14, 7, 2]],
      [[0, 7, 4], [4, 4, 4], [8, 0, 8, 1]],
    ),
    B: phrase(
      [[2, 5, 2], [4, 7, 4], [10, 9, 2], [12, 7, 4]],
      [[2, 8, 2], [4, 6, 2], [6, 5, 2], [8, 4, 8]],
      [[2, 4, 2], [4, 6, 4], [10, 8, 2], [12, 11, 4, 1]],
      [[0, 10, 6], [6, 8, 2], [8, 6, 8]],
    ),
    S: phrase([[0, 10, 6], [8, 14, 8, 1]], [[8, 12, 8]], [[0, 13, 12]], [[8, 11, 8, 1]]),
    C: phrase(
      [[0, 8, 5], [5, 10, 5], [10, 12, 6]],
      [[0, 12, 5], [5, 9, 5], [10, 7, 6]],
      [[0, 6, 5], [5, 8, 5], [10, 10, 6]],
      [[0, 10, 4], [4, 9, 2], [6, 7, 2], [8, 5, 8]],
    ),
  },
  lead: lead('pulse', 0.25, 0.125, 30, 2),
  pad: 'held',
  bass: [bh(0, 0, 2, 1), bh(3, 0, 1, 0.7), bh(4, 3, 2, 0.8), bh(7, 0, 1, 0.7), bh(8, 0, 2, 0.95), bh(10, 2, 2, 0.75), bh(12, 0, 1, 0.8), bh(14, 3, 2, 0.75)],
  bassAlt: [bh(0, 0, 4, 1), bh(6, 0, 2, 0.75), bh(8, 2, 4, 0.85), bh(12, 1, 2, 0.7), bh(14, 2, 2, 0.7)],
  arp: {
    a: [0, 1, 1, 3, 2, 1, 1, 0, 1, 3, 3, 4, 5, 4, 4, 2],
    b: [4, 3, 3, 2, 1, 0, 0, 1, 0, -1, -1, 1, 2, 1, 1, 0],
    rests: [2, 6, 10, 14],
    restP: 0.1,
  },
  arpAlt: {
    a: [0, 0, 0, 2, 2, 2, 4, 4, 3, 3, 3, 5, 5, 5, 4, 4],
    b: [5, 5, 5, 4, 4, 4, 2, 2, 1, 1, 1, 0, 0, 0, 1, 1],
    rests: [1, 2, 4, 5, 7, 9, 10, 12, 13, 15],
    restP: 0,
  },
  drums: {
    kick: [hit(0, 1), hit(6, 0.8), hit(10, 0.9)],
    kickTurn: [hit(12, 0.65)],
    perc: [hit(4, 1), hit(12, 1)],
    percOdd: [hit(7, 0.4)],
    hat: STEPS16.filter((s) => s % 2 === 0 || s === 5 || s === 13 || s === 15).map((s) => (s % 2 === 0 ? hh(s, s % 4 === 2 ? 0.9 : 0.6, false) : hh(s, 0.4, true))),
  },
  bed: { bass: 'triangle', pad: 'sawtooth', arp: 'square', padDetune: 15 },
});

// ---------------------------------------------------------------------------------------
// Nebula Drift: D lydian, 100 BPM, a space piece. A sparse FM bell lead with a long echo, the
// lydian I to II float, slow pads with filtered noise wind on every bar, an 8 bar breakdown.

const NB = {
  d: triad('D', 'I', 2, 4),
  e: triad('E', 'II', 4, 4),
  fsm: triad('F#m', 'iii', 6, 3),
  bm: triad('Bm', 'vi', 11, 3),
  a: triad('A', 'V', 9, 4),
  csm: triad('C#m', 'vii', 1, 3),
};

const NEBULA: LevelTune = level({
  id: 'nebula',
  name: 'Nebula Drift',
  mood: 'space: D lydian, slow FM bell lead with long echo, floating pads and noise wind',
  bpm: 100,
  root: 74,
  mode: 'lydian',
  sections: SPACE_FORM,
  space: true,
  chords: { A: [NB.d, NB.e, NB.fsm, NB.e], B: [NB.bm, NB.a, NB.e, NB.e], S: [NB.d, NB.d, NB.e, NB.e], C: [NB.fsm, NB.bm, NB.csm, NB.a] },
  phrases: {
    A: phrase([[0, 4, 6], [6, 3, 2], [8, 4, 8]], [[0, 1, 4], [4, 3, 4], [8, 5, 8, 1]], [[0, 2, 2], [2, 4, 2], [4, 6, 4], [8, 9, 8]], [[0, 8, 10, 1], [12, 5, 4]]),
    B: phrase([[0, 5, 8], [8, 7, 4], [12, 9, 4]], [[0, 8, 2], [2, 6, 6], [8, 4, 8]], [[0, 3, 4], [4, 5, 4], [8, 8, 4], [12, 10, 4]], [[0, 12, 16, 1]]),
    S: phrase([[0, 11, 16]], [[8, 10, 8]], [[4, 8, 12, 1]], [[12, 12, 4]]),
    C: phrase(
      [[0, 2, 3], [3, 4, 3], [6, 6, 2], [8, 9, 8]],
      [[0, 5, 3], [3, 7, 3], [6, 9, 2], [8, 12, 8]],
      [[0, 6, 3], [3, 8, 3], [6, 10, 2], [8, 13, 8]],
      [[0, 11, 8, 1], [8, 8, 8]],
    ),
  },
  lead: lead('bell', 0.5, 0.5, 0, 2),
  pad: 'held',
  bass: [bh(0, 0, 8, 0.9), bh(8, 2, 8, 0.7)],
  bassAlt: [bh(0, 0, 12, 0.9), bh(12, 3, 4, 0.6)],
  arp: {
    a: [0, 2, 4, 5, 7, 5, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2],
    b: [7, 5, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2, 0, 2, 4, 5],
    rests: ODD_STEPS,
    restP: 0.2,
  },
  arpAlt: {
    a: [0, 4, 7, 4, 0, 4, 7, 9, 0, 4, 7, 4, 0, 4, 7, 9],
    b: [9, 7, 4, 0, 9, 7, 4, 2, 9, 7, 4, 0, 9, 7, 4, 2],
    rests: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15],
    restP: 0,
  },
  drums: {
    kick: [hit(0, 0.8)],
    kickTurn: [hit(8, 0.6)],
    perc: [hit(8, 0.7)],
    percOdd: [hit(14, 0.35)],
    hat: [hh(4, 0.5, false), hh(12, 0.5, false), hh(14, 0.3, true)],
  },
  bed: { bass: 'triangle', pad: 'sawtooth', arp: 'sine', padDetune: 18 },
});

// ---------------------------------------------------------------------------------------
// Event Horizon: C whole tone, 108 BPM, a sci-fi piece. Augmented chords only, a thin 12.5
// percent pulse lead with deep vibrato that opens to a square in B, spirals of sixteenths, an
// 8 bar breakdown with wind.

const H = {
  c: aug('C+', 'I+', 0),
  d: aug('D+', 'II+', 2),
  e: aug('E+', 'III+', 4),
  fs: aug('F#+', '#IV+', 6),
  gs: aug('G#+', '#V+', 8),
  as: aug('A#+', '#VI+', 10),
};

const HORIZON: LevelTune = level({
  id: 'horizon',
  name: 'Event Horizon',
  mood: 'sci-fi: C whole tone, augmented chords, thin pulse lead with deep vibrato, spirals',
  bpm: 108,
  root: 72,
  mode: 'wholetone',
  sections: SPACE_FORM,
  space: true,
  chords: { A: [H.c, H.d, H.e, H.d], B: [H.gs, H.fs, H.e, H.d], S: [H.c, H.c, H.d, H.d], C: [H.as, H.c, H.fs, H.d] },
  phrases: {
    A: phrase([[0, 0, 6], [6, 1, 2], [8, 2, 6], [14, 3, 2]], [[0, 4, 6], [6, 3, 2], [8, 1, 8, 1]], [[0, 2, 6], [6, 4, 2], [8, 6, 6], [14, 5, 2]], [[0, 3, 12, 1], [12, 1, 4]]),
    B: phrase(
      [[0, 4, 1], [1, 5, 1], [2, 6, 1], [3, 7, 1], [4, 8, 4], [8, 6, 2], [10, 4, 2], [12, 2, 4]],
      [[0, 3, 1], [1, 4, 1], [2, 5, 1], [3, 6, 1], [4, 7, 4], [8, 5, 8]],
      [[0, 2, 1], [1, 3, 1], [2, 4, 1], [3, 5, 1], [4, 6, 4], [8, 4, 2], [10, 2, 2], [12, 0, 4]],
      [[0, 1, 16, 1]],
    ),
    S: phrase([[0, 8, 12]], [[8, 10, 8, 1]], [[0, 9, 16]], [[8, 7, 8, 1]]),
    C: phrase([[0, 5, 4], [4, 7, 4], [8, 9, 4], [12, 11, 4]], [[0, 12, 8], [8, 10, 4], [12, 8, 4]], [[0, 3, 4], [4, 5, 4], [8, 7, 4], [12, 9, 4]], [[0, 7, 8, 1], [8, 5, 8]]),
  },
  lead: lead('pulse', 0.125, 0.5, 40, 2),
  pad: 'held',
  bass: [bh(0, 0, 6, 1), bh(6, 1, 2, 0.6), bh(8, 0, 4, 0.8), bh(12, 2, 4, 0.7)],
  bassAlt: [bh(0, 0, 4, 1), bh(4, 2, 4, 0.7), bh(8, 1, 4, 0.75), bh(12, 3, 4, 0.7)],
  arp: {
    a: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 3],
    b: [5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 1, 2],
    rests: [3, 7, 11, 15],
    restP: 0.15,
  },
  arpAlt: {
    a: [0, 2, 4, 2, 0, 2, 4, 6, 0, 2, 4, 2, 0, 2, 4, 6],
    b: [6, 4, 2, 4, 6, 4, 2, 0, 6, 4, 2, 4, 6, 4, 2, 0],
    rests: ODD_STEPS,
    restP: 0.05,
  },
  drums: {
    kick: [hit(0, 1), hit(7, 0.6)],
    kickTurn: [hit(10, 0.6)],
    perc: [hit(12, 0.8)],
    percOdd: [hit(9, 0.35)],
    hat: EIGHTHS.map((s) => hh(s, s % 4 === 2 ? 0.6 : 0.35, false)),
  },
  bed: { bass: 'triangle', pad: 'triangle', arp: 'square', padDetune: 22 },
});

// ---------------------------------------------------------------------------------------
// Music v3.6 (Ryan: "more tunes"): four more level tunes, ten in rotation. Each keeps the
// A, B, S (arpeggio section and timed space breakdown) and bridge form, in a mode, key, tempo
// and lead of its own.

// Starfall Charge: G major, 148 BPM, the up tempo heroic tune. A brassy saw lead opens on a
// fanfare leap of a fifth in dotted rhythm, an octave bouncing bass, a march kick.

const SC = {
  g: triad('G', 'I', 7, 4),
  bm: triad('Bm', 'iii', 11, 3),
  c: triad('C', 'IV', 0, 4),
  d: triad('D', 'V', 2, 4),
  em: triad('Em', 'vi', 4, 3),
  am: triad('Am', 'ii', 9, 3),
};

const CHARGE: LevelTune = level({
  id: 'charge',
  name: 'Starfall Charge',
  mood: 'up tempo and heroic, G major, brassy saw fanfare over an octave bass and a march kick',
  bpm: 148,
  root: 67,
  mode: 'ionian',
  sections: DRIVE_FORM,
  chords: { A: [SC.g, SC.bm, SC.c, SC.d], B: [SC.em, SC.c, SC.am, SC.d], S: [SC.c, SC.c, SC.g, SC.d], C: [SC.am, SC.em, SC.c, SC.d] },
  phrases: {
    A: phrase(
      [[0, 0, 3], [3, 4, 1], [4, 4, 4], [8, 5, 2], [10, 4, 2], [12, 7, 4]],
      [[0, 6, 3], [3, 5, 1], [4, 4, 6], [10, 2, 2], [12, 4, 4]],
      [[0, 5, 3], [3, 6, 1], [4, 7, 4], [8, 9, 4], [12, 8, 2], [14, 7, 2]],
      [[0, 8, 6, 1], [6, 7, 2], [8, 9, 8]],
    ),
    B: phrase(
      [[0, 7, 2], [2, 7, 1], [3, 7, 1], [4, 9, 4], [8, 7, 2], [10, 5, 2], [12, 4, 4]],
      [[0, 3, 2], [2, 3, 1], [3, 3, 1], [4, 5, 4], [8, 7, 8, 1]],
      [[0, 5, 2], [2, 5, 1], [3, 6, 1], [4, 7, 2], [6, 8, 2], [8, 9, 6], [14, 8, 2]],
      [[0, 8, 4], [4, 6, 4], [8, 4, 8]],
    ),
    S: phrase([[0, 14, 8], [8, 11, 8]], [[4, 12, 12, 1]], [[0, 9, 10], [10, 10, 6]], [[8, 13, 8, 1]]),
    C: phrase(
      [[0, 9, 3], [3, 8, 3], [6, 7, 2], [8, 8, 3], [11, 7, 3], [14, 5, 2]],
      [[0, 6, 3], [3, 5, 3], [6, 4, 2], [8, 5, 8]],
      [[0, 7, 3], [3, 6, 3], [6, 5, 2], [8, 6, 3], [11, 5, 3], [14, 3, 2]],
      [[0, 4, 4], [4, 6, 4], [8, 8, 8, 1]],
    ),
  },
  lead: lead('sawtooth', 0.5, 0.5, 20, 2),
  pad: 'held',
  bass: [bh(0, 0, 2, 1), bh(2, 3, 2, 0.75), bh(4, 0, 2, 0.85), bh(6, 3, 2, 0.75), bh(8, 0, 2, 0.95), bh(10, 3, 2, 0.75), bh(12, 2, 2, 0.85), bh(14, 1, 2, 0.75)],
  bassAlt: [bh(0, 0, 3, 1), bh(3, 0, 3, 0.8), bh(6, 2, 2, 0.8), bh(8, 0, 3, 0.95), bh(11, 0, 3, 0.8), bh(14, 3, 2, 0.8)],
  arp: {
    a: [0, 2, 4, 2, 0, 2, 4, 6, 1, 3, 5, 3, 1, 3, 5, 4],
    b: [4, 3, 2, 0, -1, 0, 2, 3, 4, 5, 6, 5, 4, 2, 1, 0],
    rests: [5, 13],
    restP: 0.08,
  },
  arpAlt: {
    a: [0, 4, 2, 4, 0, 4, 2, 4, 1, 5, 3, 5, 1, 5, 3, 5],
    b: [5, 3, 5, 1, 5, 3, 5, 1, 4, 2, 4, 0, 4, 2, 4, 0],
    rests: [3, 7, 11, 15],
    restP: 0.05,
  },
  drums: {
    kick: [hit(0, 1), hit(6, 0.75), hit(8, 0.95), hit(12, 0.85)],
    kickTurn: [hit(10, 0.7)],
    perc: [hit(4, 1), hit(12, 1)],
    percOdd: [hit(10, 0.4)],
    hat: STEPS16.map((s) => (s % 2 === 1 ? hh(s, 0.4, true) : hh(s, s % 4 === 0 ? 0.55 : 0.95, false))),
  },
  bed: { bass: 'triangle', pad: 'sawtooth', arp: 'sawtooth', padDetune: 11 },
});

// Rust Foundry: F# phrygian dominant, 118 BPM, the dark industrial tune. A thin nasal pulse
// hammers repeated low notes, the flat second (G) grinding on the major tonic, a locomotive
// sixteenth bass and a clanking clap on the off beats.

const RF = {
  fs: triad('F#', 'I', 6, 4),
  g: triad('G', 'bII', 7, 4),
  bm: triad('Bm', 'iv', 11, 3),
  em: triad('Em', 'bvii', 4, 3),
  d: aug('D+', 'bVI+', 2),
};

const FOUNDRY: LevelTune = level({
  id: 'foundry',
  name: 'Rust Foundry',
  mood: 'dark and industrial, F# phrygian dominant, thin pulse hammering low notes over a locomotive bass',
  bpm: 118,
  root: 66,
  mode: 'phrygdom',
  sections: DRIVE_FORM,
  chords: { A: [RF.fs, RF.g, RF.fs, RF.em], B: [RF.bm, RF.em, RF.g, RF.d], S: [RF.g, RF.g, RF.bm, RF.fs], C: [RF.em, RF.bm, RF.d, RF.g] },
  phrases: {
    A: phrase(
      [[0, 0, 1], [2, 0, 1], [3, 1, 2], [6, 0, 1], [8, 0, 1], [10, 1, 1], [11, 2, 3], [14, 1, 2]],
      [[0, 0, 4], [4, -1, 2], [6, 0, 2], [8, 4, 1], [10, 4, 1], [11, 5, 3], [14, 4, 2]],
      [[0, 4, 1], [2, 4, 1], [3, 5, 2], [6, 4, 1], [8, 7, 4], [12, 6, 2], [14, 5, 2]],
      [[0, 4, 8, 1], [8, 1, 4], [12, 0, 4]],
    ),
    B: phrase(
      [[0, 3, 6], [6, 4, 2], [8, 5, 5, 1], [13, 4, 3]],
      [[0, 6, 4], [4, 5, 4], [8, 4, 4], [12, 3, 4]],
      [[0, 8, 6, 1], [6, 7, 2], [8, 8, 2], [10, 9, 2], [12, 10, 4]],
      [[0, 8, 12, 1], [12, 7, 4]],
    ),
    S: phrase([[0, 7, 4], [4, 8, 4], [8, 7, 8]], [[0, 5, 4], [4, 4, 12, 1]], [[0, 3, 8], [8, 4, 8]], [[0, 1, 4], [4, 2, 4], [8, 0, 8, 1]]),
    C: phrase(
      [[0, 10, 2], [2, 8, 2], [4, 7, 1], [5, 8, 1], [6, 7, 2], [8, 5, 2], [10, 4, 2], [12, 1, 4]],
      [[0, 2, 2], [2, 1, 1], [3, 2, 1], [4, 4, 4], [8, 2, 8]],
      [[0, 9, 2], [2, 7, 2], [4, 6, 1], [5, 7, 1], [6, 6, 2], [8, 4, 2], [10, 3, 2], [12, 1, 4, 1]],
      [[0, 0, 4], [4, 1, 4], [8, 0, 8, 1]],
    ),
  },
  lead: lead('pulse', 0.125, 0.25, 8, 1),
  pad: 'chip',
  bass: [bh(0, 0, 1, 1), bh(1, 0, 1, 0.6), bh(3, 0, 1, 0.8), bh(4, 0, 1, 0.9), bh(6, 1, 1, 0.7), bh(7, 0, 1, 0.6), bh(8, 0, 1, 0.95), bh(9, 0, 1, 0.6), bh(11, 0, 1, 0.8), bh(12, 2, 1, 0.85), bh(14, 1, 1, 0.7), bh(15, 0, 1, 0.6)],
  bassAlt: [bh(0, 0, 2, 1), bh(2, 0, 2, 0.7), bh(4, 3, 2, 0.8), bh(6, 0, 2, 0.7), bh(8, 0, 4, 0.95), bh(12, 1, 2, 0.75), bh(14, 0, 2, 0.7)],
  arp: {
    a: [0, 0, 1, 0, 2, 0, 1, 0, 0, 0, 1, 0, 3, 2, 1, 0],
    b: [-1, -1, 0, -1, 1, -1, 0, -1, 0, 0, 2, 1, 0, -1, 0, 1],
    rests: [7, 15],
    restP: 0.1,
  },
  arpAlt: {
    a: [0, 1, 0, -1, 0, 1, 2, 1, 0, 1, 0, -1, 0, 1, 3, 2],
    b: [2, 1, 2, 3, 2, 1, 0, 1, 2, 1, 2, 3, 4, 3, 2, 1],
    rests: [2, 6, 10, 14],
    restP: 0.05,
  },
  drums: {
    kick: [hit(0, 1), hit(6, 0.8), hit(8, 1), hit(11, 0.75)],
    kickTurn: [hit(13, 0.6)],
    perc: [hit(4, 1), hit(12, 1)],
    percOdd: [hit(10, 0.55)],
    hat: STEPS16.map((s) => hh(s, s % 4 === 2 ? 0.9 : s % 2 === 0 ? 0.5 : 0.65, s % 2 === 1)),
  },
  bed: { bass: 'sawtooth', pad: 'square', arp: 'square', padDetune: 5 },
});

// Aurora Veil: Bb lydian dominant, 104 BPM, the dreamy space tune. A soft FM bell with a touch
// of vibrato floats in wide leaps over the raised fourth and the flat seventh, sine bass, slow
// wide pads with wind on every bar and an 8 bar breakdown.

const AV = {
  bb: triad('Bb', 'I', 10, 4),
  c: triad('C', 'II', 0, 4),
  fm: triad('Fm', 'v', 5, 3),
  gm: triad('Gm', 'vi', 7, 3),
  ab: aug('Ab+', 'bVII+', 8),
};

const AURORA: LevelTune = level({
  id: 'aurora',
  name: 'Aurora Veil',
  mood: 'space: Bb lydian dominant, soft bell lead in wide leaps, sine bass, wide pads and wind',
  bpm: 104,
  root: 70,
  mode: 'lydiandom',
  sections: SPACE_FORM,
  space: true,
  chords: { A: [AV.bb, AV.c, AV.gm, AV.c], B: [AV.fm, AV.gm, AV.ab, AV.c], S: [AV.bb, AV.bb, AV.c, AV.c], C: [AV.gm, AV.fm, AV.c, AV.ab] },
  phrases: {
    A: phrase([[0, 4, 4], [4, 7, 4], [8, 9, 8, 1]], [[0, 8, 2], [2, 7, 2], [4, 5, 12]], [[0, 3, 4], [4, 5, 4], [8, 10, 6], [14, 9, 2]], [[0, 8, 10, 1], [10, 6, 2], [12, 7, 4]]),
    B: phrase([[0, 9, 3], [3, 11, 5], [8, 10, 8]], [[0, 7, 6, 1], [6, 6, 2], [8, 4, 8]], [[0, 5, 3], [3, 8, 5], [8, 12, 4], [12, 11, 4]], [[0, 10, 16, 1]]),
    S: phrase([[0, 12, 8], [8, 14, 8, 1]], [[0, 13, 16]], [[0, 11, 6], [6, 9, 10]], [[0, 7, 16, 1]]),
    C: phrase(
      [[0, 1, 2], [2, 3, 2], [4, 5, 3], [7, 6, 3], [10, 5, 2], [12, 3, 4]],
      [[0, 4, 2], [2, 6, 2], [4, 8, 4], [8, 9, 2], [10, 8, 2], [12, 6, 4]],
      [[0, 7, 2], [2, 9, 2], [4, 11, 4], [8, 12, 8, 1]],
      [[0, 10, 8], [8, 8, 8]],
    ),
  },
  lead: lead('bell', 0.5, 0.5, 12, 2),
  pad: 'held',
  bass: [bh(0, 0, 10, 0.9), bh(10, 2, 6, 0.65)],
  bassAlt: [bh(0, 0, 6, 0.9), bh(6, 2, 2, 0.6), bh(8, 3, 8, 0.7)],
  arp: {
    a: [0, 4, 2, 5, 4, 7, 5, 4, 0, 4, 2, 5, 4, 7, 6, 4],
    b: [7, 4, 5, 2, 4, 0, 2, -1, 7, 4, 5, 2, 4, 1, 2, 0],
    rests: ODD_STEPS,
    restP: 0.25,
  },
  arpAlt: {
    a: [0, 2, 0, 4, 0, 5, 0, 7, 0, 2, 0, 4, 0, 5, 0, 4],
    b: [7, 5, 7, 4, 7, 2, 7, 0, 7, 5, 7, 4, 7, 2, 4, 2],
    rests: [1, 3, 5, 6, 7, 9, 11, 13, 14, 15],
    restP: 0,
  },
  drums: {
    kick: [hit(0, 0.75), hit(10, 0.5)],
    kickTurn: [hit(6, 0.5)],
    perc: [hit(12, 0.6)],
    percOdd: [hit(4, 0.3)],
    hat: [hh(2, 0.35, false), hh(6, 0.45, false), hh(10, 0.35, false), hh(14, 0.45, false), hh(15, 0.25, true)],
  },
  bed: { bass: 'sine', pad: 'triangle', arp: 'sine', padDetune: 25 },
});

// Pixel Hop: C# six note major (no seventh), 132 BPM, the bouncy chiptune tune. A 25 percent
// pulse that opens to a square in B hops in octave leaps and staccato off beats over an oom pah
// bass and a chip arpeggio.

const PH = {
  cs: triad('C#', 'I', 1, 4),
  dsm: triad('D#m', 'ii', 3, 3),
  fs: triad('F#', 'IV', 6, 4),
  asm: triad('A#m', 'vi', 10, 3),
};

const PIXEL: LevelTune = level({
  id: 'pixel',
  name: 'Pixel Hop',
  mood: 'bouncy chiptune, C# six note major, hopping pulse lead in octave leaps over an oom pah bass',
  bpm: 132,
  root: 73,
  mode: 'hexmajor',
  sections: DRIVE_FORM,
  chords: { A: [PH.cs, PH.asm, PH.dsm, PH.fs], B: [PH.fs, PH.cs, PH.dsm, PH.asm], S: [PH.fs, PH.fs, PH.cs, PH.cs], C: [PH.asm, PH.dsm, PH.fs, PH.fs] },
  phrases: {
    A: phrase(
      [[0, 0, 1], [1, 6, 1], [4, 4, 1], [6, 5, 1], [8, 4, 2], [11, 2, 1], [12, 4, 3]],
      [[0, 3, 1], [1, 8, 1], [4, 7, 1], [6, 5, 1], [8, 4, 2], [11, 5, 1], [12, 3, 3]],
      [[0, 2, 1], [1, 7, 1], [4, 6, 1], [6, 7, 1], [8, 8, 2], [11, 9, 1], [12, 10, 3]],
      [[0, 9, 2], [2, 8, 2], [4, 6, 4], [8, 5, 1], [10, 4, 1], [12, 6, 4, 1]],
    ),
    B: phrase(
      [[0, 6, 2], [2, 4, 2], [4, 6, 1], [5, 7, 1], [6, 8, 2], [8, 9, 3], [11, 8, 1], [12, 6, 4]],
      [[0, 7, 3], [3, 6, 1], [4, 4, 4], [8, 3, 2], [10, 4, 2], [12, 2, 4]],
      [[0, 4, 1], [1, 5, 1], [2, 6, 1], [3, 7, 1], [4, 8, 3], [7, 9, 1], [8, 10, 4], [12, 12, 4, 1]],
      [[0, 11, 6], [6, 9, 2], [8, 7, 8]],
    ),
    S: phrase([[0, 10, 4], [4, 12, 4], [8, 11, 8]], [[2, 9, 6], [8, 10, 8, 1]], [[0, 12, 12], [12, 13, 4]], [[0, 11, 16, 1]]),
    C: phrase(
      [[0, 5, 2], [2, 5, 2], [4, 6, 2], [6, 7, 6], [12, 6, 4]],
      [[0, 4, 2], [2, 4, 2], [4, 5, 2], [6, 6, 6], [12, 4, 4]],
      [[0, 3, 2], [2, 3, 2], [4, 4, 2], [6, 5, 6], [12, 7, 2], [14, 8, 2]],
      [[0, 9, 4, 1], [4, 8, 4], [8, 6, 8]],
    ),
  },
  lead: lead('pulse', 0.25, 0.5, 16, 1),
  pad: 'chip',
  bass: [bh(0, 0, 2, 1), bh(4, 2, 2, 0.75), bh(6, 3, 1, 0.6), bh(8, 0, 2, 0.95), bh(12, 2, 2, 0.75), bh(14, 3, 1, 0.6)],
  bassAlt: [bh(0, 0, 1, 1), bh(2, 3, 1, 0.7), bh(4, 0, 1, 0.85), bh(6, 3, 1, 0.7), bh(8, 2, 1, 0.9), bh(10, 3, 1, 0.7), bh(12, 1, 1, 0.85), bh(14, 3, 1, 0.7)],
  arp: {
    a: [0, 2, 4, 5, 4, 2, 0, 2, 1, 3, 4, 6, 4, 3, 1, 3],
    b: [5, 4, 2, 0, 2, 4, 5, 7, 6, 4, 2, 1, 2, 4, 6, 4],
    rests: [3, 11],
    restP: 0.05,
  },
  arpAlt: {
    a: [0, 5, 0, 5, 2, 5, 2, 5, 1, 4, 1, 4, 3, 6, 3, 6],
    b: [6, 3, 6, 3, 4, 1, 4, 1, 5, 2, 5, 2, 4, 0, 4, 0],
    rests: [],
    restP: 0.15,
  },
  drums: {
    kick: [hit(0, 1), hit(5, 0.7), hit(8, 0.95), hit(12, 0.8)],
    kickTurn: [hit(10, 0.65)],
    perc: [hit(4, 1), hit(12, 1)],
    percOdd: [hit(13, 0.4)],
    hat: [hh(0, 0.4, false), hh(2, 1, false), hh(6, 1, false), hh(7, 0.4, true), hh(8, 0.4, false), hh(10, 1, false), hh(14, 1, false), hh(15, 0.4, true)],
  },
  bed: { bass: 'triangle', pad: 'triangle', arp: 'square', padDetune: 4 },
});

// ---------------------------------------------------------------------------------------
// Bed loudness trim (B20). The layer gains were tuned on a triangle bass, a saw pad and a square
// lead. On a phone speaker the sub bass fundamental is inaudible and only its harmonics come
// through, so a saw or square bass at the same gain jumps far in front of the triangle and buries
// the motifs. Each bed note is scaled by the ratio of the reference wave's weight to the tune's
// wave weight, never above 1, so a brighter wave is pulled back to the reference and a softer
// one stays soft.

/** Rough loudness weight of a wave once the bed filters and a phone speaker have had it. */
export const WAVE_WEIGHT: Readonly<Record<OscillatorType, number>> = {
  sine: 0.7,
  triangle: 0.7,
  sawtooth: 1,
  square: 1.05,
  custom: 1,
};

/** The reference bed the layer gains were tuned on. */
export const REFERENCE_BED: BedTimbre = { bass: 'triangle', pad: 'sawtooth', arp: 'square', padDetune: 9 };

/** Pure: the gain factor (0 to 1) for one bed layer of a tune. Drums are never trimmed. */
export function bedWaveTrim(layer: Layer, bed: BedTimbre): number {
  if (layer !== 'bass' && layer !== 'pad' && layer !== 'arp') return 1;
  const ref = WAVE_WEIGHT[REFERENCE_BED[layer]];
  const own = WAVE_WEIGHT[bed[layer]];
  return own > 0 ? Math.min(1, ref / own) : 1;
}

/** Every level tune, in selection order. */
export const TUNES: readonly LevelTune[] = [NEON, TIDE, EMBER, ORBIT, NEBULA, HORIZON, CHARGE, FOUNDRY, AURORA, PIXEL];

export const DEFAULT_TUNE: LevelTune = NEON;

/** Pure: a tune by id (the default for an unknown id). */
export function tuneById(id: string): LevelTune {
  return TUNES.find((t) => t.id === id) ?? DEFAULT_TUNE;
}

/** Pure: the bar wrapped into a tune's loop. */
export function tuneBar(t: Tune, bar: number): number {
  const b = Math.trunc(bar);
  return ((b % t.loopBars) + t.loopBars) % t.loopBars;
}

/** Pure: the pass of the loop a bar is in (0 for the first time through). */
export function passOf(t: Tune, bar: number): number {
  return Math.floor(Math.trunc(bar) / t.loopBars);
}

/** Pure: the voicing of a bar's chord in a tune. */
export function voicingForBar(t: Tune, bar: number): ChordVoicing {
  const h = t.key.bars[tuneBar(t, bar)] ?? HARMONIES.Am;
  return t.voicings[h.name] ?? voiced(h, 0);
}

// ---------------------------------------------------------------------------------------
// Fills (a 2 bar fill at a phase change). Shared by every tune; the run takes the tune's
// chords. Bar 0 opens the hats to every sixteenth; bar 1 adds kicks, a clap roll that decays
// before the bar line, a hat roll and a chord tone run in place of the lead.

export const FILL_BARS = 2;
export const FILL_KICK: readonly DrumHit[] = [hit(0, 1), hit(4, 0.9), hit(8, 0.9), hit(10, 0.75), hit(12, 0.9)];
export const FILL_PERC: readonly DrumHit[] = [hit(4, 1), hit(8, 0.6), hit(12, 1), hit(13, 0.7), hit(14, 0.85)];
/** Chord degrees of the run, one per sixteenth, counted from the chord root nearest an octave under the tune root. */
export const FILL_RUN: readonly number[] = [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6];

// ---------------------------------------------------------------------------------------
// Boss keys (v3 wave B, docs/13 SPEC 3.9 item 4). A boss motif is composed in A at 120 BPM
// inside its tier scale, over a chord plan built from that scale (two bars a chord):
//   tier 1 (minor pentatonic): Am F C G;
//   tier 2 (natural minor with a raised seventh): Am F Dm E, the E major chord carries the G sharp;
//   tier 3 (phrygian second): Am Bb Gm Bb, the flat second leaning back onto the tonic;
//   tier 4 (natural minor): Am F C G; Prism's quoting loop sits on it.
// The fight itself plays a battle track (below); motif notes are fitted to its chords at play time.

const B_DM = triad('Dm', 'iv', 2, 3);
const B_E = triad('E', 'V', 4, 4);
const B_BB = triad('Bb', 'bII', 10, 4);
const B_GM = triad('Gm', 'vii', 7, 3);

function barsOf2(chords: readonly Harmony[]): Harmony[] {
  return chords.flatMap((h) => [h, h]);
}

/** Boss keys per tier, all on A at 120 BPM. */
export const BOSS_KEYS: Readonly<Record<1 | 2 | 3 | 4, Key>> = {
  1: DEFAULT_KEY,
  2: { tonic: 9, scale: [9, 11, 0, 2, 4, 5, 8], bars: barsOf2([HARMONIES.Am, HARMONIES.F, B_DM, B_E]) },
  3: { tonic: 9, scale: [9, 10, 0, 2, 4, 5, 7], bars: barsOf2([HARMONIES.Am, B_BB, B_GM, B_BB]) },
  4: DEFAULT_KEY,
};

// ---------------------------------------------------------------------------------------
// Boss battle tracks (G3C retest, Ryan: "unique battle boss music so users become accustomed to
// the type of battle when they hear the change", minor keys, at least three tracks). Each is in
// its own minor mode within a fourth of A (D harmonic minor, A phrygian, E dorian) at its own
// tempo, with a written A B A C form (16 bars, so the A phrase returns every 8 bars), a one bar
// intro hit on the cross fade, kick and clap at double the density of the level tunes, and a
// bass that jumps octaves on bars 4 and 8 of every 8. No space breakdown: a fight stays intense.
// BOSS_KEYS above stays the key the boss motifs are composed in; at play time each motif note is
// fitted to the battle track's chord and scale (battle.ts fitBattleNote).

/** The battle form: A, B, A, the bridge. */
const BATTLE_FORM: readonly Section[] = ['A', 'B', 'A', 'C'];

const V = {
  dm: triad('Dm', 'i', 2, 3),
  bb: triad('Bb', 'VI', 10, 4),
  gm: triad('Gm', 'iv', 7, 3),
  a: triad('A', 'V', 9, 4),
};

/** Iron Verdict: D harmonic minor, 120 BPM, a marching thin pulse lead over a chip arpeggio. */
const VERDICT: Tune = {
  ...song({
    id: 'verdict',
    name: 'Iron Verdict',
    mood: 'boss: D harmonic minor, marching thin pulse lead, sixteenth runs in B, chip arpeggio',
    bpm: 120,
    root: 74,
    mode: 'harmonic',
    sections: BATTLE_FORM,
    chords: { A: [V.dm, V.bb, V.gm, V.a], B: [V.gm, V.dm, V.bb, V.a], C: [V.bb, V.a, V.dm, V.a] },
    phrases: {
      A: phrase(
        [[0, 0, 2], [2, 0, 1], [3, 0, 1], [4, 4, 4], [8, 2, 2], [10, 2, 1], [11, 2, 1], [12, 7, 4]],
        [[0, 5, 2], [2, 4, 1], [3, 5, 1], [4, 7, 4], [8, 9, 6, 1], [14, 7, 2]],
        [[0, 8, 2], [2, 7, 1], [3, 8, 1], [4, 10, 4], [8, 7, 4], [12, 5, 4]],
        [[0, 6, 6], [6, 4, 2], [8, 1, 2], [10, 4, 2], [12, 6, 4, 1]],
      ),
      B: phrase(
        [[0, 3, 1], [1, 4, 1], [2, 5, 1], [3, 7, 1], [4, 10, 4], [8, 8, 1], [9, 7, 1], [10, 5, 1], [11, 3, 1], [12, 2, 2], [14, 0, 2]],
        [[0, 4, 2], [2, 2, 2], [4, 0, 2], [6, 2, 2], [8, 4, 6], [14, 6, 2]],
        [[0, 5, 1], [1, 7, 1], [2, 9, 1], [3, 12, 1], [4, 11, 2], [6, 9, 2], [8, 7, 1], [9, 9, 1], [10, 11, 1], [11, 12, 1], [12, 14, 4]],
        [[0, 13, 8, 1], [8, 11, 8]],
      ),
      C: phrase([[0, 12, 4], [4, 11, 4], [8, 9, 6], [14, 7, 2]], [[0, 8, 4], [4, 6, 4], [8, 4, 8, 1]], [[0, 7, 2], [2, 9, 2], [4, 11, 2], [6, 14, 10]], [[0, 13, 4], [4, 11, 4], [8, 13, 8, 1]]),
    },
    lead: lead('pulse', 0.125, 0.25, 22, 1),
    pad: 'chip',
    bass: [bh(0, 0, 1, 1), bh(1, 0, 1, 0.6), bh(2, 3, 1, 0.8), bh(4, 0, 1, 0.9), bh(5, 0, 1, 0.6), bh(6, 3, 1, 0.8), bh(8, 0, 1, 0.95), bh(9, 0, 1, 0.6), bh(10, 3, 1, 0.8), bh(12, 2, 1, 0.85), bh(13, 2, 1, 0.6), bh(14, 1, 2, 0.8)],
    bassAlt: EIGHTHS.map((s) => bh(s, s === 6 || s === 14 ? 2 : 0, 2, s % 8 === 0 ? 1 : 0.8)),
    arp: { a: [0, 2, 4, 2, 5, 4, 2, 4, 0, 2, 4, 2, 7, 5, 4, 2], b: [5, 4, 2, 0, 1, 2, 4, 5, 7, 5, 4, 5, 2, 1, 0, -1], rests: [3, 11], restP: 0 },
    arpAlt: { a: [0, 0, 4, 4, 2, 2, 5, 5, 4, 4, 2, 2, 1, 1, 0, 0], b: [5, 5, 4, 4, 2, 2, 4, 4, 7, 7, 5, 5, 4, 4, 2, 2], rests: ODD_STEPS, restP: 0 },
    drums: {
      kick: [hit(0, 1), hit(4, 0.9), hit(6, 0.75), hit(8, 0.95), hit(10, 0.75), hit(12, 0.9), hit(13, 0.7)],
      kickTurn: [],
      perc: [hit(4, 1), hit(6, 0.55), hit(10, 0.6), hit(12, 1), hit(14, 0.6)],
      percOdd: [hit(9, 0.4)],
      hat: STEPS16.map((s) => (s % 2 === 1 ? hh(s, s % 4 === 3 ? 0.7 : 0.5, true) : hh(s, s % 4 === 2 ? 1 : 0.65, false))),
    },
    bed: { bass: 'triangle', pad: 'square', arp: 'square', padDetune: 14 },
  }),
  battle: true,
  bassJump: [bh(0, 0, 2, 1), bh(2, 3, 2, 0.85), bh(4, 0, 2, 0.9), bh(6, 3, 2, 0.85), bh(8, 0, 2, 0.95), bh(10, 3, 2, 0.85), bh(12, 0, 1, 0.9), bh(13, 3, 1, 0.8), bh(14, 0, 1, 0.85), bh(15, 3, 1, 0.8)],
  // Three hammered root and fifth stabs, then a held chord.
  intro: [ih(0, [0, 3], 1, 1), ih(2, [0, 3], 1, 0.9), ih(4, [0, 3], 1, 0.95), ih(8, [0, 1, 2], 6, 0.9)],
};

const M = {
  am: triad('Am', 'i', 9, 3),
  bb: triad('Bb', 'bII', 10, 4),
  gm: triad('Gm', 'vii', 7, 3),
  f: triad('F', 'VI', 5, 4),
  dm: triad('Dm', 'iv', 2, 3),
  c: triad('C', 'III', 0, 4),
};

/** Black Meridian: A phrygian, 128 BPM, repeated note saw stabs and octave leaps. */
const MERIDIAN: Tune = {
  ...song({
    id: 'meridian',
    name: 'Black Meridian',
    mood: 'boss: A phrygian, repeated note saw stabs, octave leaps in B, broken kick',
    bpm: 128,
    root: 69,
    mode: 'phrygian',
    sections: BATTLE_FORM,
    chords: { A: [M.am, M.bb, M.am, M.gm], B: [M.f, M.gm, M.dm, M.bb], C: [M.dm, M.c, M.bb, M.bb] },
    phrases: {
      A: phrase(
        [[0, 4, 1], [1, 4, 1], [2, 4, 2], [4, 5, 2], [6, 4, 2], [8, 2, 1], [9, 2, 1], [10, 2, 2], [12, 1, 2], [14, 0, 2]],
        [[0, 1, 4], [4, 3, 2], [6, 5, 6], [12, 4, 2], [14, 3, 2]],
        [[0, 4, 1], [1, 4, 1], [2, 4, 2], [4, 7, 2], [6, 8, 2], [8, 9, 4], [12, 8, 2], [14, 7, 2]],
        [[0, 6, 6, 1], [6, 5, 2], [8, 3, 8]],
      ),
      B: phrase(
        [[0, 5, 2], [2, 12, 2], [4, 9, 4], [8, 7, 2], [10, 14, 2], [12, 12, 4]],
        [[0, 6, 2], [2, 13, 2], [4, 10, 4], [8, 8, 8, 1]],
        [[0, 3, 2], [2, 10, 2], [4, 7, 4], [8, 5, 2], [10, 12, 2], [12, 10, 4]],
        [[0, 8, 12, 1], [12, 7, 4]],
      ),
      C: phrase([[0, 10, 6], [6, 9, 6], [12, 8, 4]], [[0, 9, 6], [6, 7, 6], [12, 6, 4]], [[0, 8, 6], [6, 5, 6], [12, 3, 4]], [[0, 1, 16, 1]]),
    },
    lead: lead('sawtooth', 0.5, 0.5, 15, 1),
    pad: 'held',
    bass: [bh(0, 0, 3, 1), bh(3, 0, 1, 0.75), bh(4, 3, 1, 0.8), bh(6, 0, 2, 0.8), bh(8, 0, 1, 0.95), bh(9, 0, 1, 0.6), bh(10, 3, 1, 0.8), bh(11, 0, 1, 0.7), bh(12, 2, 2, 0.85), bh(14, 3, 1, 0.75), bh(15, 2, 1, 0.7)],
    bassAlt: [bh(0, 0, 4, 1), bh(4, 0, 2, 0.8), bh(6, 3, 2, 0.8), bh(8, 0, 4, 0.95), bh(12, 2, 2, 0.8), bh(14, 1, 2, 0.75)],
    arp: { a: [4, 4, 3, 4, 4, 2, 1, 0, 4, 4, 3, 4, 5, 4, 2, 1], b: [4, 4, 3, 4, 4, 6, 5, 4, 2, 2, 1, 2, 1, 0, -1, 0], rests: [2, 10], restP: 0 },
    arpAlt: { a: [0, 1, 2, 1, 0, 1, 2, 4, 0, 1, 2, 1, 0, -1, 0, 1], b: [4, 2, 1, 2, 4, 5, 4, 2, 1, 0, -1, 0, 1, 2, 1, 0], rests: [3, 7, 11, 15], restP: 0 },
    drums: {
      kick: [hit(0, 1), hit(3, 0.8), hit(6, 0.85), hit(9, 0.8), hit(11, 0.75), hit(13, 0.8)],
      kickTurn: [],
      perc: [hit(4, 0.7), hit(7, 0.55), hit(8, 1), hit(10, 0.55), hit(12, 0.8), hit(14, 0.6)],
      percOdd: [hit(5, 0.4)],
      hat: STEPS16.map((s) => (s % 2 === 1 ? hh(s, s % 4 === 3 ? 0.75 : 0.5, true) : hh(s, 0.8, false))),
    },
    bed: { bass: 'square', pad: 'sawtooth', arp: 'sawtooth', padDetune: 18 },
  }),
  battle: true,
  bassJump: [bh(0, 0, 3, 1), bh(3, 3, 1, 0.85), bh(4, 0, 2, 0.85), bh(6, 3, 2, 0.85), bh(8, 0, 1, 0.95), bh(9, 3, 1, 0.8), bh(10, 0, 2, 0.85), bh(12, 3, 2, 0.9), bh(14, 0, 2, 0.85)],
  // A low root hit, a flat second lean, then a rising root to octave slide of stabs.
  intro: [ih(0, [0], 3, 1), ih(3, [0, 3], 1, 0.85), ih(6, [0, 3], 1, 0.85), ih(9, [0, 1, 2], 2, 0.9), ih(12, [0, 3], 3, 1)],
};

const R = {
  em: triad('Em', 'i', 4, 3),
  d: triad('D', 'VII', 2, 4),
  a: triad('A', 'IV', 9, 4),
  bm: triad('Bm', 'v', 11, 3),
  fsm: triad('F#m', 'ii', 6, 3),
  g: triad('G', 'III', 7, 4),
};

/** Glass Requiem: E dorian, 136 BPM, a leaping triangle lead and galloping triplet figures. */
const REQUIEM: Tune = {
  ...song({
    id: 'requiem',
    name: 'Glass Requiem',
    mood: 'boss: E dorian, leaping triangle lead, galloping figures in B, paired kicks, chip arpeggio',
    bpm: 136,
    root: 64,
    mode: 'dorian',
    sections: BATTLE_FORM,
    chords: { A: [R.em, R.d, R.a, R.em], B: [R.bm, R.a, R.em, R.fsm], C: [R.g, R.d, R.a, R.bm] },
    phrases: {
      A: phrase(
        [[0, 7, 6], [6, 4, 1], [7, 9, 1], [8, 7, 4], [12, 6, 4]],
        [[0, 6, 4], [4, 8, 4], [8, 10, 8, 1]],
        [[0, 10, 2], [2, 8, 2], [4, 5, 2], [6, 3, 2], [8, 5, 4], [12, 10, 4]],
        [[0, 9, 10, 1], [10, 6, 2], [12, 4, 4]],
      ),
      B: phrase(
        [[0, 4, 1], [1, 6, 1], [2, 8, 2], [4, 11, 4], [8, 8, 1], [9, 6, 1], [10, 4, 2], [12, 1, 4]],
        [[0, 3, 1], [1, 5, 1], [2, 7, 2], [4, 10, 4], [8, 7, 8]],
        [[0, 7, 1], [1, 9, 1], [2, 11, 2], [4, 14, 4], [8, 11, 1], [9, 9, 1], [10, 7, 2], [12, 4, 4]],
        [[0, 5, 12, 1], [12, 8, 4]],
      ),
      C: phrase([[0, 9, 2], [2, 11, 2], [4, 9, 4], [8, 7, 8]], [[0, 6, 2], [2, 8, 2], [4, 10, 4], [8, 13, 8, 1]], [[0, 10, 2], [2, 12, 2], [4, 10, 4], [8, 8, 8]], [[0, 8, 4], [4, 6, 4], [8, 4, 8, 1]]),
    },
    lead: lead('triangle', 0.5, 0.5, 12, 2),
    pad: 'chip',
    bass: [bh(0, 0, 2, 1), bh(2, 0, 1, 0.7), bh(3, 1, 1, 0.7), bh(4, 2, 2, 0.85), bh(6, 0, 2, 0.75), bh(8, 0, 2, 0.95), bh(10, 2, 1, 0.75), bh(11, 1, 1, 0.7), bh(12, 0, 2, 0.85), bh(14, 3, 2, 0.8)],
    bassAlt: [bh(0, 0, 6, 1), bh(6, 2, 2, 0.75), bh(8, 0, 4, 0.9), bh(12, 3, 2, 0.8), bh(14, 2, 2, 0.75)],
    arp: { a: [0, 2, 5, 2, 1, 2, 5, 6, 0, 2, 5, 2, 4, 2, 1, 2], b: [5, 4, 0, 4, 5, 4, 2, 1, 0, 1, 2, 4, 2, 1, 0, -1], rests: [], restP: 0 },
    arpAlt: { a: [0, 0, 5, 5, 2, 2, 6, 6, 4, 4, 2, 2, 1, 1, 2, 2], b: [5, 5, 2, 2, 4, 4, 1, 1, 0, 0, 2, 2, -1, -1, 0, 0], rests: ODD_STEPS, restP: 0 },
    drums: {
      kick: [hit(0, 1), hit(3, 0.7), hit(4, 0.9), hit(7, 0.7), hit(8, 0.95), hit(11, 0.7), hit(12, 0.9)],
      kickTurn: [],
      perc: [hit(6, 0.8), hit(9, 0.5), hit(10, 1), hit(13, 0.5), hit(14, 0.8)],
      percOdd: [hit(5, 0.4)],
      hat: STEPS16.map((s) => (s % 2 === 1 ? hh(s, 0.5, true) : hh(s, s % 4 === 0 ? 0.9 : 0.6, false))),
    },
    bed: { bass: 'triangle', pad: 'square', arp: 'triangle', padDetune: 7 },
  }),
  battle: true,
  bassJump: [bh(0, 0, 4, 1), bh(4, 3, 2, 0.85), bh(6, 0, 2, 0.85), bh(8, 3, 4, 0.95), bh(12, 0, 2, 0.85), bh(14, 3, 2, 0.85)],
  // A bell chord, a long pause, a falling fifth to root pair, a held octave.
  intro: [ih(0, [0, 1, 2], 4, 1), ih(8, [2], 2, 0.85), ih(10, [0], 2, 0.9), ih(12, [0, 3], 4, 1)],
};

/** The boss battle tracks, in BATTLE_IDS order. */
export const BATTLE_TUNES: readonly Tune[] = [VERDICT, MERIDIAN, REQUIEM];
