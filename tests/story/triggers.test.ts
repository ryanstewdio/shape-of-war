// Story trigger rules (docs/19 "Scene rules"): new kinds by the newFoes rule, at most two briefings
// with the rest deferred, combos when both kinds share a level, guardian intros and freeing scenes,
// once per save, Adventure only.
import { describe, expect, it } from 'vitest';
import { briefingQueue, bossWinScenes, levelStartScenes, MAX_BRIEFINGS, replayScenes, storyLevels } from '../../src/story/triggers';
import type { FoeKind } from '../../src/ui/enemyIntro';

type Levels = FoeKind[][];
const start = (foesByLevel: Levels, seen: Record<string, number> = {}, boss?: 'brood' | 'warden') =>
  levelStartScenes({ mode: 'adventure', levelIndex: foesByLevel.length, foesByLevel, seen, ...(boss === undefined ? {} : { boss }) });

describe('level start scenes', () => {
  it('plays the opening, then the briefing for the first kind, before level 1', () => {
    expect(start([['grunt']])).toEqual(['opening', 'foe:grunt']);
  });

  it('plays each briefing once per save and the opening once', () => {
    expect(start([['grunt']], { opening: 1, 'foe:grunt': 1 })).toEqual([]);
    expect(start([['grunt'], ['grunt', 'wanderer']], { opening: 1, 'foe:grunt': 1 })).toEqual(['foe:wanderer']);
  });

  it('briefs only kinds new to the run (the newFoes rule), in roster order', () => {
    const levels: Levels = [['grunt'], ['grunt', 'pinwheel', 'wanderer']];
    expect(start(levels, { opening: 1, 'foe:grunt': 1 })).toEqual(['foe:pinwheel', 'foe:wanderer']);
  });

  it('plays at most two briefings and defers the rest to the next level', () => {
    const l1: FoeKind[] = ['grunt', 'wanderer', 'pinwheel', 'weaver'];
    expect(start([l1])).toEqual(['opening', 'foe:grunt', 'foe:wanderer']);
    expect(MAX_BRIEFINGS).toBe(2);
    const seen = { opening: 1, 'foe:grunt': 1, 'foe:wanderer': 1 };
    expect(start([l1, ['grunt', 'dart']], seen)).toEqual(['foe:pinwheel', 'foe:weaver']);
    const seen3 = { ...seen, 'foe:pinwheel': 2, 'foe:weaver': 2 };
    expect(start([l1, ['grunt', 'dart'], ['grunt']], seen3)).toEqual(['foe:dart']);
  });

  it('counts placed wells and spawners as kinds', () => {
    expect(start([['grunt'], ['grunt', 'well']], { opening: 1, 'foe:grunt': 1 })).toEqual(['foe:well']);
  });

  it('does not brief again on a replayed early level, and a fresh save on a late level gets only that level news', () => {
    const levels: Levels = [['grunt'], ['wanderer'], ['pinwheel']];
    expect(start(levels.slice(0, 1), { opening: 1, 'foe:grunt': 1, 'foe:wanderer': 2, 'foe:pinwheel': 3 })).toEqual([]);
    expect(start(levels, { opening: 1 })).toEqual(['foe:pinwheel']);
  });

  it('plays a combo when both kinds first share a level and both are briefed', () => {
    const seen = { opening: 1, 'foe:charger': 7, 'foe:splime': 11 };
    expect(start([['charger'], ['splime'], ['charger', 'splime']], seen)).toEqual(['combo:charger+splime']);
    // apart, no combo
    expect(start([['charger'], ['splime']], { opening: 1, 'foe:charger': 1 })).toEqual(['foe:splime']);
    // the briefing of one kind plays first on the same level, then the combo
    expect(start([['charger'], ['charger', 'splime']], { opening: 1, 'foe:charger': 1 })).toEqual(['foe:splime', 'combo:charger+splime']);
    // once per save
    expect(start([['charger', 'splime']], { ...seen, 'combo:charger+splime': 3 })).toEqual([]);
  });

  it('waits with a combo while one of its kinds is still deferred', () => {
    const l1: FoeKind[] = ['grunt', 'wanderer', 'charger', 'splime'];
    expect(start([l1])).toEqual(['opening', 'foe:grunt', 'foe:wanderer']);
    const seen = { opening: 1, 'foe:grunt': 1, 'foe:wanderer': 1 };
    expect(start([l1, l1], seen)).toEqual(['foe:charger', 'foe:splime', 'combo:charger+splime']);
  });

  it('plays the guardian intro last, before a boss level, once', () => {
    const levels: Levels = [['grunt'], ['grunt'], ['grunt'], ['grunt'], ['grunt', 'weaver']];
    expect(start(levels, { opening: 1, 'foe:grunt': 1 }, 'brood')).toEqual(['foe:weaver', 'boss:brood']);
    expect(start(levels, { opening: 1, 'foe:grunt': 1, 'foe:weaver': 5, 'boss:brood': 5 }, 'brood')).toEqual([]);
  });

  it('shows nothing in Endless or Free Play', () => {
    for (const mode of ['endless', 'freeplay'] as const) {
      expect(levelStartScenes({ mode, levelIndex: 1, foesByLevel: [['grunt']], seen: {}, boss: 'brood' })).toEqual([]);
    }
  });

  it('the queue walks earlier levels as if each showed its first two', () => {
    expect(briefingQueue([['grunt', 'wanderer', 'pinwheel'], []])).toEqual(['pinwheel']);
    expect(briefingQueue([])).toEqual([]);
  });
});

describe('boss win scenes', () => {
  it('plays the freeing scene once, Adventure only', () => {
    expect(bossWinScenes('adventure', 'brood', {})).toEqual(['freed:brood']);
    expect(bossWinScenes('adventure', 'brood', { 'freed:brood': 5 })).toEqual([]);
    expect(bossWinScenes('adventure', undefined, {})).toEqual([]);
    expect(bossWinScenes('endless', 'brood', {})).toEqual([]);
    expect(bossWinScenes('freeplay', 'prism', {})).toEqual([]);
  });
});

describe('replay story', () => {
  it('lists the scenes first shown on a level, in bible order, and the levels that have any', () => {
    const seen = { 'freed:brood': 5, opening: 1, 'boss:brood': 5, 'foe:grunt': 1, 'foe:weaver': 5 };
    expect(replayScenes(seen, 1)).toEqual(['opening', 'foe:grunt']);
    expect(replayScenes(seen, 5)).toEqual(['boss:brood', 'freed:brood', 'foe:weaver'].sort((a, b) => order(a) - order(b)));
    expect(replayScenes(seen, 2)).toEqual([]);
    expect([...storyLevels(seen)].sort()).toEqual([1, 5]);
  });
});

import { SCENE_IDS } from '../../src/story/scenes';
function order(id: string): number {
  return SCENE_IDS.indexOf(id);
}
