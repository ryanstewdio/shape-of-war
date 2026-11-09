// Scene player machine and DOM edge: 'ui:story' events in order (start, each panel, end or skip),
// typewriter at about 40 cps with tap to complete then tap to advance, the picker panel, Skip ends
// the whole scene in one tap, seen marked on each end, the call sign kept on a skipped opening.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENES } from '../../src/story/scenes';
import { currentPanel, panelChars, pickedRun, runOver, skipRun, startRun, tapRun, tickRun, TYPE_CPS, type StoryEvent, type StoryRun } from '../../src/ui/story/run';
import { createStoryPlayer, SKIP_LABEL, DONE_LABEL, REROLL_LABEL } from '../../src/ui/story/player';
import { asParent, buttonsLabelled, installFakeDocument, type FakeEl } from './fakeDom';

const CS = 'NovaFox';

/** Tap through a whole run: complete each panel, then advance; picker panels press Done. */
function playThrough(ids: string[]): StoryEvent[] {
  let s = startRun(ids);
  const events = [...s.events];
  let run: StoryRun = s.run;
  for (let guard = 0; guard < 200 && !runOver(run); guard++) {
    run = tickRun(run, 100, CS);
    s = run.picking ? pickedRun(run) : tapRun(run, CS);
    events.push(...s.events);
    run = s.run;
  }
  return events;
}

describe('story run machine', () => {
  it('emits start, then panel for each panel, then end, per scene in order', () => {
    const ev = playThrough(['foe:wanderer', 'boss:brood']);
    const fmt = ev.map((e) => `${e.id}/${e.type}/${e.phase}/${e.panel}`);
    expect(fmt).toEqual([
      'foe:wanderer/briefing/start/0',
      'foe:wanderer/briefing/panel/0',
      'foe:wanderer/briefing/panel/1',
      'foe:wanderer/briefing/end/1',
      'boss:brood/guardian/start/0',
      'boss:brood/guardian/panel/0',
      'boss:brood/guardian/panel/1',
      'boss:brood/guardian/panel/2',
      'boss:brood/guardian/panel/3',
      'boss:brood/guardian/end/3',
    ]);
  });

  it('types at about 40 characters per second; a tap completes, the next tap advances', () => {
    const { run } = startRun(['foe:grunt']);
    const p = currentPanel(run);
    if (p === undefined) throw new Error('no panel');
    const full = panelChars(p, CS);
    expect(TYPE_CPS).toBe(40);
    const half = tickRun(run, 0.5, CS);
    expect(half.typed).toBeCloseTo(20, 5);
    const done = tapRun(half, CS);
    expect(done.events).toEqual([]);
    expect(done.run.typed).toBe(full);
    expect(done.run.panel).toBe(0);
    const next = tapRun(done.run, CS);
    expect(next.run.panel).toBe(1);
    expect(next.events).toEqual([{ id: 'foe:grunt', type: 'briefing', panel: 1, phase: 'panel' }]);
  });

  it('opens the picker after the opening P2 text; only Done moves on', () => {
    let { run } = startRun(['opening']);
    run = tapRun(tapRun(run, CS).run, CS).run; // P1 complete, then advance to P2
    expect(run.panel).toBe(1);
    run = tickRun(run, 10, CS);
    expect(run.picking).toBe(true);
    expect(tapRun(run, CS).run).toBe(run);
    const step = pickedRun(run);
    expect(step.run.panel).toBe(2);
    expect(step.run.picking).toBe(false);
  });

  it('Skip ends the whole scene in one tap, from any panel, and opens the next scene', () => {
    let { run } = startRun(['boss:warden', 'freed:warden']);
    run = tapRun(tapRun(run, CS).run, CS).run;
    const s = skipRun(run);
    expect(s.events.map((e) => `${e.id}/${e.phase}/${e.panel}`)).toEqual(['boss:warden/end/1', 'freed:warden/start/0', 'freed:warden/panel/0']);
    const last = skipRun(s.run);
    expect(last.events.map((e) => `${e.id}/${e.phase}`)).toEqual(['freed:warden/end']);
    expect(runOver(last.run)).toBe(true);
  });

  it('skips unknown ids and ends at once on an empty list', () => {
    expect(startRun(['nope', 'foe:dart']).events[0]?.id).toBe('foe:dart');
    expect(runOver(startRun([]).run)).toBe(true);
  });

  it('a Torus line with the call sign types the filled length', () => {
    const p = SCENES['boss:brood']?.panels[3];
    if (p === undefined) throw new Error('no panel');
    expect(panelChars(p, 'Ace')).toBe('It is not cruel, Ace. It is lost.'.length);
  });
});

