// HUD (docs/01 section 9). DOM overlay anchored to screen edges plus safe area insets, never to
// the arena. Numbers come from 'hud:score' (main.ts emits it at most every 100 ms); objective
// progress and the level line are set directly by main.ts at the same cadence. The weapon
// indicator (V2-B) comes from 'hud:weapon' and is throttled here to the same 100 ms. The boss bar
// (V3-A) comes from 'hud:boss' with the same throttle, appears on 'sim:bossEnter' and goes on
// 'sim:bossDown'. Like the rest of the HUD it is plain divs inside a pointer-events: none root.
// GW1: a drone indicator beside the weapon indicator ('fx:droneArm', 'hud:droneWeapon',
// 'fx:droneExpire') and a combine flash with a "combined" caption on the weapon indicator
// ('fx:weaponCombine'), both driven by the pure state machine in indicator.ts.
// thumbs-button-look: the bomb and super buttons are arcade discs (fill, neon rim, a ring of pixel
// cells, alphas from src/input/buttonLook.ts) in their palette colours at the saturation applyNeon
// last set, read through onNeonChanged. One pixel font label sits above each.
// hud-clock: the level clock in the pixel font inside a neon frame, in its own HUD box. main.ts
// feeds it a ClockView (objective.ts) at the hud:score cadence and asks for a pulse with each
// 'ui:timeWarn'. Colours are palette tones at the neon state applyNeon last set.
import type { Bus, Events, WeaponKind } from '../core/events';
import { pixelRing, RIM_W, superPaint, buttonPaint, type ButtonPaint } from '../input/buttonLook';
import type { Insets, Rect } from '../input/types';
import type { BossId, SuperKind } from '../levelgen/leveldef';
import {
  BANNER_TOTAL_SEC,
  bannerAdvance,
  bannerAlpha,
  BOSS_GATE_START,
  BOSS_MAX_PIPS,
  bossBannerText,
  bossColour,
  bossFill,
  bossGate,
  bossView,
  enterPayload,
  type BossGate,
  type HudBoss,
  type PipState,
} from './boss';
import { el } from './dom';
import {
  combineView,
  droneView,
  flashGlow,
  INDICATOR_START,
  reduceIndicator,
  type IndicatorEvent,
  type IndicatorState,
} from './indicator';
import { formatInt, iconRun } from './format';
import { aspectClass, BOMB_TEXT, SUPER_READY_TEXT, superText, type AspectClass, type HudBox, type HudFrame } from './hudFrame';
import { CLOCK_PULSE_MS, type ClockSize, type ClockView, type ObjectiveProgress } from './objective';
import { getNeonState, onNeonChanged, type NeonParams, type PaletteKey } from '../render/neon';
import { cellPx as cellPxOf, glowBlur, pixelBox, setVectorText, toneColour, VECTOR_TONES } from './vectorFont';
import { weaponHue } from './weaponHue';

export { aspectClass, type AspectClass };
export { BOSS_NAMES, BOSS_TIER } from './boss';

export interface HudLayout {
  band: number;
  score: { x: number; y: number; size: number };
  mult: { x: number; y: number; size: number };
  objective: { y: number; w: number; h: number; size: number };
  par: { y: number; size: number };
  lives: { x: number; y: number; size: number };
  bombs: { x: number; y: number; size: number };
  bombD: number;
  superD: number;
  pauseIcon: number;
}

const COVER: HudLayout = {
  band: 52,
  score: { x: 16, y: 8, size: 20 },
  mult: { x: 16, y: 30, size: 14 },
  objective: { y: 8, w: 220, h: 16, size: 12 },
  par: { y: 28, size: 12 },
  lives: { x: 64, y: 8, size: 12 },
  bombs: { x: 64, y: 26, size: 10 },
  bombD: 64,
  superD: 56,
  pauseIcon: 20,
};

const MAIN: HudLayout = {
  band: 76,
  score: { x: 24, y: 12, size: 28 },
  mult: { x: 24, y: 44, size: 18 },
  objective: { y: 12, w: 320, h: 20, size: 14 },
  par: { y: 40, size: 14 },
  lives: { x: 80, y: 12, size: 16 },
  bombs: { x: 80, y: 36, size: 14 },
  bombD: 72,
  superD: 64,
  pauseIcon: 24,
};

/** Pure: element offsets in CSS px from docs/01 tables 9.1 and 9.2. */
export function hudLayout(c: AspectClass): HudLayout {
  return c === 'cover' ? COVER : MAIN;
}

/**
 * Pure: legacy top band play rect from the docs/01 section 9 tables. main.ts now uses hudFrame,
 * which also keeps the side and bottom HUD elements clear of the arena (B6).
 */
export function playRect(cssW: number, cssH: number, ins: Insets, c: AspectClass): Rect {
  const band = hudLayout(c).band;
  return {
    x: ins.left,
    y: ins.top + band,
    w: Math.max(1, cssW - ins.left - ins.right),
    h: Math.max(1, cssH - ins.top - ins.bottom - band),
  };
}

export type HudScore = Events['hud:score'];

export interface HudText {
  score: string;
  mult: string;
  lives: string;
  bombs: string;
  bombCount: string;
  /** 0 to 1. */
  charge: number;
}

export const LIFE_ICON = '▲';
export const BOMB_ICON = '●';
/** Free Play infinite lives: the life icon and an infinity sign. */
export const INFINITE_LIVES_TEXT = `${LIFE_ICON} \u221e`;

/**
 * Pure: display strings for a hud:score payload. `infiniteLives` (a Free Play run with infinite
 * lives) shows the infinity sign; so does a positive non finite lives count from the sim.
 */
