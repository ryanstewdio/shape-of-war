// Kill variation (v3.4, Ryan 2026-11-01: "more variety in the notes created by kills by varying
// note length, loudness, echo, and some notes should have arpeggio"): the variation table is a
// pure hash of the kill index and source, the arpeggio builder stays in the chord and climbs with
// combo kills, and a played kill never rings past the room the gate gave it.
import { describe, expect, it } from 'vitest';
import { harmonyForBar, inChord } from '../../../src/audio/music/harmony';
import {
  KILL_ARP_NOTE_STEPS,
  KILL_ARP_SHARE,
  KILL_ARP_TOP_DEG,
  KILL_BASE,
  KILL_LEN_STEPS,
  KILL_LOUDNESS,
  KILL_SPECS,
  killArpeggio,
  killNoteMidi,
  killPlay,
  killVariation,
  killVariationTable,
  type KillSource,
} from '../../../src/audio/music/kills';
import { chordToneMidi } from '../../../src/audio/music/harmony';
import { BATTLE_TUNES, DEFAULT_TUNE, TUNES } from '../../../src/audio/music/tunes';

const SOURCES = Object.keys(KILL_SPECS) as KillSource[];
const N = 4000;

describe('kill variation table', () => {
  it('is deterministic per (kill index, source) and JSON serialisable', () => {
    for (const s of SOURCES) {
      const a = killVariationTable(s, 64);
      expect(killVariationTable(s, 64)).toEqual(a);
      expect(JSON.parse(JSON.stringify(a))).toEqual(a);
      for (let i = 0; i < 64; i++) expect(killVariation(i, s)).toEqual(a[i]);
    }
    // Odd indices are clamped, never thrown on.
    expect(killVariation(-5, 'grunt')).toEqual(killVariation(0, 'grunt'));
    expect(killVariation(Number.NaN, 'grunt')).toEqual(killVariation(0, 'grunt'));
  });

  it('uses every length, loudness and echo, and about 1 kill in 4 plays a 3 or 4 note arpeggio', () => {
    for (const s of SOURCES) {
      const t = killVariationTable(s, N);
      for (const len of KILL_LEN_STEPS) expect(t.some((v) => v.lenSteps === len), `${s} len ${len}`).toBe(true);
      for (const loud of [0, 1, 2]) expect(t.some((v) => v.loud === loud), `${s} loud ${loud}`).toBe(true);
      for (const echo of [0, 1, 2]) expect(t.some((v) => v.echo === echo), `${s} echo ${echo}`).toBe(true);
      const arps = t.filter((v) => v.arp > 0);
      expect(arps.length / N).toBeGreaterThan(KILL_ARP_SHARE - 0.04);
      expect(arps.length / N).toBeLessThan(KILL_ARP_SHARE + 0.04);
      expect(arps.some((v) => v.arp === 3) && arps.some((v) => v.arp === 4)).toBe(true);
      for (const v of t) expect(v.gainScale).toBe(KILL_LOUDNESS[v.loud]);
    }
    // Lengths run from a staccato half sixteenth to half a beat; loudness never above full.
    expect(Math.min(...KILL_LEN_STEPS)).toBe(0.5);
    expect(Math.max(...KILL_LEN_STEPS)).toBe(2);
    expect(Math.max(...KILL_LOUDNESS)).toBeLessThanOrEqual(1);
    expect(new Set(KILL_LOUDNESS).size).toBe(3);
  });

  it('two sources at the same index differ, so a mixed wave does not march in lockstep', () => {
    const a = killVariationTable('grunt', 200).map((v) => JSON.stringify(v));
    const b = killVariationTable('dart', 200).map((v) => JSON.stringify(v));
    expect(a.filter((x, i) => x !== b[i]).length).toBeGreaterThan(150);
  });
});

describe('kill arpeggio builder', () => {
  it('climbs the chord tones of the bar from the kill index, in every tune', () => {
    for (const t of [...TUNES, ...BATTLE_TUNES]) {
      for (let bar = 0; bar < t.loopBars; bar++) {
        const h = harmonyForBar(bar, t.key);
        for (const count of [3, 4]) {
          for (let index = 0; index < 6; index++) {
            const arp = killArpeggio(bar, index, count, t);
            expect(arp).toHaveLength(count);
            for (const m of arp) expect(inChord(m, h), `${t.id} bar ${bar}`).toBe(true);
            for (let i = 1; i < arp.length; i++) expect(arp[i] ?? 0).toBeGreaterThan(arp[i - 1] ?? 0);
            // Never above the cap, two octaves over the root nearest A4.
            expect(arp.at(-1) ?? 0).toBeLessThanOrEqual(chordToneMidi(h, KILL_ARP_TOP_DEG, KILL_BASE));
          }
        }
      }
    }
  });

  it('combo kills climb: a later kill in the bar starts its arpeggio higher, up to the cap', () => {
    const first = (i: number): number => killArpeggio(0, i, 3, DEFAULT_TUNE)[0] ?? 0;
    expect(first(1)).toBeGreaterThan(first(0));
    expect(first(2)).toBeGreaterThan(first(1));
    expect(first(0)).toBe(killNoteMidi(0, 0));
    expect(first(1)).toBe(killNoteMidi(0, 1));
    // Past the cap the arpeggio stops climbing.
    expect(killArpeggio(0, 9, 4, DEFAULT_TUNE)).toEqual(killArpeggio(0, KILL_ARP_TOP_DEG - 3, 4, DEFAULT_TUNE));
  });
});

describe('kill play', () => {
  it('never rings past the gate room; an arpeggio squeezes its notes to fit', () => {
    for (const s of ['grunt', 'snake', 'mine'] as const) {
      for (const v of killVariationTable(s, 400)) {
        for (const room of [1, 2]) {
          const p = killPlay(v, 3, 1, room, DEFAULT_TUNE);
          expect(p.steps).toBeLessThanOrEqual(room);
          expect(p.gainScale).toBe(v.gainScale);
          expect(p.echo).toBe(v.echo);
          if (v.arp > 0) {
            expect(p.arp).toHaveLength(v.arp);
            expect(p.midi).toBe(p.arp?.[0]);
            expect(p.arpSteps).toBeLessThanOrEqual(KILL_ARP_NOTE_STEPS);
            expect(p.arpSteps * v.arp).toBeLessThanOrEqual(room + 1e-12);
          } else {
            expect(p.arp).toBeNull();
            expect(p.steps).toBe(Math.min(room, v.lenSteps));
            expect(p.midi).toBe(killNoteMidi(3, 1, DEFAULT_TUNE));
          }
        }
      }
    }
  });
});
