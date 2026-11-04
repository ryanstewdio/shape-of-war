// R7 (Gate R6): "Orbit as the par reward: shots not displayed, but the sound and kills happened."
// Real path: createGame with each start weapon, the real loop, then the renderer's own bullet
// bookkeeping (spikeSaw markSpikeMask and bulletDrawCode, bulletStyles visualForCode). Every live
// player bullet maps to a visible draw entry, exactly as with the same weapon picked up in play.
// Cause found: no bullet missed a draw. Orbit fires nothing forward (docs/01 Orbit v2) yet every
// volley played 'shot', so a held stick sounded like shooting with nothing on screen.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import type { BaseWeaponKind } from '../../src/core/events';
import { stepGame } from '../../src/game/game';
import { currentWeapon, equipWeapon, shieldOf, weaponState } from '../../src/game/weapons';
import type { World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { SPIKE_CODE, visualForCode } from '../../src/render/bulletStyles';
import { bulletDrawCode, markSpikeMask, spikeDrawLen } from '../../src/render/spikeSaw';
import { DT, idle, makeGame } from './helpers';

afterEach(() => bus.clear());

const START_WEAPONS: readonly BaseWeaponKind[] = ['spread', 'rapid', 'pierce', 'orbit'];
const STEPS = 240;

function aimRight(): InputState {
  const i = idle();
  i.aim = { active: true, x: 1, y: 0 };
  return i;
}

interface DrawEntry {
  id: number;
  style: number;
  code: number;
}

/** The renderer's draw bookkeeping for one frame: one entry per live player bullet. */
function drawEntries(w: World): DrawEntry[] {
  const p = w.bullets;
  const ws = weaponState(w);
  const sh = shieldOf(ws.kind);
  const mask = new Uint8Array(p.cap);
  markSpikeMask(mask, ws.blades, sh === null ? 0 : sh.perRing);
  const out: DrawEntry[] = [];
  for (let i = 0; i < p.cap; i++) {
    if (p.alive[i] !== 1) continue;
    const style = p.style[i] ?? 0;
    out.push({ id: i, style, code: bulletDrawCode(style, p.homing[i] === 1, mask[i] ?? 0) });
  }
  return out;
}

/** True when the entry draws something: a tooth with length, or a head with a frame and scale. */
function visible(w: World, e: DrawEntry): boolean {
  if (e.code === SPIKE_CODE) return spikeDrawLen(w.bullets.spikeLen[e.id] ?? 0) > 0;
  const v = visualForCode(e.code);
  return v.frame.length > 0 && v.scale > 0;
}

function codeCounts(entries: readonly DrawEntry[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const e of entries) m.set(e.code, (m.get(e.code) ?? 0) + 1);
  return m;
}

function startGame(weapon: BaseWeaponKind): World {
  const { w } = makeGame({}, { startBonus: { kind: 'weapon', weapon } });
  w.ship.invuln = 1e9;
  return w;
}

function pickupGame(weapon: BaseWeaponKind): World {
  const { w } = makeGame();
  w.ship.invuln = 1e9;
  equipWeapon(w, weapon, w.x[0] ?? 0, w.y[0] ?? 0); // the pickup path (pickup.ts collectPickup)
  return w;
}

function run(w: World, steps: number, input: InputState): void {
  for (let i = 0; i < steps; i++) stepGame(w, DT, input);
}

describe('R7 start weapon: every live player bullet has a visible draw entry', () => {
  for (const weapon of START_WEAPONS) {
    it(`${weapon}: live bullets all draw, at the start and while firing`, () => {
      const w = startGame(weapon);
      expect(currentWeapon(w)).toBe(weapon);
      const input = aimRight();
      for (let s = 0; s <= STEPS; s += 20) {
        const entries = drawEntries(w);
        expect(entries.length).toBe(w.bullets.liveCount);
        for (const e of entries) expect(visible(w, e), `${weapon} step ${s} bullet ${e.id} style ${e.style}`).toBe(true);
        // A style 3 bullet that is not a marked tooth would fall back to a plain head.
        for (const e of entries) if (e.style === 3) expect(e.code).toBe(SPIKE_CODE);
        run(w, 20, input);
      }
      expect(w.bullets.liveCount).toBeGreaterThan(0);
    });

    it(`${weapon}: draws exactly like the same weapon picked up in play`, () => {
      const a = startGame(weapon);
      const b = pickupGame(weapon);
      expect(currentWeapon(b)).toBe(currentWeapon(a));
      const input = aimRight();
      run(a, STEPS, input);
      run(b, STEPS, input);
      expect(codeCounts(drawEntries(a))).toEqual(codeCounts(drawEntries(b)));
    });
  }

  it('orbit: all 8 saw teeth are marked from the first frame (blades in slots 0 to 7)', () => {
    const w = startGame('orbit');
    const entries = drawEntries(w);
    expect(entries.length).toBe(8);
    expect(entries.every((e) => e.code === SPIKE_CODE)).toBe(true);
  });
});

describe("R7 'shot' sound only when a shot leaves the ship", () => {
  function shotSounds(w: World, steps: number): number {
    let n = 0;
    const off = bus.on('sfx', (s) => {
      if (s === 'shot') n++;
    });
    run(w, steps, aimRight());
    off();
    return n;
  }

  it('orbit (start or pickup) fires nothing forward and plays no shot sound', () => {
    expect(shotSounds(startGame('orbit'), STEPS)).toBe(0);
    expect(shotSounds(pickupGame('orbit'), STEPS)).toBe(0);
  });

  for (const weapon of ['spread', 'rapid', 'pierce'] as const) {
    it(`${weapon} still plays a shot sound per volley`, () => {
      expect(shotSounds(startGame(weapon), STEPS)).toBeGreaterThan(0);
    });
  }

  it('orbit pairs that fire forward still play it', () => {
    const w = pickupGame('orbit');
    equipWeapon(w, 'rapid', 0, 0); // Whirl: rapid forward plus the rings
    expect(currentWeapon(w)).toBe('rapid+orbit');
    expect(shotSounds(w, STEPS)).toBeGreaterThan(0);
  });
});
