// Pixel scroll bar (src/ui/scrollbar.ts). Vitest runs in node with no jsdom (no new dependency),
// so the DOM tests use a small scroll aware fake below, in the style of tests/ui/fakeDom.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bus } from '../../src/core/events';
import {
  MIN_THUMB_PX,
  SB_PITCH_PX,
  THUMB_STEPS,
  attachScrollbar,
  barColours,
  barLayout,
  colourStep,
  createScrollEmitter,
  dragScrollTop,
  moreVisible,
  overflows,
  pageScrollTop,
  scrollProgress,
  thumbLength,
  thumbOffset,
  trackLength,
  type ScrollbarEnv,
} from '../../src/ui/scrollbar';
import { UI_CSS } from '../../src/ui/dom';

type Fn = (e: FakePointer) => void;

interface FakePointer {
  pointerId: number;
  pointerType: string;
  clientY: number;
  preventDefault(): void;
  stopPropagation(): void;
}

class SEl {
  readonly style: Record<string, string> = {};
  readonly children: SEl[] = [];
  parentElement: SEl | null = null;
  textContent = '';
  scrollHeight = 0;
  clientHeight = 0;
  clientWidth = 300;
  offsetTop = 20;
  offsetLeft = 10;
  clientTop = 2;
  clientLeft = 2;
  private top = 0;
  private readonly classes = new Set<string>();
  private readonly attrs = new Map<string, string>();
  private readonly listeners = new Map<string, Set<Fn>>();
  readonly classList = {
    add: (...n: string[]): void => n.forEach((c) => this.classes.add(c)),
    remove: (...n: string[]): void => n.forEach((c) => this.classes.delete(c)),
    toggle: (n: string, force?: boolean): boolean => {
      const on = force ?? !this.classes.has(n);
      if (on) this.classes.add(n);
      else this.classes.delete(n);
      return on;
    },
    contains: (n: string): boolean => this.classes.has(n),
  };
  constructor(readonly tag: string) {}
  set className(v: string) {
    this.classes.clear();
    v.split(/\s+/).filter((c) => c !== '').forEach((c) => this.classes.add(c));
  }
  get className(): string {
    return [...this.classes].join(' ');
  }
  /** Like the browser: setting scrollTop clamps and fires 'scroll' when it changed. */
  get scrollTop(): number {
    return this.top;
  }
  set scrollTop(v: number) {
    const next = Math.max(0, Math.min(Math.max(0, this.scrollHeight - this.clientHeight), v));
    if (next === this.top) return;
    this.top = next;
    for (const fn of this.listeners.get('scroll') ?? []) fn(pointer('scroll', 0));
  }
  append(...nodes: SEl[]): void {
    for (const n of nodes) {
      n.parentElement = this;
      this.children.push(n);
    }
  }
  replaceChildren(...nodes: SEl[]): void {
    this.children.splice(0);
    this.append(...nodes);
  }
  remove(): void {
    const p = this.parentElement;
    if (p === null) return;
    p.children.splice(p.children.indexOf(this), 1);
    this.parentElement = null;
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  addEventListener(type: string, fn: Fn): void {
    const set = this.listeners.get(type) ?? new Set<Fn>();
    set.add(fn);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, fn: Fn): void {
    this.listeners.get(type)?.delete(fn);
  }
  listenerCount(): number {
    return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
  }
  getBoundingClientRect(): { top: number } {
    return { top: 0 };
  }
  setPointerCapture(): void {
    // no capture model
  }
  fire(type: string, e: FakePointer): void {
    for (const fn of this.listeners.get(type) ?? []) fn(e);
  }
  find(cls: string): SEl | undefined {
    if (this.classList.contains(cls)) return this;
    for (const c of this.children) {
      const f = c.find(cls);
      if (f !== undefined) return f;
    }
    return undefined;
  }
}

function pointer(_type: string, clientY: number, pointerType = 'touch', pointerId = 1): FakePointer {
  return { pointerId, pointerType, clientY, preventDefault: () => undefined, stopPropagation: () => undefined };
}

interface Harness {
  env: ScrollbarEnv;
  frames: Map<number, () => void>;
  runFrames(): void;
  timers: Map<number, () => void>;
  observers: { kind: 'resize' | 'mutation'; cb: () => void; targets: unknown[]; disconnected: boolean }[];
}

function harness(): Harness {
  let next = 1;
  const frames = new Map<number, () => void>();
  const timers = new Map<number, () => void>();
  const observers: Harness['observers'] = [];
  const obs = (kind: 'resize' | 'mutation') => (cb: () => void) => {
    const o = { kind, cb, targets: [] as unknown[], disconnected: false };
    observers.push(o);
    return {
      observe: (t: unknown) => {
        o.targets.push(t);
      },
      disconnect: () => {
        o.disconnected = true;
      },
    };
  };
  const env: ScrollbarEnv = {
    raf: (cb) => {
      const id = next++;
      frames.set(id, cb);
      return id;
    },
    caf: (id) => {
      frames.delete(id);
    },
    setTimer: (cb) => {
      const id = next++;
      timers.set(id, cb);
      return id;
    },
    clearTimer: (id) => {
      timers.delete(id);
    },
    makeResizeObserver: obs('resize'),
    makeMutationObserver: obs('mutation'),
  };
  return {
    env,
    frames,
    timers,
    observers,
    runFrames: () => {
      const due = [...frames.values()];
      frames.clear();
      due.forEach((f) => f());
    },
  };
}

function fakeBus(): { bus: Pick<Bus, 'emit'>; emits: { delta: number; progress: number }[] } {
  const emits: { delta: number; progress: number }[] = [];
  const bus = {
    emit: (k: string, p?: unknown): void => {
      if (k === 'ui:scroll') emits.push(p as { delta: number; progress: number });
    },
  } as Pick<Bus, 'emit'>;
  return { bus, emits };
}

const asEl = (e: SEl): HTMLElement => e as unknown as HTMLElement;

function setup(scrollHeight: number, clientHeight = 400) {
  const parent = new SEl('div');
  const box = new SEl('div');
  box.scrollHeight = scrollHeight;
  box.clientHeight = clientHeight;
  parent.append(box);
  const h = harness();
  const { bus, emits } = fakeBus();
  const detach = attachScrollbar(asEl(box), bus, h.env);
  const frame = parent.find('sow-sb');
  if (frame === undefined) throw new Error('no frame');
  const get = (cls: string): SEl => {
    const f = frame.find(cls);
    if (f === undefined) throw new Error(cls);
    return f;
  };
  return { parent, box, h, emits, detach, frame, get };
}

beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: (tag: string) => new SEl(tag),
    createElementNS: (_ns: string, tag: string) => new SEl(tag),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scrollbar pure maths', () => {
  const m = (scrollTop: number, scrollHeight: number, clientHeight: number) => ({ scrollTop, scrollHeight, clientHeight });

