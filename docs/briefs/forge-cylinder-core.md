# Forge: cylinder-core

Create and check out branch feat/forge-cylinder-core before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/core/surface.ts, src/game/ except src/game/enemies/, src/game/bosses/, src/game/drones.ts, src/game/supers.ts; tests/game/ except tests/game/boss*, tests/core/
Do not touch: src/game/enemies/, src/game/bosses/, src/game/drones.ts, src/game/supers.ts, src/levelgen/, src/render/, src/audio/, src/ui/, src/input/, src/main.ts, tests/qa/, docs/ other than your hand off
Read first: src/core/surface.ts, docs/09-v2-roadmap.md lines 29 to 73 only (sections 2.1 to 2.4), src/game/world.ts, the world step in src/game/game.ts, src/game/bullets.ts, the collision and spatial hash code (search hash or grid in src/game), src/game/ship.ts

## Goal
Ryan approved the cylinder surface (D13, 2026-11-01). Phase C0 of V3-H: the simulation core. Phase C1 (next wave) has Swarm route every enemy, boss, drone and super subtraction through your accessor and Glow draw the cylinder, so your API is their contract.

## Acceptance
- surface.ts: cylinderSurface(width, height): u wraps with the docs/09 rule d = ((d + L/2) mod L + L) mod L minus L/2; v is bounded (walls at v = plus or minus H/2, the rims); toXYZ uses R = W / 2 pi, theta = 2 pi u / W, (R cos theta, v, R sin theta). makeSurface(kind, width, height). Pure, no allocation in delta and wrap.
- World: the world holds its Surface (from the level def's surface field, default flat); export surfaceOf(w): Surface and a scratch-free helper deltaTo(w, ax, ay, bx, by, out). After integration every entity, bullet, particle position the sim owns is wrapped once per step. Ship movement, bullets (player and enemy pools), collisions, pickups, gravity wells and their pull, well arrivals and snakes in src/game/enemies are NOT yours, but every file you own uses delta: no raw bx minus ax in your files. On cylinder the left and right walls do not exist (no u wall collision); top and bottom rims collide like walls. The spatial hash wraps on u (cell index modulo the cell count, neighbour queries wrap); W is a multiple of the 64 u cell on cylinder (Foundry guarantees it; assert in dev).
- Flat must stay bit identical: tests/qa snapshots and every existing replay hash unchanged with a flat surface.
- Tests: delta and wrap at the seam (both directions, exact L/2), toXYZ, ship flying across the seam five times with continuous position (no jump in delta terms), a bullet crossing the seam hits a target on the other side, spatial hash neighbours across the seam, rims collide, determinism with a cylinder world. List in the hand off every raw subtraction left in src/game/enemies, src/game/bosses, drones.ts and supers.ts (grep) for Swarm.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/forge-cylinder-core.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
