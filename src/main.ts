// Boot, resize, loop and screen flow wiring (docs/03 sections 1, 8, 9, docs/04 sections 2, 4, 5,
// 6, 13, docs/01 section 10).
// Boot order: load settings, create renderer, create world, attach input, build UI, start loop,
// register resize. The #sow-viewport and #sow-build labels are plain DOM so they still
// report if the renderer fails.
// Screen flow: menu, level, pause, results and settings run through the pure state machine in
// ui/flow.ts. UI and game talk through the bus: game:start, game:pause, game:resume, game:quit,
// game:over, hud:score and hud:weapon.
import { getDebugInfo, runParticleStress, setDebugInfoSource, type DebugInfo } from './core/debug';
import { bus, type ViewportInfo } from './core/events';
import { createLoop, type Loop } from './core/loop';
import { initialDivisorState, nextDivisor, type DivisorState } from './core/perf';
import { freshSeed, hash01 } from './core/rng';
import {
  ensureSchema,
  loadAdventureScores,
  loadFreePlaySetup,
  loadMenuTheme,
  loadRunSeed,
  loadSettings,
  loadUnlocked,
  recordEndlessScore,
  resetProgress,
  saveFreePlaySetup,
  saveMenuTheme,
  savePendingBonus,
  saveSetting,
  spaceForDifficulty,
  takePendingBonus,
  unlockAfter,
  unlockLevel,
  type EffectsTierSetting,
  type SpaceLevelSetting,
} from './core/settings';
import { loadCallsign, loadStorySeen, recordStorySeen, saveCallsign } from './core/settings';
import { resizePauseAllowed, stepInput } from './story/hold';
import { bossWinScenes, levelStartScenes, replayScenes, storyLevels } from './story/triggers';
import { createStoryPlayer } from './ui/story/player';
import { capDpr, fmt3, readInsets, viewportLine } from './core/viewport';
import { awardKill, bossBonus, collectGeom, resetScore, scoreOf, shipDied, stars } from './game/scoring';
import { bossBar, type BossBar } from './game/bosses/bar';
import { readBoss, type BossView } from './game/bosses/view';

/** Boss bar before the guardian is on the field: both strips full, the guardian's own name. */
const FULL_BOSS_BAR: BossBar = { shield: 1, health: 1, label: '' };
import { armBossFromSpec } from './game/bosses/index';
import { bossTierOf } from './levelgen/boss';
import type { BossId } from './levelgen/leveldef';
import { createEndlessGame, createGame, gameState, setWeaponPickups, stepGame, type GameOptions } from './game/game';
import type { Difficulty } from './core/difficulty';
import { targetsFor, type ParTargets } from './core/stars';
import type { StartBonus } from './core/bonus';
import { setShipSpace } from './game/ship';
import { installAudio, play as playCue } from './audio/synth';
import { superChargeFraction } from './game/supers';
import { setMusicVolume as setMusicEngineVolume, startMusic, stopMusic, wireMusic } from './audio/music';
import { clearEntities, inlineRectLevel, Kind, liveEnemies, spawn, type World } from './game/world';

// Glue: Ledger's scoring behind Swarm's ScoringPort.
const scoringPort = { awardKill, collectGeom: (w: World): void => { collectGeom(w); }, resetMultiplier: shipDied, multiplier: (w: World): number => scoreOf(w).multiplier };
import { installHistoryGuard } from './input/history';
import type { InputState } from './input/types';
import { VALID_FIXTURES } from './levelgen/fixtures';
import type { LevelDef } from './levelgen/leveldef';
import { generateEndless, generateEndlessSegment, levelHash } from './levelgen/generator';
import { installDevPanel, setGlowPath, setShowFps } from './render/devpanel';
import { setEffectsTier } from './render/effects';
import { setTilt } from './render/tilt';
import { createScreenAnnouncer } from './ui/screenEvent';
import { applyNeon, currentNeon, getNeonState, onNeonChanged } from './render/neon';
import { syncFourthStarStyle } from './ui/fourthStar';
import { syncVectorFontStyle } from './ui/vectorFont';
import { createRenderer, type GameRenderer } from './render/renderer';
import { attachTouch, type TouchHandle } from './input/touch';
import { createCuePort, type SimSnapshot } from './ui/cueFlow';
import { confine, createUiRoot, setTapSound } from './ui/dom';
import { bootFlow, reduceFlow, simRunning, type FlowAction, type FlowState, type LevelResult } from './ui/flow';
import { aspectClass, createHud, due, type AspectClass } from './ui/hud';
import { hudFrame, overlayPadding, type HudFrame } from './ui/hudFrame';
import { pickLevel, parseLevelQuery, type GeneratorModule, type LevelPick } from './ui/levelSource';
import { resolveAudio } from './ui/audioPort';
import { bossBarFeed, bossName, needsBossStrip } from './ui/boss';
import { endlessLabel, endlessLevel, endlessLine } from './ui/endless';
import { createHowToScreen } from './ui/howTo';
import { createLevelSelect } from './ui/levelSelect';
import { continueLabel, createMenuScreen, footerLine, shortSha } from './ui/menu';
import { gateSearch, isDev } from './ui/devGate';
import { devView, isCapture, stickCircles } from './ui/capture';
import { unlockAllLevels } from './ui/devUnlock';
import { FIGHT_TOAST_MS, FIGHT_TIMER_START, fightLine, fightStep, type FightTimer } from './ui/fightTimer';
import { createSplashScreen } from './ui/splash';
import { createPreviewWorld, previewRect, stepPreview } from './ui/preview';
import { starsFor } from './game/objective';
import { CLOCK_HIDDEN, clockView, fallbackStatus, objectiveProgress, WARN_START, warnStep, type WarnState } from './ui/objective';
import { settleAdventure } from './ui/outcome';
import { formatClock } from './ui/format';
import { bonusLabel } from './ui/parReward';
import { createFreePlayScreen, DEFAULT_FREE_PLAY, type FreePlayChoice } from './ui/freePlay';
import { buildFreePlayRun, freePlayLine, freePlayResult, snapshotOf } from './ui/freePlayRun';
import { levelFoes, newFoes, type FoeSource } from './ui/enemyIntro';
import { createPauseScreen } from './ui/pause';
import { musicCue, type MusicCue } from './ui/musicFlow';
import { createBootScreen } from './ui/boot';
import { arenaName, armIntro, createIntroScreen, endlessIntroCard, introActive, introCard, NO_INTRO, startIntro, tickIntro, type IntroGate } from './ui/intro';
import { createResultsScreen } from './ui/results';
import { createDoubleBack, installBackButton } from './native/backButton';
import { installServiceWorkerCleanup } from './native/dropServiceWorker';
import { captureShowFps, createSettingsModel, createSettingsScreen } from './ui/settings';

// Foundry's generator, if src/levelgen/generator.ts exists at build time. import.meta.glob
// resolves to an empty record when the file is absent, so this builds either way.
const generatorModules = import.meta.glob<GeneratorModule>('./levelgen/generator.ts', { eager: true });
const generator: GeneratorModule | null = Object.values(generatorModules)[0] ?? null;

// Glow's synth, if src/audio/synth.ts exists at build time; otherwise unlock and volume are no-ops.
const audioModules = import.meta.glob<Record<string, unknown>>('./audio/synth.ts', { eager: true });
const audio = resolveAudio(Object.values(audioModules)[0] ?? null);