describe('story player DOM', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(stored: string | null = null) {
    const root = installFakeDocument();
    const events: StoryEvent[] = [];
    const seen: string[] = [];
    const saved: string[] = [];
    let callsign = stored;
    const player = createStoryPlayer(asParent(root), {
      emit: (e) => events.push(e),
      seen: (id) => seen.push(id),
      loadCallsign: () => callsign,
      saveCallsign: (n) => {
        callsign = n;
        saved.push(n);
      },
      seed: () => 12345,
      raf: () => undefined,
    });
    const overlay = root.children[0] as FakeEl;
    return { root, overlay, player, events, seen, saved };
  }

  it('plays, skips with one tap, marks seen, emits in order and calls onDone', () => {
    const { root, overlay, player, events, seen } = setup('Ace');
    const done = vi.fn();
    expect(player.play(['foe:grunt'], done)).toBe(true);
    expect(player.active()).toBe(true);
    expect(overlay.classList.contains('sow-open')).toBe(true);
    const skip = buttonsLabelled(root, SKIP_LABEL)[0];
    skip?.tap();
    expect(events.map((e) => e.phase)).toEqual(['start', 'panel', 'end']);
    expect(seen).toEqual(['foe:grunt']);
    expect(done).toHaveBeenCalledTimes(1);
    expect(player.active()).toBe(false);
    expect(overlay.classList.contains('sow-open')).toBe(false);
  });

  it('returns false for an empty list and calls nothing', () => {
    const { player, events } = setup();
    const done = vi.fn();
    expect(player.play([], done)).toBe(false);
    expect(done).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('taps on the overlay complete the line, then advance', () => {
    const { overlay, player, events } = setup('Ace');
    player.play(['foe:wanderer'], () => undefined);
    overlay.tap();
    expect(events.length).toBe(2);
    overlay.tap();
    expect(events.at(-1)).toEqual({ id: 'foe:wanderer', type: 'briefing', panel: 1, phase: 'panel' });
  });

  it('a skipped opening keeps the suggested call sign', () => {
    const { root, player, saved, seen } = setup(null);
    player.play(['opening'], () => undefined);
    buttonsLabelled(root, SKIP_LABEL)[0]?.tap();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatch(/^[A-Za-z0-9]{3,10}$/);
    expect(seen).toEqual(['opening']);
  });

  it('the picker saves a typed call sign on Done, and reroll changes the suggestion', () => {
    const { root, overlay, player, saved, events } = setup(null);
    player.play(['opening'], () => undefined);
    overlay.tap(); // complete P1
    overlay.tap(); // to P2
    overlay.tap(); // complete P2: the picker opens
    const name = root.all().find((e) => e.classList.contains('sow-story-name'));
    const before = name?.textContent;
    buttonsLabelled(root, REROLL_LABEL)[0]?.tap();
    expect(name?.textContent).not.toBe(before);
    const input = root.all().find((e) => e.tag === 'input');
    if (input === undefined) throw new Error('no input');
    input.value = 'R2';
    buttonsLabelled(root, DONE_LABEL)[0]?.tap();
    expect(saved).toEqual([]); // too short: keep typing
    input.value = 'R2D2';
    buttonsLabelled(root, DONE_LABEL)[0]?.tap();
    expect(saved).toEqual(['R2D2']);
    expect(events.at(-1)).toEqual({ id: 'opening', type: 'opening', panel: 2, phase: 'panel' });
  });
});
