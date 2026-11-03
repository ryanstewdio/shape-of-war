// Fight length (docs/12 D5, G3A paste; release polish item 7). A scripted fight: a gunner who lands
// the docs/13 open fire figure (18 spread hits a second, 180 tenths a second, half of 36 bullets)
// whenever the core is exposed, pops one part every POD_REACTION seconds while a breakable part
// lives (Brood pods, Gravitas anchors, Bastion turrets, Prism pods and nodes, Mirage mirrors), and
// after a split keeps the same fire on the body parts one at a time. It measures the seconds from
// the end of the entrance to the kill, windows included. Release polish: every boss at Normal on
// its own campaign level (Warden 5 to Prism 50), attack rotation on, lasts 210 to 260 s (Ryan:
// "at least 3.5 minutes of boss fighting"). Before it Warden ran about 60 s, Brood 37, Spindle 28.
// R1: a skilled player beat Warden in about 150 s where this script said 210 to 260 s, so the
// script is weaker than Ryan. Every row rose 40 percent and the band with it: 294 to 364 s (R1
// script: warden 314.8, brood 330.0, spindle 328.8, ember 345.3, mirage 329.6, gravitas 325.7,
// bastion 327.6, tempest 328.9, twins 328.8, prism 334.6).
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { damageBoss, damageBossPart, livePart } from '../../src/game/bosses/core';
import { bossNominalLevel, MAX_PARTS } from '../../src/game/bosses/table';
import { PartType } from '../../src/game/bosses/types';
import { stepGame } from '../../src/game/game';
import { BOSS_IDS, type BossId } from '../../src/levelgen/leveldef';
import { bs, bossGame, enter, park } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => bus.clear());

const OPEN_FIRE = 180;
const POD_REACTION = 0.5;
const MIN_SEC = 294;
const MAX_SEC = 364;

/** Seconds from the end of the entrance to the kill on the script, Infinity past 500 s. */
function fightSeconds(id: BossId): number {
  const level = bossNominalLevel(BOSS_IDS.indexOf(id));
  const w = bossGame(id, { lives: 99, levelIndex: level }, {}, true, 0.25, true);
  park(w, 500, 300);
  enter(w);
  const s = bs(w);
  let acc = 0;
  let podClock = 0;
  for (let i = 0; i < 120 * 500; i++) {
    let pod = -1;
    for (let k = 0; k < MAX_PARTS && pod < 0; k++) {
      const p = livePart(w, s, k);
      // A Twin is the second body (its hits come off the shared bar), not a part to pop.
      if (p > 0 && w.a[p] !== PartType.Broodling && w.a[p] !== PartType.Twin) pod = p;
    }
    if (s.split) {
      acc += OPEN_FIRE * DT;
      const n = Math.floor(acc);
      let target = -1;
      for (let k = 0; k < MAX_PARTS && target < 0; k++) target = livePart(w, s, k);
      if (n > 0 && target > 0) {
        damageBossPart(w, target, n, 0, 0);
        acc -= n;
      }
    } else if (pod > 0) {
      podClock += DT;
      if (podClock >= POD_REACTION) {
        damageBossPart(w, pod, 9999, 0, 0);
        podClock = 0;
      }
    } else {
      podClock = 0;
    }
    if (s.exposed) {
      acc += OPEN_FIRE * DT;
      const n = Math.floor(acc);
      if (n > 0) {
        // Hits land on the body centre (inside Mirage's open arc whenever it is open).
        damageBoss(w, n, w.x[s.id] ?? 0, w.y[s.id] ?? 0);
        acc -= n;
      }
    }
    if (s.status === 'defeated') return i / 120;
    stepGame(w, DT, idle());
  }
  return Infinity;
}

describe('fight length at open fire, Normal, each boss on its own level (R1 band)', () => {
  const secs = new Map<BossId, number>();
  for (const id of BOSS_IDS) secs.set(id, fightSeconds(id));

  it('reports the ten fights', () => {
    console.info(`fight seconds: ${BOSS_IDS.map((id) => `${id} ${(secs.get(id) ?? 0).toFixed(1)}`).join(', ')}`);
    expect(secs.size).toBe(10);
  });

  for (const id of BOSS_IDS) {
    it(`${id} lasts ${MIN_SEC} to ${MAX_SEC} s`, () => {
      const t = secs.get(id) ?? 0;
      expect(t).toBeGreaterThanOrEqual(MIN_SEC);
      expect(t).toBeLessThanOrEqual(MAX_SEC);
    });
  }
});
