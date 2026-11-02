# Glow: membrane

Create and check out branch feat/glow-membrane before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: sonnet
Owned paths: src/render/, tests/render/
Do not touch: everything else
Read first: src/levelgen/leveldef.ts (Obstacle.membrane, read only), the obstacle drawing in src/render/grid.ts and tiltGeom.ts and the drum obstacle path in src/render/drumPen.ts (search obstacle)

## Goal
Tester build polish: barrier ring drum levels get membrane bars that block the ship and its bullets but let enemies squeeze through slowly (Forge and Foundry build that in parallel).

## Acceptance
- Draw an obstacle with membrane true as a translucent shimmering bar (fill alpha 0.12, a dashed outline in the arena wall colour lifted 20 percent, a slow ripple running along it), clearly different from solid walls, on flat, tilted and drum paths (through the existing obstacle paths so it bends on the drum). When an enemy overlaps it, brighten the overlap region briefly. Test that a membrane obstacle takes the membrane style and a solid one does not. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-membrane.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
