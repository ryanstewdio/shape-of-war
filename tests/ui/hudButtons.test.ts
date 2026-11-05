// thumbs-button-look: equal buttons on one vertical line, one pixel font label above each, inside
// the safe area and clear of the other button, every HUD box, pause and the arena.
import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { BOMB_VISUAL, rectCentre, SUPER_GAP } from '../../src/input/buttons';
import type { Insets, Rect } from '../../src/input/types';
import type { SuperKind } from '../../src/levelgen/leveldef';
import { applyNeon, NEON_DEFAULT } from '../../src/render/neon';
import { createHud, discStyle, SUPER_CHARGE_KEY, SUPER_KEY, superLabel } from '../../src/ui/hud';
import { hudFrame, labelWidth, LABEL_FONT, overlaps, superText, type BoxId, type HudFrame } from '../../src/ui/hudFrame';
import { Bus } from '../../src/core/events';
import { cellPx, pixelWidthPx } from '../../src/ui/vectorFont';
import { asParent, installFakeDocument, type FakeEl } from './fakeDom';

const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const VIEWS = [
  { w: 832, h: 750 },
  { w: 960, h: 411 },
  { w: 960, h: 412 },
  { w: 840, h: 756 },
];
const INSETS: Insets[] = [
  ZERO,
  { top: 0, right: 0, bottom: 0, left: 32 },
  { top: 0, right: 32, bottom: 0, left: 0 },
  { top: 24, right: 0, bottom: 16, left: 0 },
  { top: 24, right: 32, bottom: 16, left: 0 },
];
const ARENAS: Array<[number, number]> = [
  [700, 700],
  [1260, 700],
  [1800, 1000],
];
const KINDS: SuperKind[] = ['homing', 'detonate', 'turbo'];

function frames(): HudFrame[] {
  const out: HudFrame[] = [];
  for (const v of VIEWS)
    for (const ins of INSETS)
      for (const [aw, ah] of ARENAS) for (const bossStrip of [true, false]) out.push(hudFrame(v.w, v.h, ins, aw, ah, { bossStrip }));
  return out;
}
const ALL = frames();
const name = (f: HudFrame): string => `${f.cssW}x${f.cssH} ${f.cls} ${JSON.stringify(f.insets)} arena ${Math.round(f.arena.w)}`;
const inside = (r: Rect, o: Rect): boolean => r.x >= o.x && r.y >= o.y && r.x + r.w <= o.x + o.w && r.y + r.h <= o.y + o.h;
const safe = (f: HudFrame): Rect => ({
  x: f.insets.left,
  y: f.insets.top,
  w: f.cssW - f.insets.left - f.insets.right,
  h: f.cssH - f.insets.top - f.insets.bottom,
});

describe('bomb and super buttons: size and alignment', () => {
  it('equal drawn diameters and equal hit circles', () => {
    for (const f of ALL) {
      expect(f.bombD, name(f)).toBe(f.superD);
      expect(f.buttons.bomb.w, name(f)).toBe(f.buttons.super.w);
      expect(f.buttons.bomb.h, name(f)).toBe(f.buttons.super.h);
    }
  });

  it('centres on one vertical line, the 12 px gap kept', () => {
    for (const f of ALL) {
      expect(rectCentre(f.buttons.super).x, name(f)).toBe(rectCentre(f.buttons.bomb).x);
      expect(f.buttons.bomb.y - (f.buttons.super.y + f.buttons.super.h), name(f)).toBe(SUPER_GAP);
    }
  });
});

