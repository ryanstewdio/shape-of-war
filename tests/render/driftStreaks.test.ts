import { describe, expect, it } from 'vitest';
import { BURST_LEN } from '../../src/game/drift';
import {
  STREAK_MAX,
  STREAK_TELE,
  createDriftStreaks,
  driftBurstEvent,
  driftStreakFrame,
  streakAt,
  streakLevel,
  type StreakFrame,
  type StreakSeg,
} from '../../src/render/driftStreaks';

const frame = (): StreakFrame => ({ level: 0, count: 0, burst: false });
const seg = (): StreakSeg => ({ phi0: 0, phi1: 0, v: 0, alpha: 0 });

describe('drift burst streak timeline', () => {
  it('draws nothing before any event', () => {
    const s = createDriftStreaks();
    expect(driftStreakFrame(s, 0.016, frame()).level).toBe(0);
  });
  it('telegraph: sparse streaks, level rising, then a denser brighter burst, then off', () => {
    const tele = streakLevel(0.1, 0.6, frame());
    expect(tele.burst).toBe(false);
    expect(tele.count).toBe(STREAK_TELE);
    const late = streakLevel(0.5, 0.6, frame());
    expect(late.level).toBeGreaterThan(tele.level);
    const peak = streakLevel(0.6 + BURST_LEN / 2, 0.6, frame());
    expect(peak.burst).toBe(true);
    expect(peak.count).toBe(STREAK_MAX);
    expect(peak.level).toBe(1);
    expect(peak.level).toBeGreaterThan(late.level);
    expect(streakLevel(0.6 + BURST_LEN + 0.01, 0.6, frame()).level).toBe(0);
  });
  it('the event resets the clock and the frame advances it and the travel', () => {
    const s = createDriftStreaks();
    driftBurstEvent(s, 0.6, -1);
    expect(s.dir).toBe(-1);
    const f = frame();
    driftStreakFrame(s, 0.1, f);
    expect(f.level).toBeGreaterThan(0);
    expect(s.travel).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) driftStreakFrame(s, 0.016, f);
    expect(f.level).toBe(0);
    expect(Number.isFinite(s.age)).toBe(false);
  });
});

describe('drift burst streak geometry', () => {
  it('streaks stay on the front face, inside the drum height', () => {
    for (let k = 0; k < STREAK_MAX; k++) {
      const s = streakAt(k, 0.37, 1, 1, 200, seg());
      expect(Math.abs(s.phi0)).toBeLessThanOrEqual(Math.PI / 2);
      expect(Math.abs(s.phi1)).toBeLessThanOrEqual(Math.PI / 2);
      expect(Math.abs(s.v)).toBeLessThan(200);
      expect(s.alpha).toBeGreaterThanOrEqual(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
    }
  });
  it('the head leads in the burst direction', () => {
    let checked = 0;
    for (let k = 0; k < STREAK_MAX; k++) {
      const p = streakAt(k, 0.2, 1, 1, 200, seg());
      if (p.alpha > 0) {
        expect(p.phi1).toBeGreaterThan(p.phi0);
        checked++;
      }
      const m = streakAt(k, 0.2, -1, 1, 200, seg());
      if (m.alpha > 0) expect(m.phi1).toBeLessThan(m.phi0);
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('streaks move with travel in the burst direction', () => {
    let moved = 0;
    for (let k = 0; k < STREAK_MAX; k++) {
      const a = streakAt(k, 0.3, 1, 1, 200, seg());
      const b = streakAt(k, 0.31, 1, 1, 200, seg());
      if (a.alpha > 0 && b.alpha > 0 && Math.abs(a.phi1) < 1.4 && Math.abs(b.phi1) < 1.4) {
        expect(b.phi1).toBeGreaterThan(a.phi1);
        moved++;
      }
      const c = streakAt(k, 0.3, -1, 1, 200, seg());
      const d = streakAt(k, 0.31, -1, 1, 200, seg());
      if (c.alpha > 0 && d.alpha > 0 && Math.abs(c.phi1) < 1.4 && Math.abs(d.phi1) < 1.4) expect(d.phi1).toBeLessThan(c.phi1);
    }
    expect(moved).toBeGreaterThan(0);
  });
});
