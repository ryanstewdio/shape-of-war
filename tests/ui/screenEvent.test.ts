import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bootFlow, reduceFlow, type FlowAction, type FlowState, type LevelResult } from '../../src/ui/flow';
import { createScreenAnnouncer, uiScreenOf, type UiScreen } from '../../src/ui/screenEvent';

const result: LevelResult = { mode: 'adventure', levelIndex: 1, score: 1, stars: 1, success: true, par: 1, best: 1, newBest: true, hash: 'abcd1234' };

/** Drive the reducer the way main.ts dispatch does and collect what would be emitted. */
function sequence(actions: FlowAction[]): UiScreen[] {
  const out: UiScreen[] = [];
  const announce = createScreenAnnouncer((s) => out.push(s));
  let flow: FlowState = bootFlow(1);
  announce(flow); // boot
  for (const a of actions) {
    const next = reduceFlow(flow, a);
    if (next === flow) continue;
    flow = next;
    announce(flow);
  }
  return out;
}

describe('ui:screen sequence', () => {
  it('boot is title', () => {
    expect(sequence([])).toEqual(['title']);
  });

  it('boot, menu, start, pause, resume, results, retry, results, back to menu', () => {
    expect(
      sequence([
        { type: 'tapStart' },
        { type: 'start', mode: 'adventure', levelIndex: 1 },
        { type: 'pause' },
        { type: 'resume' },
        { type: 'over', result },
        { type: 'retry' },
        { type: 'over', result },
        { type: 'menu' },
      ]),
    ).toEqual(['title', 'menu', 'play', 'results', 'play', 'results', 'menu']);
  });

  it('level select stays menu and emits nothing extra', () => {
    expect(sequence([{ type: 'tapStart' }, { type: 'openLevels' }, { type: 'closeLevels' }])).toEqual(['title', 'menu']);
  });

  it('settings from the menu and from pause announce settings, and play after returning', () => {
    expect(
      sequence([
        { type: 'tapStart' },
        { type: 'openSettings' },
        { type: 'closeSettings' },
        { type: 'start', mode: 'endless', levelIndex: 1 },
        { type: 'pause' },
        { type: 'openSettings' },
        { type: 'closeSettings' },
        { type: 'resume' },
      ]),
    ).toEqual(['title', 'menu', 'settings', 'menu', 'play', 'settings', 'play']);
  });

  it('quit from pause goes to menu', () => {
    expect(sequence([{ type: 'tapStart' }, { type: 'start', mode: 'adventure', levelIndex: 1 }, { type: 'pause' }, { type: 'quit' }])).toEqual(['title', 'menu', 'play', 'menu']);
  });

  it('maps every flow screen', () => {
    const base = bootFlow(1);
    expect(uiScreenOf({ ...base, screen: 'levels' })).toBe('menu');
    expect(uiScreenOf({ ...base, screen: 'paused' })).toBe('play');
  });

  it('main.ts emits ui:screen at boot and after every dispatch', () => {
    const code = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
    expect(code).toMatch(/createScreenAnnouncer\(\(screen\) => bus\.emit\('ui:screen', \{ screen \}\)\)/);
    expect(code.match(/announceScreen\(flow\)/g)?.length).toBe(2);
  });
});
