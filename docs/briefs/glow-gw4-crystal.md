# Glow: gw4-crystal

Create and check out branch feat/glow-gw4-crystal before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/audio/, src/ui/, src/input/, docs/ other than your hand off
Read first: src/render/wellNova.ts, src/render/latticeView.ts (the existing custom filter or GlProgram pattern; copy it), docs/pixi8-cheatsheet.md section 9 only, src/render/spikeSaw.ts, the nova snake look (search novaSnake or wellSpawn in src/render)

## Goal
Device gate GW4 (build a1bbf1c, Ryan): (1) whirlpool fluid look 2 of 5: "not a fluid look and feel"; "the shimmering is weak and does not resemble shimmering like a crystal or gem. Fluid plus crystal shimmer is the target look." (2) Wells do not clear when the level resets (a restart or retry still shows old wells). (3) Nova snakes: the white line shows but no shimmer. (4) Chainsaw bar reads (yes) but visual 3 of 5, and a full white backdrop behind the ship still appears while sawing.

## Acceptance
- Fluid whirlpool with a shader: render each nova well (at most 4) as one quad sized to its pull radius with a custom fragment shader (follow the latticeView pattern, PixiJS v8 GlProgram and GpuProgram if that file has both): polar domain warped flow noise (2 to 3 octaves of value or simplex noise, advected by a clockwise angular velocity that rises toward the core, plus inward radial drift), so white gas (hsl 0 0 95 percent) visibly streams, curls and shears like liquid spiralling down a drain, densest near the core and fading at the pull radius edge, with a bright core. Uniforms: time (draw clock), radius, spin, neon level through applyNeon's palette only. Keep the coloured spark motes on top. Low tier keeps the current geometry path; Standard and High use the shader. Tests: the pure flow parameter helpers (angular speed profile, clockwise sign with y down, edge fade) and a test that the shader source compiles as a string with the expected uniforms; budget: one quad per nova, no per frame allocation. Note in the hand off the expected GPU cost.
- Crystal shimmer: replace the current shimmer sparks with gem glints: small sharp 4 point star flares that pop in and out (each lives 0.15 to 0.4 s, deterministic from id and draw clock), cycling through prismatic hues with a white hot centre, plus faint rainbow refraction edges on the gas bands (thin hue shifted fringes). Use the same glint helper for nova snakes: 3 to 5 glints travelling along the snake body at any time.
- Level reset: every render side well state (nova slots, whirlpool quads, arrival telegraphs, snake trails, lattice dimples) is cleared on level start, restart and retry; find the event or hook the renderer already gets for a new level and clear there. Test that a reset leaves no well visuals.
- Chainsaw: find and remove the white backdrop behind the ship while sawing (a halo, disc or glow that fills behind the ship). Draw the bar as a glowing outline in the weapon hue along the chain line, teeth as sharp metallic triangles in the weapon hue with a white tip, a short motion blur along the chain direction (2 ghosts along the track, not rotating round the ship), and 2 to 4 sparks at the bar tip while it hits an enemy (use the existing hit event).
- Keep the Standard tier fps budget (lowest 58 to 59). npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-gw4-crystal.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
