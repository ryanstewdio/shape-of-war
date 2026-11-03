# HAND-OFF forge: r1-swirl

Branch: feat/forge-r1-swirl

## What changed
- Root cause of R1: `swirl.step` measured distance and angle to the target (ship or detach decoy via `targetOf`) but placed the new position around the ship (`w.x[0]`, `w.y[0]`). With a decoy live, every Swirl in lure range was pulled to a ring about the ship at its decoy distance, and on a cylinder the unwrapped ship position made them pile up. Swirls now orbit the target through `surface.delta`: the centre is taken in the swirl's own unwrapped frame, so the short way round is used and `moveTo` wraps or confines.
- Drift: `stepDrift` multiplies speed (base and burst) by `difficultyOf(w).driftScale`. Normal is 1, so it is unchanged.

## Files touched
- src/game/enemies/swirl.ts, src/game/drift.ts
- tests/game/swirlDecoy.test.ts (new), tests/game/drift.test.ts (appended)

## Tests added
- swirlDecoy: 4 corner bunching cases (seed 42 level 16 cylinder with pillars, and flat; detach on and off; 30 s, at most a third near any one arena or obstacle corner) and 1 decoy orbit case. The decoy case fails on the old code; the 4 corner cases pass on both old and new code, so they are guards, not repros.
- drift: 4 cases (easy, normal, hard, insane scale).

## Test and build
- npm test: 6 failed, 4153 passed. Failures: tests/settings/difficulty.test.ts (4) and tests/qa/normalDifficulty.test.ts (1), both awaiting Ledger's Insane update, and the generator perf test "200 levels under 350 ms" (VM timing).
- npm run build: pass. The v7 shim grep prints nothing.
- I ran `npm ci` (lockfile only) because node_modules was empty.

## Risks
- Swirl paths change whenever a decoy is live; with no decoy the target is the ship and the maths is the same.
- Level 16 seed 42 has obstacles, so open drum drift is off there; drift is tested on a drum without obstacles.

## Contracts for other roles
- Ledger: Insane `driftScale` 1.6 is read as is. No event or table changes.

## Device check for Ryan
1. Play seed 42, level 16 (the pillar cylinder). Collect a Detach power up and let the drone fly out to its post.
2. Watch the small green Swirls for 20 seconds. They should circle and dive at the red orange decoy drone, spread around it, and none should pile up in a corner or against a pillar.
3. When Detach ends, they should switch back to circling your ship.
4. On Hard or Insane, open-drum levels should drift visibly faster; on Easy, slower. Normal feels as before.

## Dependencies requested
none

## Requests
none

## Known gaps
- No standalone in-sim repro of the corner pile-up was found, so the corner tests are guards only.

Session: https://claude.ai/code/session_018Gwqi2ewkKyRVzYKPDF4tQ
