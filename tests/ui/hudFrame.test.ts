// B6 regression: every HUD element (score, multiplier, objective, par, lives, bombs, pause, super
// ring and label, bomb button) lies outside the arena on the cover (21:9) and main (10:9) screens.
import { describe, expect, it } from 'vitest';
import { SHIP_SPEED } from '../../src/game/ship';
import { layoutButtons } from '../../src/input/buttons';
import type { Insets, Rect } from '../../src/input/types';
import { generateLevel } from '../../src/levelgen/generator';
import type { SuperKind } from '../../src/levelgen/leveldef';
import { fitArena } from '../../src/render/layout';
import { MULTIPLIER_CAP } from '../../src/game/scoring';
import { hudText, playRect, superLabel } from '../../src/ui/hud';
import {
import { V12_GEN_CONFIG } from '../../src/levelgen/leveldef';
  COVER_DRONE_ROW,
  COVER_LEFT,
  hudFrame,
  mainIndicators,
  MAIN_DRONE_MIN_W,
  hudRects,
  MAIN_RIGHT,
  MAIN_ROWS,
  mainTop,
  overlayPadding,
  overlaps,
  type HudFrame,
} from '../../src/ui/hudFrame';

const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

const COVER_VIEWS: Array<[number, number]> = [
  [960, 411],
  [904, 388],
  [1176, 504],
  [840, 360],
];
const MAIN_VIEWS: Array<[number, number]> = [
  [832, 750],
  [794, 716],
  [1092, 984],
  [884, 800],
];
const INSETS: Insets[] = [ZERO, { top: 0, right: 0, bottom: 0, left: 32 }, { top: 24, right: 0, bottom: 16, left: 0 }];
/** Generator bounds: height 700 to 1100, width up to 1800, aspect 1.0 to 1.8; Endless 1600 x 1000. */
const ARENAS: Array<[number, number]> = [
  [700, 700],
  [1100, 1100],
  [1260, 700],
  [1800, 1000],
  [1600, 1000],
];

function inside(inner: Rect, outer: Rect, eps = 1e-6): boolean {
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.w <= outer.x + outer.w + eps &&
    inner.y + inner.h <= outer.y + outer.h + eps
  );
}

function frames(views: Array<[number, number]>): HudFrame[] {
  const out: HudFrame[] = [];
  for (const [w, h] of views) for (const ins of INSETS) for (const [aw, ah] of ARENAS) out.push(hudFrame(w, h, ins, aw, ah));
  return out;
}

function label(f: HudFrame): string {
  return `${f.cssW}x${f.cssH} ${f.arrangement} arena ${Math.round(f.arena.w)}x${Math.round(f.arena.h)}`;
}

