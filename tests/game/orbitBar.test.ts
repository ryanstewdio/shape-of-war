// GW3 orbit chainsaw bar (Ryan, feel 3 of 5): while the saw level is above 0 both ring tracks bend
// out toward the aim into a bar, r0 x (1 + level x K x profile), K 2.2 outer and 1.6 inner. Spikes
// keep their spin, so they run out along one side, round the tip and back. Hits sweep from the
// previous to the current spike position. 'sim:saw' goes off on pause and on again at resume if held.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { killBullet } from '../../src/game/bullets';
import { orbitHits } from '../../src/game/combat';
import * as pinwheel from '../../src/game/enemies/pinwheel';
import { pauseGame, setInvulnerable, stepGame } from '../../src/game/game';
import {
  BAR_EDGE,
  BAR_FULL,
  BAR_REACH_INNER,
  BAR_REACH_OUTER,
  barProfile,
  barSlope,
  equipWeapon,
  ORBIT_OUTER,
  ORBIT_RADIUS,
  ORBIT_SHIELD,
  placeBlades,
  ringDir,
  SAW_SPIKE_MAX,
  spikeAngle,
  SPIKE_LEN,
  spikeLength,
  stepSaw,
  SWEEP_MAX,
  trackRadius,
  trackTangent,
  weaponState,
} from '../../src/game/weapons';
import type { World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

const DEG = Math.PI / 180;

function aimAt(ax: number, ay: number): InputState {
  const i = idle();
  i.aim.active = true;
  i.aim.x = ax;
  i.aim.y = ay;
  return i;
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

describe('bar profile and track (pure)', () => {
  it('profile is 1 within 25 deg, 0 from 70 deg, smooth and symmetric between', () => {
    expect(BAR_FULL).toBeCloseTo(25 * DEG, 9);
    expect(BAR_EDGE).toBeCloseTo(70 * DEG, 9);
    for (const d of [0, 10, 24.9, -24.9]) expect(barProfile(d * DEG)).toBe(1);
    for (const d of [70, 90, 180, -70.1]) expect(barProfile(d * DEG)).toBe(0);
    let prev = 1;
    for (let d = 25; d <= 70; d += 1) {
      const f = barProfile(d * DEG);
      expect(f).toBeLessThanOrEqual(prev + 1e-12);
      expect(barProfile(-d * DEG)).toBeCloseTo(f, 12);
      prev = f;
    }
    expect(barProfile(47.5 * DEG)).toBeCloseTo(0.5, 9);
    // Continuous at both ends (no step in the bar outline).
    expect(barProfile(25.01 * DEG)).toBeGreaterThan(0.999);
    expect(barProfile(69.99 * DEG)).toBeLessThan(0.001);
    // Wraps.
    expect(barProfile(2 * Math.PI - 0.1)).toBe(1);
  });

  it('slope matches the profile by finite difference', () => {
    const h = 1e-6;
    for (const d of [30, 40, 47.5, 60, -35, -55]) {
      const a = d * DEG;
      expect(barSlope(a)).toBeCloseTo((barProfile(a + h) - barProfile(a - h)) / (2 * h), 4);
    }
    expect(barSlope(0)).toBe(0);
    expect(barSlope(100 * DEG)).toBe(0);
  });

  it('tip reach: outer 100 u to 320 u, inner 80 u to 208 u; rest radius away from the aim', () => {
    expect(BAR_REACH_OUTER).toBe(2.2);
    expect(BAR_REACH_INNER).toBe(1.6);
    expect(trackRadius(ORBIT_OUTER, 1, 1, 0.3, 0.3)).toBeCloseTo(320, 9);
    expect(trackRadius(ORBIT_RADIUS, 0, 1, 0.3, 0.3)).toBeCloseTo(208, 9);
    expect(trackRadius(ORBIT_OUTER, 1, 1, 0.3 + Math.PI, 0.3)).toBe(ORBIT_OUTER);
    expect(trackRadius(ORBIT_OUTER, 1, 0, 0.3, 0.3)).toBe(ORBIT_OUTER);
    expect(trackRadius(ORBIT_OUTER, 1, 0.5, 0, 0)).toBeCloseTo(210, 9);
  });

  it('spike length: 24 at rest, 40 on the bar tip; no 2.5x tangent stretch', () => {
    expect(spikeLength(0, 1)).toBe(SPIKE_LEN);
    expect(spikeLength(1, 0)).toBe(SPIKE_LEN);
    expect(spikeLength(1, 1)).toBe(SAW_SPIKE_MAX);
    expect(SAW_SPIKE_MAX).toBe(40);
  });

  it('track tangent is a unit vector along the direction of travel', () => {
    const out = { x: 0, y: 0 };
    for (const ring of [0, 1]) {
      const r0 = ring === 0 ? ORBIT_RADIUS : ORBIT_OUTER;
      const dir = ringDir(ring);
      for (let d = -90; d <= 90; d += 7.5) {
        const a = d * DEG;
        trackTangent(r0, ring, 1, a, 0, dir, out);
        expect(Math.hypot(out.x, out.y)).toBeCloseTo(1, 9);
        // Numerical derivative of the track along the spin.
        const h = 1e-5 * dir;
        const x1 = trackRadius(r0, ring, 1, a + h, 0) * Math.cos(a + h);
        const y1 = trackRadius(r0, ring, 1, a + h, 0) * Math.sin(a + h);
        const x0 = trackRadius(r0, ring, 1, a, 0) * Math.cos(a);
        const y0 = trackRadius(r0, ring, 1, a, 0) * Math.sin(a);
        const l = Math.hypot(x1 - x0, y1 - y0);
        expect(out.x).toBeCloseTo((x1 - x0) / l, 3);
        expect(out.y).toBeCloseTo((y1 - y0) / l, 3);
      }
    }
  });
});

describe('the bar in play', () => {
  it('reach ramps with the saw level: 0.25 s up, 0.25 s down', () => {
    const { w } = makeGame();
    setInvulnerable(w, true);
    equipWeapon(w, 'orbit');
    const s = weaponState(w);
    const reach = (): number => {
      let best = 0;
      for (let k = 0; k < s.hitters; k++) best = Math.max(best, s.stretch[k] ?? 1);
      return best;
    };
    let level = 0;
    for (let i = 0; i < 15; i++) {
      stepGame(w, DT, aimAt(1, 0));
      level = stepSaw(level, true, DT);
    }
    expect(s.saw).toBeCloseTo(0.5, 6);
    expect(reach()).toBeLessThanOrEqual(1 + 0.5 * BAR_REACH_OUTER + 1e-6);
    for (let i = 0; i < 15; i++) stepGame(w, DT, aimAt(1, 0));
    expect(s.saw).toBeCloseTo(1, 6);
    expect(reach()).toBeGreaterThan(1.05);
    for (let i = 0; i < 30; i++) stepGame(w, DT, idle());
    expect(s.saw).toBe(0);
    expect(reach()).toBe(1);
  });

  it('the bar follows the aim each step and the rings keep turning opposite ways', () => {
    const { w } = makeGame();
    setInvulnerable(w, true);
    equipWeapon(w, 'orbit');
    const s = weaponState(w);
    const p = w.bullets;
    for (let i = 0; i < 40; i++) stepGame(w, DT, aimAt(1, 0));
    const aim2 = Math.PI / 2;
    for (let i = 0; i < 120; i++) {
      const ph = s.orbitPhase;
      stepGame(w, DT, aimAt(0, 1));
      const step = wrap(s.orbitPhase - ph);
      expect(step).toBeCloseTo(ORBIT_SHIELD.rev * 2 * Math.PI * DT, 6);
      for (let k = 0; k < s.hitters; k++) {
        const b = s.blades[k] ?? -1;
        const ring = k < ORBIT_SHIELD.perRing ? 0 : 1;
        const a = spikeAngle(ORBIT_SHIELD, k, s.orbitPhase);
        expect(p.phase[b]).toBeCloseTo(a, 6);
        const d = Math.hypot((p.x[b] ?? 0) - (w.x[0] ?? 0), (p.y[b] ?? 0) - (w.y[0] ?? 0));
        expect(d).toBeCloseTo(trackRadius(ring === 0 ? ORBIT_RADIUS : ORBIT_OUTER, ring, 1, a, aim2), 2);
      }
    }
  });

  it('a spike runs out along the bar, rounds the tip and comes back (one ring revolution)', () => {
    const { w } = makeGame();
    setInvulnerable(w, true);
    equipWeapon(w, 'orbit');
    const s = weaponState(w);
    const p = w.bullets;
    const b = s.blades[ORBIT_SHIELD.perRing] ?? -1; // an outer spike
    let peak = 0;
    let atRest = 0;
    const steps = Math.ceil(1 / (ORBIT_SHIELD.rev * DT));
    for (let i = 0; i < 30 + steps; i++) {
      stepGame(w, DT, aimAt(1, 0));
      if (i < 30) continue;
      const d = Math.hypot((p.x[b] ?? 0) - (w.x[0] ?? 0), (p.y[b] ?? 0) - (w.y[0] ?? 0));
      peak = Math.max(peak, d);
      if (Math.abs(d - ORBIT_OUTER) < 1e-2) atRest++;
    }
    expect(peak).toBeGreaterThan(300); // reached the 320 u tip
    expect(atRest).toBeGreaterThan(steps / 3); // and spent the far side at rest
  });

  it('the swept capsule catches an enemy between two spike positions (no tunnelling)', () => {
    const hitMid = (gap: number): number => {
      const { w } = makeGame();
      equipWeapon(w, 'orbit');
      const s = weaponState(w);
      for (let i = 1; i < s.hitters; i++) killBullet(w.bullets, s.blades[i] ?? -1);
      const b = s.blades[0] ?? -1;
      const p = w.bullets;
      // A spike that moved gap u along +x in one step, now at (300, 0).
      p.prevX[b] = 300 - gap;
      p.prevY[b] = 0;
      p.x[b] = 300;
      p.y[b] = 0;
      p.vx[b] = 1;
      p.vy[b] = 0;
      p.spikeLen[b] = SAW_SPIKE_MAX;
      const id = put(w, pinwheel.def, 300 - gap / 2, 15);
      w.hp[id] = 100;
      orbitHits(w, DT);
      bus.clear();
      return 100 - (w.hp[id] ?? 0);
    };
    // 150 u in one step: the spike alone (half length 20, radius 7, target 20) misses a target 75 u back.
    expect(hitMid(150)).toBe(1);
    // A jump past SWEEP_MAX (an aim flick) is not swept.
    expect(hitMid(SWEEP_MAX + 40)).toBe(0);
  });

  it('two identical runs with a swinging aim give identical spikes', () => {
    const once = (): string => {
      const { w } = makeGame();
      setInvulnerable(w, true);
      equipWeapon(w, 'orbit');
      const out: number[] = [];
      for (let i = 0; i < 600; i++) {
        stepGame(w, DT, i % 200 < 150 ? aimAt(Math.cos(i * 0.02), Math.sin(i * 0.02)) : idle());
        if (i % 50 === 0) {
          const s = weaponState(w);
          for (let k = 0; k < s.hitters; k++) {
            const b = s.blades[k] ?? -1;
            out.push(w.bullets.x[b] ?? 0, w.bullets.y[b] ?? 0, w.bullets.vx[b] ?? 0, w.bullets.spikeLen[b] ?? 0);
          }
        }
      }
      bus.clear();
      return out.join(',');
    };
    expect(once()).toBe(once());
  });
});

describe('sim:saw on pause and resume', () => {
  function sawLog(): boolean[] {
    const log: boolean[] = [];
    bus.on('sim:saw', (e) => log.push(e.on));
    return log;
  }

  function sawing(): { w: World; log: boolean[] } {
    const { w } = makeGame();
    setInvulnerable(w, true);
    equipWeapon(w, 'orbit');
    const log = sawLog();
    for (let i = 0; i < 40; i++) stepGame(w, DT, aimAt(1, 0));
    return { w, log };
  }

  it('game:pause with the saw active emits off; resume with the stick held emits on', () => {
    const { w, log } = sawing();
    expect(log).toEqual([true]);
    bus.emit('game:pause');
    expect(log).toEqual([true, false]);
    expect(weaponState(w).saw).toBe(1); // the level waits for resume
    bus.emit('game:resume');
    stepGame(w, DT, aimAt(1, 0)); // the first step after resume, stick still held
    expect(log).toEqual([true, false, true]);
    // Release ends it once.
    for (let i = 0; i < 60; i++) stepGame(w, DT, idle());
    expect(log).toEqual([true, false, true, false]);
  });

  it('resume with the stick released stays silent while the saw winds down', () => {
    const { w, log } = sawing();
    pauseGame(w);
    expect(log).toEqual([true, false]);
    for (let i = 0; i < 60; i++) stepGame(w, DT, idle());
    expect(weaponState(w).saw).toBe(0);
    expect(log).toEqual([true, false]);
    // A fresh press sounds again.
    stepGame(w, DT, aimAt(1, 0));
    expect(log).toEqual([true, false, true]);
  });

  it('pause without the saw active emits nothing', () => {
    const { w } = makeGame();
    setInvulnerable(w, true);
    equipWeapon(w, 'orbit');
    const log = sawLog();
    for (let i = 0; i < 10; i++) stepGame(w, DT, idle());
    bus.emit('game:pause');
    pauseGame(w);
    expect(log).toEqual([]);
  });

  it('placing blades at rest keeps the old rest radii', () => {
    const { w } = makeGame();
    equipWeapon(w, 'orbit');
    placeBlades(w);
    const s = weaponState(w);
    for (let k = 0; k < s.hitters; k++) {
      const b = s.blades[k] ?? -1;
      const d = Math.hypot((w.bullets.x[b] ?? 0) - (w.x[0] ?? 0), (w.bullets.y[b] ?? 0) - (w.y[0] ?? 0));
      expect(d).toBeCloseTo(k < ORBIT_SHIELD.perRing ? ORBIT_RADIUS : ORBIT_OUTER, 3);
    }
  });
});
