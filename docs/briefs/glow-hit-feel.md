# Glow: hit-feel

Create and check out branch feat/glow-hit-feel before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/ui/, src/audio/, src/main.ts, src/levelgen/, docs/ other than your hand off
Read first: docs/handoffs/glow-fury-two.md, src/render/bossHitFury.ts, src/render/bossDamage.ts (cracks), src/game/bosses/view.ts (hp, maxHp, hitT)

## Goal
Ryan's device check on ecde5b2 (2026-11-11): in a busy fight he still cannot tell a hit landed. He picked: a stronger flash with larger sparks, and cracks that glow brighter as health drops.

## Acceptance
- Landed hit: a clearly stronger white flash on the guardian body (fill and outline, glow up) and sparks about twice as large and a little longer lived; the flash rate cap stays so heavy fire never turns the body solid white. Blocked hits unchanged (one grey spark).
- Crack glow: the existing cracks glow brighter and thicker as hp over maxHp falls (dim at full health, bright near the end), and pulse once on each landed hit. Works for every guardian and for split parts where cracks exist.
- Colours through the palette and applyNeon only, Pixi v8 only, no PRNG, no allocation per frame. Warden fury look unchanged apart from the shared hit flash. Tests for the pure helpers. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-hit-feel.md under 6 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
