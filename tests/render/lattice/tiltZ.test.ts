import { describe, expect, it } from 'vitest';
import { hash01 } from '../../../src/render/color';
import { KICK_BOMB, KICK_DEATH, KICK_KILL, WELL_PULL_ACCEL } from '../../../src/render/lattice/kicks';
import { buildLattice, type LatticeLayout } from '../../../src/render/lattice/layout';
import {
  addForce,
  addImpulse,
  addRing,
  clearForces,
  createLatticeSim,
  maxDispFor,
  maxDisplacement,
  maxLift,
  resetLattice,
  setZEnabled,
  stepLattice,
  writeLift,
  writePositions,
  Z_DISP_MUL,
  zForceProfile,
  type LatticeSim,
} from '../../../src/render/lattice/sim';
import { makeCamera, projectNodes } from '../../../src/render/project';
import { arena } from './fixtures';

const A = arena('rect', 1800, 1100);

function layout(spacing = 25): LatticeLayout {
  return buildLattice(A, spacing);
}

function zSim(spacing = 25): LatticeSim {
  const sim = createLatticeSim(layout(spacing));
  setZEnabled(sim, true);
  return sim;
}

function run(sim: LatticeSim, seconds: number, each?: (frame: number) => void): void {
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f++) {
    each?.(f);
    stepLattice(sim, 1 / 60);
  }
}

