// Battle polish (Ryan rated the battle tracks 3 of 5): each track validates (minor key, chords,
// hook every 8 bars, double density drums, octave jumping bass, its own key, hook rhythm and drum
// feel), the intro hit lands on the cross fade bar, phases open the filter and add a layer, the
// window ducks the drums 6 dB and lifts the hook, the defeat resolves on the tonic major, and the
// weapon and drone cues play in key, rate limited, inside the voice cap of a tier 4 fight.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { battleIndexFor } from '../../../src/audio/music/battle';
import {
  CUE_MIN_GAP_SEC,
  cueAllowed,
  cueKindOf,
  cueNotes,
  defeatRoot,
  introNotes,
  phaseCutoffMul,
  phaseLayer,
  WINDOW_DRUM_DUCK,
  WINDOW_HOOK_LIFT,
  windowGain,
} from '../../../src/audio/music/battlePolish';
import { KIND_BOSS, KIND_BOSS_PART } from '../../../src/audio/music/bossCue';
import { BED_VOICE_MAX, MUSIC_VOICE_CAP } from '../../../src/audio/music/engine';
import { harmonyForBar, inChord, inScale } from '../../../src/audio/music/harmony';
import { initMusic, musicState, setMusicVolume, startMusic, type MusicGraph, type NoteLog } from '../../../src/audio/music/index';
import { LAYERS_FULL } from '../../../src/audio/music/layers';
import { TICK_MS } from '../../../src/audio/music/scheduler';
import { BAR_SEC, buildBar, isHookBar, isJumpBar, STEPS_PER_BAR } from '../../../src/audio/music/track';
import { BATTLE_TUNES, TUNES, type Tune } from '../../../src/audio/music/tunes';
import { Bus } from '../../../src/core/events';
import type { BossId, EnemyKind } from '../../../src/levelgen/leveldef';
import { FakeContext, FakeNode, FakeTimer } from './fakeAudio';

const arpOf = (t: Tune, bar: number): string =>
  buildBar(5, bar, t, null)
    .notes.filter((n) => n.layer === 'arp')
    .map((n) => `${n.step}:${n.midi}`)
    .join(',');

