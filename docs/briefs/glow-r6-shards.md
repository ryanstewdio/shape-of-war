# Glow: r6-shards

Create and check out branch feat/glow-r6-shards before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/render/, tests/render/
Do not touch: everything else
Read first: src/render/leaverLook.ts, the crystal glint helper (search glint in src/render)

## Goal
Leaver check (Ryan): the shards split correctly but are "not shimmering".

## Acceptance
- Shards shimmer unmistakably: each shard keeps its solid colour but gets a bright moving highlight band that sweeps across it every 0.6 s, 1 or 2 crystal glints (the existing helper) popping on its corners, and a 15 percent brightness pulse at 6 Hz, offset per shard so a group sparkles. Through the palette and applyNeon only. Tests for the timing helpers. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/glow-r6-shards.md under 25 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. PixiJS v8 only. No em or en dashes.
