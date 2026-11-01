# Chorus: reset-voices

Create and check out branch feat/chorus-reset-voices before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: sonnet
Owned paths: src/audio/, tests/audio/
Do not touch: src/game/, src/core/, src/render/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: src/audio/gw2.ts (whirlpool roar, saw, shield hum voices), src/core/events.ts ('game:start', 'game:quit', 'ui:screen', read only)

## Goal
Device gate GW5: after a level restart or retry the old wells are gone but "the noise remained": a looping whirlpool roar (and possibly the saw buzz or shield hum) keeps playing.

## Acceptance
- On 'game:start', 'game:quit', and 'ui:screen' to any screen other than play, stop every looping sfx voice (whirlpool roars, saw buzz, shield hum, any other loop) with a 100 ms fade and clear their bookkeeping, so a new level starts silent. Pause keeps them paused, resume restores only those still valid.
- Tests: start a roar and a saw, emit game:start, assert all loops stopped and maps empty; same for game:quit and ui:screen menu; pause and resume keep a live roar.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/chorus-reset-voices.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
