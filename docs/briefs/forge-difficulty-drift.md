# Forge: difficulty-drift

Create and check out branch feat/forge-difficulty-drift before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/game/ except src/game/bosses/, tests/game/ except tests/game/boss*
Do not touch: src/game/bosses/, src/core/ (read only), src/levelgen/, src/render/, src/audio/, src/ui/, src/main.ts, tests/qa/ (read only), docs/ other than your hand off
Read first: docs/14-release-polish.md (items 6, 8, 9), src/core/difficulty.ts, src/game/difficulty.ts (stub: replace its body), src/game/game.ts (GameOptions), the obstacle collision path (confineOn), src/levelgen/leveldef.ts (Obstacle.membrane, read only)

## Goal
Tester build polish: difficulty choice, open drum pressure, membrane gaps. Ledger adds the setting and passes GameOptions.difficulty; Swarm scales bosses with difficultyOf(w); Foundry generates membranes in ring levels; Glow draws them.

## Acceptance
- GameOptions.difficulty?: Difficulty (default normal), stored on the world; difficultyOf(w) returns its table. Apply: enemy move speed, enemy hit points, wave spawn counts (round, at least 1 where the def has at least 1), starting lives plus extraLives (minimum 1). Normal must be bit identical to today: tests/qa snapshots and replay hashes unchanged.
- Open drum drift: on cylinder levels with no obstacles, every entity and the ship drift along u at 40 u/s plus a burst to 160 u/s for 1.2 s every 9 to 14 s (hashed from the level seed, no PRNG), ramping in and out over 0.3 s, direction fixed per level; the ship must counter it with the move stick. Telegraph: emit an existing bus event or a new one only if needed (say which in the hand off). Tests: drift speed, burst timing, ship counters at full stick, determinism.
- Membranes: an obstacle with membrane true blocks the ship and player bullets like a wall, but enemies pass through at 35 percent of their speed while overlapping it (their bullets and boss hazards are not affected). Tests: ship blocked, bullet blocked, grunt crosses slowly, flat levels without membranes unchanged.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/forge-difficulty-drift.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
