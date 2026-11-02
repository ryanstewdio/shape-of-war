# Foundry: durations

Create and check out branch feat/foundry-durations before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/levelgen/, tests/levelgen/, tests/qa/levelSnapshots.test.ts and other tests/qa level pins (update pins only, list each)
Do not touch: src/core/, src/game/, src/render/, src/audio/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: docs/14-release-polish.md (items 7 and 9), src/levelgen/leveldef.ts (band tables: surviveSec, scoreInTime limits, destroy counts, wave and loop settings; Obstacle.membrane), src/levelgen/generator.ts (boss spec atSec, drum patterns)

## Goal
Ryan: "average minimum game play time per level should be 5 minutes for non boss levels; boss levels at least 4 minutes of non boss enemies, then at least 3.5 minutes of boss fighting." Today levels last 45 to 120 s. Also membrane gaps in barrier ring levels.

## Acceptance
- Non boss levels: every objective sized so a competent player needs at least 5 minutes on average: survive 300 to 360 s; scoreInTime limits 300 to 360 s with targets scaled from the current score per second; destroy counts scaled so the expected clear time at the current kill rate is 300 s or more. Waves must keep variety for that long: extend wave lists and loops so no wave repeats within 90 s, and ramp intensity across the level (calmer first minute, peaks every 60 to 90 s with short breathers). Levels 1 to 3 may sit at the 5 minute floor; later bands may run longer.
- Boss levels: waves for at least 240 s before the boss (BossSpec.atSec 240 or later), no boss before that; the boss fight length is Swarm's (he scales hit points in parallel).
- Endless unchanged. Keep generator determinism and the flag off invariants (V1, V2, V3 configs identical to today); bump the generator version for the new tables and say how.
- Membranes: in barrier ring drum levels, each ring gets 1 or 2 membrane segments (Obstacle membrane true, 120 to 200 u wide) in addition to its open gaps; validator accepts membrane only on cylinder ring levels.
- Tests: expected duration estimate per level over 500 seeds (a pure estimator from objective, wave rates and the scripted kill rate) at least 300 s for non boss and at least 240 s of waves for boss levels; no repeated wave within 90 s; membranes placed and valid; snapshots updated with the list. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/foundry-durations.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
