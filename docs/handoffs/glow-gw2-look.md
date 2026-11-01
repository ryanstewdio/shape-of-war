# Glow hand off: gw2-look

Branch: feat/glow-gw2-look. Session: https://claude.ai/code/session_018Gwqi4cicWeqnP4Th4BB1k

## What changed
- Whirlpool nova (src/render/wellNova.ts, renderer drawNova): the arm spiral and the pull ring are gone. An erupted well is a whirlpool of white gas and dust (hsl 0 0 95 percent) out to exactly the sim pull radius (NOVA_RADIUS once erupted): 4 layered translucent log spiral bands (wide faint, mid, thin bright) with bright dashes sliding down them, 72 dust motes falling on log spirals into the core and respawning at the rim, 16 multicolour shimmer sparks riding the same flow, and a bright white core flare. Flow is clockwise on screen, 1 rad/s at the rim, 4.7 rad/s at the core. Motes are seeded by hash01 of the well entity index and the draw clock (no PRNG).
- Calm swirl: every well not in nova turns a small slow swirl (2 bands, 10 motes, 0.3x the nova flow, reach 2.2x the body radius) in a whitened well red, so the nova is a clear escalation.
- The outward pool shimmer stream (emitNovaShimmer, novaDriftParticle) is removed; sparks now spin with the flow. A nova adds 88 drawn points (budget 96), zero pool particles.
- Well arrival (src/render/wellArrive.ts): on sim:wellArrive a ring of 28 white dust points converges from 120 u to the well radius over inSec, turning clockwise, then flashes (disc plus ring, 0.35 s) as the well appears.
- Snake emergence: on sim:wellSpawn a white burst (18 pool particles), a centre flash and a growing ring at the well centre; the snake head that appears within 90 u in the first 0.25 s is tracked and a short white trail (10 points) runs from the well centre along its path for 0.9 s.
- Orbit chainsaw (src/render/spikeSaw.ts, renderer drawSawTooth): the renderer now reads BulletPool.spikeLen (new optional field on BulletPoolLike). Each style 3 spike is a sharp triangle centred on (x, y) along (vx, vy), length spikeLen (24 rest, 60 max). While stretched: a hot white edge and 2 ghost copies rotated back round the ship against the spin. Spikes draw in one Graphics (spikeSaw) above the bullets; their atlas sprites are parked.
- Boss shield shell (src/render/bossShell.ts, renderer drawShell): while BossView.shielded or sim:bossShield up, a slowly turning Bulwark white hexagon (1.32x body radius) with a counter turning inner hexagon, translucent fill, the core veiled dark behind it, and a bright white rim pulse on every blocked fx:hit on the boss. On drop: 6 outline shards fly off and tumble for 0.75 s, the open core pulses bright and a white ring shrinks from 1.25x to 0.3x the body radius over the open window (exposedLeft if known, else 2.5 s).
- All well layers share one Graphics (wellNova) cleared once per frame and only while it holds content.

## Files touched
src/render/wellNova.ts, src/render/wellArrive.ts (new), src/render/spikeSaw.ts (new), src/render/bossShell.ts (new), src/render/renderer.ts, src/render/particles.ts, tests/render/wellNova.test.ts (rewritten), tests/render/wellArrive.test.ts, tests/render/spikeSaw.test.ts, tests/render/bossShell.test.ts (new).

## Tests
wellNova 20 (clockwise on screen with y down, inward motion, rim and core angular speed, finite difference check, band geometry, budget at most 96, one clear of the layer, no ring), wellArrive 7, spikeSaw 6 (drawn length tracks spikeLen), bossShell 7.
npm test: 3277 passed, 1 failed (the accepted levelgen perf test "200 levels under 350 ms", VM speed), 1 todo. npm run build: pass. v7 shim grep and dash grep: empty. tests/qa snapshots untouched.

## Risks
- Graphics rebuild cost: a nova is about 50 Graphics instructions (bands, 12 dashes, 4 mote fills, 16 sparks, core); calm swirls add 5 per well. Watch the Standard tier boss fight fps on device.
- The whirlpool covers the full 400 u nova pull disc; if it hides bullets, lower band alphas in drawNova.
- Emergence trail matching is by distance; two snakes from one well at once could swap trails (harmless).
- Core veil is a black fill at 0.65 alpha under the shell, the only dark paint added.

## Contracts for other roles
- Read only: BulletPool.spikeLen, BossView.shielded and exposedLeft, fx:hit blocked on Kind.Boss.
- Listening (unchanged names): sim:wellArrive, sim:wellSpawn, sim:bossShield. Forge must emit sim:wellArrive and Swarm sim:bossShield for those paths; Warden works today from BossView.

## Device check for Ryan
1. Play a level with a gravity well. Before it erupts you should see a small slow white red swirl turning clockwise.
2. Let it erupt. It should become a big white whirlpool filling its pull area, gas bands and dust spiralling clockwise and inward, slow at the edge and very fast near the bright core, with coloured sparks swirling in it. No ring line.
3. Watch it for nova snakes: each one should start with a white flash and ring at the well centre and leave a short white trail as it crawls out.
4. If a well spawns mid level (once Forge emits sim:wellArrive), a ring of white dust should close in on the spot and flash as the well appears.
5. Take Orbit and hold the aim stick to saw. The spikes should grow from short teeth to long thin blades with white edges and a smeared ghost trail behind the spin. Release: they shrink back.
6. Fight Warden. About 10 s in, a white hexagon shell should appear round it and turn slowly; shots on it make the rim flash bright. When it drops, the shell should break into 6 pieces, the core should glow and pulse, and a white ring should shrink onto the core over about 2.5 s.
