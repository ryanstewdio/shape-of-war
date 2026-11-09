HAND-OFF scribe: rename
Branch: feat/scribe-rename
Files changed: src/ui/menu.ts, index.html, public/manifest.webmanifest, README.md, tests/ui/release.test.ts, tests/ui/results.test.ts, tests/ui/vectorFont.test.ts
Tests: existing name asserts updated to Shape Legend, no new tests. Title is 70 cells (was 74), so TITLE_EMS 8.9 still holds on the cover screen and 360 px.
npm test: 4851 pass, 1 fail (generator perf, accepted exception)  npm run build: pass
Unchanged: repo name, package.json, /shape-of-war/ base, sow. keys.
Known gaps: tunes.ts and rng.ts comments still say Shape of War (outside owned paths).
Requests: none
