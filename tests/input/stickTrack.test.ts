import { describe, expect, it } from 'vitest';
import { beginTrack, createTrack, DEAD_ZONE, endTrack, NO_POINTER, STICK_RADIUS, stickVector, updateTrack } from '../../src/input/stick';
import type { Track } from '../../src/input/stick';

describe('createTrack', () => {
  it('creates a fresh, unowned track with zeroed fields', () => {
    const t: Track = createTrack();

    expect(t).toEqual({
      id: -1, active: false, x: 0, y: 0, ox: 0, oy: 0,
      lx: 0, ly: 0, px: 0, py: 0, cx: 0, cy: 0,
    });
    expect(t.id).toBe(NO_POINTER);
    expect(createTrack()).not.toBe(t);
  });
});

describe('beginTrack', () => {
  it('takes ownership and places the centre, landing and knob at the finger', () => {
    const t = createTrack();

    beginTrack(t, 7, 300, 200);

    expect(t).toEqual({
      id: 7, active: true, x: 0, y: 0, ox: 300, oy: 200,
      lx: 300, ly: 200, px: 300, py: 200, cx: 0, cy: 0,
    });
  });

  it('accepts pointer id zero as an active owner', () => {
    const t = createTrack();

    beginTrack(t, 0, 5, 6);

    expect(t.id).toBe(0);
    expect(t.active).toBe(true);
  });

  it('resets a used track, including its output and anchor clamp offset', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);
    updateTrack(t, 500, 260);
    t.cx = 14;
    t.cy = -9;

    beginTrack(t, 9, 40, 50);

    expect(t).toEqual({
      id: 9, active: true, x: 0, y: 0, ox: 40, oy: 50,
      lx: 40, ly: 50, px: 40, py: 50, cx: 0, cy: 0,
    });
  });

  it('takes a released track again at a new landing', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);
    updateTrack(t, 500, 200);
    endTrack(t);

    beginTrack(t, 12, 640, 90);

    expect(t).toEqual({
      id: 12, active: true, x: 0, y: 0, ox: 640, oy: 90,
      lx: 640, ly: 90, px: 640, py: 90, cx: 0, cy: 0,
    });
  });
});

