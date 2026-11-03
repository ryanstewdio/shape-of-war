# Foundry: r1-pacing

Create and check out branch feat/foundry-r1-pacing before any edit. Never push main. Start from the current HEAD (local main 6dce020 or later).

Model: opus
Owned paths: src/levelgen/, tests/levelgen/, tests/qa level pins (update only, list each)
Do not touch: src/core/, src/game/, src/render/, src/audio/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: src/levelgen/leveldef.ts (par and star thresholds, band tables), src/levelgen/generator.ts (waves, pacing from foundry-durations, drum patterns and their weights), tests/levelgen/durations.test.ts

## Goal
Release gate R1 (build a1aa5e3, Ryan): level 6 par was 742,000 and he scored 4,873,670 in the full 5 minutes (the par bar showed 97 percent: the par and star thresholds are far off for the long levels). "At times it was too slow and no enemies for 5 to 10 seconds." He wants more volatility and variability. He could not find an open drum (no barriers); he wants more drum levels with varying features.

## Acceptance
- Par and stars: recompute par and the star thresholds for the long levels from the expected score over the whole level (score per second from the scripted kill rate times the expected duration, including multiplier growth), so a strong player who plays the full level lands around par to 1.5x par, not 6x. Check against Ryan's data point: level 6 at about 4.9 million should be near the top star threshold, not 6 times par. Explain the formula in the hand off. If the par bar in the HUD is driven by something else (time or objective), say so for Ledger.
- No dead air: at most 3 s without at least 3 live enemies after the first 10 s of any non boss level, except a deliberate breather of at most 4 s after a peak. Volatility: waves vary more in size and type (surges of 2x, swarms of small fast enemies, quiet stretches of 1 big enemy), still deterministic. Test with the duration estimator plus a gap check over 500 seeds.
- Drums: raise the share of open drums (no barriers) to 30 percent of cylinder levels, and make cylinder levels 40 percent of levels 11 and up that are not boss levels; list one seed and level of an open drum, a ring level with membranes and a narrow drum, all under level 25, so Ryan can open them without the dev flag.
- Flat invariants (V1, V2, V3 configs identical), determinism, version bump stated. npm test and npm run build pass on the branch (accepted perf exception aside), except tests/settings/difficulty.test.ts and tests/qa/normalDifficulty.test.ts (Ledger updates them in parallel). Commit on the branch. Do not push; the dispatcher reports the branch.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts (generator draws only from its seeded streams). No em or en dashes. Hand off under 40 lines with a device check written in words.
## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/foundry-r1-pacing.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
