# Glow: cylinder-fixes

Create and check out branch feat/glow-cylinder-fixes before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/levelgen/, src/audio/, src/ui/, src/input/, src/main.ts, docs/ other than your hand off
Read first: src/render/drum.ts, src/render/tiltScene.ts, the whirlpool shader module and wellNova.ts (search FLUID_, WHIRL_, haze), src/render/volume.ts and volumeView.ts, src/render/spikeSaw.ts, src/render/novaSnakeLive.ts

## Goal
Device gate G9 (build efe85c3, Ryan). Bad first: (1) "The gravity well looks much worse now: a silhouette circle with hard lines appears to represent the full area of the well. It is unnatural and needs to change." On cylinder arenas the silhouette edge shows black marks. This appeared with the recent well updates (gw6-compact haze to the pull radius, the gw4 and gw5 shader quad, or the tilt-depth well core volume). (2) Cylinder: the well shimmer (glints and motes) detaches from the well and floats on its own after the ship moves past; the nova snake white core line with shimmer detaches from the snake as the drum turns; the orbit chainsaw looks exaggerated and very large and does not stay on the drum but goes up and away. Do NOT spend effort on nova snake glints beyond making existing layers stay attached (Ryan dropped that effect: if a layer cannot be attached cheaply, remove it on the drum).

## Acceptance
- Well: no hard edged circle anywhere: the shader quad must fade to fully transparent well inside its own bounds (smoothstep falloff to 0 at least 10 percent before the quad edge, premultiplied alpha correct so no dark fringe), the haze ring fades smoothly with no visible boundary line, and no outline, volume or stroke draws at the pull radius. Nothing darker than the background anywhere in the well path (test asserting no colour under 30 percent lightness and alpha zero at the quad edge). Find the cause of the black edge on cylinder arenas (likely premultiplied blending or the quad drawn as a billboard with a dark clear) and fix it.
- Drum attachment: every layer tied to an entity or well (glints, motes, sparks, the snake core line, trails, orbit spikes and the saw chain) is placed through the drum mapping each frame from the owner's current wrapped position (surface.delta from the camera u), never from a cached flat position, so nothing drifts when the drum turns. Chainsaw on the drum: spikes and the chain line project per point through the drum (not one linearised transform at the bounds centre), scaled by the drum depth like entities, so the bar keeps its flat level size and stays on the surface. Tests: a glint at the well, a snake core point and a spike all move with their owner through a full drum rotation (screen position equals the drum mapping of the owner within 1 px); saw size on the drum within 10 percent of flat at the front.
- Keep the Standard tier fps budget. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-cylinder-fixes.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
