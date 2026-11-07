# Ledger: boss-goal

Create and check out branch feat/ledger-boss-goal before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/ui/ (intro, HUD objective bar and goal text, results, How to boss lines), tests/ui/
Do not touch: src/levelgen/ (Foundry), src/game/ (Forge), src/render/ (Glow), src/audio/ (Chorus), src/core/, docs/ other than your hand off
Read first: src/game/objective.ts (evaluateObjective: on a boss level the boss kill wins and only losing every life loses; the regular objective does nothing), src/levelgen/leveldef.ts (BossSpec.atSec, LevelDef.boss), src/ui/intro.ts, src/ui/results.ts, the HUD objective bar

## Goal
Tester 3: "boss level requirements are redundant. On level 5 the goal is to kill like 300 enemies but killing the boss without meeting the requirement results in victory." Ryan chose: Survive, then beat the boss.

## Acceptance
- On any level with level.boss (Adventure, every difficulty): the intro goal line reads "Survive until <Boss name> arrives, then defeat it" with the arrival clock (boss.atSec as m:ss). No kill or score count is shown.
- HUD objective bar on a boss level: before the entrance it fills with time toward boss.atSec, label "BOSS IN m:ss"; from the entrance it shows the boss health draining, label the boss name. Non boss levels unchanged.
- Results on a boss level: success line "<Boss name> defeated"; failure line unchanged (out of lives). Stars and par unchanged.
- How to: if a page states the boss level goal, align it with the above; otherwise no change.
- Endless and Free Play unchanged.
- Tests: intro text, bar phase before and after atSec, results line, non boss level unchanged. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-boss-goal.md under 15 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. applyNeon(n) only. Pixel font for headlines as today. No em or en dashes.