// ---------------------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------------------

interface Measure {
  readonly cssW: number;
  readonly cssH: number;
  /** Raw window.devicePixelRatio, the value G0 needs to learn. */
  readonly dpr: number;
  /** Capped value used for the render target. */
  readonly renderDpr: number;
}

/** Edge: re-read visualViewport (falls back to window size) and the device pixel ratio. */
function measure(): Measure {
  const vv = window.visualViewport;
  const cssW = Math.round(vv ? vv.width : window.innerWidth);
  const cssH = Math.round(vv ? vv.height : window.innerHeight);
  const dpr = window.devicePixelRatio || 1;
  return { cssW, cssH, dpr, renderDpr: capDpr(dpr) };
}

function sameMeasure(a: Measure, b: Measure): boolean {
  return a.cssW === b.cssW && a.cssH === b.cssH && a.dpr === b.dpr;
}

function orientationType(): string {
  return screen.orientation ? screen.orientation.type : 'n/a';
}

/** Pure: second label line with the render dpr, physical screen size and orientation. */
function detailLine(m: Measure, screenW: number, screenH: number, orientation: string): string {
  return `render dpr ${fmt3(m.renderDpr)} | screen ${screenW}x${screenH} | ${orientation}`;
}

/** Pure: readable message from anything that was thrown. */
function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`missing element #${id}`);
  return el;
}

/**
 * Release gate (docs/14 item 4): GameOptions plus the difficulty field. R2: plus the par reward,
 * GameOptions.startBonus; Forge adds that field in parallel, so until it lands on main it rides
 * along on this typed object.
 */
type ReleaseGameOptions = GameOptions & { difficulty: Difficulty; startBonus?: StartBonus };

/**
 * Edge: the query every knob reader may see. Without ?dev=1 the query is stripped from the address
 * bar before any other module reads window.location (renderer, touch and devpanel read it later
 * in boot), so every test knob is ignored on a tester's phone.
 */
function gateLocation(): { search: string; dev: boolean; capture: boolean } {
  const raw = window.location.search;
  const search = gateSearch(raw);
  if (search !== raw) {
    try {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash);
    } catch {
      // a sandboxed frame may refuse: main.ts still reads the gated query below
    }
  }
  return { search, dev: isDev(raw), capture: isCapture(search) };
}

function readQuery(search: string): { stress: number; particles: number; sprite: boolean; debug: boolean } {
  const q = new URLSearchParams(search);
  const num = (k: string, def: number): number => {
    const v = Number.parseInt(q.get(k) ?? '', 10);
    return Number.isFinite(v) && v >= 0 ? v : def;
  };
  return {
    stress: num('stress', 0),
    particles: num('particles', 2000),
    sprite: q.get('glow') === 'sprite',
    debug: q.get('debug') === '1',
  };
}

/**
 * Spawn drifting Grunt dummies across the arena. Positions and headings come from hash01, so
 * the scene is the same on every run and no PRNG is touched.
 */
function stressEntities(w: World, count: number): number {
  clearEntities(w);
  const a = w.level.arena;
  let n = 0;
  for (let i = 0; i < count; i++) {
    const x = (hash01(i, 1) - 0.5) * a.width * 0.9;
    const y = (hash01(i, 2) - 0.5) * a.height * 0.9;
    const id = spawn(w, Kind.Grunt, x, y);
    if (id < 0) break;
    const heading = hash01(i, 3) * Math.PI * 2;
    const speed = 60 + 90 * hash01(i, 4);
    w.radius[id] = 14;
    w.vx[id] = Math.cos(heading) * speed;
    w.vy[id] = Math.sin(heading) * speed;
    n++;
  }
  return n;
}

interface SowDebug {
  stress(entities: number, particles?: number): string;
  info(): DebugInfo | null;
}

declare global {
  interface Window {
    sowDebug?: SowDebug;
  }
}

// ---------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------

