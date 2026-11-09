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
- npm test (rerun, `npm test 2>&1 | tail -15`): FAILED, exit 1.
  `Tests  1 failed | 4851 passed | 1 skipped | 2 todo (4855)` and `Test Files  1 failed | 341 passed (342)`.
  The one failure is a wall-clock budget test, tests/levelgen/generator.test.ts:240 "generation is fast: 200 levels under 500 ms (flag on)", measured 682.7 ms against a 500 ms budget while 342 workers ran in parallel. It is unrelated to ci.yml but may make the `gate` check flaky on a slow runner. Not fixed here (tests/ is outside my ownership).
- npm run build: produced dist/ (tail: dist/sw.js, dist/workbox-d8ed3718.js).
- v7 grep over src/ and tests/: printed nothing (grep exit 1).
- Dash check: this VM has no `origin` remote, so `origin/main...HEAD` could not be used. I checked ci.yml directly with the same perl command: exit 0. Run against `main...HEAD` after commit, see below.

## Risks
- On manual `workflow_dispatch` there is no base ref, so the dash step skips by design.
- The dash step uses `xargs -0` so filenames with spaces work; deleted files are excluded by the diff filter.
- The job name `gate` must match the ruleset's required check name.

## Open questions
- Push: origin set to stoopstoop/shape-of-war and the branch pushed.
- Should the timing test in tests/levelgen/generator.test.ts get a looser budget before `gate` is made required?

## Session
https://claude.ai/code/session_018Gwqi73atQNe9pvDQkaRTo
