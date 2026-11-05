// thumbs-buttons reach: the super and bomb stack sits high on the right safe edge, above the aim rest
// zone, on both Fold screens. The bomb bottom edge is at least one stick radius plus 24 px above the
// zone top, so the aim ring at full deflection from any anchor in the zone never covers either
// button, and the stretch from the zone to each button stays between REACH_MIN and REACH_MAX.
import { describe, expect, it } from 'vitest';
import {
  BOMB_HIT,
  BOMB_VISUAL,
  hitButton,
  layoutButtons,
  PAUSE_HIT,
  rectCentre,
  RING_GAP,
  STACK_CLEAR,
  stackCentreX,
  SUPER_GAP,
  SUPER_HIT,
} from '../../src/input/buttons';
import { EDGE_GUARD, halfFor, inEdgeGuard } from '../../src/input/model';
import { aimRestZone, distToRect, REACH_MAX, REACH_MIN, reachGap, REST_H, REST_MIN_H, REST_W, ringClearance } from '../../src/input/reach';
import { STICK_RADIUS } from '../../src/input/stick';
import type { ButtonRects, Insets, Rect } from '../../src/input/types';
import { aspectClass, hudFrame, mainTop, overlaps, type AspectClass, type HudFrame } from '../../src/ui/hudFrame';

/** Estimated Z Fold 7 CSS viewports, landscape. */
const FOLD = [
  { name: 'main', w: 832, h: 750 },
  { name: 'cover', w: 960, h: 411 },
] as const;
const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
/** Camera notch insets on either long side, status and gesture bars, and both at once. */
const INSETS: Insets[] = [
  ZERO,
  { top: 0, right: 0, bottom: 0, left: 32 },
  { top: 0, right: 32, bottom: 0, left: 0 },
  { top: 0, right: 0, bottom: 16, left: 0 },
  { top: 24, right: 0, bottom: 16, left: 0 },
  { top: 24, right: 32, bottom: 16, left: 0 },
];
/** Generator bounds plus Endless. */
const ARENAS: Array<[number, number]> = [
  [700, 700],
  [1100, 1100],
  [1260, 700],
  [1800, 1000],
  [1600, 1000],
];

interface Case {
  label: string;
  cls: AspectClass;
  w: number;
  h: number;
  insets: Insets;
  buttons: ButtonRects;
  frame: HudFrame | null;
}

function insLabel(i: Insets): string {
  return `insets ${i.top},${i.right},${i.bottom},${i.left}`;
}

/** Every Fold layout the game can show: the HUD frame cases (boss strip on and off) plus the bare safe area layout. */
function cases(): Case[] {
  const out: Case[] = [];
  for (const vp of FOLD) {
    const cls = aspectClass(vp.w, vp.h);
    for (const ins of INSETS) {
      out.push({ label: `${vp.name} bare ${insLabel(ins)}`, cls, w: vp.w, h: vp.h, insets: ins, buttons: layoutButtons(vp.w, vp.h, ins), frame: null });
      for (const [aw, ah] of ARENAS) {
        for (const bossStrip of [true, false]) {
          const f = hudFrame(vp.w, vp.h, ins, aw, ah, { bossStrip });
          out.push({ label: `${vp.name} ${f.arrangement} ${aw}x${ah} strip ${bossStrip} ${insLabel(ins)}`, cls, w: vp.w, h: vp.h, insets: ins, buttons: f.buttons, frame: f });
        }
      }
    }
  }
  return out;
}

/** Anchors on a 4 px grid over the zone, edges and corners included. */
function anchors(z: Rect): Array<[number, number]> {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = z.x; x < z.x + z.w; x += 4) xs.push(x);
  for (let y = z.y; y < z.y + z.h; y += 4) ys.push(y);
  xs.push(z.x + z.w);
  ys.push(z.y + z.h);
  const out: Array<[number, number]> = [];
  for (const x of xs) for (const y of ys) out.push([x, y]);
  return out;
}

const ALL = cases();
const IDS = ['super', 'bomb'] as const;

