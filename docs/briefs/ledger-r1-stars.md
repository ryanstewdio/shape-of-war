# Ledger: r1-stars

Create and check out branch feat/ledger-r1-stars before any edit. Never push main. Start from the current HEAD (local main 6dce020 or later carries the Insane stub).

Model: opus
Owned paths: src/ui/, src/main.ts, src/core/settings.ts, src/core/scoring.ts or wherever stars are computed (search stars), tests/ui/, tests/settings/, tests/qa/normalDifficulty.test.ts, tests/qa/storageKeys*.test.ts, the docs/13 settings key table
Do not touch: src/game/, src/render/, src/audio/, src/levelgen/, src/core/difficulty.ts (read only), docs/ other than the key table and your hand off
Read first: src/core/difficulty.ts (Insane added, addScale and driftScale fields), src/ui/intro.ts, src/ui/settings.ts, the results and stars code (search stars in src/ui and src/core), tests/settings/difficulty.test.ts, tests/qa/normalDifficulty.test.ts

## Goal
Release gate R1 (Ryan): "difficulty needs to be selectable on the intro screen of each level. The number of stars received must include relative difficulty. No 3 stars can be given unless on Hard. Add an Insane mode that is 20 percent more difficult. Completing Insane mode is automatically 4 stars, and the 4th star glows iridescently, shimmers and slowly spins."

## Acceptance
- Intro card of every level: a four way Difficulty selector (Easy, Normal, Hard, Insane) defaulting to the saved setting; changing it saves the setting and applies to that level. Settings row shows the same four.
- Stars: compute the score stars as today, then cap by difficulty: Easy at most 1, Normal at most 2, Hard at most 3, Insane: completing the level gives 4 stars outright. Saved bests store the stars earned and the difficulty; a better star count replaces a worse one. Level select shows the best stars per level, 4 when earned on Insane.
- The 4th star: an iridescent star (hue cycling through the neon palette via applyNeon, a soft shimmer and a slow spin, about 1 turn per 6 s) on the results screen and in level select, DOM or canvas, no image files, respecting reduced motion if the app already honours it.
- Fix the Insane fallout: tests/settings/difficulty.test.ts (four values, labels) and tests/qa/normalDifficulty.test.ts (the table has addScale and driftScale, Normal is exactly 1). Register any new storage keys in the storage audits and the docs/13 table.
- Tests: star caps per difficulty, Insane gives 4, best stars replacement, selector on the intro card saves and applies. npm test and npm run build pass on the branch (accepted perf exception aside). Commit on the branch. Do not push; the dispatcher reports the branch.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. Touch only. applyNeon(n) is the only neon entry point. No assets beyond PWA icons. No em or en dashes. Hand off under 40 lines with a device check written in words.
## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/ledger-r1-stars.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