describe('button labels', () => {
  it('one label per button: BOMB and the super name per screen', () => {
    expect(superText('homing', 'cover')).toBe('HOMING');
    expect(superText('detonate', 'cover')).toBe('DETONATE');
    expect(superText('turbo', 'cover')).toBe('TURBO');
    expect(superText('detonate', 'main')).toBe('BOOM');
  });

  it('draws 2 px cells', () => {
    expect(cellPx(LABEL_FONT)).toBe(2);
    for (const f of ALL) for (const id of ['bombLabel', 'superLabel'] as const) expect(f.boxes[id].size).toBe(LABEL_FONT);
  });

  it('every label text fits its box on its screen', () => {
    for (const f of ALL) {
      for (const k of KINDS) expect(pixelWidthPx(superText(k, f.cls), LABEL_FONT), `${name(f)} ${k}`).toBeLessThanOrEqual(f.boxes.superLabel.w);
      expect(pixelWidthPx('BOMB', LABEL_FONT)).toBeLessThanOrEqual(f.boxes.bombLabel.w);
    }
    expect(labelWidth('cover')).toBe(96);
    expect(labelWidth('main')).toBe(68);
  });

  it('sit right above their own button, centred on it within 2 px', () => {
    for (const f of ALL) {
      for (const [id, hit] of [['bombLabel', f.buttons.bomb], ['superLabel', f.buttons.super]] as const) {
        const b = f.boxes[id];
        const discTop = hit.y + (hit.h - BOMB_VISUAL) / 2;
        expect(b.y + b.h, `${name(f)} ${id}`).toBe(discTop);
        expect(Math.abs(b.x + b.w / 2 - rectCentre(hit).x), `${name(f)} ${id}`).toBeLessThanOrEqual(2);
        if (f.cls === 'cover') expect(b.x + b.w / 2, `${name(f)} ${id}`).toBe(rectCentre(hit).x);
      }
    }
  });

  it('stay inside the safe area', () => {
    for (const f of ALL) for (const id of ['bombLabel', 'superLabel'] as const) expect(inside(f.boxes[id], safe(f)), `${name(f)} ${id}`).toBe(true);
  });

  it('never overlap the other button, pause, any other HUD box or the arena', () => {
    for (const f of ALL) {
      const others: Array<[string, Rect]> = [
        ['pause', f.buttons.pause],
        ['play', f.playRect],
        ['arena', f.arena],
        ...(Object.entries(f.boxes) as Array<[BoxId, Rect]>).filter(([k, b]) => k !== 'bombLabel' && k !== 'superLabel' && b.w > 0 && b.h > 0),
      ];
      const pairs: Array<[string, Rect, Rect]> = [
        ['bombLabel', f.boxes.bombLabel, f.buttons.super],
        ['superLabel', f.boxes.superLabel, f.buttons.bomb],
      ];
      for (const [id, b, other] of pairs) {
        expect(overlaps(b, other), `${name(f)} ${id} vs the other button`).toBe(false);
        for (const [k, r] of others) expect(overlaps(b, r), `${name(f)} ${id} vs ${k}`).toBe(false);
      }
      expect(overlaps(f.boxes.bombLabel, f.boxes.superLabel), name(f)).toBe(false);
    }
  });
});

