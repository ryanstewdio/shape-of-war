// GW1: drone indicator and weapon combine flash. The pure state machine (indicator.ts) and the HUD
// wiring from the bus (hud.ts), on the fake DOM.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bus, DRONE_MODES, type ComboKind } from '../../src/core/events';
import { createHud } from '../../src/ui/hud';
import { hudFrame } from '../../src/ui/hudFrame';
import {
  ARM_FLASH_SEC,
  COMBINE_CAPTION,
  COMBINE_SEC,
  COMBO_LABELS,
  combineView,
  DRONE_HUES,
  DRONE_LABELS,
  DRONE_SEC,
  droneColour,
  droneView,
  EXPIRE_FADE_SEC,
  flashGlow,
  INDICATOR_MAX_STEP_SEC,
  INDICATOR_START,
  reduceIndicator,
  type IndicatorEvent,
  type IndicatorState,
} from '../../src/ui/indicator';
import { weaponHue } from '../../src/ui/weaponHue';
import { asParent, installFakeDocument, type FakeEl } from './fakeDom';

function run(...events: IndicatorEvent[]): IndicatorState {
  return events.reduce<IndicatorState>((s, e) => reduceIndicator(s, e), { ...INDICATOR_START });
}

const tick = (dt: number): IndicatorEvent => ({ type: 'tick', dt });
/** Many small ticks adding up to `sec`, so the per tick cap never bites. */
function ticks(sec: number, step = 0.1): IndicatorEvent[] {
  const out: IndicatorEvent[] = [];
  for (let t = 0; t < sec - 1e-9; t += step) out.push(tick(Math.min(step, sec - t)));
  return out;
}
const arm = (mode: (typeof DRONE_MODES)[number] = 'homing', secondsLeft = DRONE_SEC): IndicatorEvent => ({ type: 'arm', mode, secondsLeft });

const COMBOS: ComboKind[] = ['spread+rapid', 'spread+pierce', 'spread+orbit', 'rapid+pierce', 'rapid+orbit', 'pierce+orbit'];

