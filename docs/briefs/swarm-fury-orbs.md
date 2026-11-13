# Swarm: fury-orbs

Create and check out branch feat/swarm-fury-orbs before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/game/bosses/ (gravitas.ts, core.ts where orbs or pools need it, table.ts rows BOSS_TABLE.gravitas, GRAVITAS_ORB, GRAVITAS_POOL, view.ts readBoss only), tests/game/ (bossFightBot.ts and bossFightLength.test.ts included), tests/qa/ boss pins only
Do not touch: the Morpheus stub names and values (HazardType.Orb and Pool, GRAVITAS_ORB fields, BulletPool.straight, BossView fields), src/game/enemies/ (call spawnSnake and the enrage path, do not edit them), every other guardian file and row (Mirage and Brood unchanged), src/core/, src/render/, src/ui/, src/audio/, src/main.ts, src/levelgen/, docs/ other than your hand off
Read first: docs/handoffs/swarm-fury-tune.md, gravitas.ts (pools, bendAt, stepPools, tide), core.ts (spawnHazard, stepHazard, bossContacts, spawnAdd), ember.ts releaseLeavers (the enrage path: w.enraged, 'sim:enrage'), src/game/enemies/snake.ts (spawnSnake), scale.ts (minionCount), table.ts (GRAVITAS_ORB, GRAVITAS_POOL), tests/game/bossFuryTune.test.ts

## Goal
Ryan's device check on 64f6225 (2026-11-13): bent shots are a fun challenge, but the pools land behind Gravitas where he cannot reach them, the fight runs 2:15 against 90 s, difficulty 3.5. Ruling: pool orbs launched toward the ship replace the trail of pools, each with one enraged Snake; hit points 1300. Glow draws the orb in parallel.

## Acceptance
1. Pool orbs (GRAVITAS_ORB), enraged only (fury 2): every everySec of attack time Gravitas launches one orb (Kind.BossHazard, w.a HazardType.Orb, never lethal, no contact kill) from its body edge toward the ship (after the stage 2 split from the pair centre). It flies at speed and stops after share of the distance to the ship measured at launch, clamped to minDist to maxDist u from the launch point (and stops early at the arena wall). Where it stops it is removed and a pool opens through the existing pool rules (radius, life, fade, cap of max with the oldest going first, the reserve slots for rings). The old pool drop where Gravitas stands is removed. An orb never takes a hazard slot a ring or a pull needs.
2. Snakes: each orb launch releases snakesPerOrb Snakes (spawnSnake) at the body edge beside the orb's path, enraged the way Ember's Leavers are (w.enraged 1 and 'sim:enrage'), at most snakeCap Gravitas Snakes alive (head count), the difficulty add scale applying through minionCount, inside maxLiveEnemies and the entity caps. A ship death, the break and the boss's defeat treat them as the other boss adds are treated.
3. Bent shots, shelter, the drift row, the tide, rings, anchors and the split are unchanged.
4. Gravitas hit points 1704 to 1300 (Ryan, from his device fight). Its FIGHT_TARGET_SEC row becomes the bot's reading at 1300, commented as tuned from Ryan's device time like Brood and Mirage, and Gravitas joins DEVICE_TUNED (out of the tier ramp check). Easy shorter and Insane longer still hold.
5. All new numbers are named constants in table.ts.
- Tests: orb launch cadence and aim, the stop rule (share, clamps, wall), pool opening at the stop, no orb before the break, the reserve slots, Snakes released, enraged, capped and scaled by difficulty, the hp and bot rows. The fairness sweep, normalDifficulty and every pin pass; update pins only where these changes explain them, named in the hand off.
- No Math.random, no allocation per frame, TypeScript strict, no any.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/swarm-fury-orbs.md under 12 lines: Gravitas bot seconds at Easy, Normal and Insane, known gaps, requests. Commit and push the branch. Stop.

## Rules
Touch only. No em or en dashes. Nothing beyond this brief.
