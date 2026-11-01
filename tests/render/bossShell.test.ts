// Look GW2: the boss shield shell (Warden, or any boss that emits 'sim:bossShield').
import { describe, expect, it } from 'vitest';
import { WARDEN_SHIELD } from '../../src/game/bosses/table';
import {
  createShellState,
  resetShellState,
  SHATTER_SEC,
  SHELL_OPEN_SEC,
  SHELL_SIDES,
  SHELL_WHITE,
  shellHit,
  shellRimPulse,
  shellShard,
  shellVertex,
  stepShell,
  windowCorePulse,
  windowRingR,
  windowShare,
  type Shard,
} from '../../src/render/bossShell';

describe('boss shell', () => {
  it('is a Bulwark white hexagon of even radius', () => {
    expect(SHELL_WHITE).toBe(0xf2f2f2);
    expect(SHELL_SIDES).toBe(6);
    const v = new Float32Array(2);
    for (let k = 0; k < 6; k++) {
      shellVertex(k, 0.3, 80, v);
      expect(Math.hypot(v[0] ?? 0, v[1] ?? 0)).toBeCloseTo(80);
    }
  });

  it('pulses the rim on an absorbed hit only while up', () => {
    const s = createShellState();
    shellHit(s);
    expect(shellRimPulse(s.hitAge)).toBeCloseTo(0);
    stepShell(s, true, -1, 1 / 60);
    shellHit(s);
    expect(shellRimPulse(s.hitAge)).toBe(1);
    stepShell(s, true, -1, 0.3);
    expect(shellRimPulse(s.hitAge)).toBeLessThan(0.1);
  });

  it('shatters on drop and runs the open window, the ring shrinking as it closes', () => {
    const s = createShellState();
    stepShell(s, true, -1, 1 / 60);
    expect(s.up).toBe(true);
    stepShell(s, false, -1, 1 / 60);
    expect(s.up).toBe(false);
    expect(s.dropAge).toBe(0);
    expect(s.openTotal).toBe(SHELL_OPEN_SEC);
    expect(SHELL_OPEN_SEC).toBe(WARDEN_SHIELD.openSec);
    const r0 = windowRingR(windowShare(s.openLeft, s.openTotal));
    stepShell(s, false, -1, 1);
    const r1 = windowRingR(windowShare(s.openLeft, s.openTotal));
    expect(r1).toBeLessThan(r0);
    expect(Number.isFinite(s.dropAge)).toBe(false);
    stepShell(s, false, -1, 5);
    expect(s.openLeft).toBe(0);
  });

  it('takes the window length from the sim when known', () => {
    const s = createShellState();
    stepShell(s, true, -1, 0.1);
    stepShell(s, false, 1.8, 0.1);
    expect(s.openTotal).toBe(1.8);
  });

  it('follows sim:bossShield for any boss', () => {
    const s = createShellState();
    s.evUp = true;
    stepShell(s, false, -1, 0.1);
    expect(s.up).toBe(true);
    s.evUp = false;
    stepShell(s, false, -1, 0.1);
    expect(s.dropAge).toBe(0);
    resetShellState(s);
    expect(s.up).toBe(false);
    expect(s.openLeft).toBe(0);
  });

  it('6 shards fly outward and fade over the shatter', () => {
    const a: Shard = { x0: 0, y0: 0, x1: 0, y1: 0, a: 0 };
    const b: Shard = { x0: 0, y0: 0, x1: 0, y1: 0, a: 0 };
    for (let k = 0; k < SHELL_SIDES; k++) {
      shellShard(k, 0, 0, 80, a);
      shellShard(k, SHATTER_SEC * 0.8, 0, 80, b);
      const da = Math.hypot((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2);
      const db = Math.hypot((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
      expect(db).toBeGreaterThan(da);
      expect(a.a).toBe(1);
      expect(b.a).toBeLessThan(a.a);
    }
  });

  it('the open core pulses within range', () => {
    for (const t of [0, 0.1, 0.27, 0.5]) {
      const p = windowCorePulse(t, 0.5);
      expect(p).toBeGreaterThanOrEqual(0.6 - 1e-9);
      expect(p).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