describe('drone indicator state machine', () => {
  it('starts hidden', () => {
    expect(droneView(INDICATOR_START).visible).toBe(false);
    expect(combineView(INDICATOR_START).active).toBe(false);
  });

  it('names the four modes as docs/13 does and colours each away from the weapon hues', () => {
    expect(DRONE_MODES.map((m) => DRONE_LABELS[m])).toEqual(['Homing', 'Detach', 'Rapid', 'Double']);
    const weaponHues = (['spread', 'rapid', 'pierce', 'orbit'] as const).map((k) => weaponHue(k));
    for (const m of DRONE_MODES) {
      for (const h of weaponHues) {
        const d = Math.abs(DRONE_HUES[m] - h) % 360;
        expect(Math.min(d, 360 - d), `${m} vs ${h}`).toBeGreaterThanOrEqual(20);
      }
    }
    expect(new Set(DRONE_MODES.map((m) => droneColour(m))).size).toBe(4);
  });

  it('an arm shows the mode, a full bar and a full flash', () => {
    for (const m of DRONE_MODES) {
      const v = droneView(run(arm(m)));
      expect(v).toMatchObject({ visible: true, label: DRONE_LABELS[m], colour: droneColour(m), fraction: 1, flash: 1, opacity: 1 });
    }
  });

  it('the flash dies away over ARM_FLASH_SEC and stays off', () => {
    const half = droneView(run(arm(), ...ticks(ARM_FLASH_SEC / 2)));
    expect(half.flash).toBeCloseTo(0.5, 5);
    expect(droneView(run(arm(), ...ticks(ARM_FLASH_SEC))).flash).toBe(0);
    expect(droneView(run(arm(), ...ticks(5))).flash).toBe(0);
  });

  it('the bar counts 20 s down between hud payloads and follows each payload', () => {
    expect(droneView(run(arm(), ...ticks(10))).fraction).toBeCloseTo(0.5, 5);
    const s = run(arm(), ...ticks(2), { type: 'droneHud', mode: 'homing', remaining: 5, total: 20 });
    expect(droneView(s).fraction).toBeCloseTo(0.25, 5);
    expect(droneView(reduceIndicator(s, tick(0.1))).fraction).toBeCloseTo(4.9 / 20, 5);
  });

  it('a replacement pickup restarts the mode, the bar and the flash', () => {
    const s = run(arm('homing'), ...ticks(12), arm('double'));
    expect(droneView(s)).toMatchObject({ label: 'Double', fraction: 1, flash: 1, opacity: 1 });
  });

  it('expire fades the indicator out over EXPIRE_FADE_SEC, then hides it', () => {
    const s = run(arm('rapid'), ...ticks(19.9), { type: 'expire', mode: 'rapid' });
    expect(droneView(s)).toMatchObject({ visible: true, label: 'Rapid', fraction: 0, opacity: 1 });
    expect(droneView(ticks(EXPIRE_FADE_SEC / 2).reduce(reduceIndicator, s)).opacity).toBeCloseTo(0.5, 5);
    expect(droneView(run(arm('rapid'), { type: 'expire', mode: 'rapid' }, ...ticks(EXPIRE_FADE_SEC))).visible).toBe(false);
  });

  it('the empty hud payload that follows an expire does not cut the fade short', () => {
    const s = run(arm(), { type: 'expire', mode: 'homing' }, { type: 'droneHud', mode: 'homing', remaining: 0, total: 20 });
    expect(droneView(s).visible).toBe(true);
    expect(droneView(s).opacity).toBe(1);
  });

  it('a drone lost on death (empty payload, no expire) goes at once with no fade', () => {
    const s = run(arm(), ...ticks(3), { type: 'droneHud', mode: 'homing', remaining: 0, total: 20 });
    expect(droneView(s).visible).toBe(false);
  });

  it('an arm during the fade brings the indicator straight back', () => {
    const s = run(arm('detach'), { type: 'expire', mode: 'detach' }, ...ticks(0.3), arm('homing'));
    expect(droneView(s)).toMatchObject({ visible: true, label: 'Homing', opacity: 1, flash: 1, fraction: 1 });
  });

  it('a hud payload with time left shows the indicator even if the arm was missed, without a flash', () => {
    const v = droneView(run({ type: 'droneHud', mode: 'double', remaining: 15, total: 20 }));
    expect(v).toMatchObject({ visible: true, label: 'Double', flash: 0 });
    expect(v.fraction).toBeCloseTo(0.75, 5);
  });

  it('bad numbers fall back to 20 s and never show NaN', () => {
    const v = droneView(run({ type: 'arm', mode: 'homing', secondsLeft: Number.NaN }));
    expect(v.fraction).toBe(1);
    const w = droneView(run(arm(), { type: 'droneHud', mode: 'homing', remaining: 30, total: Number.POSITIVE_INFINITY }));
    expect(w.fraction).toBe(1);
    expect(droneView(run(arm(), tick(Number.NaN))).fraction).toBe(1);
  });

  it('one tick is capped, so a long gap cannot skip the flash or the fade', () => {
    const s = run(arm(), tick(10));
    expect(droneView(s).flash).toBeCloseTo(1 - INDICATOR_MAX_STEP_SEC / ARM_FLASH_SEC, 5);
    expect(droneView(s).fraction).toBeCloseTo(1 - INDICATOR_MAX_STEP_SEC / DRONE_SEC, 5);
  });

  it('clear forgets everything', () => {
    expect(run(arm(), { type: 'combine', kind: 'spread+rapid' }, { type: 'clear' })).toEqual(INDICATOR_START);
  });

  it('never mutates the state it is given', () => {
    const s = run(arm());
    const copy = { ...s };
    reduceIndicator(s, tick(0.1));
    reduceIndicator(s, { type: 'expire', mode: 'homing' });
    expect(s).toEqual(copy);
  });
});

