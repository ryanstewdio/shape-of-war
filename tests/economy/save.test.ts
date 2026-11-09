import { describe, expect, it } from 'vitest';
import { apply, balance, EMPTY_LEDGER, owns, spend, type Ledger } from '../../src/economy/ledger';
import { deserialize, fromSave, serialize, SAVE_VERSION, V0_MIGRATION_ID } from '../../src/economy/save';

function sample(): Ledger {
  let l = apply(EMPTY_LEDGER, { kind: 'earn', id: 'earn:star:0:1', gems: 5, source: 'star' }).ledger;
  l = apply(l, { kind: 'earn', id: 'earn:boss:4', gems: 150, source: 'bossClear' }).ledger;
  return spend(l, 'trail.red', 100).ledger;
}

describe('save round trip', () => {
  it('serializes as v1 and loads back equal', () => {
    const l = sample();
    const text = serialize(l);
    expect(JSON.parse(text).version).toBe(SAVE_VERSION);
    const r = deserialize(text);
    expect(r.status).toBe('ok');
    expect(r.problems).toEqual([]);
    expect(r.ledger).toEqual(l);
    expect(balance(r.ledger)).toBe(55);
  });

  it('round trips the empty ledger', () => {
    const r = deserialize(serialize(EMPTY_LEDGER));
    expect(r.status).toBe('ok');
    expect(r.ledger).toEqual(EMPTY_LEDGER);
  });

  it('reads nothing stored as an empty wallet', () => {
    expect(deserialize(null).status).toBe('empty');
    expect(deserialize('').status).toBe('empty');
    expect(fromSave(undefined).status).toBe('empty');
  });
});

describe('migration from v0', () => {
  it('turns a hand written v0 balance and owned list into a v1 ledger', () => {
    const v0 = '{"gems": 240, "owned": ["trail.red", "arena.ring", "trail.red"]}';
    const r = deserialize(v0);
    expect(r.status).toBe('migrated');
    expect(balance(r.ledger)).toBe(240);
    expect(r.ledger.entries).toEqual([{ kind: 'earn', id: V0_MIGRATION_ID, gems: 240, source: 'migration' }]);
    expect(r.ledger.inventory).toEqual(['trail.red', 'arena.ring']);
    expect(owns(r.ledger, 'arena.ring')).toBe(true);
  });

  it('keeps a migrated wallet stable through a save and reload', () => {
    const m = deserialize('{"gems": 0, "owned": ["trail.red"]}');
    expect(m.status).toBe('migrated');
    const again = deserialize(serialize(m.ledger));
    expect(again.status).toBe('ok');
    expect(again.ledger).toEqual(m.ledger);
  });

  it('rejects a v0 with a negative or fractional balance', () => {
    expect(deserialize('{"gems": -5, "owned": []}').status).toBe('corrupt');
    expect(deserialize('{"gems": 2.5, "owned": []}').status).toBe('corrupt');
  });
});

describe('corrupt input', () => {
  const cases: Record<string, string> = {
    'not JSON': '{gems',
    'JSON null': 'null',
    'a number': '42',
    'an array': '[]',
    'unknown older version': '{"version": 0, "entries": [], "inventory": []}',
    'newer version': '{"version": 2, "entries": [], "inventory": []}',
    'entries missing': '{"version": 1, "inventory": []}',
    'inventory not strings': '{"version": 1, "entries": [], "inventory": [1]}',
    'unknown kind': '{"version": 1, "entries": [{"kind": "gift", "id": "a", "gems": 5}], "inventory": []}',
    'negative gems': '{"version": 1, "entries": [{"kind": "earn", "id": "a", "gems": -5}], "inventory": []}',
    'duplicate id':
      '{"version": 1, "entries": [{"kind": "earn", "id": "a", "gems": 5}, {"kind": "earn", "id": "a", "gems": 5}], "inventory": []}',
    'spend beyond balance':
      '{"version": 1, "entries": [{"kind": "spend", "id": "s", "gems": 100, "itemId": "x"}], "inventory": ["x"]}',
    'bought item missing from inventory':
      '{"version": 1, "entries": [{"kind": "earn", "id": "a", "gems": 100}, {"kind": "spend", "id": "s", "gems": 100, "itemId": "x"}], "inventory": []}',
  };

  for (const [name, text] of Object.entries(cases)) {
    it(`falls back to an empty wallet without throwing: ${name}`, () => {
      const r = deserialize(text);
      expect(r.status).toBe('corrupt');
      expect(r.problems.length).toBeGreaterThan(0);
      expect(r.ledger).toEqual(EMPTY_LEDGER);
    });
  }
});
