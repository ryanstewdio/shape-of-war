// Free Play options (docs/14): the setup screen. Every control writes the right field, the drum
// drift row shows only for the drum, Start passes the whole config to freePlayLevel and to the
// world options, a timed run's results read "Score attack 5:00" and infinite lives show an
// infinity sign in the HUD.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { DEFAULT_FREE_PLAY as DEFAULT_CONFIG, type FreePlayConfig } from '../../src/core/freeplayConfig';
import { FREE_PLAY_ENEMY_KINDS } from '../../src/core/settings';
import * as levelgenFreePlay from '../../src/levelgen/freeplay';
import {
  BOSSES_ROW_LABEL,
  createFreePlayScreen,
  DEFAULT_FREE_PLAY,
  DENSITY_ROW_LABEL,
  DRIFT_ROW_LABEL,
  DRONE_ROW_LABEL,
  ENEMIES_ROW_LABEL,
  FREE_PLAY_BOSSES,
  FREE_PLAY_DENSITIES,
  FREE_PLAY_DRIFTS,
  FREE_PLAY_DRONES,
  FREE_PLAY_LENGTHS,
  FREE_PLAY_LIVES,
  FREE_PLAY_SIZES,
  FREE_PLAY_SUPERS,
  FREE_PLAY_WEAPONS,
  FREE_PLAY_WELLS,
  freePlaySummary,
  LENGTH_ROW_LABEL,
  LIVES_ROW_LABEL,
  PICKUPS_ROW_LABEL,
  SIZE_ROW_LABEL,
  SUPER_ROW_LABEL,
  toggleEnemy,
  WEAPON_ROW_LABEL,
  WELLS_ROW_LABEL,
  type FreePlayChoice,
} from '../../src/ui/freePlay';
import { buildFreePlayRun, freePlayGameOptions, freePlayLevelOptions, freePlayLine, freePlayResult } from '../../src/ui/freePlayRun';
import { createHud, hudText, INFINITE_LIVES_TEXT } from '../../src/ui/hud';
import { resultLines } from '../../src/ui/results';
import { asParent, buttonsLabelled, groupButtons, installFakeDocument, type FakeEl } from './fakeDom';

vi.mock('../../src/levelgen/freeplay', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/levelgen/freeplay')>();
  return { ...real, freePlayLevel: vi.fn(real.freePlayLevel) };
});

afterEach(() => {
  vi.unstubAllGlobals();
  bus.clear();
});

function open(choice: FreePlayChoice = DEFAULT_FREE_PLAY): { root: FakeEl; started: FreePlayChoice[]; current: () => FreePlayChoice } {
  const root = installFakeDocument();
  const started: FreePlayChoice[] = [];
  const screen = createFreePlayScreen(asParent(root), { start: (c) => started.push(c), back: () => undefined });
  screen.open(choice);
  return { root, started, current: () => screen.current() };
}

function group(root: FakeEl, label: string): FakeEl {
  const g = root.all().find((e) => e.getAttribute('role') === 'group' && e.getAttribute('aria-label') === label);
  if (g === undefined) throw new Error(`no group ${label}`);
  return g;
}

/** One single choice row: tapping button i writes values[i] into config[field], and only it is marked. */
function checkRow<K extends keyof FreePlayConfig>(label: string, field: K, values: readonly FreePlayConfig[K][]): number {
  const { root, current } = open({ ...DEFAULT_FREE_PLAY, arena: 'drum' });
  const btns = groupButtons(root, label);
  expect(btns.length, label).toBe(values.length);
  values.forEach((v, i) => {
    btns[i]?.tap();
    expect(current().config[field], `${label} ${String(v)}`).toEqual(v);
    expect(btns.map((b) => b.getAttribute('aria-pressed')), label).toEqual(values.map((_, j) => String(j === i)));
    const others: Partial<FreePlayConfig> = { ...current().config };
    delete others[field];
    const defaults: Partial<FreePlayConfig> = { ...DEFAULT_CONFIG };
    delete defaults[field];
    expect(others, `${label} touches only ${String(field)}`).toEqual(defaults);
  });
  return btns.length;
}

