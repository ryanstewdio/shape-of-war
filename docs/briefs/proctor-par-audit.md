# Proctor: par-audit

Create and check out branch feat/proctor-par-audit before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: docs/qa/par-audit.md, scripts/par-audit.ts (or .mjs), tests/qa/parAudit.test.ts
Do not touch: anything under src/ (read only), other tests, docs/ other than your two files and your hand off
Read first: src/core/stars.ts (targetsFor, DIFFICULTY par scale), src/levelgen/pacing.ts, generator.ts (par, score goal), src/game/scoring.ts, src/game/bosses/table.ts (WAVE_BUDGET_WITH_BOSS by difficulty, boss bonus), docs/DECISIONS.md newest rows (par ramp, score goal, short levels, boss calm)

## Goal
Ryan 2026-11-11: par on level 15 (Spindle) is hard to reach on Normal; look at every level's par and make sure it is achievable relative to the difficulty. Note: the boss calm wave just cut regular enemies after a guardian enters (Easy 0, Normal 25 percent, Hard 50 percent), which removes score from guardian levels, so their par may now be out of reach.

## Acceptance
- A deterministic script that, for Adventure levels 1 to 50 on 3 seeds and each difficulty, reports: par and star thresholds, the score available (every scheduled enemy and guardian bonus actually spawned in the level time, with the boss budget applied), par as a share of that available score, and the same share for the score goal. Flag outliers against the median of non guardian levels.
- docs/qa/par-audit.md: the table, the findings in plain words (which levels and why), and one proposed rule for par by level type and difficulty with its expected shares. A proposal only: change no game numbers. Name any generator version or frozen pin a fix would need.
- tests/qa/parAudit.test.ts runs the script on one seed and checks it is deterministic.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/proctor-par-audit.md under 8 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes. Nothing beyond this brief.
