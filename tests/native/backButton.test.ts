import { describe, expect, it } from 'vitest';
import {
  createDoubleBack,
  initialDoubleBack,
  installBackButton,
  pressBackOnMenu,
} from '../../src/native/backButton';

describe('pressBackOnMenu', () => {
  it('first back confirms and arms the window', () => {
    const r = pressBackOnMenu(initialDoubleBack, 1000);
    expect(r.outcome).toBe('confirm');
    expect(r.state.armedAt).toBe(1000);
  });
  it('second back within 2 s exits', () => {
    const a = pressBackOnMenu(initialDoubleBack, 1000);
    expect(pressBackOnMenu(a.state, 3000).outcome).toBe('exit');
  });
  it('second back after the window confirms again', () => {
    const a = pressBackOnMenu(initialDoubleBack, 1000);
    const b = pressBackOnMenu(a.state, 3001);
    expect(b.outcome).toBe('confirm');
    expect(b.state.armedAt).toBe(3001);
  });
});

describe('createDoubleBack', () => {
  it('uses the injected clock and resets after exit', () => {
    let t = 0;
    const back = createDoubleBack(() => t);
    expect(back()).toBe('confirm');
    t = 1500;
    expect(back()).toBe('exit');
    t = 1600;
    expect(back()).toBe('confirm');
  });
});

describe('installBackButton', () => {
  it('is a no-op on the web and returns a callable uninstall', () => {
    const off = installBackButton(() => 'handled');
    expect(() => off()).not.toThrow();
  });
});
