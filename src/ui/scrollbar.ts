// Pixel scroll bar for the info screens (Tester 2: "I did not know there was more information").
// Android hides the native overlay scrollbar until a scroll starts, so nothing signals overflow.
// attachScrollbar(el, bus) hides the native bar on `el` and draws a pixel track of square cells,
// a stepped thumb whose colour steps through the neon hues with scroll progress, and a blinking
// MORE cue while the container overflows and sits at the top.
// Layout: the bar lives in a frame laid over el's client box inside el's parent, so it never
// scrolls with the content and never joins the parent's flex flow. The track sits in el's right
// padding (dom.ts gives every host at least 14 px there).
// Colours come from BASE_PALETTE at the saturation and glow alpha applyNeon last set (read through
// getNeonState and onNeonChanged); this module never sets a neon value.
// Touch only: pointer events with pointerType touch or pen. No keyboard, wheel or gamepad handlers.
import type { Bus } from '../core/events';
import { BASE_PALETTE, getNeonState, onNeonChanged, type PaletteKey } from '../render/neon';
import { glowBlur, glyphRuns, runsPath, setVectorText, type Glyph } from './vectorFont';

/** Edge of one square cell in CSS px; also the visual width of the track and thumb. */
export const SB_CELL_PX = 6;
/** Cell pitch: one cell plus a 2 px gap. Track and thumb lengths and thumb steps are multiples of it. */
export const SB_PITCH_PX = 8;
/** Width of the touch area of the track (the visual cells sit at its right edge). */
export const SB_HIT_PX = 10;
/** Gap between the track and the right edge of the container's client box. */
export const SB_RIGHT_PX = 3;
/** Gap above and below the track inside the container. */
export const SB_INSET_Y_PX = 8;
/** Shortest thumb in CSS px. */
export const MIN_THUMB_PX = 24;
/** The bar shows only when scrollHeight exceeds clientHeight by more than this. */
export const OVERFLOW_SLACK_PX = 4;
/** The MORE cue hides once the container has scrolled past this. */
export const MORE_DISMISS_PX = 8;
/** How long the thumb stays bright after the last scroll event. */
export const HOT_MS = 260;
/** Extra grab margin around the thumb for a finger, in CSS px. */
export const THUMB_GRAB_PX = 8;

/** Thumb hues from the top of the content to the bottom, in equal bands. */
export const THUMB_STEPS: readonly PaletteKey[] = ['cyan', 'purple', 'magenta', 'yellow', 'green'];

