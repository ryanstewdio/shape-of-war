import { describe, expect, it } from 'vitest';
import { shouldShowMoveNotice } from '../../src/ui/moveNotice';

describe('shouldShowMoveNotice', () => {
  it('is true on github.io copies', () => {
    expect(shouldShowMoveNotice('stoopstoop.github.io')).toBe(true);
    expect(shouldShowMoveNotice('ryanstewdio.github.io')).toBe(true);
  });
  it('is false on the new home and local hosts', () => {
    expect(shouldShowMoveNotice('play.shapelegend.com')).toBe(false);
    expect(shouldShowMoveNotice('localhost')).toBe(false);
    expect(shouldShowMoveNotice('github.io.evil.com')).toBe(false);
  });
});
