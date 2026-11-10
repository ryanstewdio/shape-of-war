# Shipwright: ci-docs-fast

Branch: chore/shipwright-ci-docs-fast (create and check out before any edit; never push main)
Model: sonnet
Owned paths: .github/workflows/ci.yml
Do not touch: everything else, including .github/workflows/deploy.yml
Read first: CLAUDE.md, .github/workflows/ci.yml

## Goal
main now requires the `gate` check on every pull request. Docs-only pull requests (briefs, status, decisions) should not wait about 8 minutes for the full test suite. Keep one job named `gate` that always runs and always reports.

## Acceptance
- Add an early step "Classify changes" (after checkout with fetch-depth 0) that lists changed files with `git diff --name-only origin/${{ github.base_ref }}...HEAD` and sets an output `docs_only=true` only when every changed file matches `docs/**` or ends in `.md`. On workflow_dispatch (no base ref) or an empty list, `docs_only=false`.
- setup-node, npm ci, Tests, Build and the Pixi v7 grep run only when `docs_only != 'true'`. The dash check always runs.
- No new actions, no third party path filter action, permissions stay contents: read, job id and name stay `gate`, triggers unchanged.
- Prove it locally in the VM: show the classify logic's output for three file lists (docs only; docs plus src/main.ts; README.md only), plus `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`.
- npm test and npm run build pass on the branch.

## Rules
No em or en dashes in any file you write. No new dependency.

## Hand off
Write docs/handoffs/shipwright-ci-docs-fast.md: what changed, the three classify outputs, test and build summary, risks, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). Commit and push the branch. Stop.
