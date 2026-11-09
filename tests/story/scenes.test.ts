// Story scene data checks (docs/19 "Scene rules" and "Panel spec for the builder"): every line at
// most 40 characters with {callsign} counted as 10, at most 2 lines per panel, at most one Torus
// line per scene, no em or en dashes, every boss and enemy kind covered, JSON serialisable, and
// every line and visual note word for word from the bible.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BOSS_IDS } from '../../src/levelgen/leveldef';
import { COMBOS, CALLSIGN_TOKEN, GUARDIAN_ORDER, SCENES, SCENE_IDS, comboId, countedLength, fillCallsign, type Scene } from '../../src/story/scenes';
import { FOE_INFO, type FoeKind } from '../../src/ui/enemyIntro';

const all: Scene[] = SCENE_IDS.map((id) => SCENES[id] as Scene);
const BIBLE = readFileSync(fileURLToPath(new URL('../../docs/19-story-bible.md', import.meta.url)), 'utf8');

/** Bible panel rows in order: the visual note and the quoted lines with their speaker. */
function biblePanels(): { note: string; lines: { who: string; text: string }[] }[] {
  const start = BIBLE.indexOf('## Opening, before level 1');
  const end = BIBLE.indexOf('## Endless and Free Play');
  const out: { note: string; lines: { who: string; text: string }[] }[] = [];
  for (const row of BIBLE.slice(start, end).split('\n')) {
    const m = /^- P\d+ \((.*)\): (.*)$/.exec(row);
    if (m === null) continue;
    const lines = (m[2] ?? '').split(' | ').map((part) => {
      const q = /^(?:(Torus|Vecta): )?"(.*)"$/.exec(part.trim());
      if (q === null) throw new Error(`unparsed bible line: ${part}`);
      return { who: (q[1] ?? 'narrator').toLowerCase(), text: q[2] ?? '' };
    });
    out.push({ note: m[1] ?? '', lines });
  }
  return out;
}

describe('story scene data', () => {
  it('takes every panel, line and speaker word for word from docs/19, in bible order', () => {
    const bible = biblePanels();
    const ours = all.flatMap((s) => s.panels.map((p) => ({ note: p.note, lines: p.lines.map((l) => ({ who: l.who, text: l.text })) })));
    expect(bible.length).toBeGreaterThan(80);
    expect(ours).toEqual(bible);
  });

  it('keeps every line at 40 characters or fewer, with {callsign} counted as 10', () => {
    for (const s of all)
      for (const p of s.panels)
        for (const l of p.lines) {
          expect(countedLength(l.text), `${s.id}: ${l.text}`).toBeLessThanOrEqual(40);
          expect(fillCallsign(l.text, 'ABCDEFGHIJ').length, l.text).toBeLessThanOrEqual(40);
        }
    expect(countedLength(`a ${CALLSIGN_TOKEN}`)).toBe(12);
  });

  it('has 1 or 2 lines per panel and at most one Torus line per scene', () => {
    for (const s of all) {
      expect(s.panels.length, s.id).toBeGreaterThan(0);
      for (const p of s.panels) {
        expect(p.lines.length, s.id).toBeGreaterThanOrEqual(1);
        expect(p.lines.length, s.id).toBeLessThanOrEqual(2);
      }
      const torus = s.panels.flatMap((p) => p.lines).filter((l) => l.who === 'torus');
      expect(torus.length, s.id).toBeLessThanOrEqual(1);
    }
  });

  it('has no em or en dashes anywhere in the data', () => {
    expect(JSON.stringify(SCENES)).not.toMatch(/[\u2013\u2014]/);
  });

  it('is JSON serialisable and round trips unchanged', () => {
    expect(JSON.parse(JSON.stringify(SCENES))).toEqual(SCENES);
  });

  it('keys each scene by its trigger id and its type matches the id', () => {
    for (const [id, s] of Object.entries(SCENES)) {
      expect(s.id).toBe(id);
      const head = id.split(':')[0];
      const type = { opening: 'opening', foe: 'briefing', combo: 'briefing', boss: 'guardian', freed: 'freed' }[head ?? ''];
      expect(s.type, id).toBe(type);
    }
  });

  it('covers every boss id with a guardian intro and a freeing scene, in guardian order', () => {
    expect([...GUARDIAN_ORDER].sort()).toEqual([...BOSS_IDS].sort());
    for (const b of BOSS_IDS) {
      expect(SCENES[`boss:${b}`], b).toBeDefined();
      expect(SCENES[`freed:${b}`], b).toBeDefined();
      const freed = SCENES[`freed:${b}`]?.panels[0];
      expect(freed?.stars, b).toBe(GUARDIAN_ORDER.indexOf(b) + 1);
      expect(freed?.boss, b).toBe(b);
    }
  });

  it('covers every enemy kind the intro card knows, and the three combos', () => {
    for (const k of Object.keys(FOE_INFO) as FoeKind[]) expect(SCENES[`foe:${k}`], k).toBeDefined();
    for (const [a, b] of COMBOS) expect(SCENES[comboId(a, b)]).toBeDefined();
    expect(SCENES.opening?.panels.filter((p) => p.picker === true)).toHaveLength(1);
  });

  it('only Vecta speaks once in the whole bible, in the Prism freeing', () => {
    const vecta = all.flatMap((s) => s.panels.flatMap((p) => p.lines.filter((l) => l.who === 'vecta').map(() => s.id)));
    expect(vecta).toEqual(['freed:prism']);
  });

  it('gives each scene an act of 1 to 5 from its nominal level', () => {
    for (const s of all) {
      expect(s.act).toBe(Math.min(5, Math.ceil(s.level / 10)));
    }
  });
});
