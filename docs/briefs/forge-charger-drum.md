# Forge: charger-drum

Create and check out branch feat/forge-charger-drum before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: sonnet
Owned paths: src/game/enemies/charger.ts, src/game/enemies/blink.ts, src/game/enemies/swirl.ts, tests/game/ (new files only)
Do not touch: anything else
Read first: src/game/enemies/charger.ts, src/core/surface.ts, docs/handoffs/forge-cylinder-seams.md

## Goal
Device gate G10 (Ryan): on cylinder levels, chargers line up an attack path and then "generally fail to execute" when the ship moves. Glow is fixing the drawing in parallel. Make sure the simulation side is right too.

## Acceptance
- Test on a real cylinder level (seed 42 level 16 or another generated cylinder with chargers, real step loop): a charger that locks a lane while the ship is across the seam dashes the short way along its locked direction, crosses the seam without a stop or reversal, travels its full dash length, and ends where the flat math predicts in wrapped coordinates; a charger whose lane would cross a rim stops at the rim as on a flat wall. Same check for blink teleport targets and swirl orbits near the seam. If any fail, fix them (lock the direction as a unit vector from surface.delta at lock time, never recompute from raw positions during the dash; wrap the position each step).
- Flat stays bit identical (tests/qa untouched and passing). npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/forge-charger-drum.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