export function hudText(p: HudScore, infiniteLives = false): HudText {
  const charge = Number.isFinite(p.superCharge) ? Math.max(0, Math.min(1, p.superCharge)) : 0;
  return {
    score: formatInt(p.score),
    mult: `x${formatInt(p.multiplier)}`,
    lives: infiniteLives || (p.lives > 0 && !Number.isFinite(p.lives)) ? INFINITE_LIVES_TEXT : iconRun(LIFE_ICON, p.lives),
    bombs: iconRun(BOMB_ICON, p.bombs),
    bombCount: String(Math.max(0, Math.floor(p.bombs))),
    charge,
  };
}

/** Pure: true when at least `intervalMs` passed since `lastMs` (hud:score throttle). */
export function due(lastMs: number, nowMs: number, intervalMs = 100): boolean {
  return nowMs - lastMs >= intervalMs;
}

export type HudWeapon = Events['hud:weapon'];

/** What the weapon indicator shows for one hud:weapon payload. */
export interface WeaponView {
  /** False while the weapon is spread (the default) or the payload cannot be drawn. */
  visible: boolean;
  label: string;
  /** Time left as 0 to 1: remaining over total, clamped. 1 on pickup, 0 when out. */
  fraction: number;
}

export const WEAPON_NAMES: Readonly<Record<WeaponKind, string>> = {
  spread: 'SPREAD',
  rapid: 'RAPID',
  pierce: 'PIERCE',
  orbit: 'ORBIT',
  // V3 contract stubs: the names Ryan kept (docs/13). Ledger replaces these with COMBO_NAMES in wave D.
  'spread+rapid': 'HAIL',
  'spread+pierce': 'TRIDENT',
  'spread+orbit': 'HALO',
  'rapid+pierce': 'NEEDLE',
  'rapid+orbit': 'WHIRL',
  'pierce+orbit': 'ECLIPSE',
};

/** Pure: CSS colour for a weapon's label and bar. The hue comes from weaponHue (B14). */
export function weaponColour(kind: WeaponKind): string {
  return `hsl(${weaponHue(kind)}, 95%, 68%)`;
}

/**
 * Pure: indicator state for a hud:weapon payload. Hidden while the weapon is spread. A non-finite
 * remaining or total, or a total of 0 or less, hides it too (there is no bar to draw). The bar
 * drains from full at pickup to empty at expiry.
 */
export function weaponView(p: HudWeapon): WeaponView {
  const drawable = Number.isFinite(p.remaining) && Number.isFinite(p.total) && p.total > 0;
  const fraction = drawable ? Math.max(0, Math.min(1, p.remaining / p.total)) : 0;
  return { visible: drawable && p.kind !== 'spread', label: WEAPON_NAMES[p.kind], fraction };
}

/** Throttle memory for hud:weapon: when it last drew and which weapon that was. */
export interface WeaponGate {
  lastMs: number;
  kind: WeaponKind;
}

export const WEAPON_GATE_START: Readonly<WeaponGate> = { lastMs: Number.NEGATIVE_INFINITY, kind: 'spread' };

/**
 * Pure: should this hud:weapon payload be drawn now? At most every `intervalMs` (100, like
 * hud:score), except that a change of weapon always draws. Otherwise a throttled change to
 * spread, the last event of a weapon's life, would leave a stale indicator up. A skipped payload
 * leaves the gate as it was.
 */
export function weaponGate(
  g: Readonly<WeaponGate>,
  p: HudWeapon,
  nowMs: number,
  intervalMs = 100,
): { gate: WeaponGate; draw: boolean } {
  const draw = p.kind !== g.kind || due(g.lastMs, nowMs, intervalMs);
  return { gate: draw ? { lastMs: nowMs, kind: p.kind } : { ...g }, draw };
}

/** Pure: the label over the super button, for example "HOMING" ("BOOM" for Detonate on main). */
export function superLabel(kind: SuperKind, cls: AspectClass = 'cover', ready = false): string {
  return ready ? SUPER_READY_TEXT : superText(kind, cls);
}

/** Palette keys of the two buttons: the bomb colour and the yellow the super ring always had. */
export const BOMB_KEY: PaletteKey = 'bomb';
export const SUPER_KEY: PaletteKey = 'yellow';
/** Colour of the rising charge fill of the super, contrasting with the yellow rest fill. */
export const SUPER_CHARGE_KEY: PaletteKey = 'cyan';
/** Repaint period of a full super's pulse, in ms. */
export const PULSE_REPAINT_MS = 50;

/** CSS for one button disc: fill (rising from the bottom while a super charges), rim and glow. */
export interface DiscStyle {
  border: string;
  background: string;
  boxShadow: string;
  cells: string;
}

/**
 * Pure: the disc CSS for a paint, a palette key and the neon state. `sweep` is the charged part of
 * a super as a fraction from 0 to 1, drawn from the bottom in `chargeKey`; the rest of the disc
 * uses the paint's rest alpha in `key`.
 */
export function discStyle(p: ButtonPaint, key: PaletteKey, neon: Pick<NeonParams, 'saturation' | 'glowAlpha'>, level = 1, chargeKey: PaletteKey = key): DiscStyle {
  const c = (a: number): string => toneColour(key, neon.saturation, a);
  const cc = (a: number): string => toneColour(chargeKey, neon.saturation, a);
  const pct = Math.round(Math.max(0, Math.min(1, level)) * 1000) / 10;
  const background = p.fill === p.rest || pct >= 100 ? c(p.fill) : `linear-gradient(to top, ${cc(p.fill)} ${pct}%, ${c(p.rest)} ${pct}%)`;
  const blur = glowBlur(neon.glowAlpha) * p.glow;
  return {
    border: `${RIM_W}px solid ${c(p.rim)}`,
    background,
    boxShadow: `0 0 ${blur}px ${c(0.8 * p.rim)}, inset 0 0 ${blur}px ${c(0.3 * p.rim)}`,
    cells: c(p.cells),
  };
}

