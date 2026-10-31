# Glow: damage-v33

Create and check out branch feat/glow-damage-v33 before any edit. Never push main.

Branch: feat/glow-damage-v33 (create and check out before any edit; never push main)
Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/audio/, src/ui/, src/input/, docs/ other than your hand off
Read first: the boss damage module under src/render/ (search bossDamage, bossCrack), src/render/bossLook.ts, src/render/bossShapes.ts, src/render/enemyFx.ts (gravity well and nova), src/render/bulletStyles.ts (style 3 blades and spikes), src/game/bosses/types.ts (PartType enum, read only)

## Goal
Device gate GW1 (build c96b397, Ryan): (a) boss damage "still unnatural black markings that do not resemble damage"; this is the third fail, so the rule is absolute: no erase blend, no scorch, no dark fill, nothing darker than the arena background drawn over or inside a boss, ever. "Consider depicting the damage using other colours and changing the shape to become incomplete from its original self." (b) Supernova: "swirls only 2 curved lines with only a few shards weakly shimmering; there is now a large circle pulsating far out from the well which is not needed. Gravity wells need to be more like a time bomb; they turn into a tornado of base white colour (similar to the Bulwark shield colour) paired with shimmers of many neon colours emanating out." (c) New parts from wave 1 still draw with generic looks.

## Acceptance
- Damage: at stage 1 the boss outline loses whole segments (about 20 percent of its perimeter, chosen by a hashed table per boss and seed) so the silhouette reads as incomplete; the remaining outline near the gaps shifts hue 25 degrees toward the boss accent colour and flickers; torn edges end in short bright stubs in the boss primary at 1.3x brightness; stage 2 removes about 40 percent and detaches one whole section of the outline that drifts 60 u and fades over 1.5 s; fragments are outline pieces in the boss colours. Fill alpha may drop but never below the body's normal fill and never toward black. A test asserts that no draw colour in the damage path has lightness under 30 percent and that no erase or multiply blend mode is used anywhere in src/render (grep style test over the source).
- Supernova: remove the outer pulsating circle. The nova is a tornado: a dense spiral of 10 to 14 white arms (hsl 0 0 95 percent base, like the Bulwark shield colour) rotating at 1.5 rad per s with a brightness pulse, a core that flares white, and 60 to 90 shimmer particles emitted outward from the core in all neon hues (cycle through at least 8 hues) at 60 to 120 u per s, fading over 2 s; the pull radius ring is a thin faint white line at exactly the sim pull radius (read it from the entity, no multiplier) with no pulse. A pure helper for arm geometry and the hue cycle with tests; budget test: at most 96 particles and one Graphics rebuild per nova per frame.
- New parts and pickups get their looks (contracts from the merged sim, read src/game/bosses/types.ts and src/game/drones.ts for exact PartType and Kind values): Hornet as a small amber dart with a buzzing jitter; Gravitant as a small violet well with the Gravitas rim; Mirror as a translucent magenta ghost of Mirage at 50 percent alpha with no fill; DronePickup as a rotating white and cyan ring glyph distinct from weapon pickups; the second drone (double mode) with the drone look plus a cyan tint; the detach decoy drone pulsing red orange so enemies visibly chase it; orbit spikes as sharp triangles in the weapon hue; while a drone mode is armed the drone shows a small mode glyph above it (H, D, R or a doubled dot) and the ship gets a thin ring in the mode colour so the arm is unmistakable. Tests for the registry covering every PartType and pickup kind.
- npm test and npm run build pass on the branch (the one accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts. Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency without declaring it in the hand off. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): one geometry buffer per layer, no per frame allocation.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build 2>&1 | tail -5` once before the commit. The generator perf test "200 levels under 350 ms" may fail in this VM because it is slower than the Mac; that single failure is accepted, note it and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-damage-v33.md (under 50 lines): what changed, files touched, tests added, test and build output summary, risks, open questions, render or event contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). Commit and push the branch. Stop.