describe('battle tracks (pure)', () => {
  it('each is minor with its chords from its scale, and the three keys differ', () => {
    for (const t of BATTLE_TUNES) {
      const tonic = t.key.bars[0];
      expect(tonic?.root).toBe(t.key.tonic);
      expect(tonic?.intervals[1]).toBe(3);
      for (const h of t.key.bars) for (const pc of h.tones) expect(t.key.scale).toContain(pc);
    }
    expect(new Set(BATTLE_TUNES.map((t) => t.key.tonic)).size).toBe(3);
  });

  it('the hook plays verbatim on bar 0 of every 8, whatever the pass, and fits the harmony', () => {
    for (const t of BATTLE_TUNES) {
      expect(t.hook).toBeDefined();
      const hook = arpOf(t, 0);
      for (const bar of [8, 16, 24, 40]) {
        expect(isHookBar(t, bar)).toBe(true);
        expect(arpOf(t, bar), `${t.id} bar ${bar}`).toBe(hook);
      }
      expect(isHookBar(t, 4)).toBe(false);
      const steps = buildBar(5, 0, t, null).notes.filter((n) => n.layer === 'arp');
      expect(steps.map((n) => n.step)).toEqual([...(t.hook?.steps ?? [])]);
      for (const n of steps) expect(inScale(n.midi ?? 0, t.key)).toBe(true);
    }
    // Three different hook rhythms.
    expect(new Set(BATTLE_TUNES.map((t) => t.hook?.steps.join(','))).size).toBe(3);
  });

  it('kick and clap run at double the density of the level tunes, each with its own feel', () => {
    const density = (t: Tune): number => t.drums.kick.length + t.drums.perc.length;
    const level = Math.max(...TUNES.map(density));
    for (const t of BATTLE_TUNES) expect(density(t), t.id).toBeGreaterThanOrEqual(2 * level);
    expect(new Set(BATTLE_TUNES.map((t) => t.drums.kick.map((h) => h.step).join(','))).size).toBe(3);
    // The drums keep the bed rules: no clap before step 4 or after 14, no kick after 13.
    for (const t of BATTLE_TUNES) {
      for (const h of t.drums.perc) expect(h.step >= 4 && h.step <= 14).toBe(true);
      for (const h of t.drums.kick) expect(h.step).toBeLessThanOrEqual(13);
    }
  });

  it('the bass jumps octaves on bars 4 and 8 of every loop and only there', () => {
    for (const t of BATTLE_TUNES) {
      for (let bar = 0; bar < 16; bar++) {
        const bass = buildBar(5, bar, t, null).notes.filter((n) => n.layer === 'bass').map((n) => n.midi ?? 0);
        let jumps = 0;
        for (let i = 1; i < bass.length; i++) if (Math.abs((bass[i] ?? 0) - (bass[i - 1] ?? 0)) === 12) jumps++;
        const h = harmonyForBar(bar, t.key);
        for (const m of bass) expect(inChord(m, h)).toBe(true);
        if (bar % 4 === 3) {
          expect(isJumpBar(t, bar)).toBe(true);
          expect(jumps, `${t.id} bar ${bar}`).toBeGreaterThanOrEqual(2);
        } else {
          expect(isJumpBar(t, bar)).toBe(false);
        }
      }
    }
  });

  it('each track has its own one bar intro hit of chord tones', () => {
    const sigs = new Set<string>();
    for (const t of BATTLE_TUNES) {
      const h = harmonyForBar(0, t.key);
      const notes = introNotes(t, h);
      expect(notes.length).toBeGreaterThanOrEqual(4);
      for (const n of notes) {
        expect(inChord(n.midi, h)).toBe(true);
        expect(n.step + n.durSteps).toBeLessThanOrEqual(STEPS_PER_BAR);
      }
      sigs.add(notes.map((n) => n.step).join(','));
    }
    expect(sigs.size).toBe(3);
  });

  it('phases open the filter and add drum layers; the window ducks drums 6 dB and lifts the hook', () => {
    expect(phaseCutoffMul(1)).toBe(1);
    for (let p = 2; p <= 4; p++) expect(phaseCutoffMul(p)).toBeGreaterThan(phaseCutoffMul(p - 1));
    expect(phaseLayer(1)).toEqual([]);
    for (let p = 2; p <= 4; p++) expect(phaseLayer(p).length).toBeGreaterThan(phaseLayer(p - 1).length);
    for (const h of phaseLayer(4)) if (h.layer === 'perc') expect(h.step >= 4 && h.step <= 14).toBe(true);
    expect(20 * Math.log10(WINDOW_DRUM_DUCK)).toBeCloseTo(-6, 0);
    for (const l of ['kick', 'perc', 'hat'] as const) expect(windowGain(l, true)).toBe(WINDOW_DRUM_DUCK);
    expect(windowGain('arp', true)).toBe(WINDOW_HOOK_LIFT);
    expect(windowGain('pad', true)).toBe(1);
    for (const l of ['kick', 'arp', 'pad'] as const) expect(windowGain(l, false)).toBe(1);
  });

  it('the defeat root is the track tonic nearest A4', () => {
    expect(defeatRoot(9)).toBe(69);
    expect(defeatRoot(2)).toBe(74);
    expect(defeatRoot(4)).toBe(64);
    for (const t of BATTLE_TUNES) expect(defeatRoot(t.key.tonic) % 12).toBe(t.key.tonic);
  });

  it('cues: a rising three note upgrade and a falling two note expiry in key; drone variants lighter', () => {
    for (const t of [...BATTLE_TUNES, ...TUNES]) {
      const up = cueNotes('combine', t.key);
      expect(up).toHaveLength(3);
      expect((up[1]?.midi ?? 0) > (up[0]?.midi ?? 0) && (up[2]?.midi ?? 0) > (up[1]?.midi ?? 0)).toBe(true);
      const down = cueNotes('expire', t.key);
      expect(down).toHaveLength(2);
      expect(down[1]?.midi ?? 0).toBeLessThan(down[0]?.midi ?? 0);
      for (const k of ['combine', 'expire', 'droneArm', 'droneExpire'] as const) for (const n of cueNotes(k, t.key)) expect(inScale(n.midi, t.key), `${t.id} ${k}`).toBe(true);
      const arm = cueNotes('droneArm', t.key);
      expect(arm[0]?.midi ?? 0).toBeGreaterThan(up[0]?.midi ?? 0);
      expect(arm[0]?.gain ?? 1).toBeLessThan(up[0]?.gain ?? 0);
      expect(cueNotes('droneExpire', t.key)[0]?.gain ?? 1).toBeLessThan(down[0]?.gain ?? 0);
    }
    expect(cueAllowed(null, 0)).toBe(true);
    expect(cueAllowed(1, 1 + CUE_MIN_GAP_SEC / 2)).toBe(false);
    expect(cueAllowed(1, 1 + CUE_MIN_GAP_SEC)).toBe(true);
    expect(cueKindOf('fx:weaponCombine')).toBe('combine');
    expect(cueKindOf('fx:droneExpire')).toBe('droneExpire');
    expect(cueKindOf('fx:pickup')).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// Through the real entry points.

let ctx: FakeContext;
let timer: FakeTimer;
let bus: Bus;
let log: (NoteLog & { now: number })[];
let uninstall: () => void;

function advance(sec: number, check?: () => void): void {
  const n = Math.round(sec / (TICK_MS / 1000));
  for (let i = 0; i < n; i++) {
    ctx.currentTime += TICK_MS / 1000;
    timer.fire();
    check?.();
  }
}

const barLineAfter = (s: number): number => (Math.floor(s / STEPS_PER_BAR) + 1) * STEPS_PER_BAR;

function seedFor(id: BossId, want: number, from = 1): number {
  for (let s = from; s < from + 500; s++) if (battleIndexFor(s, id, null) === want) return s;
  throw new Error('no seed');
}

/** Emit any event name with any payload (the cue events, and odd payloads), the way glue might. */
function emitRaw(name: string, payload: unknown): void {
  (bus as unknown as { emit: (k: string, p: unknown) => void }).emit(name, payload);
}

beforeEach(() => {
  ctx = new FakeContext();
  timer = new FakeTimer();
  bus = new Bus();
  const graph: MusicGraph = { ctx, master: new FakeNode() };
  log = [];
  setMusicVolume(50);
  uninstall = initMusic({ tune: 'tide', bus, graph: () => graph, timer, visibility: null, volume: 50, onNote: (n) => log.push({ ...n, now: ctx.currentTime }) });
  bus.emit('game:start', { mode: 'adventure', levelIndex: 0 });
});

afterEach(() => uninstall());

describe('battle polish through the entry points', () => {
  it.each(BATTLE_TUNES.map((t, i) => [t.id, i] as const))('%s: the intro hit lands on the cross fade bar', (name, idx) => {
    startMusic(seedFor('warden', idx));
    bus.emit('sim:threat', { level: 1 });
    advance(BAR_SEC * 2.3);
    const at = musicState().nextStep;
    bus.emit('sim:bossEnter', { id: 'warden', tier: 1 });
    const join = barLineAfter(at);
    advance(BAR_SEC * 3);
    const intro = log.filter((n) => n.role === 'battleIntro');
    expect(intro.length).toBeGreaterThanOrEqual(4);
    expect(Math.min(...intro.map((n) => n.step))).toBe(join);
    for (const n of intro) {
      expect(n.step).toBeLessThan(join + STEPS_PER_BAR);
      expect(n.tune).toBe(name);
    }
    // The battle bed starts on that same bar.
    expect(Math.min(...log.filter((n) => n.role === 'bed' && n.tune === name).map((n) => n.step))).toBe(join);
    // The hook (verbatim arp bar) comes on the join bar too: bar 0 of the battle loop.
    const t = BATTLE_TUNES[idx];
    const arpSteps = log.filter((n) => n.role === 'bed' && n.layer === 'arp' && n.step >= join && n.step < join + STEPS_PER_BAR).map((n) => n.step - join);
    expect(arpSteps).toEqual([...(t?.hook?.steps ?? [])]);
  });

  it('the window ducks the drums 6 dB and lifts the hook; phases add the drum layer', () => {
    startMusic(seedFor('prism', 0));
    bus.emit('sim:threat', { level: 1 });
    advance(BAR_SEC * 2);
    bus.emit('sim:bossEnter', { id: 'prism', tier: 4 });
    advance(BAR_SEC * 4);
    const kicksIn = (from: number, to: number): number[] => log.filter((n) => n.role === 'bed' && n.layer === 'kick' && n.now >= from && n.now < to).map((n) => n.gain);
    const shutFrom = ctx.currentTime;
    advance(BAR_SEC * 2);
    const shut = kicksIn(shutFrom, ctx.currentTime);
    bus.emit('sim:bossWindow', { id: 'prism', open: true, secondsLeft: 4 });
    const openFrom = ctx.currentTime + 0.3;
    advance(BAR_SEC);
    const open = kicksIn(openFrom, ctx.currentTime);
    bus.emit('sim:bossWindow', { id: 'prism', open: false, secondsLeft: 0 });
    expect(shut.length).toBeGreaterThan(0);
    expect(open.length).toBeGreaterThan(0);
    expect(Math.max(...open) / Math.max(...shut)).toBeCloseTo(WINDOW_DRUM_DUCK, 2);
    // Phase 2 on: the added layer appears; phase 1 had none.
    expect(log.some((n) => n.role === 'battleLayer')).toBe(false);
    bus.emit('sim:bossPhase', { id: 'prism', phase: 2, phases: 4 });
    advance(BAR_SEC * 3);
    expect(log.some((n) => n.role === 'battleLayer')).toBe(true);
  });

  it('weapon and drone cues play in key, rate limited; odd or missing payloads never throw', () => {
    startMusic(seedFor('warden', 1));
    advance(BAR_SEC);
    emitRaw('fx:weaponCombine', { x: 0, y: 0, kind: 'spread+rapid', a: 'spread', b: 'rapid' });
    emitRaw('fx:weaponCombine', { x: 0, y: 0, kind: 'spread+rapid', a: 'spread', b: 'rapid' });
    advance(0.05);
    emitRaw('fx:weaponCombine', { x: 0, y: 0, kind: 'rapid+pierce', a: 'rapid', b: 'pierce' });
    advance(0.05);
    let cues = log.filter((n) => n.role === 'cue' && n.cueKind === 'combine');
    expect(cues).toHaveLength(3); // one cue of three notes; the second and third were inside the gap
    advance(CUE_MIN_GAP_SEC + 0.05);
    emitRaw('fx:weaponCombine', { x: 0, y: 0, kind: 'rapid+pierce', a: 'rapid', b: 'pierce' });
    emitRaw('fx:weaponExpire', { kind: 'rapid+pierce' });
    emitRaw('fx:droneArm', { x: 0, y: 0, mode: 'homing', secondsLeft: 20 });
    emitRaw('fx:droneExpire', { x: 0, y: 0, mode: 'homing' });
    advance(0.05);
    cues = log.filter((n) => n.role === 'cue');
    expect(cues.filter((n) => n.cueKind === 'combine')).toHaveLength(6);
    expect(cues.filter((n) => n.cueKind === 'expire')).toHaveLength(2);
    expect(cues.filter((n) => n.cueKind === 'droneArm')).toHaveLength(3);
    expect(cues.filter((n) => n.cueKind === 'droneExpire')).toHaveLength(2);
    const key = TUNES.find((t) => t.id === 'tide')?.key;
    for (const n of cues) if (key !== undefined && n.tune === 'tide') expect(inScale(n.midi ?? 0, key)).toBe(true);
    expect(() => {
      emitRaw('fx:weaponCombine', undefined);
      emitRaw('fx:droneArm', null);
      emitRaw('fx:weaponExpire', 7);
      advance(0.05);
    }).not.toThrow();
  });

  it.each(BATTLE_TUNES.map((t, i) => [t.id, i] as const))('tier 4 fight on %s with every layer, cue and phase stays inside the voice cap', (name, idx) => {
    const kinds = Object.keys(LAYERS_FULL) as EnemyKind[];
    startMusic(seedFor('prism', idx));
    bus.emit('sim:threat', { level: 1 });
    for (const k of kinds) bus.emit('sim:enemyEnter', { kind: k, live: 3 });
    advance(BAR_SEC * 2);
    const check = (): void => {
      const st = musicState();
      expect(st.voices).toBeLessThanOrEqual(MUSIC_VOICE_CAP);
      expect(st.bossVoices).toBeLessThanOrEqual(MUSIC_VOICE_CAP - BED_VOICE_MAX);
    };
    bus.emit('sim:bossEnter', { id: 'prism', tier: 4 });
    advance(BAR_SEC * 2, check);
    expect(musicState().tune).toBe(name);
    for (let phase = 2; phase <= 4; phase++) {
      bus.emit('sim:bossPhase', { id: 'prism', phase, phases: 4 });
      for (let i = 0; i < 2; i++) {
        bus.emit('sim:bossWindow', { id: 'prism', open: false, secondsLeft: 1 });
        bus.emit('fx:hit', { x: 0, y: 0, kind: KIND_BOSS_PART, id: 2, blocked: false });
        emitRaw('fx:weaponCombine', { x: 0, y: 0, kind: 'pierce+orbit', a: 'pierce', b: 'orbit' });
        emitRaw('fx:droneArm', { x: 0, y: 0, mode: 'double', secondsLeft: 20 });
        advance(1, check);
        bus.emit('sim:bossWindow', { id: 'prism', open: true, secondsLeft: 3 });
        bus.emit('fx:hit', { x: 0, y: 0, kind: KIND_BOSS, id: 1, blocked: false });
        emitRaw('fx:weaponExpire', { kind: 'pierce+orbit' });
        emitRaw('fx:droneExpire', { x: 0, y: 0, mode: 'double' });
        bus.emit('fx:kill', { x: 0, y: 0, colour: 'blue', kind: 1, id: 9 });
        bus.emit('sfx', 'explode');
        advance(1, check);
      }
    }
    bus.emit('sim:bossDown', { id: 'prism', x: 0, y: 0 });
    advance(BAR_SEC * 4, check);
    expect(log.some((n) => n.role === 'battleLayer')).toBe(true);
    expect(log.some((n) => n.role === 'cue')).toBe(true);
    expect(musicState().bedSteals).toBe(0);
  });
});
