// B7 regression: boot "Tap to start" screen; R2: the level intro card waits for Start, Ready text after.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOSS_IDS } from '../../src/levelgen/leveldef';
import { BOSS_NAMES } from '../../src/ui/boss';
import { bootFlow, reduceFlow, simRunning, type FlowAction } from '../../src/ui/flow';
import { SUPER_DURATION, TURBO_PIERCE, TURBO_SCALE, TURBO_SPEED_SCALE } from '../../src/game/supers';
import { UI_CSS } from '../../src/ui/dom';
import {
  arenaName,
  armIntro,
  bossIntroLine,
  createIntroScreen,
  endlessIntroCard,
  ENDLESS_GOAL,
  ENDLESS_VICTORY,
  ENEMIES_LABEL,
  GOAL_LABEL,
  INTRO_SEC,
  introActive,
  introCard,
  labelled,
  LOADOUT_LABEL,
  loadoutItems,
  NO_INTRO,
  objectiveSentence,
  READY_TEXT,
  SEED_LABEL,
  START_LABEL,
  STARS_LABEL,
  starCapLine,
  starTargets,
  startIntro,
  tickIntro,
  TURBO_NUMBERS,
  turboText,
  VICTORY_LABEL,
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

describe('R3 intro card text', () => {
  const arena = { shape: 'circle', width: 900, height: 900, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } } as const;

  it('title line, goal and victory, labelled star targets with the cap, loadout and seed', () => {
    const card = introCard(
      7,
      { objective: { kind: 'destroy', count: 530 }, par: 2100000, stars: [2100000, 2600000, 3200000], drone: 'collect', superType: 'detonate', arena: { ...arena, obstacles: [] } },
      'normal',
      { seed: '12345' },
    );
    expect(card.title).toBe('Level 7  Circle arena');
    expect(card.goal).toBe('Destroy 530 enemies before your lives run out');
    expect(card.victory).toBe('530 kills with a life left');
    expect(card.stars.map(labelled)).toEqual(['1 star: 2.1M', '2 stars: 2.6M', '3 stars: 3.2M']);
    expect(card.starCap).toBe('Normal: max 2 stars');
    expect(card.loadout.map(labelled)).toEqual(['Drone: Collect', 'Super: Detonate (your drone explodes and destroys the enemies around it)']);
    expect(card.seed).toBe('12345');
    expect(card.enemies).toEqual([]);
  });

  it('goal sentences: survive, score in time and boss (R3 brief wording)', () => {
    const def = { objective: { kind: 'survive', durationSec: 210 } as const, stars: [1000, 2000, 4000] as [number, number, number], drone: 'attack' as const, superType: 'homing' as const };
    expect(introCard(1, def).goal).toBe('Survive 3:30');
    expect(introCard(1, def).victory).toBe('3:30 survived with a life left');
    expect(introCard(1, def).title).toBe('Level 1');
    const score = { ...def, objective: { kind: 'scoreInTime', target: 2100000, timeLimitSec: 210 } as const };
    expect(introCard(1, score).goal).toBe('Score 2.1M in 3:30');
    expect(introCard(1, score).victory).toBe('2.1M points when the 3:30 clock runs out with a life left');
    const boss = { ...def, boss: { id: 'warden', tier: 1, atSec: 20, hpMul: 1 } as const };
    expect(introCard(5, boss).goal).toBe(`Clear the waves, then defeat ${BOSS_NAMES.warden}`);
    expect(introCard(5, boss).victory).toBe(`3:30 survived, then ${BOSS_NAMES.warden} destroyed, with a life left`);
    expect(objectiveSentence(def)).toBe('Survive 3:30.');
  });

  it('star cap per difficulty', () => {
    expect(starCapLine('easy')).toBe('Easy: max 1 star');
    expect(starCapLine('normal')).toBe('Normal: max 2 stars');
    expect(starCapLine('hard')).toBe('Hard: max 3 stars');
    expect(starCapLine('insane')).toBe('Insane: max 3 stars, plus a 4th for a win');
    expect(starTargets([1000, 1250, 1500]).map(labelled)).toEqual(['1 star: 1,000', '2 stars: 1,250', '3 stars: 1,500']);
  });

  it('Turbo text is built from the supers.ts numbers', () => {
    expect(TURBO_NUMBERS).toEqual({ fire: TURBO_SCALE, speed: TURBO_SPEED_SCALE, pierce: TURBO_PIERCE, durationSec: SUPER_DURATION });
    const pct = Math.round((TURBO_SPEED_SCALE - 1) * 100);
    const fire = TURBO_SCALE === 2 ? 'doubles fire rate' : `${TURBO_SCALE}x fire rate`;
    expect(turboText()).toBe(`${fire}, ${pct}% faster ship, shots pierce ${TURBO_PIERCE} ${TURBO_PIERCE === 1 ? 'enemy' : 'enemies'}, ${SUPER_DURATION} s`);
    expect(turboText({ fire: 2, speed: 1.25, pierce: 1, durationSec: 5 })).toBe('doubles fire rate, 25% faster ship, shots pierce 1 enemy, 5 s');
    expect(turboText({ fire: 2.5, speed: 1.35, pierce: 2, durationSec: 10 })).toBe('2.5x fire rate, 35% faster ship, shots pierce 2 enemies, 10 s');
    expect(loadoutItems('attack', 'turbo').map(labelled)).toEqual(['Drone: Attack', `Super: Turbo (${turboText()})`]);
    expect(loadoutItems('ram', 'homing', 'Extra life').map(labelled)).toEqual(['Drone: Ram', `Super: Homing (shots home on nearby enemies, ${SUPER_DURATION} s)`, 'Reward: Extra life']);
  });

  it('arena names: drum for a cylinder surface, else by shape', () => {
    expect(arenaName({ arena: { ...arena, shape: 'rect', obstacles: [] } })).toBe('Rectangle');
    expect(arenaName({ arena: { ...arena, shape: 'rectObstacles', obstacles: [] } })).toBe('Pillars');
    expect(arenaName({ arena: { ...arena, shape: 'hexagon', obstacles: [] } })).toBe('Hexagon');
    expect(arenaName({ arena: { ...arena, shape: 'roundRect', obstacles: [] } })).toBe('Rounded');
    expect(arenaName({ arena: { ...arena, obstacles: [] }, surface: 'cylinder' })).toBe('Drum');
    expect(arenaName({})).toBe('');
  });

  it('the Endless card has the arena title, a goal, no victory target and no stars', () => {
    const c = endlessIntroCard({ arena: { ...arena, shape: 'rect', obstacles: [] }, drone: 'attack', superType: 'turbo' }, 'hard', { seed: '9' });
    expect(c.title).toBe('Endless  Rectangle arena');
    expect(c.goal).toBe(ENDLESS_GOAL);
    expect(c.victory).toBe(ENDLESS_VICTORY);
    expect(c.stars).toEqual([]);
    expect(c.starCap).toBe('');
    expect(c.loadout.map((v) => v.label)).toEqual(['Drone', 'Super']);
    expect(c.choice).toBe('hard');
  });

  describe('screen', () => {
    afterEach(() => vi.unstubAllGlobals());
    const byIntro = (root: FakeEl, k: string): FakeEl | undefined => root.all().find((e) => e.getAttribute('data-intro') === k);
    const def = { objective: { kind: 'destroy', count: 5 } as const, stars: [10, 20, 40] as [number, number, number], drone: 'attack' as const, superType: 'turbo' as const };

    it('Start is the only way off the card; a tap on the card background does nothing', () => {
      const root = installFakeDocument();
      let starts = 0;
      const screen = createIntroScreen(asParent(root), () => void starts++);
      screen.showCard(introCard(2, def, 'normal'));
      root.children[0]?.tap();
      expect(starts).toBe(0);
      const start = byIntro(root, 'start');
      expect(start?.textContent).toBe(START_LABEL);
      start?.tap();
      expect(starts).toBe(1);
    });

    it('blocks top to bottom: title, goal, chips and Start, star targets, new enemies, loadout, seed last', () => {
      const root = installFakeDocument();
      const screen = createIntroScreen(asParent(root), () => undefined);
      screen.showCard(introCard(1, def, 'normal', { newFoes: ['grunt', 'dart'], seed: '77' }));
      const card = root.children[0]?.children[0];
      const order = (card?.children ?? []).map((e) => e.getAttribute('data-intro') ?? (e.all().some((x) => x.getAttribute('data-intro') === 'start') ? 'play' : ''));
      expect(order).toEqual(['title', 'goal', 'play', 'stars', 'enemies', 'loadout', 'seed']);
      const text = (k: string): string => (byIntro(root, k)?.all() ?? [])
        .filter((e) => e.children.length === 0 && e.textContent !== '')
        .map((e) => e.textContent)
        .join('|');
      expect(text('goal')).toContain(GOAL_LABEL);
      expect(text('goal')).toContain('Destroy 5 enemies before your lives run out');
      expect(text('goal')).toContain(`${VICTORY_LABEL}: `);
      expect(text('stars')).toContain(STARS_LABEL);
      expect(text('stars')).toContain('1 star|10|2 stars|20|3 stars|40');
      expect(text('stars')).toContain('Normal: max 2 stars');
      expect(text('enemies')).toContain(ENEMIES_LABEL);
      expect(text('enemies')).toContain('Grunt|chaser');
      expect(text('enemies')).toContain('Dart|swarm');
      expect(byIntro(root, 'enemies')?.all().filter((e) => e.tag === 'canvas').map((e) => e.getAttribute('data-foe'))).toEqual(['grunt', 'dart']);
      expect(text('loadout')).toContain(`${LOADOUT_LABEL}|Drone: |Attack|Super: |Turbo (${turboText()})`);
      expect(byIntro(root, 'seed')?.textContent).toBe(`${SEED_LABEL}: 77`);
      for (const k of ['goal', 'stars', 'enemies', 'loadout', 'seed']) expect(byIntro(root, k)?.style.display, k).toBe('');
    });

    it('hides empty blocks: no new enemies, no stars in Endless, no seed', () => {
      const root = installFakeDocument();
      const screen = createIntroScreen(asParent(root), () => undefined);
      screen.showCard(endlessIntroCard({}, 'normal'));
      for (const k of ['stars', 'enemies', 'loadout', 'seed']) expect(byIntro(root, k)?.style.display, k).toBe('none');
      expect(byIntro(root, 'goal')?.style.display).toBe('');
    });

    it('the Ready text hides the chips, goal, stars and Start', () => {
      const root = installFakeDocument();
      const screen = createIntroScreen(asParent(root), () => undefined);
      screen.showCard(introCard(1, def, 'normal', { newFoes: ['grunt'], seed: '1' }));
      screen.showReady();
      for (const k of ['difficulty', 'goal', 'stars', 'enemies', 'loadout', 'seed', 'start']) expect(byIntro(root, k)?.style.display, k).toBe('none');
    });

    it('the card is padded 20 px with at least 16 px between blocks', () => {
      expect(UI_CSS).toContain('.sow-card.sow-intro, .sow-card.sow-results { padding: 20px; gap: 16px; }');
    });
  });
});

