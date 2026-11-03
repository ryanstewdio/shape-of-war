// B7 regression: boot "Tap to start" screen; R2: the level intro card waits for Start, Ready text after.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOSS_IDS } from '../../src/levelgen/leveldef';
import { BOSS_NAMES } from '../../src/ui/boss';
import { bootFlow, reduceFlow, simRunning, type FlowAction } from '../../src/ui/flow';
import {
  arenaName,
  armIntro,
  bossIntroLine,
  createIntroScreen,
  endlessIntroCard,
  INTRO_SEC,
  introActive,
  introCard,
  NO_INTRO,
  READY_TEXT,
  START_LABEL,
  startIntro,
  tickIntro,
} from '../../src/ui/intro';
import { asParent, installFakeDocument, type FakeEl } from './fakeDom';

describe('B7 boot screen in the flow', () => {
  it('launches on the boot screen with the sim stopped', () => {
    const s = bootFlow(4);
    expect(s.screen).toBe('boot');
    expect(s.levelIndex).toBe(4);
    expect(simRunning(s)).toBe(false);
  });

  it('the tap goes to the menu; nothing else leaves boot', () => {
    const s = bootFlow();
    const stray: FlowAction[] = [
      { type: 'start', mode: 'adventure', levelIndex: 1 },
      { type: 'pause' },
      { type: 'hidden' },
      { type: 'resume' },
      { type: 'quit' },
      { type: 'openSettings' },
      { type: 'openLevels' },
      { type: 'retry' },
    ];
    for (const a of stray) expect(reduceFlow(s, a)).toBe(s);
    const menu = reduceFlow(s, { type: 'tapStart' });
    expect(menu.screen).toBe('menu');
    expect(reduceFlow(menu, { type: 'tapStart' })).toBe(menu);
  });
});

// R2: difficulty is chosen at the start of every level and of Endless. The card waits with no timer
// until Start; Endless then shows Ready for 1.5 s; Free Play goes straight to Ready.
describe('R2 intro gate', () => {
  it('Adventure and Endless get a card with no timer, Free Play gets Ready for 1.5 s', () => {
    expect(INTRO_SEC).toBe(1.5);
    expect(armIntro('adventure')).toEqual({ kind: 'card', left: Number.POSITIVE_INFINITY });
    expect(armIntro('endless')).toEqual({ kind: 'card', left: Number.POSITIVE_INFINITY });
    expect(armIntro('freeplay')).toEqual({ kind: 'ready', left: 1.5 });
    expect(READY_TEXT).toBe('Ready');
  });

  it('the card never times out, however long the sim time', () => {
    let g = armIntro('adventure');
    for (let i = 0; i < 120 * 600; i++) g = tickIntro(g, 1 / 120);
    expect(introActive(g)).toBe(true);
    expect(g.kind).toBe('card');
  });

  it('Start plays Adventure at once and gives Endless the Ready text', () => {
    expect(startIntro(armIntro('adventure'), 'adventure')).toBe(NO_INTRO);
    const ready = startIntro(armIntro('endless'), 'endless');
    expect(ready).toEqual({ kind: 'ready', left: 1.5 });
    expect(startIntro(ready, 'endless')).toBe(ready); // only a card starts
  });

  it('Ready holds the sim for 1.5 s of sim time then releases', () => {
    let g = armIntro('freeplay');
    let steps = 0;
    while (introActive(g) && steps < 1000) {
      g = tickIntro(g, 1 / 120);
      steps++;
    }
    expect(steps).toBe(180);
    expect(g).toBe(NO_INTRO);
  });

  it('a finished gate stays finished', () => {
    expect(introActive(NO_INTRO)).toBe(false);
    expect(tickIntro(NO_INTRO, 1)).toBe(NO_INTRO);
  });
});