describe('B6 HUD frame keeps the HUD off the arena', () => {
  for (const [name, views] of [
    ['cover 21:9', COVER_VIEWS],
    ['main 10:9', MAIN_VIEWS],
  ] as const) {
    it(`${name}: no HUD element overlaps the arena`, () => {
      for (const f of frames([...views])) {
        for (const r of hudRects(f)) {
          expect(overlaps(r, f.arena), `${label(f)} rect ${JSON.stringify(r)}`).toBe(false);
        }
      }
    });

    it(`${name}: no HUD element overlaps the play rect`, () => {
      for (const f of frames([...views])) {
        for (const r of hudRects(f)) {
          expect(overlaps(r, f.playRect), `${label(f)} rect ${JSON.stringify(r)}`).toBe(false);
        }
      }
    });

    it(`${name}: arena sits in the play rect and HUD elements stay on screen`, () => {
      const screen = (f: HudFrame): Rect => ({ x: 0, y: 0, w: f.cssW, h: f.cssH });
      for (const f of frames([...views])) {
        expect(inside(f.arena, f.playRect), label(f)).toBe(true);
        for (const r of hudRects(f)) expect(inside(r, screen(f)), `${label(f)} ${JSON.stringify(r)}`).toBe(true);
      }
    });
  }

  it('cover uses side columns and the super ring sits in the right column, not bottom centre', () => {
    const f = hudFrame(960, 411, ZERO, 1800, 1000);
    expect(f.cls).toBe('cover');
    expect(f.arrangement).toBe('sides');
    expect(f.buttons.super.x).toBeGreaterThanOrEqual(f.arena.x + f.arena.w);
    expect(f.boxes.superLabel.x).toBeGreaterThanOrEqual(f.arena.x + f.arena.w);
    expect(f.boxes.score.x + f.boxes.score.w).toBeLessThanOrEqual(f.arena.x);
  });

  it('main always uses the right column: the stacked buttons sit high, so a bottom band would hold nothing', () => {
    expect(hudFrame(832, 750, ZERO, 1800, 1000).arrangement).toBe('topRight');
    expect(hudFrame(832, 750, ZERO, 1100, 1100).arrangement).toBe('topRight');
  });

  it('button rects match what Thumbs lays out from the frame insets', () => {
    for (const f of [...frames(COVER_VIEWS), ...frames(MAIN_VIEWS)]) {
      expect(layoutButtons(f.cssW, f.cssH, f.buttonInsets)).toEqual(f.buttons);
    }
  });

  it('shrinks the play rect rather than shrinking the HUD: arena still fills most of the screen', () => {
    for (const f of frames(COVER_VIEWS)) expect(f.arena.h / f.cssH, label(f)).toBeGreaterThan(0.5);
    for (const f of frames(MAIN_VIEWS)) expect(Math.max(f.arena.w / f.cssW, f.arena.h / f.cssH), label(f)).toBeGreaterThan(0.55);
  });

  it('fit matches the arena rect and is centred in the play rect', () => {
    const f = hudFrame(960, 411, { top: 0, right: 0, bottom: 0, left: 32 }, 1600, 1000);
    expect(f.fit.x).toBeCloseTo(f.playRect.x + f.playRect.w / 2);
    expect(f.fit.y).toBeCloseTo(f.playRect.y + f.playRect.h / 2);
    expect(f.arena.w).toBeCloseTo(1600 * f.fit.scale);
  });
});

