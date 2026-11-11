# Ledger: boss-bar

Create and check out branch feat/ledger-boss-bar before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/ui/hud.ts, src/ui/hudFrame.ts, src/ui/objective.ts (boss bar only), src/main.ts (boss bar wiring only), tests/ui/
Do not touch: src/game/ (Swarm replaces the bossBar body in parallel; the signature in src/game/bosses/bar.ts is fixed), src/render/, src/levelgen/, docs/ other than your hand off
Read first: src/game/bosses/bar.ts (BossBar { shield, health, label }), src/ui/objective.ts (bossObjectiveProgress), src/ui/hud.ts (objective bar), src/main.ts (emitHud passes hpFraction today)

## Goal
Ryan ruled 2026-11-11: during a guardian fight the HUD bar shows two stacked bars inside it: a blue Shield bar on top that empties first, then a red Health bar; the label is the guardian's name, or "Broodlings" when bossBar says so.

## Acceptance
- main.ts passes bossBar(readBoss(...)) to the objective progress instead of a single hpFraction; the "BOSS IN m:ss" phase before the entrance is unchanged.
- The bar during the fight: two thin stacked fills inside the existing frame, Shield in a blue from the palette above Health in red, each emptying left to right; when the shield is gone its strip dims; colours through the palette and applyNeon only. Label from BossBar.label or the guardian name. Readable on the Fold 7 cover and inner screens and a 360 px wide phone.
- Tests: bar text and fills from a BossBar, Broodlings label, entrance phase unchanged. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-boss-bar.md under 8 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes.
