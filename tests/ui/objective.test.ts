import { describe, expect, it } from 'vitest';
import type { ObjectiveDef } from '../../src/levelgen/leveldef';
import { formatClock, formatCompact, formatInt, iconRun, starGlyphs } from '../../src/ui/format';
import {
  bossHolds,
  fallbackStatus,
  goalMet,
  HOLD_LABEL,
  levelSuccess,
  objectiveProgress,
  objectiveStatus,
  objectiveText,
  starLine,
  type ObjectiveSnapshot,
} from '../../src/ui/objective';

const snap = (p: Partial<ObjectiveSnapshot>): ObjectiveSnapshot => ({ elapsedSec: 0, score: 0, kills: 0, lives: 3, ...p });

describe('objectives', () => {
  const sit: ObjectiveDef = { kind: 'scoreInTime', target: 5000, timeLimitSec: 90 };
  const surv: ObjectiveDef = { kind: 'survive', durationSec: 60 };
  const destroy: ObjectiveDef = { kind: 'destroy', count: 40 };

  it('scoreInTime runs the full timer; target decides at the end (docs/01 section 8)', () => {
    expect(objectiveStatus(sit, snap({ score: 4999, elapsedSec: 10 }))).toBe('running');
    expect(objectiveStatus(sit, snap({ score: 5000, elapsedSec: 10 }))).toBe('running');
    expect(objectiveStatus(sit, snap({ score: 5000, elapsedSec: 90 }))).toBe('success');
    expect(objectiveStatus(sit, snap({ score: 10, elapsedSec: 90 }))).toBe('failure');
    expect(objectiveStatus(sit, snap({ score: 10, lives: 0 }))).toBe('failure');
  });

  it('survive succeeds when the timer runs out with lives left', () => {
    expect(objectiveStatus(surv, snap({ elapsedSec: 59.9 }))).toBe('running');
    expect(objectiveStatus(surv, snap({ elapsedSec: 60 }))).toBe('success');
    expect(objectiveStatus(surv, snap({ elapsedSec: 60, lives: 0 }))).toBe('failure');
  });

  it('destroy succeeds at N kills, unknown lives never fail', () => {
    expect(objectiveStatus(destroy, snap({ kills: 39, lives: null }))).toBe('running');
    expect(objectiveStatus(destroy, snap({ kills: 40 }))).toBe('success');
    expect(objectiveStatus(destroy, snap({ kills: 3, lives: 0 }))).toBe('failure');
  });

  it('goalMet ignores lives (used to infer success on game:over)', () => {
    expect(goalMet(destroy, snap({ kills: 40, lives: 0 }))).toBe(true);
    expect(goalMet(surv, snap({ elapsedSec: 12 }))).toBe(false);
  });

  it('progress labels and fractions', () => {
    expect(objectiveProgress(sit, snap({ score: 2500, elapsedSec: 30 }))).toEqual({ label: 'Score 2,500 / 5,000', fraction: 0.5, stars: null, starMarks: [] });
    expect(objectiveProgress(surv, snap({ elapsedSec: 15 }))).toEqual({ label: 'Survive', fraction: 0.25, stars: null, starMarks: [] });
    expect(objectiveProgress(destroy, snap({ kills: 50 }))).toEqual({ label: 'Destroy 40 / 40', fraction: 1, stars: null, starMarks: [] });
    expect(objectiveText(destroy)).toBe('Destroy 40 enemies');
  });
});