describe('B9 main screen arena scale: on-screen ship speed', () => {
  // Estimated Fold 7 CSS viewports (DPR 2.625) and the seed Thumbs used for the B9 table.
  const MAIN = { w: 832, h: 750 };
  const COVER = { w: 960, h: 411 };
  const SEED = 12345;
  const LEVELS = [1, 6, 20] as const;
  /** Main screen px/s at 61450aa (B6 fixed bands), measured by Thumbs in run 0122. */
  const AT_B6: Record<(typeof LEVELS)[number], number> = { 1: 297, 6: 266, 20: 207 };

  interface Row {
    level: number;
    arena: string;
    preB6Main: number;
    main: number;
    cover: number;
    arrangement: string;
  }

  function pxPerSec(scale: number): number {
    return SHIP_SPEED * scale;
  }

  function row(level: number): Row {
    const { width: aw, height: ah } = generateLevel(SEED, level, V12_GEN_CONFIG).arena; // B9 pins predate the V13 guardian arenas
    const m = hudFrame(MAIN.w, MAIN.h, ZERO, aw, ah);
    const c = hudFrame(COVER.w, COVER.h, ZERO, aw, ah);
    // Pre-B6: the legacy docs/01 top band play rect, buttons drawn over the arena.
    const pre = fitArena(aw, ah, playRect(MAIN.w, MAIN.h, ZERO, 'main'));
    return {
      level,
      arena: `${aw}x${ah}`,
      preB6Main: pxPerSec(pre.scale),
      main: pxPerSec(m.fit.scale),
      cover: pxPerSec(c.fit.scale),
      arrangement: m.arrangement,
    };
  }

  const rows = LEVELS.map(row);

  it('prints the table and the pre-B6 reference matches the Thumbs measurement', () => {
    console.log(
      ['level arena preB6 B6 main cover main/pre main/cover arrangement']
        .concat(
          rows.map((r) =>
            [
              `L${r.level}`,
              r.arena,
              r.preB6Main.toFixed(0),
              AT_B6[r.level as (typeof LEVELS)[number]],
              r.main.toFixed(1),
              r.cover.toFixed(1),
              `${((100 * r.main) / r.preB6Main).toFixed(1)}%`,
              `${((100 * r.main) / r.cover).toFixed(1)}%`,
              r.arrangement,
            ].join(' '),
          ),
        )
        .join('\n'),
    );
    expect(rows.map((r) => Math.round(r.preB6Main))).toEqual([349, 311, 224]);
  });

  it('main is never slower than cover by more than 5 percent, on every Adventure level 1 to 30', () => {
    for (let level = 1; level <= 30; level++) {
      const r = row(level);
      expect(r.main, `L${level} ${r.arena}`).toBeGreaterThanOrEqual(0.95 * r.cover);
    }
  });

  it('main is faster than at B6 on levels 1 and 6, and within 1 percent of B6 on level 20', () => {
    // thumbs-buttons: the narrower 68 px column speeds up levels 1 and 6; level 20 lost the bottom
    // band arrangement (the buttons no longer sit at the bottom), so it lands just under B6.
    const [l1, l6, l20] = rows;
    for (const r of [l1, l6]) expect(r?.main ?? 0, `L${r?.level}`).toBeGreaterThan(AT_B6[r?.level as (typeof LEVELS)[number]] + 5);
    expect(l20?.main ?? 0).toBeGreaterThanOrEqual(0.99 * AT_B6[20]);
  });

  it('main reaches 90 percent or more of pre-B6 on levels 1, 6 and 20', () => {
    for (const r of rows) expect(r.main, `L${r.level}`).toBeGreaterThanOrEqual(0.9 * r.preB6Main);
  });

  it('why 95 percent is out of reach: the arena is width limited and the stack needs its column', () => {
    // The super-over-bomb stack is 64 px wide and sits mid height on the right edge, so the only
    // HUD-clear rect beside it is the column layout (arena width W - MAIN_RIGHT).
    const buttons = layoutButtons(MAIN.w, MAIN.h, ZERO);
    const columnRect = { x: 0, y: 0, w: MAIN.w - MAIN_RIGHT, h: MAIN.h };
    expect(mainTop(buttons, ZERO)).toBe(60);
    expect(MAIN_RIGHT).toBe(68);
    for (const r of rows) {
      const [aw, ah] = r.arena.split('x').map(Number) as [number, number];
      const best = fitArena(aw, ah, columnRect).scale;
      expect(pxPerSec(best), `L${r.level}`).toBeLessThan(0.95 * r.preB6Main);
      expect(r.main).toBeCloseTo(pxPerSec(best), 6);
    }
  });

  it('main bands are measured, not fixed: top band 60, column 68 at zero insets', () => {
    for (const [aw, ah] of [[1800, 1000], [960, 720]] as const) {
      const tr = hudFrame(MAIN.w, MAIN.h, ZERO, aw, ah);
      expect(tr.arrangement).toBe('topRight');
      expect(tr.playRect).toEqual({ x: 0, y: 60, w: 832 - 68, h: 690 });
    }
  });
});

