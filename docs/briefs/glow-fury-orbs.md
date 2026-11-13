# Glow: fury-orbs

Create and check out branch feat/glow-fury-orbs before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/ui/, src/audio/, src/main.ts, docs/ other than your hand off
Read first: docs/handoffs/glow-fury-tune.md, src/render/renderer.ts (retiredContexts and every place that pushes to it: rebuildShapeContexts in the neon shapes hook, bossBodyContext dmgCtx, furyContext, broodlingContext; the views pool, bossBodyView, ghostView, echoView, dashGhosts; the pool halo near stepPoolHalo), hazardFx.ts, furyFixes.ts, furyTune.ts, src/game/bosses/types.ts (HazardType.Orb), table.ts (GRAVITAS_ORB), docs/pixi8-cheatsheet.md

## Goal
1. A crash on Ryan's device, twice: "Uncaught TypeError: Cannot read properties of null (reading 'length')". Morpheus mapped it with the build's source map to pixi.js lib/scene/graphics/shared/utils/buildContextBatches.mjs line 30 (context.instructions.length): a Graphics is rendered or rebuilt with a GraphicsContext the renderer already destroyed (destroy nulls instructions). Seen after guardian fights (once in Free Play with guardians on), never on a fresh launch. The renderer destroys retired contexts at the end of the frame (retiredContexts) but only the views it draws that frame get the new context; pooled or hidden views, the boss body view, the Mirage double image (echoView borrows the body context) and the ghosts can keep a destroyed one.
2. Ryan's rulings on 2026-11-13: Gravitas launches pool orbs toward the ship (Swarm builds the sim in parallel); the pool halo on the ship was not seen and must show after the split too.

## Acceptance
1. Context guard: no Graphics may hold a GraphicsContext after it is destroyed. Before destroying the retired contexts, move every Graphics that still holds one (the views pool, bossBodyView, ghostView, echoView, dashGhosts and any other holder you find) onto a shared empty context or its current context; or defer the destroy until no holder remains. One rule covering every retire path, not a fix per view. A test proves a retired context is never left attached to any holder (pure helper or a light mock of the holders), and the reason is written in a comment at the guard.
2. Orb: Kind.BossHazard with w.a 6 (HazardType.Orb) draws as a small bright violet orb with a short trail along w.rot, never in a telegraph or lethal form; where it stops a pool appears (the existing pool look).
3. Pool halo: the ship's violet halo shows whenever view.shipInPool is true, including after the stage 2 split (when view.active is false while the bar lives), and reads clearly brighter than today. Low keeps it readable at lower cost.
- Warden, Spindle, Ember, Brood and Mirage looks unchanged. Colours through the palette and applyNeon only, Pixi v8 only, no PRNG, no image files, no allocation per frame. Tests for the pure helpers. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-fury-orbs.md under 8 lines: the holders found, what to verify on a device. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
