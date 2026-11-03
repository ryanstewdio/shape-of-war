// R2: reaching par earns a start bonus for the next level (GameOptions.startBonus).
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { currentWeapon, WEAPON_DURATION, weaponTimeLeft } from '../../src/game/weapons';
import { DT, idle, makeGame } from './helpers';

afterEach(() => bus.clear());

describe('start bonus', () => {
  it('absent changes nothing: level lives and bombs, spread', () => {
    const { w } = makeGame();
    expect(gs(w).lives).toBe(w.level.lives);
    expect(gs(w).bombs).toBe(w.level.bombs);
    expect(currentWeapon(w)).toBe('spread');
    expect(weaponTimeLeft(w)).toBe(0);
  });

  it('life adds one life at start', () => {
    const { w } = makeGame({}, { startBonus: { kind: 'life' } });
    expect(gs(w).lives).toBe(w.level.lives + 1);
    expect(gs(w).bombs).toBe(w.level.bombs);
    expect(currentWeapon(w)).toBe('spread');
  });

  it('life stacks on the difficulty extra lives', () => {
    const base = makeGame({}, { difficulty: 'easy' }).w;
    const { w } = makeGame({}, { difficulty: 'easy', startBonus: { kind: 'life' } });
    expect(gs(w).lives).toBe(gs(base).lives + 1);
  });

  it('bomb adds one bomb at start', () => {
    const { w } = makeGame({}, { startBonus: { kind: 'bomb' } });
    expect(gs(w).bombs).toBe(w.level.bombs + 1);
    expect(gs(w).lives).toBe(w.level.lives);
  });

  it('weapon starts the level with that base weapon for its normal duration', () => {
    for (const weapon of ['rapid', 'pierce', 'orbit'] as const) {
      const { w } = makeGame({}, { startBonus: { kind: 'weapon', weapon } });
      expect(currentWeapon(w)).toBe(weapon);
      expect(weaponTimeLeft(w)).toBe(WEAPON_DURATION);
      expect(gs(w).lives).toBe(w.level.lives);
      expect(gs(w).bombs).toBe(w.level.bombs);
    }
  });

  it('the bonus weapon runs out after its duration like a pickup', () => {
    const { w } = makeGame({}, { startBonus: { kind: 'weapon', weapon: 'rapid' } });
    gs(w).invulnerable = true;
    const steps = Math.ceil(WEAPON_DURATION / DT) + 2;
    for (let i = 0; i < steps; i++) stepGame(w, DT, idle());
    expect(currentWeapon(w)).toBe('spread');
  });
});
