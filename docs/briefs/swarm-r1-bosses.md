# Swarm: r1-bosses

Create and check out branch feat/swarm-r1-bosses before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. Start from the current HEAD (local main 6dce020 or later carries the Insane stub; it is not on origin yet), and push only your branch.

Model: opus
Owned paths: src/game/bosses/, tests/game/boss*
Do not touch: src/game/ outside src/game/bosses/, src/core/ (read only: Difficulty now includes insane, DifficultyTable gained addScale), src/levelgen/, src/render/, src/audio/, src/ui/, docs/ other than your hand off
Read first: src/core/difficulty.ts, src/game/difficulty.ts, src/game/bosses/table.ts, src/game/bosses/core.ts, src/game/bosses/warden.ts, tests/game/bossFightLength.test.ts

## Goal
Release gate R1 (build a1aa5e3, Ryan): Warden is balanced and fun (fairness 4.25 Normal, 5 Easy) but the fight lasted 2.5 minutes against the 3.5 minute target. He wants an Insane difficulty (20 percent harder than Hard) where bosses use their abilities faster and bring more minions.

## Acceptance
- Fight length: a skilled player took about 150 s where the scripted gunner predicts 210 to 260 s, so the gunner is weaker than Ryan. Raise every boss's hit points by 40 percent at Normal (keep windows and patterns) and re-band bossFightLength to the new scripted numbers; note the scripted times in the hand off.
- Insane and all difficulties: cadence and hit points already scale with bossScale; also scale every minion count (hornets, adds, splits' spawn counts where they are adds, Prism echoes) by addScale, rounded, never below 1 and within the existing pools and caps (raise a cap only if the pool allows). Insane bosses also telegraph 15 percent shorter. Tests for each scale on Warden, Bastion and Brood, determinism (two runs hash equal).
- npm test and npm run build pass on the branch, except tests/settings/difficulty.test.ts and tests/qa/normalDifficulty.test.ts, which Ledger updates for Insane in parallel (note them, do not edit them).

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/swarm-r1-bosses.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
