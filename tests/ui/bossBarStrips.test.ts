import { describe, expect, it } from 'vitest';
import { Bus } from '../../src/core/events';
import { createHud } from '../../src/ui/hud';
import { objectiveProgress } from '../../src/ui/objective';
import { installFakeDocument, type FakeEl } from './fakeDom';

const spec = { id: 'warden', tier: 1, atSec: 120, hpMul: 1 } as const;
const obj = { kind: 'destroy', count: 300 } as const;
const snap = (t: number) => ({ elapsedSec: t, score: 0, kills: 0, lives: 3 });

function build() {
  const root = installFakeDocument();
  const hud = createHud(root as unknown as HTMLElement, () => 0);
  hud.listen(new Bus());
  const find = (n: string): FakeEl => {
    const e = root.all().find((x) => x.getAttribute('data-hud') === n);
    if (e === undefined) throw new Error(n);
    return e;
  };
  return { hud, find };
}

describe('boss bar strips', () => {
  it('draws blue shield over red health and the label', () => {
    const { hud, find } = build();
    hud.setObjective(objectiveProgress(obj, snap(130), true, undefined, { spec, bar: { shield: 0.5, health: 1, label: '' } }));
    expect(find('shield-fill').style.width).toBe('50%');
    expect(find('health-fill').style.width).toBe('100%');
    expect(find('shield-strip').style.display).toBe('');
    expect(find('shield-fill').style.background).toContain('hsla(215');
    expect(find('health-fill').style.background).toContain('hsla(355');
  });
  it('dims the shield strip once it is gone', () => {
    const { hud, find } = build();
    hud.setObjective(objectiveProgress(obj, snap(130), true, undefined, { spec, bar: { shield: 0, health: 0.4, label: '' } }));
    expect(find('shield-strip').style.opacity).toBe('0.3');
    expect(find('health-fill').style.width).toBe('40%');
  });
  it('hides the strips before the entrance and on other levels', () => {
    const { hud, find } = build();
    hud.setObjective(objectiveProgress(obj, snap(30), false, undefined, { spec, bar: { shield: 1, health: 1, label: '' } }));
    expect(find('shield-strip').style.display).toBe('none');
    expect(find('health-strip').style.display).toBe('none');
  });
});
