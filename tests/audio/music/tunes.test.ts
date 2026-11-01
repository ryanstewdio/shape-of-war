// The tune library (v2.1 tunes, v3.4 forms): every tune validates (tempo, loop, chords present,
// every bed pitch in the tune's scale and chord), the tunes really differ, and every bar of every
// tune, varied passes and fills included, keeps the bed inside BED_VOICE_MAX at full threat.
import { describe, expect, it } from 'vitest';
import { BED_VOICE_MAX, voiceLength } from '../../../src/audio/music/engine';
import { fitsHarmony, harmonyForBar, inChord, inScale, STEPS_PER_BAR, type Harmony } from '../../../src/audio/music/harmony';
import { pentatonicMidi, pitchClass } from '../../../src/audio/music/scale';
import { buildBar, leadNotes, structuralFill, type FillBar, type Layer } from '../../../src/audio/music/track';
import { formBars, isSpaceBar, MODE_STEPS, SECTION_BARS } from '../../../src/audio/music/compose';
import {
  BOSS_KEYS,
  BATTLE_IDS,
  BATTLE_TUNES,
  BPM_MAX,
  BPM_MIN,
  DEFAULT_TUNE,
  FILL_BARS,
  TUNE_IDS,
  TUNES,
  tuneById,
  voicingForBar,
  type Tune,
} from '../../../src/audio/music/tunes';

const SEEDS = [0, 1, 7, 0x5eed, 0xdeadbeef];
const PASSES = 6;

/** Modes with a minor third over the tonic hold the minor pentatonic of their root. */
const MINOR_MODES = new Set(['aeolian', 'dorian', 'phrygian', 'harmonic']);

/** The pitch classes of a minor pentatonic on the tune root. */
function pentaPcs(t: Tune): number[] {
  return [0, 1, 2, 3, 4].map((d) => pitchClass(pentatonicMidi(d, t.root)));
}

