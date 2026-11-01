# Chorus: music-v34

Create and check out branch feat/chorus-music-v34 before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/audio/, tests/audio/
Do not touch: src/game/, src/core/, src/render/, src/ui/, docs/ other than your hand off
Read first: src/audio/music/tunes.ts, src/audio/music/kills.ts, src/audio/music/harmony.ts, src/audio/music/scale.ts, src/audio/music/track.ts, src/audio/music/battle.ts; skim src/audio/music/engine.ts only for the voice and effect graph. Do not read src/audio/music/index.ts in full (1500 lines): search it.

## Goal
Music has rated 3 of 5 at three gates. Ryan (2026-11-01): "melodies are too similar, need more creative compositions and at times a space and sci-fi feel to the music. More variety in the notes created by kills by varying note length, loudness, echo, and some notes should have arpeggio. Music should resemble classic video game music from years 1980 to 2000."

## Acceptance
- Style: original compositions in the idiom of 1980 to 2000 console and arcade music (square and pulse leads with duty cycle changes, triangle bass, noise percussion, fast arpeggiated chords, pitch slides and vibrato on held notes, later 16 bit style FM like bells and pads). Every melody must be newly written here; do not reproduce or closely paraphrase any existing game theme.
- Variety: rewrite the four level tunes and three battle tunes so no two share a melodic contour, rhythm cell or chord progression. Each tune gets an A and a B section plus a bridge (at least 3 distinct 4 bar phrases), its own tempo within 100 to 150 BPM, its own lead timbre, and its own mode (mix minor, dorian, phrygian, lydian, whole tone for a sci-fi section). Add 2 new level tunes with a space feel (slow lydian or whole tone pads, long echo, sparse bell lead, filtered noise wind) so 6 level tunes rotate. A test computes interval contour and rhythm signatures per phrase and fails if any two tunes share a phrase signature.
- Space moments: every level tune drops into a 4 to 8 bar sparse space breakdown (pads, delay, no drums) at least once per loop.
- Kill notes: vary per kill by a deterministic hash of the kill index and enemy kind (no PRNG): note length (short staccato to half beat), loudness (3 levels), echo send (none, short slap, long dotted eighth echo), and about 1 kill in 4 plays a fast 3 or 4 note arpeggio of the current chord instead of a single note; combo kills climb the arpeggio. Notes stay in key with the current harmony. Voice cap and ducking respected.
- Battle tunes stay minor and intense but distinct from each other; boss entry, phase and death stingers unchanged.
- All synthesised, no asset files. Respect the music volume setting (default 50, play only). Tests for the pure helpers (signatures, kill variation table, arpeggio builder). npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/chorus-music-v34.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