/** Host font size of the clock digits per size: 2, 3 and 4 px pixel font cells. */
export const CLOCK_FONT: Readonly<Record<ClockSize, number>> = { small: 20, normal: 30, large: 40 };
/** Clock frame border and padding in CSS px (the frame is border-box around the digits). */
export const CLOCK_BORDER = 2;
export const CLOCK_PAD_X = 6;
export const CLOCK_PAD_Y = 2;
/** Scale of the clock at the top of a pulse. */
export const CLOCK_PULSE_SCALE = 1.18;

/** CSS for the clock frame and digits. */
export interface ClockStyle {
  fontPx: number;
  border: string;
  boxShadow: string;
  background: string;
}

/**
 * Pure: the clock frame CSS for a view and the neon state. The frame takes the digits' tone at the
 * current saturation and glows by the current glow alpha; time played gets a fainter frame. A pulse
 * doubles the glow.
 */
export function clockStyle(v: Pick<ClockView, 'tone' | 'size' | 'mode'>, neon: Pick<NeonParams, 'saturation' | 'glowAlpha'>, pulse = false): ClockStyle {
  const k = VECTOR_TONES[v.tone];
  const faint = v.mode === 'elapsed';
  const blur = glowBlur(neon.glowAlpha) * (pulse ? 2 : 1) * (faint ? 0.6 : 1);
  return {
    fontPx: CLOCK_FONT[v.size],
    border: `${CLOCK_BORDER}px solid ${toneColour(k.fill, neon.saturation, faint ? 0.45 : 0.95)}`,
    boxShadow: `0 0 ${Math.round(blur * 10) / 10}px ${toneColour(k.glow, neon.saturation, faint ? 0.35 : 0.8)}`,
    background: 'rgba(2, 4, 12, 0.6)',
  };
}

/** Pure: the drawn frame size in CSS px for a clock text and size (pixel digits, padding, border). */
export function clockFramePx(text: string, size: ClockSize): { w: number; h: number } {
  const cell = cellPxOf(CLOCK_FONT[size]);
  const box = pixelBox(text);
  return { w: box.wCells * cell + 2 * (CLOCK_PAD_X + CLOCK_BORDER), h: box.hCells * cell + 2 * (CLOCK_PAD_Y + CLOCK_BORDER) };
}

/** Pure: "L3  Par 1,000", plus "  #abcd1234" only when showCode (the ?dev=1 build). */
export function levelLine(levelIndex: number, par: number, hash: string, showCode = false): string {
  return showCode ? `L${levelIndex}  Par ${formatInt(par)}  #${hash}` : `L${levelIndex}  Par ${formatInt(par)}`;
}

export interface Hud {
  show(): void;
  hide(): void;
  update(p: HudScore): void;
  setLevel(levelIndex: number, par: number, hash: string): void;
  /** Show the level code on the level line (?dev=1 only). Off by default. */
  setDevCode(on: boolean): void;
  /** Free text in the level line slot (Endless seed and clock). */
  setLine(text: string): void;
  /** Free Play infinite lives: the lives slot shows the infinity sign until set off. */
  setInfiniteLives(on: boolean): void;
  setObjective(p: ObjectiveProgress): void;
  /** hud-clock: draw the level clock (CLOCK_HIDDEN hides it). `pulse` starts one warning pulse. */
  setClock(v: ClockView, pulse?: boolean): void;
  /** Super kind for the label over the super button. */
  setSuper(kind: SuperKind): void;
  /** Pressed look: true while a finger holds that button (TouchHandle.buttonVisuals().held). */
  setHeld(bomb: boolean, superHeld: boolean): void;
  /** Draw the weapon indicator for a hud:weapon payload now, with no throttle. */
  setWeapon(p: HudWeapon): void;
  /** Hide the weapon indicator and forget the throttle: a new world starts on spread. */
  clearWeapon(): void;
  /** Feed the drone and combine indicator one event and repaint it now. listen() calls it from the bus. */
  indicate(e: IndicatorEvent): void;
  /** Advance the indicator clock to now (capped per call). listen() calls it on every hud:score. */
  tickIndicators(): void;
  /** Hide the drone indicator and drop any combine caption: a new world has no drone. */
  clearDrone(): void;
  /** True while the drone indicator is up (fading included). */
  droneShown(): boolean;
  /** Draw the boss bar for a hud:boss payload now, with no throttle. An undrawable payload hides it. */
  setBoss(p: HudBoss): void;
  /** Hide the boss bar and forget the throttle: a new world has no boss. */
  clearBoss(): void;
  /** True while the boss bar is up. */
  bossShown(): boolean;
  /** Start the boss banner for this boss: it fades in over 1.2 s, holds, fades out, then hides itself. */
  showBanner(id: BossId): void;
  /** Advance the banner clock to now (capped per call, so a pause cannot skip the fade). listen() calls it on every hud:score. */
  tickBanner(): void;
  /** True while the banner is up. */
  bannerShown(): boolean;
  /**
   * Re-anchor on resize, fold, unfold and arena change from the pure HUD frame. `buttons` is
   * false when there is no touch input (renderer failed), which hides the rings and pause.
   */
  layout(frame: HudFrame, buttons: boolean): void;
  /**
   * Also follows neon changes (onNeonChanged) for the button colours.
   * Subscribe to 'hud:score', 'hud:weapon', 'hud:boss', 'sim:bossEnter', 'sim:bossDown',
   * 'fx:droneArm', 'hud:droneWeapon', 'fx:droneExpire' and 'fx:weaponCombine'. Returns one
   * unsubscribe function.
   */
  listen(bus: Bus): () => void;
}

