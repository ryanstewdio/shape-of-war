// swarm-r6-drumboss: Ryan (build e8d2da5) saw drum boss attacks miss across the u seam although the
// leaverRequests seam tests passed. The gaps: hazardHitsOn tested only the ship's nearest image, so
// a ring grown past half the drum (Warden's, Twins', Prism's) that wraps round and crosses the
// ship from the far side never hit; and the body, Hornet, Broodling and bullet versus body contacts,
// shot ranges, Mirage's lane check, Ember's dash and Tempest's rays used flat offsets. Each path is
// tested here on a real drum fight with the ship across the seam from the attack.
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FREE_PLAY, type FreePlayConfig } from '../../src/core/freeplayConfig';
import { bus } from '../../src/core/events';
import { cylinderSurface, flatSurface } from '../../src/core/surface';
import {
  bossBodyContact,
  HAZARD_OVERLAP,
  bossContacts,
  hazardLethalAt,
  spawnHornet,
  spawnLane,
  spawnPull,
  spawnRing,
  spawnSweep,
  spawnTether,
} from '../../src/game/bosses/core';
import { DRUM_SAFE_BOSSES } from '../../src/game/bosses/index';
import { circlesOverlapOn, hazardHits, hazardHitsOn, hazardReach, imagesFor, pointDistOn } from '../../src/game/bosses/kit';
import { fireVolley } from '../../src/game/bosses/shots';
import { throughArc } from '../../src/game/bosses/mirage';
import { enemyBulletsOf } from '../../src/game/enemyBullets';
import { bossOf } from '../../src/game/bosses/state';
import { BOSS_SHOTS, BOSS_TABLE, HORNET } from '../../src/game/bosses/table';
import { HazardType } from '../../src/game/bosses/types';
import { createEndlessGame, setInvulnerable, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { BOSS_IDS, type BossId } from '../../src/levelgen/leveldef';
import { FREE_PLAY_DRUM_BOSSES } from '../../src/levelgen/boss';
import { freePlayLevel, freePlaySegment } from '../../src/levelgen/freeplay';
import { bossGame, bossLevel, bs, enter, park, run } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => bus.clear());

const W = 1600;
const H = 1000;
const drum = cylinderSurface(W, H);
const flat = flatSurface(W, H);

/** A boss fight on a quiet drum (the bossHelpers level as a cylinder), past the entrance. */
function drumFight(id: BossId): { w: World; boss: number } {
  const arena = { ...bossLevel(id).arena, width: W, height: H, obstacles: [] }; // the Free Play drum size
  const w = bossGame(id, { surface: 'cylinder', arena });
  const boss = enter(w);
  return { w, boss };
}

/** Make the ship mortal and at rest at (x, y). */
function exposeShip(w: World, x: number, y: number): void {
  park(w, x, y);
  gs(w).invulnerable = false;
  w.ship.invuln = 0;
}

/** Put entity id at (x, y). */
function place(w: World, id: number, x: number, y: number): void {
  w.x[id] = x;
  w.y[id] = y;
  w.prevX[id] = x;
  w.prevY[id] = y;
}

/** Age a hazard past its telegraph so it is lethal. */
function arm(w: World, h: number): void {
  w.t[h] = (bs(w).hzTele[h] ?? 0) + 0.01;
}

