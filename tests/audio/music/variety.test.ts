// Variety (v3.4 music, Ryan 2026-11-01: "melodies are too similar"). Every phrase of every tune,
// level tunes and battle tracks alike, has its own interval contour and its own rhythm: no two
// tunes share a phrase signature, a phrase's opening rhythm cell or a chord progression. Each tune
// has an A, a B and a bridge, its own tempo and lead voice; the level tunes each have their own
// mode, and so do the battle tracks among themselves.
import { describe, expect, it } from 'vitest';
import {
  contourSignature,
  phrasePitches,
  progressionSignature,
  rhythmCell,
  rhythmSignature,
  SECTION_BARS,
  sectionStarts,
  type Section,
} from '../../../src/audio/music/compose';
import { STEPS_PER_BAR } from '../../../src/audio/music/harmony';
import { BATTLE_TUNES, TUNES, type Tune } from '../../../src/audio/music/tunes';

const ALL: readonly Tune[] = [...TUNES, ...BATTLE_TUNES];

interface Sig {
  readonly tune: string;
  readonly section: Section;
  readonly contour: string;
  readonly rhythm: string;
  readonly cell: string;
}

function signatures(t: Tune): Sig[] {
  const f = t.form;
  if (f === undefined) return [];
  const starts = sectionStarts(f);
  const out: Sig[] = [];
  for (const sec of ['A', 'B', 'C', 'S'] as const) {
    const ph = f.phrases[sec];
    const bar = starts[sec];
    if (ph === undefined || bar === undefined) continue;
    const pitches = phrasePitches(ph, bar * STEPS_PER_BAR, t);
    out.push({ tune: t.id, section: sec, contour: contourSignature(pitches), rhythm: rhythmSignature(ph), cell: rhythmCell(ph, 0) });
  }
  return out;
}

/** Pairs of tunes that share a value of a signature field. */
function clashes(field: 'contour' | 'rhythm' | 'cell', sections: readonly Section[] = ['A', 'B', 'C', 'S']): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const t of ALL) {
    for (const s of signatures(t)) {
      if (!sections.includes(s.section)) continue;
      const owner = seen.get(s[field]);
      if (owner !== undefined && owner.split(' ')[0] !== t.id) out.push(`${owner} and ${t.id} ${s.section}: ${s[field]}`);
      else if (owner === undefined) seen.set(s[field], `${t.id} ${s.section}`);
    }
  }
  return out;
}

describe('signature helpers', () => {
  it('contour marks steps and leaps up and down', () => {
    expect(contourSignature([60, 62, 62, 59, 67, 66])).toBe('usDUd');
    expect(contourSignature([60])).toBe('');
  });

  it('rhythm lists onsets and lengths; a cell is one bar of it', () => {
    const ph = [
      { at: 0, deg: 0, dur: 3, slide: false },
      { at: 3, deg: 1, dur: 5, slide: false },
      { at: 16, deg: 2, dur: 8, slide: false },
    ];
    expect(rhythmSignature(ph)).toBe('0:3 3:5 16:8');
    expect(rhythmCell(ph, 0)).toBe('0:3 3:5');
    expect(rhythmCell(ph, 1)).toBe('0:8');
  });
});

