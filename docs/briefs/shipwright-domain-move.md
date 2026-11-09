# Shipwright: domain-move

Branch: chore/shipwright-domain-move (create and check out before any edit; never push main)
Model: sonnet
Owned paths: .github/workflows/deploy.yml, vite.config.ts (the `base` line only), new src/ui/moveNotice.ts, src/ui/menu.ts (one call site only), new tests/ui/moveNotice.test.ts
Do not touch: everything else, including public/manifest.webmanifest (already relative), package.json, src/economy/, capacitor files
Read first: CLAUDE.md, .github/workflows/deploy.yml, vite.config.ts, src/ui/menu.ts, docs/pixi8-cheatsheet.md if you touch Pixi (you should not need to)

## Goal
The game moves from https://stoopstoop.github.io/shape-of-war/ to https://play.shapelegend.com/ (repo transfer to the ryanstewdio organization, then a Pages custom domain). Two changes: the build picks its base path from Pages itself, so the same code serves under /shape-of-war/ before the cutover and under / after it; and players on any github.io copy see a notice pointing to the new home.

## Acceptance
- deploy.yml: run `actions/configure-pages@v5` with `id: pages` before the build steps (keep it in the build job), and pass `SOW_BASE: ${{ steps.pages.outputs.base_path }}/` as env to the `npm run build` step. Nothing else in the workflow changes.
- vite.config.ts: `base: process.env.SOW_BASE || '/shape-of-war/'`. The `build:cap` script still overrides with `--base=./`.
- Prove both: `SOW_BASE=/ npm run build` puts asset URLs at `/assets/...` in dist/index.html; plain `npm run build` keeps `/shape-of-war/assets/...`. Paste both grep lines in the hand-off.
- src/ui/moveNotice.ts: a pure `shouldShowMoveNotice(hostname: string): boolean` that is true only when hostname ends with `.github.io`, plus a DOM helper that adds one banner to the main menu, styled with the menu's existing classes and fonts. Text, exactly: "Shape Legend has a new home: play.shapelegend.com. Open it there and add it to your home screen. Progress here does not carry over." A tap on the banner opens https://play.shapelegend.com/ in a new tab. Touch only. No storage writes, no network calls.
- src/ui/menu.ts: one call to the helper when the main menu opens. Nothing else in menu.ts changes.
- tests/ui/moveNotice.test.ts: hostname cases (stoopstoop.github.io true, ryanstewdio.github.io true, play.shapelegend.com false, localhost false).
- npm test and npm run build pass on the branch; the Pixi v7 grep from CLAUDE.md prints nothing.

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts. Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new dependency. No em or en dashes in any file you write.

## Hand off
Write docs/handoffs/shipwright-domain-move.md: what changed, files touched, tests added, the two base grep lines, test and build summary, risks, open questions, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). Commit and push the branch. Stop.
