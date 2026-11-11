# Swarm: boss-calm

Create and check out branch feat/swarm-boss-calm before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/game/bosses/, src/game/ wave spawner budget only, tests/game/, tests/qa/ boss pins only
Do not touch: src/levelgen/ (Foundry changes guardian arenas in parallel), src/render/, src/ui/, src/audio/, src/main.ts, src/core/events.ts, docs/ other than your hand off
Read first: src/game/bosses/table.ts (WAVE_BUDGET_WITH_BOSS, BROOD, BROODLING), the spawner that reads WAVE_BUDGET_WITH_BOSS, src/game/difficulty.ts, docs/handoffs/swarm-fury-two.md

## Goal
Ryan's device check on ecde5b2 (2026-11-11): Brood took 22 s (body 16 s, Broodlings 6 s), rated 1, too easy; the previous build took 150 to 170 s. Guardian levels after 10 are too hard on Normal because the regular waves keep coming during the fight. Ryan ruled: regular enemies after the entrance scale by difficulty.

## Acceptance
1. Brood: body row 202 to 340, BROODLING.hp 300 to 450 (45 hits each). Note in table.ts that these bracket Ryan's two device fights.
2. Share of the wave schedule kept while a guardian lives (Adventure and Endless, every guardian): Easy 0, Normal 0.25, Hard 0.5, Insane 0.6 (today's value). One place in table.ts (WAVE_BUDGET_WITH_BOSS by difficulty). Before the entrance nothing changes. Free Play keeps its own setting.
- Tests: Brood values, budget per difficulty, no regular spawns on Easy after the entrance. Update pins only where these changes explain them, named in the hand off. Normal difficulty pins that move because of item 2 are expected (Ryan ruling).
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/swarm-boss-calm.md under 6 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any, no Math.random. Touch only. No em or en dashes. Nothing beyond this brief.
