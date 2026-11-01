# Forge: gw4-fixes

Create and check out branch feat/forge-gw4-fixes before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/game/ except src/game/bosses/, tests/game/ except tests/game/boss*
Do not touch: src/game/bosses/, src/core/, src/render/, src/audio/, src/ui/, src/input/, src/gen/, tests/qa/, docs/ other than your hand off
Read first: src/game/enemies/sower.ts, src/game/wellArrival.ts, the level start, restart and retry paths in src/game/game.ts and src/game/state.ts

## Goal
Device gate GW4 (build a1bbf1c, Ryan): (1) the Sower roam loop was not seen: Sowers still only move on the edge. (2) "Wells do not clear with level resets": after a restart or retry, old wells remain.

## Acceptance
- Sower: find why the roam does not show in real play (Sowers dying before 12 s, roam gated to some arenas, steering pinned to the edge by the orbit force, or a state reset). Write a test on real generated levels that contain Sowers (the V2 generator config), running the real step loop with an idle ship that does not fire, asserting each Sower comes within 150 u of the arena centre within 20 s of spawning and returns to the edge. Make the first dive come 6 to 10 s after spawn (hashed, no PRNG), then every 14 to 20 s.
- Reset: on level start, restart and retry, every well and arrival state is reset (live wells, wellAge, wellNova, wellIds, arrival schedule and pending telegraphs, nova snake bookkeeping, sim:saw state). Test: run a level until wells and a nova exist, restart, assert no wells, no pending arrivals, and the arrival clock restarts from 0. If the renderer needs a signal, check what bus event the level start already emits and name it in the hand off for Glow.
- tests/qa snapshots unchanged. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/forge-gw4-fixes.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
