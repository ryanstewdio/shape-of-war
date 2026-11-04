// forge-leaver, Foundry's R5 requests: Free Play wells arrive over time (Endless still does not),
// with FREE_PLAY_ARRIVAL_GAP_SCALE on the gaps for wells 'many'; drum boss hazards hit across the
// u seam (kit.ts hazardHitsOn through surface.delta), flat play bit identical.
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FREE_PLAY, type FreePlayConfig } from '../../src/core/freeplayConfig';
import { bus } from '../../src/core/events';
import { cylinderSurface, flatSurface } from '../../src/core/surface';
import { hazardHits, hazardHitsOn } from '../../src/game/bosses/kit';
import { HazardType } from '../../src/game/bosses/types';
import { createEndlessGame, setInvulnerable, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { arrivalGapSec, firstArrivalSec } from '../../src/game/wellArrival';
import type { World } from '../../src/game/world';
import { FREE_PLAY_ARRIVAL_GAP_SCALE, freePlayLevel, freePlaySegment } from '../../src/levelgen/freeplay';
import { DT, idle } from './helpers';

afterEach(() => bus.clear());

function freePlayGame(config: FreePlayConfig, asFreePlay: boolean): { w: World; arrivals: number[] } {
  const def = freePlayLevel({ arena: 'rect', barriers: false, seed: 1234, config });
  const w = createEndlessGame(def, (s) => freePlaySegment(def, s), { vibrate: () => undefined, ...(asFreePlay ? { freePlay: config } : {}) });
  setInvulnerable(w, true);
  w.ship.invuln = 1e9;
  const arrivals: number[] = [];
  bus.on('sim:wellArrive', () => arrivals.push(gs(w).waveClock));
  return { w, arrivals };
}

function run(w: World, sec: number): void {
  const input = idle();
  for (let i = 0; i < Math.round(sec / DT); i++) stepGame(w, DT, input);
}

describe('Free Play wells arrive over time', () => {
  it('a Free Play run gets arrivals; the same def as plain Endless gets none', () => {
    const cfg: FreePlayConfig = { ...DEFAULT_FREE_PLAY, wells: 'normal', enemies: ['grunt'] };
    const fp = freePlayGame(cfg, true);
    expect(fp.w.level.hazards.wells.length).toBeGreaterThan(0);
    expect(gs(fp.w).arrivalGapScale).toBe(1);
    run(fp.w, firstArrivalSec(fp.w.level.seed) + 2);
    expect(fp.arrivals.length).toBe(1);
    expect(fp.arrivals[0]).toBeCloseTo(firstArrivalSec(fp.w.level.seed), 1);
    bus.clear();
    const plain = freePlayGame(cfg, false);
    run(plain.w, firstArrivalSec(plain.w.level.seed) + 2);
    expect(plain.arrivals).toEqual([]);
    expect(gs(plain.w).arrivalGapScale).toBe(0);
  });

  it("wells 'many' schedules each later arrival FREE_PLAY_ARRIVAL_GAP_SCALE as far apart", () => {
    const cfg: FreePlayConfig = { ...DEFAULT_FREE_PLAY, wells: 'many', enemies: ['grunt'] };
    const { w } = freePlayGame(cfg, true);
    expect(gs(w).arrivalGapScale).toBe(FREE_PLAY_ARRIVAL_GAP_SCALE);
    const seed = w.level.seed;
    run(w, firstArrivalSec(seed) + 0.5);
    // The arrival fell due (it telegraphs unless 'many' already filled the well cap) and the next
    // one is scheduled at the scaled gap.
    expect(gs(w).wellArrivals).toBe(1);
    expect(gs(w).wellArriveAt).toBeCloseTo(firstArrivalSec(seed) + arrivalGapSec(seed, 1) * FREE_PLAY_ARRIVAL_GAP_SCALE, 6);
  });

  it("wells 'off' places no wells, so nothing arrives", () => {
    const cfg: FreePlayConfig = { ...DEFAULT_FREE_PLAY, wells: 'off', enemies: ['grunt'] };
    const { w, arrivals } = freePlayGame(cfg, true);
    expect(w.level.hazards.wells).toEqual([]);
    run(w, 40);
    expect(arrivals).toEqual([]);
  });
});

describe('boss hazards across the drum seam', () => {
  const W = 1600;
  const drum = cylinderSurface(W, 1000);
  const flat = flatSurface(W, 1000);

  it('a lane reaching over the seam hits a ship on the other side', () => {
    // Lane from x = 700 pointing +x, 200 long: it crosses u = 800 and reaches u = -700.
    const args = [HazardType.Lane, -720, 0, 12, 700, 0, 0, 20, 200, 0] as const;
    expect(hazardHits(...args)).toBe(false);
    expect(hazardHitsOn(flat, ...args)).toBe(false);
    expect(hazardHitsOn(drum, ...args)).toBe(true);
  });

  it('a ring and a sweep near the seam hit across it', () => {
    // Ring at x = 780, radius 60: the band passes u = -760 (840 on the far image).
    expect(hazardHitsOn(drum, HazardType.Ring, -760, 0, 12, 780, 0, Math.PI, 60, 0.1, 1)).toBe(true);
    expect(hazardHitsOn(flat, HazardType.Ring, -760, 0, 12, 780, 0, Math.PI, 60, 0.1, 1)).toBe(false);
    // Sweep at x = 780, one arm along +x, 150 long, half width 20.
    expect(hazardHitsOn(drum, HazardType.Sweep, -740, 0, 12, 780, 0, 0, 20, 150, 1)).toBe(true);
    expect(hazardHitsOn(flat, HazardType.Sweep, -740, 0, 12, 780, 0, 0, 20, 150, 1)).toBe(false);
  });

  it('a tether whose ends sit either side of the seam spans the short way', () => {
    // Bodies at u = 760 and u = -760: the short tether crosses the seam, not the middle.
    expect(hazardHitsOn(drum, HazardType.Tether, 795, 0, 12, 760, 0, 0, 20, -760, 0)).toBe(true);
    expect(hazardHitsOn(drum, HazardType.Tether, 0, 0, 12, 760, 0, 0, 20, -760, 0)).toBe(false);
    expect(hazardHitsOn(flat, HazardType.Tether, 0, 0, 12, 760, 0, 0, 20, -760, 0)).toBe(true);
  });

  it('flat is bit identical to hazardHits', () => {
    for (let k = 0; k < 200; k++) {
      const px = ((k * 37) % 400) - 200;
      const py = ((k * 53) % 300) - 150;
      for (const t of [HazardType.Lane, HazardType.Ring, HazardType.Sweep, HazardType.Tether, HazardType.Pull]) {
        expect(hazardHitsOn(flat, t, px, py, 12, 10, -5, k * 0.1, 40, 120, 60)).toBe(hazardHits(t, px, py, 12, 10, -5, k * 0.1, 40, 120, 60));
      }
    }
  });
});
