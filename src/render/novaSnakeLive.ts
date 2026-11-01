// G6 item j: the nova snake live path, pure (no pixi.js, no PRNG). The renderer calls these every
// frame and only paints what they return, so a test can run the real game step and this exact
// bookkeeping (not a hand built state).
// Before: a snake counted as a nova snake only when the renderer matched its head to a well spawn
// event by distance (90 u) and age (0.25 s) in the entity pass (wellArrive.ts emergeTrack), and the
// tracked set then lived on its own. Any miss there (another head near the well claiming the
// emergence first, the event landing outside the match window, a reset between the event and the
// first draw) meant no core line and no glints for that snake's whole life, while the sim knew all
// along which well owns it.
// Now: the tracked set is rebuilt every frame from the sim's own ownership table (state snakeHead
// and snakeWell, read only), so every live head whose slot a well owns is a nova snake from its
// first frame to its last, and nothing else is. The emergence burst and trail still use the event.
import { interpWrap, unwrapNear } from './drum';
import { createGlint, glintAt, glintSize } from './gemGlint';
import { NOVA_SNAKE_GLINT_SIZE, NOVA_SNAKE_GLINTS, NOVA_SNAKE_TRACK, NOVA_STREAM_GLINT_SIZE, NOVA_STREAM_GLINTS, NOVA_STREAM_RANGE, novaRibbonAt, novaSnakeMark, novaStreamAt, createRibbonPt, type NovaSnakeState } from './novaSnake';

/** The world and game state arrays the live path reads (World and GameState satisfy it). */
export interface SnakeSource {
  readonly alive: Uint8Array;
  readonly kind: ArrayLike<number>;
  readonly t: ArrayLike<number>;
  readonly a: ArrayLike<number>;
  readonly x: ArrayLike<number>;
  readonly y: ArrayLike<number>;
  readonly prevX: ArrayLike<number>;
  readonly prevY: ArrayLike<number>;
}

export interface SnakeTable {
  readonly snakeHead: ArrayLike<number>;
  readonly snakeWell: ArrayLike<number>;
  readonly snakeSegs: ArrayLike<number>;
}

/** Floats per glint in a draw list: x, y, size, rot, hue, alpha. */
export const GLINT_STRIDE = 6;

/**
 * Rebuild the tracked nova snakes from the sim: every live head (kind headKind) in a slot that a
 * well owns. Slots are walked in order, so the tracked set is deterministic. Allocates nothing.
 */
export function novaSnakeSync(s: NovaSnakeState, w: SnakeSource, g: SnakeTable, slots: number, headKind: number): void {
  s.head.fill(-1);
  s.t.fill(0);
  for (let slot = 0; slot < slots; slot++) {
    const head = g.snakeHead[slot] ?? -1;
    if (head <= 0 || (g.snakeWell[slot] ?? -1) < 0) continue;
    if (w.alive[head] !== 1 || w.kind[head] !== headKind || w.a[head] !== slot) continue;
    novaSnakeMark(s, head, w.t[head] ?? 0);
  }
}

/**
 * Write the drawn body polyline of head (head first, then each live segment) into out at render
 * interpolation alpha; wrapW is the cylinder u period (0 flat). Returns the point count.
 */
export function novaSnakeBody(w: SnakeSource, g: SnakeTable, head: number, segments: number, alpha: number, wrapW: number, out: Float32Array): number {
  const slot = w.a[head] ?? -1;
  if (slot < 0 || out.length < 2) return 0;
  out[0] = interpWrap(w.prevX[head] ?? 0, w.x[head] ?? 0, alpha, wrapW);
  out[1] = (w.prevY[head] ?? 0) + ((w.y[head] ?? 0) - (w.prevY[head] ?? 0)) * alpha;
  let n = 1;
  for (let k = 0; k < segments && (n + 1) * 2 <= out.length; k++) {
    const sid = g.snakeSegs[slot * segments + k] ?? -1;
    if (sid < 0 || w.alive[sid] !== 1 || w.a[sid] !== head) continue;
    out[n * 2] = unwrapNear(out[n * 2 - 2] ?? 0, interpWrap(w.prevX[sid] ?? 0, w.x[sid] ?? 0, alpha, wrapW), wrapW);
    out[n * 2 + 1] = (w.prevY[sid] ?? 0) + ((w.y[sid] ?? 0) - (w.prevY[sid] ?? 0)) * alpha;
    n++;
  }
  return n;
}

const glint = createGlint();
const ribbon = createRibbonPt();
const dot = { x: 0, y: 0 };

function put(out: Float32Array, i: number, x: number, y: number, size: number, rot: number, hue: number, a: number): number {
  if (a <= 0.01 || size <= 0.2 || (i + 1) * GLINT_STRIDE > out.length) return i;
  const o = i * GLINT_STRIDE;
  out[o] = x;
  out[o + 1] = y;
  out[o + 2] = size;
  out[o + 3] = rot;
  out[o + 4] = hue;
  out[o + 5] = a > 1 ? 1 : a;
  return i + 1;
}

/**
 * The glint draw list of one nova snake: the ribbon round the body (pts, n points, head first) and,
 * when the head is within NOVA_STREAM_RANGE of its well (wx, wy; hasWell false for none), the
 * stream from the whirlpool. Writes GLINT_STRIDE floats per glint into out; returns the count.
 */
export function novaSnakeGlints(pts: Float32Array, n: number, head: number, h: number, timeSec: number, hasWell: boolean, wx: number, wy: number, out: Float32Array): number {
  if (n < 1) return 0;
  let c = 0;
  for (let d = 0; d < NOVA_SNAKE_GLINTS; d++) {
    novaRibbonAt(pts, n, timeSec, h, d, ribbon);
    glintAt(head * 31 + 7, d, timeSec, glint);
    const front = 0.55 + 0.45 * (0.5 + 0.5 * ribbon.depth);
    const tail = 1 - 0.5 * ribbon.p;
    c = put(out, c, ribbon.x, ribbon.y, glintSize(NOVA_SNAKE_GLINT_SIZE, glint.flare) * (0.75 + 0.25 * front), glint.rot, glint.hue, (0.4 + 0.6 * glint.flare) * front * tail);
  }
  if (!hasWell) return c;
  const hx = pts[0] ?? 0;
  const hy = pts[1] ?? 0;
  const dx = hx - wx;
  const dy = hy - wy;
  if (dx * dx + dy * dy >= NOVA_STREAM_RANGE * NOVA_STREAM_RANGE) return c;
  for (let d = 0; d < NOVA_STREAM_GLINTS; d++) {
    const sa = novaStreamAt(wx, wy, hx, hy, timeSec, h, d, dot);
    if (sa <= 0.02) continue;
    glintAt(head * 31 + 911, d, timeSec, glint);
    c = put(out, c, dot.x, dot.y, glintSize(NOVA_STREAM_GLINT_SIZE, glint.flare), glint.rot, glint.hue, (0.45 + 0.55 * glint.flare) * sa);
  }
  return c;
}

/** Tracked heads in slot order (tests): a copy of the live heads. */
export function trackedHeads(s: NovaSnakeState): number[] {
  const out: number[] = [];
  for (let k = 0; k < NOVA_SNAKE_TRACK; k++) {
    const i = s.head[k] ?? -1;
    if (i >= 0) out.push(i);
  }
  return out;
}
