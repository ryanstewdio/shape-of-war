# Chorus: menu-themes

Create and check out branch feat/chorus-menu-themes before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/audio/, tests/audio/
Do not touch: src/game/, src/core/, src/render/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: the menu theme module from chorus-tunes-menu (search ui:screen in src/audio), src/audio/music/compose.ts

## Goal
Gate G6 (Ryan): the menu theme works; "we will want 2 to 4 menu theme songs total so it does not lose value or begin to annoy users".

## Acceptance
- Two more title and menu themes (3 total), each original with its own hook, mode, tempo (85 to 115 BPM) and lead, same calm spacey register. Rotation: a new theme each time the app boots or the player returns to the menu from a level (deterministic order, persisted index in the existing music storage key or a new key declared in the hand off), never the same theme twice in a row; within one menu visit the theme loops without repeating its hook every 8 bars (A, B and a calmer C section).
- Tests: rotation order, no immediate repeat, persisted index, variety signatures for the three themes, lifecycle unchanged. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/chorus-menu-themes.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
