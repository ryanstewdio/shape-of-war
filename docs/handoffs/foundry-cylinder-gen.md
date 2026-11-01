# Hand off: foundry cylinder-gen (D13 phase C0)

Branch feat/foundry-cylinder-gen. Session: https://claude.ai/code/session_018Gwqi56BbYeapLjXt6z3Dr

## What changed
- The surface is one draw from mulberry32(deriveSeed(levelSeed, SURFACE_SALT)), its own stream, so no other stage moves. It uses the level seed, not the retry seed, so a re-derive keeps the surface. Levels 1 to 10 are flat. Levels 11 and up that are not boss levels are cylinder 35 percent of the time. Boss levels (every multiple of 5, whatever enableBosses says) and Endless stay flat.
- GenConfig.enableCylinder (default true). V1_GEN_CONFIG and V2_GEN_CONFIG now carry it off, so they stay byte for byte. New V3_GEN_CONFIG (cylinder off) is the v3 generator byte for byte.
- A cylinder arena (generateCylinderArena, on the arena stream) is rect or rectObstacles (band weights), with width snapped to the nearest multiple of 64 u and then stepped inward until it fits 1800 u and aspect 1.0 to 1.8. Obstacles keep the flat rules, so none crosses the seam.
- Spawn points, wells and spawners on a cylinder: u is placed in [0, W) and canonicalised to [-W/2, W/2). The edge margin applies to the rims only, and every distance (spawn clearance, obstacles, well pairs, spawner to well) wraps in u. Edge and cluster anchors sit on the top or bottom rim. Ring entries are unchanged.
- Versioning (I followed the boss pattern): GENERATOR_VERSION_V4 = 4 marks cylinder levels only. Every flat def keeps 1, 2 or 3. LEVELDEF_VERSION is unchanged.
- Validator: V1 accepts 'cylinder' on a level unless opts.enableCylinder is false. It rejects every other value, and Endless is still flat only. New check C1: cylinder needs level 11 or later and not a boss level, shape rect or rectObstacles, width a multiple of 64 and version 4. Version 4 on a flat level fails. W4 and H1 to H3 use wrapped geometry on a cylinder. J3 now knows versions 1 to 4.

## Files touched
src/levelgen/cylinder.ts (new), generator.ts, leveldef.ts, validate.ts; tests/levelgen/cylinder.test.ts (new), boss.test.ts, gcTriage.test.ts, generator.test.ts, surfaceV2.test.ts, v2enemies.test.ts.

## Tests
- cylinder.test.ts, 18 tests. Over 2000 (seed, level) pairs, enableCylinder false matches a digest recorded on main (F4AEAB71) and every flat level with the flag on equals it byte for byte. Cylinder share among eligible levels is within 1 point of 35 percent over 4000 seeds (about 28 percent of all levels 11 to 60). Boss levels and levels 1 to 10 are flat. Generated cylinder levels validate, are rect family, have widths that are multiples of 64, carry version 4 and keep canonical x. Validator cases cover V1, C1, and wrapped H2 and W4.
- Updated: J3 now rejects 5, not 4. The boss on/off identity test holds the cylinder flag off. surfaceV2 runs with the cylinder flag off. gcTriage pins: seed 42 L16 changed D736C51F to 712BC1C1, and L17 changed 43CADCE4 to BCC2F1B8. Both are now cylinder.
- tests/qa/levelSnapshots.test.ts: unchanged. No pinned level became cylinder (the v1 and v2 pins run with the flag off, and the boss pins are boss levels).

## Test and build
npm run build: pass. npm test: 3737 passed, 3 failed.
1. Generator perf test, "200 levels under 350 ms" (443 ms). It also fails on main in this VM (468 to 511 ms), so it is the accepted exception.
2. and 3. These two are caused by this change, in files I do not own (see Requests).

## Requests (outside my ownership)
- tests/qa/generatorBossFlagSweep.test.ts: set `const ON = { ...DEFAULT_GEN_CONFIG, enableCylinder: false };`. Today it expects the default to equal V2_GEN_CONFIG on every non boss level.
- tests/qa/physicsReplay.test.ts: pass `{ ...DEFAULT_GEN_CONFIG, enableCylinder: false }` to its generateLevel calls. Seed 0xDEADBEEF level 36 is now a cylinder (rect 1664 x 960). I tried both edits locally: 45 of 45 pass. Then I reverted them.

## Contracts for other roles
- Forge, Glow and Swarm: on `def.surface === 'cylinder'`, u period = arena.width, centred on 0. Stored x is in [-W/2, W/2). The rims are y = plus or minus height / 2. There are no side walls. generatorVersion is 4.
- Until Forge lands the cylinder sim, the game plays cylinder levels as flat rects with walls. All their content is also valid inside a flat rect, except points near the seam within 40 to 120 u of a side wall.

## Risks
- Older saved run hashes for cylinder levels change (for example seed 42 L16 and L17). Flat levels are untouched.

## Device check for Ryan
Start a run with seed 42 and play to level 16. The HUD hash should read 712BC1C1. The arena should be a plain rectangle with no inner walls, 1216 by 860 u (until Forge's cylinder lands, it still has side walls). Level 15 (Spindle boss) should still be flat.
