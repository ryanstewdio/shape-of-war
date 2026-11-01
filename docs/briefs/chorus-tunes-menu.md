# Chorus: tunes-menu

Create and check out branch feat/chorus-tunes-menu before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/audio/, tests/audio/
Do not touch: src/game/, src/core/, src/render/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: src/audio/music/compose.ts, src/audio/music/tunes.ts, src/audio/music/select.ts, src/audio/music/engine.ts (tone stage from mix-v35), src/core/events.ts ('ui:screen', 'game:start', read only); search src/audio/music/index.ts, do not read it in full

## Goal
Music is at 4 of 5. Ryan: to reach 5 he wants more tunes, and a menu and title theme. Keep the style of the last two rounds (original compositions in the 1980 to 2000 console and arcade idiom, space and sci-fi moments, softened highs).

## Acceptance
- Four more level tunes (10 in rotation), each with a distinct contour, rhythm, mode, tempo and lead, A, B and bridge sections, an arpeggio section and the space breakdown; at least one up tempo heroic tune, one dark industrial tune, one dreamy space tune, one bouncy chiptune tune. The variety signature test covers all 10.
- A title and menu theme: on 'ui:screen' title or menu, fade in a dedicated theme (memorable 8 bar hook, then a calmer loop, about 100 BPM, spacey pads and a bell or pulse lead); fade it out over 0.6 s on play, and resume it when the screen returns to title or menu. Settings screen keeps the theme playing. It obeys the music volume setting; at volume 0 nothing plays. One instance only.
- Every melody newly written; do not reproduce or closely paraphrase any existing game theme. Tone stage and highs cut apply to all new voices.
- Tests: signatures for all tunes, menu theme lifecycle on the screen event sequence (start, fade on play, resume on menu, no double start), volume 0 silence. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/chorus-tunes-menu.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
