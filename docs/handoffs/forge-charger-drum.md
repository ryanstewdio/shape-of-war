# Hand-off Forge: charger-drum

Branch: feat/forge-charger-drum. Session: https://claude.ai/code/session_018Gwqi6YeqyJUaPBYehR6tB

## What changed
No src change. I wrote the acceptance tests on the cylinder arena of the generated seed 42 level 16 through the real `stepGame` loop. All pass against current main, so the charger, blink and swirl simulation is already correct across the seam:
- Charger dash moves along the heading locked at dash start (`w.rot` is not touched during the dash), `confineOn` wraps x each step, and a rim stops it like a flat wall.
- Blink destination uses `isInsideOn` and the position is wrapped on the jump.
- Swirl dive uses the locked heading and `moveToHit`; the orbit uses the wrapped delta to the ship.

## Files touched
tests/game/chargerDrum.test.ts (new). Nothing else.

## Tests added
tests/game/chargerDrum.test.ts: 7. Charger dash across the seam in both directions with the ship moving mid dash (short way lock, no stop or reversal, rot never changes, full dash length 360 u, end point equals start plus locked unit vector in wrapped coordinates), charger stops at the rim, blink destination is 180 to 260 u from the ship in wrapped terms and inside the rim, swirl dive crosses the seam, swirl orbit at the seam keeps its distance.

## Test and build
npm test: 277 files passed, 1 failed (3913 passed). The failure is the accepted perf exception, generator "200 levels under 350 ms (flag on)". npm run build: exit 0. PixiJS v7 grep prints nothing. tests/qa untouched.

## Risks
- The ship-moves failure Ryan saw is therefore most likely the drawn lane (Glow's fix): w.rot is the locked heading, and the sim dash goes that way regardless of where the ship is.
- A charger needs about 120 deg of windup turn at most, so a ship directly behind it after a lock dashes the way it faced. That is by design.

## Contracts for other roles
Glow: draw the lane from w.rot, not from the ship position, and draw it through the seam. Render contract is unchanged (w.t phase, w.rot heading).

## Device check for Ryan
On a cylinder level (seed 42 level 16), stand near the left or right edge with a charger on the other side of the seam. When its lane line lights, step through the seam to the other edge. The charger should still dash in the direction the lane pointed, pass through the seam without stopping, and cover its full dash. If a lane would end at the top or bottom rim, the charger should stop at the rim.

## Push
Ryan approved add_repo (push) for stoopstoop/shape-of-war. Branch pushed to origin.