describe('weapon combine flash state machine', () => {
  it('shows the pair name with the combined caption and a full flash', () => {
    for (const k of COMBOS) {
      expect(combineView(run({ type: 'combine', kind: k }))).toEqual({ active: true, name: COMBO_LABELS[k], caption: COMBINE_CAPTION, flash: 1 });
    }
    expect(COMBOS.map((k) => COMBO_LABELS[k])).toEqual(['HAIL', 'TRIDENT', 'HALO', 'NEEDLE', 'WHIRL', 'ECLIPSE']);
    expect(COMBINE_CAPTION).toBe('combined');
  });

  it('the caption stays up for 1.5 s and then goes', () => {
    expect(COMBINE_SEC).toBe(1.5);
    expect(combineView(run({ type: 'combine', kind: 'rapid+orbit' }, ...ticks(1.4))).active).toBe(true);
    expect(combineView(run({ type: 'combine', kind: 'rapid+orbit' }, ...ticks(1.5))).active).toBe(false);
  });

  it('the flash falls to 0 before the caption goes', () => {
    expect(combineView(run({ type: 'combine', kind: 'rapid+orbit' }, ...ticks(1))).flash).toBe(0);
  });

  it('a second combine restarts the caption with the new name', () => {
    const s = run({ type: 'combine', kind: 'spread+rapid' }, ...ticks(1.2), { type: 'combine', kind: 'pierce+orbit' }, ...ticks(1));
    expect(combineView(s)).toMatchObject({ active: true, name: 'ECLIPSE' });
  });

  it('is independent of the drone indicator', () => {
    const s = run(arm(), { type: 'combine', kind: 'spread+orbit' }, ...ticks(2));
    expect(combineView(s).active).toBe(false);
    expect(droneView(s).visible).toBe(true);
  });

  it('flashGlow is empty at 0 and grows with the flash', () => {
    expect(flashGlow('red', 0)).toBe('');
    expect(flashGlow('red', 1)).toBe('0 0 14px red, 0 0 26px red');
    expect(flashGlow('red', 5)).toBe(flashGlow('red', 1));
  });
});