describe('pause, results and intro overlays stay clear of the HUD rings', () => {
  function contentOf(f: HudFrame): Rect {
    const p = overlayPadding(f);
    return { x: p.left, y: p.top, w: f.cssW - p.left - p.right, h: f.cssH - p.top - p.bottom };
  }

  it('overlay content never overlaps the rings, pause or any HUD text on either screen', () => {
    for (const f of [...frames(COVER_VIEWS), ...frames(MAIN_VIEWS)]) {
      const c = contentOf(f);
      for (const r of hudRects(f)) expect(overlaps(c, r), `${label(f)} ${JSON.stringify(r)}`).toBe(false);
      expect(c.w).toBeGreaterThan(300);
      // G3A: a boss run on cover loses COVER_BOSS_STRIP px off the top, so the smallest view with the
      // tallest insets (840 x 360, 24 + 16) is exactly 300 px. The real cover has no insets: 391 px.
      expect(c.h).toBeGreaterThanOrEqual(300);
    }
  });

  it('padding includes the safe area insets', () => {
    const f = hudFrame(960, 411, { top: 0, right: 0, bottom: 0, left: 32 }, 1600, 1000);
    expect(overlayPadding(f).left).toBeGreaterThanOrEqual(32);
  });
});

describe('V2-B weapon indicator boxes', () => {
  const all = [...frames(COVER_VIEWS), ...frames(MAIN_VIEWS)];
  /** Every text or bar box except the two weapon boxes. */
  const others = (f: HudFrame): Rect[] =>
    Object.entries(f.boxes)
      .filter(([id]) => id !== 'weapon' && id !== 'weaponBar')
      .map(([, b]) => b)
      .filter((b) => b.w > 0 && b.h > 0);

  it('sits to the right of the multiplier on the same row on both screens', () => {
    for (const f of all) {
      const { mult, weapon } = f.boxes;
      expect(weapon.x, label(f)).toBeGreaterThanOrEqual(mult.x + mult.w);
      expect(weapon.y, label(f)).toBe(mult.y);
      expect(weapon.w, label(f)).toBeGreaterThan(40);
    }
  });

  it('the countdown bar is directly under the label, same left edge and width', () => {
    for (const f of all) {
      const { weapon, weaponBar } = f.boxes;
      expect(weaponBar.x, label(f)).toBe(weapon.x);
      expect(weaponBar.w, label(f)).toBe(weapon.w);
      expect(weaponBar.y, label(f)).toBeGreaterThanOrEqual(weapon.y + weapon.h);
      expect(weaponBar.h, label(f)).toBeGreaterThanOrEqual(4);
    }
  });

  it('overlaps no other HUD box, and neither does it overlap the arena or the play rect', () => {
    for (const f of all) {
      for (const id of ['weapon', 'weaponBar'] as const) {
        const b = f.boxes[id];
        for (const o of others(f)) expect(overlaps(b, o), `${label(f)} ${id} vs ${JSON.stringify(o)}`).toBe(false);
        expect(overlaps(b, f.arena), `${label(f)} ${id} arena`).toBe(false);
        expect(overlaps(b, f.playRect), `${label(f)} ${id} play rect`).toBe(false);
      }
    }
  });

  it('stays inside the existing top rows: no taller band on main, clear of the objective bar on cover', () => {
    for (const f of frames(MAIN_VIEWS)) {
      const { weaponBar } = f.boxes;
      expect(weaponBar.y + weaponBar.h, label(f)).toBeLessThanOrEqual(f.insets.top + MAIN_ROWS);
      expect(mainTop(f.buttons, f.insets), label(f)).toBe(Math.max(MAIN_ROWS, f.buttons.pause.y + f.buttons.pause.h - f.insets.top));
    }
    for (const f of frames(COVER_VIEWS)) {
      expect(f.boxes.weaponBar.y + f.boxes.weaponBar.h, label(f)).toBeLessThanOrEqual(f.boxes.bar.y);
    }
  });

  it('stays inside the column it belongs to: the cover left column, the main top band', () => {
    for (const f of frames(COVER_VIEWS)) {
      const { weapon } = f.boxes;
      expect(weapon.x + weapon.w, label(f)).toBeLessThanOrEqual(f.insets.left + COVER_LEFT);
    }
    for (const f of frames(MAIN_VIEWS)) {
      const { weapon, objLabel } = f.boxes;
      expect(weapon.x + weapon.w, label(f)).toBeLessThanOrEqual(objLabel.x);
    }
  });

  it('the multiplier box still fits the widest multiplier, x999', () => {
    const text = hudText({ score: 0, multiplier: MULTIPLIER_CAP, lives: 1, bombs: 0, superCharge: 0 }).mult;
    expect(text).toBe('x999');
    for (const f of all) {
      const { mult } = f.boxes;
      // Digits are about 0.6 em wide in the system sans-serif stack; allow 0.65.
      expect(mult.w, label(f)).toBeGreaterThanOrEqual(text.length * mult.size * 0.65);
    }
  });

  it('does not move the arena: the play rect depends on the bands and columns, not on these boxes', () => {
    // Zero inset, cover: side columns only, plus the G3A boss strip on a boss run (the default).
    // A run with no boss keeps the v2 play rect exactly. Zero inset, main: MAIN_ROWS top band.
    const cover = hudFrame(960, 411, ZERO, 1600, 1000, { bossStrip: false });
    expect(cover.playRect.y).toBe(0);
    expect(cover.playRect.x).toBe(160);
    expect(hudFrame(960, 411, ZERO, 1600, 1000).playRect.y).toBe(20);
    const main = hudFrame(832, 750, ZERO, 1800, 1000);
    expect(main.playRect.y).toBe(mainTop(main.buttons, ZERO));
  });
});

