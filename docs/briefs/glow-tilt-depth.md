# Glow: tilt-depth

Create and check out branch feat/glow-tilt-depth before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/audio/, src/ui/, src/input/, src/main.ts, docs/ other than your hand off
Read first: src/render/project.ts, src/render/tiltScene.ts, src/render/tiltGeom.ts, src/render/tilt.ts, the shape spec and enemy look modules (src/render/shapeSpecs.ts, src/render/partLooks.ts, src/render/bossShapes.ts) by search

## Goal
Tilt gate G6 (build 8960248, Ryan): everything works (setting, far wall narrower, whole arena visible, grid depth, aim accurate, Low and Off right) but the tilt rates 3.75 of 5: "there is opportunity to enhance the holistic tilt experience: lower angle with more 3D rounding on all objects". The cylinder wave (D13) only starts when the tilt rates 4 or better, so this session decides it.

## Acceptance
- Lower angles: low 7 deg, high 13 deg (from 12 and 22); keep the setting names. Fit and identity tests updated.
- 3D rounding on all objects while tilt is on (Off stays the exact current render): every neon shape (ship, enemies, boss bodies and parts, pickups, drones, wells' core, walls and obstacles) gets a pseudo 3D volume: an extruded copy of its outline offset toward the viewer's down direction by a depth proportional to its size and the tilt (about 0.25 of the radius at high), joined to the top outline by edge lines at the vertices, the side faces drawn at 40 percent alpha and the top outline at full brightness, plus a soft highlight on the edge facing up (a lighter stroke on the upper half) and a subtle darker toward the base gradient made only by lowering alpha (never black paint). Round shapes (circles, wells, Splime) get a rim ellipse and a top highlight arc. Walls get a short raised lip with a top edge. Bullets and particles stay flat. Everything keeps one draw path per layer, no per frame allocation, and works with the billboard projection already in tiltScene.
- Nova snake glints (third device fail, G6 item j: no glints seen on snakes from wells on build 8960248, though gw5-galaxy tests pass): find the real cause on the live path (the renderer may never match the snake: the bus event fires in the sim step before the renderer subscribes, ids are the head while segments are drawn elsewhere, a reset clears the tracking set, or the glint layer is not added to the stage under tilt or off). Write a test that runs the real game step and the real renderer bookkeeping (not a hand built state): a nova well releases a snake, and the glint draw list for that snake is non empty for its life. Fix it.
- Lattice: lines farther away get slightly thinner (alpha multiplier only, the applyNeon rule holds), and the grid z lift reads a little more (bounded).
- Tests: the extrusion helper (offset direction and depth scale with tilt, zero at Off), Off equals the current render positions for a recorded frame, no colour darker than 30 percent lightness in the volume path, the fit keeps the whole arena visible at the new angles. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight at high); note the cost estimate.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-tilt-depth.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
