import { describe, expect, it, vi } from 'vitest';
import { inlineRectLevel } from '../../src/game/world';
import { VALID_FIXTURES } from '../../src/levelgen/fixtures';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { fallbackHash, hashLevel, looksLikeLevel, pickLevel, type GeneratorModule } from '../../src/ui/levelSource';

describe('looksLikeLevel', () => {
  it('accepts an inline level, every valid fixture and a JSON round trip', () => {
    expect(looksLikeLevel(inlineRectLevel(1))).toBe(true);
    expect(VALID_FIXTURES.length).toBeGreaterThan(0);
    for (const fixture of VALID_FIXTURES) {
      expect(looksLikeLevel(fixture)).toBe(true);
    }
    const roundTrip: unknown = JSON.parse(JSON.stringify(inlineRectLevel(3)));
    expect(looksLikeLevel(roundTrip)).toBe(true);
  });

  it('accepts the smallest shape and ignores extra keys', () => {
    expect(looksLikeLevel({ arena: { width: 1 }, objective: {}, par: 0 })).toBe(true);
    expect(looksLikeLevel({ arena: { width: 2, extra: true }, objective: { kind: 'x' }, par: 5, junk: [] })).toBe(true);
  });

  it.each([
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'zero', value: 0 },
    { label: 'one', value: 1 },
    { label: 'a string', value: 'level' },
    { label: 'true', value: true },
    { label: 'false', value: false },
    { label: 'a function', value: () => undefined },
    { label: 'an empty array', value: [] },
    { label: 'an empty object', value: {} },
  ])('rejects $label', ({ value }) => {
    expect(looksLikeLevel(value)).toBe(false);
  });

  it('rejects a missing arena', () => {
    expect(looksLikeLevel({ objective: {}, par: 1 })).toBe(false);
  });

  it.each([
    { label: 'null', arena: null },
    { label: 'a number', arena: 800 },
    { label: 'a string', arena: 'rect' },
    { label: 'missing width', arena: { height: 5 } },
    { label: 'a string width', arena: { width: '800' } },
    { label: 'a null width', arena: { width: null } },
  ])('rejects an arena with $label', ({ arena }) => {
    expect(looksLikeLevel({ arena, objective: {}, par: 1 })).toBe(false);
  });

  it('rejects a missing objective', () => {
    expect(looksLikeLevel({ arena: { width: 1 }, par: 1 })).toBe(false);
  });

  it.each([
    { label: 'null', objective: null },
    { label: 'a string', objective: 'score' },
    { label: 'a number', objective: 3 },
  ])('rejects $label as the objective', ({ objective }) => {
    expect(looksLikeLevel({ arena: { width: 1 }, objective, par: 1 })).toBe(false);
  });

  it('rejects a missing par', () => {
    expect(looksLikeLevel({ arena: { width: 1 }, objective: {} })).toBe(false);
  });

  it.each([
    { label: 'a string', par: '100' },
    { label: 'null', par: null },
  ])('rejects $label as par', ({ par }) => {
    expect(looksLikeLevel({ arena: { width: 1 }, objective: {}, par })).toBe(false);
  });
});

