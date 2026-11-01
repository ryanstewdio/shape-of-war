# Chorus: mix-v35

Create and check out branch feat/chorus-mix-v35 before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/audio/, tests/audio/
Do not touch: src/game/, src/core/, src/render/, src/ui/, docs/ other than your hand off
Read first: src/audio/music/engine.ts (master and effect graph), src/audio/synth.ts, src/audio/gw2Synth.ts, src/audio/music/compose.ts, src/audio/music/kills.ts; search src/audio/music/index.ts, do not read it in full.

## Goal
Music listen M1 (build 75f2b76, Ryan): music now 4 of 5 and retro 4, "could use more variety and arpeggio". The space breakdown (drums drop for 4 bars into an echoing pad with wind after 30 to 40 s) was NOT heard on device. Ryan: "sounds and music are likely too high of a frequency; with earbuds the sound is slightly sharp and irritating; they have improved but need a reduction in highs."

## Acceptance
- Highs: add a master tone stage for music and sfx: a high shelf cut of about 6 dB above 5 kHz and a gentle low pass around 9 kHz, plus per voice: square and sawtooth leads through a low pass that tracks pitch (cutoff about 6x the note frequency, capped at 5 kHz); fast attacks get at least 4 ms; noise hits band limited below 7 kHz. Keep loudness perceived about the same (compensate gain by at most 2 dB). Tests on the pure parameter helpers (cutoff tracking, shelf values) and a test that every lead and sfx voice routes through the tone stage.
- Space breakdown: find why it was not heard (scheduler, intensity gating, or it only fires on certain tunes or after a long loop) and make it reliable: every level tune enters a breakdown between 30 and 45 s of play, then every 90 to 120 s; drums and bass fully drop, pad and echo rise so it is clearly audible at music volume 50. Test on the real scheduler timeline for all six level tunes.
- More variety and arpeggio: add arpeggio figures to the lead and accompaniment in every tune (at least one arpeggiated section per tune, 16th note runs over the chord, up, down and up down patterns that vary per section), and vary each tune's second loop (transpose up a step or change the lead timbre) so repeats do not sound identical. Keep the variety signature test passing.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/chorus-mix-v35.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
