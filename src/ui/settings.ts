// Settings screen (docs/01 section 10, docs/03 sections 7 and 8, SPEC 4). Neon slider 0 to 100
// over a live preview arena, Volume slider, Music slider (v2, 0 is off), Weapon pickups (On, Off;
// v2), Effects (Low, Standard, High; v2), 3D tilt (Off, Low, High; v3), Show FPS,
// Bloom / Fallback, Play seed, Reset progress, and a hidden debug menu behind five taps on the
// version label. The same screen opens from the menu and from the pause screen.
// R2: the Difficulty and Space physics rows are gone. Difficulty is chosen on the card at every
// level start; space physics follows it (core/settings spaceForDifficulty). The model keeps
// `difficulty` as the card's last choice (sow.progress.difficulty), so the card preselects it.
// The model is pure apart from injected effects, so tests drive it with fakes. applyNeon is
// throttled to one call per animation frame while dragging; the value is saved on finger up.
import { DIFFICULTIES, type Difficulty } from '../core/difficulty';
import {
  clampMusic,
  EFFECTS_TIER_SETTINGS,
  loadLastDifficulty,
  loadEffects,
  loadGlowPath,
  loadMusic,
  loadSettings,
  loadTilt,
  loadWeaponPickups,
  parseDifficulty,
  parseEffects,
  parseSeedInput,
  parseTilt,
  saveLastDifficulty,
  saveEffects,
  saveGlowPath,
  saveMusic,
  saveSetting,
  saveTilt,
  saveWeaponPickups,
  SPACE_LEVELS,
  TILT_SETTINGS,
  type EffectsTierSetting,
  type GlowPathSetting,
  type SpaceLevelSetting,
  type StorageLike,
  type TiltSetting,
} from '../core/settings';
import { button, createScreen, el, type Screen } from './dom';
import { createFrameThrottle, createSlider } from './slider';
import { bus } from '../core/events';
import { attachScrollbar } from './scrollbar';

/** Reset progress confirmation (second tap needed) and done texts. The reset clears the story too. */
export const RESET_CONFIRM_TEXT = 'Tap again: clears levels, story and call sign';
export const RESET_DONE_TEXT = 'Progress, story and call sign reset';

export interface SettingsEffects {
  /** Glow's setShowFps from src/render/devpanel.ts. */
  setShowFps(on: boolean): void;
  /** Glow's setGlowPath from src/render/devpanel.ts. */
  setGlowPath(p: GlowPathSetting): void;
  /** applyNeon from src/render/neon.ts, the only place the neon value takes effect. */
  applyNeon(n: number): void;
  /** Master volume 0 to 100 (Glow's synth when merged, else a no-op). */
  setVolume(v: number): void;
  /**
   * Weapon pickups on or off (v2). Called at boot, then once per change. Fable glue maps it to
   * Swarm's setWeaponPickups(world, on); until then main.ts leaves it a no-op.
   */
  setWeaponPickups(on: boolean): void;
  /**
   * Effects tier (v2). Called at boot, then once per change. Fable glue maps it to Glow's tier
   * export; until then main.ts leaves it a no-op.
   */
  setEffectsTier(tier: EffectsTierSetting): void;
  /**
   * 3D tilt level (v3). Called at boot, then once per change. main.ts maps it to Glow's setTilt
   * from src/render/tilt.ts.
   */
  setTilt(level: TiltSetting): void;
  /**
   * Music volume 0 to 100, 0 is off (v2). Called at boot, then once per distinct value while the
   * slider drags, so the level is audible as it moves. main.ts feeds src/audio/music/index.ts and
   * the named wireMusic port.
   */
  setMusicVolume(v: number): void;
  /** requestAnimationFrame, injected for tests. */
  requestFrame(cb: () => void): void;
}

export interface SettingsView {
  neon: number;
  volume: number;
  showFps: boolean;
  glowPath: GlowPathSetting;
  weaponPickups: boolean;
  effects: EffectsTierSetting;
  tilt: TiltSetting;
  /** R2: the last difficulty chosen on a card (sow.progress.difficulty); the card preselects it. */
  difficulty: Difficulty;
  /** Music volume 0 to 100, 0 is off. */
  music: number;
}

