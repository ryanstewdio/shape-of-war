# Swarm hand off: weapons combine (wave D sim)

Branch: feat/swarm-weapons-combine (from main 8a312ef)
Session: https://claude.ai/code/session_018Gwqi51KevzKtDahLjTxuF

## What changed
- Orbit redesign: no forward bullet. The shield is 4 blades at 80 u plus 4 spikes between them at 94 u (style 3, 5 u, a hit and cooldown like a blade). While the right stick is held the hitters on the aim side swing out to 1.8x and back every 0.4 s, weighted by cos squared of the angle to the aim. A pushed hit also shoves a surviving enemy up to 28 u outward. When the stick is released the current swing finishes.
- Combining (COMBO_TABLE, COMBO_NAMES): a second kind makes the pair for a fresh 20 s, an ingredient refreshes without reordering, and a third kind replaces the older ingredient. A spread pickup with nothing active does nothing. Spread joins the drop pool only while a weapon is active, and while one is active the next drop falls due within 12 kills.
- Events: `fx:weaponCombine {x,y,kind,a,b}` (the declared contract), `fx:weaponExpire {kind}` on timeout only, and `hud:weapon` gains an optional `title` (the pair name). `BulletPool.combo` gives the pair index 1 to 6.
- The six pairs (volleys a second in brackets): Hail (22), 3 rapid bullets at plus and minus 5 deg, life 0.9. Trident (10), 3 pierce bullets at plus and minus 8 deg, radius 5, 2 hits. Halo (10), spread forward plus the orbit shield. Needle (14), 2 parallel pierce bullets, radius 4, 3 hits. Whirl (18), 2 parallel rapid bullets plus a shield at 3.0 rev/s. Eclipse (8), 1 pierce bullet with 3 hits, plus 5 blades at 100 u (2.0 rev/s, 0.15 s cooldown) and 5 piercing spikes that each hit up to 3 enemies.
- Drone pickups (drones.ts, DRONE_MODE_TABLE): Kind.DronePickup comes at kill 30, then every 40. The mode is `DRONE_MODES[hash01(seed ^ 0x44524f4e, n) x 4]`, stepping on past a repeat. It arms the drone for 20 s, and armed, every drone type fires 4 volleys a second within 450 u. Homing: its shots home. Rapid: 10 volleys a second, rapid style. Double: a Kind.DroneTwin at the opposite phase. Detach: a post 280 u along the aim, out at 700 u/s and back at 900 u/s, a decoy while out. A new pickup replaces the mode. Events: `fx:droneArm {x,y,mode,secondsLeft}`, `fx:droneExpire` at expiry only, and `hud:droneWeapon`.
- Decoy: `targetOf` returns the decoy for any entity within 640 u of it, and seekShip, angleToShip and distToShip read it. With no decoy it returns 0, so every v2 golden is unchanged.

## Files touched
src/game: weapons.ts, pickup.ts, bullets.ts, combat.ts, drones.ts, state.ts (droneTwinId), steer.ts (outside ownership, see Requests); src/core/events.ts
tests: game/weaponCombine.test.ts (new, 22), game/droneModes.test.ts (new, 14), game/weapons.test.ts (5 updated, 1 added), qa/weaponDropReplay.test.ts (2 updated, 1 type fix)

## Goldens and values changed (only where the spec requires)
- weapons.test, orbit: 4 blades at 80 u become 4 blades at 80 u plus 4 spikes at 94 u. Forward bullets go from 6 a second to 0, and style 3 bullets from 4 to 8.
- weapons.test, collection: rapid then orbit was orbit, now `rapid+orbit` (8 hitters); adding pierce was pierce, now `pierce+orbit` (10 hitters).
- weapons.test, drop kills when collecting: [15, 40, 65] become [15, 27, 39, 51, 63]. Uncollected stays [15, 40, 65].
- weapons.test, band 2 drops: [1, 2] become [0, 1, 2].
- weaponDropReplay: armed drops use the pool plus spread (0), and the kill bound of 15 plus 25n holds until the first equip. Band 1 {1} becomes a subset of {0, 1}, band 2 {1, 2} a subset of {0, 1, 2}, and band 4 "size 3" becomes "contains 1, 2 and 3".
- Unchanged: the v1 spread goldens (V1_QUIET_10S, V1_BAND2_30S), the tests/qa level snapshots and the v2 determinism and physics replays. The guarded spread ingredient replay in weaponReplayV3 now runs and passes.

## Tests and build
npm test: 214 files, 3109 passed, 1 todo, 0 failed. npm run build: pass. The v7 API grep is empty, and there is no Math.random in the touched files.

## Risks
- Spikes are style 3 bullets, so they draw as blades until Glow gives them a look, and DronePickup and DroneTwin have no render yet.
- killShip (player.ts, not mine) removes a live drone pickup on death, unlike the weapon pickup. The spec is silent on this.
- ship.ts still plays the shot sound on orbit volleys although nothing fires.

## Requests (outside my ownership)
- Fable: approve the steer.ts edit. The spec puts the decoy in `targetOf`, and seekShip, angleToShip and distToShip must follow it. Also approve the tests/qa/weaponDropReplay.test.ts update; the brief names it, but tests/qa is outside my listed paths.
- Ledger: show `hud:weapon.title` and the `hud:droneWeapon` indicator. Glow and Chorus: combine, expire, droneArm and droneExpire visuals and sounds, spikes, the drone pickup glyph and the twin.

## Dependencies requested
None.

## Open questions
Should the orbit shot sound stay as a shield whoosh? Should a drone pickup survive a ship death like the weapon pickup?

## Device check for Ryan
1. With orbit, hold the right stick toward a group. The blades on that side should pulse out about twice as far and back, knocking enemies outward, and no bullet should leave the ship.
2. Hold rapid, then grab pierce: the HUD should name Needle and fire twin piercing bolts. Grab orbit next: it should become Eclipse, a bigger five-blade shield plus one piercing bolt.
3. Let a combo run out: you should hear the expiry cue and drop back to the normal shot.
4. After about 30 kills a drone pickup should drop. Detach should send the drone out ahead, where nearby enemies turn toward it. Double should add a second drone opposite the first. Each should end after 20 s.
