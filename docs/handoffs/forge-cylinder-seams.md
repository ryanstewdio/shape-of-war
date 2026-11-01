# Hand-off Forge: cylinder-seams (V3-H C1, D13)

Branch: feat/forge-cylinder-seams. Session: https://claude.ai/code/session_018Gwqi4QwCbzGaWnByvwj8D

## What changed
- Every vector between two points in the enemies, drones and supers now goes through `w.surface.delta`. Every `confine` is `confineOn(w.surface, ...)`, every `isInside` is `isInsideOn`, and bulwark `inFrontArc` gets `w.surface`.
- Gravity well: ship, bullet, enemy pull and the explosion radius use the wrapped offset. Slime overlap, snake path walk and segment heading, swirl heading, weaver bullet sense, blink destination test, drone target and collect, pickup collect, armed shots, Detonate and homing steering all see across the seam.
- Sower: dives aim at the centre (u 0, v 0) the short way. On a cylinder the edge leg goes to the nearer rim (there is no u wall) and the probes use confineOn.
- Left raw on purpose: the collect drone trail point and the orbit points (ship plus an offset, not a vector between two points). Positions written there are wrapped at the next step.
- Boss files untouched (boss levels are flat).

## Files touched
src/game/drones.ts, supers.ts, enemies/{blink,bulwark,gravitywell,slime,snake,sower,swirl,weaver}.ts, tests/game/cylinderSeams.test.ts.

## Tests added
tests/game/cylinderSeams.test.ts: 24, on the cylinder arena of the generated seed 42 level 16 (calm waves, collect drone) through `stepGame`. Eight seekers close the wrapped gap, charger dash, slime, bulwark shield, blink destination, snake body, sower dive and rims, well pulls ship and enemy across the seam, drone orbit with no jump, attack aim, collect vacuum, Detonate, homing, determinism (two runs hash equal). 9 of them fail with the src changes stashed.

## Test and build
npm test: 269 files, 3813 passed, 1 failed, 1 todo. The failure is the accepted perf exception (generator "200 levels under 350 ms (flag on)", 690 ms in this VM). npm run build: exit 0. tests/qa untouched.

## Raw subtraction grep (enemies, drones, supers)
`grep -nE "confine\(|isInside\(" src/game/enemies/*.ts src/game/drones.ts src/game/supers.ts` prints nothing. The list in the core hand-off for these files is empty. The PixiJS v7 grep from CLAUDE.md prints nothing.

## Risks
- Bodies the drone or Detonate write past plus or minus W/2 stay uncanonical for one step (documented in the core hand-off).
- Sower on a cylinder now hugs a rim rather than a wall loop, so its roam path differs from flat by design. Flat is unchanged.

## Contracts for other roles
- Glow: nothing new. Foundry: none. Bosses (C2) can reuse the same pattern from the core hand-off list.

## Device check for Ryan
Play a cylinder level from level 11 up (seed 42 level 16 is one: wide, no side walls). Fly off the left edge and come back on the right. Enemies near the edge should chase you through the seam, not run the long way round. Park near the seam with a gravity well on the other side: it should drag you across. Your drone should circle smoothly while you cross. Fire a Detonate with enemies on the far side of the seam and they should die.

## Push
Ryan approved add_repo (push) for stoopstoop/shape-of-war; origin set to https://github.com/stoopstoop/shape-of-war.git and the branch pushed.