export interface SettingsModel {
  readonly state: Readonly<SettingsView>;
  /** Push the stored values into the renderer and synth. Call once at boot. */
  applyBoot(): void;
  /** Slider drag: state now, applyNeon on the next frame (latest value wins). */
  neonInput(n: number): void;
  /** Finger up: apply any queued value now and persist sow.settings.neon. */
  neonCommit(n: number): void;
  volumeInput(v: number): void;
  volumeCommit(v: number): void;
  setShowFps(on: boolean): void;
  setGlowPath(p: GlowPathSetting): void;
  /** Row tap: persist sow.settings.weaponPickups and call the effect once. Same value: no effect call. */
  setWeaponPickups(on: boolean): void;
  /** Row tap: persist sow.settings.effects and call the effect once. Same tier: no effect call. */
  setEffectsTier(tier: EffectsTierSetting): void;
  /** Row tap: persist sow.settings.tilt and call the effect once. Same level: no effect call. */
  setTilt(level: TiltSetting): void;
  /** Card tap (R2): persist sow.progress.difficulty. No effect call: main.ts reads state.difficulty when a level starts. */
  setDifficulty(d: Difficulty): void;
  /** Slider drag: state now, and the effect once per distinct value. Nothing is saved yet. */
  musicInput(v: number): void;
  /** Finger up: persist sow.settings.music. The effect is not called again for an unchanged value. */
  musicCommit(v: number): void;
  toggleShowFps(): void;
  toggleGlowPath(): void;
  /** Record a glow change made elsewhere (the debug panel) without calling the renderer again. */
  syncGlowPath(p: GlowPathSetting): void;
  /** Record a Show FPS change made in the debug panel (which already persisted it). */
  syncShowFps(on: boolean): void;
  /** Record a neon value applied elsewhere (the debug panel), so the slider shows it. */
  syncNeon(n: number): void;
}

function clamp100(n: number): number {
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}

/** `storage` defaults to localStorage with an in memory fallback (core/settings). */
export function createSettingsModel(fx: SettingsEffects, storage?: StorageLike | null): SettingsModel {
  const loaded = loadSettings(storage);
  const state: SettingsView = {
    neon: loaded.neon,
    volume: loaded.volume,
    showFps: loaded.showFps,
    glowPath: loadGlowPath(storage),
    weaponPickups: loadWeaponPickups(storage),
    effects: loadEffects(storage),
    tilt: loadTilt(storage),
    difficulty: loadLastDifficulty(storage),
    music: loadMusic(storage),
  };
  /** The music value the effect last received, so a finger up never repeats it. */
  let musicApplied = state.music;
  const neonThrottle = createFrameThrottle<number>((n) => fx.applyNeon(n), (cb) => fx.requestFrame(cb));
  const model: SettingsModel = {
    state,
    applyBoot() {
      fx.applyNeon(state.neon);
      fx.setVolume(state.volume);
      fx.setShowFps(state.showFps);
      fx.setGlowPath(state.glowPath);
      fx.setWeaponPickups(state.weaponPickups);
      fx.setEffectsTier(state.effects);
      fx.setTilt(state.tilt);
      musicApplied = state.music;
      fx.setMusicVolume(state.music);
    },
    neonInput(n) {
      state.neon = clamp100(n);
      neonThrottle.push(state.neon);
    },
    neonCommit(n) {
      state.neon = clamp100(n);
      neonThrottle.push(state.neon);
      neonThrottle.flush();
      saveSetting('neon', state.neon, storage);
    },
    volumeInput(v) {
      state.volume = clamp100(v);
      fx.setVolume(state.volume);
    },
    volumeCommit(v) {
      model.volumeInput(v);
      saveSetting('volume', state.volume, storage);
    },
    setShowFps(on) {
      state.showFps = on;
      saveSetting('showFps', on, storage);
      fx.setShowFps(on);
    },
    setGlowPath(p) {
      state.glowPath = p;
      saveGlowPath(p, storage);
      fx.setGlowPath(p);
    },
    setWeaponPickups(on) {
      const changed = on !== state.weaponPickups;
      state.weaponPickups = on;
      saveWeaponPickups(on, storage); // always written, so a failed earlier write heals on the next tap
      if (changed) fx.setWeaponPickups(on);
    },
    setEffectsTier(tier) {
      const next = parseEffects(tier);
      const changed = next !== state.effects;
      state.effects = next;
      saveEffects(next, storage); // always written, so a failed earlier write heals on the next tap
      if (changed) fx.setEffectsTier(next);
    },
    setTilt(level) {
      const next = parseTilt(level);
      const changed = next !== state.tilt;
      state.tilt = next;
      saveTilt(next, storage); // always written, so a failed earlier write heals on the next tap
      if (changed) fx.setTilt(next);
    },
    setDifficulty(d) {
      state.difficulty = parseDifficulty(d);
      saveLastDifficulty(state.difficulty, storage);
    },
    musicInput(v) {
      state.music = clampMusic(v);
      if (state.music === musicApplied) return;
      musicApplied = state.music;
      fx.setMusicVolume(state.music);
    },
    musicCommit(v) {
      model.musicInput(v);
      saveMusic(state.music, storage);
    },
    toggleShowFps() {
      model.setShowFps(!state.showFps);
    },
    toggleGlowPath() {
      model.setGlowPath(state.glowPath === 'bloom' ? 'fallback' : 'bloom');
    },
    syncGlowPath(p) {
      if (p === state.glowPath) return;
      state.glowPath = p;
      saveGlowPath(p, storage);
    },
    syncShowFps(on) {
      state.showFps = on;
    },
    syncNeon(n) {
      state.neon = clamp100(n);
    },
  };
  return model;
}