describe('kit: every ship image a hazard can reach', () => {
  it('a ring wider than half the drum hits the ship it wraps round to (the device gap)', () => {
    // Ring at u = 0, radius 900: its left arc reaches u = -900, which is u = 700 on the strip. The
    // ship at u = 700 is 700 from the centre the short way, so the nearest image alone missed it.
    expect(hazardHitsOn(drum, HazardType.Ring, 700, 0, 12, 0, 0, Math.PI / 2, 900, 0.3, 1)).toBe(true);
    expect(hazardHits(HazardType.Ring, 700, 0, 12, 0, 0, Math.PI / 2, 900, 0.3, 1)).toBe(false);
    // Its gap still saves the ship: gap centred on pi (the arc that wrapped to u = 700).
    expect(hazardHitsOn(drum, HazardType.Ring, 700, 0, 12, 0, 0, Math.PI, 900, 0.3, 1)).toBe(false);
  });

  it('a lane longer than half the drum hits the far image', () => {
    // Lane from u = 0 along +u, 1000 long: it covers u = 0 to 1000, so u = -700 (900 on the long way).
    expect(hazardHitsOn(drum, HazardType.Lane, -700, 0, 12, 0, 0, 0, 20, 1000, 0)).toBe(true);
    expect(hazardHitsOn(drum, HazardType.Lane, -700, 0, 12, 0, 0, 0, 20, 500, 0)).toBe(false);
  });

  it('reach and image counts', () => {
    expect(hazardReach(HazardType.Ring, 12, 900, 0, 0)).toBeGreaterThan(900);
    expect(hazardReach(HazardType.Pull, 12, 300, 0, 0)).toBe(0);
    expect(imagesFor(0, W)).toBe(0);
    expect(imagesFor(100, W)).toBe(1);
    expect(imagesFor(1900, W)).toBe(2);
    expect(imagesFor(1e9, W)).toBe(3);
  });

  it('flat stays bit identical to hazardHits, big radii included', () => {
    for (let k = 0; k < 300; k++) {
      const px = ((k * 137) % 1600) - 800;
      const py = ((k * 53) % 1000) - 500;
      const r = 40 + ((k * 71) % 1500);
      for (const t of [HazardType.Lane, HazardType.Ring, HazardType.Sweep, HazardType.Tether, HazardType.Pull]) {
        expect(hazardHitsOn(flat, t, px, py, 12, 10, -5, k * 0.1, r, 0.4 + r, 1)).toBe(hazardHits(t, px, py, 12, 10, -5, k * 0.1, r, 0.4 + r, 1));
      }
    }
  });

  it('circle and distance helpers go the short way on a drum and the flat way on flat', () => {
    expect(circlesOverlapOn(drum, 790, 0, 12, -790, 0, 12)).toBe(true);
    expect(circlesOverlapOn(flat, 790, 0, 12, -790, 0, 12)).toBe(false);
    expect(pointDistOn(drum, 790, 0, -790, 0)).toBeCloseTo(20, 9);
    expect(pointDistOn(flat, 790, 0, -790, 0)).toBe(1580);
  });
});

describe('Mirage front arc across the seam', () => {
  it('a shot from in front across the seam gets through the gate', () => {
    // Body at u = 790 facing +u; the shot at u = -790 is 20 u in front of it the short way.
    expect(throughArc(790, 0, 0, -790, 0, drum)).toBe(true);
    expect(throughArc(790, 0, 0, -790, 0)).toBe(false);
  });
});

describe('fairness rule 5 sees across the seam', () => {
  it('a lane that would spawn on a ship across the seam waits instead', () => {
    const { w } = drumFight('prism');
    const half = w.surface.width / 2;
    park(w, -half + 30, 200);
    expect(spawnLane(w, bs(w), half - 100, 200, 0, 200, 20)).toBe(HAZARD_OVERLAP);
  });
});

describe('every boss damage path across the seam, on a real drum fight', () => {
  it('the boss body kills a ship across the seam, and player bullets hit it there', () => {
    const { w, boss } = drumFight('warden');
    const half = w.surface.width / 2;
    const r = w.radius[boss] ?? 0;
    place(w, boss, half - r / 2, 0);
    expect(bossBodyContact(w, boss, -half + r / 4, 0, 4)).toBe(true);
    exposeShip(w, -half + r / 4, 0);
    expect(bossContacts(w, 0)).toBe(true);
    expect(w.ship.active).toBe(false);
  });

  it('an armed Hornet kills across the seam', () => {
    const { w } = drumFight('warden');
    const half = w.surface.width / 2;
    const h = spawnHornet(w, bs(w), half - 4, 100, 0);
    expect(h).toBeGreaterThan(0);
    w.t[h] = HORNET.armSec + 0.01;
    exposeShip(w, -half + 4, 100);
    expect(bossContacts(w, 0)).toBe(true);
  });

  it('a Warden sized ring wrapped round the drum kills the ship it crosses', () => {
    const { w, boss } = drumFight('warden');
    const half = w.surface.width / 2;
    place(w, boss, 0, 0);
    exposeShip(w, half - 100, 0); // 700 from the centre the short way
    gs(w).invulnerable = true; // spawn while shielded, so fairness rule 5 does not refuse the ring
    const h = spawnRing(w, bs(w), 0, 0, 500, -Math.PI / 2, 0.3, 1, 0);
    expect(h).toBeGreaterThan(0);
    w.radius[h] = w.surface.width - (half - 100); // 900: the left arc wrapped to u = 700
    arm(w, h);
    gs(w).invulnerable = false;
    expect(hazardLethalAt(w, bs(w), h, w.x[0] ?? 0, w.y[0] ?? 0)).toBe(true);
    expect(bossContacts(w, 0)).toBe(true);
  });

  it('lanes, sweeps and tethers reaching over the seam kill', () => {
    for (const make of ['lane', 'sweep', 'tether'] as const) {
      const { w } = drumFight('prism');
      const half = w.surface.width / 2;
      park(w, 0, -300); // away while the hazard spawns (fairness rule 5 refuses one on the ship)
      const b = bs(w);
      const h =
        make === 'lane'
          ? spawnLane(w, b, half - 100, 200, 0, 200, 20)
          : make === 'sweep'
            ? spawnSweep(w, b, half - 100, 200, 0, 1, 200, 0, false)
            : spawnTether(w, b, half - 60, 200, -half + 80, 200, -1);
      expect(h, make).toBeGreaterThan(0);
      arm(w, h);
      exposeShip(w, -half + 30, 200);
      expect(bossContacts(w, 0), make).toBe(true);
    }
  });

  it('a pull across the seam draws the ship the short way', () => {
    const { w } = drumFight('gravitas');
    const half = w.surface.width / 2;
    for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === Kind.BossHazard) w.alive[i] = 0;
    exposeShip(w, -half + 40, 0);
    gs(w).invulnerable = true;
    gs(w).shipPullX = 0;
    expect(spawnPull(w, bs(w), half - 40, 0, 300, -1, false)).toBeGreaterThan(0);
    bossContacts(w, DT);
    // The pull sits 80 u to the ship's left across the seam: the ship is drawn toward -u.
    expect(gs(w).shipPullX).toBeLessThan(0);
  });

  it('boss shots measure their range the short way (no point blank volley across the seam)', () => {
    const { w, boss } = drumFight('spindle');
    const half = w.surface.width / 2;
    const r = w.radius[boss] ?? 0;
    place(w, boss, half - r - 20, 0);
    park(w, -half + 100, 0); // about 200 u the short way: inside ENEMY_BULLET_MIN_RANGE
    const row = BOSS_SHOTS.spindle;
    if (row === undefined) throw new Error('no spindle row');
    expect(fireVolley(w, boss, bs(w), row, 1)).toBe(false);
    park(w, -200, 0); // far both ways
    expect(fireVolley(w, boss, bs(w), row, 1)).toBe(true);
  });
});

