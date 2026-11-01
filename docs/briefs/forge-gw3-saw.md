# Forge: gw3-saw

Create and check out branch feat/forge-gw3-saw before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/game/ except src/game/bosses/, tests/game/ except tests/game/boss*
Do not touch: src/game/bosses/, src/core/, src/render/, src/audio/, src/ui/, src/input/, src/gen/, tests/qa/ (except reading), docs/ other than your hand off
Read first: src/game/weapons.ts (orbit v2, saw level, spikeLen, sawWeight), src/game/bullets.ts (BulletPool, capsuleHits), src/game/enemies/sower.ts, the pause and resume path in src/game/game.ts

## Goal
Device gate GW3 (build 675f6c3, Ryan): (1) orbit chainsaw: "I hear the growls and see a white backdrop but no extension of the saw like a chainsaw"; cuts faster yes; feel 3 of 5. The tangent stretch along the ring does not read as a chainsaw. Ryan wants the spikes to extend out toward the aim like a chainsaw bar. (2) Sower "only moves on the edge of the arena; spontaneously a sower should change direction toward the centre, then return to the edge and continue rotating, in a loop of at least 20 s." (3) Chorus asked for sim:saw off on pause and on again at resume.

## Acceptance
- Chainsaw bar: while the saw level s is above 0, both rings' tracks bend out toward the aim into a bar: a spike at ring angle a sits at radius r0 * (1 + s * K * f(a - aim)) where f is a smooth bar profile (1 within 25 degrees of aim, falling to 0 at 70 degrees, for example cos^6 clamped), K = 2.2 for the outer ring (100 u to 320 u at the tip) and 1.6 for the inner ring. Spikes keep their spin, so they run out along one side of the bar, round the tip and back along the other, like a chain. The bar follows the aim stick each step and its reach ramps with s (0.25 s up, 0.25 s down as now). Store each spike's direction of travel along the bent track in its vx, vy (unit tangent of the track, so the renderer can orient teeth), keep spikeLen (rest 24, up to 40 on the bar; drop the 2.5x tangent stretch). Hits: capsule from the previous to the current spike position, so fast spikes on the bar never tunnel; saw power rules (1.5x damage, 0.7x cooldown, non boss) unchanged. Pure helpers for the bar profile and track radius with tests: tip reach, profile shape, ramp, counter rotation kept, determinism.
- Sower roam: each Sower orbits the edge as now for a hashed 12 to 18 s (from its spawn index and the level seed, no PRNG), then turns and moves toward the arena centre until within 150 u of it (steering smoothly, same speed rules), then returns to the edge and resumes its orbit; one full loop takes at least 20 s; it keeps sowing on the way. Tests: timing, centre reach, return to edge, loop length, determinism.
- sim:saw: emit { on: false } when the game pauses with the saw active and { on: true } at resume if it is still held.
- tests/qa snapshots unchanged. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/forge-gw3-saw.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
