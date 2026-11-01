# Ledger: tilt-menu

Create and check out branch feat/ledger-tilt-menu before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: sonnet
Owned paths: src/core/settings.ts, src/ui/, src/main.ts, tests/settings/, tests/ui/
Do not touch: src/render/ (import only), src/game/, src/audio/ (import only), src/core/events.ts (emit only), docs/ other than your hand off
Read first: src/core/settings.ts, the Settings screen in src/ui/ (search effects or spacePhysics for an existing three way setting), src/main.ts (search setEffectsTier and the screen flow), src/render/tilt.ts (setTilt, TiltLevel), src/core/events.ts ('ui:screen')

## Goal
Two contracts for wave 6: the 3D tilt setting (Glow builds the projection behind setTilt in parallel) and a screen event so Chorus can play a menu and title theme.

## Acceptance
- Setting sow.settings.tilt: off, low, high, default off, persisted like the other settings (add it to the storage keys test). A Settings row labelled "3D tilt" with Off, Low, High, same control style as the effects tier row. Apply it with setTilt at boot and on change, live while paused.
- Emit 'ui:screen' { screen } every time the visible screen changes: title (the first screen at boot), menu (level select or home list), settings, play (a level or Endless running, including after resume), results. Once per change, never repeated for the same screen. Tests for the setting persistence and for the screen event sequence across boot, menu, start level, pause, resume, results, retry, back to menu.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/ledger-tilt-menu.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
