# Furiosa templates

Two templates for the Furiosa lane (see AGENTS.md at the repo root). Claude writes every Furiosa issue on Template 1 and every review of a Furiosa pull request on Template 2. Fill each field; write "none" rather than leaving one out. Quote only from this repository.

## Template 1: the issue

```
Title: <short imperative title>
Issue id: #<n>
Gates: <which of (a) to (h) are confirmed, for example "a b c d e f g h confirmed" or "a c d confirmed; Preparation Mode on">

## Bad news and blockers
<anything known to be broken, risky or unresolved; "none" if nothing>

## Goal
<one or two sentences: what changes and why>

## Context extracts
<short quotes from files in this repo, each with its path and line numbers>

## Allowed paths
<every file or directory Furiosa may change; nothing else may change>

## Forbidden paths
<the AGENTS.md section 4 write bans, plus any extra paths for this issue>

## Reserved names
<identifiers, files, storage keys or exports Furiosa must not create, rename or remove>

## Acceptance criteria
1. <testable item>
2. <testable item>

## Commands to run
1. npm ci
2. CI=true npm test
3. npm run build
4. The PixiJS v7 grep from .github/workflows/ci.yml
5. The dash check from .github/workflows/ci.yml
<plus any issue specific command>

## Out of bounds
<work that is tempting but not part of this issue>

## PR requirements
Branch cx/<n>-<slug> from current main. One PR against main. Body: bad news first, exact git diff --stat, what was left out, each command with its exact output tail, risks, the model name exactly as the Codex model control shows it.

## Expected verdict shape
Under 40 lines in the task thread, last line "Verdict: ready for review" or "Verdict: blocked: <reason>".

--- end of issue <n> body ---
```

## Template 2: Claude's PR review comment

```
## Review of PR #<pr> for issue #<n>

### Files against the allowed list
<each changed file from git diff --stat, marked allowed or NOT ALLOWED>

### Acceptance criteria
1. <item>: pass or fail. Evidence: <test name, output line or file and line>
2. <item>: pass or fail. Evidence: <...>

### Commands rerun in a fresh worktree
- npm ci: <tail>
- CI=true npm test: <tail; timing only failures listed separately>
- npm run build: <tail>
- PixiJS v7 grep: <empty or hits>
- Dash check: <empty or hits>

### Rule checks (AGENTS.md section 8)
- TypeScript strict, no any: <pass or fail>
- PixiJS v8 only: <pass or fail>
- Math.random only in src/core/rng.ts: <pass or fail>
- Touch only: <pass or fail>
- applyNeon(n) only neon entry point: <pass or fail>
- No new dependency: <pass or fail>
- No audio, image or font files beyond PWA icons: <pass or fail>
- Vitest for every pure module touched: <pass or fail>
- Normal difficulty bit identical: <pass or fail>
- No em or en dashes: <pass or fail>

### Findings
<numbered, most serious first; "none" if nothing>

### Recommendation
<ready for Ryan to consider merging, or revise (round <k> of 3) with the list of fixes, or close>

This review is not Ryan's approval. Only Ryan merges.
```
