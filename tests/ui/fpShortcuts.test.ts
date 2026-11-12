// Free Play setup: the All and None chips rendered 240 px tall at 1280 by 720. Their row sits in a
// column flex box, so the shared .sow-choice-btns basis (240px) became its height. Checked in a
// browser at 1280x720, 915x412 and 1080x900: 44 px like the other chips, 48 px touch target.
import { describe, expect, it } from 'vitest';
import { FP_SHORTCUT_PAD_PX, MIN_HIT_PX, UI_CSS } from '../../src/ui/dom';

describe('Free Play All and None chips', () => {
  it('the shortcut row keeps its content height in the column enemy box', () => {
    expect(UI_CSS).toContain('.sow-fp-enemies { display: flex; flex-direction: column;');
    expect(UI_CSS).toContain('.sow-fp-enemies .sow-choice-btns { flex: 0 0 auto; }');
  });

  it('the chips keep the shared chip height', () => {
    expect(UI_CSS).toContain(`.sow-fp-enemies .sow-btn { min-width: 0; min-height: ${MIN_HIT_PX}px;`);
  });

  it('an invisible band lifts the touch target to at least 48 px', () => {
    const border = 2; // .sow-btn border width; the band is measured from the padding box
    expect(MIN_HIT_PX + 2 * (FP_SHORTCUT_PAD_PX - border)).toBeGreaterThanOrEqual(48);
    expect(UI_CSS).toContain('.sow-btn { font: inherit; font-size: 18px; min-width: 160px; min-height: 52px; padding: 10px 20px;\n  color: hsl(190, 60%, 92%); background: rgba(10, 30, 50, 0.85); border: 2px solid');
    expect(UI_CSS).toContain(`.sow-fp-enemies .sow-choice-btns .sow-btn::after { content: ''; position: absolute; inset: -${FP_SHORTCUT_PAD_PX}px 0; }`);
  });

  it('the other choice rows keep the 240 px basis', () => {
    expect(UI_CSS).toContain('.sow-choice-btns { display: flex; flex: 1 1 240px; gap: 6px; }');
  });
});
