# Ledger: menu-store

Create and check out branch feat/ledger-menu-store before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: sonnet
Owned paths: src/core/settings.ts, src/main.ts, tests/settings/, tests/qa/storageKeys.test.ts, tests/qa/storageKeysV2.test.ts, tests/qa/storageKeysV3.test.ts, the settings key table in docs/13-v3-spec-addendum.md (that table only)
Do not touch: src/audio/ (import only), src/render/, src/game/, src/ui/, docs/ other than the key table and your hand off
Read first: docs/handoffs/chorus-menu-themes.md (Requests section), src/core/settings.ts (the glowPath and spacePhysics load and save pattern), src/main.ts (search wireMusic), tests/qa/storageKeysV3.test.ts

## Goal
The three menu themes rotate within a session but restart on the first theme at every boot, because audio may not name a storage key.

## Acceptance
- settings.ts: MENU_THEME_KEY = sow.settings.menuTheme, loadMenuTheme(): string | null and saveMenuTheme(raw: string), every read and write in try/catch like the others.
- main.ts: pass menuStore: { load: loadMenuTheme, save: saveMenuTheme } to the music wiring (wireMusic options; check MusicOptions.menuStore in src/audio/music/index.ts).
- Storage audits: register sow.settings.menuTheme in the storage key tests and the docs/13 key table so every audit passes.
- Tests: load and save round trip, throwing storage, the key registered. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/ledger-menu-store.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
