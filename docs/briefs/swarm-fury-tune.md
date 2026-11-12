# Swarm: fury-tune

Create and check out branch feat/swarm-fury-tune before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/game/bosses/ (mirage.ts, gravitas.ts, core.ts where bending or pools need it, table.ts rows MIRAGE, BOSS_TABLE.mirage, GRAVITAS_BEND, GRAVITAS_POOL, view.ts readBoss only), tests/game/ (bossFightBot.ts, bossFightLength.test.ts included), tests/qa/ boss pins only
Approved outside edits (explain each in the hand off): src/core/physics.ts, export a row based thrust step that stepThrust calls, every existing level bit identical; src/game/ship.ts, the float hook uses GRAVITAS_POOL.float through that step instead of 'high' (at most 10 changed lines).
Do not touch: the Morpheus stub names (BulletPool.straight and spawnStraight, BossView.shipInPool, the Lane w.vy telegraph contract, HazardType values, the pincer fields), src/game/bullets.ts beyond reading those fields, brood.ts and Brood's rows (Ryan: unchanged), warden.ts, spindle.ts, ember.ts, bastion.ts, tempest.ts, twins.ts, prism.ts and their rows, src/render/, src/ui/, src/audio/, src/main.ts, src/levelgen/, docs/ other than your hand off
Read first: docs/handoffs/swarm-fury-fixes.md, mirage.ts (aimedLane, burst), gravitas.ts (pools, pushShip, tide), core.ts (bossContacts, shipSheltered, spawnHazard, spawnLane), table.ts (MIRAGE, GRAVITAS_BEND, GRAVITAS_POOL), src/game/bullets.ts (straight, spawnStraight, stepBullets), src/game/ship.ts, src/core/physics.ts, tests/game/bossFightBot.ts, bossFightLength.test.ts, bossFuryFixes.test.ts

## Goal
Ryan's device check on 5e6fe77 (2026-11-12) and his rulings. Mirage: 2:45 fight, difficulty 5, the aimed lane's warning too short. Gravitas: the pools read and shelter but the drift was not felt and the fight is still boring (difficulty 2, fun 2); Ryan chose option A, bent shots. Brood: unchanged. Glow draws the looks in parallel.

## Acceptance
1. Mirage aimed lane: the one lane aimed through the ship gets its own telegraph MIRAGE.aimedTeleSec (1.2 s; the Insane telegraph scale applies to it as to every telegraph); its w.vy carries that telegraph (the Lane contract) and it turns lethal only after it. The other seven lanes keep the tier telegraph and w.vy 0. The fairness sweep holds.
2. Mirage hit points 1150 to 650 (Ryan, from his device fight). Its FIGHT_TARGET_SEC row becomes the gate aware bot's reading at 650, commented as tuned from Ryan's device time like Brood, and Mirage leaves the tier ramp check the way the rows tuned from device time must (name it in the test). Easy shorter, Insane longer still hold.
3. Gravitas bent shots, enraged only (fury 2): inside GRAVITAS_BEND.radius of each live Gravitas pull (the body, then each Gravitant at its own strength), every player bullet with straight 0 (orbit blades excluded) turns away from that core toward the side it is already passing (a dead centre shot picks one side deterministically), at up to GRAVITAS_BEND.rate rad/s at the body edge, falling off to 0 at the radius. While the tide pushes, the bullet is also pushed outward at up to GRAVITAS_BEND.scatter u/s^2 with the same falloff. Tune rate and scatter so that, with no pool, a spread shot fired at the core centre from 200 to 300 u misses the body on Normal (pull and push both), and a straight shot hits it; report the final values. No PRNG, no allocation per frame.
4. Straight shots: every step the boss sim writes w.bullets.spawnStraight 1 while the ship's centre is inside a live pool and 0 otherwise (0 whenever no Gravitas pool exists), so shots fired from a pool fly straight for their whole life. readBoss writes shipInPool.
5. Drift: inside a pool the ship moves with GRAVITAS_POOL.float (about a third of the low grip, no brake assist, little drag) instead of 'high'. Outside every pool handling is exactly as before; every Space physics setting stays bit identical.
6. The pools, shelter, tide and rings are otherwise unchanged. Gravitas hit points unchanged (the bot does not model bending; Ryan's next fight line tunes it); say so in the hand off.
7. All new numbers are named constants in table.ts.
- Tests for each item: the aimed lane telegraph and its w.vy, Mirage hp and the bot rows, bending on and off (no pool miss, straight hit, pull and push, Gravitant pulls, not before the break, orbit blades untouched), spawnStraight on and off, the float row inside a pool and identity outside it, the physics row step identical for every level. The fairness sweep, normalDifficulty and every pin pass; update pins only where these changes explain them, named in the hand off.
- TypeScript strict, no any.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/swarm-fury-tune.md under 12 lines: final GRAVITAS_BEND values, Mirage bot seconds at Easy, Normal and Insane, outside edits, known gaps, requests. Commit and push the branch. Stop.

## Rules
Touch only. No em or en dashes. Nothing beyond this brief.
