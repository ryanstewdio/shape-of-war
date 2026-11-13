// Fight length (docs/12 D5; release polish item 7; boss health, Ryan 2026-11-11). The fight bot
// (bossFightBot.ts: the default weapon's open fire figure whenever the core is exposed, one part
// popped every 0.5 s, the body parts shot after a split) on each guardian at Normal on its Adventure
// level (Brood 5, Warden 10, then 15 to 50), attack rotation on. Ryan's ruling: about 60 to 75 s
// at tier 1 (Brood, Warden, Spindle), 90 s at tier 2, 2 min at tier 3, 2.5 min for Prism, each
// band 20 percent either side of its target. Easy is shorter and Insane longer through bossScale.
// Before (R1 rows, every fight 313 to 345 s at Normal): warden 313, brood 330, spindle 329,
// ember 345, mirage 330, gravitas 326, bastion 328, tempest 329, twins 329, prism 335.
// Warden fury wave: warden 72 to 65 (the dash windows), brood 59 to 27 (device time retune).
// Fury tune (Ryan 2026-11-12): mirage 96 to 44 (1150 to 650 hit points from his 2:45 device fight).
// Fury orbs (Ryan 2026-11-13): gravitas 95 to 78 (1704 to 1300 hit points from his 2:15 device fight).
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { bossNominalLevel } from '../../src/game/bosses/table';
import { FIRST_FIGHT_HP_MUL, T3_SWAPPED_BOSSES } from '../../src/levelgen/boss';
import { BOSS_IDS, type BossId } from '../../src/levelgen/leveldef';
import { fightSeconds } from './bossFightBot';

afterEach(() => bus.clear());

/**
 * Ryan's target seconds at Normal (the Adventure order ramps inside a tier). Brood (Warden fury
 * wave): its rows now come from Ryan's device time (150 to 170 s on device against a 60 s target),
 * not the bot; the bot reads about 27 s for the retuned fight (59 before); the calm pass (body 340, Broodlings 450) reads 44 s, so its band sits there.
 * Mirage (fury tune, Ryan 2026-11-12): tuned from Ryan's device time like Brood (2:45 on device on
 * 1150 hit points); on 650 the gate aware bot reads 44.4 s (Easy 30.6, Insane 95.2), so its band sits there.
 * Gravitas (fury orbs, Ryan 2026-11-13): tuned from Ryan's device time like Brood and Mirage (2:15 on
 * device on 1704 hit points against 90 s); on 1300 the bot reads 78.2 s (Easy 45.7, Insane 123.0), so
 * its band sits there.
 */
const FIGHT_TARGET_SEC: Readonly<Record<BossId, number>> = {
  brood: 44,
  warden: 67.5,
  spindle: 75,
  ember: 85,
  mirage: 44,
  gravitas: 78,
  bastion: 115,
  tempest: 120,
  twins: 125,
  prism: 150,
};
const BAND = 0.2;
/** Rows tuned from Ryan's device time, not the bot ramp: they leave the tier ramp check (Mirage, fury tune; Gravitas, fury orbs). */
const DEVICE_TUNED: ReadonlySet<BossId> = new Set<BossId>(['mirage', 'gravitas']);

/** The Adventure level of a guardian (version 9 swaps the first two bosses). */
function adventureLevel(id: BossId): number {
  for (const [j, swapped] of Object.entries(T3_SWAPPED_BOSSES)) if (swapped === id) return 5 * Number(j);
  return bossNominalLevel(BOSS_IDS.indexOf(id));
}

describe('fight length on the bot, each guardian on its Adventure level (boss health band)', () => {
  const normal = new Map<BossId, number>();
  const easy = new Map<BossId, number>();
  const insane = new Map<BossId, number>();
  for (const id of BOSS_IDS) {
    const levelIndex = adventureLevel(id);
    normal.set(id, fightSeconds(id, { levelIndex }));
    easy.set(id, fightSeconds(id, { levelIndex, difficulty: 'easy' }));
    insane.set(id, fightSeconds(id, { levelIndex, difficulty: 'insane' }));
  }

  it('reports the ten fights', () => {
    const row = (m: Map<BossId, number>): string => BOSS_IDS.map((id) => `${id} ${(m.get(id) ?? 0).toFixed(1)}`).join(', ');
    console.info(`fight seconds normal: ${row(normal)}\neasy: ${row(easy)}\ninsane: ${row(insane)}`);
    expect(normal.size).toBe(10);
  });

  for (const id of BOSS_IDS) {
    const target = FIGHT_TARGET_SEC[id];
    it(`${id} lasts ${(target * (1 - BAND)).toFixed(0)} to ${(target * (1 + BAND)).toFixed(0)} s at Normal`, () => {
      const t = normal.get(id) ?? 0;
      expect(t).toBeGreaterThanOrEqual(target * (1 - BAND));
      expect(t).toBeLessThanOrEqual(target * (1 + BAND));
    });
    it(`${id} is shorter on Easy and longer on Insane, and always ends`, () => {
      const n = normal.get(id) ?? 0;
      expect(easy.get(id) ?? Infinity).toBeLessThan(n);
      expect(insane.get(id) ?? 0).toBeGreaterThan(n);
      expect(Number.isFinite(insane.get(id) ?? Infinity)).toBe(true);
    });
  }

  it('the fights ramp by tier: every tier 2 fight outlasts every tier 1 fight, and so on up to Prism (Mirage and Gravitas, device tuned, left out)', () => {
    const all: BossId[][] = [
      ['brood', 'warden', 'spindle'],
      ['ember', 'mirage', 'gravitas'],
      ['bastion', 'tempest', 'twins'],
      ['prism'],
    ];
    const tiers = all.map((t) => t.filter((id) => !DEVICE_TUNED.has(id)));
    expect(tiers[1]).toEqual(['ember']);
    for (let k = 1; k < tiers.length; k++) {
      const lo = Math.max(...(tiers[k - 1] ?? []).map((id) => normal.get(id) ?? 0));
      const hi = Math.min(...(tiers[k] ?? []).map((id) => normal.get(id) ?? 0));
      expect(hi).toBeGreaterThan(lo);
    }
  });

  it('Adventure first fight discount: Brood at level 5 with hpMul 0.75 is shorter still', () => {
    const t = fightSeconds('brood', { levelIndex: 5, hpMul: FIRST_FIGHT_HP_MUL });
    expect(FIRST_FIGHT_HP_MUL).toBe(0.75);
    expect(t).toBeLessThan(normal.get('brood') ?? 0);
    expect(t).toBeGreaterThan(0.6 * (normal.get('brood') ?? 0));
  });
});
