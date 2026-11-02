# Proctor: release-fix

Create and check out branch fix/proctor-release-fix from the current HEAD (local main c892ddc carries five release polish merges that are not on origin yet; keep them) before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: tests/ (all), and src/ only for a real defect you prove with a failing test (say which in the hand off)
Do not touch: docs/ other than your hand off

## Goal
Five release polish branches merged cleanly and build, but the full suite has 35 failures: tests/game/bossGw5 (6), bossLevelEnd (7), bossLevelEndSeed42 (1), bossTempestGw4 (7), bossTempestGw6 (10), weapons (1), wellArrival (1), tests/qa/bossFairnessSweep (1), and the accepted generator perf test. Expected causes: Foundry now places the boss at 240 s or later and makes levels 5 minutes long (tests that run real boss levels expect the boss at about 10 s and a short fight); Swarm made every fight 210 to 260 s with attack rotation and level scaling (Tempest and Tempestling numbers from GW4 to GW6 changed); Forge added difficulty (Normal must be identical) and drum drift.

## Acceptance
- For each failing test decide: the test pins old intended numbers that docs/14-release-polish.md deliberately changed (update the test to the new design, keeping what it protects: for example run the real level until its new boss time, or inject the boss early with the existing ?boss path helpers, and use longer step budgets), or the merge exposed a real defect (fix src with a test). List every test and the decision in the hand off.
- Normal difficulty must stay identical to pre release behaviour except where docs/14 changes it on purpose (level length, boss timing and fight length); prove Normal applies multipliers of exactly 1.
- Full npm test passes except the accepted perf test; npm run build passes. Commit on the branch and push the branch only (it will carry the five merges). Hand off under 40 lines.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. Touch only. No em or en dashes in any file you write. Keep tests meaningful: never delete a test to make the suite pass; replace it with one that checks the new design.
