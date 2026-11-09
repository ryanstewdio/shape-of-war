// Gate GC triage (run 0161). On device at 374a7b9 the tester reported, for run seed 42, that
// Swirl did not appear on level 7, Blink on 17 or Sower on 31. These tests are the evidence that
// generateLevel(42, n) does contain each kind early in the level, that the sim spawns it, and
// they pin the level hashes so the HUD hash on device can be compared against them.
import { describe, expect, it } from 'vitest';
import { createGame, gameState, setInvulnerable, stepGame } from '../../src/game/game';
import { Kind } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { generateLevel, levelHash } from '../../src/levelgen/generator';
import type { EnemyKind, LevelDef } from '../../src/levelgen/leveldef';

const SEED = 42;
/** Share of a level's waves that counts as "early": waves with index below floor(0.6 x n). */
const EARLY_FRAC = 0.6;

/**
 * The six first appearances claimed in run 0155. Release polish (long levels, generator version 5)
 * moved every hash: was, in order, 93A4C56E, CC6859DC, 5BD14124, F383CDC7, F9779FC2, 66AF8BD7.
 * Release gate R1 (version 6: whole level par, volatile waves) moved them again: at version 5
 * they were 184C1369, 66985C67, 18F95442, AC6E0C94, A537DF3D, 373D700E. Release gate R3 (version 8:
 * 3.5 minute objectives, shorter ramp) moved them again: at version 6 they were 7AFE6A2E,
 * 19541E27, C91F9CAD, ECE6591B, B7252DF2, 0AD5EE06.
 */
// foundry-t3: every hash moved only because the default config now reports generatorVersion 9 (content unchanged, no ripples on these levels).
// foundry-par-ramp: every hash moved again with version 10 (V10_COLLECT_RATE par; L6 and L9 also the PAR_RAMP_SCALE waves). At version 9 they were
// A2BB5FF8, F5B2639B, 9CEB693F, B96340D5, 8988A5CA, 19B18454.
const CASES: readonly { level: number; kind: EnemyKind; hash: string }[] = [
  { level: 6, kind: 'charger', hash: 'B78C7357' },
  // foundry-score-target: L7 is scoreInTime, target now 0.6 x par (was D54392E1).
  { level: 7, kind: 'swirl', hash: '290D6E36' },
  { level: 9, kind: 'splime', hash: 'A3828605' },
  // D13 C0: seed 42 level 16 is now a cylinder level (was D736C51F flat at 374a7b9). Drum-maps:
  // a pillars drum (was 712BC1C1 open drum at 8d5c989).
  { level: 16, kind: 'bulwark', hash: '58D4019A' },
  // D13 C0: seed 42 level 17 is now a cylinder level too (was 43CADCE4 flat at 374a7b9). Drum-maps:
  // a pillars drum (was BCC2F1B8 open drum at 8d5c989).
  { level: 17, kind: 'blink', hash: '91A720FA' },
  // forge-leaver: seed 42 level 31 gains a Leaver group (was 524D746B); its Sower is unchanged.
  // foundry-score-target: L31 is scoreInTime, target now 0.6 x par (was DDB938BA).
  { level: 31, kind: 'sower', hash: 'C50210F9' },
];

interface EarlySpawn {
  /** Index of the first wave with an entry of the kind, or -1. */
  firstWave: number;
  /** Entries of the kind in that wave. */
  firstCount: number;
  /** Entries of the kind across the early waves. */
  earlyCount: number;
  /** Number of early waves looked at, and of all waves. */
  earlyWaves: number;
  waves: number;
}

/** Pure: where a kind first spawns in a level's wave list, limited to the early waves. */
function earlySpawn(def: Pick<LevelDef, 'waves'>, kind: EnemyKind, frac = EARLY_FRAC): EarlySpawn {
  const all = def.waves.waves;
  const earlyWaves = Math.floor(all.length * frac);
  const counts = all.slice(0, earlyWaves).map((w) => w.entries.filter((e) => e.kind === kind).length);
  const firstWave = counts.findIndex((c) => c > 0);
  return {
    firstWave,
    firstCount: firstWave < 0 ? 0 : (counts[firstWave] ?? 0),
    earlyCount: counts.reduce((a, c) => a + c, 0),
    earlyWaves,
    waves: all.length,
  };
}