// V3-A boss hold (docs/13 boss rule 9 and section 8). The success test passing while a boss lives
// holds the level; the label then reads "Defeat the boss".
describe('boss hold label', () => {
  const sit: ObjectiveDef = { kind: 'scoreInTime', target: 5000, timeLimitSec: 90 };
  const surv: ObjectiveDef = { kind: 'survive', durationSec: 60 };
  const destroy: ObjectiveDef = { kind: 'destroy', count: 40 };
  // Each objective with a snapshot where its success test passes, and one where it has not yet.
  const cases: Array<[string, ObjectiveDef, ObjectiveSnapshot, ObjectiveSnapshot]> = [
    ['scoreInTime', sit, snap({ score: 6000, elapsedSec: 90 }), snap({ score: 6000, elapsedSec: 40 })],
    ['survive', surv, snap({ elapsedSec: 60 }), snap({ elapsedSec: 59 })],
    ['destroy', destroy, snap({ kills: 40 }), snap({ kills: 39 })],
  ];

  it('the label text is "Defeat the boss"', () => {
    expect(HOLD_LABEL).toBe('Defeat the boss');
  });

  for (const [name, obj, passed, running] of cases) {
    it(`${name}: reads "Defeat the boss" with a full bar once the test passes while the boss lives`, () => {
      expect(objectiveProgress(obj, passed, true)).toEqual({ label: 'Defeat the boss', fraction: 1, stars: null, starMarks: [] });
      expect(bossHolds(obj, passed, true)).toBe(true);
    });

    it(`${name}: the normal label before the test passes, boss alive or not`, () => {
      expect(objectiveProgress(obj, running, true)).toEqual(objectiveProgress(obj, running));
      expect(objectiveProgress(obj, running, true).label).not.toBe(HOLD_LABEL);
      expect(bossHolds(obj, running, true)).toBe(false);
    });

    it(`${name}: no boss alive means no hold, so the label is the v2 label`, () => {
      expect(objectiveProgress(obj, passed, false)).toEqual(objectiveProgress(obj, passed));
      expect(objectiveProgress(obj, passed).label).not.toBe(HOLD_LABEL);
      expect(bossHolds(obj, passed, false)).toBe(false);
    });
  }

  it('no hold once the lives are gone: that is a loss, not a wait', () => {
    expect(bossHolds(surv, snap({ elapsedSec: 60, lives: 0 }), true)).toBe(false);
    expect(bossHolds(sit, snap({ score: 6000, elapsedSec: 90, lives: 0 }), true)).toBe(false);
  });

  it('the label of a survive or scoreInTime level carries no clock, even past the time limit (hud-clock)', () => {
    expect(objectiveProgress(surv, snap({ elapsedSec: 75 })).label).toBe('Survive');
    expect(objectiveProgress(sit, snap({ score: 6000, elapsedSec: 120 })).label).toBe('Score 6,000 / 5,000');
  });

  it('boss absent is the default, so every existing call is unchanged', () => {
    expect(objectiveProgress(surv, snap({ elapsedSec: 15 }))).toEqual({ label: 'Survive', fraction: 0.25, stars: null, starMarks: [] });
    expect(objectiveProgress(destroy, snap({ kills: 50 }))).toEqual({ label: 'Destroy 40 / 40', fraction: 1, stars: null, starMarks: [] });
  });
});

