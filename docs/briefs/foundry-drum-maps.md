# Foundry: drum-maps

Create and check out branch feat/foundry-drum-maps before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/levelgen/, tests/levelgen/
Do not touch: src/core/, src/game/, src/render/, src/audio/, src/ui/, src/main.ts, tests/qa/ (except reading), docs/ other than your hand off
Read first: src/levelgen/generator.ts (the cylinder arena path near "width snaps to a multiple of 64"), src/levelgen/leveldef.ts (obstacle types and validator), tests/levelgen/cylinder.test.ts

## Goal
Gate G3H and G10 (Ryan): the cylinder is fun; he wants "some 3D maps with slower speed due to shape or barriers". Add cylinder map variety that changes how you move, using existing obstacle types only (no new entity or sim feature).

## Acceptance
- Cylinder layouts drawn from the separate surface stream (flat levels stay byte identical; enableCylinder false identical): four patterns with weights: open drum (today), barrier rings (2 to 3 horizontal bars across u at fixed v with 1 or 2 gaps each 160 to 240 u wide, so the player must route through gaps), staggered pillars (6 to 10 short bars offset in a checker pattern that break straight lines across the seam), and a narrow drum (width at the low end of the size bounds, multiple of 64, so the wrap comes round quickly and enemies arrive from both sides). Every pattern keeps the spawn point, wells and spawners at legal distances (wrapped), leaves a path between rims (check reachability with a coarse flood fill on a 64 u grid with wrap), and passes the validator.
- Tests: pattern weights over 4000 seeds, reachability for every generated cylinder level in levels 11 to 60 for 500 seeds, widths multiples of 64, flat levels byte identical to main, enableCylinder false identical. List in the hand off one seed and level per pattern so Ryan can open each.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/foundry-drum-maps.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