describe('R2 intro card text', () => {
  const arena = { shape: 'circle', width: 900, height: 900, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } } as const;

  it('title line with level and arena, objective in one sentence, star marks as numbers, drone and super', () => {
    const card = introCard(7, {
      objective: { kind: 'destroy', count: 40 },
      par: 1500,
      stars: [1500, 3000, 6000],
      drone: 'collect',
      superType: 'detonate',
      arena: { ...arena, obstacles: [] },
    });
    expect(card.title).toBe('Level 7  Circle arena');
    expect(card.objective).toBe('Destroy 40 enemies.');
    expect(card.stars).toBe('★ 1,500   ★★ 3,000   ★★★ 6,000');
    expect(card.kit).toBe('Collect drone   Detonate super');
  });

  it('timed objectives read as clock text; a boss level adds the boss to the sentence', () => {
    const def = { objective: { kind: 'survive', durationSec: 90 } as const, par: 1000, stars: [1000, 2000, 4000] as [number, number, number], drone: 'attack' as const, superType: 'homing' as const };
    expect(introCard(1, def).objective).toBe('Survive 1:30.');
    expect(introCard(1, def).title).toBe('Level 1');
    expect(introCard(1, { ...def, boss: { id: 'warden', tier: 1, atSec: 20, hpMul: 1 } }).objective).toBe('Survive 1:30, then defeat the boss.');
  });

  it('arena names: drum for a cylinder surface, else by shape', () => {
    expect(arenaName({ arena: { ...arena, shape: 'rect', obstacles: [] } })).toBe('Rectangle');
    expect(arenaName({ arena: { ...arena, shape: 'rectObstacles', obstacles: [] } })).toBe('Pillars');
    expect(arenaName({ arena: { ...arena, shape: 'hexagon', obstacles: [] } })).toBe('Hexagon');
    expect(arenaName({ arena: { ...arena, shape: 'roundRect', obstacles: [] } })).toBe('Rounded');
    expect(arenaName({ arena: { ...arena, obstacles: [] }, surface: 'cylinder' })).toBe('Drum');
    expect(arenaName({})).toBe('');
  });

  it('the Endless card has the arena title, a sentence and no stars', () => {
    const c = endlessIntroCard({ arena: { ...arena, shape: 'rect', obstacles: [] } }, 'hard');
    expect(c.title).toBe('Endless  Rectangle arena');
    expect(c.stars).toBe('');
    expect(c.choice).toBe('hard');
  });

  describe('screen', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('Start is the only way off the card; a tap on the card background does nothing', () => {
      const root = installFakeDocument();
      let starts = 0;
      const screen = createIntroScreen(asParent(root), () => void starts++);
      screen.showCard(introCard(2, { objective: { kind: 'destroy', count: 5 }, par: 10, stars: [10, 20, 40], drone: 'attack', superType: 'homing' }, 'normal'));
      root.children[0]?.tap();
      expect(starts).toBe(0);
      const start = root.all().find((e) => e.getAttribute('data-intro') === 'start');
      expect(start?.textContent).toBe(START_LABEL);
      start?.tap();
      expect(starts).toBe(1);
    });

    it('the Ready text hides the chips, stars and Start', () => {
      const root = installFakeDocument();
      const screen = createIntroScreen(asParent(root), () => undefined);
      screen.showReady();
      for (const k of ['difficulty', 'stars', 'start']) expect(root.all().find((e) => e.getAttribute('data-intro') === k)?.style.display, k).toBe('none');
    });
  });
});

// V3-A: the card shows "Boss: <name>" on a boss level (docs/13 section 9).
describe('V3-A intro card boss line', () => {
  afterEach(() => vi.unstubAllGlobals());
  const def = {
    objective: { kind: 'survive', durationSec: 90 } as const,
    par: 4000,
    stars: [4000, 8000, 16000] as [number, number, number],
    drone: 'attack' as const,
    superType: 'homing' as const,
  };

  it('a boss level adds "Boss: <name>" from BOSS_NAMES', () => {
    expect(introCard(5, { ...def, boss: { id: 'warden', tier: 1, atSec: 20, hpMul: 1 } }).boss).toBe('Boss: Warden');
    expect(introCard(50, { ...def, boss: { id: 'prism', tier: 4, atSec: 20, hpMul: 1 } }).boss).toBe('Boss: Prism');
  });

  it('every boss id gets its own line', () => {
    const lines = BOSS_IDS.map((id) => bossIntroLine({ id, tier: 1, atSec: 20, hpMul: 1 }));
    expect(lines).toEqual(BOSS_IDS.map((id) => `Boss: ${BOSS_NAMES[id]}`));
    expect(new Set(lines).size).toBe(10);
  });

  it('follows an edit of BOSS_NAMES, the const Ryan edits: no name is written in intro.ts', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/ui/intro.ts', import.meta.url)), 'utf8');
    for (const name of Object.values(BOSS_NAMES)) expect(src).not.toContain(name);
    expect(src).toContain('bossName');
  });

  it('a level with no boss has no line, and the other card lines are unchanged', () => {
    const plain = introCard(7, def);
    expect(plain.boss).toBe('');
    expect(bossIntroLine(undefined)).toBe('');
    const withBoss = introCard(7, { ...def, boss: { id: 'brood', tier: 1, atSec: 20, hpMul: 1 } });
    expect({ ...withBoss, boss: '', objective: plain.objective }).toEqual(plain);
  });

  describe('screen', () => {
    const bossEl = (root: FakeEl): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-intro') === 'boss');
    const build = () => {
      const root = installFakeDocument();
      const screen = createIntroScreen(asParent(root), () => undefined);
      return { root, screen };
    };

    it('shows the line on a boss card and hides it on a plain one', () => {
      const { root, screen } = build();
      screen.showCard(introCard(5, { ...def, boss: { id: 'warden', tier: 1, atSec: 20, hpMul: 1 } }));
      expect(bossEl(root)?.textContent).toBe('Boss: Warden');
      expect(bossEl(root)?.style.display).toBe('');
      screen.showCard(introCard(6, def));
      expect(bossEl(root)?.style.display).toBe('none');
    });

    it('the Endless Ready text never shows it, even right after a boss card', () => {
      const { root, screen } = build();
      screen.showCard(introCard(5, { ...def, boss: { id: 'warden', tier: 1, atSec: 20, hpMul: 1 } }));
      screen.showReady();
      expect(bossEl(root)?.style.display).toBe('none');
    });
  });
});
