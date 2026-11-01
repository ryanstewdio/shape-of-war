# Swarm: gw2-bosses

Create and check out branch feat/swarm-gw2-bosses before any edit. Never push main.

Model: opus
Owned paths: src/game/bosses/, tests/game/boss*
Do not touch: src/game/ outside src/game/bosses/ (no edits to src/game/state.ts: keep new state in BossState), src/core/, src/render/, src/audio/, src/ui/, docs/ other than your hand off
Read first: src/game/bosses/warden.ts, src/game/bosses/table.ts, src/game/bosses/state.ts, src/game/bosses/bastion.ts, src/game/bosses/tempest.ts, src/game/bosses/brood.ts (split pattern only), src/core/events.ts (sim:bossShield, read only)

## Goal
Device gate GW2 (build cbd5a4d, Ryan): Warden shield and hornet swarm now work, but fairness is 5 of 5, still too easy (target 4); the open window was not perceived. Earlier gates: Bastion is unthreatening after its turrets die; Ryan wants more bosses with shielding, swarming and splitting abilities.

## Acceptance
- Emit sim:bossShield { id, up, x, y } when any boss shield goes up and when it drops (Warden now, Bastion below).
- Warden harder: HP 432 to 520; hornets per shield 10 (two bursts of 5, MAX_HORNETS 10, own pool as now) with chase speed 260 to 300 u/s; ring cadence 3.7 s (phase 1) and 2.8 s (phase 2); open window after the shield 2.5 to 2.0 s; in phase 2 the shield also fires one 12 bullet ring when it drops. Update the tests.
- Bastion phase 3 (after the turrets are gone): every 12 s it raises a shield for 3 s (shots absorbed), releases 6 hornets from the same hornet pool rules, then opens for 2 s; it also drifts toward the ship at 50 u/s between shields.
- Tempest: at its stage 2 crack (33 percent) it splits once into 2 smaller Tempests (each 60 percent size, the remaining HP split evenly, each keeps the storm attack at 70 percent rate), following the Brood split pattern and emitting sim:bossSplit; the boss bar sums the parts and the level completes when both die.
- Determinism tests for each new behaviour (two runs hash equal), shield timing tests, split tests. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/swarm-gw2-bosses.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