describe('hashLevel', () => {
  const def: LevelDef = inlineRectLevel(1);

  it('uses the fallback when there is no hasher', () => {
    const expected = fallbackHash(def);
    expect(expected).toMatch(/^[0-9a-f]{8}$/);
    expect(hashLevel(null, def)).toBe(expected);
    expect(hashLevel({}, def)).toBe(expected);
    const mod: GeneratorModule = { generateLevel: () => def };
    expect(hashLevel(mod, def)).toBe(expected);
  });

  it.each([
    { label: 'a string', levelHash: 'feedf00d' },
    { label: 'a number', levelHash: 42 },
    { label: 'null', levelHash: null },
    { label: 'undefined', levelHash: undefined },
    { label: 'an object', levelHash: {} },
    { label: 'true', levelHash: true },
  ])('uses the fallback when levelHash is $label', ({ levelHash }) => {
    expect(hashLevel({ levelHash }, def)).toBe(fallbackHash(def));
  });

  it.each(['feedf00d', 'Not Hex!'])('returns the string %s unchanged', (result) => {
    expect(hashLevel({ levelHash: () => result }, def)).toBe(result);
  });

  it('uses the fallback for an empty string result', () => {
    expect(hashLevel({ levelHash: () => '' }, def)).toBe(fallbackHash(def));
  });

  it.each([
    { result: 255, expected: '000000ff' },
    { result: 0, expected: '00000000' },
    { result: -1, expected: 'ffffffff' },
    { result: 0xfeedf00d, expected: 'feedf00d' },
    { result: 4294967296, expected: '00000000' },
    { result: 4294967297, expected: '00000001' },
    { result: 3.7, expected: '00000003' },
    { result: -3.7, expected: 'fffffffd' },
  ])('converts $result to unsigned 32 bit hex $expected', ({ result, expected }) => {
    expect(hashLevel({ levelHash: () => result }, def)).toBe(expected);
  });

  it.each([
    { label: 'NaN', result: NaN },
    { label: 'Infinity', result: Infinity },
    { label: '-Infinity', result: -Infinity },
    { label: 'null', result: null },
    { label: 'undefined', result: undefined },
    { label: 'true', result: true },
    { label: 'false', result: false },
    { label: 'an object', result: {} },
    { label: 'an array', result: [] },
    { label: 'a bigint', result: 10n },
  ])('uses the fallback when the hasher returns $label', ({ result }) => {
    expect(hashLevel({ levelHash: () => result }, def)).toBe(fallbackHash(def));
  });

  it('catches a throwing hasher and returns the fallback', () => {
    const mod: GeneratorModule = {
      levelHash: (): never => {
        throw new Error('hash failed');
      },
    };
    expect(() => hashLevel(mod, def)).not.toThrow();
    expect(hashLevel(mod, def)).toBe(fallbackHash(def));
  });

  it('calls the hasher once per call with the same level and never calls the generator', () => {
    const levelHash = vi.fn((_received: LevelDef): string => 'feedf00d');
    const generateLevel = vi.fn(() => def);
    const mod: GeneratorModule = { levelHash, generateLevel };

    hashLevel(mod, def);
    expect(levelHash).toHaveBeenCalledTimes(1);
    expect(levelHash.mock.calls[0]?.[0]).toBe(def);
    hashLevel(mod, def);
    expect(levelHash).toHaveBeenCalledTimes(2);
    expect(levelHash.mock.calls[1]?.[0]).toBe(def);
    expect(generateLevel).not.toHaveBeenCalled();

    hashLevel({ generateLevel }, def);
    expect(generateLevel).not.toHaveBeenCalled();
  });

  it('uses the supplied level for a stable fallback hash', () => {
    const other: LevelDef = inlineRectLevel(2);
    expect(hashLevel(null, other)).toBe(fallbackHash(other));
    expect(hashLevel(null, other)).not.toBe(hashLevel(null, def));
    expect(hashLevel(null, def)).toBe(hashLevel(null, def));
  });
});

describe('pickLevel hash delegation', () => {
  it('uses hashLevel for the fixture when there is no module', () => {
    const first = VALID_FIXTURES[0];
    if (first === undefined) throw new Error('expected at least one valid fixture');
    expect(pickLevel(null, 1, 1, VALID_FIXTURES).hash).toBe(hashLevel(null, first));
  });

  it('uses the module hasher on the fixture path without a generator', () => {
    const mod: GeneratorModule = { levelHash: () => 7 };
    const picked = pickLevel(mod, 1, 1, VALID_FIXTURES);
    expect(picked.source).toBe('fixture');
    expect(picked.hash).toBe('00000007');
  });

  it('uses the module hasher on the generator path', () => {
    const mod: GeneratorModule = {
      generateLevel: () => inlineRectLevel(1),
      levelHash: () => 255,
    };
    const picked = pickLevel(mod, 1, 1, VALID_FIXTURES);
    expect(picked.source).toBe('generator');
    expect(picked.hash).toBe('000000ff');
  });
});
