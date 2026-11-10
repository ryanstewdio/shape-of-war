# Hand-off forge: trough
Branch: feat/forge-trough. New src/game/trough.ts; stepWorld calls stepTrough after drift when w.surface.kind is 'trough'.
Pull: the ship alone shifts along u by troughPullAt(u) = minus troughSlope(u) x TROUGH_PULL (96) x driftScale: 0 at the floor, about 53 u/s mid slope, about 160 u/s at the rim (under SHIP_SPEED at insane), so the rim is reachable with thrust.
Walls: the shift goes through confineOn; the trough topology never wraps, rims and obstacles stay solid. Enemies, bullets, geoms and pickups are untouched.
Free Play: freePlaySurfaceRules (via freePlayLevelRules) turns a flat arena into a trough when FreePlayConfig.surface is 'trough'; a drum keeps its cylinder; absent or 'flat' returns the same level object.
Off: flat, cylinder, Endless and Free Play without trough never call stepTrough, so they stay bit identical. No PRNG, no allocation.
Tests: tests/game/trough.test.ts (23): direction and magnitude at floor, mid slope and rim, slope proportionality, difficulty scale, rim reachable and walls solid, enemy and bullet immunity vs flat, flat unchanged, Free Play option, determinism.
npm test: 5061 pass, 1 fail (generator perf budget, accepted exception). npm run build: pass. Grep: clean.
Try it: https://play.shapelegend.com/?dev=1&level=24 once Foundry marks level 24 up as trough, or Free Play with Surface Trough once Ledger adds the option. Idle on a slope and the ship slides to the centre line; hold toward a rim and it climbs but slides back on release.
Dependencies requested: none. Requests: Foundry sets surface 'trough' from TROUGH_MIN_LEVEL; Ledger adds the Free Play Surface option; Glow draws the profile.
Known gaps: the pull is a current (position shift), not accumulated velocity, so there is no momentum on release; no sim event telegraphs the slope.
