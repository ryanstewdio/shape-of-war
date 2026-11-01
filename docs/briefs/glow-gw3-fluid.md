# Glow: gw3-fluid

Create and check out branch feat/glow-gw3-fluid before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/audio/, src/ui/, src/input/, docs/ other than your hand off
Read first: src/render/wellNova.ts, src/render/spikeSaw.ts, src/render/partLooks.ts, the snake look (search SnakeHead in src/render), src/game/bosses/types.ts (PartType.Tempestling, read only)

## Goal
Device gate GW3 (build 675f6c3, Ryan): the whirlpool passed, but "gravity wells need more white gas filling the area between the lines that are swirling out from the centre, and more fluid dynamics in respect to the rotational direction; wells are currently too rigid and non fluid, which is unnatural compared to a realistic gravity well". Also: split Tempests draw as pods (no Tempestling look); nova snakes look the same as normal snakes. Forge is turning the orbit chainsaw into a bar that bends out toward the aim in this wave (spike positions and vx, vy as track tangents come from the sim; spikeLen 24 to 40).

## Acceptance
- Fluid whirlpool: fill the space between the spiral bands with soft white gas (layered translucent filled spiral sectors or a ring of overlapping soft sprites, white hsl 0 0 95 percent, alpha 0.10 to 0.25, denser toward the core) so the pull area reads as a disc of gas, not lines. Make the flow fluid: differential rotation (angular speed rising smoothly toward the core), bands that wobble and shear over time (low frequency deterministic noise on band radius and phase, keyed by well id and draw clock, no PRNG), wisps that peel off the band edges and get dragged along the flow and stretched, and motes that follow streamlines with slight turbulence. Still clockwise on screen and inward; keep the coloured sparks. Budget: at most 96 particles plus at most 3 gas layers per nova, one Graphics rebuild per nova per frame, no per frame allocation. Tests for the noise and shear helpers (deterministic, bounded), clockwise and inward still asserted.
- Chainsaw teeth: draw each orbit spike as a tooth oriented along its vx, vy (track tangent) with length spikeLen, and while the saw level is above 0 draw a faint bright chain line through consecutive teeth of each ring (sorted by phase) so the bar outline reads; keep the white edge and remove any full white backdrop behind the ship.
- Tempestling (PartType.Tempestling): a smaller Tempest look (same storm colours, 60 percent size, faster swirl, a bright leading edge in its move direction).
- Nova snakes: snakes that emerged from a well (track ids from sim:wellSpawn) get a white core line and a faint shimmer along the body for their whole life so they read as different from normal snakes.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-gw3-fluid.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
