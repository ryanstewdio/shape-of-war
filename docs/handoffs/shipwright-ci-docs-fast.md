# Shipwright hand-off: ci-docs-fast

Branch: chore/shipwright-ci-docs-fast

## What changed
Only `.github/workflows/ci.yml`. Added a "Classify changes" step after checkout (id `classify`). It lists changed files with `git diff --name-only origin/<base_ref>...HEAD` and sets `docs_only=true` only when every file matches `docs/*` or `*.md`. With no base ref (workflow_dispatch) or an empty list it sets `docs_only=false`. The setup-node, npm ci, Tests, Build and Pixi v7 grep steps now carry `if: steps.classify.outputs.docs_only != 'true'`. The dash check always runs. Job id and name stay `gate`, triggers and permissions unchanged, no new actions.

## Classify outputs (logic extracted from the YAML and run locally)
- docs/briefs/a.md + docs/STATUS.md: docs_only=true
- docs/a.md + src/main.ts: docs_only=false
- README.md only: docs_only=true

`yaml.safe_load` of ci.yml: ok.

## Test and build
- npm run build: passed (dist produced).
- npm test: 5127 passed, 1 failed, 1 skipped, 2 todo. The failure is `tests/levelgen/generator.test.ts` "generation is fast: 200 levels under 500 ms (flag on)" (521 ms). It is a timing assertion, fails the same way when run alone on this slow VM, and this branch touches no source. Not caused by this change.

## Risks
- Branch protection on `gate` still passes on docs-only PRs because the job always runs and reports.
- A PR mixing docs and any non-docs file runs the full suite.
- Classification uses the diff against the base branch tip, so the base must be fetched (fetch-depth 0 does this).

## Session
https://claude.ai/code/session_018Gwqi3AdCAbLLi4ZPEJUZq