describe('the tunes are different songs', () => {
  it('thirteen tunes (ten level, three battle), each with an A, a B and a bridge of 4 bars that differ from each other', () => {
    expect(ALL).toHaveLength(13);
    for (const t of ALL) {
      const f = t.form;
      expect(f, t.id).toBeDefined();
      if (f === undefined) continue;
      const sigs = signatures(t);
      const abc = sigs.filter((s) => s.section !== 'S');
      expect(abc.map((s) => s.section)).toEqual(['A', 'B', 'C']);
      expect(new Set(abc.map((s) => s.rhythm)).size, t.id).toBe(3);
      expect(new Set(abc.map((s) => s.contour)).size, t.id).toBe(3);
      for (const sec of ['A', 'B', 'C'] as const) {
        const ph = f.phrases[sec] ?? [];
        expect(ph.length, `${t.id} ${sec}`).toBeGreaterThanOrEqual(5);
        for (const n of ph) {
          expect(n.at).toBeGreaterThanOrEqual(0);
          expect(n.at + n.dur).toBeLessThanOrEqual(SECTION_BARS * STEPS_PER_BAR);
        }
      }
    }
  });

  it('no two tunes share a phrase contour signature', () => {
    expect(clashes('contour')).toEqual([]);
  });

  it('no two tunes share a phrase rhythm signature', () => {
    expect(clashes('rhythm')).toEqual([]);
  });

  it('no two tunes share the opening rhythm cell of their A, B or bridge', () => {
    expect(clashes('cell', ['A', 'B', 'C'])).toEqual([]);
  });

  it('no two tunes share a chord progression, whole loop or A section', () => {
    const loops = ALL.map((t) => progressionSignature(t.key, 0, t.loopBars));
    expect(new Set(loops).size).toBe(ALL.length);
    const aSections = ALL.map((t) => `${t.form?.mode} ${progressionSignature(t.key, 0, SECTION_BARS)}`);
    expect(new Set(aSections).size).toBe(ALL.length);
  });

  it('every tune has its own tempo (100 to 150 BPM) and its own lead voice', () => {
    for (const t of ALL) {
      expect(t.bpm).toBeGreaterThanOrEqual(100);
      expect(t.bpm).toBeLessThanOrEqual(150);
    }
    expect(new Set(ALL.map((t) => t.bpm)).size).toBe(ALL.length);
    expect(new Set(ALL.map((t) => JSON.stringify(t.form?.lead))).size).toBe(ALL.length);
    // The six level tunes use every lead wave: pulse (with duty changes), triangle, saw and bell.
    expect(new Set(TUNES.map((t) => t.form?.lead.wave))).toEqual(new Set(['pulse', 'triangle', 'sawtooth', 'bell']));
    expect(TUNES.some((t) => t.form?.lead.wave === 'pulse' && t.form.lead.duty !== t.form.lead.dutyB)).toBe(true);
  });

  it('the level tunes each have their own mode, whole tone among them; the battle tracks stay minor and differ', () => {
    expect(new Set(TUNES.map((t) => t.form?.mode)).size).toBe(TUNES.length);
    expect(TUNES.map((t) => t.form?.mode)).toContain('wholetone');
    expect(TUNES.map((t) => t.form?.mode)).toContain('lydian');
    const battleModes = BATTLE_TUNES.map((t) => t.form?.mode);
    expect(new Set(battleModes).size).toBe(BATTLE_TUNES.length);
    for (const m of battleModes) expect(['aeolian', 'dorian', 'phrygian', 'harmonic']).toContain(m);
  });

  it('v3.6: ten level tunes, each with A, B, bridge and S (arpeggio section and space breakdown) phrases, among them a heroic, an industrial, a dreamy space and a bouncy chiptune tune', () => {
    expect(TUNES).toHaveLength(10);
    for (const t of TUNES) {
      const f = t.form;
      expect(f?.sections, t.id).toContain('S');
      for (const sec of ['A', 'B', 'C', 'S'] as const) expect((f?.phrases[sec] ?? []).length, `${t.id} ${sec}`).toBeGreaterThan(0);
    }
    const byId = (id: string): Tune | undefined => TUNES.find((t) => t.id === id);
    const charge = byId('charge');
    expect(charge?.bpm).toBeGreaterThanOrEqual(140);
    expect(charge?.form?.mode).toBe('ionian');
    expect(byId('foundry')?.form?.mode).toBe('phrygdom');
    const aurora = byId('aurora');
    expect(aurora?.form?.space).toBe(true);
    expect(aurora?.bpm).toBeLessThanOrEqual(110);
    const pixel = byId('pixel');
    expect(pixel?.form?.lead.wave).toBe('pulse');
    expect(pixel?.form?.pad).toBe('chip');
  });
});