describe.each(TUNES.map((t) => [t.id, t] as const))('tune %s validates', (_id, t) => {
  it('has a tempo in range, a loop of 4 bar sections and a step length that matches the tempo', () => {
    expect(t.bpm).toBeGreaterThanOrEqual(BPM_MIN);
    expect(t.bpm).toBeLessThanOrEqual(BPM_MAX);
    expect(t.form).toBeDefined();
    if (t.form) expect(t.loopBars).toBe(formBars(t.form));
    expect(t.loopBars % SECTION_BARS).toBe(0);
    expect(t.key.bars).toHaveLength(t.loopBars);
    expect(t.stepSec).toBeCloseTo(60 / t.bpm / 4, 12);
    expect(Math.abs(t.root - 69)).toBeLessThanOrEqual(5);
  });

  it('has its mode on its tonic; a minor mode holds the minor pentatonic of its root', () => {
    const mode = t.form?.mode ?? 'aeolian';
    expect(new Set(t.key.scale).size).toBe(MODE_STEPS[mode].length);
    expect(t.key.scale[0]).toBe(t.key.tonic);
    expect(pitchClass(t.root)).toBe(t.key.tonic);
    if (MINOR_MODES.has(mode)) for (const pc of pentaPcs(t)) expect(t.key.scale).toContain(pc);
  });

  it('every chord of the plan is a triad of scale tones, voiced, and the loop starts on the tonic', () => {
    const chords = new Set<Harmony>(t.key.bars);
    expect(chords.size).toBeGreaterThanOrEqual(4);
    expect(t.key.bars[0]?.root).toBe(t.key.tonic);
    for (const h of chords) {
      expect(h.tones).toHaveLength(3);
      for (const pc of h.tones) expect(t.key.scale).toContain(pc);
      const v = t.voicings[h.name];
      expect(v, h.name).toBeDefined();
      if (!v) continue;
      expect(v.harmony).toBe(h);
      expect(pitchClass(v.bass)).toBe(h.root);
      expect(new Set(v.pad.map(pitchClass))).toEqual(new Set(h.tones));
    }
    // The chord changes at least four times around the loop.
    let changes = 0;
    for (let b = 0; b < t.loopBars; b++) if (harmonyForBar(b, t.key) !== harmonyForBar(b + 1, t.key)) changes++;
    expect(changes).toBeGreaterThanOrEqual(4);
  });

  it('every bed pitch, on every pass and in every fill, is in the scale: chord tones for bass and pad, the harmony rule for the arp', () => {
    for (const seed of SEEDS) {
      for (let bar = 0; bar < t.loopBars * PASSES; bar++) {
        for (const fill of [null, 0, 1] as FillBar[]) {
          const p = buildBar(seed, bar, t, fill);
          expect(p.tune).toBe(t.id);
          const h = harmonyForBar(bar, t.key);
          expect(p.chord).toBe(h.name);
          for (const n of p.notes) {
            if (n.midi === null) continue;
            const what = `${t.id} seed ${seed} bar ${bar} fill ${fill} ${n.layer} step ${n.step} midi ${n.midi}`;
            const abs = bar * STEPS_PER_BAR + n.step;
            expect(inScale(n.midi, t.key), what).toBe(true);
            if (n.layer === 'arp') expect(fitsHarmony(n.midi, abs, t.key), what).toBe(true);
            else expect(inChord(n.midi, h), what).toBe(true);
          }
        }
      }
    }
  });

  it('arp figure rests never fall on steps 0 and 8; the lead is monophonic; lead and bass stay in a playable range', () => {
    for (const f of [t.arp, t.arpAlt]) {
      expect(f.rests).not.toContain(0);
      expect(f.rests).not.toContain(8);
      expect(f.a).toHaveLength(16);
      expect(f.b).toHaveLength(16);
    }
    // The written lead over 4 passes: one note at a time, every note ends before the next starts.
    const ends: { start: number; end: number }[] = [];
    for (let bar = 0; bar < t.loopBars * 4; bar++) {
      for (const n of leadNotes(t, bar, Math.floor(bar / t.loopBars))) ends.push({ start: bar * STEPS_PER_BAR + n.step, end: bar * STEPS_PER_BAR + n.step + n.durSteps });
    }
    expect(ends.length).toBeGreaterThan(t.loopBars * 2);
    for (let i = 1; i < ends.length; i++) expect(ends[i - 1]?.end ?? 0, `${t.id} note ${i}`).toBeLessThanOrEqual(ends[i]?.start ?? 0);
    for (let bar = 0; bar < t.loopBars * 4; bar++) {
      const p = buildBar(3, bar, t);
      for (const n of p.notes) {
        if (n.layer === 'bass') expect(n.midi ?? 0).toBeGreaterThanOrEqual(36);
        if (n.layer === 'bass') expect(n.midi ?? 0).toBeLessThanOrEqual(64);
        if (n.layer === 'arp') expect(n.midi ?? 0).toBeGreaterThanOrEqual(55);
        if (n.layer === 'arp') expect(n.midi ?? 0).toBeLessThanOrEqual(100);
      }
      // Monophonic bass: each note ends at or before the next starts.
      const bass = p.notes.filter((n) => n.layer === 'bass');
      for (let i = 1; i < bass.length; i++) expect((bass[i - 1]?.step ?? 0) + (bass[i - 1]?.durSteps ?? 0)).toBeLessThanOrEqual(bass[i]?.step ?? 0);
    }
  });

  it('every second pass varies the arp or the bass line, and four consecutive passes never repeat verbatim', () => {
    for (const seed of SEEDS) {
      const passNotes = (pass: number): string =>
        JSON.stringify(Array.from({ length: t.loopBars }, (_, b) => buildBar(seed, pass * t.loopBars + b, t, structuralFill(t, pass * t.loopBars + b)).notes));
      for (let pass = 0; pass < PASSES; pass++) {
        const v = buildBar(seed, pass * t.loopBars, t).variant;
        if (pass % 2 === 0) expect(v).toBe('none');
        else expect(['arp', 'bass']).toContain(v);
      }
      const passes = Array.from({ length: 4 }, (_, p) => passNotes(p));
      expect(new Set(passes).size).toBe(4);
    }
  });

  it('a structural fill closes every odd pass and only those', () => {
    for (let bar = 0; bar < t.loopBars * PASSES; bar++) {
      const pass = Math.floor(bar / t.loopBars);
      const inLoop = bar % t.loopBars;
      const expected: FillBar = pass % 2 === 1 && inLoop >= t.loopBars - FILL_BARS ? ((inLoop - (t.loopBars - FILL_BARS)) as 0 | 1) : null;
      expect(structuralFill(t, bar)).toBe(expected);
    }
  });

  it('keeps the bed inside BED_VOICE_MAX at full threat on every bar, pass and fill', () => {
    const sec = t.stepSec;
    for (const seed of SEEDS.slice(0, 2)) {
      for (const fills of ['none', 'all'] as const) {
        const spans: { start: number; end: number; layer: Layer }[] = [];
        for (let bar = 0; bar < t.loopBars * 4; bar++) {
          const fill: FillBar = fills === 'none' ? structuralFill(t, bar) : ((bar % 2) as 0 | 1);
          for (const n of buildBar(seed, bar, t, fill).notes) {
            const start = (bar * STEPS_PER_BAR + n.step) * sec;
            spans.push({ start, end: start + voiceLength(n.layer, n.durSteps * sec), layer: n.layer });
          }
        }
        const ev: [number, number][] = [];
        for (const s of spans) ev.push([s.start, 1], [s.end, -1]);
        ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        let cur = 0;
        let peak = 0;
        for (const [, d] of ev) {
          cur += d;
          peak = Math.max(peak, cur);
        }
        expect(peak, `${t.id} fills ${fills}`).toBeLessThanOrEqual(BED_VOICE_MAX);
      }
    }
  });
});

