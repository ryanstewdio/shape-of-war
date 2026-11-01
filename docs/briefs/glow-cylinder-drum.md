# Glow: cylinder-drum

Create and check out branch feat/glow-cylinder-drum before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/levelgen/, src/audio/, src/ui/, src/input/, src/main.ts, docs/ other than your hand off
Read first: docs/handoffs/forge-cylinder-core.md (surfaceOf, delta, toXYZ, seam notes), src/core/surface.ts, src/render/project.ts, src/render/tiltScene.ts, src/render/tiltGeom.ts, src/render/latticeView.ts, then renderer.ts by search

## Goal
Cylinder phase C1 (D13). Levels with surface cylinder wrap u (period = arena width, centred on 0, rims at v = plus or minus H/2, no side walls). Draw them as a neon drum. Screen axes stay the arena axes (screen right is plus u at the front, screen up is v), so input does not change.

## Acceptance
- Drum view: the camera centre u follows the ship's u with exponential smoothing (time constant 0.12 s, the short way through delta), so the ship stays near the horizontal centre of the front face. A point at u maps to angle phi = 2 pi (u minus camU) / W around the drum axis (vertical, along v); screen x = R sin phi scaled so the front face fills the screen width, depth = R (1 minus cos phi) feeds the existing projection (perspective and the tilt setting, if on). The front half (abs(phi) up to 90 deg) draws normally; the back half draws through the glass at 25 percent alpha, smaller by perspective and mirrored, behind the front, so enemies behind the drum stay visible. Rims draw as glowing ellipses top and bottom; the lattice wraps around the drum (u lines become vertical lines whose spacing compresses toward the edges, v rings become ellipses).
- Everything projects through this: lattice, rims, obstacles, entities and their scale by depth, bullets, particles, trails (interpolate with surface.delta, never across the seam the long way), boss hazards (boss levels are flat anyway), whirlpool quads, glints, HUD stays flat. Flat levels take the existing path untouched.
- Tests: phi and screen x mapping (front centre, edges, back), camera follows the short way across the seam with smoothing, a trail crossing the seam has no long segment, flat path unchanged for a recorded frame, back half alpha. Keep the Standard tier fps budget; no per frame allocation.
- Report one cylinder seed and level (Foundry: seed 42 level 16 or 17 is a cylinder) in the device check. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-cylinder-drum.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
