// Title and menu themes (music v3.6, three themes since G6): the pure scores, the rotation, the
// screen lifecycle, and the player on the real music entry points with a fake audio graph: start
// on title, settings keeps it, a 0.6 s fade on play, resume on menu, never two at once, silence
// at volume 0, and a new theme at boot and after each level.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contourSignature, phrasePitches, sectionStarts } from '../../../src/audio/music/compose';
import { STEPS_PER_BAR } from '../../../src/audio/music/harmony';
import { initMusic, menuThemeState, setMusicVolume, startMusic, type MusicGraph, type VisibilitySource } from '../../../src/audio/music/index';
import {
  createMenuTheme,
  MENU_FADE_OUT_SEC,
  MENU_FORM_BARS,
  MENU_SECTION_BARS,
  MENU_THEMES,
  menuBarNotes,
  menuHookSignature,
  menuLeadFits,
  menuNotesAt,
  menuRotates,
  menuScoreBar,
  menuSection,
  menuSectionPitches,
  menuStepSec,
  menuWanted,
  nextMenuTheme,
  parseMenuTheme,
  type MenuScreen,
  type MenuThemeStore,
  memoryMenuStore,
} from '../../../src/audio/music/menuTheme';
import { TICK_MS } from '../../../src/audio/music/scheduler';
import { BATTLE_TUNES, TUNES } from '../../../src/audio/music/tunes';
import { Bus } from '../../../src/core/events';
import { FakeContext, FakeNode, FakeTimer } from './fakeAudio';

class MemStorage implements MenuThemeStore {
  value: string | null = null;
  writes = 0;
  load(): string | null {
    return this.value;
  }
  save(raw: string): void {
    this.writes++;
    this.value = raw;
  }
}

const THEMES = MENU_THEMES.map((_, i) => i);

