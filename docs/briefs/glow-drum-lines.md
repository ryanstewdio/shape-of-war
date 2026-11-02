# Glow: drum-lines

Create and check out branch feat/glow-drum-lines before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/levelgen/, src/audio/, src/ui/, src/input/, src/main.ts, docs/ other than your hand off
Read first: src/render/drumPen.ts (the owner based pen from cylinder-fixes), src/render/tiltScene.ts, the charger telegraph code in src/render/renderer.ts (search chargerChevrons, chargerLaneAlpha, chargerStreak), then other free form line effects by search (enemy fx, wall flashes, shock rings, blink and swirl markers, drone glyphs)

## Goal
Device gate G10 (build d6ea6a5, Ryan): the well edge, shimmer, snake line and saw all pass on the drum; whirlpool 4; lowest fps 57 on cylinder level 17 with a nova (budget 58 to 59). New bug: "when a charger lines up its attack path and I move the ship, which turns the cylinder, the orange attack paths leave the cylinder and bug out, going many different directions, and generally failing to execute." Cause expected: charger lanes, chevrons and streaks are still drawn through the one linearised transform per Graphics.

## Acceptance
- Every remaining free form line effect on the drum goes through drumPen with the right owner, sampled along its length (a lane is a line on the surface: sample it every 24 u from the charger along its dash direction using surface.delta and project each sample, so it bends round the drum and follows it as it turns): charger lanes, chevrons and streaks, Bulwark shield arcs, blink and swirl markers, shock rings (sampled circle on the surface), wall flashes, drone glyphs, enemy hit flashes and deflect arcs, and anything else you find that still uses the shared linearised path. After this the linearised path is only used for layers that are provably local (say which in the hand off). Tests: a charger lane drawn on the drum matches the drum mapping of its sample points within 1 px through a full drum rotation; a shock ring stays centred on its owner.
- Cylinder fps back to the 58 to 59 budget: profile the drum path in the headless proxy and remove per frame waste (cache drumProject of static obstacle outlines per camera u bucket, skip back half points below 5 percent alpha, reuse scratch arrays). Report before and after proxy numbers.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-drum-lines.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
