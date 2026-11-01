// Mix v3.5 variety (Ryan M1: "could use more variety and arpeggio"): 16th note lead runs over the
// chord in every tune, up, down and up and down by section and pass; an arpeggiating
// accompaniment in every tune; and a second loop whose lead timbre differs from the first.
import { describe, expect, it } from 'vitest';
import { ARP_CYCLES, ARP_DIRS, ARP_RUNS, arpCycle, arpDirFor, arpRun, secondLoopLead, sectionOf, SECTION_BARS, type ArpDir, type LeadVoice } from '../../../src/audio/music/compose';
import { isBreakdownBar } from '../../../src/audio/music/breakdown';
import { harmonyForBar } from '../../../src/audio/music/harmony';
import { arpRunNotes, buildBar, leadNotes, leadVoiceFor, STEPS_PER_BAR } from '../../../src/audio/music/track';
import { BATTLE_TUNES, TUNES } from '../../../src/audio/music/tunes';

const pc = (m: number): number => ((m % 12) + 12) % 12;

describe('arpeggio figures (pure)', () => {
  it('runs are a bar of sixteenths: up climbs, down falls, updown turns', () => {
    for (const d of ARP_DIRS) expect(ARP_RUNS[d]).toHaveLength(STEPS_PER_BAR);
    const steps = (xs: readonly number[]): number[] => xs.slice(1).map((x, i) => x - (xs[i] ?? 0));
    expect(steps(ARP_RUNS.up.slice(0, 4)).every((d) => d > 0)).toBe(true);
    expect(steps(ARP_RUNS.down.slice(0, 4)).every((d) => d < 0)).toBe(true);
    const ud = steps(ARP_RUNS.updown.slice(0, 8));
    expect(ud.some((d) => d > 0) && ud.some((d) => d < 0)).toBe(true);
    expect(ARP_CYCLES.updown.length).toBeGreaterThan(ARP_CYCLES.up.length);
  });

  it('neighbouring 4 bar blocks never share a direction, and each pass moves a block on', () => {
    for (const t of TUNES) {
      for (let block = 0; block < 8; block++) {
        expect(arpDirFor(t, block, 0)).not.toBe(arpDirFor(t, block + 1, 0));
        expect(arpDirFor(t, block, 0)).not.toBe(arpDirFor(t, block, 1));
      }
    }
  });

  it('every run and cycle note is a tone of the bar chord', () => {
    for (const t of TUNES) {
      for (let bar = 0; bar < t.loopBars; bar++) {
        const tones = harmonyForBar(bar, t.key).tones;
        for (const d of ARP_DIRS) {
          for (const m of arpRun(t, bar, d, 62)) expect(tones).toContain(pc(m));
          for (const m of arpCycle(t, bar, d, 57)) expect(tones).toContain(pc(m));
        }
      }
    }
  });
});

describe('every level tune arpeggiates', () => {
  it('has at least one section where the lead runs sixteenths over the chord, in more than one direction across passes', () => {
    for (const t of TUNES) {
      const dirs = new Set<ArpDir>();
      let runBars = 0;
      for (let pass = 0; pass < 3; pass++) {
        for (let lb = 0; lb < t.loopBars; lb++) {
          const bar = pass * t.loopBars + lb;
          if (sectionOf(t, lb) !== 'S' || isBreakdownBar(0, t, bar)) continue;
          const arp = buildBar(0, bar, t).notes.filter((n) => n.layer === 'arp');
          expect(arp.map((n) => n.step), `${t.id} bar ${bar}`).toEqual(Array.from({ length: 16 }, (_, i) => i));
          const tones = harmonyForBar(lb, t.key).tones;
          for (const n of arp) expect(tones).toContain(pc(n.midi ?? 0));
          for (const n of arp) expect(n.durSteps).toBe(1);
          runBars++;
          dirs.add(arpDirFor(t, Math.floor(lb / SECTION_BARS), pass));
        }
      }
      expect(runBars, t.id).toBeGreaterThanOrEqual(SECTION_BARS);
      expect(dirs.size, t.id).toBeGreaterThanOrEqual(2);
      // The run sits in a playable lead register.
      for (const n of arpRunNotes(t, 8)) {
        expect(n.midi ?? 0).toBeGreaterThanOrEqual(55);
        expect(n.midi ?? 0).toBeLessThanOrEqual(96);
      }
    }
  });

  it('has an arpeggiating accompaniment (a chip pad, or the held pad arpeggiated in the C section), its direction changing between blocks', () => {
    for (const t of TUNES) {
      const cycles = new Set<string>();
      // Two loops: a timed breakdown may cover one loop's C section.
      for (let lb = 0; lb < t.loopBars * 2; lb++) {
        for (const n of buildBar(0, lb, t).notes) {
          if (n.layer === 'pad' && n.fx?.chord) {
            expect(n.fx.chordSec).toBeGreaterThan(0);
            expect(n.fx.chordSec).toBeLessThanOrEqual(t.stepSec + 1e-9);
            const c = n.fx.chord;
            cycles.add(c.slice(1).map((m, i) => Math.sign(m - (c[i] ?? 0))).join(''));
          }
        }
      }
      expect(cycles.size, t.id).toBeGreaterThanOrEqual(1);
      if (t.form?.pad === 'chip') expect(cycles.size, t.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the second loop', () => {
  it('secondLoopLead changes the wave of every lead voice', () => {
    const waves: LeadVoice['wave'][] = ['pulse', 'triangle', 'sawtooth', 'bell'];
    for (const wave of waves) {
      const lv: LeadVoice = { wave, duty: 0.5, dutyB: 0.25, vibrato: 10, echo: 1 };
      const alt = secondLoopLead(lv);
      expect(alt.wave).not.toBe(wave);
      expect(alt.echo).toBe(lv.echo);
      expect(alt.vibrato).toBe(lv.vibrato);
    }
  });

  it('every level tune plays its A section in another lead timbre on pass 1 than on pass 0; battle tracks keep theirs', () => {
    const colour = (n: { fx?: { duty: number; bell: boolean; wave?: OscillatorType } }): string => `${n.fx?.duty}|${n.fx?.bell}|${n.fx?.wave ?? '-'}`;
    for (const t of TUNES) {
      expect(leadVoiceFor(t, 1)?.wave).not.toBe(leadVoiceFor(t, 0)?.wave);
      expect(leadVoiceFor(t, 2)).toBe(t.form?.lead);
      const a0 = leadNotes(t, 0, 0);
      const a1 = leadNotes(t, t.loopBars, 1);
      expect(a0.length).toBeGreaterThan(0);
      expect(a1.map((n) => n.midi)).toEqual(a0.map((n) => n.midi));
      expect(a1.map(colour), t.id).not.toEqual(a0.map(colour));
    }
    for (const t of BATTLE_TUNES) expect(leadVoiceFor(t, 1)).toBe(t.form?.lead);
  });
});
