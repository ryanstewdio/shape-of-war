# Swarm: gw4-bosses

Create and check out branch feat/swarm-gw4-bosses before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/game/bosses/, tests/game/boss*
Do not touch: src/game/ outside src/game/bosses/, src/core/, src/render/, src/audio/, src/ui/, docs/ other than your hand off
Read first: src/game/bosses/tempest.ts, src/game/bosses/bastion.ts, src/game/bosses/table.ts (BASTION, TEMPEST, TEMPESTLING)

## Goal
Device gate GW4 (build a1bbf1c, Ryan): Tempestlings: "no dashing, just pursuing the ship"; they stay off walls (good), have their own look (good), fairness 3 (slightly hard), not too hot. Bastion: turrets "not harder to kill, but less life is removed once they are all knocked out"; fairness 5, too easy (target 4).

## Acceptance
- Tempestling dashes must happen in a real fight: write a test that runs the real level 40 boss fight (or the ?boss=tempest path with the real step loop) with a scripted ship that circles and does not damage them after the split, and asserts each Tempestling performs at least 3 committed dashes of at least 200 u in 20 s, each preceded by its marker. Find why the device shows none (for example the chase state always overriding the dash state, a wind up that never completes because the ship moves, or the dash speed clamped by the chase speed) and fix it. To keep fairness near 4 after dashes return, lower the chase speed from 196 to 165 u/s and give a 0.7 s wind up with the marker.
- Bastion harder (target 4): turret HP 180 to 300; turrets regenerate: one destroyed turret rebuilds 18 s after it fell (at half HP) while the core has more than 33 percent HP; core HP plus 20 percent; phase 3 shield cadence 12 s to 10 s. Tests for regen timing and HP.
- Determinism tests (two runs hash equal). npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/swarm-gw4-bosses.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
