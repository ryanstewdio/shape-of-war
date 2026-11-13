import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  setDebugInfoSource,
  getDebugInfo,
  registerParticleStress,
  runParticleStress,
  type DebugInfo,
  type ParticleStressHook,
} from '../../src/core/debug';

const debugInfo: DebugInfo = {
  frame: {
    lastFrameMs: 16,
    avgFrameMs: 17,
    avgWorkMs: 3,
    steps: 2,
    samples: 60,
  },
  liveEntities: 10,
  liveBullets: 5,
  divisor: 1,
  bloom: true,
};

afterEach(() => {
  setDebugInfoSource(null);
  registerParticleStress(null);
});

describe('debug info registry', () => {
  it('returns null when no source is set', () => {
    expect(getDebugInfo()).toBeNull();
  });

  it('returns the source object and calls the source once per read', () => {
    const source = vi.fn(() => debugInfo);
    setDebugInfoSource(source);

    expect(source).not.toHaveBeenCalled();
    expect(getDebugInfo()).toBe(debugInfo);
    expect(source).toHaveBeenCalledTimes(1);
    expect(getDebugInfo()).toBe(debugInfo);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('replaces the previous source', () => {
    const replacementInfo: DebugInfo = {
      frame: {
        lastFrameMs: 32,
        avgFrameMs: 33,
        avgWorkMs: 6,
        steps: 4,
        samples: 120,
      },
      liveEntities: 20,
      liveBullets: 15,
      divisor: 2,
      bloom: false,
    };
    const source = vi.fn(() => debugInfo);
    const replacement = vi.fn(() => replacementInfo);
    setDebugInfoSource(source);
    expect(getDebugInfo()).toBe(debugInfo);

    setDebugInfoSource(replacement);
    expect(getDebugInfo()).toBe(replacementInfo);
    expect(source).toHaveBeenCalledTimes(1);
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  it('clears the source without calling it again', () => {
    const source = vi.fn(() => debugInfo);
    setDebugInfoSource(source);
    expect(getDebugInfo()).toBe(debugInfo);

    setDebugInfoSource(null);
    expect(getDebugInfo()).toBeNull();
    expect(source).toHaveBeenCalledTimes(1);
  });
});

describe('particle stress registry', () => {
  it('returns false without throwing when no hook is registered', () => {
    expect(runParticleStress(5)).toBe(false);
  });

  it('calls the hook once per run with the supplied count, including zero', () => {
    const hook = vi.fn<ParticleStressHook>();
    registerParticleStress(hook);

    expect(hook).not.toHaveBeenCalled();
    expect(runParticleStress(250)).toBe(true);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenNthCalledWith(1, 250);
    expect(runParticleStress(0)).toBe(true);
    expect(hook).toHaveBeenCalledTimes(2);
    expect(hook).toHaveBeenNthCalledWith(2, 0);
  });

  it('replaces the previous hook', () => {
    const hook = vi.fn<ParticleStressHook>();
    const replacement = vi.fn<ParticleStressHook>();
    registerParticleStress(hook);
    expect(runParticleStress(5)).toBe(true);
    expect(hook).toHaveBeenCalledWith(5);

    registerParticleStress(replacement);
    expect(runParticleStress(250)).toBe(true);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(replacement).toHaveBeenCalledWith(250);
  });

  it('clears the hook without calling it again', () => {
    const hook = vi.fn<ParticleStressHook>();
    registerParticleStress(hook);
    expect(runParticleStress(250)).toBe(true);

    registerParticleStress(null);
    expect(runParticleStress(1)).toBe(false);
    expect(hook).toHaveBeenCalledTimes(1);
  });
});

describe('registry independence', () => {
  it('does not register a stress hook when only a debug source is set', () => {
    const source = vi.fn(() => debugInfo);
    setDebugInfoSource(source);

    expect(runParticleStress(1)).toBe(false);
    expect(source).not.toHaveBeenCalled();
    expect(getDebugInfo()).toBe(debugInfo);
  });

  it('does not set a debug source when only a stress hook is registered', () => {
    const hook = vi.fn<ParticleStressHook>();
    registerParticleStress(hook);

    expect(getDebugInfo()).toBeNull();
    expect(hook).not.toHaveBeenCalled();
    expect(runParticleStress(1)).toBe(true);
    expect(hook).toHaveBeenCalledExactlyOnceWith(1);
  });
});
