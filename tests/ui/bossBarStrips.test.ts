import { describe, expect, it } from 'vitest';
import { Bus } from '../../src/core/events';
import { createHud } from '../../src/ui/hud';
import { objectiveProgress } from '../../src/ui/objective';
import { installFakeDocument, type FakeEl } from './fakeDom';

const obj = { kind: 'destroy', count: 300 } as const;
const spec = { id: 'warden', tier: 1, atSec: 120, hpMul: 1 } as const;
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
  const count = (n: string): number => root.all().filter((x) => x.getAttribute('data-hud') === n).length;
  return { hud, find, count };
}

describe('one boss bar', () => {
  it('has exactly one pair of strips, in the boss bar, and none in the objective bar', () => {
    const { count } = build();
    expect(count('shield-strip')).toBe(1);
    expect(count('health-strip')).toBe(1);
    expect(count('boss-bar')).toBe(1);
  });
  it('draws blue shield over red health from the BossBar', () => {
    const { hud, find } = build();
    hud.setBoss({ id: 'warden', hp: 10, maxHp: 10, phase: 1, phases: 2, mode: 0 });
    hud.setBossBar({ shield: 0.5, health: 1, label: '' });
    expect(find('shield-fill').style.width).toBe('50%');
    expect(find('health-fill').style.width).toBe('100%');
    expect(find('shield-fill').style.background).toContain('hsla(215');
    expect(find('health-fill').style.background).toContain('hsla(355');
    expect(find('boss-name').textContent).toBe('Warden');
  });
  it('dims the shield strip once it is gone', () => {
    const { hud, find } = build();
    hud.setBoss({ id: 'warden', hp: 4, maxHp: 10, phase: 1, phases: 2, mode: 0 });
    hud.setBossBar({ shield: 0, health: 0.4, label: '' });
    expect(find('shield-strip').style.opacity).toBe('0.3');
    expect(find('health-fill').style.width).toBe('40%');
  });
  it('names the Broodlings phase and goes back to the guardian name', () => {
    const { hud, find } = build();
    hud.setBoss({ id: 'brood', hp: 10, maxHp: 10, phase: 1, phases: 2, mode: 0 });
    hud.setBossBar({ shield: 1, health: 1, label: 'Broodlings' });
    expect(find('boss-name').textContent).toBe('Broodlings');
    hud.setBoss({ id: 'brood', hp: 10, maxHp: 10, phase: 1, phases: 2, mode: 0 });
    expect(find('boss-name').textContent).toBe('Broodlings');
    hud.setBossBar({ shield: 1, health: 1, label: '' });
    expect(find('boss-name').textContent).toBe('Brood');
  });
  it('the objective bar holds no strips and a full boss payload still draws', () => {
    const { hud, find } = build();
    hud.setObjective(objectiveProgress(obj, snap(130), true, undefined, { spec, bar: { shield: 0.5, health: 1, label: '' } }));
    expect(find('boss-bar').style.display).toBe('none');
  });
});