describe('boss level end check and verdict', () => {
  const surv: ObjectiveDef = { kind: 'survive', durationSec: 60 };
  const sit: ObjectiveDef = { kind: 'scoreInTime', target: 5000, timeLimitSec: 90 };
  const destroy: ObjectiveDef = { kind: 'destroy', count: 40 };

  it('fallbackStatus on a boss level reads a success as running: only the sim ends it, after the boss', () => {
    expect(fallbackStatus(surv, snap({ elapsedSec: 60 }), true)).toBe('running');
    expect(fallbackStatus(sit, snap({ score: 6000, elapsedSec: 90 }), true)).toBe('running');
    expect(fallbackStatus(destroy, snap({ kills: 40 }), true)).toBe('running');
  });

  it('fallbackStatus on a boss level ends only when every life is lost (a missed score target is score only)', () => {
    expect(fallbackStatus(surv, snap({ elapsedSec: 10, lives: 0 }), true)).toBe('failure');
    expect(fallbackStatus(sit, snap({ score: 10, elapsedSec: 90 }), true)).toBe('running');
    expect(fallbackStatus(destroy, snap({ kills: 3, lives: 0 }), true)).toBe('failure');
  });

  it('fallbackStatus on every other level is objectiveStatus, unchanged', () => {
    for (const [obj, s] of [
      [surv, snap({ elapsedSec: 60 })],
      [surv, snap({ elapsedSec: 5 })],
      [sit, snap({ score: 6000, elapsedSec: 90 })],
      [destroy, snap({ kills: 40 })],
      [destroy, snap({ kills: 3, lives: 0 })],
    ] as const) {
      expect(fallbackStatus(obj, s, false)).toBe(objectiveStatus(obj, s));
    }
  });

  it('levelSuccess on a boss level is the sim verdict: a win, and never a loss that met its target in the hold', () => {
    expect(levelSuccess(surv, snap({ elapsedSec: 60 }), 'won', true)).toBe(true);
    // Target met, then every life lost while holding for the boss: goalMet would say success.
    expect(goalMet(surv, snap({ elapsedSec: 70, lives: 0 }))).toBe(true);
    expect(levelSuccess(surv, snap({ elapsedSec: 70, lives: 0 }), 'lost', true)).toBe(false);
    expect(levelSuccess(destroy, snap({ kills: 40, lives: 0 }), 'lost', true)).toBe(false);
    expect(levelSuccess(sit, snap({ score: 6000, elapsedSec: 90, lives: 0 }), 'lost', true)).toBe(false);
  });

  it('levelSuccess on a boss level with no verdict yet is not a win', () => {
    expect(levelSuccess(surv, snap({ elapsedSec: 60 }), 'running', true)).toBe(false);
  });

  it('R2 P0: levelSuccess on every other level is the sim verdict when it has one', () => {
    expect(levelSuccess(destroy, snap({ kills: 40, lives: 0 }), 'won', false)).toBe(true);
    expect(levelSuccess(destroy, snap({ kills: 40, lives: 0 }), 'lost', false)).toBe(false);
    expect(levelSuccess(surv, snap({ elapsedSec: 12 }), 'won', false)).toBe(true);
    // The device bug: score target met early, then every life lost. goalMet says yes; the verdict is a loss.
    expect(goalMet(sit, snap({ score: 6000, elapsedSec: 40, lives: 0 }))).toBe(true);
    expect(levelSuccess(sit, snap({ score: 6000, elapsedSec: 40, lives: 0 }), 'lost', false)).toBe(false);
  });

  it('R2 P0: with no verdict yet (fallback check), the snapshot decides and lives out is never a win', () => {
    expect(levelSuccess(sit, snap({ score: 6000, elapsedSec: 40, lives: 0 }), 'running', false)).toBe(false);
    expect(levelSuccess(surv, snap({ elapsedSec: 70, lives: 0 }), 'running', false)).toBe(false);
    expect(levelSuccess(sit, snap({ score: 6000, elapsedSec: 90, lives: 1 }), 'running', false)).toBe(true);
    expect(levelSuccess(destroy, snap({ kills: 40, lives: 1 }), 'running', false)).toBe(true);
    expect(levelSuccess(surv, snap({ elapsedSec: 12 }), 'running', false)).toBe(false);
  });
});

describe('format', () => {
  it('formatInt', () => {
    expect(formatInt(0)).toBe('0');
    expect(formatInt(999)).toBe('999');
    expect(formatInt(1234567)).toBe('1,234,567');
    expect(formatInt(-5)).toBe('0');
  });
  it('formatClock rounds up', () => {
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(-3)).toBe('0:00');
  });
  it('iconRun caps at 5 icons', () => {
    expect(iconRun('o', 3)).toBe('ooo');
    expect(iconRun('o', 7)).toBe('o x 7');
    expect(iconRun('o', 0)).toBe('');
  });
  it('starGlyphs', () => {
    expect(starGlyphs(2)).toBe('★★☆');
  });
});