/** The widest score the HUD plans for. */
export const HUD_SCORE_SAMPLE = '99,999,999';
/** The HUD score draws this much larger than its box size, capped by the box height. */
export const HUD_SCORE_SCALE = 1.15;
/** HUD score weight: the plain UI font, heavy, with tabular digits so the line does not jitter. */
export const HUD_SCORE_WEIGHT = '800';

/** Pure: the HUD score font size in whole px for its box: larger than the box size, never taller than the box. */
export function hudScorePx(b: HudBox): number {
  return Math.max(1, Math.min(b.h, Math.round(b.size * HUD_SCORE_SCALE)));
}

/**
 * Pure: an upper estimate of the plain font score width in px: tabular digits about 0.6 em,
 * commas and spaces about 0.3 em.
 */
export function plainScoreWidth(text: string, px: number): number {
  let em = 0;
  for (const ch of text) em += /\d/.test(ch) ? 0.6 : 0.3;
  return em * px;
}

/** Pure: true when the widest score fits its box at the HUD score size. */
export function hudScoreFits(b: HudBox, sample = HUD_SCORE_SAMPLE): boolean {
  return plainScoreWidth(sample, hudScorePx(b)) <= b.w;
}

function setBox(e: HTMLElement, b: HudBox, text: boolean): void {
  const s = e.style;
  s.left = `${b.x}px`;
  s.top = `${b.y}px`;
  s.width = `${b.w}px`;
  s.height = `${b.h}px`;
  if (!text) return;
  s.fontSize = `${b.size}px`;
  s.lineHeight = b.wrap ? `${b.size + 3}px` : `${b.h}px`;
  s.textAlign = b.align;
  s.whiteSpace = b.wrap ? 'normal' : 'pre';
  s.overflow = 'hidden';
}

function place(e: HTMLElement, r: Rect, d: number): void {
  const s = e.style;
  s.left = `${r.x + r.w / 2 - d / 2}px`;
  s.top = `${r.y + r.h / 2 - d / 2}px`;
  s.width = `${d}px`;
  s.height = `${d}px`;
}