/** Pure: lowest level in 1..maxLevel whose early waves spawn the kind, or -1. */
function lowestEarlyLevel(seed: number, kind: EnemyKind, maxLevel: number): number {
  for (let n = 1; n <= maxLevel; n++) if (earlySpawn(generateLevel(seed, n), kind).firstCount > 0) return n;
  return -1;
}

function idleInput(): InputState {
  return { move: { active: false, x: 0, y: 0 }, aim: { active: false, x: 0, y: 0 }, bomb: false, superPressed: false, pause: false };
}

const SIM_KIND: Readonly<Record<string, Kind>> = {
  charger: Kind.Charger,
  swirl: Kind.Swirl,
  splime: Kind.Splime,
  bulwark: Kind.Bulwark,
  blink: Kind.Blink,
  sower: Kind.Sower,
};

/** Seconds of sim time, invulnerable ship and idle sticks, until the first spawn of the kind, or -1. */
function firstSimSpawnSec(def: LevelDef, kind: Kind, maxSec: number): number {
  const w = createGame(def, { logSpawns: true, vibrate: () => undefined });
  setInvulnerable(w, true);
  const input = idleInput();
  const dt = 1 / 120;
  for (let i = 0; i < maxSec * 120; i++) {
    stepGame(w, dt, input);
    const hit = (gameState(w).spawnLog ?? []).find((e) => e.kind === kind);
    if (hit !== undefined) return hit.t;
  }
  return -1;
}

describe('gate GC triage, seed 42', () => {
  it('each named kind spawns with a count above zero in the first 60 percent of its level', () => {
    const rows = CASES.map(({ level, kind }) => ({ level, kind, ...earlySpawn(generateLevel(SEED, level), kind) }));
    const table = rows.map((r) => ({
      level: r.level,
      kind: r.kind,
      firstWave: r.firstWave,
      firstCount: r.firstCount,
      earlyCount: r.earlyCount,
      earlyWaves: r.earlyWaves + '/' + r.waves,
    }));
    console.table(table);
    for (const r of rows) {
      expect(r.firstWave, r.kind + ' on L' + r.level).toBeGreaterThanOrEqual(0);
      expect(r.firstCount, r.kind + ' on L' + r.level).toBeGreaterThan(0);
    }
  });

  it('pins the level hashes, so the HUD hash on device can be checked', () => {
    for (const c of CASES) expect(levelHash(generateLevel(SEED, c.level)), 'L' + c.level).toBe(c.hash);
  });

  it('the lowest early spawn level of each kind is its claimed first appearance', () => {
    const lowest = Object.fromEntries(CASES.map((c) => [c.kind, lowestEarlyLevel(SEED, c.kind, 40)]));
    console.log('lowest early spawn level, seed 42: ' + JSON.stringify(lowest));
    expect(lowest).toEqual(Object.fromEntries(CASES.map((c) => [c.kind, c.level])));
  });

  it('the sim spawns the kind from the LevelDef within its early window', () => {
    const rows: { level: number; kind: EnemyKind; firstSimSec: number }[] = [];
    for (const c of CASES) {
      const def = generateLevel(SEED, c.level);
      const sk = SIM_KIND[c.kind];
      if (sk === undefined) throw new Error('no sim kind for ' + c.kind);
      const t = firstSimSpawnSec(def, sk, 30);
      rows.push({ level: c.level, kind: c.kind, firstSimSec: Math.round(t * 10) / 10 });
      expect(t, c.kind + ' on L' + c.level).toBeGreaterThan(0);
    }
    console.table(rows);
  });
});