describe('menu theme scores (pure)', () => {
  it('there are three themes, each 85 to 115 BPM', () => {
    expect(MENU_THEMES).toHaveLength(3);
    for (const t of THEMES) {
      const bpm = MENU_THEMES[t]?.bpm ?? 0;
      expect(bpm).toBeGreaterThanOrEqual(85);
      expect(bpm).toBeLessThanOrEqual(115);
      expect(menuStepSec(t)).toBeCloseTo(60 / bpm / 4, 12);
      expect(MENU_THEMES[t]?.bars).toHaveLength(MENU_FORM_BARS);
      expect(MENU_THEMES[t]?.key.bars).toHaveLength(MENU_FORM_BARS);
    }
    expect(menuStepSec(0)).toBeCloseTo(0.15, 12);
  });

  it('each theme loops A, B, C of 8 bars: the hook comes back every 24 bars, not every 8', () => {
    expect(MENU_SECTION_BARS).toBe(8);
    expect(MENU_FORM_BARS).toBe(24);
    expect(Array.from({ length: 50 }, (_, b) => menuScoreBar(b))).toEqual(Array.from({ length: 50 }, (_, b) => b % 24));
    expect(Array.from({ length: 24 }, (_, b) => menuSection(b)).join('')).toBe('AAAAAAAABBBBBBBBCCCCCCCC');
    for (const t of THEMES) {
      expect(menuNotesAt(24 * STEPS_PER_BAR, t)).toEqual(menuNotesAt(0, t));
      // Hook bar 0 is not heard again at bar 8 or 16.
      const hook = JSON.stringify(menuBarNotes(0, t).filter((n) => n.layer === 'arp'));
      expect(JSON.stringify(menuBarNotes(8, t).filter((n) => n.layer === 'arp'))).not.toBe(hook);
      expect(JSON.stringify(menuBarNotes(16, t).filter((n) => n.layer === 'arp'))).not.toBe(hook);
      // No section repeats another section's lead line.
      const a = menuSectionPitches(t, 'A').join(',');
      const b = menuSectionPitches(t, 'B').join(',');
      const c = menuSectionPitches(t, 'C').join(',');
      expect(new Set([a, b, c]).size).toBe(3);
    }
  });

  it('A has drums and a pulsing bass, B a lighter beat, C no drums, wind and the longest notes', () => {
    for (const t of THEMES) {
      const def = MENU_THEMES[t];
      for (let sb = 0; sb < MENU_FORM_BARS; sb++) {
        const notes = menuBarNotes(sb, t);
        const lead = notes.filter((n) => n.layer === 'arp');
        const pads = notes.filter((n) => n.layer === 'pad');
        const kicks = notes.filter((n) => n.layer === 'kick');
        const hats = notes.filter((n) => n.layer === 'hat');
        expect(pads).toHaveLength(3);
        expect(lead.length, `theme ${t} bar ${sb}`).toBeGreaterThanOrEqual(1);
        const sec = menuSection(sb);
        if (sec === 'A') {
          expect(kicks).toHaveLength(2);
          expect(hats).toHaveLength(2);
        } else if (sec === 'B') {
          expect(kicks).toHaveLength(1);
          expect(hats).toHaveLength(0);
        } else {
          expect(kicks.length + hats.length).toBe(0);
          expect(pads.some((n) => n.fx?.wind === true)).toBe(true);
        }
      }
      // The calm section moves slowest: fewer lead notes than A.
      expect(menuSectionPitches(t, 'C').length).toBeLessThan(menuSectionPitches(t, 'A').length);
      expect(def?.lead.A).not.toEqual(def?.lead.B);
    }
    // Aurora keeps its 25 percent pulse hook and its bell calm.
    for (let sb = 0; sb < 8; sb++) expect(menuBarNotes(sb, 0).filter((n) => n.layer === 'arp').every((n) => n.fx?.duty === 0.25)).toBe(true);
    for (let sb = 16; sb < 24; sb++) expect(menuBarNotes(sb, 0).filter((n) => n.layer === 'arp').every((n) => n.fx?.bell === true && n.fx.echo === 2)).toBe(true);
  });

  it('every lead is in its key, on chord tones on every beat, monophonic and in a soft range', () => {
    for (const t of THEMES) {
      expect(menuLeadFits(t), `theme ${t}`).toBe(true);
      for (let sb = 0; sb < MENU_FORM_BARS; sb++) {
        const lead = menuBarNotes(sb, t).filter((n) => n.layer === 'arp');
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
    }
  });

  it('variety: the three themes differ in mode, tempo, tonic, hook lead and hook signature', () => {
    const defs = MENU_THEMES;
    expect(new Set(defs.map((d) => d.mode)).size).toBe(3);
    expect(new Set(defs.map((d) => d.bpm)).size).toBe(3);
    expect(new Set(defs.map((d) => d.key.tonic)).size).toBe(3);
    expect(new Set(defs.map((d) => d.id)).size).toBe(3);
    expect(new Set(defs.map((d) => JSON.stringify(d.lead.A))).size).toBe(3);
    expect(new Set(THEMES.map((t) => menuHookSignature(t))).size).toBe(3);
    // No two themes share a hook contour or a hook rhythm.
    const contours = THEMES.map((t) => contourSignature(menuSectionPitches(t, 'A')));
    expect(new Set(contours).size).toBe(3);
    const rhythms = THEMES.map((t) => menuHookSignature(t).split('/')[1]);
    expect(new Set(rhythms).size).toBe(3);
    // The tempo spread is audible: at least 10 BPM between neighbours.
    const bpms = defs.map((d) => d.bpm).sort((a, b) => a - b);
    for (let i = 1; i < bpms.length; i++) expect((bpms[i] ?? 0) - (bpms[i - 1] ?? 0)).toBeGreaterThanOrEqual(10);
  });

  it('no hook shares a phrase contour with any level tune or battle track', () => {
    for (const th of THEMES) {
      const hook: number[] = [];
      for (let sb = 0; sb < 4; sb++) for (const n of menuBarNotes(sb, th)) if (n.layer === 'arp') hook.push(n.midi);
      const sig = contourSignature(hook);
      for (const t of [...TUNES, ...BATTLE_TUNES]) {
        const f = t.form;
        if (!f) continue;
        const starts = sectionStarts(f);
        for (const sec of ['A', 'B', 'C', 'S'] as const) {
          const ph = f.phrases[sec];
          const bar = starts[sec];
          if (ph === undefined || bar === undefined) continue;
          expect(contourSignature(phrasePitches(ph, bar * STEPS_PER_BAR, t)), `theme ${th} vs ${t.id} ${sec}`).not.toBe(sig);
        }
      }
    }
  });

  it('the scores are JSON serialisable data', () => {
    for (const t of THEMES) {
      const all = Array.from({ length: MENU_FORM_BARS }, (_, b) => menuBarNotes(b, t));
      expect(JSON.parse(JSON.stringify(all))).toEqual(all);
    }
  });
});

describe('menu theme rotation (pure)', () => {
  it('fixed order 0, 1, 2, 0 from nothing stored, never the same twice in a row', () => {
    const seq: number[] = [];
    let last: number | null = null;
    for (let i = 0; i < 9; i++) {
      last = nextMenuTheme(last);
      seq.push(last);
    }
    expect(seq).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2]);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    for (const n of [2, 3, 4]) for (let l = 0; l < n; l++) expect(nextMenuTheme(l, n)).not.toBe(l);
  });

  it('parses only valid stored indices', () => {
    expect(parseMenuTheme('0')).toBe(0);
    expect(parseMenuTheme('2')).toBe(2);
    for (const bad of [null, '', '3', '-1', '1.5', 'x', ' 1']) expect(parseMenuTheme(bad)).toBeNull();
  });

  it('a level (play or results) makes the next start rotate; title, menu and settings do not', () => {
    expect((['title', 'menu', 'settings', 'play', 'results'] as const).map(menuRotates)).toEqual([false, false, false, true, true]);
  });
});

