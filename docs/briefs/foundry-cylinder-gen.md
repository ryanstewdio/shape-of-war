# Foundry: cylinder-gen

Create and check out branch feat/foundry-cylinder-gen before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/levelgen/, tests/levelgen/, tests/qa/levelSnapshots.test.ts (only the surface expectations)
Do not touch: src/core/, src/game/, src/render/, src/audio/, src/ui/, src/input/, src/main.ts, docs/ other than your hand off
Read first: docs/09-v2-roadmap.md lines 74 to 86 only (section 2.5), src/levelgen/leveldef.ts (surface field, GenConfig, versions, validator), src/levelgen/generator.ts (where surface is set to flat), tests/levelgen/surfaceV2.test.ts, src/core/surface.ts (SurfaceKind now includes cylinder)

## Goal
Ryan approved the cylinder surface (D13). Phase C0: the generator chooses cylinder levels. Forge builds the cylinder simulation in parallel; Glow and Swarm follow in C1.

## Acceptance
- The surface is drawn from a separate stream, mulberry32(deriveSeed(seed, SURFACE_SALT)), after the existing draw sequence completes, so every flat level keeps its exact LevelDef and hash. GenConfig.enableCylinder (default true; false is byte identical to today for every seed). Weights: levels 1 to 10 flat only; levels 11 and up, non boss levels: cylinder 35 percent, flat 65 percent; boss levels always flat; Endless segments stay flat.
- A cylinder level forces arena.shape to rect or rectObstacles and adjusts width deterministically to a multiple of 64 u (round to nearest, within the existing size bounds); gravity wells, spawners and spawn rings are placed with wrapped distances (place in [0, W) and canonicalise to the arena range; no left or right walls exist, so the margin rule applies only to the rims).
- Validator: accepts cylinder with those constraints, still rejects every other non flat value. Bump the generator version only for cylinder levels if the existing versioning allows (follow the boss level pattern, GENERATOR_VERSION_V3 on boss levels only), and say what you chose.
- Tests: flat levels byte identical to main for 2000 seeds by levels; enableCylinder false identical; share of cylinder among levels 11 to 60 near 35 percent; boss levels flat; widths multiples of 64; validator cases. Update tests/qa/levelSnapshots.test.ts only where a pinned level became cylinder, and list each in the hand off. Report one seed and level that is cylinder (for example seed 42) so Ryan can open it.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/foundry-cylinder-gen.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
