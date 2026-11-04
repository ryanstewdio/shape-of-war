# HAND-OFF foundry: r5-fp
Branch: feat/foundry-r5-fp  Head: 52a53cb (code; this hand-off is the next commit)
Files changed: src/levelgen/boss.ts, freeplay.ts, generator.ts, validate.ts; tests/levelgen/fpLevel.test.ts, r3length.test.ts, r5fp.test.ts (new)
Tests added: r5fp.test.ts 14 (bosses 6, snakes 4, wells 1, Swarm 1, late ramp 2); fpLevel.test.ts 6 updated to the R5 rules; r3length.test.ts 1 updated (breather dip check)
npm test: 4520 pass, 3 fail: tests/game/difficulty.test.ts and tests/qa/normalDifficulty.test.ts (Forge, as briefed), and generator.test.ts "200 levels under 500 ms", which also fails on untouched main in this container (1013 ms on main, 945 ms here)  npm run build: pass

## Why no boss appeared (level side, nothing in src/game)
The sim arms segment bosses correctly (checked with createEndlessGame on rect and circle: armed at 180 s, entered at 190 s). Free Play bosses came on segment 6 (190 s), after a 3 minute score attack ends, and a drum dropped bosses entirely. Now: segments 3, 13, 23 (entrance 100 s, 400 s, 700 s on the wave clock). The wave clock holds during a fight, so the gap Ryan sees is 300 s plus the fight. On a drum: Warden and Brood only (they steer through steer.ts, seam aware since C0, and centre every attack on their body); every3 alternates them, and a chosen boss outside them fights as Warden.

## Other fixes
- Snakes: bands 1 and 2 (first 4 minutes) have maxLiveSnakes 0 and snake weight 0, so only well nova snakes showed. With the snake allowed by the toggles (chosen, or none chosen), each segment from 0:30 holds at least 1 snake (own stream FPSN), independent of wells. FP6 checks it; R1 ignores the Free Play snake.
- Wells: 'normal' placed none (only 'many' did) and the game adds no arrivals in Endless. Now normal 1 to 2, many 2 to 4; FP4 per option.
- Swarm: 1.8 to 1.95 (spawns +6.8 percent, live cap +8.3 percent).
- Late ramp: Free Play's final third spawns 1.37x its middle third. Adventure v8 non boss bands 2 to 4 already 1.27x to 2.3x; band 1 (levels 1 to 4) was 0.95x to 1.0x. It now lifts its budget 1.4x from 2/3 of the clear time, breathers excepted (1.31x to 1.36x). Bands 2 to 4, boss levels and plain Endless are byte for byte unchanged.
- Determinism, validation and flat V1 to V5 configs: no Free Play config is still today's Free Play (goldens hold); V1_GEN_CONFIG tests pass.

How to verify on device:
1. Free Play, rect, bosses every 3 minutes, 3 minute run: Warden enters at 1:40.
2. Endless length: Brood enters about 5 minutes after Warden's entrance plus the fight.
3. Drum with Gravitas chosen: Warden comes at 1:40.
4. Wells off, all enemies on: a snake by about 1:00, then snakes every 30 s.
5. Wells normal: 1 or 2 wells at the start. Swarm feels a bit busier.
6. Adventure level 2: the last minute is busier than the middle.

Dependencies requested: none
Requests (changes outside my ownership):
- Ledger: the "every 3 minutes" boss label now means "first at 1:40, then every 5 minutes".
- Forge: src/game/wellArrival.ts stepWellArrivals returns in endless mode, so Free Play wells never arrive over time and FREE_PLAY_ARRIVAL_GAP_SCALE is unused. Allow arrivals when gs(w) carries a Free Play config.
- Forge: src/game/bosses/kit.ts hazardHits and core.ts hazard tests use flat deltas; route them through w.surface.delta so drum boss hazards hit across the seam.
Known gaps: the drum boss pair is judged from the code, not played; the generator speed test needs a CI baseline.