/** Pure: button labels. */
export function fpsLabel(on: boolean): string {
  return `Show FPS: ${on ? 'On' : 'Off'}`;
}

export function glowLabel(p: GlowPathSetting): string {
  return `Glow: ${p === 'bloom' ? 'Bloom' : 'Fallback'}`;
}

export const SPACE_ROW_LABEL = 'Space physics';

const SPACE_LABELS: Readonly<Record<SpaceLevelSetting, string>> = {
  off: 'Off',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** Pure: the text on one Space physics button. */
export function spaceLabel(level: SpaceLevelSetting): string {
  return SPACE_LABELS[level];
}

export interface SpaceButtonState {
  level: SpaceLevelSetting;
  label: string;
  selected: boolean;
}

/** Pure: the four Space physics buttons in order, with the current choice marked. */
export function spaceButtonStates(current: SpaceLevelSetting): SpaceButtonState[] {
  return SPACE_LEVELS.map((level) => ({ level, label: spaceLabel(level), selected: level === current }));
}

export const WEAPON_ROW_LABEL = 'Weapon pickups';

/** Pure: the text on one Weapon pickups button. */
export function weaponPickupsLabel(on: boolean): string {
  return on ? 'On' : 'Off';
}

export interface WeaponButtonState {
  on: boolean;
  label: string;
  selected: boolean;
}

/** Pure: the two Weapon pickups buttons (On, then Off) with the current choice marked. */
export function weaponButtonStates(current: boolean): WeaponButtonState[] {
  return [true, false].map((on) => ({ on, label: weaponPickupsLabel(on), selected: on === current }));
}

export const EFFECTS_ROW_LABEL = 'Effects';

const EFFECTS_LABELS: Readonly<Record<EffectsTierSetting, string>> = {
  low: 'Low',
  standard: 'Standard',
  high: 'High',
};

/** Pure: the text on one Effects button. */
export function effectsLabel(tier: EffectsTierSetting): string {
  return EFFECTS_LABELS[tier];
}

export interface EffectsButtonState {
  tier: EffectsTierSetting;
  label: string;
  selected: boolean;
}

/** Pure: the three Effects buttons in order (Low, Standard, High) with the current tier marked. */
export function effectsButtonStates(current: EffectsTierSetting): EffectsButtonState[] {
  return EFFECTS_TIER_SETTINGS.map((tier) => ({ tier, label: effectsLabel(tier), selected: tier === current }));
}

export const DIFFICULTY_ROW_LABEL = 'Difficulty';

const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  insane: 'Insane',
};

/** Pure: the text on one Difficulty button, also used on the intro card. */
export function difficultyLabel(d: Difficulty): string {
  return DIFFICULTY_LABELS[d];
}

export interface DifficultyButtonState {
  difficulty: Difficulty;
  label: string;
  selected: boolean;
}

/** Pure: the four Difficulty buttons in order (Easy, Normal, Hard, Insane) with the current one marked. */
export function difficultyButtonStates(current: Difficulty): DifficultyButtonState[] {
  return DIFFICULTIES.map((difficulty) => ({ difficulty, label: difficultyLabel(difficulty), selected: difficulty === current }));
}

export const TILT_ROW_LABEL = '3D tilt';

const TILT_LABELS: Readonly<Record<TiltSetting, string>> = {
  off: 'Off',
  low: 'Low',
  high: 'High',
};

/** Pure: the text on one 3D tilt button. */
export function tiltLabel(level: TiltSetting): string {
  return TILT_LABELS[level];
}

export interface TiltButtonState {
  level: TiltSetting;
  label: string;
  selected: boolean;
}

