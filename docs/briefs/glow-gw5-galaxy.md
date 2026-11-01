# Glow: gw5-galaxy

Create and check out branch feat/glow-gw5-galaxy before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/audio/, src/ui/, src/input/, src/main.ts, docs/ other than your hand off
Read first: src/render/wellNova.ts and the fluid shader module from gw4-crystal (search FLUID_OCTAVES), the glint helper (search glint), the nova snake look (search wellSpawn in src/render), src/render/tiltScene.ts (whirlpool quads are billboards under tilt; keep that working)

## Goal
Device gate GW5 (build 5966c36, Ryan): fluid feel 3.75 of 5: "needs to be slightly faster, more particles, and more glowing white gas to create a galaxy look". Glints: "nova snakes do not carry the same glints. Ideally the glints would be swirling around the snakes, trailing from the whirlpool."

## Acceptance
- Galaxy whirlpool: flow speed 1.3x (core and rim), brighter and denser glowing white gas (raise gas alpha and add a soft additive glow pass inside the shader, a bright galactic core bulge, 2 to 4 logarithmic spiral arms of brighter gas with dust lanes between them), and about 2x the star dust particles (raise the budget to at most 192 per nova; budget test updated) that stream along the arms with tiny twinkles. Keep clockwise on screen and inward drift. Low tier keeps the geometry path with the 1.3x speed. Keep the Standard tier fps budget (lowest 58 to 59 with two novas): note the GPU cost estimate in the hand off.
- Nova snake glints: each snake that emerged from a well gets a ribbon of 6 to 10 crystal glints that orbit its head and body in a loose helix and trail back along its path, and while the snake is within 250 u of its well a stream of glints flows from the whirlpool to the snake, so it reads as carrying the whirlpool's sparkle. Same glint helper (prismatic, 4 point flares). Tests: glint orbit helper deterministic and bounded, count caps.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-gw5-galaxy.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
