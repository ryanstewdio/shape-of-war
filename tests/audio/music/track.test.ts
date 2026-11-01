import { describe, expect, it } from 'vitest';
import { hash01 } from '../../../src/core/rng';
import { voiceLength } from '../../../src/audio/music/engine';
import {
  BAR_SEC,
  buildBar,
  chordForBar,
  LOOP_BARS,
  loopBar,
  STEP_SEC,
  STEPS_PER_BAR,
  type TrackNote,
} from '../../../src/audio/music/track';
import { PLAIN_TUNE } from './plainTune';

// The hashed arp machinery runs on the formless test tune; the default tune has a written form.
const notesOf = (seed: number, bar: number, arp: boolean): TrackNote[] =>
  buildBar(seed, bar, PLAIN_TUNE).notes.filter((n) => (n.layer === 'arp') === arp);

describe('track timing and form', () => {
  it('is 120 BPM, 16 steps per bar, 8 bar loop', () => {
    expect(STEP_SEC).toBe(0.125);
    expect(BAR_SEC).toBe(2);
    expect(STEPS_PER_BAR).toBe(16);
    expect(LOOP_BARS).toBe(8);
  });

  it('the default tune plays its form: A Am F G Em, B Dm G C F, the breakdown F F Dm Em, the bridge C Em F G, A again', () => {
    const names = Array.from({ length: 20 }, (_, b) => chordForBar(b).name);
    expect(names).toEqual(['Am', 'F', 'G', 'Em', 'Dm', 'G', 'C', 'F', 'F', 'F', 'Dm', 'Em', 'C', 'Em', 'F', 'G', 'Am', 'F', 'G', 'Em']);
    expect(chordForBar(20).name).toBe('Am');
    expect(loopBar(-1)).toBe(7);
    expect(Array.from({ length: 8 }, (_, b) => chordForBar(b, PLAIN_TUNE).name)).toEqual(['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G']);
  });

  it('has bass eighths on the root, a one voice chip arpeggio pad, four on the floor kick and hats', () => {
    const bar = buildBar(7, 2);
    const bass = bar.notes.filter((n) => n.layer === 'bass');
    expect(bass.map((n) => n.step)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(new Set(bass.map((n) => n.midi))).toEqual(new Set([43]));
    const pad = bar.notes.filter((n) => n.layer === 'pad');
    expect(pad).toHaveLength(1);
    expect(pad[0]?.fx?.chord).toHaveLength(4);
    expect(bar.notes.filter((n) => n.layer === 'kick').map((n) => n.step)).toEqual([0, 4, 8, 12]);
    const hats = bar.notes.filter((n) => n.layer === 'hat');
    expect(hats).toHaveLength(16);
    expect(hats.filter((n) => n.sub).map((n) => n.step)).toEqual([1, 3, 5, 7, 9, 11, 13, 15]);
  });

  it('keeps every note inside the bar and sorted by step', () => {
    for (let bar = 0; bar < LOOP_BARS; bar++) {
      const notes = buildBar(99, bar).notes;
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        if (!n) continue;
        expect(n.step).toBeGreaterThanOrEqual(0);
        expect(n.step).toBeLessThan(STEPS_PER_BAR);
        expect(n.vel).toBeGreaterThan(0);
        expect(n.vel).toBeLessThanOrEqual(1);
        if (i > 0) expect(n.step).toBeGreaterThanOrEqual(notes[i - 1]?.step ?? 0);
      }
    }
  });
});

describe('track determinism', () => {
  it('same seed and bar give identical notes', () => {
    for (const seed of [0, 1, 0xdeadbeef, 0x229578a8]) {
      for (let bar = 0; bar < LOOP_BARS * 2; bar++) {
        expect(buildBar(seed, bar)).toEqual(buildBar(seed, bar));
        expect(buildBar(seed, bar, PLAIN_TUNE)).toEqual(buildBar(seed, bar, PLAIN_TUNE));
      }
    }
  });

  it('is serialisable; chords, pad and drums loop every 8 bars, the arp and bass vary by pass', () => {
    const b = buildBar(12345, 3, PLAIN_TUNE);
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
    const d = buildBar(12345, 3);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    const fixed = (bar: number): TrackNote[] => buildBar(12345, bar, PLAIN_TUNE).notes.filter((n) => n.layer === 'pad' || n.layer === 'kick' || n.layer === 'hat' || n.layer === 'perc');
    for (let pass = 1; pass < 6; pass++) {
      expect(buildBar(12345, 3 + pass * LOOP_BARS, PLAIN_TUNE).chord).toBe(b.chord);
      expect(fixed(3 + pass * LOOP_BARS)).toEqual(fixed(3));
    }
    // Pass 0 and pass 4 voice the arp alike (four renderings); pass 1 is a varied pass.
    expect(buildBar(12345, 3 + 4 * LOOP_BARS, PLAIN_TUNE).notes).toEqual(b.notes);
    expect(buildBar(12345, 3 + LOOP_BARS, PLAIN_TUNE).variant).not.toBe('none');
  });

  it('different seeds differ in the arp only', () => {
    for (let i = 0; i < 50; i++) {
      const a = Math.floor(hash01(i, 1) * 4294967296);
      const b = Math.floor(hash01(i, 2) * 4294967296);
      let arpDiffBars = 0;
      for (let bar = 0; bar < LOOP_BARS; bar++) {
        expect(notesOf(a, bar, false)).toEqual(notesOf(b, bar, false));
        if (JSON.stringify(notesOf(a, bar, true)) !== JSON.stringify(notesOf(b, bar, true))) arpDiffBars++;
      }
      expect(arpDiffBars).toBeGreaterThanOrEqual(6);
    }
  });

  it('arp keeps the downbeat of each half bar', () => {
    for (let bar = 0; bar < LOOP_BARS; bar++) {
      const steps = notesOf(31337, bar, true).map((n) => n.step);
      expect(steps).toContain(0);
      expect(steps).toContain(8);
      expect(new Set(steps).size).toBe(steps.length);
    }
  });
});

describe('perc layer (v2 fixes)', () => {
  it('claps on the backbeat with a ghost on step 14 in odd bars, decaying before the bar line', () => {
    for (let bar = 0; bar < LOOP_BARS; bar++) {
      const steps = buildBar(1, bar).notes.filter((n) => n.layer === 'perc').map((n) => n.step);
      expect(steps).toEqual(bar % 2 === 1 ? [4, 12, 14] : [4, 12]);
    }
    expect(14 * STEP_SEC + voiceLength('perc', STEP_SEC)).toBeLessThan(BAR_SEC);
  });
});
