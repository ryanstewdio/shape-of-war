# Hand-off: shipwright guide-images-96dcc2a

Branch: feat/shipwright-guide-img-96dcc2a

## Files
- Changed: scripts/guide-images.ts, docs/player-guide/img/shapes/_all.svg
- Added (docs/player-guide/img/shapes/): boss-warden, boss-brood, boss-spindle, boss-ember, boss-mirage, boss-gravitas, boss-bastion, boss-tempest, boss-twins, boss-prism, _bosses, leaver, leavershard, dronepickup, dronetwin, snake, well (all .svg)
- Removed: none
- All 25 older images were regenerated; only _all.svg differed, because the existing shape specs are unchanged since v2.0.0 and the sheet now has the new cells.

## Script changes
- _all.svg: 28 cells, every enemy kind and pickup. Boss, BossPart and BossHazard registry kinds are left off it (bosses have their own sheet).
- snake.svg and well.svg are alias files for the FOE_INFO kinds snake and well. They draw the same spec as snakehead.svg and gravitywell.svg and are not on the sheet.
- Boss images use the shut body spec of each boss in its baked colour, with their own shared scale (0.90 px per unit) because bosses are up to 106 u. _bosses.svg is 5 columns by 2 rows in level order, labelled with BOSS_NAMES.
- Labels are display names only. No game title, no em or en dashes (grepped).

## Shapes with no spec (not drawn)
- Nova snake: no ShapeSpec. It is drawn procedurally (drumPen.ts and gemGlint.ts), so there is no novasnake.svg.
- Membrane hazard: src/render/membrane.ts is bar styling only, no ShapeSpec, so there is no membrane.svg.
- Mine: has a spec (mine.svg, regenerated).

## Determinism proof
sha256 of the folder listing (sha256sum * | sha256sum), run 1 then run 2:
- 902939017a6a2578b43e035eb0889ce05727d80bff40317c922acd47bb4023b6
- 902939017a6a2578b43e035eb0889ce05727d80bff40317c922acd47bb4023b6

## Tests and build
- npm run build: pass.
- npm test: 5038 passed, 1 failed (360 of 361 files). I did not capture which file failed in the full run. tests/levelgen/genPerf.test.ts, the known flaky perf test, passes when run alone (6 of 6). Treat the full run failure as probably that test, not confirmed.
- No test files exist for the script.
- The v7 grep over src/ and tests/ printed nothing.

## Notes
- npm ci was needed in the fresh container before the script could import vite. No package.json change.
- The brief named branch feat/shipwright-guide-img-96dcc2a, while the session setup named claude/shipwright-guide-images-s50h94. I used the brief's branch as the user instructed.

Session: https://claude.ai/code/session_018Gwqi3GSBpuKD1jfn6Bx1b