describe('Free Play setup screen controls', () => {
  it('has the six sections in order, the scroll body and Start below it', () => {
    const { root } = open();
    const heads = root.all().filter((e) => e.classList.contains('sow-fp-head')).map((e) => e.textContent);
    expect(heads).toEqual(['Difficulty', 'Arena', 'Enemies', 'Rules', 'Loadout', 'Hazards']);
    const card = root.all().find((e) => e.classList.contains('sow-fp-card'));
    const kids = card?.children ?? [];
    expect(kids[1]?.classList.contains('sow-fp-body')).toBe(true);
    expect(kids[2]?.classList.contains('sow-fp-foot')).toBe(true);
    expect(kids[2]?.children.map((b) => b.textContent)).toEqual(['Start', 'Back']);
  });

  it('polish r9: Back is in the pixel font like Start', () => {
    const { root } = open();
    for (const label of ['Start', 'Back']) {
      const b = root.all().find((e) => e.tag === 'button' && e.getAttribute('data-vec-label') === label || (e.tag === 'button' && e.textContent === label));
      expect(b?.classList.contains('sow-vec-host'), label).toBe(true);
      expect(b?.all().some((e) => e.tag === 'svg'), label).toBe(true);
    }
  });

  it('every single choice row writes its own field and nothing else', () => {
    expect(checkRow(SIZE_ROW_LABEL, 'size', FREE_PLAY_SIZES)).toBe(3);
    expect(checkRow(DENSITY_ROW_LABEL, 'density', FREE_PLAY_DENSITIES)).toBe(3);
    expect(checkRow(LIVES_ROW_LABEL, 'lives', FREE_PLAY_LIVES)).toBe(4);
    expect(checkRow(LENGTH_ROW_LABEL, 'length', FREE_PLAY_LENGTHS)).toBe(4);
    expect(checkRow(WEAPON_ROW_LABEL, 'weapon', FREE_PLAY_WEAPONS)).toBe(5);
    expect(checkRow(PICKUPS_ROW_LABEL, 'pickups', [true, false])).toBe(2);
    expect(checkRow(DRONE_ROW_LABEL, 'drone', FREE_PLAY_DRONES)).toBe(3);
    expect(checkRow(SUPER_ROW_LABEL, 'superType', FREE_PLAY_SUPERS)).toBe(3);
    expect(checkRow(BOSSES_ROW_LABEL, 'bosses', FREE_PLAY_BOSSES)).toBe(12);
    expect(checkRow(WELLS_ROW_LABEL, 'wells', FREE_PLAY_WELLS)).toBe(3);
    expect(checkRow(DRIFT_ROW_LABEL, 'drift', FREE_PLAY_DRIFTS)).toBe(3);
  });

  it('row labels read as the docs/14 options', () => {
    const { root } = open();
    const text = (label: string): string[] => groupButtons(root, label).map((b) => b.textContent);
    expect(text(SIZE_ROW_LABEL)).toEqual(['Small', 'Medium', 'Large']);
    expect(text(DENSITY_ROW_LABEL)).toEqual(['Low', 'Normal', 'Swarm']);
    expect(text(LIVES_ROW_LABEL)).toEqual(['1', '3', '5', '∞']);
    expect(text(LENGTH_ROW_LABEL)).toEqual(['Endless', '3 min', '5 min', '10 min']);
    expect(text(WEAPON_ROW_LABEL)).toEqual(['None', 'Spread', 'Rapid', 'Pierce', 'Orbit']);
    expect(text(DRONE_ROW_LABEL)).toEqual(['Attack', 'Collect', 'Ram']);
    expect(text(SUPER_ROW_LABEL)).toEqual(['Homing', 'Detonate', 'Turbo']);
    expect(text(BOSSES_ROW_LABEL).slice(0, 2)).toEqual(['Off', 'Every 2 min']);
    expect(text(WELLS_ROW_LABEL)).toEqual(['Off', 'Normal', 'Many']);
    expect(text(DRIFT_ROW_LABEL)).toEqual(['Off', 'Low', 'High']);
  });

  it('arena, barriers and difficulty write the choice, not the config', () => {
    const { root, current } = open();
    groupButtons(root, 'Arena')[1]?.tap();
    groupButtons(root, 'Barriers')[0]?.tap();
    groupButtons(root, 'Difficulty')[2]?.tap();
    expect(current()).toEqual({ difficulty: 'hard', arena: 'circle', barriers: true, config: DEFAULT_CONFIG });
  });

  it('the drum drift row shows only while the drum is picked', () => {
    const { root } = open();
    const drift = group(root, DRIFT_ROW_LABEL);
    expect(drift.style.display).toBe('none');
    groupButtons(root, 'Arena')[2]?.tap();
    expect(drift.style.display).toBe('');
    groupButtons(root, 'Arena')[0]?.tap();
    expect(drift.style.display).toBe('none');
  });

  it('the enemy grid: one toggle per kind with its neon icon and name, All and None', () => {
    const { root, current } = open();
    const grid = group(root, ENEMIES_ROW_LABEL);
    const toggles = grid.all().filter((e) => e.tag === 'button' && e.getAttribute('data-kind') !== null);
    expect(toggles.map((b) => b.getAttribute('data-kind'))).toEqual([...FREE_PLAY_ENEMY_KINDS]);
    for (const b of toggles) {
      expect(b.children.some((c) => c.tag === 'canvas' && c.getAttribute('data-foe') === b.getAttribute('data-kind'))).toBe(true);
      expect(b.children.some((c) => c.tag === 'span' && c.textContent === b.getAttribute('aria-label'))).toBe(true);
    }
    const note = grid.all().find((e) => e.classList.contains('sow-fp-note'));
    expect(note?.style.display).toBe(''); // none picked: the note says it plays every enemy
    toggles[0]?.tap();
    toggles[5]?.tap();
    expect(current().config.enemies).toEqual(['grunt', 'snake']);
    expect(toggles.map((b) => b.getAttribute('aria-pressed'))).toEqual(FREE_PLAY_ENEMY_KINDS.map((k) => String(k === 'grunt' || k === 'snake')));
    expect(note?.style.display).toBe('none');
    toggles[0]?.tap();
    expect(current().config.enemies).toEqual(['snake']);
    buttonsLabelled(grid, 'All')[0]?.tap();
    expect(current().config.enemies).toEqual([...FREE_PLAY_ENEMY_KINDS]);
    buttonsLabelled(grid, 'None')[0]?.tap();
    expect(current().config.enemies).toEqual([]);
    expect(note?.style.display).toBe('');
    expect({ ...current().config, enemies: DEFAULT_CONFIG.enemies }).toEqual(DEFAULT_CONFIG);
  });

  it('toggleEnemy keeps screen order and switches one kind', () => {
    expect(toggleEnemy([], 'splime')).toEqual(['splime']);
    expect(toggleEnemy(['splime'], 'grunt')).toEqual(['grunt', 'splime']);
    expect(toggleEnemy(['grunt', 'splime'], 'grunt')).toEqual(['splime']);
  });

  it('open marks a stored choice; Start hands over the whole choice', () => {
    const stored: FreePlayChoice = {
      difficulty: 'insane',
      arena: 'drum',
      barriers: true,
      config: { ...DEFAULT_CONFIG, enemies: ['dart'], lives: 'infinite', length: 300, weapon: 'orbit', bosses: 'prism', drift: 'high' },
    };
    const { root, started } = open(stored);
    expect(groupButtons(root, LIVES_ROW_LABEL).map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true']);
    expect(group(root, DRIFT_ROW_LABEL).style.display).toBe('');
    const start = buttonsLabelled(root, 'Start')[0];
    expect(start?.getAttribute('aria-label')).toBe(`Start: ${freePlaySummary(stored)}`);
    expect(freePlaySummary(stored)).toBe('Insane, Drum arena, barriers on, Score attack 5:00');
    start?.tap();
    expect(started).toEqual([stored]);
  });
});

describe('Start passes the config', () => {
  const choice: FreePlayChoice = {
    difficulty: 'normal',
    arena: 'circle',
    barriers: true,
    config: { ...DEFAULT_CONFIG, enemies: ['grunt', 'weaver'], density: 'swarm', lives: 5, length: 180, size: 'small' },
  };

  it('freePlayLevel gets { arena, barriers, seed, config }', () => {
    expect(freePlayLevelOptions(choice, 77)).toEqual({ arena: 'circle', barriers: true, seed: 77, config: choice.config });
  });

  it('the world options carry GameOptions.freePlay = config and keep the base options', () => {
    const base = { difficulty: 'hard' as const };
    expect(freePlayGameOptions(choice, base)).toEqual({ difficulty: 'hard', freePlay: choice.config });
  });

  it('buildFreePlayRun calls freePlayLevel with the config', () => {
    const spy = vi.mocked(levelgenFreePlay.freePlayLevel);
    spy.mockClear();
    const run = buildFreePlayRun(choice, 4242, { difficulty: 'normal', vibrate: () => undefined });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toEqual({ arena: 'circle', barriers: true, seed: 4242, config: choice.config });
    expect(run.world.ship.active).toBe(true);
  });
});

describe('timed results and infinite lives', () => {
  const end = { score: 12345, difficulty: 'normal' as const, hash: 'h', space: 'off' as const, timeSec: 300, arena: 'Circle' };

  it('a timed run shows "Score attack 5:00" and the score', () => {
    const t = resultLines(freePlayResult({ ...end, length: 300, won: true }));
    expect(t.sub).toBe('Free Play  Score attack 5:00  Circle arena');
    expect(t.title).toBe('Time up');
    expect(t.score).toBe('12,345');
    expect(resultLines(freePlayResult({ ...end, length: 600 })).title).toBe('Game over');
  });

  it('an Endless length reads as before', () => {
    const t = resultLines(freePlayResult({ ...end, length: 'endless' }));
    expect(t.sub).toBe('Free Play  Circle arena');
    expect(t.title).toBe('Game over');
    expect(freePlayResult({ ...end }).scoreAttackSec).toBeUndefined();
  });

  it('the HUD line counts down a score attack and up for Endless', () => {
    expect(freePlayLine('Circle', 'endless', 65)).toBe('Free Play  Circle  1:05');
    expect(freePlayLine('Circle', 180, 65)).toBe('Free Play  Circle  1:55 left');
    expect(freePlayLine('Circle', 180, 999)).toBe('Free Play  Circle  0:00 left');
  });

  it('infinite lives show an infinity sign in the HUD', () => {
    const p = { score: 0, multiplier: 1, lives: 3, bombs: 2, superCharge: 0 };
    expect(hudText(p).lives).toBe('▲▲▲');
    expect(hudText(p, true).lives).toBe(INFINITE_LIVES_TEXT);
    expect(INFINITE_LIVES_TEXT).toContain('∞');
    expect(hudText({ ...p, lives: Number.POSITIVE_INFINITY }).lives).toBe(INFINITE_LIVES_TEXT);
    const root = installFakeDocument();
    const hud = createHud(asParent(root), () => 0);
    hud.setInfiniteLives(true);
    hud.update(p);
    expect(root.all().some((e) => e.textContent === INFINITE_LIVES_TEXT)).toBe(true);
    hud.setInfiniteLives(false);
    hud.update(p);
    expect(root.all().some((e) => e.textContent === INFINITE_LIVES_TEXT)).toBe(false);
  });
});

describe('Free Play arena surface (trough option)', () => {
  it('has an Arena surface row, Flat and Trough, defaulting to Flat', async () => {
    const ui = await import('../../src/ui/freePlay');
    const { root, started, current } = open();
    expect(groupButtons(root, ui.SURFACE_ROW_LABEL).map((b) => b.textContent)).toEqual(['Flat', 'Trough']);
    expect(current().config.surface ?? 'flat').toBe('flat');
    groupButtons(root, ui.SURFACE_ROW_LABEL)[1]?.tap();
    expect(current().config.surface).toBe('trough');
    expect(started).toHaveLength(0);
  });

  it('disables the arena shape picker while Trough is on and explains why', async () => {
    const ui = await import('../../src/ui/freePlay');
    const { root } = open();
    const shapes = (): boolean[] => groupButtons(root, ui.ARENA_ROW_LABEL).map((b) => (b as unknown as { disabled?: boolean }).disabled === true);
    expect(shapes()).toEqual([false, false, false]);
    groupButtons(root, ui.SURFACE_ROW_LABEL)[1]?.tap();
    expect(shapes()).toEqual([true, true, true]);
    expect(root.all().some((e) => e.textContent === ui.SURFACE_SHAPE_HINT && e.style.display === '')).toBe(true);
    groupButtons(root, ui.SURFACE_ROW_LABEL)[0]?.tap();
    expect(shapes()).toEqual([false, false, false]);
  });

  it('saves the surface with the setup and old saves default to Flat', async () => {
    const s = await import('../../src/core/settings');
    const trough = { ...s.DEFAULT_FREE_PLAY_SETUP, config: { ...s.DEFAULT_FREE_PLAY_SETUP.config, surface: 'trough' as const } };
    expect(s.parseFreePlaySetup(s.encodeFreePlaySetup(trough)).config.surface).toBe('trough');
    expect(s.parseFreePlaySetup(JSON.stringify({ arena: 'circle', config: {} })).config.surface).toBeUndefined();
    expect(s.parseFreePlaySetup(JSON.stringify({ config: { surface: 'wavy' } })).config.surface).toBeUndefined();
    expect(s.encodeFreePlaySetup(s.DEFAULT_FREE_PLAY_SETUP)).not.toContain('surface');
  });
});
