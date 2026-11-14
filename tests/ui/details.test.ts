import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDetails, kvRow, shownItems } from '../../src/ui/details';
import type { LabelledValue } from '../../src/ui/intro';
import { installFakeDocument, type FakeEl } from './fakeDom';

const seed: LabelledValue = { label: 'Seed', value: '42' };
const kills: LabelledValue = { label: 'Kills', value: '412' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shownItems', () => {
  it('returns a new empty array for an empty input', () => {
    const items: readonly (LabelledValue | null)[] = [];
    const result = shownItems(items);

    expect(result).toEqual([]);
    expect(result).not.toBe(items);
  });

  it('drops null entries and preserves item order', () => {
    expect(shownItems([seed, null, kills])).toEqual([seed, kills]);
    expect(shownItems([kills, seed])).toEqual([kills, seed]);
    expect(shownItems([null, null])).toEqual([]);
  });

  it('drops items with an empty label or value', () => {
    const noLabel: LabelledValue = { label: '', value: 'x' };
    const noValue: LabelledValue = { label: 'Time', value: '' };
    const neither: LabelledValue = { label: '', value: '' };

    expect(shownItems([noLabel, seed, noValue, neither, kills])).toEqual([seed, kills]);
    expect(shownItems([noLabel, noValue, neither])).toEqual([]);
  });

  it('keeps whitespace and zero strings in order', () => {
    const spaces: LabelledValue = { label: ' ', value: ' ' };
    const zero: LabelledValue = { label: 'Kills', value: '0' };

    expect(shownItems([spaces, zero])).toEqual([spaces, zero]);
  });

  it('returns a new array with the same objects and leaves the input untouched', () => {
    const items = Object.freeze([seed, null, kills, seed]);
    const result = shownItems(items);

    expect(result).not.toBe(items);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(seed);
    expect(result[1]).toBe(kills);
    expect(result[2]).toBe(seed);
    expect(items).toHaveLength(4);
    expect(items[1]).toBeNull();
    expect(items).toEqual([seed, null, kills, seed]);

    const all = [seed, kills];
    const allShown = shownItems(all);
    expect(allShown).toEqual(all);
    expect(allShown).not.toBe(all);
  });
});

describe('kvRow', () => {
  it('builds a default div with a label span followed by a value span', () => {
    installFakeDocument();
    const row = kvRow(seed) as unknown as FakeEl;

    expect(row.tag).toBe('div');
    expect(row.className).toBe('sow-kv');
    expect(row.children).toHaveLength(2);
    const [label, value] = row.children;
    expect(label?.tag).toBe('span');
    expect(label?.className).toBe('sow-k');
    expect(label?.textContent).toBe('Seed');
    expect(label?.children).toEqual([]);
    expect(value?.tag).toBe('span');
    expect(value?.className).toBe('sow-v');
    expect(value?.textContent).toBe('42');
    expect(value?.children).toEqual([]);
  });

  it('replaces the default class with the supplied class string', () => {
    installFakeDocument();
    const wide = kvRow(seed, 'sow-kv sow-wide') as unknown as FakeEl;
    expect(wide.className).toBe('sow-kv sow-wide');
    expect(wide.classList.contains('sow-kv')).toBe(true);
    expect(wide.classList.contains('sow-wide')).toBe(true);

    installFakeDocument();
    const line = kvRow(seed, 'sow-line') as unknown as FakeEl;
    expect(line.className).toBe('sow-line');
    expect(line.classList.contains('sow-kv')).toBe(false);

    installFakeDocument();
    const unstyled = kvRow(seed, '') as unknown as FakeEl;
    expect(unstyled.className).toBe('');

    for (const row of [wide, line, unstyled]) {
      expect(row.children.map((span) => span.className)).toEqual(['sow-k', 'sow-v']);
    }
  });

  it('keeps empty strings and preserves surrounding whitespace', () => {
    installFakeDocument();
    const empty = kvRow({ label: '', value: '' }) as unknown as FakeEl;
    expect(empty.children.map((span) => span.tag)).toEqual(['span', 'span']);
    expect(empty.children.map((span) => span.textContent)).toEqual(['', '']);

    installFakeDocument();
    const padded = kvRow({ label: ' Kills ', value: ' 412 ' }) as unknown as FakeEl;
    expect(padded.children.map((span) => span.tag)).toEqual(['span', 'span']);
    expect(padded.children.map((span) => span.textContent)).toEqual([' Kills ', ' 412 ']);
  });

  it('creates a fresh row and spans without changing the item', () => {
    const item: LabelledValue = { label: 'Seed', value: '42' };
    installFakeDocument();
    const first = kvRow(item) as unknown as FakeEl;
    installFakeDocument();
    const second = kvRow(item) as unknown as FakeEl;

    expect(first).not.toBe(second);
    expect(first.children).toHaveLength(2);
    expect(second.children).toHaveLength(2);
    expect(first.children[0]).not.toBe(second.children[0]);
    expect(first.children[1]).not.toBe(second.children[1]);
    expect(item).toEqual({ label: 'Seed', value: '42' });
    expect(Object.keys(item).sort()).toEqual(['label', 'value']);
  });
});

describe('createDetails fill with shownItems', () => {
  it('fills one default row per shown item and hides the root when none remain', () => {
    installFakeDocument();
    const d = createDetails('data-test');
    d.fill(shownItems([seed, null, { label: '', value: 'x' }, kills]));
    const root = d.root as unknown as FakeEl;
    const body = root.children[1];
    if (body === undefined) throw new Error('Expected the details body');

    expect(body.getAttribute('data-test')).toBe('detailsBody');
    expect(body.children).toHaveLength(2);
    expect(body.children.map((row) => row.className)).toEqual(['sow-kv', 'sow-kv']);
    expect(body.children.map((row) => row.children.map((span) => span.textContent))).toEqual([
      ['Seed', '42'],
      ['Kills', '412'],
    ]);
    expect(root.style.display).toBe('');
    expect(d.isOpen()).toBe(false);

    d.fill(shownItems([null, { label: 'Time', value: '' }]));
    expect(body.children).toHaveLength(0);
    expect(root.style.display).toBe('none');
  });
});
