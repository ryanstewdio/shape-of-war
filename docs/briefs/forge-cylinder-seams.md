# Forge: cylinder-seams

Create and check out branch feat/forge-cylinder-seams before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: sonnet
Owned paths: src/game/enemies/, src/game/drones.ts, src/game/supers.ts, tests/game/ (new files only, plus tests for these modules)
Do not touch: src/game/bosses/ (boss levels are always flat), src/core/, other src/game files, src/levelgen/, src/render/, src/audio/, src/ui/, src/main.ts, tests/qa/, docs/ other than your hand off
Read first: docs/handoffs/forge-cylinder-core.md (the API and the list of raw subtractions left), src/core/surface.ts, the steer helpers (src/game/steer.ts), then each file on the list

## Goal
Cylinder phase C1 (D13). The core wraps u and the generator now makes about 28 percent of levels 11 to 60 cylinders. Enemies, drones and supers still use raw subtractions, confine and isInside, so they misbehave at the seam.

## Acceptance
- Every vector in src/game/enemies/, drones.ts and supers.ts goes through w.surface.delta (or deltaTo), every confine through confineOn(w.surface, ...), every isInside through isInsideOn, and inFrontArc and capsuleHits get w.surface. The raw subtraction list in the core hand off is empty afterwards (grep proves it; paste the grep in the hand off). Gravity well pull, swirl, weaver, snake, slime, blink teleport targets, sower dives (toward the centre: the centre is u 0, v 0, reached the short way), wanderers, drone orbit and collect, super ranges.
- Flat stays bit identical: tests/qa snapshots and replay hashes unchanged.
- Tests (real step loop on a cylinder level from the generator, for example seed 42 level 16): each enemy kind placed across the seam from the ship seeks the short way; a well pulls the ship across the seam; a drone orbits across the seam with no jump; Detonate or any super catches an enemy across the seam; determinism (two runs hash equal).
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/forge-cylinder-seams.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
