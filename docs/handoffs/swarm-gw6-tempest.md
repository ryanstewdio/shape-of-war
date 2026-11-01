# Hand off: swarm gw6-tempest

Branch feat/swarm-gw6-tempest. Session: https://claude.ai/code/session_018Gwqi4JvHcfhgzuFKx3YPj

## What changed (Tempestlings only; the big Tempest body and Bastion untouched)
- Lead aim: each dash aims at the ship's predicted position (ship plus velocity times the dash travel time and the wind up left, clamped to the arena). The aim and its lane marker track the ship through the wind up, and the line locks at the end of the wind up. Wind up is 0.5 s (was 0.7).
- The pincer: slot 1 flanks a quarter turn from slot 0 (not opposite). In a pincer it aims 80 u across slot 0's line, on the side the ship is sidestepping to (its own side when the ship is not moving sideways). A sidestep out of one dash now runs into the other.
- Dash lines are clipped so the body edge ends at least 60 u from any wall or obstacle. After a dash the part turns to face the ship within 0.2 s.
- Unstuck rule: if a part is within 140 u of a wall or obstacle for 1.0 s, or moves under 40 u in a 1.0 s chase window, it steers toward the arena centre for 0.6 s. It starts no wind up while doing this. Inside the 150 u wall band the chase also heads toward the centre now, instead of taking the nearest way out.
- Root cause of "get stuck sometimes": positions are float32. A part sitting exactly on the band edge got exit moves of about 1e-6 u, which rounded back to the same spot, so it froze until it died. The seed 7 test shows both parts frozen for 25 s before the fix. Fixed with BAND_EPS (0.5 u).

## Files touched
- src/game/bosses/tempest.ts: split AI rewritten. New pure helpers: leadPoint, leadAim, cutOffSide, cutOffPoint, turnToward, turnRate, unstuckDue, clipRadius, flankSide. Also new exports TEMPESTLING_SLOT and BAND_EPS. SLOT is now 20 (was 8); offsets 0 to 7 are unchanged.
- src/game/bosses/table.ts: TEMPESTLING gets windupSec 0.5, plus turnSec, wallClip, nearWall, nearSec, stuckMove, stuckWindow, unstuckSec, cutOff and sidestepMin.
- src/game/bosses/state.ts: ABL_SIZE is now 40 (was 16).
- Tests: tests/game/bossTempestGw6.test.ts (new). bossGw5, bossTempestGw3, bossTempestGw4 and bossTempestSplit updated for the new numbers.

## Tests added (bossTempestGw6, 16 tests)
- Pure rules (lead point, clamp, turn, unstuck, flank side); lead aim at lock, tracking in the wind up, line lock while the ship jumps about, dash end 60 u off the walls.
- Unstuck: triggers on near-wall time and on the move window, then steers toward the centre for 0.6 s.
- Real level 40 fights. rectObstacles (seed 42), 30 s, ship circling and idle: no part within 140 u of the outer wall over 1.5 s (worst 1.18 s). Seeds 1, 2, 7: turn, cut-off line, dash ends. Determinism: two runs hash equal, Math.random throws.

## Test and build
- npm test: 265 files, 3738 passed, 1 todo. One earlier full run hit the known generator perf budget test (tests/levelgen/generator.test.ts:232), the accepted exception.
- npm run build: pass. v7 API grep prints nothing. tests/qa snapshots unchanged.
- Push: branch pushed to origin. It is based on 8960248; main has since moved to afde27c (not rebased).

## Changed old tests (please check)
- bossGw5 fan test runs 30 s (was 20): the cut-off part's dash ends near the ship's sidestep, so the ship is more often inside the fan's 300 u minimum range. bossTempestGw3: flanks are now a quarter turn; pincerReady accepts a gap within 45 deg of 90 deg.

## Risks
- The 30 s wall test measures outer walls, as the brief worded it. With obstacles counted, a part in the 165 u gap above the seed 42 obstacle can be near something for longer (about 1.5 s at worst).
- Harder fight: lead aim plus cut off with a 0.5 s wind up. If device fairness drops to 3, raise windupSec or cutOff first.
- Per-step cost: one rayToWall march per part per wind up step, no allocation.

- Contracts: none changed, no events renamed. Lane markers keep their fields; rot and length now update in the wind up.

## Device check for Ryan
1. Play level 40 and crack the Tempest below a third of its hit points so it splits.
2. Keep strafing in one direction. Each red lane marker should swing to point ahead of you, not at you, and stop moving when the dash starts. The dash should cross where you were heading.
3. Sidestep a dash. The second Tempestling's lane should cover the spot you stepped into.
4. After each dash, the Tempestling should snap round to face you almost at once, not drift.
5. Lead them along walls and round the obstacle. None should sit at a wall for more than about a second and a half, and none should freeze in place.
6. Rate fairness. Target is 4.