describe('every boss fights on a drum', () => {
  it('DRUM_SAFE_BOSSES names every boss and matches the levelgen list', () => {
    expect([...DRUM_SAFE_BOSSES].sort()).toEqual([...BOSS_IDS].sort());
    expect(DRUM_SAFE_BOSSES).toEqual(FREE_PLAY_DRUM_BOSSES);
  });

  it.each([...BOSS_IDS])('%s: 40 s on a drum with the ship hugging the seam stays on the strip and keeps attacking', (id) => {
    const { w } = drumFight(id);
    expect(bossOf(w)?.spec.id).toBe(id);
    const pool = enemyBulletsOf(w);
    const half = w.surface.width / 2;
    const input = idle();
    let hazards = 0;
    let bullets = 0;
    for (let i = 0; i < 40 * 120; i++) {
      // The ship flips sides of the seam every 2 s, so every attack has to follow it across.
      park(w, (Math.floor(i / 240) % 2 === 0 ? 1 : -1) * (half - 20), 0);
      stepGame(w, DT, input);
      for (let e = 1; e < w.cap; e++) {
        if (w.alive[e] !== 1) continue;
        const k = w.kind[e];
        if (k !== Kind.Boss && k !== Kind.BossPart && k !== Kind.BossHazard) continue;
        const x = w.x[e] ?? 0;
        expect(Number.isFinite(x) && Number.isFinite(w.y[e] ?? 0), `${id} entity ${e}`).toBe(true);
        expect(x >= -half && x < half, `${id} kind ${k} at u ${x}`).toBe(true);
        if (k === Kind.BossHazard) hazards++;
      }
      for (let b = 0; b < pool.cap; b++) if (pool.alive[b] === 1) bullets++;
    }
    expect(bs(w).status).toBe('alive');
    expect(hazards + bullets, `${id} attacked`).toBeGreaterThan(0);
  });
});

describe('Free Play honours the chosen boss on a drum', () => {
  const cfg = (bosses: FreePlayConfig['bosses']): FreePlayConfig => ({ ...DEFAULT_FREE_PLAY, bosses, enemies: ['grunt'] });

  it('Gravitas chosen on a drum is Gravitas in the real run', () => {
    const def = freePlayLevel({ arena: 'drum', barriers: false, seed: 77, config: cfg('gravitas') });
    expect(freePlaySegment(def, 3).boss).toMatchObject({ id: 'gravitas', tier: BOSS_TABLE.gravitas.tier });
    const w = createEndlessGame(def, (s) => freePlaySegment(def, s), { vibrate: () => undefined, freePlay: cfg('gravitas') });
    setInvulnerable(w, true);
    expect(w.surface.topology.wrapU).toBe(true);
    const input = idle();
    for (let i = 0; i < 120 * 120 && bossOf(w)?.status !== 'alive'; i++) stepGame(w, DT, input);
    expect(bossOf(w)?.spec.id).toBe('gravitas');
    expect(bossOf(w)?.status).toBe('alive');
    run(w, 5);
  });
});
