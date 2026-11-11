import { describe, expect, it } from 'vitest';
import { FIGHT_TIMER_START, fightClock, fightLine, fightStep, type FightEvent } from '../../src/ui/fightTimer';

const run = (events: FightEvent[]) => events.reduce((s, e) => fightStep(s, e), { ...FIGHT_TIMER_START });

describe('fight timer', () => {
  it('formats m:ss and clamps bad input', () => {
    expect(fightClock(0)).toBe('0:00');
    expect(fightClock(65.9)).toBe('1:05');
    expect(fightClock(-3)).toBe('0:00');
    expect(fightClock(Number.NaN)).toBe('0:00');
  });
  it('Brood splits into body and Broodlings', () => {
    const s = run([{ type: 'enter', id: 'brood', t: 100 }, { type: 'split', t: 158 }]);
    expect(fightLine(s, 212)).toBe('Brood 1:52 (body 0:58, Broodlings 0:54)');
  });
  it('Warden splits at break and enraged', () => {
    const s = run([
      { type: 'enter', id: 'warden', t: 10 },
      { type: 'fury', stage: 'break', t: 41 },
      { type: 'fury', stage: 'on', t: 46 },
    ]);
    expect(fightLine(s, 75)).toBe('Warden 1:05 (to break 0:31, break 0:05, enraged 0:29)');
  });
  it('a fight with no split or fury is just the total', () => {
    expect(fightLine(run([{ type: 'enter', id: 'spindle', t: 5 }]), 65)).toBe('Spindle 1:00');
  });
  it('is on the sim clock: the times are sim seconds, so a pause adds nothing', () => {
    // main.ts feeds world.time, which does not advance while paused; a long wall pause changes no input.
    const s = run([{ type: 'enter', id: 'brood', t: 20 }]);
    expect(fightLine(s, 50)).toBe('Brood 0:30');
  });
  it('ignores a split before any entrance and starts fresh on a new entrance', () => {
    expect(fightLine(run([{ type: 'split', t: 3 }]), 9)).toBe('');
    const s = run([{ type: 'enter', id: 'brood', t: 0 }, { type: 'split', t: 10 }, { type: 'enter', id: 'warden', t: 50 }]);
    expect(fightLine(s, 60)).toBe('Warden 0:10');
  });
});
