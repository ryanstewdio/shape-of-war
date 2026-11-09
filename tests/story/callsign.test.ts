// Call sign picker rules (docs/19 "Call sign"): seeded suggestion from two word lists, letters and
// digits only, 3 to 10 characters.
import { describe, expect, it } from 'vitest';
import { CALLSIGN_FIRST, CALLSIGN_SECOND, isValidCallsign, sanitizeCallsign, suggestCallsign } from '../../src/story/callsign';

describe('call sign', () => {
  it('suggests the same valid name for the same seed, from the two word lists', () => {
    for (let seed = 0; seed < 500; seed++) {
      const a = suggestCallsign(seed * 7919);
      expect(a).toBe(suggestCallsign(seed * 7919));
      expect(isValidCallsign(a), a).toBe(true);
      expect(CALLSIGN_FIRST.some((f) => a.startsWith(f) && CALLSIGN_SECOND.includes(a.slice(f.length)))).toBe(true);
    }
  });

  it('varies with the seed (reroll gives new names)', () => {
    const names = new Set(Array.from({ length: 50 }, (_, i) => suggestCallsign(i * 0x9e3779b1)));
    expect(names.size).toBeGreaterThan(20);
  });

  it('every word pair fits the 10 character cap', () => {
    for (const f of CALLSIGN_FIRST) for (const s of CALLSIGN_SECOND) expect((f + s).length, f + s).toBeLessThanOrEqual(10);
  });

  it('accepts 3 to 10 letters and digits only', () => {
    for (const ok of ['Ace', 'abc', 'R2D2', 'Pilot12345', 'ZZZ']) expect(isValidCallsign(ok), ok).toBe(true);
    for (const bad of ['', 'ab', 'Pilot123456', 'Ace Pilot', 'Ace!', 'Émile', 'a-b-c', '   ']) expect(isValidCallsign(bad), bad).toBe(false);
  });

  it('typing keeps letters and digits and cuts to 10', () => {
    expect(sanitizeCallsign('Ace Pilot!')).toBe('AcePilot');
    expect(sanitizeCallsign('abcdefghijklmnop')).toBe('abcdefghij');
    expect(sanitizeCallsign('é@#')).toBe('');
  });
});