describe('HUD button DOM', () => {
  afterEach(() => {
    applyNeon(NEON_DEFAULT);
    vi.unstubAllGlobals();
  });

  const setup = (): { root: FakeEl; hud: ReturnType<typeof createHud>; find: (k: string) => FakeEl } => {
    const root = installFakeDocument();
    const hud = createHud(asParent(root), () => 0);
    const find = (k: string): FakeEl => {
      const e = root.all().find((x) => x.getAttribute('data-hud') === k);
      if (e === undefined) throw new Error(k);
      return e;
    };
    return { root, hud, find };
  };
  const svgText = (e: FakeEl): string | null => e.all().find((x) => x.tag === 'svg')?.getAttribute('data-vec') ?? null;

  it('labels: BOMB, the super name, BOOM on main', () => {
    const { hud, find } = setup();
    hud.layout(hudFrame(960, 411, ZERO, 1600, 1000), true);
    expect(svgText(find('bomb-label'))).toBe('BOMB');
    expect(svgText(find('super-label'))).toBe('HOMING');
    hud.setSuper('detonate');
    expect(svgText(find('super-label'))).toBe('DETONATE');
    hud.layout(hudFrame(832, 750, ZERO, 1600, 1000), true);
    expect(svgText(find('super-label'))).toBe('BOOM');
    hud.setSuper('turbo');
    expect(svgText(find('super-label'))).toBe('TURBO');
  });

  it('equal discs with a pixel cell ring, both hidden without touch input', () => {
    const { hud, find } = setup();
    const f = hudFrame(960, 411, ZERO, 1600, 1000);
    hud.layout(f, true);
    const b = find('bomb-button');
    const s = find('super-button');
    expect(b.style.width).toBe(`${BOMB_VISUAL}px`);
    expect(s.style.width).toBe(`${BOMB_VISUAL}px`);
    expect(b.style.left).toBe(s.style.left);
    for (const e of [b, s]) expect(e.all().filter((x) => x.style.cssText?.includes('currentColor')).length).toBeGreaterThanOrEqual(12);
    hud.layout(f, false);
    for (const k of ['bomb-button', 'super-button', 'bomb-label', 'super-label']) expect(find(k).style.display).toBe('none');
  });

  it('25 percent fill at rest, 50 pressed, dimmed with no bombs or while the super charges', () => {
    const { hud, find } = setup();
    hud.layout(hudFrame(960, 411, ZERO, 1600, 1000), true);
    const bomb = find('bomb-button');
    const sup = find('super-button');
    hud.update({ score: 0, multiplier: 1, lives: 3, bombs: 2, superCharge: 1 });
    expect(bomb.style.background).toMatch(/, 0\.25\)$/);
    expect(sup.style.background).toMatch(/, 0\.[2-7]\d*\)$/);
    hud.setHeld(true, true);
    expect(bomb.style.background).toMatch(/, 0\.5\)$/);
    expect(sup.style.background).toMatch(/, 0\.5\)$/);
    hud.setHeld(false, false);
    hud.update({ score: 0, multiplier: 1, lives: 3, bombs: 0, superCharge: 0.5 });
    expect(bomb.style.background).toMatch(/, 0\.08\)$/);
    expect(sup.style.background).toMatch(/^linear-gradient\(to top, .*, 0\.6\) 50%, .*, 0\.25\) 50%\)$/);
    expect(sup.style.background).not.toContain('conic');
    expect(bomb.style.border).toMatch(/^2px solid .*, 0\.45\)$/);
  });

  it('colours follow applyNeon', () => {
    const { hud, find } = setup();
    hud.listen(new Bus());
    hud.layout(hudFrame(960, 411, ZERO, 1600, 1000), true);
    hud.update({ score: 0, multiplier: 1, lives: 3, bombs: 2, superCharge: 1 });
    const before = find('super-button').style.background;
    applyNeon(0);
    const after = find('super-button').style.background;
    expect(after).not.toBe(before);
    expect(after).toBeTruthy();
  });

  it('super charge fill uses a contrasting colour from the rest fill and rises from the bottom', () => {
    const neon = { saturation: 0.4, glowAlpha: 0.5 };
    const d = discStyle({ fill: 0.6, rest: 0.25, rim: 0.45, cells: 0.3, glow: 1 }, SUPER_KEY, neon, 0.3, SUPER_CHARGE_KEY);
    expect(d.background).toMatch(/^linear-gradient\(to top, .* 30%, .* 30%\)$/);
    const [bright, rest] = d.background.slice('linear-gradient(to top, '.length, -1).split(' 30%, ').map((x) => x.replace(' 30%', ''));
    expect(bright).not.toBe(rest);
    expect(SUPER_CHARGE_KEY).not.toBe(SUPER_KEY);
  });

  it('a full super reads READY and the glow grows with the pulse', () => {
    const neon = { saturation: 0.4, glowAlpha: 0.5 };
    const calm = discStyle({ fill: 0.25, rest: 0.25, rim: 1, cells: 0.7, glow: 1 }, SUPER_KEY, neon);
    const peak = discStyle({ fill: 0.7, rest: 0.7, rim: 1, cells: 0.7, glow: 1.5 }, SUPER_KEY, neon);
    expect(peak.boxShadow).not.toBe(calm.boxShadow);
    expect(superLabel('homing', 'cover', true)).toBe('READY');
    expect(superLabel('homing', 'cover', false)).toBe('HOMING');
    expect(superLabel('detonate', 'main', true)).toBe('READY');
  });

  it('the hud label switches to READY when charged', () => {
    const { hud, find } = setup();
    hud.layout(hudFrame(960, 411, ZERO, 1600, 1000), true);
    hud.update({ score: 0, multiplier: 1, lives: 3, bombs: 2, superCharge: 0.5 });
    expect(find('super-label').getAttribute('aria-label')).toBe('HOMING');
    hud.update({ score: 0, multiplier: 1, lives: 3, bombs: 2, superCharge: 1 });
    expect(find('super-label').getAttribute('aria-label')).toBe('READY');
    hud.hide();
  });
});