  it('overflows only past the 4 px slack', () => {
    expect(overflows(m(0, 404, 400))).toBe(false);
    expect(overflows(m(0, 405, 400))).toBe(true);
  });

  it('track and thumb lengths are whole cells, thumb at least 24 px', () => {
    expect(trackLength(400)).toBe(384);
    expect(trackLength(403) % SB_PITCH_PX).toBe(0);
    expect(thumbLength(384, m(0, 800, 400))).toBe(192);
    expect(thumbLength(384, m(0, 100000, 400))).toBe(MIN_THUMB_PX);
  });

  it('thumb position follows scrollTop in pixel steps', () => {
    const at = (top: number) => barLayout(m(top, 800, 400));
    expect(at(0).thumbTop).toBe(0);
    expect(at(200).thumbTop).toBe(96);
    expect(at(400).thumbTop).toBe(192);
    expect(at(400).thumbTop + at(400).thumb).toBe(at(400).track);
    expect(thumbOffset(384, 192, 0.51) % SB_PITCH_PX).toBe(0);
    expect(scrollProgress(m(200, 800, 400))).toBe(0.5);
  });

  it('colour steps run cyan at the top, magenta midway, green at the bottom', () => {
    expect(THUMB_STEPS[colourStep(0)]).toBe('cyan');
    expect(THUMB_STEPS[colourStep(0.5)]).toBe('magenta');
    expect(THUMB_STEPS[colourStep(1)]).toBe('green');
    expect(colourStep(0.19)).toBe(0);
    expect(colourStep(0.21)).toBe(1);
  });

