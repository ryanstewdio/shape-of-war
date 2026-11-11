# Swarm: boss-health

Create and check out branch feat/swarm-boss-health before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/game/bosses/ (including bar.ts, replace the stub body), src/game/combat.ts (pierce multiplier on guardians only), tests/game/, tests/qa/ boss pins that move because of this change
Do not touch: src/ui/ and src/main.ts (Ledger draws the bar in parallel from bossBar), src/render/, src/levelgen/, src/audio/, docs/ other than your hand off
Read first: src/game/bosses/bar.ts (Morpheus stub: BossBar, SHIELD_SHARE, bossBar), src/game/bosses/table.ts (hit points), src/game/bosses/core.ts (CRACK_AT, crack events, applyBossScaling), src/game/bosses/brood.ts (split into Broodlings), tests/qa/bossFairnessSweep (an existing bot harness), src/game/combat.ts

## Goal
Ryan's device check (2026-11-11): Brood took almost 5 minutes to beat because of its large health, and its bar dropped from about 40 percent to 5 percent when it split. Guardian health needs a review across all guardians. He ruled: fight length for an average player on Normal ramps from about 60 to 75 s (tier 1: Brood, Warden, Spindle) to about 90 s (tier 2), about 2 min (tier 3) and about 2.5 min (Prism); Easy shorter and Hard and Insane longer through the existing bossScale; Pierce does 1.5x damage to guardians and their parts; every guardian's health shows as two stacked bars, a blue Shield bar first (the guardian cracks when it empties) and then a red Health bar; Brood empties both, then splits into Broodlings that have their own Shield and Health bars under a "Broodlings" label.

## Acceptance
- Measure first: with the existing bot harness (or a simple deterministic bot that keeps the core in its sights and uses the default weapon), report time to kill per guardian at Normal before the change.
- Retune guardian hit points (table values, one place) to hit the targets above at Normal; keep relative difficulty between guardians; Adventure first fight discount (0.75 at level 5) kept. Report before and after times per guardian at Easy, Normal and Insane.
- Pierce: 1.5x damage against guardian bodies, cores and parts (not against regular enemies); one named constant.
- Shield and Health: implement bossBar for real. The shield is the first SHIELD_SHARE of hit points (you may set a per guardian share); the first crack (sim:bossCrack stage 1) fires when the shield empties; stage 2 keeps its meaning inside the health bar. Brood: both bars belong to the body; when both empty Brood splits, and bossBar then reports the Broodlings as a group with their own shield and health, label "Broodlings", reaching 0 only when the last Broodling falls. No bar ever jumps by more than one hit's worth.
- Deterministic; Adventure non boss levels, Endless enemies and Free Play rules unchanged except guardian health.
- Tests: bossBar fills at key points for every guardian, Brood and Broodlings bars, no jumps, pierce multiplier, measured fight lengths inside the target bands (allow 20 percent). npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/swarm-boss-health.md under 20 lines with the before and after table. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Deterministic simulation. No em or en dashes.
