# Glow hand-off: damage-v33 (device gate GW1)

Branch: feat/glow-damage-v33. Session: https://claude.ai/code/session_018Gwqi5Pga2AyziJKbbxpZX

## What changed
- Boss damage is now incompleteness, never dark paint. On each crack stage the body context is swapped for a damaged copy (`damagedSpec`) with whole outline segments removed from the geometry: about 20 percent of the perimeter at stage 1 (3 arcs), about 40 percent at stage 2 (5 arcs, the stage 1 arcs widen). Arcs come from a hashed table per boss and level seed, laid from the first hit side. The glow texture is rebuilt from the same damaged spec. Outline beside each gap shifts 25 degrees toward the boss accent and flickers. Torn ends get bright stubs (primary x1.3) that flare as the stage lands. Removed arcs fall off as outline pieces in boss colours; at stage 2 one whole section (DETACH_ARC) slides 60 u without spinning and fades over 1.5 s. Fills are kept at their normal alpha. The erase layer, scorch and fracture glow are gone; no erase or multiply blend is left anywhere in src/render.
- Supernova is a white tornado: 12 arms in hsl 0 0 95 percent turning at 1.5 rad/s with a brightness pulse, a core that flares white, 12 neon flecks riding the arms, and a stream of 80 live shimmer particles (40 per s, 60 to 120 u/s, 2 s life) cycling through all 8 ring hues. The breathing outer halo is removed. One thin faint white ring sits at exactly the sim pull radius (`wellInNova ? NOVA_RADIUS : PULL_RADIUS`, no multiplier, no pulse).
- New looks: Hornet (amber dart with a buzzing jitter), Gravitant (small violet well with the Gravitas rim), Mirror (magenta ghost of Mirage, no fill, 50 percent alpha), DronePickup (white and cyan broken ring glyph that spins the other way to weapon pickups), DroneTwin (drone look with a cyan tint), detach decoy (pulses red to orange and swells while out), orbit spikes (sharp triangle atlas frame in the orbit hue). While a drone mode is armed, a glyph (H, D, R or a doubled dot) floats above each drone and a thin ring in the mode colour circles the ship.

## Files
src/render: bossDamage.ts (rewritten), bossIdentity.ts, bossShapes.ts, shapeSpecs.ts, bulletStyles.ts, trails.ts, wellNova.ts, renderer.ts, partLooks.ts (new).
tests/render: bossDamage.test.ts (rewritten, 15), partLooks.test.ts (new, 9), wellNova.test.ts (+6, halo test replaced), bulletStyles.test.ts (+2), bossIdentity.test.ts, bossShapes.test.ts, shapes.test.ts, tier3Contract.test.ts (slot counts and crack state updated).

## Results
- npm test: 3192 passed, 1 failed, which is the accepted generator perf test (200 levels took 457 ms against the 350 ms budget in this VM). tests/qa snapshots unchanged.
- npm run build: pass. The v7 API grep prints nothing. No em or en dashes.

## Contracts for other roles
- The renderer reads these from the sim (read only): `weaponState(w).blades` with `shieldOf(kind)` (hitters at or past `blades` count as spikes), `droneArm(w).mode` and `.detach`, `wellInNova(w, id)`, `w.level.seed`. If Swarm renames any of them, the render looks break.
- Part slots grew from 4 to 7 types (PART_TYPES), which moves EXPOSED_SLOT_BASE and MAX_SLOT by 12. Anything outside render that hard codes slot numbers needs updating (none found).

## Risks
- A crack stage costs one buildContext plus one generateTexture for the damaged body (once per stage, not per frame), so there may be a single frame hitch on the crack. Check the lowest fps on the device during a crack.
- 3 novas at once keep about 240 trail particles alive; on Low the shed threshold caps them.
- `droneArm(w)` creates the arm state on first read when nothing else has.
- The tier 3 halo under the body still mixes bossRed toward black. It sits outside the outline (1.1 to 1.3 R), so I left it alone.

## Open questions
- Should the Twins second body take damage gaps too? Right now only the main body does, as in v32.
- Mode colours: homing pink, detach orange, rapid light blue, double cyan. Is that right?

## Device check for Ryan
1. Fight Warden. At 66 percent health, about a fifth of the outline should vanish in three gaps, and three short outline pieces should drift away. The outline beside each gap should flicker in a shifted hue, with bright stubs at the torn ends. Nothing black or dark should appear on or inside the body.
2. At 33 percent, the gaps should widen and two more should open, with one large section sliding about a body width away and fading over 1.5 s. The silhouette should read as broken, not stained.
3. Let a gravity well erupt. It should turn into a spinning white tornado with a bright core, flinging a steady spray of multicolour sparks. The only ring should be one thin, faint, steady white circle at the pull edge. No large pulsing circle.
4. Fight Warden phase 2: Hornets are small amber darts that visibly buzz. Gravitas stage 2: two small violet wells with rims. Mirage stage 2: faint magenta outline ghosts with no fill.
5. Collect a drone pickup (white and cyan ring). Check that a letter or double dot appears over the drone and a thin coloured ring circles the ship. In double mode the second drone is cyan. In detach mode the drone pulses red orange. With orbit, the spikes between the blades are sharp triangles.
6. Watch the lowest fps in a boss fight on Standard (target 58 to 59), especially on the crack frames.