function nodeNear(L: LatticeLayout, x: number, y: number): number {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < L.free; i++) {
    const d = Math.hypot((L.restX[i] ?? 0) - x, (L.restY[i] ?? 0) - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** The scripted frame used by the off path record below. */
function scripted(zOn: boolean): Float32Array {
  const L = buildLattice(arena('rect', 1800, 1100), 25);
  const sim = createLatticeSim(L);
  if (zOn) setZEnabled(sim, true);
  const out = new Float32Array(L.count * 2);
  addImpulse(sim, 100, -50, 440, 100);
  addRing(sim, -300, 200, 420, 1100, 1.1, 70);
  for (let f = 0; f < 45; f++) {
    clearForces(sim);
    addForce(sim, 400, 100, 250, -2000);
    stepLattice(sim, 1 / 60);
  }
  writePositions(sim, out, 0.37);
  return out;
}

describe('lattice z channel', () => {
  it('is off by default and never moves while off', () => {
    const sim = createLatticeSim(layout());
    expect(sim.zOn).toBe(false);
    addImpulse(sim, 0, 0, KICK_DEATH.strength, KICK_DEATH.radius);
    run(sim, 1);
    expect(maxLift(sim)).toBe(0);
    const lift = new Float32Array(sim.layout.count).fill(7);
    writeLift(sim, lift, 0.5);
    expect(lift.every((v) => v === 0)).toBe(true);
  });

  it('rest state stays exactly at rest for 10 s with the channel on', () => {
    const sim = zSim();
    run(sim, 10);
    expect(maxLift(sim)).toBe(0);
    expect(maxDisplacement(sim)).toBe(0);
    expect(sim.awake).toBe(false);
  });

  it('a kill lifts the grid, then decays to rest and sleeps', () => {
    const sim = zSim();
    const c = nodeNear(sim.layout, 40, 0);
    addImpulse(sim, 0, 0, KICK_KILL.strength, KICK_KILL.radius);
    let up = 0;
    run(sim, 0.3, () => {
      up = Math.max(up, sim.uz[c] ?? 0);
    });
    expect(up).toBeGreaterThan(2);
    run(sim, 10);
    expect(maxLift(sim)).toBe(0);
    expect(sim.awake).toBe(false);
  });

  it('a well pulls a funnel down, deepest near the centre', () => {
    const sim = zSim();
    const r = 240;
    run(sim, 1.5, () => {
      clearForces(sim);
      addForce(sim, 0, 0, r, WELL_PULL_ACCEL);
    });
    const centre = sim.uz[nodeNear(sim.layout, 0, 0)] ?? 0;
    const mid = sim.uz[nodeNear(sim.layout, r * 0.5, 0)] ?? 0;
    const out = sim.uz[nodeNear(sim.layout, r * 2, 0)] ?? 0;
    expect(centre).toBeLessThan(-2);
    expect(centre).toBeLessThan(mid);
    expect(mid).toBeLessThan(out);
    expect(zForceProfile(0)).toBe(1);
    expect(zForceProfile(1)).toBe(0);
    expect(zForceProfile(0.5)).toBeCloseTo(0.25, 12);
  });

  it('a shock ring ripples in depth: the lift travels outward with the front', () => {
    const sim = zSim();
    addRing(sim, 0, 0, KICK_BOMB.strength, KICK_BOMB.speed, KICK_BOMB.life, KICK_BOMB.width);
    const near = nodeNear(sim.layout, 150, 0);
    const far = nodeNear(sim.layout, 600, 0);
    let tNear = -1;
    let tFar = -1;
    run(sim, 1, (f) => {
      if (tNear < 0 && Math.abs(sim.uz[near] ?? 0) > 1) tNear = f;
      if (tFar < 0 && Math.abs(sim.uz[far] ?? 0) > 1) tFar = f;
    });
    expect(tNear).toBeGreaterThanOrEqual(0);
    expect(tFar).toBeGreaterThan(tNear);
  });

  it('stays bounded and finite over 20 s of fuzzed impulses, then returns to rest', () => {
    const sim = zSim(16);
    const maxZ = maxDispFor(16) * Z_DISP_MUL;
    expect(sim.maxZ).toBe(maxZ);
    let peak = 0;
    let k = 1;
    const h = (): number => hash01(k++);
    run(sim, 20, (f) => {
      clearForces(sim);
      for (let w = 0; w < 3; w++) addForce(sim, (h() - 0.5) * 1600, (h() - 0.5) * 1000, 120 + h() * 200, -h() * 3000);
      if (h() < 0.5) addForce(sim, (h() - 0.5) * 1600, (h() - 0.5) * 1000, 70, 2500);
      for (let i = 0; i < 6; i++) addImpulse(sim, (h() - 0.5) * 1800, (h() - 0.5) * 1100, h() * 1500, 40 + h() * 300);
      if (f % 20 === 0) addRing(sim, (h() - 0.5) * 1600, (h() - 0.5) * 1000, h() * 900, 600 + h() * 800, 0.4 + h(), 30 + h() * 80);
      for (let i = 0; i < sim.layout.free; i++) {
        const z = sim.uz[i] ?? 0;
        if (!Number.isFinite(z)) throw new Error('non finite lift');
      }
      peak = Math.max(peak, maxLift(sim));
    });
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(maxZ + 1e-4);
    clearForces(sim);
    run(sim, 12, () => clearForces(sim));
    expect(maxLift(sim)).toBe(0);
    expect(sim.awake).toBe(false);
  });

  it('reset and toggling clear the lift', () => {
    const sim = zSim();
    addImpulse(sim, 0, 0, KICK_DEATH.strength, KICK_DEATH.radius);
    run(sim, 0.2);
    expect(maxLift(sim)).toBeGreaterThan(0);
    resetLattice(sim);
    expect(maxLift(sim)).toBe(0);
    addImpulse(sim, 0, 0, KICK_DEATH.strength, KICK_DEATH.radius);
    run(sim, 0.2);
    setZEnabled(sim, false);
    expect(maxLift(sim)).toBe(0);
    expect(sim.dirty).toBe(true);
  });

  it('writeLift interpolates free nodes and holds pinned ends at 0', () => {
    const sim = zSim();
    addImpulse(sim, 0, 0, KICK_DEATH.strength, KICK_DEATH.radius);
    run(sim, 0.1);
    const out = new Float32Array(sim.layout.count);
    writeLift(sim, out, 1);
    for (let i = 0; i < sim.layout.free; i++) expect(out[i]).toBe(sim.uz[i]);
    for (let i = sim.layout.free; i < sim.layout.count; i++) expect(out[i]).toBe(0);
    writeLift(sim, out, 0);
    for (let i = 0; i < sim.layout.free; i++) expect(out[i]).toBe(sim.pz[i]);
  });
});

describe('off path equals the v3 positions', () => {
  // Recorded from main's untouched sim.ts (before the z channel) with this exact script.
  const RECORD = { length: 6562, sum: -5252.584921956062, samples: [-876.4398803710938, -510.4894714355469, -252.7098846435547, -274.6716003417969] };
  const AT = [10, 777, 2001, 4321];

  it('a recorded frame is unchanged, and the z channel never leaks into the plane', () => {
    const off = scripted(false);
    const on = scripted(true);
    expect(off.length).toBe(RECORD.length);
    let sum = 0;
    for (let i = 0; i < off.length; i++) sum += off[i] ?? 0;
    expect(sum).toBe(RECORD.sum);
    AT.forEach((i, k) => expect(off[i]).toBe(RECORD.samples[k]));
    for (let i = 0; i < off.length; i++) expect(on[i]).toBe(off[i]);
  });

  it('a tilt 0 camera leaves the recorded frame bit identical', () => {
    const off = scripted(false);
    const copy = off.slice();
    projectNodes(copy, null, copy.length >> 1, makeCamera(0, 1100));
    for (let i = 0; i < off.length; i++) expect(copy[i]).toBe(off[i]);
  });
});
