# Ledger: polish-d

Create and check out branch feat/ledger-polish-d before any edit. Never push main. You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/ui/howTo.ts, src/ui/menu.ts (footer only), src/ui/settings.ts (build label taps only), src/ui/hud.ts (level code line only), src/main.ts (dev panel gesture gate only), package.json ("version" field only), tests/ui/
Do not touch: src/render/ (gate devpanel at the call site in main.ts), src/levelgen/, src/game/, src/audio/, docs/ other than your hand off
Read first: docs/handoffs/scribe-guide-rewrite-96dcc2a.md (items with file and line), src/ui/devGate.ts (how ?dev=1 is read), src/ui/menu.ts footerLine, docs/14-release-polish.md item 4

## Goal
Ryan ruled 2026-11-10 on findings from the player guide rewrite: fix two wrong How to lines, put every developer item behind ?dev=1, and give the menu footer a release version.

## Acceptance
- How to, stars (howTo.ts near line 349): the star lines read 1, 1.25 and 1.5 times par, as the game awards them.
- How to, difficulty (near line 367): no "Change it in Settings"; it says difficulty is chosen on the level start card before each level.
- Developer items only with ?dev=1 (normal players never reach them): the debug panel two finger long press (src/main.ts near 1014), the stress button after 5 taps on the Settings build label (settings.ts near 372 to 385 and 549 to 560), and the level code on the HUD line (hud.ts near 298 to 301). This reverses Ryan's 2026-11-07 choice to keep the HUD line, by his new ruling.
- Menu footer: "Shape Legend v0.9.0 (build <short sha>)". Add "version": "0.9.0" to package.json and read it at build time the same way the build id is read; no run seed in the footer (the start card Details shows it).
- Tests: How to lines, dev gate off and on for each item, footer text. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-polish-d.md under 10 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes.
