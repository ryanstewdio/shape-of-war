# Foundry: r5-fp

Create and check out branch feat/foundry-r5-fp before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Start from the current HEAD (local main may be ahead of origin; keep it).

Model: opus
Owned paths: src/levelgen/, tests/levelgen/
Do not touch: src/core/, src/game/, src/render/, src/audio/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: src/levelgen/freeplay.ts, src/core/freeplayConfig.ts, src/levelgen/generator.ts (endless segments, boss specs, wells, pacing)

## Goal
Free Play check (build 405facc, Ryan): "No bosses appeared during 3 minute or endless play. Bosses should appear within 2 minutes, then if endless appear again after 5 minutes." "Snakes are now not appearing and will not appear if wells is not turned on." "Swarm is busier than Low but I would like Swarm about 5 to 10 percent busier." "Near the end of the Free Play 3 minute match the load increased; I like it and want to confirm it is applied in Adventure as well."

## Acceptance
- Bosses in Free Play: with bosses on (every3 or a chosen boss), the first boss enters by 120 s and, in an Endless length run, another every 300 s after the previous one's entrance; on a drum, use a flat compatible boss or say why not and pick the closest rule Ryan would accept. Find why none appeared on device (segments never carry the boss spec, the sim never reads it, or the drum or score attack path skips it); if the cause is in src/game, say exactly where for Forge. Test on the real segment stream over 11 minutes.
- Snakes: the Snake enemy appears in Free Play rosters whenever it is allowed by the enemy toggles, independent of wells (nova snakes still come only from wells).
- Wells: wells normal or many always place wells (check the level side of the wells toggle bug; Ledger checks the UI side in parallel).
- Swarm density 1.8x to 1.95x.
- Late level ramp: confirm with a test that Adventure non boss levels (v6 pacing) also raise intensity in their final third like the 3 minute Free Play run; if not, add the same ramp.
- Determinism, validation, flat invariants for V1 to V5 configs. npm test and npm run build pass on the branch except tests/game/difficulty.test.ts and tests/qa/normalDifficulty.test.ts (Forge updates them). Hand off at docs/handoffs/foundry-r5-fp.md under 40 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. No em or en dashes.
