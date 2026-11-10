# Shipwright: guide-images-96dcc2a

Create and check out branch feat/shipwright-guide-img-96dcc2a before any edit. Never push main. You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: scripts/guide-images.ts, docs/player-guide/img/shapes/, tests for the script if any exist
Do not touch: src/ (read only), docs/player-guide/README.md and docs/player-guide/img/diagrams/ (Scribe works there in parallel), every other doc except your hand off
Read first: scripts/guide-images.ts, src/render/shapeSpecs.ts, src/render/bossShapes.ts, src/ui/enemyIntro.ts (FOE_INFO, iconCanvas, specCanvas), src/levelgen/leveldef.ts (BOSS_IDS), src/render/neon.ts (BASE_PALETTE)

## Goal
The player guide images were last generated at v2.0.0 (13b7d96). The game is now at 96dcc2a with ten bosses (guardians), new enemy kinds and new pickups. Regenerate every guide image from the current shape specs and add the missing ones, so Scribe's rewritten guide can show every shape in the game.

## Acceptance
- Run node scripts/guide-images.ts. Every existing file under docs/player-guide/img/shapes/ is regenerated from current code.
- Extend scripts/guide-images.ts (only that file) so it also writes, with these exact file names (Scribe links to them without seeing your branch):
  - one image per enemy kind in FOE_INFO that has none today, named <kind lower case>.svg (for example leaver.svg)
  - one image per boss id in BOSS_IDS, named boss-<id>.svg (boss-brood.svg, boss-warden.svg, boss-spindle.svg, boss-ember.svg, boss-mirage.svg, boss-gravitas.svg, boss-bastion.svg, boss-tempest.svg, boss-twins.svg, boss-prism.svg), in the boss's own palette colour
  - _bosses.svg: one sheet of all ten bosses in level order, labelled with the boss name
  - if the code has shape specs for them: the drone pickup ring (dronepickup.svg), the nova snake (novasnake.svg), a mine and the membrane hazard (membrane.svg). If a spec does not exist, do not draw one by hand; list it in the hand off.
- _all.svg includes every enemy kind and pickup (bosses stay on their own sheet).
- Labels in the images say the shape's display name only. No game title in any image. No em or en dashes.
- Two runs of the script are byte identical (prove it in the hand off with a checksum of the folder before and after a second run).
- npm test and npm run build pass on the branch (the known flaky generator perf test aside).

## Rules
TypeScript strict, no any. No new dependency. The script only reads src; it never changes it. No Math.random.

## Hand off
Write docs/handoffs/shipwright-guide-images-96dcc2a.md: files added, changed and removed, any shape that has no spec, the determinism proof, test and build summary, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). Commit and push the branch. Stop.