export interface ScrollMetrics {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

const clamp = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Pure: how far the content can scroll, never negative. */
export function maxScroll(m: ScrollMetrics): number {
  return Math.max(0, m.scrollHeight - m.clientHeight);
}

/** Pure: true when the content is taller than the box by more than the slack. */
export function overflows(m: ScrollMetrics): boolean {
  return m.scrollHeight - m.clientHeight > OVERFLOW_SLACK_PX;
}

/** Pure: 0 at the top, 1 at the bottom. */
export function scrollProgress(m: ScrollMetrics): number {
  const max = maxScroll(m);
  return max <= 0 ? 0 : clamp(m.scrollTop / max, 0, 1);
}

/** Pure: the track length for a box height, insets taken off, rounded down to whole cells. */
export function trackLength(clientHeight: number): number {
  const free = Math.max(0, clientHeight - 2 * SB_INSET_Y_PX);
  return Math.floor(free / SB_PITCH_PX) * SB_PITCH_PX;
}

/** Pure: thumb length, the visible fraction of the track in whole cells, at least MIN_THUMB_PX. */
export function thumbLength(track: number, m: ScrollMetrics): number {
  if (track <= 0 || m.scrollHeight <= 0) return 0;
  const raw = (track * m.clientHeight) / m.scrollHeight;
  const snapped = Math.floor(raw / SB_PITCH_PX) * SB_PITCH_PX;
  return Math.min(track, Math.max(MIN_THUMB_PX, snapped));
}

/** Pure: thumb top inside the track, in whole cells, so it moves in pixel steps. */
export function thumbOffset(track: number, thumb: number, progress: number): number {
  const steps = Math.max(0, Math.floor((track - thumb) / SB_PITCH_PX));
  return Math.round(clamp(progress, 0, 1) * steps) * SB_PITCH_PX;
}

/** Pure: the THUMB_STEPS index for a progress. 0 is cyan, the last step green. */
export function colourStep(progress: number): number {
  const n = THUMB_STEPS.length;
  return Math.min(n - 1, Math.floor(clamp(progress, 0, 1) * n));
}

/** Pure: true while the MORE cue should show. */
export function moreVisible(m: ScrollMetrics, dismissed: boolean): boolean {
  if (dismissed || !overflows(m)) return false;
  if (m.scrollTop > MORE_DISMISS_PX) return false;
  return maxScroll(m) - m.scrollTop > 1;
}

/** Pure: the scrollTop a thumb drag of dy px asks for. */
export function dragScrollTop(startTop: number, dy: number, track: number, thumb: number, m: ScrollMetrics): number {
  const range = track - thumb;
  const max = maxScroll(m);
  if (range <= 0) return clamp(startTop, 0, max);
  return clamp(startTop + (dy * max) / range, 0, max);
}

/** Pure: the scrollTop after paging one visible height up (-1) or down (1). */
export function pageScrollTop(m: ScrollMetrics, dir: -1 | 1): number {
  return clamp(m.scrollTop + dir * m.clientHeight, 0, maxScroll(m));
}

/** Everything the frame needs to draw, from the metrics alone. */
export interface BarLayout {
  readonly visible: boolean;
  readonly track: number;
  readonly thumb: number;
  readonly thumbTop: number;
  readonly progress: number;
  readonly step: number;
}

/** Pure: the bar layout for one set of metrics. */
export function barLayout(m: ScrollMetrics): BarLayout {
  const track = trackLength(m.clientHeight);
  const thumb = thumbLength(track, m);
  const progress = scrollProgress(m);
  const visible = overflows(m) && track >= MIN_THUMB_PX;
  return { visible, track, thumb, thumbTop: thumbOffset(track, thumb, progress), progress, step: colourStep(progress) };
}

function hsla(key: PaletteKey, saturation: number, light: number, alpha: number): string {
  const [h, s] = BASE_PALETTE[key];
  const sat = clamp(s * (Number.isFinite(saturation) ? Math.max(0, saturation) : 1), 0, 1);
  const pct = (v: number): string => `${Math.round(clamp(v, 0, 1) * 1000) / 10}%`;
  return `hsla(${h}, ${pct(sat)}, ${pct(light)}, ${Math.round(clamp(alpha, 0, 1) * 100) / 100})`;
}

export interface BarColours {
  readonly thumb: string;
  readonly thumbGlow: string;
  readonly thumbBlur: number;
  readonly cells: string;
  readonly cellsGlow: string;
  readonly cellsBlur: number;
  /** MORE arrow fill. */
  readonly cue: string;
}

/** Pure: thumb and track colours for a step at the current neon state; `hot` while scrolling. */
export function barColours(step: number, hot: boolean, saturation: number, glowAlpha: number): BarColours {
  const key = THUMB_STEPS[clamp(Math.round(step), 0, THUMB_STEPS.length - 1)] ?? 'cyan';
  const baseL = Math.max(0.6, BASE_PALETTE[key][2]);
  const ga = clamp(glowAlpha, 0, 1);
  const blur = glowBlur(ga);
  return {
    thumb: hsla(key, saturation, hot ? Math.min(0.86, baseL + 0.2) : baseL, 1),
    thumbGlow: hsla(key, saturation, BASE_PALETTE[key][2], hot ? 0.95 : 0.45 + 0.5 * ga),
    thumbBlur: Math.round(blur * (hot ? 1.6 : 1) * 10) / 10,
    cells: hsla('cyan', saturation, 0.5, 0.24),
    cellsGlow: hsla('cyan', saturation, 0.55, 0.2 + 0.3 * ga),
    cellsBlur: Math.round(blur * 0.6 * 10) / 10,
    cue: hsla('yellow', saturation, 0.62, 1),
  };
}

/** Pure: a column of square cells at the cell pitch in one colour (track and thumb fill). */
export function cellColumn(colour: string): string {
  return `repeating-linear-gradient(to bottom, ${colour} 0 ${SB_CELL_PX}px, transparent ${SB_CELL_PX}px ${SB_PITCH_PX}px)`;
}

type Raf = (cb: () => void) => number;
type Caf = (id: number) => void;

/** Coalesces scroll deltas into at most one 'ui:scroll' emit per animation frame. */
export interface ScrollEmitter {
  push(delta: number, progress: number): void;
  cancel(): void;
}

export function createScrollEmitter(bus: Pick<Bus, 'emit'>, raf: Raf, caf: Caf): ScrollEmitter {
  let acc = 0;
  let progress = 0;
  let id: number | null = null;
  const flush = (): void => {
    id = null;
    const delta = acc;
    acc = 0;
    if (delta !== 0) bus.emit('ui:scroll', { delta, progress });
  };
  return {
    push(delta, p) {
      if (!Number.isFinite(delta)) return;
      acc += delta;
      progress = clamp(p, 0, 1);
      if (id === null) id = raf(flush);
    },
    cancel() {
      if (id !== null) caf(id);
      id = null;
      acc = 0;
    },
  };
}

interface ResizeLike {
  observe(target: Element): void;
  disconnect(): void;
}

interface MutationLike {
  observe(target: Node, opts: MutationObserverInit): void;
  disconnect(): void;
}

/** Host hooks, injectable for tests. Defaults come from the browser globals when present. */
export interface ScrollbarEnv {
  raf: Raf;
  caf: Caf;
  setTimer(cb: () => void, ms: number): number;
  clearTimer(id: number): void;
  makeResizeObserver: ((cb: () => void) => ResizeLike) | null;
  makeMutationObserver: ((cb: () => void) => MutationLike) | null;
}

function defaultEnv(): ScrollbarEnv {
  const g = globalThis;
  const hasRaf = typeof g.requestAnimationFrame === 'function';
  return {
    raf: hasRaf ? (cb) => g.requestAnimationFrame(() => cb()) : (cb) => Number(g.setTimeout(cb, 16)),
    caf: hasRaf ? (id) => g.cancelAnimationFrame(id) : (id) => g.clearTimeout(id),
    setTimer: (cb, ms) => Number(g.setTimeout(cb, ms)),
    clearTimer: (id) => g.clearTimeout(id),
    makeResizeObserver: typeof g.ResizeObserver === 'function' ? (cb) => new g.ResizeObserver(() => cb()) : null,
    makeMutationObserver: typeof g.MutationObserver === 'function' ? (cb) => new g.MutationObserver(() => cb()) : null,
  };
}

/** Down arrow for the MORE cue, 5 by 5 cells. Original art. */
export const ARROW_GLYPH: Glyph = { w: 5, rows: ['..#..', '..#..', '#####', '.###.', '..#..'] };

const SVG_NS = 'http://www.w3.org/2000/svg';

export const SB_CLASS = 'sow-sb';
export const SB_HOST_CLASS = 'sow-sb-host';
export const SB_PARENT_CLASS = 'sow-sb-parent';

function mk(tag: 'div' | 'span', cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

function metricsOf(el: HTMLElement): ScrollMetrics {
  return { scrollTop: num(el.scrollTop), scrollHeight: num(el.scrollHeight), clientHeight: num(el.clientHeight) };
}

const isFinger = (e: PointerEvent): boolean => e.pointerType === 'touch' || e.pointerType === 'pen';

/**
 * DOM edge: give `el` (a scroll container already in the DOM, or about to be) the pixel scroll bar.
 * Returns a detach function that removes the bar, its listeners and its observers.
 */
export function attachScrollbar(el: HTMLElement, bus: Pick<Bus, 'emit'>, envIn: Partial<ScrollbarEnv> = {}): () => void {
  const env: ScrollbarEnv = { ...defaultEnv(), ...envIn };
  el.classList.add(SB_HOST_CLASS);

  const frame = mk('div', SB_CLASS);
  frame.setAttribute('aria-hidden', 'true');
  const track = mk('div', 'sow-sb-track');
  const cells = mk('div', 'sow-sb-cells');
  const thumb = mk('div', 'sow-sb-thumb');
  track.append(cells, thumb);
  const more = mk('div', 'sow-sb-more');
  const arrow = document.createElementNS(SVG_NS, 'svg');
  arrow.setAttribute('class', 'sow-sb-arrow');
  arrow.setAttribute('viewBox', `0 0 ${ARROW_GLYPH.w} ${ARROW_GLYPH.rows.length}`);
  arrow.setAttribute('shape-rendering', 'crispEdges');
  const arrowPath = document.createElementNS(SVG_NS, 'path');
  arrowPath.setAttribute('d', runsPath(glyphRuns(ARROW_GLYPH)));
  arrow.append(arrowPath);
  const word = mk('span', 'sow-sb-word');
  setVectorText(word, 'MORE', { tone: 'yellow' });
  more.append(arrow, word);
  frame.append(track, more);

  let parent: HTMLElement | null = null;
  let lastTop = num(el.scrollTop);
  let dismissed = false;
  let hot = false;
  let hotTimer: number | null = null;
  let layoutId: number | null = null;
  let layout: BarLayout = barLayout(metricsOf(el));
  let drag: { id: number; startY: number; startTop: number } | null = null;
  const emitter = createScrollEmitter(bus, env.raf, env.caf);
  let resize: ResizeLike | null = null;

  function paint(): void {
    if (parent === null) {
      const p = el.parentElement;
      if (p === null || p === undefined) return;
      parent = p;
      parent.classList.add(SB_PARENT_CLASS);
      parent.append(frame);
      resize?.observe(parent);
    }
    const m = metricsOf(el);
    layout = barLayout(m);
    frame.classList.toggle('sow-sb-on', layout.visible);
    more.classList.toggle('sow-on', layout.visible && moreVisible(m, dismissed));
    if (!layout.visible) return;
    frame.style.top = `${num(el.offsetTop) + num(el.clientTop)}px`;
    frame.style.left = `${num(el.offsetLeft) + num(el.clientLeft)}px`;
    frame.style.width = `${num(el.clientWidth)}px`;
    frame.style.height = `${m.clientHeight}px`;
    track.style.top = `${SB_INSET_Y_PX}px`;
    track.style.right = `${SB_RIGHT_PX}px`;
    track.style.height = `${layout.track}px`;
    thumb.style.top = `${layout.thumbTop}px`;
    thumb.style.height = `${layout.thumb}px`;
    const neon = getNeonState().params;
    const c = barColours(layout.step, hot, neon.saturation, neon.glowAlpha);
    cells.style.background = cellColumn(c.cells);
    cells.style.filter = `drop-shadow(0 0 ${c.cellsBlur}px ${c.cellsGlow})`;
    thumb.style.background = cellColumn(c.thumb);
    thumb.style.filter = `drop-shadow(0 0 ${c.thumbBlur}px ${c.thumbGlow})`;
    thumb.setAttribute('data-step', String(layout.step));
    arrowPath.setAttribute('fill', c.cue);
  }

  function schedule(): void {
    if (layoutId !== null) return;
    layoutId = env.raf(() => {
      layoutId = null;
      paint();
    });
  }

  const onScroll = (): void => {
    const top = num(el.scrollTop);
    const delta = top - lastTop;
    lastTop = top;
    if (top > MORE_DISMISS_PX) dismissed = true;
    hot = true;
    if (hotTimer !== null) env.clearTimer(hotTimer);
    hotTimer = env.setTimer(() => {
      hotTimer = null;
      hot = false;
      paint();
    }, HOT_MS);
    paint();
    emitter.push(delta, layout.progress);
  };

  const onDown = (e: PointerEvent): void => {
    if (!isFinger(e) || !layout.visible) return;
    e.preventDefault();
    e.stopPropagation();
    const y = e.clientY - track.getBoundingClientRect().top;
    if (y >= layout.thumbTop - THUMB_GRAB_PX && y <= layout.thumbTop + layout.thumb + THUMB_GRAB_PX) {
      drag = { id: e.pointerId, startY: e.clientY, startTop: num(el.scrollTop) };
      if (typeof track.setPointerCapture === 'function') {
        try {
          track.setPointerCapture(e.pointerId);
        } catch {
          // capture is a nicety; the drag still follows moves over the track
        }
      }
      return;
    }
    el.scrollTop = pageScrollTop(metricsOf(el), y < layout.thumbTop ? -1 : 1);
  };
  const onMove = (e: PointerEvent): void => {
    if (drag === null || e.pointerId !== drag.id) return;
    e.preventDefault();
    el.scrollTop = dragScrollTop(drag.startTop, e.clientY - drag.startY, layout.track, layout.thumb, metricsOf(el));
  };
  const onEnd = (e: PointerEvent): void => {
    if (drag !== null && e.pointerId === drag.id) drag = null;
  };

  const onContent = (): void => {
    dismissed = false;
    lastTop = num(el.scrollTop);
    schedule();
  };
  const offNeon = onNeonChanged(() => paint());
  resize = env.makeResizeObserver?.(schedule) ?? null;
  const mutate = env.makeMutationObserver?.(onContent) ?? null;
  resize?.observe(el);
  mutate?.observe(el, { childList: true, subtree: true, characterData: true });

  el.addEventListener('scroll', onScroll, { passive: true });
  track.addEventListener('pointerdown', onDown);
  track.addEventListener('pointermove', onMove);
  track.addEventListener('pointerup', onEnd);
  track.addEventListener('pointercancel', onEnd);
  paint();

  return () => {
    el.removeEventListener('scroll', onScroll);
    track.removeEventListener('pointerdown', onDown);
    track.removeEventListener('pointermove', onMove);
    track.removeEventListener('pointerup', onEnd);
    track.removeEventListener('pointercancel', onEnd);
    resize?.disconnect();
    mutate?.disconnect();
    offNeon();
    emitter.cancel();
    if (layoutId !== null) env.caf(layoutId);
    if (hotTimer !== null) env.clearTimer(hotTimer);
    layoutId = null;
    hotTimer = null;
    el.classList.remove(SB_HOST_CLASS);
    parent?.classList.remove(SB_PARENT_CLASS);
    frame.remove();
    parent = null;
  };
}
