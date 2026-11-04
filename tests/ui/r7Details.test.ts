// R7 (Ryan, gate R6): the expanded Details section is a two column label and value grid with
// 16 px padding, a 10 px row gap and a 16 px column gap, so values never touch the border.
import { describe, expect, it } from 'vitest';
import { UI_CSS } from '../../src/ui/dom';
import { createDetails } from '../../src/ui/details';
import { installFakeDocument, type FakeEl } from './fakeDom';

function rule(selector: string): string {
  const start = UI_CSS.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return UI_CSS.slice(start, UI_CSS.indexOf('}', start));
}

describe('Details grid (R7)', () => {
  it('the body is a two column grid with 16 px padding, 10 px row gap and 16 px column gap', () => {
    const css = rule('.sow-details-body');
    expect(css).toMatch(/display: grid/);
    expect(css).toMatch(/grid-template-columns: [^;]+ [^;]+;/);
    expect(css).toMatch(/gap: 10px 16px/);
    expect(css).toMatch(/padding: 16px/);
    expect(css).toMatch(/border: 1px solid/);
  });

  it('rows flatten into the grid and values wrap inside the border', () => {
    expect(rule('.sow-details-body .sow-kv')).toMatch(/display: contents/);
    expect(rule('.sow-details-body .sow-v')).toMatch(/min-width: 0/);
    expect(rule('.sow-details-body .sow-v')).toMatch(/overflow-wrap: anywhere/);
  });

  it('every row has exactly a label and a value, in that order', () => {
    installFakeDocument();
    const d = createDetails('data-test');
    d.fill([{ label: 'Seed', value: '42' }, { label: 'Kills', value: '412' }]);
    d.setOpen(true);
    const body = d.root.children[1] as unknown as FakeEl;
    expect(body.children).toHaveLength(2);
    for (const row of body.children) {
      expect(row.children.map((c) => c.classList.contains('sow-k'))).toEqual([true, false]);
      expect(row.children[0]?.textContent).not.toBe('');
      expect(row.children[1]?.classList.contains('sow-v')).toBe(true);
    }
  });
});
