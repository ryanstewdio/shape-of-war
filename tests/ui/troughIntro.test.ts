// Trough option: the intro card names the arena Trough and keeps the hint in Details only.
import { describe, expect, it } from 'vitest';
import { DEV_KNOBS, gateSearch } from '../../src/ui/devGate';
import { arenaName, endlessIntroCard, introCard, introDetails, TROUGH_HINT } from '../../src/ui/intro';

const arena = { shape: 'rect' as const, width: 1800, height: 800, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };

describe('trough intro', () => {
  it('names the arena Trough', () => {
    expect(arenaName({ arena, surface: 'trough' })).toBe('Trough');
    expect(arenaName({ arena, surface: 'flat' })).toBe('Rectangle');
    expect(endlessIntroCard({ arena, surface: 'trough' }).arena).toBe('Trough 1800 x 800');
  });

  it('puts the hint in Details, not on the face of the card', () => {
    const card = endlessIntroCard({ arena, surface: 'trough' });
    expect(introDetails(card).some((d) => d.value === TROUGH_HINT)).toBe(true);
    expect(card.goal).not.toContain('slopes');
    expect(card.mission).toBeNull();
    const flat = endlessIntroCard({ arena, surface: 'flat' });
    expect(introDetails(flat).some((d) => d.value === TROUGH_HINT)).toBe(false);
  });

  it('uses the plain hint text', () => {
    expect(TROUGH_HINT).toBe('The ground slopes. Your ship slides toward the valley.');
    expect(introCard(24, { objective: { kind: 'survive', seconds: 60 }, stars: [1, 2, 3], drone: 'attack', superType: 'turbo', arena, surface: 'trough' } as never).arena).toContain('Trough');
  });

  it('gates the trough dev knob', () => {
    expect(DEV_KNOBS).toContain('trough');
    expect(gateSearch('?trough=1')).toBe('');
    expect(gateSearch('?dev=1&trough=1')).toBe('?dev=1&trough=1');
  });
});
