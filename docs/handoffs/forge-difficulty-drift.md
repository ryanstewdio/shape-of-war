# Forge hand off: difficulty-drift

Branch: feat/forge-difficulty-drift. Session: https://claude.ai/code/session_018Gwqi6RvY2WGqpGqrMUGqP

## What changed
- Difficulty: `GameOptions.difficulty` (default normal) is stored as `World.difficulty`; `difficultyOf(w)` returns its table. Applied to enemy move speed (`enemySpeedScale`), enemy hit points (`spawnFromDef`, hostile kinds only, rounded, at least 1), wave spawn counts (round, at least 1 when the wave has 1; extra spawns repeat the wave's entries in order, each pass 0.35 s later) and starting lives (level lives plus extraLives, at least 1). Normal multiplies by 1 and adds 0, so tests/qa snapshots and replay hashes are unchanged.
- Open drum drift (`src/game/drift.ts`): cylinder levels with no obstacles shift every live entity and the ship (while in play) along u at 40 u/s, bursting to 160 u/s. Each burst ramps in over 0.3 s, holds 160 for 1.2 s, ramps out over 0.3 s. Bursts start 9 to 14 s apart (start to start), gaps and the fixed direction hashed from the level seed with hash01. Player and enemy bullets do not drift.
- Membranes (`src/game/membrane.ts`): an obstacle with `membrane: true` stays a wall for every `confineOn` caller (ship, player bullets, enemy bullets, bosses, drones). Enemy moves through `moveTo`, `moveToHit` and `driftEntity` ignore it and move at 35 percent while their circle overlaps it. Levels with no membrane never reach this code.

## Files touched
src/game/difficulty.ts (stub body replaced), drift.ts (new), membrane.ts (new), arena.ts (optional `passMembrane` on confine and confineOn, `overlapsMembrane`), world.ts, state.ts, spawner.ts, steer.ts, game.ts. Tests: tests/game/difficulty.test.ts, drift.test.ts, membrane.test.ts; cylinder.test.ts and feel.test.ts switch drift off in two ship speed tests (they remove obstacles from drum levels, which makes them open drums).

## Tests added
difficulty 10, drift 12, membrane 8 (30 total): drift speed and profile, burst timing, ship counters at full stick, determinism, telegraph; ship blocked, bullet blocked, grunt crosses slowly (also across the u seam), solid bar still blocks, no membrane levels unchanged.

## Test and build
npm test: 3978 passed, 1 failed (accepted: generator "200 levels under 350 ms", VM speed). npm run build: pass. Legacy Pixi grep: empty.

## Contracts for other roles
- Ledger: pass `createGame(level, { difficulty })` and `createEndlessGame(def, src, { difficulty })`. Type `Difficulty` from src/core/difficulty.ts.
- Swarm: `difficultyOf(w).bossScale` for bosses. Boss adds spawned through spawnFromDef already get the enemyHp scale; boss kinds do not.
- Glow and Chorus: telegraph is the existing bus event `sfx` `'spawn'` (the telegraph cue), emitted once 0.6 s before each burst ramp. No new event. Live state for render: `w.drift.active`, `w.drift.dir`, `w.drift.speed` (u/s), `w.drift.burstAt` (sim time of the next ramp start).
- Glow: membranes are `Obstacle.membrane === true`; draw them distinct from walls.

## Risks
- Drift reuses the spawn telegraph sound; a dedicated cue would need a new event in src/core/events.ts (Request below).
- Sower wall hugging probes and Blink teleport checks still treat membranes as walls (they use confineOn and isInsideOn directly); they still cross via moveTo, just do not aim for gaps.
- Hard repeats wave entries at the same fixed points 0.35 s apart; separation pushes them apart.

## Requests
Optional: a `sim:drift` { dir, speed, inSec } event in src/core/events.ts if Chorus wants a distinct burst cue.

## Device check for Ryan
1. Open the game, pick an open drum level (a cylinder with no walls). Stand still: the ship and every enemy slide slowly sideways the same way.
2. Wait about 10 seconds: you hear the spawn chime, then everything slides about four times faster for just over a second. Push the move stick fully the other way: the ship still makes headway.
3. Play a ring level with a membrane gap once Foundry and Glow land: your ship and shots stop at it, enemies ooze through slowly.
4. Once Ledger lands the setting: Easy gives 2 extra lives and slower, softer enemies; Hard gives 1 fewer life and more, faster, tougher enemies.
