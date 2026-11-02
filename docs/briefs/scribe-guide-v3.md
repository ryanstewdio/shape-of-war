# Scribe: guide-v3

Create and check out branch docs/scribe-guide-v3 before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: sonnet
Owned paths: docs/player-guide/README.md only
Do not touch: anything else (no code, no images, no the HTML file)
Read first: the header and section 5 "Changed in this version" and section 15 "Changelog" of docs/player-guide/README.md; then git log --oneline 13b7d96..origin/main | head -120 for the list of changes; read source files only to confirm a specific number

## Goal
Ryan: keep the guide update to a minimum token cost. The guide describes v2.0.0 (13b7d96); v3 shipped bosses, weapon combos, drone pickups, nova snakes, wells over time, the orbit chainsaw bar, crystal whirlpools, more music and menu themes, the 3D tilt setting and cylinder levels.

## Acceptance
- Update the header line to describe main at the current origin/main sha, version v3 (date 2026-11-02).
- Rewrite "Changed in this version" as a compact list (at most 30 lines) of what a player notices: the ten bosses every 5th level (names and one line each), weapon combining and the six combo names, drone pickups (four modes), the chainsaw (hold aim with orbit), wells arriving during play and nova snakes, Settings additions (3D tilt Off Low High, effects, music), cylinder levels (from level 11, wrap left to right, the drum view), menu themes. Add one Changelog line for v3.
- Do not rewrite other sections, regenerate images or edit the HTML. Hand off under 20 lines. Work cheaply: no full test run is needed for a docs only change (run npm run build once only if you touch nothing but this file, skip tests).

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/scribe-guide-v3.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