/** Pure: the three 3D tilt buttons in order (Off, Low, High) with the current level marked. */
export function tiltButtonStates(current: TiltSetting): TiltButtonState[] {
  return TILT_SETTINGS.map((level) => ({ level, label: tiltLabel(level), selected: level === current }));
}

export const MUSIC_SLIDER_LABEL = 'Music';

/**
 * Pure: count taps on the version label. Keeps taps inside the window; fires (and clears) when
 * `need` taps land within `windowMs`.
 */
export function registerTap(
  taps: readonly number[],
  now: number,
  need = 5,
  windowMs = 3000,
): { taps: number[]; fire: boolean } {
  const kept = taps.filter((t) => now - t < windowMs && t <= now);
  kept.push(now);
  return kept.length >= need ? { taps: [], fire: true } : { taps: kept, fire: false };
}

/** Pure: two tap confirm. A second tap within `windowMs` of the first fires. */
export function confirmTap(armedAt: number | null, now: number, windowMs = 3000): { armedAt: number | null; fire: boolean } {
  if (armedAt !== null && now - armedAt < windowMs && now >= armedAt) return { armedAt: null, fire: true };
  return { armedAt: now, fire: false };
}

/** Pure: the line under the seed field. */
export function seedHashLine(text: string, hashOf: (seed: number) => string | null): string {
  if (text.trim() === '') return 'Type a run seed (0 to 4294967295)';
  const seed = parseSeedInput(text);
  if (seed === null) return 'Not a valid seed';
  const h = hashOf(seed);
  return h === null ? `Seed ${seed}` : `Seed ${seed}  Level 1 #${h}`;
}

export const STRESS_LABEL = 'Stress: 400 entities, 2000 particles';

export interface SettingsActions {
  back(): void;
  /** Start Adventure level 1 with a typed run seed. */
  playSeed(seed: number): void;
  /** Level 1 hash for a seed, or null when no generator is present. */
  seedHash(seed: number): string | null;
  resetProgress(): void;
  /** window.sowDebug.stress(400, 2000). */
  stress(): void;
  /** Current neon value, read when the screen opens (the debug panel may have moved it). */
  currentNeon(): number;
  buildId: string;
}

export interface SettingsScreen extends Screen {
  refresh(): void;
}