describe('the tunes differ', () => {
  it('has six tunes with distinct keys, tempos, modes, chord plans, bed timbres, lead voices and drums', () => {
    expect(TUNES.length).toBe(6);
    expect(TUNES.map((t) => t.id)).toEqual([...TUNE_IDS]);
    const distinct = <T>(f: (t: Tune) => T): number => new Set(TUNES.map((t) => JSON.stringify(f(t)))).size;
    expect(distinct((t) => t.key.tonic)).toBe(TUNES.length);
    expect(distinct((t) => t.bpm)).toBe(TUNES.length);
    expect(distinct((t) => t.key.bars.map((h) => h.numeral))).toBe(TUNES.length);
    expect(distinct((t) => t.bed)).toBe(TUNES.length);
    expect(distinct((t) => t.drums.kick)).toBe(TUNES.length);
    expect(distinct((t) => t.bass)).toBe(TUNES.length);
    expect(distinct((t) => t.arp)).toBe(TUNES.length);
    expect(distinct((t) => t.form?.mode)).toBe(TUNES.length);
    expect(distinct((t) => t.form?.lead)).toBe(TUNES.length);
  });

  it('every level tune drops into a 4 to 8 bar space breakdown once a loop; two space pieces carry wind on every bar', () => {
    for (const t of TUNES) {
      const space = Array.from({ length: t.loopBars }, (_, b) => isSpaceBar(t, b));
      const runs: number[] = [];
      let run = 0;
      for (const s of [...space, false]) {
        if (s) run++;
        else if (run > 0) {
          runs.push(run);
          run = 0;
        }
      }
      expect(runs.length, t.id).toBeGreaterThanOrEqual(1);
      for (const r of runs) {
        expect(r).toBeGreaterThanOrEqual(4);
        expect(r).toBeLessThanOrEqual(8);
      }
      // No drums in the breakdown, a held bass, pads on the long echo.
      for (let b = 0; b < t.loopBars; b++) {
        if (!isSpaceBar(t, b)) continue;
        expect(structuralFill(t, b + t.loopBars)).toBeNull();
        const p = buildBar(1, b, t, null);
        expect(p.notes.filter((n) => n.layer === 'kick' || n.layer === 'perc' || n.layer === 'hat')).toEqual([]);
        expect(p.notes.filter((n) => n.layer === 'bass')).toHaveLength(1);
        for (const n of p.notes.filter((n) => n.layer === 'pad')) expect(n.fx?.echo).toBe(2);
        expect(p.notes.some((n) => n.fx?.wind === true)).toBe(true);
      }
    }
    const spacey = TUNES.filter((t) => t.form?.space === true);
    expect(spacey.map((t) => t.id).sort()).toEqual(['horizon', 'nebula']);
    for (const t of spacey) {
      expect(t.bpm).toBeLessThanOrEqual(110);
      expect(['lydian', 'wholetone']).toContain(t.form?.mode);
      expect(t.form?.lead.echo).toBe(2);
      for (let b = 0; b < t.loopBars; b++) expect(buildBar(1, b, t).notes.some((n) => n.fx?.wind === true)).toBe(true);
    }
    expect(spacey.some((t) => t.form?.lead.wave === 'bell')).toBe(true);
  });

  it('the default tune is Neon Drive: A aeolian, 138 BPM, its A section Am F G Em', () => {
    expect(DEFAULT_TUNE.id).toBe('neon');
    expect(DEFAULT_TUNE.bpm).toBe(138);
    expect(DEFAULT_TUNE.key.tonic).toBe(9);
    expect(Array.from({ length: 4 }, (_, b) => voicingForBar(DEFAULT_TUNE, b).name)).toEqual(['Am', 'F', 'G', 'Em']);
    expect(buildBar(9, 2)).toEqual(buildBar(9, 2, DEFAULT_TUNE, null));
  });

  it('looks tunes up by id', () => {
    for (const t of TUNES) expect(tuneById(t.id)).toBe(t);
    expect(tuneById('nope')).toBe(DEFAULT_TUNE);
  });

  it('every tune is serialisable', () => {
    for (const t of TUNES) expect(JSON.parse(JSON.stringify(t))).toEqual(t);
  });
});

