// Drone indicator and weapon combine flash (GW1: the drone pickup "is not entirely clear when it
// happens"). Pure state machine: main.ts never sees it, hud.ts feeds it bus events and a clock.
// The drone indicator sits beside the weapon indicator: the mode name in the mode colour, a 20 s
// countdown bar, a flash on 'fx:droneArm' and a fade on 'fx:droneExpire'. A drone lost on death
// sends 'hud:droneWeapon' with nothing left and no expire event, so it goes at once with no fade.
// The weapon indicator flashes on 'fx:weaponCombine' and carries a "combined" caption for 1.5 s.
// The clock advances only on hud:score (the sim emits it only while it steps), so a pause freezes
// the countdown, the flashes and the fade together, like the boss banner.
import type { ComboKind, DroneMode } from '../core/events';

/** Seconds a drone pickup arms the drone for (docs/13); a payload without a usable time uses this. */
export const DRONE_SEC = 20;
/** Seconds the arm flash takes to die away. */
export const ARM_FLASH_SEC = 0.6;
/** Seconds the expired drone indicator takes to fade out. */
export const EXPIRE_FADE_SEC = 0.8;
/** Seconds the "combined" caption stays on the weapon indicator. */
export const COMBINE_SEC = 1.5;
/** Seconds the combine flash takes to die away (inside COMBINE_SEC). */
export const COMBINE_FLASH_SEC = 0.6;
/** Largest clock step per tick, so a long gap between ticks cannot skip a flash or a fade. */
export const INDICATOR_MAX_STEP_SEC = 0.25;
export const COMBINE_CAPTION = 'combined';

/** Mode names as docs/13 writes them. Title case, so a Rapid drone never reads like the RAPID weapon. */
export const DRONE_LABELS: Readonly<Record<DroneMode, string>> = {
  homing: 'Homing',
  detach: 'Detach',
  rapid: 'Rapid',
  double: 'Double',
};

/** Mode hues, chosen clear of the four weapon hues (55, 200, 258, 143) so the two indicators never match. */
export const DRONE_HUES: Readonly<Record<DroneMode, number>> = {
  homing: 335,
  detach: 95,
  rapid: 22,
  double: 290,
};

/** Pair names (Ryan's, docs/13), upper case like every weapon label. */
export const COMBO_LABELS: Readonly<Record<ComboKind, string>> = {
  'spread+rapid': 'HAIL',
  'spread+pierce': 'TRIDENT',
  'spread+orbit': 'HALO',
  'rapid+pierce': 'NEEDLE',
  'rapid+orbit': 'WHIRL',
  'pierce+orbit': 'ECLIPSE',
};

/** Pure: CSS colour for a drone mode, at an optional alpha. */
export function droneColour(mode: DroneMode, alpha = 1): string {
  const h = DRONE_HUES[mode];
  return alpha >= 1 ? `hsl(${h}, 95%, 66%)` : `hsla(${h}, 95%, 66%, ${alpha})`;
}

export interface IndicatorState {
  /** Mode on show, also while it fades; null when the drone indicator is hidden. */
  drone: DroneMode | null;
  remaining: number;
  total: number;
  /** Seconds since the drone armed; Infinity when no arm flash is running. */
  armT: number;
  /** Seconds since the drone expired; Infinity when it is not fading. */
  fadeT: number;
  /** Pair just combined; null when no caption is up. */
  combo: ComboKind | null;
  /** Seconds since the combine. */
  comboT: number;
}

export const INDICATOR_START: Readonly<IndicatorState> = {
  drone: null,
  remaining: 0,
  total: DRONE_SEC,
  armT: Number.POSITIVE_INFINITY,
  fadeT: Number.POSITIVE_INFINITY,
  combo: null,
  comboT: 0,
};

export type IndicatorEvent =
  | { type: 'arm'; mode: DroneMode; secondsLeft: number }
  | { type: 'droneHud'; mode: DroneMode; remaining: number; total: number }
  | { type: 'expire'; mode: DroneMode }
  | { type: 'combine'; kind: ComboKind }
  | { type: 'tick'; dt: number }
  | { type: 'clear' };

/** Slack for clock sums: ten 0.1 s steps add up to a hair under 1. */
const EPS = 1e-6;