describe('drone indicator and combine flash: HUD wiring', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function build() {
    const root = installFakeDocument();
    const bus = new Bus();
    let t = 0;
    const hud = createHud(asParent(root), () => t);
    hud.listen(bus);
    hud.layout(hudFrame(960, 411, { top: 0, right: 0, bottom: 0, left: 0 }, 1600, 1000), true);
    const find = (name: string): FakeEl => {
      const e = root.all().find((n) => n.getAttribute('data-hud') === name);
      if (e === undefined) throw new Error(`no element ${name}`);
      return e;
    };
    const score = (ms: number): void => {
      t = ms;
      bus.emit('hud:score', { score: 0, multiplier: 1, lives: 3, bombs: 3, superCharge: 0 });
    };
    return { bus, hud, label: find('drone'), bar: find('drone-bar'), fill: find('drone-fill'), weapon: find('weapon'), score, at: (ms: number) => (t = ms) };
  }

  const shown = (e: FakeEl): boolean => e.style.display !== 'none';

  it('is hidden until the drone arms', () => {
    const { label, bar, hud } = build();
    expect(shown(label)).toBe(false);
    expect(shown(bar)).toBe(false);
    expect(hud.droneShown()).toBe(false);
  });

  it('fx:droneArm shows the mode in its colour with a full bar and a flash', () => {
    const { bus, label, bar, fill } = build();
    bus.emit('fx:droneArm', { x: 0, y: 0, mode: 'detach', secondsLeft: 20 });
    expect(shown(label)).toBe(true);
    expect(shown(bar)).toBe(true);
    expect(label.textContent).toBe('Detach');
    expect(label.style.color).toBe(droneColour('detach'));
    expect(fill.style.width).toBe('100%');
    expect(label.style.textShadow).toBe(flashGlow(droneColour('detach'), 1));
  });

  it('hud:score drives the countdown and the flash, hud:droneWeapon corrects it', () => {
    const { bus, label, fill, score } = build();
    score(0);
    bus.emit('fx:droneArm', { x: 0, y: 0, mode: 'homing', secondsLeft: 20 });
    for (let ms = 100; ms <= 1000; ms += 100) score(ms);
    expect(label.style.textShadow).toBe('');
    expect(fill.style.width).toBe('95%');
    bus.emit('hud:droneWeapon', { mode: 'homing', remaining: 10, total: 20 });
    expect(fill.style.width).toBe('50%');
  });

  it('fx:droneExpire fades it out on the hud:score clock, then hides it', () => {
    const { bus, label, bar, score, hud } = build();
    score(0);
    bus.emit('fx:droneArm', { x: 0, y: 0, mode: 'rapid', secondsLeft: 20 });
    score(100);
    bus.emit('fx:droneExpire', { x: 0, y: 0, mode: 'rapid' });
    bus.emit('hud:droneWeapon', { mode: 'rapid', remaining: 0, total: 20 });
    expect(label.style.opacity).toBe('1');
    for (let ms = 200; ms <= 500; ms += 100) score(ms);
    expect(label.style.opacity).toBe('0.5');
    expect(bar.style.opacity).toBe('0.5');
    for (let ms = 600; ms <= 900; ms += 100) score(ms);
    expect(shown(label)).toBe(false);
    expect(hud.droneShown()).toBe(false);
  });

  it('a pause (no hud:score) freezes the fade', () => {
    const { bus, label, score, at } = build();
    score(0);
    bus.emit('fx:droneArm', { x: 0, y: 0, mode: 'rapid', secondsLeft: 20 });
    bus.emit('fx:droneExpire', { x: 0, y: 0, mode: 'rapid' });
    at(60_000);
    expect(label.style.opacity).toBe('1');
    expect(shown(label)).toBe(true);
  });

  it('fx:weaponCombine flashes the weapon label with the pair name and the caption, for 1.5 s', () => {
    const { bus, weapon, score } = build();
    score(0);
    bus.emit('hud:weapon', { kind: 'spread+pierce', remaining: 20, total: 20, title: 'Trident' });
    bus.emit('fx:weaponCombine', { x: 0, y: 0, kind: 'spread+pierce', a: 'spread', b: 'pierce' });
    expect(weapon.textContent).toBe('TRIDENT');
    expect(weapon.getAttribute('data-note')).toBe('combined');
    expect(weapon.style.textShadow).not.toBe('');
    for (let ms = 100; ms <= 1400; ms += 100) score(ms);
    expect(weapon.getAttribute('data-note')).toBe('combined');
    expect(weapon.style.textShadow).toBe('');
    score(1500);
    expect(weapon.getAttribute('data-note')).toBe('');
    expect(weapon.textContent).toBe('TRIDENT');
  });

  it('clearDrone hides the indicator and drops the caption; unsubscribe stops it', () => {
    const { bus, hud, label, weapon } = build();
    bus.emit('fx:droneArm', { x: 0, y: 0, mode: 'double', secondsLeft: 20 });
    bus.emit('fx:weaponCombine', { x: 0, y: 0, kind: 'rapid+pierce', a: 'rapid', b: 'pierce' });
    hud.clearDrone();
    expect(shown(label)).toBe(false);
    expect(weapon.getAttribute('data-note')).toBe('');
  });

  it('every new listener unsubscribes cleanly', () => {
    const root = installFakeDocument();
    const bus = new Bus();
    const hud = createHud(asParent(root), () => 0);
    const off = hud.listen(bus);
    off();
    bus.emit('fx:droneArm', { x: 0, y: 0, mode: 'double', secondsLeft: 20 });
    expect(hud.droneShown()).toBe(false);
  });
});
