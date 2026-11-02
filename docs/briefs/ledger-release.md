# Ledger: release

Create and check out branch feat/ledger-release before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/ui/, src/main.ts, src/core/settings.ts, index.html, public/ (manifest and icons only), vite.config.ts (PWA name fields only), tests/ui/, tests/settings/, tests/qa/storageKeys*.test.ts, the settings key table in docs/13-v3-spec-addendum.md
Do not touch: src/game/, src/render/, src/audio/, src/levelgen/, src/core/difficulty.ts (read only), docs/ other than the key table and your hand off
Read first: docs/14-release-polish.md (items 1 to 4 and 6 are yours), src/core/difficulty.ts, src/core/settings.ts, src/main.ts by search (parseLevelQuery, ?boss, tilt knob, showFps), the menu and Settings screens in src/ui/

## Goal
Tester build polish (docs/14). Ryan will share one link with a few friends on Android phones and iPhones.

## Acceptance
- Rename to Shapes of War everywhere a player sees it: document title, manifest name and short_name, the PWA config, menu title, intro cards. Original neon app icon set (192, 512, maskable) drawn as SVG then rasterised at build or committed as PNG in public/icons only (no other asset types), and a title splash on open (the neon title and a slow glow pulse, 1.2 s, skippable by tap, DOM or canvas, no image files beyond the icons).
- Menu footer line: "v3 build <short sha> seed <run seed>" small and dim, so testers can screenshot it (the build sha is injected at build time through a define in vite.config.ts; fall back to "dev").
- showFps default off (existing setting); any debug overlay hidden unless ?dev=1. Every test URL knob (?boss, ?tilt, ?seed, ?level, ?debug, ?surface and any other) is ignored unless ?dev=1 is also present.
- Difficulty setting sow.settings.difficulty: easy, normal (default), hard, a Settings row "Difficulty" like the effects row; pass it to createGame as GameOptions.difficulty (Forge adds the field in parallel: if it is not on main yet, pass it through a typed options object with the field present, using the Difficulty type from src/core/difficulty.ts). Show the difficulty on the intro card. Register the key in the storage audits and the docs/13 key table.
- Tests: rename strings, footer line, dev gate for every knob, difficulty persistence and row, splash skip. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/ledger-release.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
