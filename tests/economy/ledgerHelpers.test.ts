import { describe, expect, it } from 'vitest';
import { awardsFor, type GemAward, type ResultEvent } from '../../src/economy/earn';
import {
  apply,
  applyAwards,
  balance,
  earnEntry,
  EMPTY_LEDGER,
  entryIds,
  hasEntry,
  owns,
  spend,
  spendId,
  type Ledger,
} from '../../src/economy/ledger';

function earned(gems: number, id = 'e1'): Ledger {
  return apply(EMPTY_LEDGER, { kind: 'earn', id, gems, source: 'star' }).ledger;
}

const BOSS_RUN: ResultEvent = {
  mode: 'adventure',
  levelIndex: 4,
  difficulty: 'hard',
  starsBefore: 0,
  starsAfter: 3,
  bossLevel: true,
  success: true,
  score: 5000,
};

const award: GemAward = { id: 'earn:star:4:1', source: 'star', gems: 5 };

describe('hasEntry', () => {
  it('returns false on the frozen empty ledger without throwing', () => {
    expect(hasEntry(EMPTY_LEDGER, 'e1')).toBe(false);
    expect(hasEntry(EMPTY_LEDGER, '')).toBe(false);
  });

  it('matches the whole id exactly', () => {
    const l = earned(5);
    expect(hasEntry(l, 'e1')).toBe(true);
    for (const id of ['e2', 'E1', 'e', '']) {
      expect(hasEntry(l, id)).toBe(false);
    }
  });

  it('includes spend entry ids but not item ids', () => {
    const r = spend(earned(150), 'trail.red', 100);
    expect(r.status).toBe('applied');
    expect(hasEntry(r.ledger, spendId('trail.red'))).toBe(true);
    expect(hasEntry(r.ledger, 'spend:trail.red')).toBe(true);
    expect(hasEntry(r.ledger, 'trail.red')).toBe(false);
    expect(hasEntry(r.ledger, 'e1')).toBe(true);
  });

  it('excludes a refused zero gem earn', () => {
    const r = apply(EMPTY_LEDGER, { kind: 'earn', id: 'x', gems: 0, source: 'star' });
    expect(r.status).toBe('invalid');
    expect(hasEntry(r.ledger, 'x')).toBe(false);
  });

  it('excludes a spend refused for insufficient funds', () => {
    const r = spend(earned(99), 'trail.red', 100);
    expect(r.status).toBe('insufficient');
    expect(hasEntry(r.ledger, spendId('trail.red'))).toBe(false);
  });

  it('excludes a new spend id refused for an owned item', () => {
    const once = spend(earned(500), 'trail.red', 100).ledger;
    const r = apply(once, { kind: 'spend', id: 'spend:other', gems: 100, itemId: 'trail.red' });
    expect(r.status).toBe('owned');
    expect(hasEntry(r.ledger, 'spend:other')).toBe(false);
  });

  it('excludes a spend refused for an empty item id', () => {
    const r = spend(earned(500), '', 5);
    expect(r.status).toBe('invalid');
    expect(hasEntry(r.ledger, spendId(''))).toBe(false);
  });

  it('agrees with entryIds and duplicate detection after awards and a spend', () => {
    let l = applyAwards(EMPTY_LEDGER, awardsFor(BOSS_RUN));
    l = spend(l, 'trail.red', 40).ledger;
    const ids = entryIds(l);
    expect(ids.size).toBe(5);
    for (const id of ids) {
      expect(hasEntry(l, id)).toBe(true);
      expect(apply(l, { kind: 'earn', id, gems: 1, source: 'star' }).status).toBe('duplicate');
    }
    expect(hasEntry(l, 'earn:star:4:4')).toBe(false);
  });

  it('does not change the ledger', () => {
    const l = earned(5);
    const before = JSON.stringify(l);
    hasEntry(l, 'e1');
    hasEntry(l, 'e2');
    expect(JSON.stringify(l)).toBe(before);
  });
});

describe('earnEntry', () => {
  it('copies exactly the award fields into a fresh earn entry without changing the award', () => {
    const before = { ...award };
    const entry = earnEntry(award);
    expect(entry).toEqual({ kind: 'earn', id: 'earn:star:4:1', gems: 5, source: 'star' });
    expect(Object.keys(entry).sort()).toEqual(['gems', 'id', 'kind', 'source']);
    expect(earnEntry(award)).not.toBe(entry);
    expect(award).toEqual(before);
  });

  it.each<GemAward['source']>(['star', 'bossClear', 'endlessMilestone'])(
    'preserves the %s source',
    (source) => {
      expect(earnEntry({ ...award, source }).source).toBe(source);
    },
  );

  it('leaves zero gem validation to apply', () => {
    const entry = earnEntry({ id: 'z', source: 'star', gems: 0 });
    expect(entry.gems).toBe(0);
    expect(apply(EMPTY_LEDGER, entry).status).toBe('invalid');
  });

  it('produces an entry that applies once', () => {
    const r = apply(EMPTY_LEDGER, earnEntry(award));
    expect(r.status).toBe('applied');
    expect(balance(r.ledger)).toBe(5);
    expect(hasEntry(r.ledger, award.id)).toBe(true);
    expect(apply(r.ledger, earnEntry(award)).status).toBe('duplicate');
  });

  it('matches the entries applyAwards writes in award order', () => {
    const awards = awardsFor(BOSS_RUN);
    expect(awards).toHaveLength(4);
    const l = applyAwards(EMPTY_LEDGER, awards);
    expect(l.entries).toEqual(awards.map(earnEntry));
    expect(balance(l)).toBe(65);
    expect(l.inventory).toEqual([]);
  });

  it('matches the entries retained when applyAwards skips repeats and zero gem awards', () => {
    const zero: GemAward = { id: 'zero', source: 'star', gems: 0 };
    const boss: GemAward = { id: 'b', source: 'bossClear', gems: 50 };
    const l = applyAwards(EMPTY_LEDGER, [award, zero, award, boss]);
    expect(l.entries).toEqual([earnEntry(award), earnEntry(boss)]);
  });
});

describe('spendId', () => {
  it('prefixes the item id without changing it', () => {
    expect(spendId('trail.red')).toBe('spend:trail.red');
    expect(spendId('')).toBe('spend:');
    expect(spendId('spend:x')).toBe('spend:spend:x');
  });

  it('is stable for the same item and distinct for different items', () => {
    expect(spendId('trail.red')).toBe(spendId('trail.red'));
    expect(spendId('trail.red')).not.toBe(spendId('trail.blue'));
  });

  it('is written by spend and makes a repeat purchase a duplicate', () => {
    const r = spend(earned(150), 'trail.red', 100);
    expect(r.ledger.entries).toHaveLength(2);
    const last = r.ledger.entries.at(-1);
    if (last === undefined) throw new Error('Expected a spend entry');
    expect(last).toEqual({ kind: 'spend', id: spendId('trail.red'), gems: 100, itemId: 'trail.red' });
    expect(owns(r.ledger, 'trail.red')).toBe(true);
    const again = spend(r.ledger, 'trail.red', 1);
    expect(again.status).toBe('duplicate');
    expect(again.ledger).toBe(r.ledger);
  });

  it('identifies two purchases in entry order', () => {
    const l = spend(spend(earned(300), 'trail.red', 100).ledger, 'trail.blue', 100).ledger;
    expect([...entryIds(l)]).toEqual(['e1', 'spend:trail.red', 'spend:trail.blue']);
    expect(balance(l)).toBe(100);
  });
});
