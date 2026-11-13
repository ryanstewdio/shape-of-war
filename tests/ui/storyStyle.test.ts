import { describe, expect, it, vi } from 'vitest';
import { MIN_HIT_PX } from '../../src/ui/dom';
import { STORY_CSS, injectStoryStyles } from '../../src/ui/story/style';

interface FakeStyle {
  tagName: string;
  id: string;
  textContent: string | null;
}

function createFakeDocument() {
  const appended: FakeStyle[] = [];
  return {
    getElementById: vi.fn((id: string) => appended.find(element => element.id === id) ?? null),
    createElement: vi.fn((tagName: string): FakeStyle => ({ tagName, id: '', textContent: null })),
    head: {
      append: vi.fn((element: FakeStyle) => { appended.push(element); }),
    },
  };
}

function ruleBody(selector: string): string {
  const opening = `${selector} {`;
  const start = STORY_CSS.indexOf(opening);
  expect(start).toBeGreaterThanOrEqual(0);
  const bodyStart = start + opening.length;
  const end = STORY_CSS.indexOf('}', bodyStart);
  expect(end).toBeGreaterThanOrEqual(bodyStart);
  return STORY_CSS.slice(bodyStart, end);
}

describe('STORY_CSS', () => {
  it('is a nonempty, fully interpolated string with balanced braces', () => {
    expect(typeof STORY_CSS).toBe('string');
    expect(STORY_CSS.trim().length).toBeGreaterThan(0);
    for (const unresolved of ['${', 'undefined', 'NaN']) {
      expect(STORY_CSS).not.toContain(unresolved);
    }
    expect(STORY_CSS.match(/\{/g)?.length ?? 0).toBe(STORY_CSS.match(/\}/g)?.length ?? 0);
  });

  it('contains the scene selectors, open states and short-screen media query', () => {
    for (const fragment of [
      '.sow-story {',
      '.sow-story.sow-open { display: flex; }',
      '.sow-story-stage {',
      '.sow-story-canvas {',
      '.sow-story-text {',
      '.sow-story-line {',
      '.sow-story-line.sow-torus {',
      '.sow-story-line.sow-vecta {',
      '.sow-story-icon {',
      '.sow-story-skip {',
      '.sow-story-hint {',
      '.sow-story-picker {',
      '.sow-story-picker.sow-open { display: flex; }',
      '.sow-story-name {',
      '.sow-story-picker .sow-btn {',
      '@media (max-height: 420px) {',
    ]) {
      expect(STORY_CSS).toContain(fragment);
    }
  });

  it('hides the scene root until opened and blocks browser gestures', () => {
    const root = ruleBody('.sow-story');
    expect(root).toContain('display: none;');
    expect(root).toContain('touch-action: none;');
  });

  it('preserves the skip and picker touch targets', () => {
    const skip = ruleBody('.sow-story-skip');
    expect(skip).toContain('min-width: 112px;');
    expect(skip).toContain(`min-height: ${Math.max(MIN_HIT_PX, 52)}px;`);
    expect(ruleBody('.sow-story-picker .sow-btn')).toContain(`min-height: ${MIN_HIT_PX}px;`);
  });

  it('accounts for all four safe-area insets', () => {
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(STORY_CSS).toContain(`env(safe-area-inset-${side}, 0px)`);
    }
  });
});

describe('injectStoryStyles', () => {
  it('creates and appends exactly one style element with the stylesheet', () => {
    const fake = createFakeDocument();
    expect(fake.getElementById('sow-story-style')).toBeNull();

    injectStoryStyles(fake as unknown as Document);

    expect(fake.createElement).toHaveBeenCalledExactlyOnceWith('style');
    const element = fake.createElement.mock.results[0]!.value;
    expect(element.id).toBe('sow-story-style');
    expect(element.textContent).toBe(STORY_CSS);
    expect(fake.head.append).toHaveBeenCalledExactlyOnceWith(element);
    expect(fake.getElementById('sow-story-style')).toBe(element);
  });

  it('does not create or append another element on a second injection', () => {
    const fake = createFakeDocument();
    injectStoryStyles(fake as unknown as Document);
    const element = fake.createElement.mock.results[0]!.value;
    expect(fake.getElementById('sow-story-style')).toBe(element);
    fake.createElement.mockClear();
    fake.head.append.mockClear();
    fake.getElementById.mockClear();

    injectStoryStyles(fake as unknown as Document);

    expect(fake.getElementById).toHaveBeenCalledExactlyOnceWith('sow-story-style');
    expect(fake.createElement).not.toHaveBeenCalled();
    expect(fake.head.append).not.toHaveBeenCalled();
  });

  it('does nothing when the document has no getElementById function', () => {
    const { createElement, head } = createFakeDocument();
    const fake = { createElement, head };

    expect(() => injectStoryStyles(fake as unknown as Document)).not.toThrow();

    expect(createElement).not.toHaveBeenCalled();
    expect(head.append).not.toHaveBeenCalled();
  });
});
