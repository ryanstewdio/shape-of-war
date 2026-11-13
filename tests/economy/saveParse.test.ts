import { describe, expect, it } from 'vitest';
import { EMPTY_LEDGER, apply, spend, type Ledger } from '../../src/economy/ledger';
import { toSave, parseEntry, isV0, migrateV0, fromSave, SAVE_VERSION, V0_MIGRATION_ID } from '../../src/economy/save';

describe('toSave', () => {
  it('saves the empty ledger with fresh arrays', () => {
    const saved = toSave(EMPTY_LEDGER);
    expect(saved).toStrictEqual({ version: 1, entries: [], inventory: [] });
    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.entries).not.toBe(EMPTY_LEDGER.entries);
    expect(saved.inventory).not.toBe(EMPTY_LEDGER.inventory);
  });

  it('preserves entry and purchase order in fresh arrays and loads back equal', () => {
    let ledger: Ledger = EMPTY_LEDGER;
    ledger = apply(ledger, { kind: 'earn', id: 'earn:star', gems: 100, source: 'star' }).ledger;
    ledger = apply(ledger, { kind: 'earn', id: 'earn:boss', gems: 200, source: 'bossClear' }).ledger;
    ledger = spend(ledger, 'trail.red', 100).ledger;
    ledger = spend(ledger, 'arena.ring', 150).ledger;

    const saved = toSave(ledger);
    expect(saved.entries).toStrictEqual([
      { kind: 'earn', id: 'earn:star', gems: 100, source: 'star' },
      { kind: 'earn', id: 'earn:boss', gems: 200, source: 'bossClear' },
      { kind: 'spend', id: 'spend:trail.red', gems: 100, itemId: 'trail.red' },
      { kind: 'spend', id: 'spend:arena.ring', gems: 150, itemId: 'arena.ring' },
    ]);
    expect(saved.inventory).toStrictEqual(['trail.red', 'arena.ring']);
    expect(saved.entries).not.toBe(ledger.entries);
    expect(saved.inventory).not.toBe(ledger.inventory);
    const loaded = fromSave(saved);
    expect(loaded.status).toBe('ok');
    expect(loaded.ledger).toStrictEqual(ledger);
  });
});

describe('parseEntry', () => {
  it.each([null, undefined, 42, 'entry', []].map((input: unknown) => ({ input })))('rejects a non-object: $input', ({ input }) => {
    expect(parseEntry(input)).toBe('entry is not an object');
  });

  it.each([
    { kind: 'earn', gems: 5 },
    { kind: 'earn', id: 1, gems: 5 },
    { kind: 'earn', id: '', gems: 5 },
    { id: '', gems: -1 },
  ])('rejects a missing id before checking gems: %j', (input: unknown) => {
    expect(parseEntry(input)).toBe('entry id missing');
  });

  it('rejects absent gems', () => {
    expect(parseEntry({ kind: 'earn', id: 'a' })).toBe('entry a: bad gems');
  });

  it.each(['5', 0, -5, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects bad gems: %s', (gems) => {
    expect(parseEntry({ kind: 'earn', id: 'a', gems })).toBe('entry a: bad gems');
  });

  it('checks gems before kind', () => {
    expect(parseEntry({ kind: 'gift', id: 'a', gems: 0 })).toBe('entry a: bad gems');
  });

  it('accepts the maximum safe integer', () => {
    expect(parseEntry({ kind: 'earn', id: 'a', gems: Number.MAX_SAFE_INTEGER, source: 'star' })).toStrictEqual({
      kind: 'earn', id: 'a', gems: Number.MAX_SAFE_INTEGER, source: 'star',
    });
  });

  it('parses an earn exactly', () => {
    expect(parseEntry({ kind: 'earn', id: 'a', gems: 5, source: 'star' })).toStrictEqual({
      kind: 'earn', id: 'a', gems: 5, source: 'star',
    });
  });

  it('defaults an absent earn source to an empty string', () => {
    expect(parseEntry({ kind: 'earn', id: 'a', gems: 5 })).toStrictEqual({
      kind: 'earn', id: 'a', gems: 5, source: '',
    });
  });

  it.each([undefined, null, 5, false, [], {}].map((source: unknown) => ({ source })))('defaults a non-string earn source: $source', ({ source }) => {
    expect(parseEntry({ kind: 'earn', id: 'a', gems: 5, source })).toStrictEqual({
      kind: 'earn', id: 'a', gems: 5, source: '',
    });
  });

  it('drops unknown fields and itemId from an earn without changing its input', () => {
    const input = { kind: 'earn', id: 'a', gems: 5, source: 'star', itemId: 'trail.red', extra: { tags: ['keep'] } };
    const before = structuredClone(input);
    expect(parseEntry(input)).toStrictEqual({ kind: 'earn', id: 'a', gems: 5, source: 'star' });
    expect(input).toStrictEqual(before);
  });

  it('parses a spend exactly', () => {
    expect(parseEntry({ kind: 'spend', id: 's', gems: 100, itemId: 'trail.red' })).toStrictEqual({
      kind: 'spend', id: 's', gems: 100, itemId: 'trail.red',
    });
  });

  it('drops source from a spend without changing its input', () => {
    const input = { kind: 'spend', id: 's', gems: 100, itemId: 'trail.red', source: 'star' };
    const before = structuredClone(input);
    expect(parseEntry(input)).toStrictEqual({ kind: 'spend', id: 's', gems: 100, itemId: 'trail.red' });
    expect(input).toStrictEqual(before);
  });

  it.each([
    { kind: 'spend', id: 's', gems: 100 },
    { kind: 'spend', id: 's', gems: 100, itemId: 1 },
    { kind: 'spend', id: 's', gems: 100, itemId: '' },
  ])('rejects a missing item id: %j', (input: unknown) => {
    expect(parseEntry(input)).toBe('entry s: item id missing');
  });

  it.each([{ kind: 'gift', id: 'a', gems: 5 }, { id: 'a', gems: 5 }])('rejects unknown kind: %j', (input: unknown) => {
    expect(parseEntry(input)).toBe('entry a: unknown kind');
  });
});