// R2 item 3: the bar shows progress toward the objective the player must complete, with a clear
// label, and a separate thin star line. A score or destroy objective never fills on the timer.
describe('R2 objective bar', () => {
  const sit: ObjectiveDef = { kind: 'scoreInTime', target: 3_300_000, timeLimitSec: 180 };
  const surv: ObjectiveDef = { kind: 'survive', durationSec: 300 };
  const destroy: ObjectiveDef = { kind: 'destroy', count: 530 };
  const stars = [1000, 2000, 4000] as const;

  it('survive: "Survive" (the clock shows the time), fills with time survived', () => {
    const p = objectiveProgress(surv, snap({ elapsedSec: 48 }), false, stars);
    expect(p.label).toBe('Survive');
    expect(p.fraction).toBeCloseTo(48 / 300);
  });

  it('destroy: "Destroy 312 / 530", fills with kills only, never with time', () => {
    const a = objectiveProgress(destroy, snap({ kills: 312, elapsedSec: 10 }), false, stars);
    const b = objectiveProgress(destroy, snap({ kills: 312, elapsedSec: 500 }), false, stars);
    expect(a.label).toBe('Destroy 312 / 530');
    expect(a.fraction).toBeCloseTo(312 / 530);
    expect(b.fraction).toBe(a.fraction);
    expect(objectiveProgress(destroy, snap({ kills: 1312 })).label).toBe('Destroy 530 / 530');
  });

  it('score: "Score 1.2M / 3.3M" with no time (the clock shows it), fills with the score only, never with time', () => {
    const a = objectiveProgress(sit, snap({ score: 1_234_567, elapsedSec: 19 }), false, stars);
    expect(a.label).toBe('Score 1.2M / 3.3M');
    expect(a.fraction).toBeCloseTo(1_234_567 / 3_300_000);
    // The old bar switched to a timer once the target was met; the new one stays on the score.
    const met = objectiveProgress(sit, snap({ score: 4_000_000, elapsedSec: 20 }));
    expect(met.fraction).toBe(1);
    const later = objectiveProgress(sit, snap({ score: 1_234_567, elapsedSec: 170 }));
    expect(later.fraction).toBe(a.fraction);
  });

  it('the star line is score toward the third threshold, with marks at the first and second', () => {
    expect(objectiveProgress(surv, snap({ score: 1000 }), false, stars)).toMatchObject({ stars: 0.25, starMarks: [0.25, 0.5] });
    expect(objectiveProgress(destroy, snap({ score: 9000 }), false, stars).stars).toBe(1);
    expect(starLine(500, undefined)).toEqual({ stars: null, starMarks: [] });
  });

  it('formatCompact', () => {
    expect(formatCompact(9999)).toBe('9,999');
    expect(formatCompact(12_345)).toBe('12.3K');
    expect(formatCompact(1_200_000)).toBe('1.2M');
    expect(formatCompact(3_000_000)).toBe('3M');
    expect(formatCompact(3_299_999)).toBe('3.2M');
    expect(formatCompact(2_500_000_000)).toBe('2.5B');
    expect(formatCompact(-5)).toBe('0');
  });
});

describe('boss level bar', () => {
  const spec = { id: 'warden', tier: 1, atSec: 120, hpMul: 1 } as const;
  const snap = (t: number) => ({ elapsedSec: t, score: 0, kills: 0, lives: 3 });
  const obj = { kind: 'destroy', count: 300 } as const;
  it('before the entrance it fills with time and reads BOSS IN', () => {
    expect(objectiveProgress(obj, snap(30), false, undefined, { spec, bar: { shield: 1, health: 1, label: '' } })).toMatchObject({ label: 'BOSS IN 1:30', fraction: 0.25 });
  });
  it('from the entrance it shows the boss health and name', () => {
    expect(objectiveProgress(obj, snap(120), true, undefined, { spec, bar: { shield: 0, health: 0.4, label: '' } })).toMatchObject({ label: 'Warden', fraction: 0.4, shield: 0, health: 0.4 });
  });
  it('shows the shield and health strips from a BossBar', () => {
    expect(objectiveProgress(obj, snap(120), true, undefined, { spec, bar: { shield: 0.25, health: 1, label: '' } })).toMatchObject({ label: 'Warden', shield: 0.25, health: 1 });
  });
  it('uses the BossBar label, Broodlings in the split phase', () => {
    const brood = { id: 'brood', tier: 1, atSec: 120, hpMul: 1 } as const;
    expect(objectiveProgress(obj, snap(200), true, undefined, { spec: brood, bar: { shield: 0.5, health: 1, label: 'Broodlings' } }).label).toBe('Broodlings');
    expect(objectiveProgress(obj, snap(200), true, undefined, { spec: brood, bar: { shield: 1, health: 1, label: '' } }).label).toBe('Brood');
  });
  it('the entrance phase carries no strips', () => {
    expect(objectiveProgress(obj, snap(30), false, undefined, { spec, bar: { shield: 0, health: 0, label: '' } }).shield).toBeUndefined();
  });
  it('non boss levels are unchanged', () => {
    expect(objectiveProgress(obj, snap(30)).label).toBe('Destroy 0 / 300');
  });
});
