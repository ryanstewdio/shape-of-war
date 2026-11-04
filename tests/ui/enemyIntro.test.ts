// R3: the intro card lists the enemy kinds the run meets for the first time, with icon, name and type.
import { describe, expect, it } from 'vitest';
import { generateLevel } from '../../src/levelgen/generator';
import { ENEMY_KINDS, V2_ENEMY_KINDS, type RosterEntry } from '../../src/levelgen/leveldef';
import { FOE_INFO, foeLines, foeSpec, iconPaths, levelFoes, newFoes, paletteCss, type FoeKind } from '../../src/ui/enemyIntro';

const roster = (...kinds: RosterEntry['kind'][]): RosterEntry[] => kinds.map((kind) => ({ kind, weight: 1 }));
const ALL: FoeKind[] = [...ENEMY_KINDS, ...V2_ENEMY_KINDS, 'well', 'spawner'];
const TYPES = ['chaser', 'shooter', 'splitter', 'hazard', 'swarm', 'tank'];

describe('new enemies from the roster', () => {
  it('level 1 introduces its whole roster in roster order', () => {
    expect(newFoes({ roster: roster('grunt', 'wanderer', 'pinwheel') }, [])).toEqual(['grunt', 'wanderer', 'pinwheel']);
  });

  it('a kind met on any earlier level of the run is not new', () => {
    const earlier = [{ roster: roster('grunt', 'wanderer') }, { roster: roster('grunt', 'pinwheel') }];
    expect(newFoes({ roster: roster('grunt', 'dart', 'pinwheel', 'swirl') }, earlier)).toEqual(['dart', 'swirl']);
    expect(newFoes({ roster: roster('grunt', 'wanderer') }, earlier)).toEqual([]);
  });

  it('placed hazards count: wells and spawners, once', () => {
    const well = { x: 0, y: 0 };
    const def = { roster: roster('grunt'), hazards: { wells: [well], spawners: [] } };
    expect(levelFoes(def)).toEqual(['grunt', 'well']);
    expect(newFoes(def, [{ roster: roster('grunt'), hazards: { wells: [well], spawners: [] } }])).toEqual([]);
  });

  it('on a generated run, each level lists exactly the roster kinds no earlier level had', () => {
    const seed = 77;
    const defs = Array.from({ length: 10 }, (_, i) => generateLevel(seed, i + 1));
    const seen = new Set<FoeKind>();
    defs.forEach((def, i) => {
      const fresh = newFoes(def, defs.slice(0, i));
      for (const k of fresh) expect(seen.has(k), `level ${i + 1} ${k}`).toBe(false);
      for (const k of levelFoes(def)) if (!fresh.includes(k)) expect(seen.has(k), `level ${i + 1} ${k}`).toBe(true);
      for (const k of levelFoes(def)) seen.add(k);
    });
    expect(newFoes(defs[0] ?? { roster: [] }, [])).toEqual(levelFoes(defs[0] ?? { roster: [] }));
  });
});

describe('names, types and icons', () => {
  it('every kind has a name and a one word type from the brief list', () => {
    for (const k of ALL) {
      expect(FOE_INFO[k].name.length, k).toBeGreaterThan(0);
      expect(TYPES, k).toContain(FOE_INFO[k].type);
    }
    expect(foeLines(['grunt', 'splime', 'dart'])).toEqual([
      { kind: 'grunt', name: 'Grunt', type: 'chaser' },
      { kind: 'splime', name: 'Splime', type: 'splitter' },
      { kind: 'dart', name: 'Dart', type: 'swarm' },
    ]);
  });

  it('every icon is drawn from its shape spec inside the icon square, in palette colours', () => {
    for (const k of ALL) {
      const paths = iconPaths(foeSpec(k), 36);
      expect(paths.length, k).toBeGreaterThan(0);
      for (const p of paths) {
        expect(p.pts.length % 2, k).toBe(0);
        for (const v of p.pts) {
          expect(v, k).toBeGreaterThanOrEqual(-6);
          expect(v, k).toBeLessThanOrEqual(42);
        }
        expect(p.colour, k).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
      }
    }
    expect(paletteCss('blue')).toBe('hsl(215, 75%, 55%)');
    expect(iconPaths(foeSpec('grunt'), 36)[0]?.colour).toBe(paletteCss('blue'));
  });
});

describe('Leaver intro (forge-leaver)', () => {
  it('lists the Leaver as "Leaver, splitter" with its three colour icon', () => {
    const [line] = foeLines(['leaver']);
    expect(line).toEqual({ kind: 'leaver', name: 'Leaver', type: 'splitter' });
    expect(`${line?.name}, ${line?.type}`).toBe('Leaver, splitter');
    const colours = new Set(iconPaths(foeSpec('leaver'), 36).map((p) => p.colour));
    expect(colours).toEqual(new Set([paletteCss('yellow'), paletteCss('green'), paletteCss('red')]));
  });
});