describe('isV0', () => {
  it.each([
    { gems: 240, owned: ['trail.red'] },
    { gems: 0, owned: [] },
    { gems: -5, owned: [] },
    { gems: 2.5, owned: [] },
  ])('recognizes the shape without validating the balance: %j', (input: unknown) => {
    expect(isV0(input)).toBe(true);
  });

  it.each([
    null,
    5,
    'save',
    [],
    { version: 1, gems: 5, owned: [] },
    { version: 0, gems: 5, owned: [] },
    { gems: '5', owned: [] },
    { gems: 5 },
    { owned: [] },
    { gems: 5, owned: [1] },
    { gems: 5, owned: [''] },
    { gems: 5, owned: 'trail.red' },
  ].map((input: unknown) => ({ input })))('rejects a non-v0 shape: $input', ({ input }) => {
    expect(isV0(input)).toBe(false);
  });
});

describe('migrateV0', () => {
  it('creates the migration earn and deduplicates owned items in order without mutating them', () => {
    const input = { gems: 240, owned: ['trail.red', 'arena.ring', 'trail.red'] };
    const before = structuredClone(input);
    const migrated = migrateV0(input);
    if (typeof migrated === 'string') throw new Error(migrated);

    expect(migrated).toStrictEqual({
      version: 1,
      entries: [{ kind: 'earn', id: V0_MIGRATION_ID, gems: 240, source: 'migration' }],
      inventory: ['trail.red', 'arena.ring'],
    });
    expect(input).toStrictEqual(before);
    expect(migrated.inventory).not.toBe(input.owned);
  });

  it('keeps owned items but creates no earn for a zero balance', () => {
    expect(migrateV0({ gems: 0, owned: ['trail.red'] })).toStrictEqual({
      version: 1, entries: [], inventory: ['trail.red'],
    });
  });

  it.each([-1, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid balance: %s', (gems) => {
    expect(migrateV0({ gems, owned: [] })).toBe('v0: bad gems');
  });

  it('agrees with the loader on the migrated ledger', () => {
    const input = { gems: 240, owned: ['trail.red', 'arena.ring', 'trail.red'] };
    const migrated = migrateV0(input);
    if (typeof migrated === 'string') throw new Error(migrated);

    const direct = fromSave(input);
    const viaHook = fromSave(migrated);
    expect(direct.status).toBe('migrated');
    expect(viaHook.status).toBe('ok');
    expect(viaHook.ledger).toStrictEqual(direct.ledger);
  });
});
