# Forge: gw2-wells

Create and check out branch feat/forge-gw2-wells before any edit. Never push main.

Model: opus
Owned paths: src/game/ except src/game/bosses/, src/core/ (events.ts: emit only, do not change the existing contract types), tests/game/ except tests/game/boss*
Do not touch: src/game/bosses/, src/render/, src/audio/, src/ui/, src/input/, src/gen/, tests/qa/, docs/ other than your hand off
Read first: src/game/enemies/gravitywell.ts, src/game/enemies/snake.ts, src/game/spawner.ts, src/game/weapons.ts (orbit v2, saw level), src/core/events.ts (sim:wellArrive, sim:saw)

## Goal
Device gate GW2 (build cbd5a4d, Ryan). (1) Nova snakes were never seen on device, though tests/game/wellSnakes.test.ts passes. (2) "Wells should also appear over time; currently wells only appear with the start of the level." (3) Orbit v2 feel rated 2 of 5.

## Acceptance
- Snakes: find why they do not appear in real play. Write a test that builds real generated levels with wells (the V2 generator config, levels where the spec has a well), runs the real step loop with a scripted idle ship until a nova plus 4 s, and asserts a snake head is live. Likely causes to check: the nova ends or the well explodes before 3 s, maxLiveEnemies or snake slots are already full in busy levels, the well that novas is not in wellIds after compaction (wellAge and wellNova are not compacted with wellIds: fix that quirk), or emergence only runs on a path that real levels skip. Fix the cause; if slots are the limit, reserve one snake slot per novaing well. Emit sim:wellSpawn as today.
- Wells over time: on levels whose spec has at least one Gravity well, more wells arrive during play: the first 20 to 30 s after level start, then every 25 to 35 s (times hashed from the level seed and arrival index, no PRNG), at a hashed position at least 300 u from the ship and 250 u from other wells and inside the arena margin; live wells capped at the spec well count plus 2 and at most 4, and the docs/13 hazard cap of 8 still holds. No arrivals while a boss is alive, during respawn, or in Endless. Emit sim:wellArrive { id, x, y, inSec: 1.5 } at telegraph start and create the well 1.5 s later (the ship can never be inside it at creation: re-hash the position if needed). Tests: timing, spacing, caps, boss and Endless off, determinism (two runs hash equal).
- Orbit feel: emit sim:saw { on: true } when the saw level leaves 0 and { on: false } when it returns to 0. While saw level is above 0.5 the spikes deal 1.5x damage and the hit cooldown drops 30 percent; keep resting behaviour unchanged. Tests for both.
- Level snapshots in tests/qa unchanged (no generator change). npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/forge-gw2-wells.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
