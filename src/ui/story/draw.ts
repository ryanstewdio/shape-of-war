// Scene visuals, drawn in code on a 2D canvas (docs/19 "Panel spec for the builder"). No images.
// Enemy icons and the ship come from the render shape specs through iconPaths (read only), boss
// silhouettes from the boss specs: grey with a light glitch while corrupted, palette colour when
// freed. Torus is nested regular polygons turning slowly; Vecta is a larger grey ship outline with
// a slow opacity flicker, always far off. Every pulse is at most 1 Hz and the glitch steps twice a
// second, so nothing flashes faster than 3 times per second. Only drawPanel touches the context.
import { Kind } from '../../game/world';
import { BOSS_IDS, type BossId } from '../../levelgen/leveldef';
import { BOSS_OPEN_STEPS } from '../../render/bossLook';
import { BOSS_SPECS } from '../../render/bossShapes';
import { SHAPE_SPECS, type ShapeSpec } from '../../render/shapeSpecs';
import type { Mark, Panel, Scene } from '../../story/scenes';
import { GUARDIAN_ORDER } from '../../story/scenes';
import { foeSpec, iconPaths, type FoeKind, type IconPath } from '../enemyIntro';

/** Seconds of the slow reveal at the start of every panel. */
export const REVEAL_SEC = 0.8;
/** Seconds of a colour drain or return tween. */
export const TWEEN_SEC = 1.6;
/** Glow pulse rate in Hz (alpha sine). */
export const PULSE_HZ = 1;
/** Glitch steps per second on a corrupted guardian (below the 3 per second flash limit). */
export const GLITCH_HZ = 2;

const TAU = Math.PI * 2;

/** Pure: 0 to 1 ease in and out. */
export function ease(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/** Pure: the slow reveal alpha of a panel at `age` seconds. */
export function revealAlpha(age: number): number {
  return ease(age / REVEAL_SEC);
}

/** Pure: glow pulse 0 to 1 at PULSE_HZ. */
export function pulse(t: number, hz = PULSE_HZ): number {
  return 0.5 + 0.5 * Math.sin(t * TAU * hz);
}

/** Pure: colour saturation (0 grey, 1 full palette) of the guardian or grid in a panel at `age`. */
export function panelSaturation(visual: Panel['visual'], age: number): number {
  switch (visual) {
    case 'bossTouched':
      return 0.55 * (1 - ease(age / TWEEN_SEC));
    case 'bossFreed':
      return ease(age / TWEEN_SEC);
    case 'boss':
    case 'bossAttack':
      return 0.12;
    case 'gridDrain':
      return 1 - 0.8 * ease(age / (TWEEN_SEC * 1.5));
    case 'dimSpread':
      return 1 - 0.85 * ease(age / (TWEEN_SEC * 1.5));
    default:
      return 1;
  }
}

/** Pure: Torus radius as a share of the stage, small in act 1 and larger each act. */
export function torusScale(act: number): number {
  return 0.1 + 0.03 * (Math.min(5, Math.max(1, act)) - 1);
}

/** Pure: the grey glitch offset in px, stepping GLITCH_HZ times per second. */
export function glitchOffset(t: number, px: number): number {
  const step = Math.floor(t * GLITCH_HZ);
  return step % 3 === 0 ? px : step % 3 === 1 ? -px * 0.5 : 0;
}

const cache = new Map<string, IconPath[]>();
function paths(key: string, spec: ShapeSpec, px: number): IconPath[] {
  const k = `${key}@${Math.round(px)}`;
  let p = cache.get(k);
  if (p === undefined) {
    p = iconPaths(spec, Math.round(px));
    cache.set(k, p);
  }
  return p;
}

const shipSpec = (): ShapeSpec => SHAPE_SPECS[Kind.Ship];
function bossSpec(id: BossId): ShapeSpec {
  const i = Math.max(0, BOSS_IDS.indexOf(id));
  return BOSS_SPECS[i * BOSS_OPEN_STEPS] ?? shipSpec();
}

interface DrawOpts {
  alpha: number;
  /** Stroke everything in this colour instead (Vecta). */
  colour?: string;
  glow?: number;
  /** Rotation in radians. */
  rot?: number;
}

function drawPaths(ctx: CanvasRenderingContext2D, ps: readonly IconPath[], cx: number, cy: number, px: number, o: DrawOpts): void {
  ctx.save();
  ctx.translate(cx, cy);
  if (o.rot !== undefined) ctx.rotate(o.rot);
  ctx.translate(-px / 2, -px / 2);
  ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of ps) {
    const colour = o.colour ?? p.colour;
    ctx.beginPath();
    for (let i = 0; i + 1 < p.pts.length; i += 2) {
      const x = p.pts[i] ?? 0;
      const y = p.pts[i + 1] ?? 0;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (p.closed) ctx.closePath();
    if (p.fill > 0 && o.colour === undefined) {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * p.fill;
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.globalAlpha = a;
    }
    if (p.width > 0) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(1.5, Math.min(p.width, 2 + px * 0.012));
      ctx.shadowColor = colour;
      ctx.shadowBlur = o.glow ?? 10;
      ctx.stroke();
    }
  }
  ctx.restore();
}

