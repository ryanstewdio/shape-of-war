// Title and menu theme (music v3.6): the pure score, the screen lifecycle, and the player on the
// real music entry points with a fake audio graph: start on title, settings keeps it, a 0.6 s
// fade on play, resume on menu, never two at once, silence at volume 0.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contourSignature, phrasePitches, sectionStarts } from '../../../src/audio/music/compose';
import { STEPS_PER_BAR } from '../../../src/audio/music/harmony';
import { initMusic, menuThemeState, setMusicVolume, startMusic, type MusicGraph, type VisibilitySource } from '../../../src/audio/music/index';
import {
  MENU_BPM,
  MENU_FADE_OUT_SEC,
  MENU_HOOK_BARS,
  MENU_LOOP_BARS,
  MENU_STEP_SEC,
  menuBarNotes,
  menuLeadFits,
  menuNotesAt,
  menuScoreBar,
  menuWanted,
  type MenuScreen,
} from '../../../src/audio/music/menuTheme';
import { TICK_MS } from '../../../src/audio/music/scheduler';
import { BATTLE_TUNES, TUNES } from '../../../src/audio/music/tunes';
import { Bus } from '../../../src/core/events';
import { FakeContext, FakeNode, FakeTimer } from './fakeAudio';

describe('menu theme score (pure)', () => {
  it('runs at about 100 BPM: an 8 bar hook once, then an 8 bar calmer loop that repeats', () => {
    expect(MENU_BPM).toBe(100);
    expect(MENU_STEP_SEC).toBeCloseTo(0.15, 12);
    expect(MENU_HOOK_BARS).toBe(8);
    expect(Array.from({ length: 30 }, (_, b) => menuScoreBar(b))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 8, 9, 10, 11, 12, 13, 14, 15, 8, 9, 10, 11, 12, 13,
    ]);
    expect(menuNotesAt(16 * STEPS_PER_BAR)).toEqual(menuNotesAt(8 * STEPS_PER_BAR));
  });

  it('the hook has a pulse lead, bass and soft drums; the calm loop a bell lead, wind and no drums', () => {
    for (let sb = 0; sb < MENU_HOOK_BARS + MENU_LOOP_BARS; sb++) {
      const notes = menuBarNotes(sb);
      const lead = notes.filter((n) => n.layer === 'arp');
      const pads = notes.filter((n) => n.layer === 'pad');
      expect(pads).toHaveLength(3);
      expect(lead.length, `bar ${sb}`).toBeGreaterThanOrEqual(1);
      if (sb < MENU_HOOK_BARS) {
        expect(lead.every((n) => (n.fx?.duty ?? 0) === 0.25)).toBe(true);
        expect(notes.some((n) => n.layer === 'kick')).toBe(true);
      } else {
        expect(lead.every((n) => n.fx?.bell === true && n.fx.echo === 2)).toBe(true);
        expect(notes.some((n) => n.layer === 'kick' || n.layer === 'hat')).toBe(false);
        expect(pads.some((n) => n.fx?.wind === true)).toBe(true);
      }
    }
  });

  it('the lead is in E lydian, on chord tones on every beat, monophonic and in a soft range', () => {
    expect(menuLeadFits()).toBe(true);
    for (let sb = 0; sb < MENU_HOOK_BARS + MENU_LOOP_BARS; sb++) {
      const lead = menuBarNotes(sb).filter((n) => n.layer === 'arp');
      for (let i = 0; i < lead.length; i++) {
        const n = lead[i];
        if (n === undefined) continue;
        expect(n.midi).toBeGreaterThanOrEqual(64);
        expect(n.midi).toBeLessThanOrEqual(84);
        expect(n.step + n.durSteps).toBeLessThanOrEqual(STEPS_PER_BAR);
        const next = lead[i + 1];
        if (next) expect(n.step + n.durSteps).toBeLessThanOrEqual(next.step);
      }
    }
  });

  it('the hook shares no phrase contour with any level tune or battle track', () => {
    const hook: number[] = [];
    for (let sb = 0; sb < 4; sb++) for (const n of menuBarNotes(sb)) if (n.layer === 'arp') hook.push(n.midi);
    const sig = contourSignature(hook);
    for (const t of [...TUNES, ...BATTLE_TUNES]) {
      const f = t.form;
      if (!f) continue;
      const starts = sectionStarts(f);
      for (const sec of ['A', 'B', 'C', 'S'] as const) {
        const ph = f.phrases[sec];
        const bar = starts[sec];
        if (ph === undefined || bar === undefined) continue;
        expect(contourSignature(phrasePitches(ph, bar * STEPS_PER_BAR, t)), `${t.id} ${sec}`).not.toBe(sig);
      }
    }
  });

  it('the score is JSON serialisable data', () => {
    const all = Array.from({ length: 16 }, (_, b) => menuBarNotes(b));
    expect(JSON.parse(JSON.stringify(all))).toEqual(all);
  });
});

describe('menu theme lifecycle (pure)', () => {
  it('title and menu want it, settings keeps what was, play and results drop it', () => {
    const seq: MenuScreen[] = ['title', 'menu', 'settings', 'menu', 'play', 'settings', 'results', 'menu'];
    const out: boolean[] = [];
    let w = false;
    for (const s of seq) {
      w = menuWanted(w, s);
      out.push(w);
    }
    expect(out).toEqual([true, true, true, true, false, false, false, true]);
    expect(menuWanted(false, 'settings')).toBe(false);
  });
});

