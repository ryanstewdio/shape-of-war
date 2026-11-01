// Song form helpers (v3.4 music): mode scales, scale degrees, phrases, sections, the placed lead
// with slides, chip chords, the lead voice per section and the space breakdown on the track.
import { describe, expect, it } from 'vitest';
import {
  chipChord,
  formBars,
  fx,
  isSpaceBar,
  leadForBar,
  MODE_STEPS,
  modeScale,
  phrase,
  PLAIN_FX,
  scaleMidi,
  sectionOf,
} from '../../../src/audio/music/compose';
import { fitsHarmony, harmonyForBar, inChord, STEPS_PER_BAR } from '../../../src/audio/music/harmony';
import { buildBar, leadNotes, leadOctave, VIBRATO_MIN_STEPS } from '../../../src/audio/music/track';
import { BATTLE_TUNES, DEFAULT_TUNE, tuneById, TUNES } from '../../../src/audio/music/tunes';
import { PLAIN_TUNE } from './plainTune';

describe('modes and degrees', () => {
  it('every mode starts on its tonic and climbs inside one octave', () => {
    for (const steps of Object.values(MODE_STEPS)) {
      expect(steps[0]).toBe(0);
      for (let i = 1; i < steps.length; i++) expect(steps[i] ?? 0).toBeGreaterThan(steps[i - 1] ?? 0);
      expect(steps.at(-1) ?? 12).toBeLessThan(12);
    }
    expect(modeScale(2, 'lydian')).toEqual([2, 4, 6, 8, 9, 11, 1]);
    expect(modeScale(0, 'wholetone')).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('a scale degree is a MIDI note of the key, octaves by the mode length', () => {
    const a = { tonic: 9, scale: modeScale(9, 'aeolian'), bars: [] };
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((d) => scaleMidi(d, a, 69))).toEqual([69, 71, 72, 74, 76, 77, 79, 81]);
    expect(scaleMidi(-1, a, 69)).toBe(67);
    const w = { tonic: 0, scale: modeScale(0, 'wholetone'), bars: [] };
    expect(scaleMidi(6, w, 72)).toBe(84);
    expect(scaleMidi(-2, w, 72)).toBe(68);
  });

  it('phrase cells are placed bar by bar, with slides', () => {
    const p = phrase([[0, 1, 4], [4, 2, 4, 1]], [[8, 3, 8]]);
    expect(p).toEqual([
      { at: 0, deg: 1, dur: 4, slide: false },
      { at: 4, deg: 2, dur: 4, slide: true },
      { at: 24, deg: 3, dur: 8, slide: false },
    ]);
  });

  it('fx fills the rest from PLAIN_FX', () => {
    expect(fx({ echo: 2 })).toEqual({ ...PLAIN_FX, echo: 2 });
    expect(Object.isFrozen(PLAIN_FX)).toBe(true);
  });
});

describe('sections and the lead', () => {
  it('the loop is 4 bars a section; a formless tune has no section', () => {
    for (const t of [...TUNES, ...BATTLE_TUNES]) {
      const f = t.form;
      if (f === undefined) continue;
      expect(formBars(f)).toBe(t.loopBars);
      for (let b = 0; b < t.loopBars; b++) expect(sectionOf(t, b)).toBe(f.sections[Math.floor(b / 4)]);
    }
    expect(sectionOf(PLAIN_TUNE, 3)).toBeNull();
    expect(isSpaceBar(DEFAULT_TUNE, 8)).toBe(true);
    expect(isSpaceBar(DEFAULT_TUNE, 0)).toBe(false);
  });

  it('every lead note fits the harmony at its step; a slide starts on the previous note', () => {
    for (const t of [...TUNES, ...BATTLE_TUNES]) {
      let slides = 0;
      for (let b = 0; b < t.loopBars; b++) {
        for (const n of leadForBar(t, b)) {
          expect(fitsHarmony(n.midi, b * STEPS_PER_BAR + n.step, t.key), `${t.id} bar ${b} step ${n.step}`).toBe(true);
          if (n.slideFrom !== null) {
            slides++;
            expect(n.slideFrom).not.toBe(n.midi);
          }
        }
      }
      expect(slides, t.id).toBeGreaterThan(0);
    }
  });

  it('the lead voice: the B section changes the pulse duty, held notes get vibrato, the breakdown sends long echo', () => {
    const neon = DEFAULT_TUNE;
    const lv = neon.form?.lead;
    expect(lv?.wave).toBe('pulse');
    const a = leadNotes(neon, 0);
    const b = leadNotes(neon, 4);
    expect(new Set(a.map((n) => n.fx?.duty))).toEqual(new Set([lv?.duty]));
    expect(new Set(b.map((n) => n.fx?.duty))).toEqual(new Set([lv?.dutyB]));
    for (let bar = 0; bar < neon.loopBars; bar++) {
      for (const n of leadNotes(neon, bar)) {
        expect(n.fx?.vibrato).toBe(n.durSteps >= VIBRATO_MIN_STEPS ? lv?.vibrato : 0);
        expect(n.fx?.echo).toBe(isSpaceBar(neon, bar) ? 2 : lv?.echo);
      }
    }
    // The bell lead of Nebula Drift.
    const nebula = tuneById('nebula');
    for (const n of leadNotes(nebula, 0)) expect(n.fx?.bell).toBe(true);
  });

  it('the A section moves an octave on passes 2 and 3 of every 4; battle tracks never move it', () => {
    for (const t of TUNES) {
      expect([0, 1, 4, 5].map((p) => leadOctave(t, p))).toEqual([0, 0, 0, 0]);
      expect(Math.abs(leadOctave(t, 2))).toBe(12);
      const plain = leadNotes(t, 0, 0).map((n) => n.midi ?? 0);
      const moved = leadNotes(t, 0, 2).map((n) => n.midi ?? 0);
      expect(moved).toEqual(plain.map((m) => m + leadOctave(t, 2)));
      // The B section stays where it is.
      expect(leadNotes(t, 4, 2)).toEqual(leadNotes(t, 4, 0));
    }
    for (const t of BATTLE_TUNES) expect(leadOctave(t, 2)).toBe(0);
  });

  it('a chip pad is one voice stepping through the chord tones every half sixteenth', () => {
    const t = DEFAULT_TUNE;
    expect(t.form?.pad).toBe('chip');
    const pad = buildBar(1, 0, t).notes.filter((n) => n.layer === 'pad');
    expect(pad).toHaveLength(1);
    const chord = pad[0]?.fx?.chord ?? [];
    expect(chord).toEqual(chipChord(t, 0, pad[0]?.midi ?? 0));
    for (const m of chord) expect(inChord(m, harmonyForBar(0, t.key))).toBe(true);
    expect((chord[3] ?? 0) - (chord[0] ?? 0)).toBe(12);
    expect(pad[0]?.fx?.chordSec).toBeCloseTo(t.stepSec / 2, 12);
    // A held pad tune keeps the three note chord.
    expect(buildBar(1, 0, tuneById('tide')).notes.filter((n) => n.layer === 'pad')).toHaveLength(3);
  });
});
