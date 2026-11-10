// Ledger polish-d: How to wording, developer items behind ?dev=1, release footer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { howToPages } from '../../src/ui/howTo';
import { createHud, levelLine } from '../../src/ui/hud';
import { footerLine, FOOTER_VERSION } from '../../src/ui/menu';
import { createSettingsModel, createSettingsScreen, STRESS_LABEL, type SettingsEffects } from '../../src/ui/settings';
import { asParent, buttonsLabelled, installFakeDocument, type FakeEl } from './fakeDom';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

function pageText(id: string): string {
  const p = howToPages().find((x) => x.id === id);
  if (p === undefined) throw new Error(`no page ${id}`);
  return p.sections.flatMap((s) => [s.heading, ...s.lines]).join('\n');
}

describe('How to wording', () => {
  it('star lines read 1, 1.25 and 1.5 times par', () => {
    const t = pageText('stars');
    expect(t).toContain('Reach par for 1 star.');
    expect(t).toContain('1.25 times par for 2.');
    expect(t).toContain('1.5 times par for 3.');
    expect(t).not.toContain('Double par');
    expect(t).not.toContain('Four times par');
  });

  it('difficulty points to the level start card, not Settings', () => {
    const t = pageText('modes');
    expect(t).not.toContain('Change it in Settings');
    expect(t).toContain('level start card before each level');
  });
});

describe('menu footer', () => {
  it('reads Shape Legend v<version> (build <sha>) with no seed', () => {
    expect(FOOTER_VERSION).toBe(JSON.parse(read('package.json')).version);
    expect(footerLine('abc1234 2026-11-10T10:00Z')).toBe('Shape Legend v0.9.0 (build abc1234)');
    expect(footerLine(undefined)).toBe('Shape Legend v0.9.0 (build dev)');
    expect(footerLine('abc1234 x')).not.toContain('seed');
  });
});

describe('HUD level code is a ?dev=1 item', () => {
  it('levelLine hides the code unless asked', () => {
    expect(levelLine(3, 1500, 'abcd1234')).toBe('L3  Par 1,500');
    expect(levelLine(3, 1500, 'abcd1234', true)).toBe('L3  Par 1,500  #abcd1234');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the HUD shows the code only after setDevCode(true)', () => {
    const root = installFakeDocument();
    const hud = createHud(asParent(root), () => 0);
    hud.setLevel(5, 1500, 'abcd1234');
    expect(root.all().some((n) => n.textContent === 'L5  Par 1,500')).toBe(true);
    expect(root.all().some((n) => n.textContent.includes('#abcd1234'))).toBe(false);
    hud.setDevCode(true);
    hud.setLevel(5, 1500, 'abcd1234');
    expect(root.all().some((n) => n.textContent === 'L5  Par 1,500  #abcd1234')).toBe(true);
  });
});

function fx(): SettingsEffects {
  return {
    setShowFps: () => undefined,
    setGlowPath: () => undefined,
    applyNeon: () => undefined,
    setVolume: () => undefined,
    setWeaponPickups: () => undefined,
    setEffectsTier: () => undefined,
    setTilt: () => undefined,
    setMusicVolume: () => undefined,
    requestFrame: () => undefined,
  };
}

function stressRowHidden(dev: boolean | undefined): boolean {
  const root = installFakeDocument();
  const store = new Map<string, string>();
  const model = createSettingsModel(fx(), { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) });
  createSettingsScreen(asParent(root), model, {
    back: () => undefined,
    playSeed: () => undefined,
    seedHash: () => null,
    resetProgress: () => undefined,
    stress: () => undefined,
    currentNeon: () => 70,
    buildId: 'test',
    dev,
  }).show();
  const label = root.all().find((e) => e.textContent === 'build test');
  if (label === undefined) throw new Error('no build label');
  for (let i = 0; i < 5; i++) label.fire('pointerup');
  const btn = buttonsLabelled(root, STRESS_LABEL)[0];
  const row = root.all().find((e: FakeEl) => e.children.includes(btn as FakeEl));
  return row?.style.display === 'none';
}

describe('Settings build label taps are a ?dev=1 item', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('5 taps do nothing without dev', () => {
    expect(stressRowHidden(undefined)).toBe(true);
    expect(stressRowHidden(false)).toBe(true);
  });

  it('5 taps reveal the stress row with dev', () => {
    expect(stressRowHidden(true)).toBe(false);
  });
});

describe('main.ts dev gates', () => {
  const main = read('src/main.ts');
  it('the debug panel install sits behind gated.dev', () => {
    expect(main).toMatch(/if \(gated\.dev\) \{\s+const panel = installDevPanel\(/);
  });
  it('the settings screen and HUD receive the dev flag', () => {
    expect(main).toContain('dev: gated.dev,');
    expect(main).toContain('hud.setDevCode(gated.dev)');
  });
});
