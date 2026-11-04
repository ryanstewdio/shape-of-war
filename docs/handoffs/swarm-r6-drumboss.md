# Hand off: swarm r6-drumboss

Branch feat/swarm-r6-drumboss from main 25919a9. Session: https://claude.ai/code/session_018Gwqi5NDFxbHbHJrBVW2NW

## Why the seam tests passed but the device missed
hazardHitsOn tested only the ship's nearest image. A Warden ring grows to hypot(W, H), far past half the drum (800 u): its far arc wraps round and visibly crosses the ship, but the nearest image of the ship sits on the near side of the centre and missed. Long lanes and sweep arms had the same gap. Body, Hornet and Broodling contact, bullets into the boss body, shot ranges, Mirage's lane check and front arc, and Prism's landing check all used flat offsets too.

## What changed
- kit.ts: hazardHitsOn walks every ship image within the hazard's reach (hazardReach, imagesFor, at most 3 per side). New circlesOverlapOn, pointDistOn and angleToOn go through surface.delta. A flat surface returns hazardHits with the raw numbers (bit identical).
- core.ts: body, split body part and Hornet contact, bossBodyContact (player bullets and Detonate) and the fairness rule 5 spawn check are seam aware. Hazard anchors and tether ends are wrapped onto the strip on a drum.
- Bosses: shots and rotation range and aim go the short way, and muzzle checks use isInsideOn. Ember's dash confines with confineOn, so it no longer bounces off an invisible wall at the seam. Tempest: rayToWall uses isInsideOn and is capped at half the drum; the body dash stops at its marked line on a drum; Tempestling flank, lead aim, cut off, unstuck and stuck tracking go through the surface. Gravitant pair centre seeks the short way and wraps. Mirage: landing points wrap, the spot and lane checks and the gate arc are seam aware. Prism drift and warp clearance, Twins second body contact, and Brood angles and flee centre (v only on a drum) are seam aware too.
- DRUM_SAFE_BOSSES (src/game/bosses/index.ts) lists all ten bosses, so none is kept as Warden. Setup screen note: nothing to list.
- Boss choice: freePlayBossFor lives in src/levelgen/boss.ts, not freeplay.ts. I changed only that function and FREE_PLAY_DRUM_BOSSES (now all ten, pinned equal to DRUM_SAFE_BOSSES). A chosen boss fights on a drum, and every3 rotates the full ladder there.

## Tests
- New tests/game/bossDrumSeam.test.ts (25 tests): kit image walk (the wrapped ring is the device case), flat bit identity over 1500 cases, the Mirage arc, and fairness rule 5 across the seam. On a real 1600 x 1000 drum fight: body, Hornet, ring, lane, sweep, tether, pull and shot range all work across the seam. Each of the ten bosses runs 40 s with the ship flipping sides of the seam: everything stays on the strip, the boss lives and attacks. Gravitas chosen on a Free Play drum is Gravitas in the real run.
- Updated tests/levelgen/fpLevel.test.ts (1) and r5fp.test.ts (1): they pinned the old Warden-only drum rule.
- npm test: 4596 passed, 1 failed (the accepted generator perf test "200 levels under 500 ms", which also fails on main in this VM). npm run build passes. The flat boss determinism goldens are unchanged.

## How to verify on device
1. Free Play, drum, bosses Warden. Stand about 100 u past the seam from Warden and let a ring grow round the drum: it kills where it is drawn.
2. Free Play, drum, bosses Gravitas: Gravitas enters at 1:40, not Warden. Repeat with Tempest and Prism.
3. Fly into the boss body across the seam: you die. Shoot it across the seam: it takes hits.
4. Bosses every3 on a drum: the second boss is Brood, the third Spindle (the full ladder).

## Requests (outside my ownership)
- Fable: accept the edits to src/levelgen/boss.ts (freePlayBossFor and the list) and the two levelgen tests; the rule did not live in freeplay.ts.
- Glow: check that rings over 800 u and lanes and sweeps over half the drum draw wrapped, as the sim now hits them. A tether is hit along its short way round.

## Known gaps
- Ember on a drum stuns only on the rims or obstacles (no u walls); its window still opens at the rest.
- Lap paths (Tempest, Spindle, Twins orbit) still circle the flat centre: valid on a drum, but they never cross the seam themselves.
