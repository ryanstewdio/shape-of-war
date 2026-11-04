# Ledger: r7-details

Create and check out branch feat/ledger-r7-details before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/ui/results.ts, src/ui/intro.ts, the Details component and its styles in src/ui/, tests/ui/
Do not touch: everything else
Read first: the Details row on the results and intro screens

## Goal
Gate R6 (Ryan): results 3.75: "the Details section, once expanded, is poorly formatted with little margin between words and the border."

## Acceptance
- Expanded Details: a two column label and value grid (labels dim, right aligned values or left aligned in a second column), 16 px inner padding, 10 px row gap, 16 px column gap, values never touching the border, wraps cleanly on the cover screen; the same on the intro card. Tests for the structure (grid, every row labelled). npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/ledger-r7-details.md under 20 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes.