class FakeDoc implements VisibilitySource {
  hidden = false;
  private fns = new Set<() => void>();
  addEventListener(_t: 'visibilitychange', fn: () => void): void {
    this.fns.add(fn);
  }
  removeEventListener(_t: 'visibilitychange', fn: () => void): void {
    this.fns.delete(fn);
  }
  set(hidden: boolean): void {
    this.hidden = hidden;
    for (const fn of this.fns) fn();
  }
}

describe('menu theme player on the screen events', () => {
  let ctx: FakeContext;
  let timer: FakeTimer;
  let bus: Bus;
  let doc: FakeDoc;
  let graph: MusicGraph | null;
  let uninstall: () => void;

  function advance(sec: number): void {
    const n = Math.round(sec / (TICK_MS / 1000));
    for (let i = 0; i < n; i++) {
      ctx.currentTime += TICK_MS / 1000;
      timer.fire();
    }
  }

  const screen = (s: MenuScreen): void => bus.emit('ui:screen', { screen: s });

  beforeEach(() => {
    ctx = new FakeContext();
    timer = new FakeTimer();
    bus = new Bus();
    doc = new FakeDoc();
    graph = { ctx, master: new FakeNode() };
    uninstall = initMusic({ tune: 'neon', bus, graph: () => graph, timer, visibility: doc, volume: 50 });
  });

  afterEach(() => {
    uninstall();
    setMusicVolume(50);
  });

  it('starts on title, keeps playing through settings, fades over 0.6 s on play and resumes on menu', () => {
    screen('title');
    expect(menuThemeState()).toMatchObject({ state: 'playing', engines: 1, starts: 1 });
    const before = ctx.oscs.length;
    advance(1);
    expect(ctx.oscs.length).toBeGreaterThan(before);

    screen('settings');
    advance(0.5);
    expect(menuThemeState()).toMatchObject({ state: 'playing', starts: 1 });

    const t0 = ctx.currentTime;
    screen('play');
    expect(menuThemeState().state).toBe('fading');
    // The engine's master ramps linearly to 0 over the fade.
    const ramp = ctx.gains.some((g) => g.gain.calls.some((c) => c.fn === 'lin' && c.v === 0 && Math.abs(c.t - (t0 + MENU_FADE_OUT_SEC)) < 1e-9));
    expect(ramp).toBe(true);
    // Nothing new is scheduled during the fade.
    const during = ctx.oscs.length;
    advance(MENU_FADE_OUT_SEC + 0.2);
    expect(ctx.oscs.length).toBe(during);
    expect(menuThemeState()).toMatchObject({ state: 'off', engines: 0 });

    screen('results');
    expect(menuThemeState().state).toBe('off');
    screen('menu');
    expect(menuThemeState()).toMatchObject({ state: 'playing', engines: 1, starts: 2 });
  });

  it('never double starts: repeated title and menu events and a return mid fade keep one instance', () => {
    screen('title');
    screen('menu');
    screen('title');
    advance(0.3);
    screen('menu');
    expect(menuThemeState()).toMatchObject({ engines: 1, starts: 1 });
    screen('play');
    advance(0.2);
    screen('menu');
    // The fading one is dropped at once; only the new one lives.
    expect(menuThemeState()).toMatchObject({ state: 'playing', engines: 1, starts: 2 });
  });

  it('game:start and a level start fade it out too', () => {
    screen('menu');
    bus.emit('game:start', { mode: 'adventure', levelIndex: 0 });
    expect(menuThemeState().state).toBe('fading');
    screen('menu');
    expect(menuThemeState().state).toBe('playing');
    expect(startMusic(1)).toBe(true);
    expect(menuThemeState()).toMatchObject({ state: 'fading', wanted: false });
  });

  it('settings reached from play does not start it', () => {
    screen('play');
    screen('settings');
    expect(menuThemeState()).toMatchObject({ state: 'off', starts: 0 });
  });

  it('at volume 0 nothing plays; raising the volume on the menu starts it', () => {
    setMusicVolume(0);
    screen('title');
    advance(2);
    expect(menuThemeState()).toMatchObject({ state: 'off', starts: 0 });
    expect(ctx.oscs).toHaveLength(0);
    expect(ctx.compressors).toHaveLength(0);
    setMusicVolume(40);
    expect(menuThemeState()).toMatchObject({ state: 'playing', starts: 1 });
    setMusicVolume(0);
    expect(menuThemeState()).toMatchObject({ state: 'off', engines: 0 });
  });

  it('waits for the audio unlock on title, then starts once', () => {
    graph = null;
    screen('title');
    expect(menuThemeState()).toMatchObject({ state: 'off', wanted: true });
    advance(0.5);
    graph = { ctx, master: new FakeNode() };
    advance(0.5);
    expect(menuThemeState()).toMatchObject({ state: 'playing', starts: 1 });
  });

  it('a hidden tab stops it; showing the tab again restarts it', () => {
    screen('menu');
    doc.set(true);
    expect(menuThemeState().state).toBe('off');
    doc.set(false);
    expect(menuThemeState()).toMatchObject({ state: 'playing', starts: 2 });
  });

  it('uninstall stops it and leaves no timers', () => {
    screen('title');
    uninstall();
    expect(menuThemeState()).toMatchObject({ state: 'off', engines: 0 });
    expect(timer.live).toBe(0);
  });
});
