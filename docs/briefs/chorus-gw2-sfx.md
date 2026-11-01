# Chorus: gw2-sfx

Create and check out branch feat/chorus-gw2-sfx before any edit. Never push main.

Model: sonnet
Owned paths: src/audio/, tests/audio/
Do not touch: src/game/, src/core/, src/render/, src/ui/, docs/ other than your hand off
Read first: the sfx registry and bus wiring under src/audio/ (search SfxName, wellNova, bossWindow), src/core/events.ts (sim:wellArrive, sim:saw, sim:bossShield, sim:wellSpawn, read only)

## Goal
Device gate GW2 (build cbd5a4d): orbit feel 2 of 5, Warden shield hard to discern, nova snakes and the nova itself need to read. Sound must carry these moments. All sound is synthesised (no asset files).

## Acceptance
- Chainsaw: on sim:saw on, start a looping saw buzz (detuned sawtooth pair around 110 Hz with a fast 28 Hz amplitude wobble and a band pass sweep), ramp in 60 ms; on sim:saw off, ramp out in 120 ms. One voice only, never stacked.
- Whirlpool: on sim:wellNova start a low roaring swirl (filtered noise with a slow clockwise feeling pan sweep and a rising filter) that lasts while the nova lives, at most 2 voices; stop it on the well's death (existing well death event).
- Well arrival: on sim:wellArrive a 1.5 s rising whoosh ending in a soft thud.
- Snake emergence: on sim:wellSpawn a short wet slither (noise burst through a fast falling band pass).
- Boss shield: on sim:bossShield up a bright glassy chord with a hum underneath while up; on down a shatter (noise burst plus falling pings).
- All new voices respect the master and sfx volume settings, the ducking rules, and the voice cap. Tests for the pure envelope and parameter helpers and for the wiring (each event starts and stops the right voice, no stacking). npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/chorus-gw2-sfx.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
