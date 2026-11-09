# Shipwright: ci-gate

Branch: chore/shipwright-ci-gate (create and check out before any edit; never push main)
Model: sonnet
Owned paths: .github/workflows/ci.yml (new file only)
Do not touch: .github/workflows/deploy.yml, package.json, package-lock.json, src/, tests/, scripts/, CLAUDE.md, SPEC.md, docs/ except your hand-off
Read first: CLAUDE.md, .github/workflows/deploy.yml

## Goal
Add a pull request check named `gate` so a branch ruleset on main can require it. Today the only workflow is deploy.yml, which runs on push to main, so no check runs on a pull request.

## Acceptance
- New file .github/workflows/ci.yml, workflow name `ci`, one job with id `gate` and `name: gate`, so the check appears as `gate`.
- Triggers: `pull_request` targeting main, plus `workflow_dispatch`. No push trigger (deploy.yml already covers main).
- permissions: contents: read only. No secrets, no environment, no actions beyond actions/checkout@v4 and actions/setup-node@v4 (node-version 22, cache npm), the versions deploy.yml uses.
- Steps in order: npm ci; npm test; npm run build; the Pixi v7 grep from CLAUDE.md "Definition of done", failing the step when the grep prints anything; a dash check that fails if any file changed by the pull request contains U+2013 or U+2014. For the dash check use checkout with fetch-depth 0, list files with `git diff --name-only --diff-filter=AMR origin/${{ github.base_ref }}...HEAD`, and test them with `perl -CSD -ne 'if (/[\x{2013}\x{2014}]/) { print "$ARGV:$.: $_"; $f=1 } END { exit($f ? 1 : 0) }'`. Skip that step cleanly when no files changed.
- Each step has a plain `name:` so a failure says which rule broke.
- Do not open a pull request. Prove the workflow locally in the VM instead: npm ci, npm test, npm run build, the v7 grep, and the dash check against `origin/main...HEAD`; paste the tail of each in the hand-off. Check the YAML parses with `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` if python3 has yaml, otherwise say so.

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts. Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new dependency. No em or en dashes in any file you write.

## Hand off
Write docs/handoffs/shipwright-ci-gate.md: what changed, files touched, the local outputs above, risks, open questions, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). Commit and push the branch. Stop.
