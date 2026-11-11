import { describe, expect, it } from 'vitest';
import { bossBarFeed } from '../../src/ui/boss';
import { FIGHT_TOAST_MS } from '../../src/ui/fightTimer';
import { createHud } from '../../src/ui/hud';
import type { BossView } from '../../src/game/bosses/view';
import { installFakeDocument, type FakeEl } from './fakeDom';

const view = (o: Partial<BossView>): BossView => ({ active: true, id: 0, mode: 2, phase: 1, hp: 100, maxHp: 100, modeT: 0, x: 0, y: 0, rot: 0, radius: 1, barOn: true, barHp: 100, barMax: 100, broodlings: false, ...o });

function build() {
  const root = installFakeDocument();
  const hud = createHud(root as unknown as HTMLElement, () => 0);
  const find = (n: string): FakeEl => {
    const e = root.all().find((x) => x.getAttribute('data-hud') === n);
    if (e === undefined) throw new Error(n);
    return e;
  };
  return { hud, find };
}

describe('Brood split refill', () => {
  it('keeps feeding after the body is gone (active false, barOn true)', () => {
    expect(bossBarFeed(view({ active: false, barOn: true, barHp: 40, barMax: 40, broodlings: true }))).toEqual({ shield: 1, health: 1, label: 'Broodlings' });
  });
  it('feeds nothing with no guardian', () => {
    expect(bossBarFeed(view({ active: false, barOn: false }))).toBeNull();
  });
  it('refills at the split, then drains with the Broodlings', () => {
    const { hud, find } = build();
    hud.setBoss({ id: 'brood', hp: 5, maxHp: 100, phase: 1, phases: 2, mode: 2 });
    hud.setBossBar(bossBarFeed(view({ barHp: 5, barMax: 100 })) ?? { shield: 0, health: 0, label: '' });
    expect(find('health-fill').style.width).not.toBe('100%');
    hud.setBossBar(bossBarFeed(view({ active: false, broodlings: true, barHp: 40, barMax: 40 })) ?? { shield: 0, health: 0, label: '' });
    expect(find('shield-fill').style.width).toBe('100%');
    expect(find('health-fill').style.width).toBe('100%');
    expect(find('boss-name').textContent).toBe('Broodlings');
    hud.setBossBar(bossBarFeed(view({ active: false, broodlings: true, barHp: 10, barMax: 40 })) ?? { shield: 0, health: 0, label: '' });
    expect(find('shield-fill').style.width).toBe('0%');
    expect(find('health-fill').style.width).not.toBe('100%');
  });
  it('does not jump up otherwise', () => {
    let prev = 2;
    for (const hp of [100, 80, 60, 30, 10, 0]) {
      const b = bossBarFeed(view({ barHp: hp }));
      const total = (b?.shield ?? 0) + (b?.health ?? 0);
      expect(total).toBeLessThanOrEqual(prev);
      prev = total;
    }
  });
  it('shows the dev fight line for 6 s', () => {
    expect(FIGHT_TOAST_MS).toBe(6000);
  });
});