  it('hot colours are brighter and glow wider', () => {
    const calm = barColours(0, false, 1, 0.5);
    const hot = barColours(0, true, 1, 0.5);
    expect(hot.thumb).not.toBe(calm.thumb);
    expect(hot.thumbBlur).toBeGreaterThan(calm.thumbBlur);
  });

  it('MORE shows at the top only, until dismissed or at the bottom', () => {
    expect(moreVisible(m(0, 800, 400), false)).toBe(true);
    expect(moreVisible(m(9, 800, 400), false)).toBe(false);
    expect(moreVisible(m(0, 800, 400), true)).toBe(false);
    expect(moreVisible(m(0, 400, 400), false)).toBe(false);
  });

  it('drag maps track px to content px and paging moves one visible height', () => {
    expect(dragScrollTop(0, 96, 384, 192, m(0, 800, 400))).toBe(200);
    expect(dragScrollTop(0, 9999, 384, 192, m(0, 800, 400))).toBe(400);
    expect(pageScrollTop(m(0, 1200, 400), 1)).toBe(400);
    expect(pageScrollTop(m(100, 1200, 400), -1)).toBe(0);
  });
});

describe('scroll emitter', () => {
  it('coalesces deltas into one emit per frame and skips zero', () => {
    const h = harness();
    const { bus, emits } = fakeBus();
    const em = createScrollEmitter(bus, h.env.raf, h.env.caf);
    em.push(10, 0.1);
    em.push(5, 0.2);
    em.push(-3, 0.15);
    expect(emits).toEqual([]);
    expect(h.frames.size).toBe(1);
    h.runFrames();
    expect(emits).toEqual([{ delta: 12, progress: 0.15 }]);
    em.push(4, 0.2);
    em.push(-4, 0.15);
    h.runFrames();
    expect(emits).toHaveLength(1);
  });
});

