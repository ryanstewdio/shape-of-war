# Swarm: gw5-bosses

Create and check out branch feat/swarm-gw5-bosses before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/game/bosses/, tests/game/boss*
Do not touch: src/game/ outside src/game/bosses/, src/core/, src/render/, src/audio/, src/ui/, docs/ other than your hand off
Read first: src/game/bosses/table.ts (BASTION, TEMPEST, TEMPESTLING), src/game/bosses/bastion.ts, src/game/bosses/tempest.ts

## Goal
Device gate GW5 (build 5966c36, Ryan): Tempest dashes now work; fairness 5, "a little too easy". Bastion turret regen works; fairness 5 (it has rated 5 for three gates). Target 4 for both.

## Acceptance
- Tempest: big Tempest attack cadence 20 percent faster and HP plus 10 percent; Tempestlings chase 165 to 185 u/s, dash every 2.6 s (from the current cadence), dash speed plus 10 percent, wind up stays 0.7 s; after a dash each fires a 6 bullet fan along its path.
- Bastion: turret fire interval 25 percent shorter; turret regen 18 s to 12 s (still half HP, still only while the core is above 33 percent); phase 3 shield releases 8 Hornets (pool rules unchanged) and its sweep arm turns 20 percent faster; core HP plus 15 percent.
- Update bossFightLength bands only if needed and say so. Determinism tests (two runs hash equal), tests for each changed number. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/swarm-gw5-bosses.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
