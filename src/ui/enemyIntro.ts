// R3 (Ryan, build a4d6be6): the intro card introduces each enemy kind the run has not met yet by
// icon, name and a one word type. The icon is the enemy's own neon shape, drawn on a small 2D
// canvas from the render shape specs (read only), so no image asset is involved. Hazards placed by
// the level (gravity wells, spawners) count as kinds too. Pure except iconCanvas, the DOM edge.
import { Kind } from '../game/world';
import type { EnemyKind, LevelDef } from '../levelgen/leveldef';
import { BASE_PALETTE, type PaletteKey } from '../render/neon';
import { SHAPE_SPECS, type ShapePrim, type ShapeSpec } from '../render/shapeSpecs';
import { el } from './dom';

/** Every kind the card can introduce: the roster kinds plus the level's placed hazards. */
export type FoeKind = EnemyKind | 'well' | 'spawner';

/** The one word types the card uses (R3 brief). */
export type FoeType = 'chaser' | 'shooter' | 'splitter' | 'hazard' | 'swarm' | 'tank';

export interface FoeInfo {
  readonly name: string;
  readonly type: FoeType;
}

/** Name and type per kind, from the behaviour tables in docs/01 section 6 and docs/11. */
export const FOE_INFO: Readonly<Record<FoeKind, FoeInfo>> = {
  grunt: { name: 'Grunt', type: 'chaser' },
  wanderer: { name: 'Wanderer', type: 'hazard' },
  weaver: { name: 'Weaver', type: 'chaser' },
  pinwheel: { name: 'Pinwheel', type: 'tank' },
  dart: { name: 'Dart', type: 'swarm' },
  snake: { name: 'Snake', type: 'tank' },
  charger: { name: 'Charger', type: 'chaser' },
  bulwark: { name: 'Bulwark', type: 'tank' },
  blink: { name: 'Blink', type: 'chaser' },
  swirl: { name: 'Swirl', type: 'chaser' },
  sower: { name: 'Sower', type: 'hazard' },
  splime: { name: 'Splime', type: 'splitter' },
  leaver: { name: 'Leaver', type: 'splitter' },
  well: { name: 'Gravity well', type: 'hazard' },
  spawner: { name: 'Spawner', type: 'swarm' },
};

const FOE_KIND: Readonly<Record<FoeKind, Exclude<Kind, Kind.None>>> = {
  grunt: Kind.Grunt,
  wanderer: Kind.Wanderer,
  weaver: Kind.Weaver,
  pinwheel: Kind.Pinwheel,
  dart: Kind.Dart,
  snake: Kind.SnakeHead,
  charger: Kind.Charger,
  bulwark: Kind.Bulwark,
  blink: Kind.Blink,
  swirl: Kind.Swirl,
  sower: Kind.Sower,
  splime: Kind.Splime,
  leaver: Kind.Leaver,
  well: Kind.GravityWell,
  spawner: Kind.Spawner,
};

/** The parts of a LevelDef that name its kinds. */
export type FoeSource = Pick<LevelDef, 'roster'> & { hazards?: Partial<LevelDef['hazards']> };

/** Pure: the kinds a level puts in play: roster order, then wells and spawners when placed. */
export function levelFoes(def: FoeSource): FoeKind[] {
  const out: FoeKind[] = [];
  for (const e of def.roster) if (!out.includes(e.kind)) out.push(e.kind);
  if ((def.hazards?.wells?.length ?? 0) > 0) out.push('well');
  if ((def.hazards?.spawners?.length ?? 0) > 0) out.push('spawner');
  return out;
}

/** Pure: the kinds of `def` that no earlier level of the run put in play, in the level's order. */
export function newFoes(def: FoeSource, earlier: readonly FoeSource[]): FoeKind[] {
  const seen = new Set<FoeKind>();
  for (const e of earlier) for (const k of levelFoes(e)) seen.add(k);
  return levelFoes(def).filter((k) => !seen.has(k));
}

export interface FoeLine {
  readonly kind: FoeKind;
  readonly name: string;
  readonly type: FoeType;
}

/** Pure: the card lines for a list of kinds. */
export function foeLines(kinds: readonly FoeKind[]): FoeLine[] {
  return kinds.map((k) => ({ kind: k, name: FOE_INFO[k].name, type: FOE_INFO[k].type }));
}

/** The shape spec a kind's icon is drawn from. */
export function foeSpec(k: FoeKind): ShapeSpec {
  return SHAPE_SPECS[FOE_KIND[k]];
}

