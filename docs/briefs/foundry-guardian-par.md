# Foundry: guardian-par

Create and check out branch feat/foundry-guardian-par before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/levelgen/, src/core/stars.ts, tests/levelgen/, tests/core/, tests/qa/ (only pins that this change moves, and tests/qa/parAudit.test.ts), scripts/par-audit.ts, docs/qa/par-audit.md (append only)
Allowed outside edits (list each in the hand off): the two call sites of targetsFor, src/ui/intro.ts and src/main.ts, only so the per difficulty par reaches targetsFor.
Do not touch: src/game/, src/render/, src/audio/, src/input/, any other src/ui/ file, docs/ other than the two files named here and your hand off
Read first: docs/qa/par-audit.md (all of the findings and the proposal), scripts/par-audit.ts (proposeGuardianPar), src/levelgen/pacing.ts (bossLevelPar), src/levelgen/boss.ts, src/levelgen/generator.ts (the par call near bossLevelPar and how V13 was added), src/levelgen/leveldef.ts, src/levelgen/validate.ts, src/core/stars.ts, src/game/bosses/table.ts (WAVE_BUDGET_WITH_BOSS, tiers), tests/levelgen/bossArenas.test.ts (the frozen version 12 pin pattern)

## Goal
Ryan's ruling 2026-11-11 on the par audit: guardian level par is out of reach since the boss calm. Build the audit's rule with a tiered fight length. Par on difficulty d = s_d x the score really available on d.

## Acceptance
1. New generator version GENERATOR_VERSION_V14 behind a new GenConfig flag, default on. V13_GEN_CONFIG frozen with a "version 13 is frozen" hash pin test. Versions 1 to 13 bit identical.
2. Only guardian levels change bytes and levelHash under V14. Every non guardian level is byte identical to V13 on every seed tested (pin it). Normal difficulty on non guardian levels stays bit identical (tests/qa/normalDifficulty.test.ts passes untouched).
3. Guardian levels carry one par per difficulty: a new optional LevelDef field appended last (JSON serialisable), with stars at 1, 1.25 and 1.5 x that par and score race goals at 0.6 x it. Each par on the 500 grid. targetsFor in src/core/stars.ts reads the per difficulty par when present and falls back to par x parScale when absent. A validator rule covers the new field.
4. The rule: s_d = Easy 0.51, Normal 0.49, Hard 0.42, Insane 0.36. Available = kill score of full waves up to the entrance, then WAVE_BUDGET_WITH_BOSS[d] of the waves over the expected fight, with geoms at V10_COLLECT_RATE, plus the guardian bonus. Expected fight seconds by guardian tier (Ryan's ruled fight lengths): tier 1 70 s, tier 2 90 s, tier 3 120 s, tier 4 150 s. Keep these as a named levelgen table, separate from BOSS_FIGHT_SEC. The levelgen copy of WAVE_BUDGET_WITH_BOSS and of the tiers is pinned by a test to src/game/bosses/table.ts (levelgen must not import src/game).
5. Generator stays deterministic and never calls the PRNG outside its seeded stream; output JSON serialisable.
6. Update scripts/par-audit.ts so it measures V14 with the tiered fight, and append a section "After V14" to docs/qa/par-audit.md with the new guardian table. Target: par / available within 0.02 of s_d at the tiered fight on levels 5 to 50, seeds 1, 1000 and 424242, all four difficulties. Leave the earlier sections of the report as they are.
7. Answer in the hand off: are stars for a finished level stored, or recomputed from the stored best score? If recomputed, say what happens to existing guardian level records under the lower par. Do not change storage.
- Tests for every pure function. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/foundry-guardian-par.md under 10 lines with known gaps, requests and every outside edit. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any, no Math.random outside src/core/rng.ts. Touch only. No new dependency. No em or en dashes. Nothing beyond this brief.