describe('boss battle tracks', () => {
  // Battle polish: the three tracks are in three different minor keys (was: all on A), each root
  // within a fourth of A4 so the A based boss motifs still fit. v3.4: each has its own tempo and
  // an A B A C form of 16 bars, so the A phrase returns every 8 bars.
  it('three battle tracks, minor, each its own key, tempo and A B A C form', () => {
    expect(BATTLE_TUNES.map((t) => t.id)).toEqual([...BATTLE_IDS]);
    expect(BATTLE_TUNES.length).toBeGreaterThanOrEqual(3);
    for (const t of BATTLE_TUNES) {
      expect(t.battle).toBe(true);
      expect(t.bpm).toBeGreaterThanOrEqual(BPM_MIN);
      expect(t.bpm).toBeLessThanOrEqual(BPM_MAX);
      expect(t.form?.sections).toEqual(['A', 'B', 'A', 'C']);
      expect(t.loopBars).toBe(16);
      expect(t.form?.sections.includes('S')).toBe(false);
      expect(Math.abs(t.root - 69)).toBeLessThanOrEqual(5);
      expect(t.root % 12).toBe(t.key.tonic);
      // Minor: the scale has the minor third over the tonic and not the major third; the tonic chord is minor.
      expect(t.key.scale).toContain((t.key.tonic + 3) % 12);
      expect(t.key.scale).not.toContain((t.key.tonic + 4) % 12);
      const tonic = t.key.bars[0];
      expect(tonic?.root).toBe(t.key.tonic);
      expect(tonic?.intervals[1]).toBe(3);
      // One chord a bar on average at least as often as every level tune changes.
      expect(new Set(t.key.bars.map((h) => h.name)).size).toBeGreaterThanOrEqual(3);
      // The varied pass arp figure never rests at random; hats on every sixteenth (double time).
      expect(t.arp.restP).toBe(0);
      expect(t.drums.hat).toHaveLength(16);
    }
    const sig = (t: Tune): string => JSON.stringify([t.key.bars.map((h) => h.name), t.bass, t.drums, t.arp, t.bed]);
    const all = [...BATTLE_TUNES, ...TUNES].map(sig);
    expect(new Set(all).size).toBe(all.length);
    // Three different minor scales in three different keys.
    expect(new Set(BATTLE_TUNES.map((t) => t.key.scale.join(','))).size).toBe(3);
    expect(new Set(BATTLE_TUNES.map((t) => t.key.tonic)).size).toBe(3);
    expect(new Set(BATTLE_TUNES.map((t) => t.bpm)).size).toBe(3);
  });

  it('every battle track chord is built from its key scale and has a voicing', () => {
    for (const t of BATTLE_TUNES) {
      expect(t.key.bars).toHaveLength(t.loopBars);
      for (const h of t.key.bars) {
        for (const pc of h.tones) expect(t.key.scale).toContain(pc);
        expect(t.voicings[h.name]).toBeDefined();
      }
      expect(JSON.parse(JSON.stringify(t))).toEqual(t);
    }
    // Tier 2 carries the raised seventh (G sharp, pitch class 8), tier 3 the flat second (B flat, 10).
    expect(BOSS_KEYS[2].scale).toContain(8);
    expect(BOSS_KEYS[3].scale).toContain(10);
  });

  it('every battle track pitch keeps the harmony rule and the bed stays inside BED_VOICE_MAX', () => {
    for (const t of BATTLE_TUNES) {
      const sec = t.stepSec;
      const ev: [number, number][] = [];
      for (let bar = 0; bar < t.loopBars * 4; bar++) {
        const h = harmonyForBar(bar, t.key);
        for (const n of buildBar(5, bar, t, structuralFill(t, bar)).notes) {
          const start = (bar * STEPS_PER_BAR + n.step) * sec;
          ev.push([start, 1], [start + voiceLength(n.layer, n.durSteps * sec), -1]);
          if (n.midi === null) continue;
          const what = `${t.id} bar ${bar} ${n.layer} step ${n.step} midi ${n.midi}`;
          expect(inScale(n.midi, t.key), what).toBe(true);
          if (n.layer === 'arp') expect(fitsHarmony(n.midi, bar * STEPS_PER_BAR + n.step, t.key), what).toBe(true);
          else expect(inChord(n.midi, h), what).toBe(true);
        }
      }
      ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let cur = 0;
      let peak = 0;
      for (const [, d] of ev) {
        cur += d;
        peak = Math.max(peak, cur);
      }
      expect(peak, t.id).toBeLessThanOrEqual(BED_VOICE_MAX);
    }
  });

  it('the level tunes are not battle tracks', () => {
    for (const t of TUNES) expect(t.battle).toBeUndefined();
  });
});
