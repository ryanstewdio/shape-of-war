import { describe, expect, it } from 'vitest';
import { awardsFor, type ResultEvent } from '../../src/economy/earn';
import {
  apply,
  applyAwards,
  balance,
  EMPTY_LEDGER,
  entryIds,
  owns,
  spend,
  type Ledger,
} from '../../src/economy/ledger';

function earned(gems: number, id = 'e1'): Ledger {
  return apply(EMPTY_LEDGER, { kind: 'earn', id, gems, source: 'star' }).ledger;
}

describe('ledger apply', () => {
  it('starts empty', () => {
    expect(balance(EMPTY_LEDGER)).toBe(0);
    expect(EMPTY_LEDGER.inventory).toEqual([]);
  });

  it('adds earn entries to the balance', () => {
    const l = apply(earned(5), { kind: 'earn', id: 'e2', gems: 50, source: 'bossClear' }).ledger;
    expect(balance(l)).toBe(55);
    expect(l.entries.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('is idempotent by id', () => {
    const l = earned(5);
    const r = apply(l, { kind: 'earn', id: 'e1', gems: 5, source: 'star' });
    expect(r.status).toBe('duplicate');
    expect(r.ledger).toBe(l);
    expect(balance(r.ledger)).toBe(5);
  });

  it('does not mutate the input', () => {
    const l = earned(5);
    apply(l, { kind: 'earn', id: 'e2', gems: 5, source: 'star' });
    expect(l.entries).toHaveLength(1);
  });

  it('rejects zero, negative, fractional and non finite amounts and empty ids', () => {
    for (const gems of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(apply(EMPTY_LEDGER, { kind: 'earn', id: 'x', gems, source: 'star' }).status).toBe('invalid');
    }
    expect(apply(EMPTY_LEDGER, { kind: 'earn', id: '', gems: 5, source: 'star' }).status).toBe('invalid');
    expect(apply(earned(500), { kind: 'spend', id: 's', gems: 5, itemId: '' }).status).toBe('invalid');
  });
});

describe('spend', () => {
  it('buys an item, lowers the balance and adds it to the inventory', () => {
    const r = spend(earned(150), 'trail.red', 100);
    expect(r.status).toBe('applied');
    expect(balance(r.ledger)).toBe(50);
    expect(owns(r.ledger, 'trail.red')).toBe(true);
  });

  it('refuses a spend that would go negative', () => {
    const l = earned(99);
    const r = spend(l, 'trail.red', 100);
    expect(r.status).toBe('insufficient');
    expect(r.ledger).toBe(l);
    expect(owns(r.ledger, 'trail.red')).toBe(false);
  });

  it('allows spending the exact balance down to zero', () => {
    const r = spend(earned(100), 'trail.red', 100);
    expect(r.status).toBe('applied');
    expect(balance(r.ledger)).toBe(0);
  });

  it('refuses buying an owned item twice', () => {
    const once = spend(earned(500), 'trail.red', 100).ledger;
    const twice = spend(once, 'trail.red', 100);
    expect(twice.status).toBe('duplicate');
    expect(balance(twice.ledger)).toBe(400);
    const other = apply(once, { kind: 'spend', id: 'spend:other', gems: 100, itemId: 'trail.red' });
    expect(other.status).toBe('owned');
  });

  it('never goes negative over any sequence of spends', () => {
    let l = earned(250);
    const prices = [100, 400, 100, 800, 100, 1500, 50, 1];
    prices.forEach((p, i) => {
      l = spend(l, `item${i}`, p).ledger;
      expect(balance(l)).toBeGreaterThanOrEqual(0);
    });
    expect(balance(l)).toBe(0);
    expect(l.inventory).toEqual(['item0', 'item2', 'item6']);
  });
});

describe('awards into the ledger', () => {
  it('pays a result once even when applied twice', () => {
    const e: ResultEvent = {
      mode: 'adventure',
      levelIndex: 4,
      difficulty: 'hard',
      starsBefore: 0,
      starsAfter: 3,
      bossLevel: true,
      success: true,
      score: 5000,
    };
    const once = applyAwards(EMPTY_LEDGER, awardsFor(e));
    expect(balance(once)).toBe(65);
    const twice = applyAwards(once, awardsFor(e));
    expect(twice.entries).toEqual(once.entries);
    expect(awardsFor(e, entryIds(once))).toEqual([]);
  });
});