interface Stage {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  u: number;
  cx: number;
  cy: number;
  t: number;
  age: number;
  a: number;
}

function grid(s: Stage, alpha: number, radius = Number.POSITIVE_INFINITY): void {
  const { ctx, w, h, u } = s;
  const step = Math.max(16, u / 9);
  ctx.save();
  if (Number.isFinite(radius)) {
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, Math.max(0, radius), 0, TAU);
    ctx.clip();
  }
  ctx.strokeStyle = `hsla(230, 60%, 55%, ${alpha.toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = (s.cx % step) - step; x < w + step; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = (s.cy % step) - step; y < h + step; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Grey wash from the far corners: amount 0 none, 1 the whole edge is grey. */
function drain(s: Stage, amount: number): void {
  if (amount <= 0.001) return;
  const { ctx, w, h } = s;
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(s.cx, s.cy, r * (1 - 0.8 * amount), s.cx, s.cy, r);
  g.addColorStop(0, 'rgba(6, 8, 14, 0)');
  g.addColorStop(1, `rgba(40, 42, 48, ${(0.85 * amount).toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Grey static creeping inward along the lattice: amount 0 none, 1 deep. Short grey dashes on a shrinking frame. */
function staticCreep(s: Stage, amount: number): void {
  if (amount <= 0.001) return;
  const { ctx, w, h, t } = s;
  const step = Math.floor(t * GLITCH_HZ);
  const depth = Math.min(w, h) * 0.38 * amount;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 46; i++) {
    const edge = i % 4;
    const d = (((i * 53 + step * 17) % 100) / 100) * depth;
    const along = (((i * 29 + step * 11) % 100) / 100) * (edge < 2 ? w : h);
    const len = 6 + ((i * 7) % 14);
    if (edge === 0) {
      ctx.moveTo(along, d);
      ctx.lineTo(along + len, d);
    } else if (edge === 1) {
      ctx.moveTo(along, h - d);
      ctx.lineTo(along + len, h - d);
    } else if (edge === 2) {
      ctx.moveTo(d, along);
      ctx.lineTo(d, along + len);
    } else {
      ctx.moveTo(w - d, along);
      ctx.lineTo(w - d, along + len);
    }
  }
  stroke(s, 'hsl(0, 0%, 62%)', 1.5, 0.5 * s.a, []);
  ctx.restore();
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.32;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Ten four point stars above the grid; `lit` of them shine, the newest fades in slowly. */
function stars(s: Stage, lit: number): void {
  const { ctx, w, u } = s;
  const r = Math.max(4, u * 0.022);
  const gap = Math.min(w / 12, r * 5);
  const x0 = s.cx - gap * 4.5;
  const y = Math.max(r * 2, s.h * 0.09);
  for (let i = 0; i < 10; i++) {
    const on = i < lit;
    const newest = i === lit - 1;
    const k = newest ? ease((s.age - 0.6) / 1.2) : 1;
    ctx.save();
    starPath(ctx, x0 + i * gap, y, r);
    if (on) {
      ctx.globalAlpha = 0.25 + 0.75 * k;
      ctx.fillStyle = 'hsl(50, 95%, 70%)';
      ctx.shadowColor = 'hsl(50, 95%, 60%)';
      ctx.shadowBlur = 8 + 6 * k * pulse(s.t, 0.5);
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = 'hsl(220, 10%, 55%)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function ship(s: Stage, x: number, y: number, px: number, alpha: number): void {
  drawPaths(s.ctx, paths('ship', shipSpec(), px), x, y, px, { alpha, glow: 8 + 10 * pulse(s.t) });
}

/** Vecta: the ship outline, larger than the pilot's, grey, slow flicker. Never close. */
function vecta(s: Stage, x: number, y: number, px: number, clarity: number): void {
  const flicker = 0.18 + 0.14 * clarity + 0.12 * pulse(s.t, 0.4);
  drawPaths(s.ctx, paths('ship', shipSpec(), px), x, y, px, { alpha: flicker * s.a, colour: GREY, glow: 6 });
}

/** Torus: triangle, square, pentagon, hexagon and circle on one centre, each turning at its own speed. */
function torus(s: Stage, x: number, y: number, r: number, bright: number): void {
  const { ctx } = s;
  const rings: readonly [number, number, number][] = [
    [3, 1, 0.21],
    [4, 0.82, -0.15],
    [5, 0.66, 0.11],
    [6, 0.5, -0.24],
    [0, 0.34, 0],
  ];
  ctx.save();
  ctx.globalAlpha = s.a * (0.7 + 0.3 * bright);
  ctx.strokeStyle = 'hsl(45, 70%, 88%)';
  ctx.shadowColor = 'hsl(45, 90%, 62%)';
  ctx.shadowBlur = 8 + 10 * bright * pulse(s.t);
  ctx.lineWidth = Math.max(1.5, r * 0.035);
  for (const [sides, k, speed] of rings) {
    const rr = r * k;
    const rot = s.t * speed - Math.PI / 2;
    ctx.beginPath();
    if (sides === 0) ctx.arc(x, y, rr, 0, TAU);
    else {
      for (let i = 0; i <= sides; i++) {
        const a = rot + (i / sides) * TAU;
        if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Small Torus icon drawn before a guide line in the text box. */
export function drawTorusIcon(ctx: CanvasRenderingContext2D, px: number, t: number): void {
  ctx.clearRect(0, 0, px, px);
  torus({ ctx, w: px, h: px, u: px, cx: px / 2, cy: px / 2, t, age: 9, a: 1 }, px / 2, px / 2, px * 0.44, 0.6);
}

function foeIcon(s: Stage, k: FoeKind, x: number, y: number, px: number, alpha: number, rot = 0): void {
  drawPaths(s.ctx, paths(`foe:${k}`, foeSpec(k), px), x, y, px, { alpha, rot });
}

/** Corrupted grey for guardian outlines and Vecta. */
export const GREY = 'hsl(220, 6%, 62%)';

/**
 * A guardian silhouette. `sat` 0 is grey with a light glitch, 1 is full palette colour; between,
 * grey and colour cross fade (the drain and return tweens).
 */
function boss(s: Stage, id: BossId, x: number, y: number, px: number, sat: number, alpha: number): void {
  const ps = paths(`boss:${id}`, bossSpec(id), px);
  const k = Math.max(0, Math.min(1, sat));
  const glitch = k < 0.5 ? glitchOffset(s.t, px * 0.012) : 0;
  if (k < 0.999) drawPaths(s.ctx, ps, x + glitch, y, px, { alpha: alpha * (1 - k) * 0.85, colour: GREY, glow: 4 });
  if (k > 0.001) drawPaths(s.ctx, ps, x + glitch, y, px, { alpha: alpha * k, glow: 6 + 10 * k });
}

function stroke(s: Stage, colour: string, width: number, alpha: number, dash: readonly number[] = []): void {
  const { ctx } = s;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.shadowColor = colour;
  ctx.shadowBlur = 6;
  ctx.setLineDash([...dash]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Simple strokes around a subject at (x, y) of size px, in `colour`. Ship at (sx, sy). */
function marks(s: Stage, ms: readonly Mark[], x: number, y: number, px: number, sx: number, sy: number, colour: string): void {
  const { ctx, t, age } = s;
  const r = px / 2;
  for (const m of ms) {
    ctx.save();
    switch (m) {
      case 'static': {
        // grey static on the shape: a few short grey dashes stepping twice a second
        const step = Math.floor(t * GLITCH_HZ);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const yy = y - r * 0.6 + ((i * 37 + step * 23) % 100) / 100 * r * 1.2;
          ctx.moveTo(x - r * 0.6, yy);
          ctx.lineTo(x + r * 0.6, yy);
        }
        stroke(s, 'hsl(0, 0%, 60%)', 1.5, 0.35 * s.a, [4, 6]);
        break;
      }
      case 'shots': {
        ctx.beginPath();
        const dx = x - sx;
        const dy = y - sy;
        const len = Math.hypot(dx, dy) || 1;
        const off = (age * 0.6) % 1;
        for (let i = 0; i < 3; i++) {
          const f = 0.2 + ((i * 0.25 + off) % 1) * 0.6;
          const px0 = sx + dx * f;
          const py0 = sy + dy * f;
          ctx.moveTo(px0, py0);
          ctx.lineTo(px0 + (dx / len) * 10, py0 + (dy / len) * 10);
        }
        stroke(s, 'hsl(55, 95%, 70%)', 3, s.a);
        break;
      }
      case 'shards': {
        const k = ease((age - 0.6) / 1.4);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + 0.3;
          const d = r * (0.4 + 1.1 * k);
          const qx = x + Math.cos(a) * d;
          const qy = y + Math.sin(a) * d;
          ctx.beginPath();
          ctx.moveTo(qx, qy - 5);
          ctx.lineTo(qx + 3, qy);
          ctx.lineTo(qx, qy + 5);
          ctx.lineTo(qx - 3, qy);
          ctx.closePath();
          stroke(s, 'hsl(95, 85%, 65%)', 2, s.a * (0.4 + 0.6 * k));
        }
        break;
      }
      case 'path': {
        const wall = Math.min(s.w - 8, x + r * 3);
        ctx.beginPath();
        ctx.moveTo(wall, y - r * 3);
        ctx.lineTo(wall, y + r * 3);
        stroke(s, 'hsl(230, 50%, 65%)', 2, 0.6 * s.a);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(wall, y + r);
        ctx.lineTo(x - r, y + r * 2.2);
        stroke(s, colour, 2, 0.8 * s.a, [3, 7]);
        break;
      }
      case 'lane': {
        ctx.beginPath();
        ctx.moveTo(x, y);
        const k = ease(age / 1.0);
        ctx.lineTo(x + (sx - x) * 1.4 * k, y + (sy - y) * 1.4 * k);
        stroke(s, colour, 3, (0.45 + 0.4 * pulse(t)) * s.a, [10, 6]);
        break;
      }
      case 'slime': {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(x - r * 1.6 + i * r * 1.3, y + r * 1.3 + (i % 2) * 8, r * 0.5, r * 0.22, 0, 0, TAU);
          ctx.fillStyle = 'hsla(292, 60%, 45%, 0.35)';
          ctx.globalAlpha = s.a;
          ctx.fill();
          stroke(s, 'hsl(292, 60%, 60%)', 1.5, 0.6 * s.a);
        }
        break;
      }
      case 'mines': {
        const pts: readonly [number, number][] = [
          [0.12, 0.2],
          [0.88, 0.25],
          [0.1, 0.82],
          [0.9, 0.8],
          [0.5, 0.92],
        ];
        for (const [fx, fy] of pts) {
          const mx = fx * s.w;
          const my = fy * s.h;
          ctx.beginPath();
          ctx.arc(mx, my, 5, 0, TAU);
          ctx.moveTo(mx - 8, my);
          ctx.lineTo(mx + 8, my);
          ctx.moveTo(mx, my - 8);
          ctx.lineTo(mx, my + 8);
          stroke(s, 'hsl(75, 75%, 55%)', 1.5, (0.5 + 0.3 * pulse(t)) * s.a);
        }
        break;
      }
      case 'ring': {
        const rr = r * (2.2 - 0.6 * ((age * 0.25) % 1));
        ctx.beginPath();
        ctx.arc(x, y, rr, 0.5, TAU - 0.2);
        stroke(s, colour, 2.5, (0.5 + 0.4 * pulse(t)) * s.a);
        break;
      }
      case 'flock': {
        for (let i = 0; i < 5; i++) {
          const a = -0.9 + i * 0.45;
          foeIcon(s, 'dart', x - r * 1.6 + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 1.6, Math.max(14, px * 0.3), s.a, a + Math.PI / 2);
        }
        break;
      }
      case 'shield': {
        const face = Math.atan2(sy - y, sx - x);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.95, face - 0.9, face + 0.9);
        stroke(s, 'hsl(200, 95%, 80%)', 4, (0.7 + 0.3 * pulse(t)) * s.a);
        break;
      }
      case 'gate': {
        ctx.beginPath();
        ctx.rect(x - r * 1.3, y - r * 1.5, r * 2.6, r * 3);
        stroke(s, colour, 2, 0.4 * s.a);
        break;
      }
      case 'clock': {
        ctx.beginPath();
        ctx.arc(x, y, r * 1.5, 0, TAU);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          ctx.moveTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35);
          ctx.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5);
        }
        const hand = t * 0.3;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(hand) * r * 1.3, y + Math.sin(hand) * r * 1.3);
        stroke(s, colour, 1.5, 0.5 * s.a);
        break;
      }
      case 'arms': {
        const a = Math.sin(t * 0.5) * 0.8;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * r * 2.4, y - Math.sin(a) * r * 2.4);
        ctx.lineTo(x + Math.cos(a) * r * 2.4, y + Math.sin(a) * r * 2.4);
        stroke(s, colour, 4, (0.4 + 0.5 * pulse(t, 0.5)) * s.a);
        break;
      }
      case 'pods':
      case 'anchors': {
        for (let i = 0; i < 3; i++) {
          const a = t * 0.5 + (i / 3) * TAU;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4, r * 0.16, 0, TAU);
          stroke(s, colour, 2.5, (0.55 + 0.45 * pulse(t)) * s.a);
        }
        break;
      }
      case 'turrets': {
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + (i / 4) * TAU;
          const on = Math.floor(t) % 4 === i;
          ctx.beginPath();
          ctx.rect(x + Math.cos(a) * r * 0.95 - 6, y + Math.sin(a) * r * 0.95 - 6, 12, 12);
          stroke(s, colour, 2, (on ? 0.95 : 0.45) * s.a);
        }
        break;
      }
      case 'bar': {
        const a = t * 0.3;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * r * 1.8, y - Math.sin(a) * r * 1.8);
        ctx.lineTo(x + Math.cos(a) * r * 1.8, y + Math.sin(a) * r * 1.8);
        stroke(s, 'hsl(40, 95%, 75%)', 5, (0.55 + 0.35 * pulse(t)) * s.a);
        break;
      }
      case 'trail': {
        ctx.beginPath();
        ctx.ellipse(s.cx, s.cy, s.w * 0.44, s.h * 0.4, 0, t * 0.4, t * 0.4 + 2.2);
        stroke(s, colour, 3, 0.6 * s.a);
        break;
      }
      case 'bomb': {
        const k = (age * 0.5) % 1;
        ctx.beginPath();
        ctx.arc(sx, sy, k * s.u * 0.5, 0, TAU);
        stroke(s, 'hsl(200, 75%, 85%)', 3, (1 - k) * 0.6 * s.a);
        break;
      }
      case 'pull': {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + t * 0.1;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * r * 3, y + Math.sin(a) * r * 3);
          ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * r * 1.6, y + Math.sin(a + 0.4) * r * 1.6, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
          stroke(s, 'hsl(230, 60%, 65%)', 1.5, 0.5 * s.a);
        }
        break;
      }
      case 'copies':
      case 'flash':
        break; // drawn with the guardian itself
    }
    ctx.restore();
  }
}

