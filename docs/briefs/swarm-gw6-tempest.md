# Swarm: gw6-tempest

Create and check out branch feat/swarm-gw6-tempest before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/game/bosses/, tests/game/boss*
Do not touch: src/game/ outside src/game/bosses/, src/core/, src/render/, src/audio/, src/ui/, docs/ other than your hand off
Read first: src/game/bosses/tempest.ts, src/game/bosses/table.ts (TEMPEST, TEMPESTLING)

## Goal
Device retest (build fb7dff2, Ryan): Tempestlings now dash "but in a clumsy manner that is not threatening", "somewhat stay off walls but get stuck sometimes", fairness 5 too easy. Bastion rated 4 on that build: do not touch Bastion.

## Acceptance
- Precise dashes: aim each dash at the ship's predicted position at dash end (lead by current ship velocity times the dash travel time, clamped to the arena), lock the line at the end of the wind up, shorten the wind up 0.7 to 0.5 s, and after the dash turn sharply (within 0.2 s) back toward the ship instead of drifting. The two Tempestlings coordinate: one leads, the other cuts off the ship's escape direction (perpendicular line), so a sidestep from one dash runs into the other.
- Unstuck: if a Tempestling has been within 140 u of a wall or obstacle, or moved less than 40 u in the last 1.0 s, it steers toward the arena centre for 0.6 s; dash lines are clipped so they never end inside 60 u of a wall. Test with a real fight on a rectObstacles arena: no Tempestling stays within 140 u of a wall for more than 1.5 s over 30 s.
- Target fairness 4. Determinism tests (two runs hash equal); tests for lead aim, line lock, the unstuck rule. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/swarm-gw6-tempest.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
