// forge-leaver: the Leaver's kill note is a bright three note break, and it has a layer entry with
// its own timbre and register.
import { describe, expect, it } from 'vitest';
import { KILL_SPECS, LEAVER_BREAK_NOTES, kindSource, killPlay, killVariation, killVariationTable } from '../../../src/audio/music/kills';
import { LAYERS_FULL, LAYER_KINDS } from '../../../src/audio/music/layers';
import { Kind } from '../../../src/game/world';

describe('Leaver sound', () => {
  it('every Leaver kill plays a three note break at full loudness', () => {
    for (const v of killVariationTable('leaver', 200)) {
      expect(v.arp).toBe(LEAVER_BREAK_NOTES);
      expect(v.loud).toBe(2);
    }
    expect(LEAVER_BREAK_NOTES).toBe(3);
    const p = killPlay(killVariation(0, 'leaver'), 0, 0, 4);
    expect(p.arp).toHaveLength(3);
    expect(new Set(p.arp).size).toBe(3);
  });

  it('the kill voice is the bright shatter timbre; shards stay sfx only', () => {
    expect(KILL_SPECS.leaver.timbre.id).toBe('shatter');
    expect(kindSource(Kind.Leaver)).toBe('leaver');
    expect(kindSource(Kind.LeaverShard)).toBeNull();
  });

  it('has a layer entry: motif, entrance phrase and its own register', () => {
    expect(LAYER_KINDS).toContain('leaver');
    const l = LAYERS_FULL.leaver;
    expect(l.timbre.id).toBe('shatter');
    expect(l.pattern.length).toBeGreaterThanOrEqual(4);
    expect(l.phrase.length).toBeGreaterThanOrEqual(3);
    expect(l.motif(1, 0).length).toBeGreaterThan(0);
    const others = LAYER_KINDS.filter((k) => k !== 'leaver').map((k) => LAYERS_FULL[k].register);
    expect(others).not.toContain(l.register);
  });
});