describe('aim rest zone', () => {
  it('covers both aspect classes and every arrangement', () => {
    expect(new Set(ALL.map((c) => c.cls))).toEqual(new Set(['cover', 'main']));
    expect(new Set(ALL.map((c) => c.frame?.arrangement ?? 'bare'))).toEqual(new Set(['sides', 'topRight', 'bare']));
  });

  it('is a real region in the aim half, clear of the edge guard and every button, on both screens', () => {
    for (const c of ALL) {
      const z = aimRestZone(c.w, c.h, c.insets);
      expect(z.w, c.label).toBe(REST_W);
      expect(z.h, c.label).toBeGreaterThanOrEqual(REST_MIN_H);
      if (c.cls === 'main') expect(z.h, c.label).toBe(REST_H);
      expect(z.y + z.h, c.label).toBeLessThanOrEqual(c.h - c.insets.bottom);
      for (const [x, y] of anchors(z)) {
        expect(halfFor(c.w, x), c.label).toBe('aim');
        expect(inEdgeGuard(c.w, x), c.label).toBe(false);
        expect(hitButton(c.buttons, x, y), `${c.label} at ${x},${y}`).toBeNull();
      }
      expect(z.x + z.w, c.label).toBeLessThan(c.w - c.insets.right - EDGE_GUARD);
    }
  });

  it('cover with no insets: 51 px tall, trimmed so the stack and its label fit under pause; main: the full 64 px', () => {
    expect(aimRestZone(960, 411, ZERO)).toEqual({ x: 704, y: 356, w: 160, h: 51 });
    expect(aimRestZone(832, 750, ZERO)).toEqual({ x: 576, y: 682, w: 160, h: 64 });
    // Worst case on the cover: status bar and gesture bar insets together still leave 11 px
    // (19 before thumbs-button-look: the super label costs 8 px).
    expect(aimRestZone(960, 411, { top: 24, right: 0, bottom: 16, left: 0 }).h).toBe(11);
  });

  it('distToRect is zero inside and euclidean outside', () => {
    const r = { x: 0, y: 0, w: 10, h: 10 };
    expect(distToRect(r, 5, 5)).toBe(0);
    expect(distToRect(r, 13, 14)).toBe(5);
    expect(distToRect(r, -3, 5)).toBe(3);
  });
});

describe('super and bomb stack positions', () => {
  it('exact positions on both aspect classes, HUD frame at zero insets', () => {
    const cover = hudFrame(960, 411, ZERO, 1600, 1000);
    // thumbs-button-look: 50 in from the right edge and 12 lower, so the super label fits under pause.
    expect(cover.buttons.super).toEqual({ x: 878, y: 72, w: 64, h: 64 });
    expect(cover.buttons.bomb).toEqual({ x: 878, y: 148, w: 64, h: 64 });
    const main = hudFrame(832, 750, ZERO, 1600, 1000);
    // The 68 px main column clamps the centre to 832 - 36 = 796.
    expect(main.buttons.super).toEqual({ x: 764, y: 398, w: 64, h: 64 });
    expect(main.buttons.bomb).toEqual({ x: 764, y: 474, w: 64, h: 64 });
  });

  it('is a vertical stack on the right safe edge: super on top, 64 px hit circles 12 px apart', () => {
    for (const c of ALL) {
      const { bomb, super: sup } = c.buttons;
      expect(rectCentre(sup).x, c.label).toBe(rectCentre(bomb).x);
      expect(sup.y + sup.h + SUPER_GAP, c.label).toBe(bomb.y);
      for (const r of [bomb, sup]) {
        expect(r.w, c.label).toBeGreaterThanOrEqual(64);
        expect(r.h, c.label).toBe(r.w);
        const edge = c.w - c.insets.right - (r.x + r.w);
        expect(edge, `${c.label} gap to right safe edge`).toBeGreaterThanOrEqual(0);
        expect(edge, `${c.label} gap to right safe edge`).toBeLessThanOrEqual(18);
      }
    }
  });

  it('stays inside the safe area, notch insets included, on both screens', () => {
    for (const c of ALL) {
      for (const r of [c.buttons.bomb, c.buttons.super, c.buttons.pause]) {
        expect(r.x, c.label).toBeGreaterThanOrEqual(c.insets.left);
        expect(r.y, c.label).toBeGreaterThanOrEqual(c.insets.top);
        expect(r.x + r.w, c.label).toBeLessThanOrEqual(c.w - c.insets.right);
        expect(r.y + r.h, c.label).toBeLessThanOrEqual(c.h - c.insets.bottom);
      }
    }
  });

  it('never overlaps the HUD top band, the pause button, any HUD box or the arena play rect', () => {
    for (const c of ALL) {
      const { bomb, super: sup, pause } = c.buttons;
      expect(sup.y, c.label).toBeGreaterThanOrEqual(pause.y + pause.h);
      for (const r of [bomb, sup]) expect(overlaps(r, pause), c.label).toBe(false);
      const f = c.frame;
      if (f === null) continue;
      if (f.cls === 'main') expect(sup.y, c.label).toBeGreaterThanOrEqual(f.insets.top + mainTop(f.buttons, f.insets));
      for (const r of [bomb, sup]) {
        expect(overlaps(r, f.playRect), `${c.label} play rect`).toBe(false);
        for (const [id, b] of Object.entries(f.boxes)) {
          if (b.w <= 0 || b.h <= 0) continue;
          // A button's own label sits over the top margin of its hit square, never on its disc.
          if ((r === bomb && id === 'bombLabel') || (r === sup && id === 'superLabel')) {
            expect(b.y + b.h, `${c.label} ${id} on its disc`).toBeLessThanOrEqual(r.y + (r.h - BOMB_VISUAL) / 2);
            continue;
          }
          expect(overlaps(r, b), `${c.label} vs ${id}`).toBe(false);
        }
      }
    }
  });

  it('hit sizes stay at or above the 44 px minimum (SPEC 5)', () => {
    for (const c of ALL) {
      expect(c.buttons.bomb.w).toBe(BOMB_HIT);
      expect(c.buttons.super.w).toBe(SUPER_HIT);
      expect(c.buttons.pause.w).toBe(PAUSE_HIT);
    }
  });
});

