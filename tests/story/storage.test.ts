// Story storage (two device only keys): call sign and seen scenes round trip, bad values fall back,
// each save writes only its own key.
import { describe, expect, it } from 'vitest';
import {
  CALLSIGN_KEY,
  STORY_SEEN_KEY,
  loadCallsign,
  loadStorySeen,
  markStorySeen,
  parseStorySeen,
  recordStorySeen,
  resetProgress,
  saveCallsign,
  type StorageLike,
} from '../../src/core/settings';

function store(init: Record<string, string> = {}): StorageLike & { data: Map<string, string>; writes: string[] } {
  const data = new Map(Object.entries(init));
  const writes: string[] = [];
  return { data, writes, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void (writes.push(k), data.set(k, v)) };
}

describe('story storage', () => {
  it('uses two sow.progress keys', () => {
    expect(CALLSIGN_KEY).toBe('sow.progress.callsign');
    expect(STORY_SEEN_KEY).toBe('sow.progress.storySeen');
  });

  it('round trips the call sign and refuses an invalid one', () => {
    const s = store();
    expect(loadCallsign(s)).toBeNull();
    expect(saveCallsign('NovaFox', s)).toBe(true);
    expect(loadCallsign(s)).toBe('NovaFox');
    expect(saveCallsign('no', s)).toBe(false);
    expect(saveCallsign('bad name', s)).toBe(false);
    expect(loadCallsign(s)).toBe('NovaFox');
    expect(s.writes).toEqual([CALLSIGN_KEY]);
    expect(loadCallsign(store({ [CALLSIGN_KEY]: '<script>' }))).toBeNull();
  });

  it('round trips the seen map, keeping the first level of each id', () => {
    const s = store();
    expect(loadStorySeen(s)).toEqual({});
    recordStorySeen('opening', 1, s);
    recordStorySeen('foe:grunt', 1, s);
    recordStorySeen('combo:charger+splime', 13, s);
    recordStorySeen('foe:grunt', 9, s);
    expect(loadStorySeen(s)).toEqual({ opening: 1, 'foe:grunt': 1, 'combo:charger+splime': 13 });
    expect(new Set(s.writes)).toEqual(new Set([STORY_SEEN_KEY]));
  });

  it('drops malformed rows and reads garbage as empty', () => {
    expect(parseStorySeen('{not json')).toEqual({});
    expect(parseStorySeen('[1,2]')).toEqual({});
    expect(parseStorySeen(null)).toEqual({});
    expect(parseStorySeen('{"opening":1,"foe:grunt":0,"BAD ID":3,"boss:brood":"5","freed:brood":5.5,"boss:warden":10}')).toEqual({ opening: 1, 'boss:warden': 10 });
  });

  it('markStorySeen is pure and returns the same map for a repeat', () => {
    const a = { opening: 1 };
    expect(markStorySeen(a, 'opening', 4)).toBe(a);
    expect(markStorySeen(a, 'foe:dart', 6.7)).toEqual({ opening: 1, 'foe:dart': 6 });
    expect(a).toEqual({ opening: 1 });
  });

  it('Reset progress clears the call sign and seen scenes (Ryan 2026-11-10), so the opening plays again', () => {
    const s = store();
    saveCallsign('Ace', s);
    recordStorySeen('opening', 1, s);
    recordStorySeen('briefing:grunt', 2, s);
    resetProgress(s);
    expect(loadCallsign(s)).toBeNull();
    expect(loadStorySeen(s)).toEqual({});
    expect(s.data.get(CALLSIGN_KEY)).toBe('');
    expect(s.data.get(STORY_SEEN_KEY)).toBe('{}');
  });
});