/** DOM edge. The screen is see through: the panel sits left and the preview arena shows right. */
export function createSettingsScreen(parent: HTMLElement, model: SettingsModel, a: SettingsActions): SettingsScreen {
  const s = createScreen(parent);
  s.root.classList.add('sow-see');
  const panel = el('div', 'sow-panel');
  const title = el('div', 'sow-title', 'Settings');
  const neon = createSlider({
    label: 'Neon',
    min: 0,
    max: 100,
    value: model.state.neon,
    onInput: (v) => model.neonInput(v),
    onCommit: (v) => model.neonCommit(v),
  });
  const volume = createSlider({
    label: 'Volume',
    min: 0,
    max: 100,
    value: model.state.volume,
    onInput: (v) => model.volumeInput(v),
    onCommit: (v) => model.volumeCommit(v),
  });
  const music = createSlider({
    label: MUSIC_SLIDER_LABEL,
    min: 0,
    max: 100,
    value: model.state.music,
    onInput: (v) => model.musicInput(v),
    onCommit: (v) => model.musicCommit(v),
  });

  const fps = button('', () => {
    model.toggleShowFps();
    refresh();
  });
  const glow = button('', () => {
    model.toggleGlowPath();
    refresh();
  });
  const toggles = el('div', 'sow-row');
  toggles.append(fps, glow);


  // Weapon pickups: label with On and Off buttons on one line (the cover screen is short), selected one lit.
  const weaponRow = el('div', 'sow-choice');
  weaponRow.setAttribute('role', 'group');
  weaponRow.setAttribute('aria-label', WEAPON_ROW_LABEL);
  const weaponButtons = [true, false].map((on) =>
    button(weaponPickupsLabel(on), () => {
      model.setWeaponPickups(on);
      refresh();
    }),
  );
  const weaponBtns = el('div', 'sow-choice-btns');
  weaponBtns.append(...weaponButtons);
  weaponRow.append(el('div', 'sow-choice-label', WEAPON_ROW_LABEL), weaponBtns);

  // Effects: label with Low, Standard and High buttons, the same row shape again.
  const effectsRow = el('div', 'sow-choice');
  effectsRow.setAttribute('role', 'group');
  effectsRow.setAttribute('aria-label', EFFECTS_ROW_LABEL);
  const effectsButtons = EFFECTS_TIER_SETTINGS.map((tier) =>
    button(effectsLabel(tier), () => {
      model.setEffectsTier(tier);
      refresh();
    }),
  );
  const effectsBtns = el('div', 'sow-choice-btns');
  effectsBtns.append(...effectsButtons);
  effectsRow.append(el('div', 'sow-choice-label', EFFECTS_ROW_LABEL), effectsBtns);

  // 3D tilt: label with Off, Low and High buttons, the same row shape as Effects.
  const tiltRow = el('div', 'sow-choice');
  tiltRow.setAttribute('role', 'group');
  tiltRow.setAttribute('aria-label', TILT_ROW_LABEL);
  const tiltButtons = TILT_SETTINGS.map((level) =>
    button(tiltLabel(level), () => {
      model.setTilt(level);
      refresh();
    }),
  );
  const tiltBtns = el('div', 'sow-choice-btns');
  tiltBtns.append(...tiltButtons);
  tiltRow.append(el('div', 'sow-choice-label', TILT_ROW_LABEL), tiltBtns);


  const seedField = el('input', 'sow-input');
  seedField.type = 'text';
  seedField.inputMode = 'numeric';
  seedField.autocomplete = 'off';
  seedField.placeholder = 'Run seed';
  seedField.maxLength = 10;
  const seedLine = el('div', 'sow-small', '');
  const paintSeed = (): void => {
    seedLine.textContent = seedHashLine(seedField.value, a.seedHash);
  };
  seedField.addEventListener('input', paintSeed);
  const play = button('Play seed', () => {
    const seed = parseSeedInput(seedField.value);
    if (seed === null) {
      paintSeed();
      return;
    }
    seedField.blur();
    a.playSeed(seed);
  });
  const seedRow = el('div', 'sow-row');
  seedRow.append(seedField, play);

  // Ryan 2026-11-10: Reset progress also clears the story and the call sign, and says so.
  let resetArmed: number | null = null;
  const reset = button('Reset progress', () => {
    const r = confirmTap(resetArmed, performance.now());
    resetArmed = r.armedAt;
    if (r.fire) {
      a.resetProgress();
      reset.textContent = RESET_DONE_TEXT;
    } else {
      reset.textContent = RESET_CONFIRM_TEXT;
    }
  });
  const back = button('Back', () => {
    seedField.blur();
    a.back();
  });
  const bottom = el('div', 'sow-row');
  bottom.append(reset, back);

  const debugRow = el('div', 'sow-row');
  debugRow.append(button(STRESS_LABEL, a.stress));
  debugRow.style.display = 'none';
  const version = el('div', 'sow-small', `build ${a.buildId}`);
  version.style.alignSelf = 'flex-end';
  version.style.padding = '4px 0 0 12px';
  let taps: number[] = [];
  version.addEventListener('pointerup', () => {
    const r = registerTap(taps, performance.now());
    taps = r.taps;
    if (r.fire) debugRow.style.display = debugRow.style.display === 'none' ? '' : 'none';
  });

  panel.append(title, neon.root, volume.root, music.root, weaponRow, effectsRow, tiltRow, toggles, seedRow, seedLine, bottom, debugRow, version);
  s.root.append(panel);
  attachScrollbar(panel, bus);

  function refresh(): void {
    neon.set(model.state.neon);
    volume.set(model.state.volume);
    music.set(model.state.music);
    fps.textContent = fpsLabel(model.state.showFps);
    glow.textContent = glowLabel(model.state.glowPath);
    weaponButtonStates(model.state.weaponPickups).forEach((st, i) => {
      const b = weaponButtons[i];
      if (b === undefined) return;
      b.classList.toggle('sow-on', st.selected);
      b.setAttribute('aria-pressed', st.selected ? 'true' : 'false');
    });
    effectsButtonStates(model.state.effects).forEach((st, i) => {
      const b = effectsButtons[i];
      if (b === undefined) return;
      b.classList.toggle('sow-on', st.selected);
      b.setAttribute('aria-pressed', st.selected ? 'true' : 'false');
    });
    tiltButtonStates(model.state.tilt).forEach((st, i) => {
      const b = tiltButtons[i];
      if (b === undefined) return;
      b.classList.toggle('sow-on', st.selected);
      b.setAttribute('aria-pressed', st.selected ? 'true' : 'false');
    });
  }
  refresh();
  paintSeed();
  return {
    ...s,
    show() {
      model.syncNeon(a.currentNeon());
      resetArmed = null;
      reset.textContent = 'Reset progress';
      refresh();
      paintSeed();
      s.show();
    },
    refresh,
  };
}
