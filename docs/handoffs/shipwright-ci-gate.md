# Shipwright hand-off: ci-gate

HAND-OFF shipwright: ci-gate
Branch: chore/shipwright-ci-gate

## What changed
Added `.github/workflows/ci.yml`: workflow `ci`, one job `gate` (name `gate`), triggered by `pull_request` to main and `workflow_dispatch`. Permissions are `contents: read` only. Uses actions/checkout@v4 (fetch-depth 0) and actions/setup-node@v4 (node 22, cache npm). Steps in order: npm ci, npm test, npm run build, a Pixi v7 grep step (fails if it prints anything), a dash check on changed files (U+2013 or U+2014, skipped when no files changed or when there is no base ref on a manual run).

## Files touched
- .github/workflows/ci.yml (new)
- docs/handoffs/shipwright-ci-gate.md (this file)

## Local results
- YAML: parsed with python3 yaml, OK.
- npm ci: completed (only npm update notices in the tail).
- npm test: ran to completion (326s, 342 workers). My tail cut off the pass/fail summary line, so I did not see an explicit "passed" count. No failure text appeared in the captured output. Treat as unconfirmed; CI will be the first explicit proof.
- npm run build: produced dist/ (tail: dist/sw.js, dist/workbox-d8ed3718.js).
- v7 grep over src/ and tests/: printed nothing (grep exit 1).
- Dash check: this VM has no `origin` remote, so `origin/main...HEAD` could not be used. I checked ci.yml directly with the same perl command: exit 0. Run against `main...HEAD` after commit, see below.

## Risks
- On manual `workflow_dispatch` there is no base ref, so the dash step skips by design.
- The dash step uses `xargs -0` so filenames with spaces work; deleted files are excluded by the diff filter.
- The job name `gate` must match the ruleset's required check name.

## Open questions
- Push: no git remote is configured in this VM, so the branch could not be pushed (see final message).

## Session
https://claude.ai/code/session_018Gwqi73atQNe9pvDQkaRTo
