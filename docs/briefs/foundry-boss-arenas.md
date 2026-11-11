# Foundry: boss-arenas

Create and check out branch feat/foundry-boss-arenas before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/levelgen/, tests/levelgen/, tests/qa/ level identity pins only
Do not touch: src/game/ (Swarm changes the wave budget in parallel), src/render/, src/ui/, src/audio/, src/main.ts, src/core/, docs/ other than your hand off
Read first: src/levelgen/generator.ts (version selection, boss levels), leveldef.ts (GENERATOR_VERSION_V12), validate.ts (freePlayArenaSize, arena checks, membranes), src/levelgen/boss.ts, docs/DECISIONS.md newest rows

## Goal
Ryan's device check on ecde5b2 (2026-11-11): guardian levels after 10 are too hard on Normal; the Spindle arena (level 15) is too small to fight a guardian plus enemies. Ryan ruled: for guardian fights larger is better, more room for the chase; not every guardian level needs to grow, but Spindle must go from small to medium or large. Membrane walls (enemies slip through) are cleared for guardian arenas.

## Acceptance
- A new generator version V13 for Adventure guardian levels from 10 on (and their later loops). V1 to V12 output stays bit identical (frozen pins pass unchanged). Levels that are not guardian levels keep their current version and output.
- Guardian arenas: measure each guardian level's arena today and report it in the hand off. From level 10 on, any guardian arena smaller than the Free Play medium size of its kind grows to at least medium; Spindle levels use large. Arenas already medium or large may stay. Brood at level 5 is unchanged. Trough and drum guardian levels keep their surface; sizes stay within validator limits.
- Membranes: large guardian arenas may carry membrane walls (existing membrane rules and validator) where they leave the guardian's movement and fairness intact; never on Spindle's orbit path or across Ember's dash lanes in a way the validator rejects.
- Tests: V13 selection, sizes per guardian level, frozen pins unchanged, validator passes for 200 seeds of guardian levels 10 to 50. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/foundry-boss-arenas.md under 10 lines with the before and after size per guardian. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any, Math.random only through src/core/rng.ts. Touch only. No em or en dashes. Nothing beyond this brief.
