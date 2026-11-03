# Forge: r1-swirl

Create and check out branch feat/forge-r1-swirl before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. Start from the current HEAD (local main 6dce020 or later carries the Insane stub; it is not on origin yet), and push only your branch.

Model: sonnet
Owned paths: src/game/ except src/game/bosses/, tests/game/ except tests/game/boss*
Do not touch: src/game/bosses/, src/core/ (read only), src/levelgen/, src/render/, src/audio/, src/ui/, src/main.ts, tests/qa/, docs/ other than your hand off
Read first: src/game/enemies/swirl.ts, the decoy target code (search targetOf and detach in src/game), src/game/drones.ts, src/core/difficulty.ts (driftScale), the open drum drift code from forge-difficulty-drift

## Goal
Release gate R1 (Ryan): "on level 16 with seed 42 the small green swirls aggregate together in a corner instead of moving normally; I noticed this when the Detach power up is active." Level 16 seed 42 is a cylinder (pillars). Also: open drum drift should vary with the chosen difficulty.

## Acceptance
- Reproduce on the real seed 42 level 16 with the drone in detach mode (real step loop): find why Swirls bunch (likely the decoy position read raw, not wrapped or not through surface.delta, the orbit centre computed from an unwrapped decoy, or confineOn pinning them against pillars). Fix it so Swirls orbit and dive around the decoy (or the ship) the short way and do not collect in a corner; test that over 30 s no more than a third of the Swirls sit within 120 u of any one arena corner or obstacle corner, with detach on and off, flat and cylinder.
- Drift: multiply the open drum drift speed and burst speed by difficultyOf(w).driftScale. Normal stays identical (tests/qa unchanged). Test the scale.
- npm test and npm run build pass on the branch, except tests/settings/difficulty.test.ts and tests/qa/normalDifficulty.test.ts (Ledger updates them for Insane in parallel; note them).

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/forge-r1-swirl.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
