# Shipwright: guide-images-1c52828

Create and check out branch feat/shipwright-guide-img-1c52828 before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: scripts/guide-images.ts, docs/player-guide/img/shapes/
Do not touch: src/, tests/, docs/player-guide/README.md (Scribe updates it in parallel), every other doc except your hand off

## Goal
The player guide images were last generated at 96dcc2a. Since then src/render/bossShapes.ts and other render files changed (main is now 1c52828). Refresh the images so they match the code.

## Acceptance
- Run `node scripts/guide-images.ts`. If a Kind or a guardian exists that the script misses, extend scripts/guide-images.ts only.
- Prove two runs are byte identical.
- npm test and npm run build pass on the branch.
- Hand off at docs/handoffs/shipwright-guide-images-1c52828.md under 10 lines: image files added, changed and removed (or "no image changed"). Commit and push the branch even when no image changed, so the hand off lands. Stop.

## Rules
No em or en dashes in any file you write. No new dependency. Nothing beyond this brief.
