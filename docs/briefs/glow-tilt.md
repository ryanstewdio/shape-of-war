# Glow: tilt

Create and check out branch feat/glow-tilt before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/audio/, src/ui/, src/input/, src/main.ts, docs/ other than your hand off
Read first: docs/12-v3-plan.md lines 1626 to 1700 only (Wave V3-G design and the G0 and G1 briefs: you do both stages in this one session), docs/pixi8-cheatsheet.md (sections on Graphics, containers and the lattice notes), src/render/tilt.ts (the contract stub: setTilt, getTilt, TiltLevel; keep those names and signatures), src/render/lattice/, src/render/layout.ts, src/render/gridGeom.ts, then renderer.ts by search

## Goal
Ryan said go (D12) for the render only 3D tilt of the arena. Nothing in src/game, src/gen, src/input or src/audio changes. PixiJS v8 stays.

## Acceptance
- Do the G0 spike work first in this session (project.ts with the pure project and fit helpers, read the PerspectiveMesh types) and pick a route; default to Route A (CPU projection, crisp shapes) unless the types show it cannot work, and say why in the hand off. Then do the G1 build: lattice z channel (kills lift, wells funnel down, shocks ripple in depth, bounded, rest at rest), projection of lattice, walls, obstacles, entities (position and scale by depth, not rotated), bullets, particles, geoms, boss hazards, the Prism shimmer and the whirlpool shader quads; HUD, sticks and buttons are not projected. setTilt and getTilt from src/render/tilt.ts drive it: off takes the existing path untouched; low 12 deg, high 22 deg; the whole arena stays visible on both screens (fit from projected bounds).
- applyNeon stays the only writer of glow width and grid base alpha; depth may scale lattice line alpha as a multiplier only.
- Tests from the docs/12 briefs: tilt 0 identity, known points at 12 and 22 deg, fit keeps the whole arena inside the safe rect for the 1600 x 1000 Endless arena and an 1800 x 1100 level on both aspect classes, no NaN at the extremes, monotonic depth, z channel at rest, decay and bounded under 20 s of fuzzed impulses, off equals the current positions for a recorded frame. Cost: no per frame allocation, no per frame Graphics.clear for lattice lines; report a projection timing proxy for 8192 nodes.
- Put the cheatsheet section text for the route in your hand off (do not edit the cheatsheet). npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-tilt.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
