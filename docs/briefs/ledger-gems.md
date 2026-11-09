# Ledger: gems

Create and check out branch feat/ledger-gems before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: new src/economy/, new tests/economy/
Do not touch: everything else (Scribe edits src/ui strings and Shipwright adds Capacitor in parallel; wiring into the game and the save comes in a later wave)
Read first: docs/16-public-plan.md (Economy principles, risk 2, risk 4), src/core/settings.ts (how persistence and the sow. prefix work, read only), the results and stars code (src/ui/results.ts, src/game/objective.ts, read only) to see which events exist

## Goal
P1 economy core: gems earned in play, spent later in the Repo shop. Pure, tested, ready to wire.

## Acceptance
- src/economy/earn.ts: an earn table as data (placeholders from the plan: first star on a level 5 gems, each further star 5, first clear of a boss level 50, Endless score milestones 10 to 100 once each, Free Play 0) and a pure function from a result event (mode, level index, difficulty, stars before and after, boss level, score) to a gem award. Each award is earned once (no farming the same star twice).
- src/economy/ledger.ts: an append only ledger of earn and spend entries with ids, a balance, idempotent apply (the same event id twice changes nothing), spend refusing a negative balance, and an inventory of owned item ids.
- src/economy/save.ts: a versioned JSON schema (v1) for the ledger and inventory, a migration hook, and validation that rejects corrupt data without throwing (falls back to an empty wallet and reports it).
- No randomness at all. No real money concepts in this module (purchases come later through the platform adapter). No UI, no wiring, no storage calls (a later wave wires storage).
- Vitest: earn rules per mode and difficulty, idempotency, balance never negative, save round trip, migration from a hand written v0, corrupt input. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-gems.md under 15 lines with the public API. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random. No em or en dashes.