describe('updateTrack', () => {
  it('moves the knob inside the dead zone without producing output', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);

    updateTrack(t, 310, 200);

    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
    expect(t.px).toBe(310);
    expect(t.py).toBe(200);
    expect(t.ox).toBe(300);
    expect(t.oy).toBe(200);

    updateTrack(t, 314, 200);
    expect(t.x).toBe(0);

    updateTrack(t, 315, 200);
    expect(t.x).toBeGreaterThan(0);
  });

  it('keeps the centre for movement inside the ring and to the upper rim', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);

    updateTrack(t, 360, 200);

    expect(t.ox).toBe(300);
    expect(t.oy).toBe(200);
    expect(t.px).toBe(360);
    expect(t.py).toBe(200);
    expect(t.y).toBe(0);
    expect(t.x).toBeCloseTo((0.5 - DEAD_ZONE) / (1 - DEAD_ZONE));

    updateTrack(t, 300, 80);

    expect(t.ox).toBe(300);
    expect(t.oy).toBe(200);
    expect(t.px).toBe(300);
    expect(t.py).toBe(80);
    expect(t.x).toBe(0);
    expect(t.y).toBeCloseTo(-1);
  });

  it('reaches full output on the right rim without moving the centre', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);

    updateTrack(t, 420, 200);

    expect(t.ox).toBe(300);
    expect(t.px).toBe(420);
    expect(t.x).toBeCloseTo(1);
  });

  it('follows past the ring while preserving the landing and owner', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);

    updateTrack(t, 500, 200);

    expect(t.ox).toBe(380);
    expect(t.oy).toBe(200);
    expect(t.px).toBe(500);
    expect(t.py).toBe(200);
    expect(t.x).toBeCloseTo(1);
    expect(t.y).toBe(0);
    expect(t.lx).toBe(300);
    expect(t.ly).toBe(200);
    expect(t.id).toBe(7);
    expect(t.active).toBe(true);
  });

  it('follows a diagonal drag with the knob one radius from the centre', () => {
    const t = createTrack();
    beginTrack(t, 1, 100, 100);

    updateTrack(t, 400, 500);

    expect(t.ox).toBeCloseTo(328);
    expect(t.oy).toBeCloseTo(404);
    expect(t.px).toBeCloseTo(400);
    expect(t.py).toBeCloseTo(500);
    expect(t.x).toBeCloseTo(0.6);
    expect(t.y).toBeCloseTo(0.8);
    expect(Math.hypot(t.px - t.ox, t.py - t.oy)).toBeCloseTo(STICK_RADIUS);
  });

  it('responds immediately to a flip after following the finger', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);
    updateTrack(t, 500, 200);

    updateTrack(t, 260, 200);

    expect(t.ox).toBe(380);
    expect(t.px).toBe(260);
    expect(t.x).toBeCloseTo(-1);

    updateTrack(t, 200, 200);

    expect(t.ox).toBe(320);
    expect(t.px).toBe(200);
    expect(t.x).toBeCloseTo(-1);
  });

  it('clamps the centre to explicit bounds while keeping full output', () => {
    const t = createTrack();
    beginTrack(t, 1, 50, 50);

    updateTrack(t, -500, -500, 800, 600);

    expect(t.ox).toBe(0);
    expect(t.oy).toBe(0);
    expect(t.x).toBeCloseTo(-Math.SQRT1_2);
    expect(t.y).toBeCloseTo(-Math.SQRT1_2);
    expect(Math.hypot(t.px - t.ox, t.py - t.oy)).toBeCloseTo(STICK_RADIUS);

    const u = createTrack();
    beginTrack(u, 1, 750, 550);

    updateTrack(u, 2000, 2000, 800, 600);

    expect(u.ox).toBe(800);
    expect(u.oy).toBe(600);
    expect(Math.hypot(u.x, u.y)).toBeCloseTo(1);
  });

  it('leaves the high side open by default but still clamps the low side', () => {
    const t = createTrack();
    beginTrack(t, 1, 750, 550);

    updateTrack(t, 2000, 550);

    expect(t.ox).toBe(1880);
    expect(t.oy).toBe(550);

    const u = createTrack();
    beginTrack(u, 1, 50, 50);

    updateTrack(u, -500, 50);

    expect(u.ox).toBe(0);
    expect(u.oy).toBe(50);
    expect(u.px).toBe(-120);
    expect(u.x).toBeCloseTo(-1);
  });

  it('preserves ownership, landing and anchor clamp offset', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);
    t.cx = 3;
    t.cy = 4;

    updateTrack(t, 900, 900);

    expect(t.id).toBe(7);
    expect(t.active).toBe(true);
    expect(t.lx).toBe(300);
    expect(t.ly).toBe(200);
    expect(t.cx).toBe(3);
    expect(t.cy).toBe(4);
  });

  it('agrees with stickVector for successive points inside the ring', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);
    const points = [[330, 250], [200, 180], [300, 200], [419, 201]] as const;

    for (const [x, y] of points) {
      updateTrack(t, x, y);
      const v = stickVector(x - 300, y - 200);

      expect(t.ox).toBe(300);
      expect(t.oy).toBe(200);
      expect(t.x).toBe(v.x);
      expect(t.y).toBe(v.y);
      expect(t.px).toBe(300 + v.kx);
      expect(t.py).toBe(200 + v.ky);
    }
  });
});

describe('endTrack', () => {
  it('releases ownership and recentres the knob while preserving the other fields', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);
    updateTrack(t, 500, 260);
    t.cx = 14;
    t.cy = -9;
    const { ox, oy } = t;

    endTrack(t);

    expect(t).toEqual({
      id: NO_POINTER, active: false, x: 0, y: 0, ox, oy,
      lx: 300, ly: 200, px: ox, py: oy, cx: 14, cy: -9,
    });
  });

  it('leaves an already released track unchanged', () => {
    const t = createTrack();
    beginTrack(t, 7, 300, 200);
    updateTrack(t, 500, 260);
    t.cx = 14;
    t.cy = -9;
    endTrack(t);
    const before = { ...t };

    endTrack(t);

    expect(t).toEqual(before);
  });

  it('leaves a fresh track unchanged', () => {
    const t = createTrack();

    endTrack(t);

    expect(t).toEqual(createTrack());
  });
});
