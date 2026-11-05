import { describe, expect, it } from 'vitest';
import { buttonPaint, CELL, CELL_INSET, FILL_DIM, FILL_PRESSED, FILL_REST, pixelRing, RIM_W, superPaint } from '../../src/input/buttonLook';
import { BOMB_HIT, BOMB_VISUAL, LABEL_H, LABEL_RISE, SUPER_GAP, SUPER_HIT, SUPER_VISUAL } from '../../src/input/buttons';

describe('button sizes (thumbs-button-look)', () => {
  it('bomb and super are the same size, drawn and hit', () => {
    expect(BOMB_VISUAL).toBe(SUPER_VISUAL);
    expect(BOMB_HIT).toBe(SUPER_HIT);
    expect(BOMB_VISUAL).toBeLessThan(BOMB_HIT);
  });

  it('the label fills the gap between the super hit circle and the bomb disc exactly', () => {
    expect(SUPER_GAP).toBe(12);
    expect(LABEL_H).toBe(SUPER_GAP + (BOMB_HIT - BOMB_VISUAL) / 2);
    expect(LABEL_RISE).toBe(12);
  });
});

describe('buttonPaint', () => {
  it('25 percent at rest, 50 pressed, dim when not ready', () => {
    expect(buttonPaint({ held: false, ready: true }).fill).toBe(0.25);
    expect(FILL_REST).toBe(0.25);
    expect(buttonPaint({ held: true, ready: true }).fill).toBe(0.5);
    expect(FILL_PRESSED).toBe(0.5);
    const dim = buttonPaint({ held: false, ready: false });
    expect(dim.fill).toBe(FILL_DIM);
    expect(dim.fill).toBeLessThan(FILL_REST);
    expect(dim.rim).toBeLessThan(1);
    expect(dim.cells).toBeLessThan(buttonPaint({ held: false, ready: true }).cells);
  });

  it('a press on an empty button still shows the pressed look', () => {
    expect(buttonPaint({ held: true, ready: false }).fill).toBe(FILL_PRESSED);
  });

  it('rim is 1.5 to 2 px', () => {
    expect(RIM_W).toBeGreaterThanOrEqual(1.5);
    expect(RIM_W).toBeLessThanOrEqual(2);
  });
});

describe('superPaint', () => {
  it('charging: the charged sweep at rest fill over a dim disc and a dim rim', () => {
    const p = superPaint(0.4, false);
    expect(p.fill).toBe(FILL_REST);
    expect(p.rest).toBe(FILL_DIM);
    expect(p.rim).toBeLessThan(1);
  });

  it('charged: the full disc at rest fill; held: 50 percent', () => {
    expect(superPaint(1, false)).toEqual(buttonPaint({ held: false, ready: true }));
    expect(superPaint(0.2, true).fill).toBe(FILL_PRESSED);
    expect(superPaint(0.2, true).rest).toBe(FILL_PRESSED);
  });

  it('treats a bad charge as empty', () => {
    expect(superPaint(Number.NaN, false).rest).toBe(FILL_DIM);
  });
});

describe('pixelRing', () => {
  const d = BOMB_VISUAL;
  const cells = pixelRing(d);

  it('is a ring of whole pixel square cells', () => {
    expect(cells.length).toBeGreaterThanOrEqual(12);
    for (const c of cells) {
      expect(Number.isInteger(c.x) && Number.isInteger(c.y)).toBe(true);
      expect(c.s).toBe(CELL);
    }
    expect(new Set(cells.map((c) => `${c.x},${c.y}`)).size).toBe(cells.length);
  });

  it('every cell sits inside the disc, clear of the rim', () => {
    const inner = d / 2 - RIM_W;
    for (const c of cells) {
      for (const [x, y] of [[c.x, c.y], [c.x + c.s, c.y], [c.x, c.y + c.s], [c.x + c.s, c.y + c.s]] as const) {
        expect(Math.hypot(x - d / 2, y - d / 2)).toBeLessThanOrEqual(inner);
      }
    }
  });

  it('leaves the centre free for the bomb count', () => {
    const free = d / 2 - RIM_W - CELL_INSET - 2 * CELL;
    for (const c of cells) expect(Math.hypot(c.x + c.s / 2 - d / 2, c.y + c.s / 2 - d / 2)).toBeGreaterThan(free);
  });

  it('is empty for a disc too small to hold one', () => {
    expect(pixelRing(8)).toEqual([]);
  });
});