describe('menu theme rotation in the player', () => {
  function mk(store: MemStorage, graph: () => MusicGraph | null = () => ({ ctx: new FakeContext(), master: new FakeNode() })) {
    return createMenuTheme({ graph, timer: new FakeTimer(), volume: () => 50, store });
  }

  it('boot picks the theme after the stored one and persists it', () => {
    const st = new MemStorage();
    st.value = '1';
    const p = mk(st);
    expect(p.theme).toBe(-1);
    p.screen('title');
    expect(p.theme).toBe(2);
    expect(st.value).toBe('2');
    p.stop();
    // The next boot continues the order.
    const q = mk(st);
    q.screen('title');
    expect(q.theme).toBe(0);
    expect(st.value).toBe('0');
  });

  it('nothing stored, or junk stored, starts at theme 0', () => {
    for (const raw of [null, 'junk', '9']) {
      const st = new MemStorage();
      st.value = raw;
      const p = mk(st);
      p.screen('title');
      expect(p.theme).toBe(0);
    }
  });

  it('each return from a level brings the next theme; menu, settings, hidden tab and volume keep it', () => {
    const st = new MemStorage();
    let vol = 50;
    const graph = { ctx: new FakeContext(), master: new FakeNode() };
    const p = createMenuTheme({ graph: () => graph, timer: new FakeTimer(), volume: () => vol, store: st });
    p.screen('title');
    p.screen('menu');
    p.screen('settings');
    p.screen('menu');
    expect(p.theme).toBe(0);
    p.setHidden(true);
    p.setHidden(false);
    vol = 0;
    p.volumeChanged();
    vol = 50;
    p.volumeChanged();
    expect(p.theme).toBe(0);
    expect(st.writes).toBe(1);
    const seen = [p.theme];
    for (let i = 0; i < 5; i++) {
      p.screen('play');
      p.screen('results');
      p.screen('menu');
      seen.push(p.theme);
    }
    expect(seen).toEqual([0, 1, 2, 0, 1, 2]);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    expect(st.value).toBe('2');
    // leave() (game:start or a level's music) also counts as a level.
    p.leave();
    p.screen('menu');
    expect(p.theme).toBe(0);
  });

  it('a boot with the audio locked picks only once the theme really starts', () => {
    const st = new MemStorage();
    let g: MusicGraph | null = null;
    const timer = new FakeTimer();
    const p = createMenuTheme({ graph: () => g, timer, volume: () => 50, store: st });
    p.screen('title');
    expect(p.theme).toBe(-1);
    expect(st.writes).toBe(0);
    g = { ctx: new FakeContext(), master: new FakeNode() };
    timer.fire();
    expect(p.theme).toBe(0);
    expect(st.writes).toBe(1);
  });

  it('storage that throws or is null never breaks the theme', () => {
    const bad: MenuThemeStore = {
      load: () => {
        throw new Error('blocked');
      },
      save: () => {
        throw new Error('blocked');
      },
    };
    const graph = (): MusicGraph => ({ ctx: new FakeContext(), master: new FakeNode() });
    const b = createMenuTheme({ graph, timer: new FakeTimer(), volume: () => 50, store: bad });
    b.screen('title');
    expect(b).toMatchObject({ state: 'playing', theme: 0 });
    b.leave();
    b.screen('menu');
    expect(b.theme).toBe(1);
    const p = createMenuTheme({ graph, timer: new FakeTimer(), volume: () => 50, store: null });
    p.screen('title');
    expect(p.state).toBe('playing');
    p.leave();
    p.screen('menu');
    expect(p.theme).toBe(1);
  });

  it('the default store keeps the rotation across music reinstalls in one page load', () => {
    const graph = (): MusicGraph => ({ ctx: new FakeContext(), master: new FakeNode() });
    const a = createMenuTheme({ graph, timer: new FakeTimer(), volume: () => 50 });
    a.screen('title');
    const first = a.theme;
    a.stop();
    const b = createMenuTheme({ graph, timer: new FakeTimer(), volume: () => 50 });
    b.screen('title');
    expect(b.theme).toBe(nextMenuTheme(first));
    const m = memoryMenuStore();
    expect(m.load()).toBeNull();
    m.save('2');
    expect(m.load()).toBe('2');
  });

  it('each theme plays at its own tempo', () => {
    for (const t of THEMES) {
      const st = new MemStorage();
      if (t > 0) st.value = String(t - 1);
      const ctx = new FakeContext();
      const timer = new FakeTimer();
      const p = createMenuTheme({ graph: () => ({ ctx, master: new FakeNode() }), timer, volume: () => 50, store: st });
      p.screen('title');
      expect(p.theme).toBe(t);
      for (let i = 0; i < 200; i++) {
        ctx.currentTime += TICK_MS / 1000;
        timer.fire();
      }
      expect(ctx.oscs.length, `theme ${t}`).toBeGreaterThan(0);
      p.stop();
      expect(timer.live).toBe(0);
    }
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
  let store: MemStorage;

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
    store = new MemStorage();
    uninstall = initMusic({ tune: 'neon', bus, graph: () => graph, timer, visibility: doc, volume: 50, menuStore: store });
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
    expect(menuThemeState()).toMatchObject({ state: 'playing', engines: 1, starts: 2, theme: 1 });
    expect(store.value).toBe('1');
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
