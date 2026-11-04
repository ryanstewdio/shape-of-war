// R5 (Ryan, build 64a20eb): "when I toggled wells off I could not reactivate them: toggled on again
// and played, no wells appeared." This drives the same path main.ts does: open the setup screen,
// Wells Off, Start (saved under sow.settings.freePlay), reload the saved setup into a fresh screen,
// Wells Normal, Start, and build the run. The choice, the saved JSON and the def all carry Normal,
// so the UI and settings side round trips correctly.
//
// Finding for Foundry (level side, not changed here): freePlayLevel places wells only for 'many';
// 'normal' and 'off' both give hazards.wells = [] (Endless segments carry no wells), and the game
// skips well arrivals in endless mode, so Normal plays exactly like Off. The todo below names it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FREE_PLAY_KEY, loadFreePlaySetup, saveFreePlaySetup, type StorageLike } from '../../src/core/settings';
import { createFreePlayScreen, DEFAULT_FREE_PLAY, WELLS_ROW_LABEL, type FreePlayChoice } from '../../src/ui/freePlay';
import { buildFreePlayRun, freePlayLevelOptions } from '../../src/ui/freePlayRun';
import { asParent, buttonsLabelled, groupButtons, installFakeDocument } from './fakeDom';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

afterEach(() => vi.unstubAllGlobals());

/** One visit to the setup screen as main.ts runs it: load, open, tap Wells `wells`, Start, save. */
function visit(storage: StorageLike, wells: 'Off' | 'Normal' | 'Many'): FreePlayChoice {
  const root = installFakeDocument();
  let started: FreePlayChoice | null = null;
  const screen = createFreePlayScreen(asParent(root), {
    start: (c) => {
      started = c;
      saveFreePlaySetup({ arena: c.arena, barriers: c.barriers, config: c.config }, storage);
    },
    back: () => undefined,
  });
  const last: FreePlayChoice = { ...DEFAULT_FREE_PLAY, ...loadFreePlaySetup(storage) };
  screen.open({ ...last, difficulty: 'normal' });
  const btn = groupButtons(root, WELLS_ROW_LABEL).find((b) => b.textContent === wells);
  expect(btn, wells).toBeDefined();
  btn?.tap();
  expect(btn?.getAttribute('aria-pressed')).toBe('true');
  buttonsLabelled(root, 'Start')[0]?.tap();
  if (started === null) throw new Error('Start did not fire');
  return started;
}

describe('R5 Free Play wells: off, save, reload, on', () => {
  it('toggling wells off, saving, reloading and toggling Normal builds a run whose config has wells normal', () => {
    const storage = memory();
    const off = visit(storage, 'Off');
    expect(off.config.wells).toBe('off');
    expect(JSON.parse(storage.data.get(FREE_PLAY_KEY) ?? '{}').config.wells).toBe('off');
    expect(loadFreePlaySetup(storage).config.wells).toBe('off');

    const on = visit(storage, 'Normal');
    expect(on.config.wells).toBe('normal');
    expect(JSON.parse(storage.data.get(FREE_PLAY_KEY) ?? '{}').config.wells).toBe('normal');
    expect(loadFreePlaySetup(storage).config.wells).toBe('normal');

    expect(freePlayLevelOptions(on, 7).config.wells).toBe('normal');
    const run = buildFreePlayRun(on, 7);
    expect(run.def.freePlay?.options?.wells).toBe('normal');
  });

  it('the reloaded screen marks the saved wells choice', () => {
    const storage = memory();
    visit(storage, 'Many');
    const root = installFakeDocument();
    const screen = createFreePlayScreen(asParent(root), { start: () => undefined, back: () => undefined });
    screen.open({ ...DEFAULT_FREE_PLAY, ...loadFreePlaySetup(storage) });
    const marked = groupButtons(root, WELLS_ROW_LABEL).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
    expect(marked).toEqual(['Many']);
  });

  it.todo('level side (Foundry): wells Normal places or schedules wells in a Free Play run, unlike Off');
});