// V3-A: the boss name on the card (docs/13 section 9); R3 puts it in the goal sentence.
describe('V3-A intro card boss name', () => {
  const def = {
    objective: { kind: 'survive', durationSec: 90 } as const,
    par: 4000,
    stars: [4000, 8000, 16000] as [number, number, number],
    drone: 'attack' as const,
    superType: 'homing' as const,
  };

  it('every boss id is named in the goal from BOSS_NAMES', () => {
    for (const id of BOSS_IDS) expect(introCard(5, { ...def, boss: { id, tier: 1, atSec: 20, hpMul: 1 } }).goal).toBe(`Clear the waves, then defeat ${BOSS_NAMES[id]}`);
    const lines = BOSS_IDS.map((id) => bossIntroLine({ id, tier: 1, atSec: 20, hpMul: 1 }));
    expect(lines).toEqual(BOSS_IDS.map((id) => `Boss: ${BOSS_NAMES[id]}`));
    expect(new Set(lines).size).toBe(10);
    expect(bossIntroLine(undefined)).toBe('');
  });

  it('follows an edit of BOSS_NAMES, the const Ryan edits: no name is written in intro.ts', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/ui/intro.ts', import.meta.url)), 'utf8');
    for (const name of Object.values(BOSS_NAMES)) expect(src).not.toContain(name);
    expect(src).toContain('bossName');
  });

  it('a boss changes only the goal and victory lines', () => {
    const plain = introCard(7, def);
    const withBoss = introCard(7, { ...def, boss: { id: 'brood', tier: 1, atSec: 20, hpMul: 1 } });
    expect({ ...withBoss, goal: plain.goal, victory: plain.victory }).toEqual(plain);
  });
});
