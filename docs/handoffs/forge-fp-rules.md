# Forge hand off: fp-rules

Branch: feat/forge-fp-rules. Free Play options, rules side (docs/14).

## What changed
- GameOptions.freePlay?: FreePlayConfig (src/game/game.ts). Absent changes nothing. Applied in createGame after weaponPickups and before startBonus, so it overrides the Settings pickups option.
- Lives: exactly 1, 3 or 5 (difficulty extra lives and the level's lives are ignored). Infinite sets gs(w).lives to Infinity: never lost, a death still resets the multiplier and counts in the new gs(w).deaths. The HUD iconRun and snapshotOf already treat a non finite count safely.
- Length: a score attack sets gs(w).timeLimit; the run ends 'won' (game:over, 0 stars in Endless mode) once w.time reaches it. scoreAttackLeft(w) gives seconds left (null for Endless). It counts w.time, so it keeps running through the respawn delay and boss holds. Losing every life first still fails.
- Weapon: equipped at the spawn for WEAPON_DURATION with pickups on. With pickups off it is permanent (weapons.ts setPermanentWeapon): the timer never runs down and it is equipped again at each respawn. Spread or null means none.
- Pickups off: setWeaponPickups(false), which also stops drone pickups (pickup.onScoringKill gates both).
- Drone and super: freePlayLevelRules copies the level with the config's kinds (the caller's LevelDef is untouched).
- Drift: drift.ts applyDriftOption: off clears active, low as today, high sets DriftState.scale 2. Drums only; a flat arena stays inactive.
- evaluateObjective takes optional timeLimit and elapsed (pure, any mode).

## Files
src/game/game.ts, state.ts, player.ts, objective.ts, weapons.ts, drift.ts; tests/game/freePlayRules.test.ts (new, 33 tests).

## Checks
npm test: 4449 passed, 1 failed (accepted levelgen perf test, VM speed), 1 todo. npm run build: pass. v7 shim grep: empty. tests/qa untouched.
Device: Free Play, infinite lives, 3 min, pierce, pickups off, drift high on a drum: die often and never lose, keep pierce after respawn, no pickups drop, drum current about twice as strong, run ends with results at 3:00.

## Contracts for other roles
- Ledger: pass GameOptions.freePlay; HUD timer from scoreAttackLeft(w); deaths from gameState(w).deaths; a timed run ends with outcome 'won' and mode 'endless'.
- Ledger's freePlayRun result check: a 'won' outcome in endless mode is new.

## Known gaps
- Permanent weapon HUD shows a full 20 s bar, not an infinity mark.
- Endless extra life awards do nothing with infinite lives (bombs still award).
- add_repo tool was not available in this session; push relies on the session's git credentials.
