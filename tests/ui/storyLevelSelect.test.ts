// Level select "Replay story" entry: a level with seen scenes replays them; others do nothing in
// story mode; outside story mode every level plays.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLevelSelect, levelTapAction, REPLAY_STORY_LABEL, REPLAY_DONE_LABEL } from '../../src/ui/levelSelect';
import { asParent, buttonsLabelled, installFakeDocument } from './fakeDom';

describe('level select replay story', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('levelTapAction', () => {
    const story = new Set([1, 5]);
    expect(levelTapAction(3, false, story)).toBe('play');
    expect(levelTapAction(5, true, story)).toBe('replay');
    expect(levelTapAction(3, true, story)).toBe('none');
  });

  it('the toggle shows only when a level has scenes, and routes taps to replay', () => {
    const root = installFakeDocument();
    const play = vi.fn();
    const replay = vi.fn();
    const ls = createLevelSelect(asParent(root), { play, back: () => undefined, replay });
    ls.open(3, {}, new Set());
    const toggle = buttonsLabelled(root, REPLAY_STORY_LABEL)[0];
    expect(toggle?.style.display).toBe('none');
    ls.open(3, {}, new Set([1]));
    expect(toggle?.style.display).toBe('');
    toggle?.tap();
    expect(toggle?.textContent).toBe(REPLAY_DONE_LABEL);
    const levelButtons = root.all().filter((e) => e.tag === 'button' && (e.getAttribute('aria-label') ?? '').startsWith('Level '));
    levelButtons[0]?.tap();
    levelButtons[1]?.tap();
    expect(replay).toHaveBeenCalledWith(1);
    expect(replay).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();
  });
});