/** Pure: CSS colour of a palette key ("hsl(215, 75%, 55%)"). */
export function paletteCss(key: PaletteKey, alpha = 1): string {
  const [h, s, l] = BASE_PALETTE[key];
  const sat = Math.round(s * 100);
  const lit = Math.round(l * 100);
  return alpha >= 1 ? `hsl(${h}, ${sat}%, ${lit}%)` : `hsla(${h}, ${sat}%, ${lit}%, ${alpha})`;
}

/** One closed or open path in icon pixels, with its stroke and fill. */
export interface IconPath {
  readonly pts: readonly number[];
  readonly closed: boolean;
  readonly colour: string;
  /** Stroke width in icon px, 0 for none. */
  readonly width: number;
  /** Fill alpha, 0 for none. */
  readonly fill: number;
}

const CIRCLE_STEPS = 24;

function primPoints(p: ShapePrim): { pts: number[]; closed: boolean } {
  switch (p.t) {
    case 'poly':
      return { pts: [...p.pts], closed: true };
    case 'line':
      return { pts: [...p.pts], closed: false };
    case 'rect':
      return { pts: [-p.w / 2, -p.h / 2, p.w / 2, -p.h / 2, p.w / 2, p.h / 2, -p.w / 2, p.h / 2], closed: true };
    case 'circle':
    case 'regularPoly': {
      const n = p.t === 'circle' ? CIRCLE_STEPS : p.sides;
      const rot = p.t === 'circle' ? 0 : p.rot;
      const pts: number[] = [];
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        pts.push(Math.cos(a) * p.r, Math.sin(a) * p.r);
      }
      return { pts, closed: true };
    }
  }
}

/**
 * Pure: a shape spec as paths in a square icon of `px` pixels, centred, the spec radius filling
 * 80 percent of the half width, facing up (the spec faces +x). Colours come from the layer, else
 * the spec tint, else white.
 */
export function iconPaths(spec: ShapeSpec, px: number): IconPath[] {
  const half = px / 2;
  const k = (half * 0.8) / Math.max(1, spec.radius);
  const out: IconPath[] = [];
  for (const layer of spec.layers) {
    const key: PaletteKey = layer.colour ?? spec.tint ?? 'white';
    const colour = paletteCss(key);
    for (const prim of layer.prims) {
      const { pts, closed } = primPoints(prim);
      const mapped: number[] = [];
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const x = pts[i] ?? 0;
        const y = pts[i + 1] ?? 0;
        // Rotate -90 degrees so the heading points up the card.
        mapped.push(Math.round((half + y * k) * 100) / 100, Math.round((half - x * k) * 100) / 100);
      }
      out.push({ pts: mapped, closed, colour, width: layer.width > 0 ? Math.max(1, layer.width * k) : 0, fill: layer.fill });
    }
  }
  return out;
}

/** Icon edge in CSS px. */
export const FOE_ICON_PX = 36;

/** Edge: the kind's neon shape on a small canvas. Blank where the 2D context is missing (tests). */
export function iconCanvas(kind: FoeKind, px = FOE_ICON_PX): HTMLCanvasElement {
  const c = el('canvas', 'sow-foe-icon');
  const dpr = Math.min(3, typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);
  c.width = Math.round(px * dpr);
  c.height = Math.round(px * dpr);
  c.style.width = `${px}px`;
  c.style.height = `${px}px`;
  c.setAttribute('data-foe', kind);
  c.setAttribute('aria-hidden', 'true');
  const ctx = typeof c.getContext === 'function' ? c.getContext('2d') : null;
  if (ctx === null) return c;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of iconPaths(foeSpec(kind), px * dpr)) {
    ctx.beginPath();
    for (let i = 0; i + 1 < p.pts.length; i += 2) {
      const x = p.pts[i] ?? 0;
      const y = p.pts[i + 1] ?? 0;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (p.closed) ctx.closePath();
    if (p.fill > 0) {
      ctx.globalAlpha = p.fill;
      ctx.fillStyle = p.colour;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (p.width > 0) {
      ctx.strokeStyle = p.colour;
      ctx.lineWidth = p.width;
      ctx.shadowColor = p.colour;
      ctx.shadowBlur = 5 * dpr; // same small fixed halo as the par reward icons (parReward.ts)
      ctx.stroke();
    }
  }
  return c;
}