describe('ring and reach from the rest zone', () => {
  it('the bomb bottom edge is at least one stick radius plus 24 px above the zone top', () => {
    expect(STACK_CLEAR).toBe(STICK_RADIUS + 24);
    for (const c of ALL) {
      const z = aimRestZone(c.w, c.h, c.insets);
      expect(z.y - (c.buttons.bomb.y + c.buttons.bomb.h), c.label).toBeGreaterThanOrEqual(STACK_CLEAR);
    }
  });

  it('the aim ring at full deflection from any anchor in the zone never covers super or bomb', () => {
    for (const c of ALL) {
      const z = aimRestZone(c.w, c.h, c.insets);
      for (const id of IDS) {
        const r = c.buttons[id];
        expect(ringClearance(z, r), `${c.label} ${id}`).toBeGreaterThanOrEqual(RING_GAP);
        for (const [ax, ay] of anchors(z)) {
          // Ring of radius STICK_RADIUS at the anchor versus the hit rect (corners included).
          expect(distToRect(r, ax, ay), `${c.label} ${id} anchor ${ax},${ay}`).toBeGreaterThanOrEqual(STICK_RADIUS + RING_GAP);
        }
      }
    }
  });

  it(`stretch from the zone to each hit circle edge is ${REACH_MIN} to ${REACH_MAX} CSS px on both screens`, () => {
    for (const c of ALL) {
      const z = aimRestZone(c.w, c.h, c.insets);
      for (const id of IDS) {
        const g = reachGap(z, c.buttons[id]);
        expect(g, `${c.label} ${id}`).toBeGreaterThanOrEqual(REACH_MIN);
        expect(g, `${c.label} ${id}`).toBeLessThanOrEqual(REACH_MAX);
      }
    }
  });

  it('the stated numbers: bomb about 150 px (2.4 cm cover, 2.8 cm main), super about 225 px (3.6 and 4.1 cm)', () => {
    const cover = hudFrame(960, 411, ZERO, 1600, 1000);
    const main = hudFrame(832, 750, ZERO, 1600, 1000);
    const zc = aimRestZone(960, 411, ZERO);
    const zm = aimRestZone(832, 750, ZERO);
    expect(reachGap(zc, cover.buttons.bomb)).toBeCloseTo(149.9, 1);
    expect(reachGap(zc, cover.buttons.super)).toBeCloseTo(224.2, 1);
    expect(reachGap(zm, main.buttons.bomb)).toBeCloseTo(153.9, 1);
    expect(reachGap(zm, main.buttons.super)).toBeCloseTo(227.0, 1);
  });

  it('both buttons sit up and to the right of the zone, super the higher', () => {
    for (const c of ALL) {
      const z = aimRestZone(c.w, c.h, c.insets);
      for (const id of IDS) {
        const p = rectCentre(c.buttons[id]);
        expect(p.x, `${c.label} ${id}`).toBeGreaterThan(z.x + z.w);
        expect(p.y, `${c.label} ${id}`).toBeLessThan(z.y);
      }
      expect(rectCentre(c.buttons.super).y, c.label).toBeLessThan(rectCentre(c.buttons.bomb).y);
    }
  });
});

describe('stackCentreX', () => {
  it('sits STACK_RIGHT (50) in from the right edge of a wide button area', () => {
    expect(stackCentreX(832, ZERO)).toBe(782);
    expect(stackCentreX(960, { top: 0, right: 40, bottom: 0, left: 0 })).toBe(870);
  });

  it('clamps inside a column narrower than the stack offset needs', () => {
    // Main right column: 68 px wide, the 64 px hit circle must stay inside it.
    expect(stackCentreX(832, { top: 0, right: 0, bottom: 0, left: 764 })).toBe(796);
    // Cover right column: 112 px wide, no clamp needed.
    expect(stackCentreX(960, { top: 0, right: 0, bottom: 0, left: 848 })).toBe(910);
  });
});