describe('attachScrollbar', () => {
  it('hides the native bar and stays hidden when content fits', () => {
    const t = setup(402);
    expect(t.box.classList.contains('sow-sb-host')).toBe(true);
    expect(t.parent.classList.contains('sow-sb-parent')).toBe(true);
    expect(t.frame.classList.contains('sow-sb-on')).toBe(false);
  });

  it('shows the bar with thumb size and position from scrollTop', () => {
    const t = setup(800);
    expect(t.frame.classList.contains('sow-sb-on')).toBe(true);
    expect(t.frame.style.top).toBe('22px');
    expect(t.frame.style.height).toBe('400px');
    const thumb = t.get('sow-sb-thumb');
    expect(thumb.style.height).toBe('192px');
    expect(thumb.style.top).toBe('0px');
    expect(thumb.getAttribute('data-step')).toBe('0');
    t.box.scrollTop = 400;
    expect(thumb.style.top).toBe('192px');
    expect(thumb.getAttribute('data-step')).toBe(String(THUMB_STEPS.length - 1));
  });

  it('shows on content growth via the observers', () => {
    const t = setup(300);
    expect(t.frame.classList.contains('sow-sb-on')).toBe(false);
    t.box.scrollHeight = 900;
    t.h.observers.find((o) => o.kind === 'resize')?.cb();
    t.h.runFrames();
    expect(t.frame.classList.contains('sow-sb-on')).toBe(true);
  });

  it('brightens while scrolling then settles', () => {
    const t = setup(800);
    const thumb = t.get('sow-sb-thumb');
    const calm = thumb.style.background;
    t.box.scrollTop = 4;
    const hot = thumb.style.background;
    expect(hot).not.toBe(calm);
    [...t.h.timers.values()].forEach((f) => f());
    expect(thumb.style.background).toBe(calm);
  });

  it('MORE shows at the top, hides after a scroll past 8 px and stays hidden', () => {
    const t = setup(800);
    const more = t.get('sow-sb-more');
    expect(more.classList.contains('sow-on')).toBe(true);
    t.box.scrollTop = 6;
    expect(more.classList.contains('sow-on')).toBe(true);
    t.box.scrollTop = 20;
    expect(more.classList.contains('sow-on')).toBe(false);
    t.box.scrollTop = 0;
    expect(more.classList.contains('sow-on')).toBe(false);
    // new content (a How to page turn) brings it back
    t.h.observers.find((o) => o.kind === 'mutation')?.cb();
    t.h.runFrames();
    expect(more.classList.contains('sow-on')).toBe(true);
  });

  it('emits ui:scroll at most once per frame with the summed delta', () => {
    const t = setup(800);
    t.box.scrollTop = 10;
    t.box.scrollTop = 30;
    t.box.scrollTop = 25;
    expect(t.emits).toEqual([]);
    t.h.runFrames();
    expect(t.emits).toHaveLength(1);
    expect(t.emits[0]?.delta).toBe(25);
    expect(t.emits[0]?.progress).toBeCloseTo(25 / 400);
    t.h.runFrames();
    expect(t.emits).toHaveLength(1);
  });

  it('dragging the thumb scrolls; tapping the track pages; mouse is ignored', () => {
    const t = setup(1200);
    const track = t.get('sow-sb-track');
    // track 384, thumb floor(128 / 8) * 8 = 128
    track.fire('pointerdown', pointer('d', 300, 'mouse'));
    expect(t.box.scrollTop).toBe(0);
    track.fire('pointerdown', pointer('d', 300));
    expect(t.box.scrollTop).toBe(400);
    track.fire('pointerdown', pointer('d', 0, 'touch', 2));
    expect(t.box.scrollTop).toBe(0);
    track.fire('pointerdown', pointer('d', 10, 'touch', 3));
    track.fire('pointermove', pointer('m', 10 + 128, 'touch', 3));
    expect(t.box.scrollTop).toBe(400);
    track.fire('pointerup', pointer('u', 138, 'touch', 3));
    track.fire('pointermove', pointer('m', 300, 'touch', 3));
    expect(t.box.scrollTop).toBe(400);
  });

  it('detach removes the frame, listeners and observers', () => {
    const t = setup(800);
    const track = t.get('sow-sb-track');
    expect(t.box.listenerCount()).toBeGreaterThan(0);
    expect(t.h.observers.every((o) => o.targets.length > 0)).toBe(true);
    t.box.scrollTop = 50;
    t.detach();
    expect(t.box.listenerCount()).toBe(0);
    expect(track.listenerCount()).toBe(0);
    expect(t.h.observers.every((o) => o.disconnected)).toBe(true);
    expect(t.h.frames.size).toBe(0);
    expect(t.h.timers.size).toBe(0);
    expect(t.parent.find('sow-sb')).toBeUndefined();
    expect(t.box.classList.contains('sow-sb-host')).toBe(false);
    t.box.scrollTop = 0;
    t.h.runFrames();
    expect(t.emits).toEqual([]);
  });
});

describe('scrollbar css', () => {
  it('hides the native bar and keeps the pixel parts square and touch transparent', () => {
    expect(UI_CSS).toContain('.sow-sb-host { scrollbar-width: none;');
    expect(UI_CSS).toContain('.sow-sb-host::-webkit-scrollbar { display: none;');
    expect(UI_CSS).toMatch(/\.sow-sb-cells, \.sow-sb-thumb \{[^}]*width: 6px; border-radius: 0;/);
    expect(UI_CSS).toMatch(/\.sow-sb-more \{[^}]*pointer-events: none;/);
    expect(UI_CSS).toMatch(/\.sow-sb \{[^}]*pointer-events: none;/);
  });
});
