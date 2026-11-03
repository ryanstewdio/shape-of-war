// R1: the iridescent 4th star (CSS only) and the intro card Difficulty selector.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAST_DIFFICULTY_KEY, type StorageLike } from '../../src/core/settings';
import { neonParams } from '../../src/render/neon';
import {
  FOURTH_STAR_CLASS,
  FOURTH_STAR_SPIN_SEC,
  fourthStarCss,
  fourthStarEl,
  hasFourthStar,
  iridescentColours,
  IRIDESCENT_KEYS,
} from '../../src/ui/fourthStar';
import {
  armIntro,
  createIntroScreen,
  introActive,
  introCard,
  startIntro,
  tickIntro,
} from '../../src/ui/intro';
import { createLevelSelect } from '../../src/ui/levelSelect';
import { createResultsScreen } from '../../src/ui/results';
import { createSettingsModel, DIFFICULTY_ROW_LABEL, type SettingsEffects } from '../../src/ui/settings';
import { asParent, groupButtons, installFakeDocument, type FakeEl } from './fakeDom';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function fx(): SettingsEffects {
  const no = (): void => undefined;
  return {
    setShowFps: no,
    setGlowPath: no,
    applyNeon: no,
    setVolume: no,
    setWeaponPickups: no,
    setEffectsTier: no,
    setTilt: no,
    setMusicVolume: no,
    requestFrame: (cb) => cb(),
  };
}

const def = { objective: { kind: 'destroy', count: 40 }, par: 1500, drone: 'collect', superType: 'detonate' } as const;
const card = (d: Parameters<typeof introCard>[2]) => introCard(3, { ...def, stars: [1500, 3000, 6000] }, d);

describe('4th star styling', () => {
  it('spins once per 6 s, cycles neon hues, shimmers and honours reduced motion', () => {
    const css = fourthStarCss(1, 0.5);
    expect(FOURTH_STAR_SPIN_SEC).toBe(6);
    expect(css).toContain(`.${FOURTH_STAR_CLASS}`);
    expect(css).toContain('sow-star4-spin 6s linear infinite');
    expect(css).toContain('rotate(360deg)');
    expect(css).toContain('sow-star4-shimmer');
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.sow-star4 \{ animation: none; \} \}/);
    for (const c of iridescentColours(1)) expect(css).toContain(c);
  });

  it('colours come from the neon palette and follow the applyNeon saturation', () => {
    expect(IRIDESCENT_KEYS.length).toBeGreaterThanOrEqual(6);
    const dim = iridescentColours(neonParams(0).saturation);
    const hot = iridescentColours(neonParams(100).saturation);
    expect(dim).toHaveLength(IRIDESCENT_KEYS.length);
    expect(dim).not.toEqual(hot);
    expect(fourthStarCss(neonParams(0).saturation, neonParams(0).glowAlpha)).not.toBe(fourthStarCss(1.3, 0.9));
  });

  it('only 4 stars show it', () => {
    expect([0, 1, 2, 3, 4].map((s) => hasFourthStar(s as 0 | 1 | 2 | 3 | 4))).toEqual([false, false, false, false, true]);
  });
});

describe('4th star elements', () => {
  afterEach(() => vi.unstubAllGlobals());
  const star4 = (root: FakeEl): FakeEl[] => root.all().filter((e) => e.classList.contains(FOURTH_STAR_CLASS));

  it('is a glyph span, no image', () => {
    installFakeDocument();
    const s = fourthStarEl() as unknown as FakeEl;
    expect(s.tag).toBe('span');
    expect(s.textContent).toBe('★');
  });

  it('results show it only for an Insane win', () => {
    const root = installFakeDocument();
    const r = createResultsScreen(asParent(root), { next: () => undefined, retry: () => undefined, menu: () => undefined });
    const base = { mode: 'adventure', levelIndex: 1, score: 10, success: true, par: 1000, best: 10, newBest: false, hash: 'H' } as const;
    r.showResult({ ...base, stars: 4, difficulty: 'insane' });
    expect(star4(root)[0]?.style.display).toBe('');
    r.showResult({ ...base, stars: 3, difficulty: 'hard' });
    expect(star4(root)[0]?.style.display).toBe('none');
  });

  it('level select adds it to a level whose best is 4 stars', () => {
    const root = installFakeDocument();
    const ls = createLevelSelect(asParent(root), { play: () => undefined, back: () => undefined });
    ls.open(3, { '1': { best: 5, stars: 4, difficulty: 'insane' }, '2': { best: 5, stars: 3, difficulty: 'hard' } });
    expect(star4(root)).toHaveLength(1);
  });
});

describe('intro card Difficulty selector', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('R2: the card waits with no timer until Start', () => {
    let g = armIntro('adventure');
    for (let i = 0; i < 6000; i++) g = tickIntro(g, 1 / 60);
    expect(introActive(g)).toBe(true);
    expect(startIntro(g, 'adventure')).toEqual({ kind: 'none', left: 0 });
  });

  it('shows four buttons marked with the card difficulty', () => {
    const root = installFakeDocument();
    const screen = createIntroScreen(asParent(root), () => undefined);
    screen.showCard(card('hard'));
    const b = groupButtons(root, DIFFICULTY_ROW_LABEL);
    expect(b.map((x) => x.textContent)).toEqual(['Easy', 'Normal', 'Hard', 'Insane']);
    expect(b.map((x) => x.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false']);
    expect(card('insane').choice).toBe('insane');
  });

  it('a chip tap saves the last choice, applies to the card and never starts it', () => {
    const root = installFakeDocument();
    const st = memory();
    const model = createSettingsModel(fx(), st);
    let starts = 0;
    let applied = model.state.difficulty;
    const screen = createIntroScreen(
      asParent(root),
      () => void starts++,
      (d) => {
        model.setDifficulty(d);
        applied = d; // main.ts rebuilds the level at d here
      },
    );
    screen.showCard(card(model.state.difficulty));
    groupButtons(root, DIFFICULTY_ROW_LABEL)[3]?.tap();
    expect(starts).toBe(0);
    expect(st.data.get(LAST_DIFFICULTY_KEY)).toBe('insane');
    expect(model.state.difficulty).toBe('insane');
    expect(applied).toBe('insane');
    expect(groupButtons(root, DIFFICULTY_ROW_LABEL).map((x) => x.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true']);
    root.all().find((e) => e.getAttribute('data-intro') === 'start')?.tap();
    expect(starts).toBe(1);
  });

  it('the Ready text hides the selector', () => {
    const root = installFakeDocument();
    const screen = createIntroScreen(asParent(root), () => undefined);
    screen.showReady();
    const row = root.all().find((e) => e.getAttribute('data-intro') === 'difficulty');
    expect(row?.style.display).toBe('none');
  });
});
