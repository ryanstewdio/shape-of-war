# Glow: gw2-look

Create and check out branch feat/glow-gw2-look before any edit. Never push main.

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/audio/, src/ui/, src/input/, docs/ other than your hand off
Read first: src/render/wellNova.ts, src/render/bulletStyles.ts (style 3 spikes), the orbit spike code in src/render/renderer.ts (search "orbit spikes", shieldOf), src/render/bossShapes.ts and src/render/partLooks.ts (Warden), src/game/bosses/view.ts and src/game/bosses/state.ts (read only: shieldLeft, windows), src/game/bullets.ts (read only: BulletPool.spikeLen)

## Goal
Device gate GW2 (build cbd5a4d, Ryan). Fails to fix: (1) the supernova still does not read as a tornado. Ryan: "The gravity well should appear like a whirlpool with the white star gas and dust swirling violently in clockwise motion down into the well." (2) Orbit chainsaw stretch not visible (cause found: the renderer never reads BulletPool.spikeLen, added by Swarm in wave 2); orbit feel rated 2 of 5. (3) Warden: "difficult to visually discern Warden is shielding"; the open core window after the shield was not seen. (4) Nova snakes were not seen emerging.

## Acceptance
- Whirlpool nova: replace the arm spiral with a whirlpool of white gas and dust (hsl 0 0 95 percent base, Bulwark shield white) spiralling inward and clockwise as seen on screen, fast and violent (angular speed rising toward the core, at least 4 rad per s at the core and about 1 rad per s at the rim), drawn as 3 to 4 layered translucent spiral bands plus 60 to 90 dust motes on log spiral paths that fall into the core and respawn at the rim (deterministic from the well id and draw clock, no PRNG); the whirlpool's outer edge reaches the sim pull radius (read from the entity) so the pull area reads without any ring: delete the pull ring line. Keep the multicolour shimmer sparks that Ryan approved (yes) but have them spin with the flow. A bright white core flare. Before nova, a calm small swirl at the well so the nova is a clear escalation. Pure helpers (spiral band points, mote path, clockwise sign) with tests asserting clockwise on screen (y down) and inward motion; particle budget test (at most 96) and one Graphics rebuild per nova per frame.
- Well arrival: on sim:wellArrive { id, x, y, inSec } draw a converging ring of white dust at (x, y) that tightens over inSec and flashes when the well appears.
- Snake emergence: on sim:wellSpawn draw a bright burst at the well centre and a short trail so the snake reads as crawling out of the well.
- Orbit spikes: draw each style 3 spike as a sharp triangle whose length follows spikeLen (24 at rest, up to 60) along its tangent (vx, vy), centred on x, y; while stretched add a hot white edge and a short motion smear of 2 ghost copies behind the spin direction so it reads as a chainsaw tooth. Test that drawn length tracks spikeLen.
- Warden shield: while the shield is up (shieldLeft > 0 or sim:bossShield up) draw an unmistakable hexagonal shield shell around the Warden in Bulwark white with a slow rotation, a bright rim pulse on every hit absorbed, and the core dimmed behind it; on drop, the shell shatters into 6 outline shards, and the open core pulses bright with a ring that shrinks over the open window length so the player can see the window closing. Same shell look for any boss that emits sim:bossShield.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-gw2-look.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
