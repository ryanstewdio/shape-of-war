# Swarm: boss-scale

Create and check out branch feat/swarm-boss-scale before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/game/bosses/, tests/game/boss*
Do not touch: src/game/ outside src/game/bosses/ (src/game/difficulty.ts is a read only stub Forge fills), src/core/ (read only), src/levelgen/, src/render/, src/audio/, src/ui/, docs/ other than your hand off
Read first: docs/14-release-polish.md (item 7), src/core/difficulty.ts, src/game/difficulty.ts, src/game/bosses/table.ts, src/game/bosses/core.ts, tests/game/bossFightLength.test.ts

## Goal
Ryan: boss levels need at least 3.5 minutes of boss fighting; bosses should scale with level difficulty (Warden at level 5 is probably too hard for new players, which a difficulty choice may resolve). Foundry moves the boss to 240 s or later in parallel.

## Acceptance
- Fight length: every boss at Normal with the scripted gunner from bossFightLength lasts 210 to 260 s (raise hit points, keep damage windows), and long fights stay varied: each boss cycles its attacks through at least 3 distinct patterns and adds one escalation per phase, so no attack repeats more than twice in a row. Update the bossFightLength bands to the new targets.
- Scaling with level: an early boss (levels 5 to 15) attacks gentler (cadence and bullet speed 75 percent of today at level 5, rising to 100 percent by level 20, then up to 115 percent at level 50 and on loops); hit points follow the fight length rule above.
- Difficulty: multiply boss hit points and attack cadence by difficultyOf(w).bossScale (Forge fills the accessor in parallel; until then it returns normal, so write tests against the table values by injecting a world with a stubbed table or by calling your scale helper directly).
- Determinism tests (two runs hash equal), fight length tests for all ten bosses, scaling tests. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/swarm-boss-scale.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
