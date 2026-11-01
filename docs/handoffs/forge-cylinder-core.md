# Hand-off Forge: cylinder-core (V3-H C0, D13)

Branch: feat/forge-cylinder-core. Session: https://claude.ai/code/session_018Gwqi56b9u3bageNM8M63r

## What changed
- `src/core/surface.ts`: `wrapDelta(d, L)` (docs/09 rule, result in [-L/2, L/2), exact plus or minus L/2 maps to minus L/2), `wrapCoord`, `cylinderSurface(W, H)` (u wraps, v bounded, toXYZ with R = W / 2 pi), `makeSurface(kind, W, H)`. delta and wrap allocate nothing.
- `world.ts`: `World.surface` from `level.surface` (default flat); `surfaceOf(w)`, `deltaTo(w, ax, ay, bx, by, out)`, `wrapWorld(w)` (every live entity and player bullet, once per step, before the grid rebuild; no op on flat). `driftEntity` uses `confineOn`.
- `arena.ts`: `confineOn(surface, arena, x, y, r, out)` and `isInsideOn`. Flat calls `confine`/`isInside` unchanged. Cylinder: no u wall, rims at v = plus or minus (H/2 minus r), any arena shape treated as that band, obstacles pushed at their nearest image across the seam, result x wrapped.
- `collide.ts`: `createGrid(W, H, cap, wrapU)`. wrapU grids have exactly W/64 columns, cell index modulo cols, neighbour queries wrap (no column visited twice), distances use the wrapped offset. Dev build throws if W is not a multiple of 64.
- Ship, player bullets, enemy bullets (wrap plus seam aware ship contact), steer.ts (seek, stepToward, angle and distance helpers, targetOf, moveTo, moveToHit), combat (orbit sweep, capsule tests, separation), geoms magnet and collectNear, pickup collect, spawner (safe radius, ring wrap, isInsideOn), wellArrival (spot checks, settle): all through delta/confineOn. No raw b minus a left in my files except the documented flat fallbacks of `inFrontArc` and `capsuleHits` when no surface is passed.

## Tests
- tests/core/surface.test.ts: 13 (seam both ways, exact L/2, wrapCoord, cylinder delta/wrap/toXYZ, seam continuity, flat unchanged).
- tests/game/cylinder.test.ts: 16 (world surface default and dev assert, ship across the seam 5 times with continuous delta, no u wall, rims collide, confineOn rims and obstacle across seam, bullet wraps and dies on rim, bullet across seam kills a grunt, grunt seeks the short way, hash neighbours across seam both ways, flat grid does not, out of range index and no double count, cylinder determinism over 1800 steps).
- npm test: 266 files, 3751 passed, 1 todo (generator perf test passed this run). npm run build: exit 0. tests/qa untouched; flat replays bit identical (flat delta is the same subtraction, flat confine path unchanged).

## Contracts for C1
- Swarm: replace every vector with `w.surface.delta` (or `deltaTo`), every `confine` with `confineOn(w.surface, ...)`, every `isInside` with `isInsideOn`; pass `w.surface` to `inFrontArc` and `capsuleHits`. Steer helpers already wrap, so enemies using them work across the seam now.
- Raw subtractions left (file: lines): enemies/gravitywell 251,252,256,257,295,296,314,315,341,342; enemies/slime 52,53; enemies/snake 68,69,87; enemies/swirl 68,69; enemies/weaver 29,30; bosses/brood 308,353; bosses/core 306; bosses/gravitas 229,260,261; bosses/kit 65,66,68,71,72,78,79,119,120,202,203; bosses/prism 110,111; bosses/tempest 357,358; drones 51,52,82,83,100,101,112,113,427,428,442,443; supers 112,113,166,167,180. Also bossBodyContact and shieldBlocks, and raw confine/isInside in drones, sower, blink, ember, tempest, mirage, core, shots.
- Glow: interpolate with `surface.delta(prev, cur)` (prevX may sit on the other side of the seam); toXYZ is periodic.
- Positions written after stepWorld (drones, supers, separation through moveTo is fine) are canonicalised at the next step's wrap; the grid and delta tolerate one step outside [-W/2, W/2).

## Risks
- Float32 storage can round a value just under W/2 up to W/2; wrap maps it to minus W/2 next step. Harmless.
- No level has `surface: 'cylinder'` yet (validator still flat only, Foundry C1).

## Device check for Ryan
No visible change: every shipped level is flat. Play any level and one boss fight; movement, shooting, walls and pickups should feel exactly as before, with the Standard tier boss fight still at 58 fps or better.
