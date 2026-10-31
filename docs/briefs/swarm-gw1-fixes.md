# Swarm: gw1-fixes

Create and check out branch feat/swarm-gw1-fixes before any edit. Never push main.

Branch: feat/swarm-gw1-fixes (create and check out before any edit; never push main)
Model: opus
Owned paths: src/game/, src/core/events.ts (one new event), tests/game/, tests/qa/ (only tests this change forces; list each)
Do not touch: src/render/, src/audio/, src/ui/, src/input/
Read first: src/game/bosses/warden.ts, src/game/bosses/core.ts (spawnHornet, add cap), src/game/weapons.ts (orbit), src/game/enemies/gravitywell.ts (nova), src/game/enemies/snake.ts or wherever Snake spawns live, src/game/spawner.ts

## Goal
Device gate GW1 (build c96b397, Ryan): (a) Warden "no swarm released, no clear window, fairness 5, too easy": the shield and hornet ability did not show on the device. (b) Orbit "shield does not work very well: change to 2 sets of spikes that circle the ship in opposite directions; shooting in a direction elongates the spikes into a chainsaw like shape." (c) Gravity wells must be a time bomb: after the supernova, snakes start emerging from the well after 3 to 4 seconds "to increase the threat and challenge".

## Acceptance
- Warden: find why the shield did not trigger (phase 2 only, cycle clock, add cap leaving zero slots, fight ending first) and fix so the first shield fires 10 s into the fight and every 14 s after, in every phase; hornets have their own cap of 8 that does not depend on the add slots (reserve them or count them separately, parts are a separate pool), 2 bursts of 4; the window after the shield is 2.5 s with the core exposed; Warden hit points up 20 percent and ring cadence 10 percent faster so fairness lands around 4 not 5. Tests: shield fires at 10 s and every 14 s in a 60 s sim regardless of add pressure, 8 hornets live after the second burst, the window opens, determinism.
- Orbit v2: two rings of spikes (4 each) orbiting the ship in opposite directions at 80 u and 100 u; no shield push; when the aim stick is held past the dead zone, spikes on the aim side (within 60 degrees of the aim) stretch along their orbit tangent to 2.5x length over 0.25 s and back, forming a chainsaw arc that hits every enemy along its length (hit test as a capsule, deterministic); damage per hit as a blade. The pair weapons that include orbit (Halo, Whirl, Eclipse) inherit the two ring, chainsaw behaviour. Keep style 3 bullets for the render contract; expose spike length in the bullet pool (reuse an existing per bullet field or add one typed array; document for Glow). Tests: two counter rotating rings, chainsaw stretch on aim, capsule hit, pair inheritance, determinism.
- Nova snakes: 3.5 s after a well enters nova (hashed 3 to 4 s), a Snake emerges from the well every 6 s (head at the well, body following), up to 2 snakes live per well and within the existing snake and entity caps; snakes die normally; the well explosion kills its snakes; emit bus 'sim:wellSpawn' { id, x, y, kind } once per emergence (declare in src/core/events.ts). Endless v1 rule "no wells in Endless" unchanged. Tests: timing, cap, cleanup on explosion, determinism, level snapshots unchanged.
- npm test and npm run build pass on the branch (the one accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts. Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency without declaring it in the hand off. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): one geometry buffer per layer, no per frame allocation.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build 2>&1 | tail -5` once before the commit. The generator perf test "200 levels under 350 ms" may fail in this VM because it is slower than the Mac; that single failure is accepted, note it and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/swarm-gw1-fixes.md (under 50 lines): what changed, files touched, tests added, test and build output summary, risks, open questions, render or event contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