const BOSS_HUE: Readonly<Record<BossId, string>> = {
  brood: 'hsl(110, 90%, 56%)',
  warden: 'hsl(224, 95%, 64%)',
  spindle: 'hsl(45, 100%, 60%)',
  ember: 'hsl(38, 100%, 60%)',
  mirage: 'hsl(320, 95%, 62%)',
  gravitas: 'hsl(284, 95%, 62%)',
  bastion: 'hsl(4, 100%, 62%)',
  tempest: 'hsl(4, 100%, 62%)',
  twins: 'hsl(4, 100%, 62%)',
  prism: 'hsl(190, 80%, 70%)',
};

/** Pure: the stroke colour of marks around a guardian at saturation `sat`. */
export function markColour(id: BossId | undefined, sat: number): string {
  if (id === undefined) return 'hsl(185, 90%, 65%)';
  return sat < 0.5 ? 'hsl(220, 8%, 62%)' : BOSS_HUE[id];
}

/**
 * Edge: draw one panel on a canvas of w x h CSS px (the context is already scaled for the DPR).
 * `t` is seconds since the scene opened, `age` seconds since the panel was shown.
 */
export function drawPanel(ctx: CanvasRenderingContext2D, w: number, h: number, sc: Scene, p: Panel, t: number, age: number, callsign: string): void {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgb(3, 5, 12)';
  ctx.fillRect(0, 0, w, h);
  const u = Math.min(w, h);
  const s: Stage = { ctx, w, h, u, cx: w / 2, cy: h * 0.56, t, age, a: revealAlpha(age) };
  const sat = panelSaturation(p.visual, age);
  const ms = p.marks ?? [];
  const big = u * 0.42;
  const shipPx = Math.max(24, u * 0.16);

  // The grid behind every panel; the opening draws it out from one dot.
  if (p.visual === 'lattice') {
    const k = ease((age - 0.4) / 1.6);
    grid(s, 0.32, k * Math.hypot(w, h));
    ctx.save();
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, 3 + 2 * pulse(t), 0, TAU);
    ctx.fillStyle = 'hsl(190, 90%, 80%)';
    ctx.shadowColor = 'hsl(190, 90%, 60%)';
    ctx.shadowBlur = 14;
    ctx.globalAlpha = revealAlpha(age);
    ctx.fill();
    ctx.restore();
    ship(s, s.cx, s.cy + u * 0.25, shipPx * 0.7, ease((age - 1.4) / 1));
  } else {
    // shipName brightens the grid once, a single slow swell (no flash)
    const swell = p.visual === 'shipName' ? 0.25 * Math.sin(Math.PI * Math.min(1, Math.max(0, (age - 0.8) / 1.2))) : 0;
    grid(s, (p.visual === 'bossFreed' ? 0.14 + 0.16 * sat : 0.18) + swell);
  }

  switch (p.visual) {
    case 'lattice':
      break;
    case 'ship':
      ship(s, s.cx, s.cy, shipPx * 1.4, s.a);
      break;
    case 'shipName': {
      ship(s, s.cx, s.cy + u * 0.06, shipPx * 1.3, 1);
      const shown = callsign.slice(0, Math.floor(Math.max(0, age - 0.2) * 8));
      ctx.save();
      ctx.font = `700 ${Math.round(Math.max(18, u * 0.1))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'hsl(185, 90%, 82%)';
      ctx.shadowColor = 'hsl(185, 90%, 55%)';
      ctx.shadowBlur = 12;
      ctx.fillText(shown, s.cx, s.cy - u * 0.16);
      ctx.restore();
      break;
    }
    case 'gridDrain':
      drain(s, 1 - sat);
      ship(s, s.cx, s.cy, shipPx * 0.6, 1);
      break;
    case 'gridFull':
      ship(s, s.cx, s.cy, shipPx * 0.6, 1);
      break;
    case 'dimSpread':
      drain(s, 1 - sat);
      staticCreep(s, 1 - sat);
      ship(s, s.cx, s.cy, shipPx * 0.6, 1);
      break;
    case 'dimSwarm': {
      drain(s, 0.35);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + t * 0.15;
        foeIcon(s, 'grunt', s.cx + Math.cos(a) * u * 0.34, s.cy + Math.sin(a) * u * 0.26, Math.max(24, u * 0.1), s.a * 0.8, 0);
      }
      break;
    }
    case 'torus':
      ship(s, s.cx - u * 0.28, s.cy + u * 0.05, shipPx, 1);
      torus(s, s.cx + u * 0.18, s.cy - u * 0.02, u * torusScale(sc.act) * 1.6, sc.act / 5);
      break;
    case 'foe':
    case 'foeAction': {
      const foes = p.foes ?? [];
      const action = p.visual === 'foeAction';
      const fx = action ? s.cx + u * 0.22 : s.cx;
      const fy = action ? s.cy - u * 0.08 : s.cy;
      const shipX = s.cx - u * 0.36;
      const shipY = s.cy + u * 0.18;
      const px = Math.max(40, u * (foes.length > 1 ? 0.26 : 0.34));
      foes.forEach((k, i) => {
        const off = (i - (foes.length - 1) / 2) * px * 1.1;
        const spin = k === 'wanderer' || k === 'pinwheel' ? t * (k === 'pinwheel' ? 0.4 : 0.8) : Math.sin(t * 0.8) * 0.08;
        const breathe = k === 'grunt' ? 1 + 0.06 * pulse(t) : 1;
        const fade = k === 'blink' ? 0.45 + 0.55 * pulse(t, 0.5) : 1;
        foeIcon(s, k, fx + off, fy + Math.sin(t * 0.9 + i) * 3, px * breathe, s.a * fade, spin);
      });
      if (action) ship(s, shipX + Math.sin(t * 0.7) * 6, shipY, shipPx, s.a);
      marks(s, ms, fx, fy, px, shipX, shipY, 'hsl(185, 90%, 65%)');
      break;
    }
    case 'boss':
    case 'bossTouched':
    case 'bossAttack':
    case 'bossFreed': {
      const id = p.boss ?? 'brood';
      const freed = p.visual === 'bossFreed';
      const scale = freed ? 1 - 0.15 * ease(age / TWEEN_SEC) : 1;
      if (ms.includes('copies') && !freed) {
        const n = p.visual === 'bossTouched' ? 4 : 2;
        for (let i = 1; i <= n; i++) {
          const a = (i / n) * TAU + t * 0.1;
          boss(s, id, s.cx + Math.cos(a) * u * 0.22, s.cy + Math.sin(a) * u * 0.1, big * 0.8, sat, 0.25 * s.a * pulse(t + i, 0.5));
        }
      }
      boss(s, id, s.cx, s.cy, big * scale, sat, s.a);
      if (ms.includes('flash')) {
        ctx.save();
        ctx.globalAlpha = 0.35 * pulse(t, 0.5) * s.a; // a slow white swell, not a strobe
        ctx.beginPath();
        ctx.arc(s.cx, s.cy, big * 0.35, 0, TAU);
        ctx.fillStyle = 'hsl(0, 0%, 100%)';
        ctx.shadowColor = 'hsl(0, 0%, 100%)';
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.restore();
      }
      const shipX = s.cx - u * 0.42;
      const shipY = s.cy + u * 0.3;
      if (p.visual === 'bossAttack') ship(s, shipX, shipY, shipPx * 0.8, s.a);
      if (p.visual === 'bossTouched') {
        const k = ease(age / 3);
        vecta(s, s.cx - u * 0.55 + k * u * 1.1, s.cy - u * 0.3, shipPx * 1.8, 0.2);
      }
      marks(s, ms, s.cx, s.cy, big, shipX, shipY, markColour(id, sat));
      if (freed) stars(s, p.stars ?? 0);
      break;
    }
    case 'vectaFar':
      stars(s, 6);
      ship(s, s.cx - u * 0.25, s.cy + u * 0.22, shipPx, 1);
      vecta(s, s.cx + u * 0.42, s.cy - u * 0.28, shipPx * 1.3, ease(age / 2));
      break;
    case 'vectaTruth': {
      const k = ease(age / 2.4);
      GUARDIAN_ORDER.forEach((id, i) => {
        const a = (i / 10) * TAU - Math.PI / 2;
        const gx = s.cx + Math.cos(a) * u * 0.36;
        const gy = s.cy + Math.sin(a) * u * 0.3;
        boss(s, id, gx, gy, u * 0.13, 1 - k * 0.9, s.a);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + (s.cx - gx) * k, gy + (s.cy - gy) * k);
        stroke(s, BOSS_HUE[id], 1.5, 0.5 * s.a * (1 - k * 0.5));
        ctx.restore();
      });
      vecta(s, s.cx, s.cy, shipPx * 1.6, 0.5 * k);
      break;
    }
    case 'vectaFlee': {
      const k = ease(age / 4);
      ctx.save();
      ctx.beginPath();
      starPath(ctx, s.cx + u * 0.4, s.h * 0.12, 7);
      ctx.strokeStyle = 'hsl(240, 10%, 40%)';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = s.a;
      ctx.stroke();
      ctx.restore();
      stars(s, 10);
      vecta(s, s.cx + u * 0.4 * k, s.cy - u * 0.1 - (s.cy - s.h * 0.12) * k * 0.9, shipPx * (1.4 - 1.1 * k), 0.5 * (1 - k));
      ship(s, s.cx - u * 0.3, s.cy + u * 0.25, shipPx, 1);
      break;
    }
  }
  ctx.restore();
}
