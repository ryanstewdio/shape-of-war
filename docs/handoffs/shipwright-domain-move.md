# Hand-off: shipwright domain-move

Branch: chore/shipwright-domain-move

## What changed
- deploy.yml: `actions/configure-pages@v5` (id `pages`) now runs before the build steps in the build job. The old later copy was removed, so it runs once. The `npm run build` step gets `SOW_BASE: ${{ steps.pages.outputs.base_path }}/`.
- vite.config.ts: `base: process.env.SOW_BASE || '/shape-of-war/'`. `build:cap` still overrides with `--base=./`.
- src/ui/moveNotice.ts: pure `shouldShowMoveNotice(hostname)` (true only for `.github.io`) and `addMoveNotice(menuRoot)`, which adds one tap banner with the exact required text. A tap opens https://play.shapelegend.com/ in a new tab. No storage, no network. It reuses the `sow-btn` and `sow-menu-info` classes.
- src/ui/menu.ts: one call, `addMoveNotice(s.root)`, in `createMenuScreen`, plus its import.

## Files touched
.github/workflows/deploy.yml, vite.config.ts, src/ui/moveNotice.ts, src/ui/menu.ts, tests/ui/moveNotice.test.ts, this file.

## Tests added
tests/ui/moveNotice.test.ts: 2 tests (5 hostname cases: stoopstoop.github.io, ryanstewdio.github.io, play.shapelegend.com, localhost, github.io.evil.com).

## Base proof
- `SOW_BASE=/ npm run build`: `"/assets/index-BdUH3eQK.js`
- `npm run build`: `"/shape-of-war/assets/index-C_1pPM4_.js`

## Test and build
- npm run build: pass (both variants). The Pixi v7 grep prints nothing.
- npm test: 4913 passed, 1 failed. The failure is `tests/levelgen/generator.test.ts` "generation is fast: 200 levels under 500 ms". It is a wall-clock check (556 ms in the full run, 522 ms on the untouched base), so it fails without my changes too on this machine.

## Risks
- The banner is created when the menu screen is built (once at boot), not on each show(). It stays in the root, so it appears whenever the menu is open. Hiding it on other screens relies on the screen root being hidden.
- Banner placement is absolute, bottom of the menu root. It was not checked visually on the Fold cover screen.
- The deploy workflow was not run here. `base_path` is empty before the cutover, so `SOW_BASE` becomes `/`. Check that the first deploy really serves under /shape-of-war/. The expected value for a project page is `/shape-of-war`.

## Open questions
- Should the banner re-check on every show()? That needs a change to menu.ts beyond one call site.

## Session
https://claude.ai/code/session_018Gwqi6nuM4QTwEqf7RJeGD
