# Glow: r7-blink

Create and check out branch feat/glow-r7-blink before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/render/leaverLook.ts and tests/render/leaverLook*.test.ts only
Do not touch: everything else
Read first: src/render/leaverLook.ts

## Goal
Gate R6 (Ryan): shard shimmer 3.5, "barely visible; shimmer is not critical. They could blink with varying opacity or a pulsating neon level."

## Acceptance
- Replace the subtle shimmer with a clear pulse: each shard's alpha swings between 0.45 and 1.0 and its glow width between 0.6x and 1.4x on a 0.5 s sine, phase offset per shard so a group ripples; the last 0.15 s of the 0.5 s hold after the split flashes white once before the chase. Through the palette and applyNeon. Tests for the pulse helper ranges and offsets. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/glow-r7-blink.md under 20 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. PixiJS v8 only. No em or en dashes.
