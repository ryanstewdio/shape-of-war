# Ledger: split-refill

Create and check out branch feat/ledger-split-refill before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/ui/, src/main.ts (boss bar wiring only), tests/ui/
Do not touch: src/game/, src/core/, src/render/, src/audio/, docs/ other than your hand off
Read first: docs/handoffs/ledger-bar-fix.md, src/ui/hud.ts (setBoss, setBossBar, paintBossStrips), src/ui/boss.ts (bossGate), src/game/bosses/bar.ts, src/main.ts (emitHud)

## Goal
Ryan's device check on 1580146 (2026-11-11): when Brood splits, the bar does not refill. The Broodlings' own Shield and Health bars must start full (bossBar returns shield 1, health 1, label "Broodlings" at the split; Swarm confirms that in parallel).

## Acceptance
- Find the cause (likely a guard against bars jumping back up, a stale fallback from hud:boss, or the feed stopping when the body is gone) and fix it so the bar refills to full the moment the Broodlings appear and then drains with them; no other bar may jump up. Brood's name switches to "Broodlings" at the same moment.
- The dev fight line is easy to miss: also show it as the HUD toast in Adventure for 6 s at the kill (dev builds only).
- Tests: refill at the split, no upward jump otherwise, label switch. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-split-refill.md under 6 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
