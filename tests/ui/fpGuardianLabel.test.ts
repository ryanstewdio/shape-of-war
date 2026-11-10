// Free Play guardian option label (Ryan, 2026-11-10): "Every 2 min", and old saves that stored
// 'every3' load as that option. The chosen boss labels are unchanged.
import { describe, expect, it } from 'vitest';
import { parseFreePlaySetup } from '../../src/core/settings';
import { FREE_PLAY_BOSSES, bossesLabel } from '../../src/ui/freePlay';

describe('free play guardian option label', () => {
  it('reads Every 2 min, with Off first and the chosen bosses after', () => {
    expect(bossesLabel('every3')).toBe('Every 2 min');
    expect(bossesLabel('off')).toBe('Off');
    expect(FREE_PLAY_BOSSES.slice(0, 2)).toEqual(['off', 'every3']);
    expect(bossesLabel('warden')).not.toMatch(/min/);
  });

  it('an old save with every3 loads as the Every 2 min option', () => {
    const old = JSON.stringify({ arena: 'rect', barriers: true, config: { bosses: 'every3' } });
    const s = parseFreePlaySetup(old);
    expect(s.config.bosses).toBe('every3');
    expect(bossesLabel(s.config.bosses)).toBe('Every 2 min');
  });
});