async function boot(): Promise<void> {
  const buildLabel = byId('sow-build');
  const viewportLabel = byId('sow-viewport');
  const host = byId('game');
  const gated = gateLocation(); // first, before any module reads window.location
  // Capture mode (?dev=1&capture=1): developer readouts, the dev panel gesture and the stick knobs
  // are off for clean clips. Nothing in the sim or input changes.
  const view = devView(gated.dev, gated.capture);
  buildLabel.textContent = `build ${__BUILD_ID__}`;
  buildLabel.style.zIndex = '25'; // above the UI layer (z 20) so menus never hide the build id
  // Tester build: the corner build label is a debug readout, shown only with ?dev=1. The menu
  // footer carries the short sha and seed for screenshots instead.
  buildLabel.style.display = view.readouts ? '' : 'none';

  let note = 'renderer: starting';
  let gestureDone = false; // fullscreen and audio unlock ran (boot tap or first pointerup)
  let last: Measure = measure();

  const paintLabel = (): void => {
    viewportLabel.textContent = [
      viewportLine(last.cssW, last.cssH, last.dpr),
      detailLine(last, screen.width, screen.height, orientationType()),
      note,
    ].join('\n');
  };

  // Surface script errors on the phone, where there is no console. The viewport label shows
  // with ?debug=1 or after an error; otherwise it would sit under the HUD score.
  const query = readQuery(gated.search);
  let failed = false;
  const showLabel = (): void => {
    viewportLabel.style.display = !gated.capture && (query.debug || failed) ? '' : 'none';
  };
  window.addEventListener('error', (e) => {
    note = `error: ${e.message}`;
    failed = true;
    showLabel();
    paintLabel();
  });
  window.addEventListener('unhandledrejection', (e) => {
    note = `rejection: ${describeError(e.reason)}`;
    failed = true;
    showLabel();
    paintLabel();
  });
  paintLabel(); // label works even if everything below fails

  // 1. Settings and progress. ?seed overrides the stored run seed for this session only.
  // A typed seed (Settings "Play seed") or ?seed is session only: it does not touch the stored
  // run seed, unlocks or the Adventure table.
  ensureSchema(); // sow.schema = 1 on first launch
  const settings = loadSettings();
  const levelQuery = parseLevelQuery(gated.search);
  const storedSeed = loadRunSeed(freshSeed); // created once from crypto.getRandomValues
  let runSeed = levelQuery.seed ?? storedSeed;
  let customSeed = levelQuery.seed !== null && levelQuery.seed !== storedSeed;

  // 2. Renderer.
  let renderer: GameRenderer | null = null;
  try {
    renderer = await createRenderer(host);
    note = `renderer: ${renderer.app.renderer.name}`;
  } catch (err) {
    note = `renderer failed: ${describeError(err)}`;
    failed = true;
    console.error('[sow] renderer failed', err);
  }
  showLabel();
  let bloomOn = renderer !== null && !query.sprite;
  if (renderer !== null && query.sprite) renderer.setBloomEnabled(false);

  // 3. World. Generator level when Foundry's generator.ts is present, else a fixture.
  const menuLevel = (): number => levelQuery.level ?? loadUnlocked();
  let pick: LevelPick = pickLevel(generator, runSeed, menuLevel(), VALID_FIXTURES);
  let level: LevelDef = pick.def;
  /** Options for every new world; difficulty is read at each level start (the card changes it between levels). */
  const gameOptions = (difficulty: Difficulty, startBonus?: StartBonus): ReleaseGameOptions =>
    startBonus === undefined ? { scoring: scoringPort, difficulty } : { scoring: scoringPort, difficulty, startBonus };
  /** R1: the difficulty the current world was built with; the star cap reads this, not the setting. */
  let runDifficulty: Difficulty = 'normal';
  /** R6: par and the star targets for this run, the level's own times DIFFICULTY[d].parScale. */
  let targets: ParTargets = targetsFor(level, runDifficulty);
  /** R2: the par reward the current Adventure world started with, kept so a card rebuild keeps it. */
  let runBonus: StartBonus | null = null;
  /** The Free Play options of the last Free Play run; arena, barriers and config persist (sow.settings.freePlay). */
  let freePlayChoice: FreePlayChoice = { ...DEFAULT_FREE_PLAY, ...loadFreePlaySetup() };
  let world: World = createGame(level, gameOptions(runDifficulty));
  let endlessSeed = 0;
  /** R5 Details: the highest multiplier this run reached, sampled after every sim step. */
  let peakMult = 1;
  // V2-A glue point, the one named port call for space physics. R2: the Settings row is gone; the
  // level follows the run's difficulty (spaceForDifficulty) and is applied whenever startLevel
  // builds a new world.
  const applySpacePhysics = (level: SpaceLevelSetting): void => setShipSpace(world, level);
  // V2-B glue point, the one named port call for weapon pickups. Fable replaces the body with
  // Swarm's setWeaponPickups(world, on) after both branches merge; this branch does not import
  // src/game weapons on purpose. It runs at boot (settingsModel.applyBoot), on every change from
  // the Weapon pickups row, and whenever startLevel builds a new world, so the stored choice
  // reaches every world. Until then it is a no-op.
  const applyWeaponPickups = (on: boolean): void => setWeaponPickups(world, on);
  // V2-D glue point, the one named port call for the effects tier. Fable replaces the body with
  // Glow's tier export (setEffectsTier from src/render) after both branches merge; this branch does
  // not import it on purpose. It runs at boot (settingsModel.applyBoot) and once per change from the
  // Effects row. The tier is render state, not world state, so startLevel does not repeat it. Until
  // then it is a no-op.
  const applyEffectsTier = (tier: EffectsTierSetting): void => setEffectsTier(tier);
  // V2-D glue point, the one named port call for music wiring. Chorus's layers branch exports an
  // idempotent wireMusic(bus, opts) from src/audio/music/index.ts. Fable replaces the body with
  // wireMusic(bus, { volume }) after both branches merge, then drops the direct initMusic() call
  // below so the bus is wired once. It runs at boot (settingsModel.applyBoot) and on every change
  // from the Music slider, so it must be safe to call repeatedly. Until then it is a no-op: the
  // volume itself already reaches the engine through setMusicVolume in the settings effects.
  const wireMusicPort = (volume: number): void => {
    wireMusic(bus, { volume, menuStore: { load: loadMenuTheme, save: saveMenuTheme } }); // idempotent: the same bus returns the same wiring
  };
  renderer?.setArena(level);
  // Settings preview arena: grid plus one of each enemy drifting (docs/01 section 10).
  const previewLevel: LevelDef = inlineRectLevel(1);
  let preview: World | null = null;
  let lastPreviewMs = 0;

  // 4. Input. Thumbs reads the safe area insets on attach and on every reanchor.
  const touch: TouchHandle | null = renderer !== null ? attachTouch(renderer.app.canvas, { insets: readInsets }) : null;
  installHistoryGuard(bus); // first system back press pauses instead of leaving (docs/04 section 11)
  const idle: InputState = {
    move: { active: false, x: 0, y: 0 },
    aim: { active: false, x: 0, y: 0 },
    bomb: false,
    superPressed: false,
    pause: false,
  };

  // 5. UI layer, HUD and screens. Every screen talks to the game through the bus or the flow
  // reducer; none of them touches the world.
  const uiRoot = createUiRoot();
  const hud = createHud(uiRoot);
  hud.setDevCode(view.readouts); // the level code on the HUD line is a developer item (?dev=1, not capture)
  hud.listen(bus);
  let flow: FlowState = bootFlow(menuLevel());
  let intro: IntroGate = NO_INTRO; // B7: level intro card or Endless Ready, holds the sim
  let endCheck = true; // fallback objective check; the stress hook turns it off
  let lastHudMs = Number.NEGATIVE_INFINITY;

  // B12: cues the bus never carried (levelComplete, levelFail, respawn, superReady, superActivate,
  // uiTap). The bus 'sfx' payload is SfxName only, so these go straight to Glow's play(cue); it is
  // silent until the first tap unlocks audio and respects the volume.
  const cues = createCuePort(playCue);
  setTapSound(() => cues.tap(performance.now()));
  const simSnap: SimSnapshot = { shipActive: true, charge: 0 };
  /** Read the world into the reused snapshot (no allocation per step). */
  const readSim = (): SimSnapshot => {
    simSnap.shipActive = world.ship.active;
    simSnap.charge = superChargeFraction(world);
    return simSnap;
  };

  // V2-D music. musicCue (ui/musicFlow.ts) says when a run starts or ends; pause, resume, a hidden
  // tab and a fold reach the engine through the bus, so every pause and resume below goes out as
  // game:pause or game:resume and the flow follows from the bus handlers. Music never plays in menus.
  let musicSeed: number | null = null; // level seed of the live run, null outside a run
  let musicLive = false; // startMusic found the audio context (it stays silent until the first tap)
  const tryMusic = (fn: () => boolean): boolean => {
    try {
      return fn();
    } catch (err) {
      console.warn('[sow] music failed', describeError(err)); // audio is optional, the game runs silent
      return false;
    }
  };
  const applyMusicCue = (cue: MusicCue): void => {
    if (cue === 'start') {
      const seed = level.seed >>> 0; // the Adventure level seed, or the Endless seed
      musicSeed = seed;
      musicLive = tryMusic(() => startMusic(seed)); // restarts from bar 0 if a run was already playing
    } else if (cue === 'stop') {
      musicSeed = null;
      musicLive = false;
      tryMusic(() => {
        stopMusic();
        return false;
      });
    }
  };
  /** A level that began before the first tap had no audio context; try again once the tap made it. */
  const retryMusic = (): void => {
    const seed = musicSeed;
    if (seed === null || musicLive || flow.screen !== 'playing') return;
    musicLive = tryMusic(() => startMusic(seed));
  };
  // V3-A boss HUD. The boss bar itself listens to the bus inside the HUD. Here: whether a boss
  // lives (the objective label and the Endless label), and whether this run's boss died (the
  // results line). One reused view, so nothing allocates per call.
  const bossRead: BossView = { active: false, id: 0, mode: 0, phase: 0, hp: 0, maxHp: 0, modeT: 0, x: 0, y: 0, rot: 0, radius: 0 };
  const feedOf = (): BossBar | null => bossBarFeed(readBoss(world, bossRead));
  const bossAlive = (): boolean => readBoss(world, bossRead).barOn === true; // barOn: still true on the Broodlings after the body is gone
  let bossDown = false;
  bus.on('sim:bossDown', () => {
    bossDown = true;
  });
  // Dev only: guardian fight timer on the sim clock (world.time), so paused time never counts.
  let fight: FightTimer = { ...FIGHT_TIMER_START };
  let fightLineText = '';
  if (view.readouts) {
    bus.on('game:start', () => {
      fight = { ...FIGHT_TIMER_START };
      fightLineText = '';
    });
    bus.on('sim:bossEnter', (p) => {
      fight = fightStep(fight, { type: 'enter', id: p.id, t: world.time });
      fightLineText = '';
    });
    bus.on('sim:bossSplit', () => {
      fight = fightStep(fight, { type: 'split', t: world.time });
    });
    bus.on('sim:bossFury', (p) => {
      fight = fightStep(fight, { type: 'fury', stage: p.stage, t: world.time });
    });
    bus.on('sim:bossDown', () => {
      fightLineText = fightLine(fight, world.time);
      hud.toast(fightLineText, FIGHT_TOAST_MS); // every mode, dev builds only (6 s)
    });
  }
  // G3A: whether the cover screen reserves its boss strip for this run (ui/boss.ts needsBossStrip).
  // Set in startLevel before the layout, so the arena is the same size from the first frame.
  let bossStrip = false;
  const requestPause = (): void => {
    if (flow.screen === 'playing') bus.emit('game:pause');
  };
  const requestResume = (): void => {
    if (flow.screen === 'paused') bus.emit('game:resume');
  };

  // hud-clock: warning memory for 'ui:timeWarn', reset whenever emitHud sees a new world.
  let warnWorld: World | null = null;
  let warn: WarnState = { ...WARN_START };
  const emitHud = (): void => {
    const s = scoreOf(world);
    if (warnWorld !== world) {
      warnWorld = world;
      warn = { ...WARN_START };
    }
    // B8: the sim already emits hud:score every HUD_INTERVAL with the super charge as a 0..1
    // fraction; this second emit sent the raw geom count, so the ring and hint flickered
    // between two values and read "ready" after one geom. Only the sim emits hud:score now.
    void s;
    if (flow.mode === 'endless' || flow.mode === 'freeplay') {
      hud.setLine(flow.mode === 'endless' ? endlessLine(endlessSeed, world.time) : freePlayLine(freePlayArenaName(), freePlayChoice.config.length, world.time));
      hud.setObjective({ label: endlessLabel(bossAlive()), fraction: 0, stars: null }); // "Boss" while one lives; no stars
      const fed = feedOf();
      if (fed !== null) hud.setBossBar(fed);
      hud.setClock(CLOCK_HIDDEN); // the level line already carries the Endless and Free Play clock
    } else {
      // Reads "Defeat the boss" while the level holds for a living boss (docs/13 boss rule 9).
      // R2: the bar fills toward the objective; the thin star line reads the level's thresholds.
      // T3: on a boss level the bar counts down to the entrance, then drains with the boss health.
      const alive = bossAlive();
      const bossInput = level.boss !== undefined ? { spec: level.boss, bar: alive ? bossBar(bossRead) : FULL_BOSS_BAR } : undefined;
      const snap = snapshotOf(world);
      hud.setObjective(objectiveProgress(level.objective, snap, alive, targets.stars, bossInput)); // R6: scaled by difficulty
      const fed = feedOf(); // the one boss health bar: Shield over Health, Broodlings label
      if (fed !== null) hud.setBossBar(fed); // keeps feeding after Brood's body is gone (alive is false then)
      // hud-clock: countdown or time played on the objective's own sim clock, so paused time never counts.
      const clock = clockView(level.objective, snap.elapsedSec, level.boss !== undefined);
      const step = warnStep(warn, clock.shownLeft);
      warn = step.state;
      hud.setClock(clock, step.warn !== null);
      if (step.warn !== null) bus.emit('ui:timeWarn', { secondsLeft: step.warn });
    }
  };

  const freePlayArenaName = (): string => arenaName(level);

  /**
   * Build a fresh world for the flow's current level (start, Next, Retry, Restart). R2: the
   * difficulty is the card's last choice (Free Play: its options screen); `rebuild` is a chip tap
   * on the card, which keeps the par reward the world was first built with.
   */
  const startLevel = (mode: 'adventure' | 'endless' | 'freeplay', index: number, rebuild = false): void => {
    runDifficulty = mode === 'freeplay' ? freePlayChoice.difficulty : settingsModel.state.difficulty;
    if (!rebuild) runBonus = mode === 'adventure' && !customSeed ? takePendingBonus(index) : null;
    targets = { par: 0, stars: [0, 0, 0] }; // Endless and Free Play keep no par; Adventure sets it below
    if (mode === 'freeplay') {
      endlessSeed = freshSeed();
      // R3: the sim runs the Free Play def; the UI reads the Endless style level built from the same
      // segments, whose objective never comes due, so only losing every life ends the run (ui/freePlayRun.ts).
      const run = buildFreePlayRun(freePlayChoice, endlessSeed, gameOptions(runDifficulty));
      world = run.world;
      level = run.level;
      pick = { def: level, source: 'generator', hash: run.hash };
    } else if (mode === 'endless') {
      endlessSeed = freshSeed(); // every Endless game gets a fresh seed (docs/01 section 2.2)
      level = endlessLevel({ generateEndless, generateEndlessSegment }, endlessSeed);
      pick = { def: level, source: 'generator', hash: levelHash(generateEndless(endlessSeed)) };
      // Glue: Swarm's segment driven Endless run, segments generated on demand from the seed.
      world = createEndlessGame(generateEndless(endlessSeed), (seg) => generateEndlessSegment(endlessSeed, seg), gameOptions(runDifficulty));
    } else {
      pick = pickLevel(generator, runSeed, index, VALID_FIXTURES);
      level = pick.def;
      world = createGame(level, gameOptions(runDifficulty, runBonus ?? undefined));
      targets = targetsFor(level, runDifficulty);
      hud.setLevel(index, targets.par, pick.hash);
    }
    hud.setSuper(level.superType);
    hud.setInfiniteLives(mode === 'freeplay' && freePlayChoice.config.lives === 'infinite');
    resetScore(world);
    peakMult = 1;
    // Temporary debug hook (docs/12 shared rule 8): ?boss=<id> forces that boss on this level at 10 s.
    const forcedBoss = new URLSearchParams(gated.search).get('boss'); // dev gated: null without ?dev=1
    const forcedTier = forcedBoss === null ? null : bossTierOf(forcedBoss);
    const forcedOn = forcedBoss !== null && forcedTier !== null;
    if (forcedOn) armBossFromSpec(world, { id: forcedBoss as BossId, tier: forcedTier, atSec: 10, hpMul: 1 }, 10);
    bossStrip = needsBossStrip(mode === 'adventure' ? 'adventure' : 'endless', level, forcedOn); // Free Play runs Endless waves
    applySpacePhysics(spaceForDifficulty(runDifficulty)); // R2: space physics follows difficulty
    applyWeaponPickups(settingsModel.state.weaponPickups); // and the stored pickups choice
    hud.clearWeapon(); // a new world starts on spread: drop any indicator left from the last run
    hud.clearDrone(); // and with an unarmed drone: drop a drone indicator or combine caption left over
    hud.clearBoss(); // and has no boss yet: drop a bar left from the last run
    bossDown = false;
    endCheck = true;
    cues.arm(readSim()); // the new world's charge is the baseline: a reset to 0 is not a super
    renderer?.setArena(level);
    sceneWorld = world;
    syncScene();
    lastHudMs = Number.NEGATIVE_INFINITY;
    emitHud();
    if (!rebuild) intro = armIntro(mode); // a chip rebuild keeps the card up
    console.info(`[sow] ${mode} level ${index} ${pick.source} seed ${mode === 'endless' ? endlessSeed : runSeed} hash ${pick.hash}`);
  };

  /**
   * Which world the renderer shows and where. The settings screen opened from the menu shows the
   * preview arena; while settings is open the arena moves right of the panel so it stays visible.
   */
  let sceneWorld: World = world;
  const syncScene = (): void => {
    const settingsOpen = flow.screen === 'settings';
    const wantPreview = settingsOpen && flow.settingsFrom === 'menu';
    if (wantPreview && preview === null) {
      preview = createPreviewWorld(previewLevel);
      lastPreviewMs = 0;
    }
    if (!wantPreview) preview = null;
    const next = wantPreview && preview !== null ? preview : world;
    // setArena clears particles, so only call it when the shown world actually changes.
    if (next !== sceneWorld) renderer?.setArena(next.level);
    sceneWorld = next;
    relayout();
  };

  /**
   * B6: one pure HUD frame per viewport and arena. The renderer gets the frame's play rect, Thumbs
   * gets insets that put bomb and super in the HUD column or band, and the HUD anchors every
   * element outside the arena. viewport:changed carries the same insets and fit.
   */
  let frame: HudFrame = hudFrame(last.cssW, last.cssH, readInsets(), level.arena.width, level.arena.height, { bossStrip });
  function relayout(): HudFrame {
    const insets = readInsets();
    frame = hudFrame(last.cssW, last.cssH, insets, level.arena.width, level.arena.height, { bossStrip });
    renderer?.setPlayRect(flow.screen === 'settings' ? previewRect(last.cssW, last.cssH, insets) : frame.playRect);
    touch?.reanchor(frame.buttonInsets);
    hud.layout(frame, touch !== null);
    // Pause, results and the intro card lay out inside the play rect, clear of the HUD rings.
    const pad = overlayPadding(frame);
    for (const s of [pauseScreen, results, introScreen, freePlayScreen]) confine(s.root, pad);
    menu.layout(last.cssW, last.cssH, insets); // the menu panel sizes itself to the safe area, not the HUD frame
    return frame;
  }

  /** Adventure entry point: the highest unlocked level of the stored seed, or level 1 of a typed seed. */
  // A typed seed starts at level 1 unless ?level= is also typed (device checks on a fixed seed).
  const adventureLevel = (): number => (customSeed ? (levelQuery.level ?? 1) : menuLevel());

  const menu = createMenuScreen(uiRoot, {
    adventure: () => bus.emit('game:start', { mode: 'adventure', levelIndex: adventureLevel() }),
    levels: () => dispatch({ type: 'openLevels' }),
    endless: () => bus.emit('game:start', { mode: 'endless', levelIndex: 1 }),
    freePlay: () => dispatch({ type: 'openFreePlay' }),
    settings: () => dispatch({ type: 'openSettings' }),
    howTo: () => howToScreen.open(0),
  });
  // How to guide: an overlay over the menu (no flow state). Close hides it and the menu shows again.
  const howToScreen = createHowToScreen(uiRoot, { close: () => howToScreen.hide() });
  // R2 Free Play options screen. Start keeps the choice for the session and starts the run; the
  // difficulty picked here also becomes the card's last choice.
  const freePlayScreen = createFreePlayScreen(uiRoot, {
    start: (c) => {
      freePlayChoice = c;
      saveFreePlaySetup({ arena: c.arena, barriers: c.barriers, config: c.config });
      settingsModel.setDifficulty(c.difficulty);
      dispatch({ type: 'start', mode: 'freeplay', levelIndex: 1 });
    },
    back: () => dispatch({ type: 'closeFreePlay' }),
  });
  const levelSelect = createLevelSelect(uiRoot, {
    play: (index) => {
      if (customSeed) {
        customSeed = false; // level select always plays the stored run seed
        runSeed = storedSeed;
      }
      bus.emit('game:start', { mode: 'adventure', levelIndex: index });
    },
    back: () => dispatch({ type: 'closeLevels' }),
    // Story scenes (docs/19): replay what was shown on this level; level select stays underneath.
    replay: (index) => {
      storyLevel = index;
      story.play(replayScenes(loadStorySeen(), index), () => undefined);
    },
  });
  const pauseScreen = createPauseScreen(uiRoot, {
    resume: () => bus.emit('game:resume'),
    restart: () => dispatch({ type: 'restart' }),
    settings: () => dispatch({ type: 'openSettings' }),
    quit: () => bus.emit('game:quit'),
  });
  const results = createResultsScreen(uiRoot, {
    next: () => dispatch({ type: 'next' }),
    retry: () => dispatch({ type: 'retry' }),
    menu: () => dispatch({ type: 'menu' }),
    // R2 par reward: held for the next level's start (a typed seed run saves nothing).
    reward: (bonus, nextLevel) => {
      if (!customSeed) savePendingBonus({ level: nextLevel, bonus });
    },
  }, { capture: gated.capture });
  // Neon goes only through applyNeon; Show FPS and glow path through Glow's exported functions.
  const settingsModel = createSettingsModel({
    setShowFps: captureShowFps(setShowFps, gated.capture), // capture mode: never shown, setting kept
    setGlowPath,
    applyNeon: (n) => {
      try {
        applyNeon(n);
      } catch (err) {
        console.warn('[sow] applyNeon failed', describeError(err));
      }
    },
    setVolume: (v) => audio.setVolume(v),
    setWeaponPickups: (on) => applyWeaponPickups(on),
    setEffectsTier: (tier) => applyEffectsTier(tier),
    setTilt: (level) => setTilt(level),
    setMusicVolume: (v) => {
      setMusicEngineVolume(v); // src/audio/music/index.ts, clamps 0 to 100, 0 is silence
      wireMusicPort(v);
    },
    requestFrame: (cb) => {
      window.requestAnimationFrame(() => cb());
    },
  });
  /** Leave settings back to a running state: the menu, or resume a paused game. */
  const leaveSettings = (): void => {
    dispatch({ type: 'closeSettings' });
    if (flow.screen === 'paused') dispatch({ type: 'quit' });
  };
  const settingsScreen = createSettingsScreen(uiRoot, settingsModel, {
    back: () => dispatch({ type: 'closeSettings' }),
    playSeed: (seed) => {
      leaveSettings();
      runSeed = seed >>> 0;
      customSeed = runSeed !== storedSeed;
      bus.emit('game:start', { mode: 'adventure', levelIndex: 1 });
    },
    seedHash: (seed) => (generator === null ? null : pickLevel(generator, seed, 1, VALID_FIXTURES).hash),
    unlockAll: () => void unlockAllLevels(),
    resetProgress: () => {
      resetProgress();
    },
    stress: () => {
      dispatch({ type: 'closeSettings' });
      requestResume(); // through the bus, so the music resumes with the flow
      window.sowDebug?.stress(400, 2000);
    },
    currentNeon: () => currentNeon,
    buildId: __BUILD_ID__,
    dev: gated.dev,
  });

  // B7: boot "Tap to start" (the fullscreen and audio unlock gesture) and the intro overlay.
  const bootScreen = createBootScreen(uiRoot, () => {
    void unlockGesture();
    dispatch({ type: 'tapStart' });
  });
  // docs/14 item 2: the title splash sits above the boot screen for 1.2 s, a tap skips it.
  createSplashScreen(uiRoot, () => undefined, { after: (ms, cb) => void window.setTimeout(cb, ms) });
  const introScreen = createIntroScreen(
    uiRoot,
    () => {
      // R2: Start leaves the card (Endless shows Ready first).
      intro = startIntro(intro, flow.mode);
      paintIntro();
    },
    (d) => {
      // R2: a chip tap saves the last choice and rebuilds this level or Endless run at the new
      // difficulty (and its space physics). The sim has not stepped while the card holds it, so
      // nothing is lost; the card stays until Start.
      if (flow.screen !== 'playing' || flow.mode === 'freeplay' || intro.kind !== 'card' || !introActive(intro)) return;
      settingsModel.setDifficulty(d);
      if (d !== runDifficulty) startLevel(flow.mode, flow.levelIndex, true);
      paintIntro();
    },
    () => {
      // Ryan 2026-11-10: Return to Menu leaves the card for the main menu without starting the level.
      if (flow.screen !== 'playing' || intro.kind !== 'card' || !introActive(intro)) return;
      intro = NO_INTRO;
      dispatch({ type: 'quit' });
    },
  );
  // Story scenes (docs/19, brief ledger-story-scenes): a full screen overlay above every screen.
  // Level start scenes play over the intro card, which already holds the sim; a boss win's freeing
  // scene plays before the results while the step below is held. Seen scenes and the call sign are
  // device only keys (core/settings.ts).
  let storyLevel = 1;
  const story = createStoryPlayer(uiRoot, {
    emit: (e) => bus.emit('ui:story', e),
    seen: (id) => void recordStorySeen(id, storyLevel),
    loadCallsign: () => loadCallsign(),
    saveCallsign: (name) => void saveCallsign(name),
    seed: () => freshSeed(),
  });
  /** Adventure only: the opening, briefings, combo and guardian intro due before this level. */
  function playStartStory(): void {
    if (flow.mode !== 'adventure' || flow.screen !== 'playing') return;
    const index = flow.levelIndex;
    const foesByLevel = [...earlierLevels(index), level].map((d) => levelFoes(d));
    const ids = levelStartScenes({ mode: flow.mode, levelIndex: index, foesByLevel, boss: level.boss?.id, seen: loadStorySeen() });
    storyLevel = index;
    story.play(ids, () => undefined);
  }
  /** Show the intro card or Ready text while the gate holds a playing sim. */
  function paintIntro(): void {
    if (flow.screen !== 'playing' || !introActive(intro)) {
      introScreen.hide();
      return;
    }
    if (intro.kind === 'ready') introScreen.showReady();
    else if (flow.mode === 'adventure') {
      // R3: the card names the goal, the victory rule, new enemies, the loadout and the seed.
      introScreen.showCard(
        introCard(flow.levelIndex, level, runDifficulty, {
          newFoes: newFoes(level, earlierLevels(flow.levelIndex)),
          seed: `${runSeed}${customSeed ? ' (typed)' : ''}`,
          reward: runBonus === null ? '' : bonusLabel(runBonus),
        }),
      );
    } else introScreen.showCard(endlessIntroCard(level, runDifficulty, { newFoes: levelFoes(level), seed: String(endlessSeed) }));
  }
  /**
   * R3: the levels of this run before `index`, for the new enemy list. Built through pickLevel like
   * the level itself and cached per run seed, so each earlier level is generated once a session.
   */
  const foeCache = new Map<string, FoeSource>();
  function earlierLevels(index: number): FoeSource[] {
    const out: FoeSource[] = [];
    for (let i = 1; i < Math.floor(index); i++) {
      const key = `${runSeed}:${i}`;
      let src = foeCache.get(key);
      if (src === undefined) {
        const def = pickLevel(generator, runSeed, i, VALID_FIXTURES).def;
        src = { roster: def.roster, hazards: def.hazards };
        foeCache.set(key, src);
      }
      out.push(src);
    }
    return out;
  }

  const paintScreens = (): void => {
    for (const s of [bootScreen, menu, howToScreen, levelSelect, freePlayScreen, pauseScreen, results, settingsScreen]) s.hide();
    hud.hide();
    paintIntro();
    switch (flow.screen) {
      case 'boot':
        bootScreen.show();
        break;
      case 'menu': {
        const seedNote = customSeed ? `Seed ${runSeed} (typed)` : `Seed ${runSeed}`;
        menu.setContinue(customSeed ? 'Play typed seed' : continueLabel(menuLevel()));
        menu.setInfo(`Level ${adventureLevel()}  ${seedNote}${generator === null ? '  (fixture levels)' : ''}`);
        menu.setFooter(footerLine(typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : undefined));
        menu.show();
        break;
      }
      case 'levels':
        levelSelect.open(loadUnlocked(), loadAdventureScores(), storyLevels(loadStorySeen()));
        break;
      case 'freeplay':
        freePlayScreen.open({ ...freePlayChoice, difficulty: settingsModel.state.difficulty });
        break;
      case 'playing':
        hud.show();
        break;
      case 'paused':
        hud.show();
        pauseScreen.show();
        break;
      case 'results':
        if (flow.result !== null) results.showResult(flow.result);
        break;
      case 'settings':
        settingsScreen.show();
        break;
    }
  };

  // Wave 6 contract: 'ui:screen' once per change of visible screen (ui/screenEvent.ts).
  const announceScreen = createScreenAnnouncer((screen) => bus.emit('ui:screen', { screen }));

  function dispatch(a: FlowAction): void {
    const prev = flow;
    const next = reduceFlow(prev, a);
    if (next === prev) return;
    flow = next;
    if (next.run !== prev.run) {
      startLevel(next.mode, next.levelIndex);
      playStartStory(); // a no op outside Adventure or when nothing is due
    } else if (next.screen !== prev.screen) syncScene();
    if (!simRunning(next)) renderer?.setSticks([]);
    applyMusicCue(musicCue(prev, next)); // after startLevel, so a start reads the new level's seed
    cues.flow(prev, next); // levelComplete or levelFail on entering results, once
    paintScreens();
    announceScreen(flow);
  }

  /** game:over from the sim (Swarm) or the fallback check below. */
  const onGameOver = (p: { score: number; stars: 0 | 1 | 2 | 3; levelIndex: number; mode: 'adventure' | 'endless' }): void => {
    if (flow.screen !== 'playing' && flow.screen !== 'paused') return;
    if (story.active()) return; // a freeing scene is already holding the results
    emitHud();
    const index = flow.levelIndex;
    const space = spaceForDifficulty(runDifficulty); // B13: the level in effect as the run ends
    const arena = arenaName(level);
    // R5: the labelled Details row on the results (kills, geoms, best multiplier, build).
    const sc = scoreOf(world);
    const stats = {
      kills: sc.kills,
      geoms: sc.geoms,
      peakMultiplier: Math.max(peakMult, sc.multiplier),
      build: shortSha(typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : undefined),
    };
    if (flow.mode === 'freeplay') {
      // R2: Free Play keeps no stars and no bests; the results show score and time.
      const length = freePlayChoice.config.length;
      const won = gameState(world).outcome === 'won'; // a score attack whose clock ran out
      const fp = freePlayResult({ score: p.score, difficulty: runDifficulty, hash: pick.hash, space, timeSec: world.time, arena, length, won });
      dispatch({ type: 'over', result: { ...fp, ...stats, seed: endlessSeed } });
      return;
    }
    if (flow.mode === 'endless') {
      const rec = recordEndlessScore(p.score, Date.now());
      dispatch({
        type: 'over',
        result: {
          mode: 'endless',
          levelIndex: index,
          score: p.score,
          stars: 0,
          success: false,
          difficulty: runDifficulty,
          par: 0,
          best: rec.best,
          newBest: rec.rank === 1,
          hash: pick.hash,
          rank: rec.rank,
          seed: endlessSeed,
          space,
          timeSec: world.time,
          arena,
          ...stats,
        },
      });
      return;
    }
    // R2 P0: the sim's verdict decides (lives out is always a loss); a loss is 0 stars and is not
    // saved, so it can never become a best. A typed seed is a session only run: nothing saved.
    const end = settleAdventure({
      levelIndex: index,
      objective: level.objective,
      snapshot: snapshotOf(world),
      outcome: gameState(world).outcome,
      bossLevel: level.boss !== undefined,
      score: p.score,
      // R6: score stars against the difficulty's targets; the sim's p.stars reads the level's own.
      scoreStars: starsFor(p.score, targets.stars),
      difficulty: runDifficulty,
      sessionOnly: customSeed,
    });
    const success = end.success;
    if (!customSeed && success) unlockLevel(unlockAfter(loadUnlocked(), index, success));
    const result: LevelResult = {
      mode: 'adventure',
      levelIndex: index,
      score: p.score,
      stars: end.stars,
      success,
      difficulty: runDifficulty,
      par: targets.par,
      best: end.best,
      newBest: end.newBest,
      hash: pick.hash,
      space,
      arena,
      starTargets: targets.stars,
      ...stats,
      timeSec: world.time,
      seed: runSeed,
      typedSeed: customSeed,
      bestStars: customSeed ? end.stars : (loadAdventureScores()[String(index)]?.stars ?? 0),
    };
    if (level.boss !== undefined) result.bossName = bossName(level.boss.id);
    if (view.readouts && fightLineText !== '') result.fightLine = fightLineText;
    // The results "Boss defeated" line reports the number the sim paid: scoring.bossBonus, the only copy.
    if (success && bossDown) result.bossBonus = bossBonus(level.par, 'adventure', level.boss?.tier ?? 0);
    // Story: a boss win plays its freeing scene first; progress is already saved above.
    const freed = success ? bossWinScenes('adventure', level.boss?.id, loadStorySeen()) : [];
    storyLevel = index;
    if (story.play(freed, () => dispatch({ type: 'over', result }))) return;
    dispatch({ type: 'over', result });
  };

  bus.on('game:start', (p) => dispatch({ type: 'start', mode: p.mode, levelIndex: p.levelIndex }));
  bus.on('game:pause', () => dispatch({ type: 'pause' }));
  // Android back (Ryan 2026-11-10): pause in a level, previous screen elsewhere, double back on the menu exits. No-op on the web.
  installServiceWorkerCleanup(); // native only: drop a service worker left by an old PWA install
  const menuBack = createDoubleBack(() => performance.now());
  installBackButton(() => {
    const s = flow.screen;
    if (s === 'playing') bus.emit('game:pause');
    else if (s === 'paused') bus.emit('game:resume');
    else if (s === 'levels') dispatch({ type: 'closeLevels' });
    else if (s === 'freeplay') dispatch({ type: 'closeFreePlay' });
    else if (s === 'settings') dispatch({ type: 'closeSettings' });
    else if (s === 'results') dispatch({ type: 'menu' });
    else if (menuBack() === 'exit') return 'exit';
    else menu.setInfo('Press back again to exit');
    return 'handled';
  });
  bus.on('game:resume', () => dispatch({ type: 'resume' }));
  bus.on('game:quit', () => dispatch({ type: 'quit' }));
  bus.on('game:over', onGameOver);

  // 6. Loop. The sim steps only while the flow says playing; render runs on every screen so
  // the arena stays visible behind menus.
  let divisorState: DivisorState = initialDivisorState();
  let aspect = last.cssW / Math.max(1, last.cssH);
  let frameCount = 0;
  const loop: Loop = createLoop({
    step(dt) {
      if (!simRunning(flow)) return;
      // A story scene holds the sim (the level start card holds it too). stepInput still polls, so
      // presses made while a scene is open (Skip is under the pause button) are dropped, not queued.
      const input = stepInput(story.active(), () => (touch !== null ? touch.poll() : idle), idle);
      if (story.active()) return;
      if (input.pause) {
        bus.emit('game:pause');
        return;
      }
      if (introActive(intro)) {
        // B7: the intro card or Ready text holds the sim; presses made now are dropped.
        intro = tickIntro(intro, dt);
        if (!introActive(intro)) paintIntro();
        return;
      }
      stepGame(world, dt, input);
      peakMult = Math.max(peakMult, scoreOf(world).multiplier);
      cues.sim(readSim()); // respawn, superReady, superActivate
      // Fallback end check. On a boss level the sim alone decides a win: it holds for the boss.
      if (endCheck && fallbackStatus(level.objective, snapshotOf(world), level.boss !== undefined) !== 'running') {
        const score = scoreOf(world).score;
        const st = flow.mode === 'adventure' ? starsFor(score, targets.stars) : 0; // R1: the level's own thresholds (v6 is 1, 1.25, 1.5 x par)
        bus.emit('game:over', { score, stars: st, levelIndex: flow.levelIndex, mode: flow.mode === 'adventure' ? 'adventure' : 'endless' });
      }
    },
    render(alpha) {
      if (preview !== null && sceneWorld === preview) {
        const now = performance.now();
        stepPreview(preview, lastPreviewMs > 0 ? (now - lastPreviewMs) / 1000 : 0);
        lastPreviewMs = now;
      }
      if (simRunning(flow)) {
        const now = performance.now();
        if (due(lastHudMs, now)) {
          lastHudMs = now;
          emitHud();
        }
      }
      if (renderer === null) return;
      if (touch !== null && simRunning(flow)) renderer.setSticks(stickCircles(touch.stickVisuals(), gated.capture));
      renderer.draw(sceneWorld, alpha);
      // Glue: renderer.draw() already calls app.render(); a second call doubled GPU cost.
      // Divisor policy (docs/04 section 13), evaluated every 15 rendered frames.
      if (++frameCount % 15 === 0) {
        const s = loop.stats;
        const next = nextDivisor(divisorState, {
          avgWorkMs: s.avgWorkMs,
          avgFrameMs: s.avgFrameMs,
          samples: s.samples,
          aspect,
          bloomOn,
          nowSec: performance.now() / 1000,
        });
        if (next.divisor !== divisorState.divisor) loop.setRenderDivisor(next.divisor);
        divisorState = next;
      }
    },
  });

  const info: DebugInfo = { frame: loop.stats, liveEntities: 0, liveBullets: 0, divisor: 1, bloom: bloomOn };
  setDebugInfoSource(() => {
    info.liveEntities = liveEnemies(world);
    info.liveBullets = world.bullets.liveCount;
    info.divisor = loop.divisor;
    info.bloom = bloomOn;
    return info;
  });
  // The devpanel switches glow paths through renderer.setBloomEnabled; wrap it so the
  // divisor policy and debug info see the current path.
  if (renderer !== null) {
    const r = renderer;
    const original = r.setBloomEnabled.bind(r);
    r.setBloomEnabled = (on: boolean): void => {
      bloomOn = on;
      original(on);
    };
    // Glow's debug panel binds setShowFps and setGlowPath to a live controller. Changes made in
    // the panel are mirrored into the settings model so the glow path persists too.
    // The two finger long press that opens the panel is a developer item: only with ?dev=1, never in capture mode.
    if (view.panel) {
      const panel = installDevPanel({
        renderer: r,
        settings,
        saveSetting,
        frameTimeMs: () => loop.stats.avgFrameMs,
        glowPath: settingsModel.state.glowPath,
      });
      panel.controller.subscribe((s) => {
        settingsModel.syncShowFps(s.showFps);
        if (!query.sprite) settingsModel.syncGlowPath(s.glowPath);
      });
      // The real neon slider lives on the Settings screen now (W3 item 4): ?debug no longer opens
      // Glow's panel and its slider. The panel stays installed for the FPS label it drives.
      panel.close();
    }
  }
  // R1: the iridescent 4th star follows the neon palette; this listener only reads what applyNeon set.
  onNeonChanged((p) => syncFourthStarStyle(p.saturation, p.glowAlpha));
  syncFourthStarStyle(getNeonState().params.saturation, getNeonState().params.glowAlpha);
  // Vector headlines: stroke colour and glow follow the neon state; this listener only reads it.
  onNeonChanged((p) => syncVectorFontStyle(p.saturation, p.glowAlpha));
  syncVectorFontStyle(getNeonState().params.saturation, getNeonState().params.glowAlpha);
  settingsModel.applyBoot(); // applyNeon(stored neon), volume, Show FPS, glow path, space physics, weapon pickups
  installAudio({ volume: settings.volume }); // Glue: Glow's synth listens on the bus; unlock happens on the first gesture
  // V2-D: bus wiring for the music engine, after the audio unlock path is installed. It starts
  // nothing: startMusic runs from applyMusicCue at level start. Fable swaps this for the wireMusic
  // port above once Chorus's layers branch is merged.
  wireMusicPort(settingsModel.state.music);
  if (query.sprite) setGlowPath('fallback'); // ?glow=sprite: session only, not persisted

  window.sowDebug = {
    stress(entities: number, particles = 0): string {
      // The stress scene needs a stepping sim: start a level from the menu, skip the end check.
      endCheck = false;
      if (flow.screen === 'boot') dispatch({ type: 'tapStart' });
      if (flow.screen === 'menu') dispatch({ type: 'start', mode: 'adventure', levelIndex: menuLevel() });
      endCheck = false; // startLevel re-arms the end check; the stress scene keeps it off
      intro = NO_INTRO; // the stress scene skips the intro card
      paintIntro();
      const n = stressEntities(world, Math.max(0, Math.floor(entities)));
      const p = particles > 0 && runParticleStress(Math.floor(particles));
      const msg = `[sow] stress ${n} entities, particles ${particles > 0 ? (p ? particles : 'no hook') : 0}`;
      console.info(msg);
      return msg;
    },
    info: () => getDebugInfo(),
  };
  if (query.stress > 0) window.sowDebug.stress(query.stress, query.particles);

  hud.setLevel(menuLevel(), targets.par, pick.hash);
  hud.setSuper(level.superType);
  paintScreens();
  announceScreen(flow); // the first screen at boot is title
  if (renderer !== null) loop.start();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      requestPause(); // auto pause through the bus (the music hears it too); the player resumes from the pause screen
      loop.stop();
    } else {
      if (renderer !== null) loop.start(); // start() resets the clock: no 50 ms lurch
      scheduleResize(); // the fold may have happened while hidden
    }
  });

  // 7. Resize (docs/04 section 4). Fold and unfold fire resize, orientationchange and
  // visualViewport resize in any order, more than once. Debounce to two animation frames, with
  // a timer fallback because rAF can stall while the display switches, then read once. A
  // settle check re-reads after 400 ms in case the first read caught an intermediate size.
  let applied: Measure | null = null;
  let appliedClass: AspectClass | null = null;
  const applyViewport = (): void => {
    last = measure();
    aspect = last.cssW / Math.max(1, last.cssH);
    const cls = aspectClass(last.cssW, last.cssH);
    renderer?.resize(last.cssW, last.cssH, last.renderDpr);
    const f = relayout();
    const insets = f.insets;
    const fit = { scale: f.fit.scale, x: f.fit.x, y: f.fit.y };
    // Auto pause on aspect class change, that is a fold or unfold (docs/01 section 10).
    if (appliedClass !== null && cls !== appliedClass && resizePauseAllowed(story.active())) requestPause(); // through the bus, so the music suspends
    appliedClass = cls;
    const payload: ViewportInfo = { cssW: last.cssW, cssH: last.cssH, dpr: last.renderDpr, insets, fit };
    bus.emit('viewport:changed', payload);
    console.log(viewportLine(last.cssW, last.cssH, last.dpr));
    console.log(detailLine(last, screen.width, screen.height, orientationType()));
    paintLabel();
    applied = last;
    window.setTimeout(() => {
      if (applied !== null && !sameMeasure(applied, measure())) scheduleResize();
    }, 400);
  };

  let rafA = 0;
  let rafB = 0;
  let timer = 0;
  let pending = false;
  const flush = (): void => {
    if (!pending) return;
    pending = false;
    cancelAnimationFrame(rafA);
    cancelAnimationFrame(rafB);
    window.clearTimeout(timer);
    applyViewport();
  };
  function scheduleResize(): void {
    if (pending) return;
    pending = true;
    rafA = requestAnimationFrame(() => {
      rafB = requestAnimationFrame(flush); // second frame: layout has settled after fold
    });
    timer = window.setTimeout(flush, 250);
  }
  window.addEventListener('resize', scheduleResize);
  window.addEventListener('orientationchange', scheduleResize);
  window.visualViewport?.addEventListener('resize', scheduleResize);
  screen.orientation?.addEventListener('change', scheduleResize);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(scheduleResize).observe(document.documentElement);
  applyViewport(); // first fit now, synchronously, so the first frame is placed correctly

  // Fullscreen needs a user activation; pointerup is the reliable one in Chrome (docs/04 section 6).
  // The same gesture unlocks audio (docs/04 section 12). unlockAudio runs first and synchronously,
  // before any await, so it is still inside the user activation. The boot screen tap (B7) is
  // that gesture; the window listener stays as a fallback when the boot screen is bypassed.
  const onFirstPointerUp = (): void => {
    void unlockGesture();
  };
  window.addEventListener('pointerup', onFirstPointerUp, true);
  // G4 bug U4: a fold or unfold drops Chrome out of fullscreen and the one shot gesture never
  // re-arms. Re-arm on every exit from fullscreen so the next tap requests it again.
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === null && gestureDone) {
      gestureDone = false;
      window.addEventListener('pointerup', onFirstPointerUp, true);
    }
  });
  async function unlockGesture(): Promise<void> {
    if (gestureDone) return;
    gestureDone = true;
    window.removeEventListener('pointerup', onFirstPointerUp, true);
    audio.unlock();
    retryMusic(); // the unlock made the audio context, so a level that began before this tap gets its music now
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch {
      // Denied, unsupported, or already fullscreen via the manifest: ignore.
    }
    try {
      await (screen.orientation as ScreenOrientation & { lock(o: string): Promise<void> }).lock('landscape');
    } catch {
      // Refused (not fullscreen, desktop, or not supported): the game stays playable in portrait.
    }
    scheduleResize();
  }
}

void boot();