/** DOM edge. `now` is the clock for the hud:weapon throttle, injected for tests. */
export function createHud(parent: HTMLElement, now: () => number = () => performance.now()): Hud {
  const root = el('div', 'sow-hud');
  let shownScore = '0';
  const score = el('div', 'sow-hud-item sow-hud-score', shownScore);
  const mult = el('div', 'sow-hud-item', 'x1');
  mult.style.color = 'hsl(95, 100%, 65%)';
  // Weapon indicator: text and a bar, no pointer target (the whole HUD is pointer-events: none).
  // Hidden until a weapon other than spread is active.
  const weaponLabel = el('div', 'sow-hud-item', '');
  weaponLabel.style.fontWeight = '600';
  weaponLabel.style.display = 'none';
  const weaponBar = el('div', 'sow-hud-bar');
  weaponBar.style.boxSizing = 'border-box';
  weaponBar.style.display = 'none';
  const weaponFill = el('div', 'sow-hud-fill');
  weaponBar.append(weaponFill);
  weaponLabel.setAttribute('data-hud', 'weapon');
  weaponBar.setAttribute('data-hud', 'weapon-bar');
  weaponFill.setAttribute('data-hud', 'weapon-fill');
  let gate: WeaponGate = { ...WEAPON_GATE_START };
  let infiniteLives = false;
  // Drone indicator (GW1): mode name and a countdown bar beside the weapon indicator. Its
  // opacity and flash follow the pure clock in indicator.ts; a short CSS transition smooths the
  // 100 ms steps, as on the boss banner.
  const droneLabel = el('div', 'sow-hud-item', '');
  droneLabel.style.fontWeight = '600';
  droneLabel.style.display = 'none';
  droneLabel.style.transition = 'opacity 120ms linear, text-shadow 120ms linear';
  droneLabel.setAttribute('data-hud', 'drone');
  const droneBar = el('div', 'sow-hud-bar');
  droneBar.style.boxSizing = 'border-box';
  droneBar.style.display = 'none';
  droneBar.style.transition = 'opacity 120ms linear';
  droneBar.setAttribute('data-hud', 'drone-bar');
  const droneFill = el('div', 'sow-hud-fill');
  droneFill.setAttribute('data-hud', 'drone-fill');
  droneBar.append(droneFill);
  weaponLabel.setAttribute('data-note', '');
  weaponLabel.style.transition = 'text-shadow 120ms linear';
  let ind: IndicatorState = { ...INDICATOR_START };
  let indLastMs = 0;
  let weaponColourNow = '';
  const paintIndicators = (): void => {
    const d = droneView(ind);
    const display = d.visible ? '' : 'none';
    droneLabel.style.display = display;
    droneBar.style.display = display;
    if (d.visible) {
      const op = String(Math.round(d.opacity * 100) / 100);
      droneLabel.textContent = d.label;
      droneLabel.style.color = d.colour;
      droneLabel.style.opacity = op;
      droneLabel.style.textShadow = flashGlow(d.colour, d.flash);
      droneBar.style.opacity = op;
      droneBar.style.borderColor = d.colour;
      droneFill.style.background = d.colour;
      droneFill.style.boxShadow = `0 0 ${Math.round(6 + 10 * d.flash)}px ${d.colour}`;
      droneFill.style.width = `${Math.round(d.fraction * 1000) / 10}%`;
    }
    const c = combineView(ind);
    weaponLabel.setAttribute('data-note', c.caption);
    weaponLabel.style.textShadow = c.active && weaponColourNow !== '' ? flashGlow(weaponColourNow, c.flash) : '';
  };
  // Boss bar (V3-A): name and phase pips on one row, a thick hit point bar under it. Hidden until a
  // boss enters. Plain divs like the weapon indicator, so it adds no pointer target.
  const bossNameEl = el('div', 'sow-hud-item', '');
  bossNameEl.style.fontWeight = '700';
  bossNameEl.style.display = 'none';
  bossNameEl.setAttribute('data-hud', 'boss-name');
  const bossPipsEl = el('div', 'sow-hud-item');
  bossPipsEl.style.display = 'none';
  bossPipsEl.style.alignItems = 'center';
  bossPipsEl.style.justifyContent = 'flex-end';
  bossPipsEl.style.gap = '4px';
  bossPipsEl.setAttribute('data-hud', 'boss-pips');
  const bossPipEls: HTMLDivElement[] = [];
  for (let i = 0; i < BOSS_MAX_PIPS; i++) {
    const pip = el('div');
    pip.style.boxSizing = 'border-box';
    pip.style.borderRadius = '50%';
    pip.style.display = 'none';
    bossPipEls.push(pip);
    bossPipsEl.append(pip);
  }
  const bossBarEl = el('div', 'sow-hud-bar');
  bossBarEl.style.boxSizing = 'border-box';
  bossBarEl.style.display = 'none';
  bossBarEl.style.background = 'rgba(2, 4, 12, 0.55)';
  bossBarEl.setAttribute('data-hud', 'boss-bar');
  const bossFillEl = el('div', 'sow-hud-fill');
  bossFillEl.setAttribute('data-hud', 'boss-fill');
  bossBarEl.append(bossFillEl);
  // Boss banner (G3A): one line, the upper case name and a dot in the boss colour. It is not a HUD
  // box: it sits at the top of the play rect for a few seconds. Its opacity follows a pure clock
  // (bannerAlpha) that hud:score advances; a short CSS transition smooths the 100 ms steps.
  const bannerEl = el('div', 'sow-hud-item', '');
  bannerEl.style.fontWeight = '800';
  bannerEl.style.letterSpacing = '0.14em';
  bannerEl.style.opacity = '0';
  bannerEl.style.display = 'none';
  bannerEl.style.transition = 'opacity 120ms linear';
  bannerEl.setAttribute('data-hud', 'boss-banner');
  /** Seconds since the boss entered; BANNER_TOTAL_SEC means finished or never started. */
  let showCode = false;
  let bannerT = BANNER_TOTAL_SEC;
  let bannerLastMs = 0;
  const paintBanner = (): void => {
    const done = bannerT >= BANNER_TOTAL_SEC;
    bannerEl.style.display = done ? 'none' : '';
    bannerEl.style.opacity = String(Math.round(bannerAlpha(bannerT) * 100) / 100);
  };
  let bossGateState: BossGate = { ...BOSS_GATE_START };
  let bossUp = false;
  /** Set by sim:bossDown, cleared by the next sim:bossEnter, a living hud:boss or clearBoss. */
  let bossDownSeen = false;
  let frameCls: AspectClass | null = null;
  const paintPips = (id: BossId, states: readonly PipState[]): void => {
    const solid = bossColour(id);
    const faint = bossColour(id, 0.45);
    for (let i = 0; i < bossPipEls.length; i++) {
      const pip = bossPipEls[i];
      if (pip === undefined) continue;
      const st = states[i];
      pip.style.display = st === undefined ? 'none' : 'block';
      if (st === undefined) continue;
      pip.style.border = `1px solid ${st === 'done' ? faint : solid}`;
      pip.style.background = st === 'current' ? solid : st === 'done' ? faint : 'transparent';
      pip.style.boxShadow = st === 'current' ? `0 0 6px ${solid}` : '';
    }
  };
  const bar = el('div', 'sow-hud-bar');
  const fill = el('div', 'sow-hud-fill');
  const objLabel = el('div', 'sow-hud-item', '');
  // R2: a thin star line along the bottom of the bar (score toward the third star), with two ticks
  // at the first and second star thresholds. Separate from the objective fill above it.
  const starFill = el('div', 'sow-hud-star');
  starFill.setAttribute('data-hud', 'starLine');
  const starTicks = [el('div', 'sow-hud-tick'), el('div', 'sow-hud-tick')];
  bar.append(fill, starFill, ...starTicks);
  // hud-clock: a box host, a neon frame inside it, the pixel digits inside the frame. Hidden until set.
  const clockHost = el('div', 'sow-hud-item');
  clockHost.setAttribute('data-hud', 'clock');
  clockHost.style.display = 'none';
  clockHost.style.alignItems = 'center';
  clockHost.style.overflow = 'visible';
  const clockFrame = el('div');
  clockFrame.setAttribute('data-hud', 'clock-frame');
  clockFrame.style.boxSizing = 'border-box';
  clockFrame.style.display = 'inline-flex';
  clockFrame.style.alignItems = 'center';
  clockFrame.style.justifyContent = 'center';
  clockFrame.style.padding = `${CLOCK_PAD_Y}px ${CLOCK_PAD_X}px`;
  clockFrame.style.transition = `transform ${CLOCK_PULSE_MS / 2}ms ease-out, box-shadow ${CLOCK_PULSE_MS / 2}ms ease-out`;
  const clockDigits = el('div');
  clockDigits.setAttribute('data-hud', 'clock-digits');
  clockDigits.style.lineHeight = '1';
  clockFrame.append(clockDigits);
  clockHost.append(clockFrame);
  let clockNow: ClockView | null = null;
  let clockDrawn = '';
  let clockPulseTimer: ReturnType<typeof setTimeout> | undefined;
  const paintClock = (pulse: boolean): void => {
    const v = clockNow;
    if (v === null || v.mode === 'hidden') {
      clockHost.style.display = 'none';
      return;
    }
    clockHost.style.display = 'flex';
    const key = `${v.text}|${v.tone}`;
    if (key !== clockDrawn) {
      clockDrawn = key;
      setVectorText(clockDigits, v.text, { tone: v.tone });
    }
    const st = clockStyle(v, neon, pulse);
    clockDigits.style.fontSize = `${st.fontPx}px`;
    clockFrame.style.border = st.border;
    clockFrame.style.boxShadow = st.boxShadow;
    clockFrame.style.background = st.background;
    clockFrame.style.transform = pulse ? `scale(${CLOCK_PULSE_SCALE})` : 'scale(1)';
  };
  const par = el('div', 'sow-hud-item', '');
  const lives = el('div', 'sow-hud-item', '');
  const bombs = el('div', 'sow-hud-item', '');
  const pause = el('div', 'sow-hud-item');
  const bombRing = el('div', 'sow-hud-ring');
  const superRing = el('div', 'sow-hud-ring');
  bombRing.setAttribute('data-hud', 'bomb-button');
  superRing.setAttribute('data-hud', 'super-button');
  // Cells first, then the bomb count, so the count paints over the cell ring.
  const bombCells = el('div');
  const superCells = el('div');
  const bombCount = el('span', '', '');
  bombCount.style.position = 'relative';
  bombRing.append(bombCells, bombCount);
  superRing.append(superCells);
  const bombLabel = el('div', 'sow-hud-item');
  bombLabel.setAttribute('data-hud', 'bomb-label');
  const superName = el('div', 'sow-hud-item');
  superName.setAttribute('data-hud', 'super-label');
  root.append(bar, objLabel, clockHost, score, mult, weaponBar, weaponLabel, droneBar, droneLabel, par, bossBarEl, bossNameEl, bossPipsEl, bannerEl, lives, bombs, pause, bombRing, superRing, bombLabel, superName);
  // Button look state: neon from applyNeon, bombs and charge from hud:score, held from setHeld.
  let neon: NeonParams = getNeonState().params;
  let bombsLeft = 1;
  let charge = 0;
  let heldBomb = false;
  let heldSuper = false;
  let superKind: SuperKind = 'homing';
  let labelCls: AspectClass = 'cover';
  let cellsD = 0;
  let pulseTimer: ReturnType<typeof setInterval> | undefined;
  const clockMs = (): number => Date.now();
  const paintButtons = (): void => {
    const b = discStyle(buttonPaint({ held: heldBomb, ready: bombsLeft > 0 }), BOMB_KEY, neon);
    const sp = superPaint(charge, heldSuper, clockMs());
    const su = discStyle(sp, SUPER_KEY, neon, charge, SUPER_CHARGE_KEY);
    for (const [ring, cells, d] of [[bombRing, bombCells, b], [superRing, superCells, su]] as const) {
      ring.style.border = d.border;
      ring.style.background = d.background;
      ring.style.boxShadow = d.boxShadow;
      cells.style.color = d.cells;
    }
    bombCount.style.color = toneColour(BOMB_KEY, neon.saturation, bombsLeft > 0 ? 1 : 0.5);
  };
  /** The pixel cell ring: one absolutely placed square per cell, drawn in currentColor. */
  const buildCells = (host: HTMLElement, d: number): void => {
    const s = host.style;
    s.position = 'absolute';
    s.left = `${-RIM_W}px`;
    s.top = `${-RIM_W}px`;
    s.width = `${d}px`;
    s.height = `${d}px`;
    s.pointerEvents = 'none';
    const squares = pixelRing(d).map((c) => {
      const q = el('div');
      q.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:${c.s}px;height:${c.s}px;background:currentColor`;
      return q;
    });
    host.replaceChildren(...squares);
  };
  const paintLabels = (): void => {
    setVectorText(bombLabel, BOMB_TEXT, { tone: 'cyan' });
    setVectorText(superName, superLabel(superKind, labelCls, charge >= 1), { tone: 'yellow' });
  };
  /** A full super pulses, so it repaints on a timer while full; the timer stops when it is not. */
  const syncPulse = (): void => {
    const full = charge >= 1;
    if (full && pulseTimer === undefined) pulseTimer = setInterval(paintButtons, PULSE_REPAINT_MS);
    else if (!full && pulseTimer !== undefined) {
      clearInterval(pulseTimer);
      pulseTimer = undefined;
    }
  };
  paintButtons();
  paintLabels();
  parent.append(root);
  // On main the boss bar takes the level line's slot, so the line steps aside while a boss lives.
  const syncPar = (): void => {
    par.style.display = bossUp && frameCls === 'main' ? 'none' : '';
  };
  pause.style.cssText += ';display:flex;gap:22%;justify-content:center;align-items:center';
  const bars = [el('div'), el('div')];
  for (const b of bars) {
    b.style.cssText = 'width:22%;height:70%;background:hsl(190,60%,90%);border-radius:2px;box-shadow:0 0 6px hsl(190,80%,60%)';
    pause.append(b);
  }

  const hud: Hud = {
    show: () => root.classList.add('sow-open'),
    hide: () => {
      root.classList.remove('sow-open');
      if (clockPulseTimer !== undefined) {
        clearTimeout(clockPulseTimer);
        clockPulseTimer = undefined;
      }
      if (pulseTimer !== undefined) {
        clearInterval(pulseTimer);
        pulseTimer = undefined;
      }
    },
    update(p) {
      const t = hudText(p, infiniteLives);
      if (t.score !== shownScore) {
        shownScore = t.score;
        score.textContent = t.score;
      }
      mult.textContent = t.mult;
      lives.textContent = t.lives;
      bombs.textContent = t.bombs;
      bombCount.textContent = t.bombCount;
      bombsLeft = Math.max(0, Math.floor(p.bombs));
      const wasFull = charge >= 1;
      charge = t.charge;
      paintButtons();
      if (wasFull !== charge >= 1) paintLabels();
      syncPulse();
    },
    setInfiniteLives(on) {
      infiniteLives = on;
      if (on) lives.textContent = INFINITE_LIVES_TEXT;
    },
    setSuper(kind) {
      superKind = kind;
      paintLabels();
    },
    setHeld(bomb, superHeld) {
      if (bomb === heldBomb && superHeld === heldSuper) return;
      heldBomb = bomb;
      heldSuper = superHeld;
      paintButtons();
    },
    setWeapon(p) {
      const v = weaponView(p);
      const display = v.visible ? '' : 'none';
      weaponLabel.style.display = display;
      weaponBar.style.display = display;
      if (!v.visible) return;
      const colour = weaponColour(p.kind);
      weaponLabel.textContent = v.label;
      weaponLabel.style.color = colour;
      weaponColourNow = colour;
      weaponFill.style.background = colour;
      weaponFill.style.boxShadow = `0 0 6px ${colour}`;
      weaponFill.style.width = `${Math.round(v.fraction * 1000) / 10}%`;
    },
    clearWeapon() {
      gate = { ...WEAPON_GATE_START };
      weaponLabel.style.display = 'none';
      weaponBar.style.display = 'none';
    },
    indicate(e) {
      if (e.type === 'arm' || e.type === 'combine' || e.type === 'expire') {
        // Start the clock at the event, so the flash or fade runs its full length from here.
        if (ind.drone === null && ind.combo === null) indLastMs = now();
      }
      ind = reduceIndicator(ind, e);
      if (e.type === 'combine' && weaponLabel.style.display !== 'none') weaponLabel.textContent = combineView(ind).name;
      paintIndicators();
    },
    tickIndicators() {
      const t = now();
      const dt = (t - indLastMs) / 1000;
      indLastMs = t;
      if (ind.drone === null && ind.combo === null) return;
      ind = reduceIndicator(ind, { type: 'tick', dt });
      paintIndicators();
    },
    clearDrone() {
      ind = reduceIndicator(ind, { type: 'clear' });
      paintIndicators();
    },
    droneShown: () => ind.drone !== null,
    setBoss(p) {
      const v = bossView(p);
      bossUp = v.visible;
      syncPar();
      bossNameEl.style.display = v.visible ? '' : 'none';
      bossBarEl.style.display = v.visible ? '' : 'none';
      bossPipsEl.style.display = v.visible && v.pips.length > 0 ? 'flex' : 'none';
      if (!v.visible) return;
      const fillStyle = bossFill(p.id, now());
      bossNameEl.textContent = v.name;
      bossNameEl.style.color = bossColour(p.id);
      bossNameEl.style.textShadow = `0 0 6px ${bossColour(p.id, 0.8)}`; // tier glow, not the shared cyan one
      bossBarEl.style.borderColor = bossColour(p.id, 0.7);
      bossFillEl.style.background = fillStyle.background;
      bossFillEl.style.boxShadow = fillStyle.glow;
      bossFillEl.style.width = `${Math.round(v.fraction * 1000) / 10}%`;
      paintPips(p.id, v.pips);
    },
    clearBoss() {
      bossGateState = { ...BOSS_GATE_START };
      bossDownSeen = false;
      bossUp = false;
      bossNameEl.style.display = 'none';
      bossBarEl.style.display = 'none';
      bossPipsEl.style.display = 'none';
      bannerT = BANNER_TOTAL_SEC; // a boss that goes (or a new world) takes the banner with it
      paintBanner();
      syncPar();
    },
    bossShown: () => bossUp,
    showBanner(id) {
      const text = bossBannerText(id);
      if (text === '') return;
      bannerEl.textContent = text;
      bannerEl.style.color = bossColour(id);
      bannerEl.style.textShadow = `0 0 8px ${bossColour(id, 0.9)}, 0 0 18px ${bossColour(id, 0.5)}`;
      bannerT = 0;
      bannerLastMs = now();
      paintBanner();
    },
    tickBanner() {
      if (bannerT >= BANNER_TOTAL_SEC) return;
      const t = now();
      bannerT = bannerAdvance(bannerT, (t - bannerLastMs) / 1000);
      bannerLastMs = t;
      paintBanner();
    },
    bannerShown: () => bannerT < BANNER_TOTAL_SEC,
    setLevel(levelIndex, parScore, hash) {
      par.textContent = levelLine(levelIndex, parScore, hash, showCode);
    },
    setDevCode(on) {
      showCode = on;
    },
    setLine(text) {
      par.textContent = text;
    },
    setObjective(p) {
      objLabel.textContent = p.label;
      fill.style.width = `${Math.round(p.fraction * 1000) / 10}%`;
      const line = p.stars ?? null;
      starFill.style.display = line === null ? 'none' : '';
      starFill.style.width = `${Math.round((line ?? 0) * 1000) / 10}%`;
      starTicks.forEach((t, i) => {
        const at = p.starMarks?.[i];
        t.style.display = line === null || at === undefined ? 'none' : '';
        t.style.left = `${Math.round((at ?? 0) * 1000) / 10}%`;
      });
    },
    setClock(v, pulse = false) {
      clockNow = v;
      if (!pulse) {
        paintClock(clockPulseTimer !== undefined); // a pulse in flight keeps its scale until its timer settles it
        return;
      }
      if (clockPulseTimer !== undefined) clearTimeout(clockPulseTimer);
      paintClock(true);
      // Half the pulse up, half back down: at most one pulse a second, as warnings come no faster.
      clockPulseTimer = setTimeout(() => {
        clockPulseTimer = undefined;
        paintClock(false);
      }, CLOCK_PULSE_MS / 2);
    },
    layout(frame, buttons) {
      const B = frame.boxes;
      setBox(clockHost, B.clock, false);
      clockHost.style.justifyContent = frame.cls === 'main' ? 'center' : 'flex-start';
      setBox(score, B.score, true);
      score.style.fontSize = `${hudScorePx(B.score)}px`;
      score.style.fontWeight = HUD_SCORE_WEIGHT;
      score.style.fontVariantNumeric = 'tabular-nums';
      setBox(mult, B.mult, true);
      setBox(weaponLabel, B.weapon, true);
      setBox(weaponBar, B.weaponBar, false);
      setBox(droneLabel, B.drone, true);
      setBox(droneBar, B.droneBar, false);
      setBox(lives, B.lives, true);
      setBox(bombs, B.bombs, true);
      setBox(bar, B.bar, false);
      setBox(objLabel, B.objLabel, true);
      setBox(par, B.par, true);
      par.style.opacity = '0.8';
      setBox(bossNameEl, B.bossName, true);
      setBox(bossPipsEl, B.bossPips, false);
      setBox(bossBarEl, B.bossBar, false);
      setBox(bannerEl, frame.banner, true);
      bannerEl.style.overflow = 'visible'; // setBox clips text boxes, which would cut the banner glow
      const pipD = Math.max(6, Math.min(10, B.bossPips.h - 6));
      for (const pip of bossPipEls) {
        pip.style.width = `${pipD}px`;
        pip.style.height = `${pipD}px`;
      }
      frameCls = frame.cls;
      syncPar();
      for (const [e, b] of [[superName, B.superLabel], [bombLabel, B.bombLabel]] as const) {
        setBox(e, b, true);
        // Pixel labels: centred in the box, top aligned, glow not clipped.
        e.style.overflow = 'visible';
        e.style.lineHeight = '1';
        e.style.justifyContent = 'center';
        e.style.alignItems = 'flex-start';
      }
      if (frame.cls !== labelCls) {
        labelCls = frame.cls;
        paintLabels();
      }
      place(pause, frame.buttons.pause, frame.pauseIcon);
      place(bombRing, frame.buttons.bomb, frame.bombD);
      place(superRing, frame.buttons.super, frame.superD);
      if (frame.bombD !== cellsD) {
        cellsD = frame.bombD;
        buildCells(bombCells, frame.bombD);
        buildCells(superCells, frame.superD);
      }
      for (const e of [pause, bombRing, superRing, superName, bombLabel]) e.style.display = buttons ? 'flex' : 'none';
    },
    listen(bus) {
      const offScore = bus.on('hud:score', (p) => {
        hud.update(p);
        hud.tickBanner(); // the sim emits hud:score only while it steps, so a pause stops the fade
        hud.tickIndicators(); // same clock for the drone countdown, its flash and fade, and the combine caption
      });
      // Payload objects are reused by the sim: copy the fields into a fresh event.
      const offArm = bus.on('fx:droneArm', (p) => hud.indicate({ type: 'arm', mode: p.mode, secondsLeft: p.secondsLeft }));
      const offDroneHud = bus.on('hud:droneWeapon', (p) =>
        hud.indicate({ type: 'droneHud', mode: p.mode, remaining: p.remaining, total: p.total }),
      );
      const offExpire = bus.on('fx:droneExpire', (p) => hud.indicate({ type: 'expire', mode: p.mode }));
      const offCombine = bus.on('fx:weaponCombine', (p) => hud.indicate({ type: 'combine', kind: p.kind }));
      const offWeapon = bus.on('hud:weapon', (p) => {
        const g = weaponGate(gate, p, now());
        gate = g.gate;
        if (g.draw) hud.setWeapon(p);
      });
      const offBoss = bus.on('hud:boss', (p) => {
        if (bossDownSeen) {
          // The boss already died: a late payload with no hit points left must not bring the bar back.
          if (!(p.hp > 0)) return;
          bossDownSeen = false;
        }
        const g = bossGate(bossGateState, p, now());
        bossGateState = g.gate;
        if (g.draw) hud.setBoss(p);
      });
      const offEnter = bus.on('sim:bossEnter', (p) => {
        bossDownSeen = false;
        hud.showBanner(p.id); // every entrance, even one a hud:boss already drew
        if (bossGateState.id === p.id) return; // a hud:boss already drew this boss: do not reset its bar
        const e = enterPayload(p.id);
        bossGateState = bossGate(bossGateState, e, now()).gate;
        hud.setBoss(e);
      });
      const offDown = bus.on('sim:bossDown', () => {
        hud.clearBoss();
        bossDownSeen = true;
      });
      const offNeon = onNeonChanged((p) => {
        neon = p;
        paintButtons();
        paintClock(clockPulseTimer !== undefined);
      });
      return () => {
        offNeon();
        offScore();
        offWeapon();
        offBoss();
        offEnter();
        offDown();
        offArm();
        offDroneHud();
        offExpire();
        offCombine();
      };
    },
  };
  return hud;
}