describe('GW1 drone indicator boxes', () => {
  /** Boss runs (the default strip) and no boss runs on cover; main ignores the option. */
  const withStrip = (views: Array<[number, number]>, bossStrip: boolean): HudFrame[] => {
    const out: HudFrame[] = [];
    for (const [w, h] of views) for (const ins of INSETS) for (const [aw, ah] of ARENAS) out.push(hudFrame(w, h, ins, aw, ah, { bossStrip }));
    return out;
  };
  const cover = [...withStrip(COVER_VIEWS, true), ...withStrip(COVER_VIEWS, false)];
  const main = frames(MAIN_VIEWS);
  const all = [...cover, ...main];
  const others = (f: HudFrame): Array<[string, Rect]> =>
    Object.entries(f.boxes).filter(([id, b]) => id !== 'drone' && id !== 'droneBar' && b.w > 0 && b.h > 0);

  it('overlaps no other HUD box, the boss bar included, nor the arena, the play rect or the buttons', () => {
    for (const f of all) {
      for (const id of ['drone', 'droneBar'] as const) {
        const b = f.boxes[id];
        for (const [oid, o] of others(f)) expect(overlaps(b, o), `${label(f)} ${id} vs ${oid}`).toBe(false);
        for (const k of ['bomb', 'super', 'pause'] as const) expect(overlaps(b, f.buttons[k]), `${label(f)} ${id} vs ${k}`).toBe(false);
        expect(overlaps(b, f.arena), `${label(f)} ${id} arena`).toBe(false);
        expect(overlaps(b, f.playRect), `${label(f)} ${id} play rect`).toBe(false);
        expect(overlaps(b, f.banner), `${label(f)} ${id} banner`).toBe(false);
      }
    }
  });

  it('the bar sits directly under the label, same left edge and width', () => {
    for (const f of all) {
      const { drone, droneBar } = f.boxes;
      expect(droneBar.x, label(f)).toBe(drone.x);
      expect(droneBar.w, label(f)).toBe(drone.w);
      expect(droneBar.y, label(f)).toBeGreaterThanOrEqual(drone.y + drone.h);
      expect(droneBar.h, label(f)).toBeGreaterThanOrEqual(4);
    }
  });

  it('cover: under the weapon indicator in the left column, above the objective bar', () => {
    for (const f of cover) {
      const { weapon, weaponBar, drone, droneBar, bar } = f.boxes;
      expect(drone.x, label(f)).toBe(weapon.x);
      expect(drone.w, label(f)).toBe(weapon.w);
      expect(drone.y, label(f)).toBeGreaterThanOrEqual(weaponBar.y + weaponBar.h);
      expect(droneBar.y + droneBar.h, label(f)).toBeLessThanOrEqual(bar.y);
      expect(drone.x + drone.w, label(f)).toBeLessThanOrEqual(f.insets.left + COVER_LEFT);
      expect(COVER_DRONE_ROW).toBeGreaterThanOrEqual(drone.h + droneBar.h);
    }
  });

  it('main: right of the weapon indicator on the same row, inside the top band, left of the objective and boss boxes', () => {
    for (const f of main) {
      const { weapon, weaponBar, drone, droneBar, objLabel, par, bossName, bossBar } = f.boxes;
      expect(drone.y, label(f)).toBe(weapon.y);
      expect(droneBar.y, label(f)).toBe(weaponBar.y);
      expect(drone.x, label(f)).toBeGreaterThanOrEqual(weapon.x + weapon.w);
      expect(drone.w, label(f)).toBeGreaterThanOrEqual(MAIN_DRONE_MIN_W);
      expect(droneBar.y + droneBar.h, label(f)).toBeLessThanOrEqual(f.insets.top + MAIN_ROWS);
      for (const o of [objLabel, par, bossName, bossBar]) expect(drone.x + drone.w, label(f)).toBeLessThanOrEqual(o.x);
    }
  });

  it('keeps the band and columns: the play rect is the same with or without the indicator', () => {
    expect(hudFrame(960, 411, ZERO, 1600, 1000, { bossStrip: false }).playRect).toEqual({ x: 160, y: 0, w: 960 - 160 - 112, h: 411 });
    const m = hudFrame(832, 750, ZERO, 1800, 1000);
    expect(m.playRect.y).toBe(mainTop(m.buttons, ZERO));
  });

  it('labels fit: the longest mode name, and the longest pair name with its caption, on the Fold 7 screens', () => {
    // Rough widths for the system sans-serif at weight 600: capitals 0.68 em, lower case 0.56 em.
    const caps = (t: string, size: number): number => t.length * 0.68 * size;
    const mixed = (t: string, size: number): number => (0.68 + (t.length - 1) * 0.56) * size;
    for (const f of [hudFrame(960, 411, ZERO, 1600, 1000), hudFrame(904, 388, ZERO, 1600, 1000), hudFrame(832, 750, ZERO, 1600, 1000)]) {
      const { weapon, drone } = f.boxes;
      const pair = caps('TRIDENT', weapon.size) + 0.4 * weapon.size + 'combined'.length * 0.56 * 0.75 * weapon.size;
      expect(weapon.w, label(f)).toBeGreaterThanOrEqual(pair);
      expect(drone.w, label(f)).toBeGreaterThanOrEqual(mixed('Double', drone.size));
    }
  });

  it('mainIndicators splits the run: weapon, gap, drone, never past the end', () => {
    for (const run of [80, 120, 153, 172, 260]) {
      const r = mainIndicators(100, 100 + run);
      expect(r.droneW).toBeGreaterThanOrEqual(MAIN_DRONE_MIN_W);
      expect(r.droneX).toBeGreaterThanOrEqual(100 + r.weaponW);
      if (run >= 120) expect(r.droneX + r.droneW).toBeCloseTo(100 + run, 6);
      expect(r.weaponW).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('super button label (thumbs-button-look)', () => {
  const kinds: SuperKind[] = ['homing', 'detonate', 'turbo'];

  it('is just the super name; main says BOOM for Detonate', () => {
    expect(superLabel('homing')).toBe('HOMING');
    expect(superLabel('detonate')).toBe('DETONATE');
    expect(superLabel('turbo')).toBe('TURBO');
    expect(superLabel('detonate', 'main')).toBe('BOOM');
    expect(superLabel('homing', 'main')).toBe('HOMING');
  });

  it('never mentions a sidekick or upgrade', () => {
    for (const k of kinds) for (const c of ['cover', 'main'] as const) expect(superLabel(k, c).toLowerCase()).not.toMatch(/sidekick|upgrade|drone/);
  });
});