function positive(n: number, fallback: number): number {
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function fading(s: Readonly<IndicatorState>): boolean {
  return Number.isFinite(s.fadeT);
}

/** Pure: the next indicator state. Never mutates `s`. */
export function reduceIndicator(s: Readonly<IndicatorState>, e: IndicatorEvent): IndicatorState {
  switch (e.type) {
    case 'arm': {
      const t = positive(e.secondsLeft, DRONE_SEC);
      return { ...s, drone: e.mode, remaining: t, total: t, armT: 0, fadeT: Number.POSITIVE_INFINITY };
    }
    case 'droneHud': {
      if (fading(s)) return { ...s }; // the expire already started the fade: the empty payload after it changes nothing
      const left = Number.isFinite(e.remaining) ? e.remaining : 0;
      if (left <= 0) return { ...s, drone: null, remaining: 0, armT: Number.POSITIVE_INFINITY }; // lost on death: no fade
      const total = positive(e.total, s.drone === null ? DRONE_SEC : s.total);
      return { ...s, drone: e.mode, remaining: Math.min(left, total), total };
    }
    case 'expire':
      return { ...s, drone: s.drone ?? e.mode, remaining: 0, armT: Number.POSITIVE_INFINITY, fadeT: 0 };
    case 'combine':
      return { ...s, combo: e.kind, comboT: 0 };
    case 'tick': {
      const dt = Number.isFinite(e.dt) ? Math.max(0, Math.min(INDICATOR_MAX_STEP_SEC, e.dt)) : 0;
      const next: IndicatorState = { ...s, armT: s.armT + dt, fadeT: s.fadeT + dt, comboT: s.comboT + dt };
      if (next.armT >= ARM_FLASH_SEC - EPS) next.armT = Number.POSITIVE_INFINITY;
      if (fading(s)) {
        if (next.fadeT >= EXPIRE_FADE_SEC - EPS) {
          next.drone = null;
          next.fadeT = Number.POSITIVE_INFINITY;
        }
      } else if (s.drone !== null) {
        next.remaining = Math.max(0, s.remaining - dt); // smooth between the 100 ms hud:droneWeapon payloads
      }
      if (next.comboT >= COMBINE_SEC - EPS) {
        next.combo = null;
        next.comboT = 0;
      }
      return next;
    }
    case 'clear':
      return { ...INDICATOR_START };
  }
}

export interface DroneView {
  visible: boolean;
  label: string;
  colour: string;
  /** Bar fill as 0 to 1. */
  fraction: number;
  /** Arm flash strength, 1 at the arm falling to 0. */
  flash: number;
  /** 1 while armed, falling to 0 over the expire fade. */
  opacity: number;
}

/** Pure: what the drone indicator draws. */
export function droneView(s: Readonly<IndicatorState>): DroneView {
  if (s.drone === null) return { visible: false, label: '', colour: '', fraction: 0, flash: 0, opacity: 0 };
  const fraction = s.total > 0 ? Math.max(0, Math.min(1, s.remaining / s.total)) : 0;
  const flash = Number.isFinite(s.armT) ? Math.max(0, 1 - s.armT / ARM_FLASH_SEC) : 0;
  const opacity = fading(s) ? Math.max(0, 1 - s.fadeT / EXPIRE_FADE_SEC) : 1;
  return { visible: true, label: DRONE_LABELS[s.drone], colour: droneColour(s.drone), fraction, flash, opacity };
}

export interface CombineView {
  active: boolean;
  /** Pair name, upper case. */
  name: string;
  /** COMBINE_CAPTION while active, else empty. */
  caption: string;
  /** Combine flash strength, 1 at the combine falling to 0. */
  flash: number;
}

/** Pure: whether the weapon indicator is in its combine flash and what it shows. */
export function combineView(s: Readonly<IndicatorState>): CombineView {
  if (s.combo === null) return { active: false, name: '', caption: '', flash: 0 };
  const flash = Math.max(0, 1 - s.comboT / COMBINE_FLASH_SEC);
  return { active: true, name: COMBO_LABELS[s.combo], caption: COMBINE_CAPTION, flash };
}

/** Pure: a CSS text-shadow that brightens with `flash` (0 to 1) over the shared HUD glow. */
export function flashGlow(colour: string, flash: number): string {
  const f = Math.max(0, Math.min(1, flash));
  if (f <= 0) return '';
  const a = Math.round(4 + 10 * f);
  const b = Math.round(10 + 16 * f);
  return `0 0 ${a}px ${colour}, 0 0 ${b}px ${colour}`;
}
