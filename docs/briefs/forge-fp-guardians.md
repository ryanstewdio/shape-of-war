# Forge: fp-guardians

Create and check out branch feat/forge-fp-guardians before any edit. Never push main. You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/game/ (Free Play guardian timing), src/levelgen/freeplay.ts (Free Play boss schedule only), src/core/freeplayConfig.ts (rename the 'every3' value only if needed, keeping old saves working), src/ui/freePlay.ts (the guardian option label only), tests/game/, tests/levelgen/, tests/ui/
Do not touch: src/levelgen/boss.ts (Foundry changed the order), src/story/, src/render/, src/audio/, docs/ other than your hand off
Read first: src/core/freeplayConfig.ts (FreePlayBosses), src/levelgen/freeplay.ts (how 'every3' schedules guardians today: first at 1:40, then every 5 minutes), the Free Play boss arrival code in src/game, src/ui/freePlay.ts (label "Every 3 min")

## Goal
Ryan ruled 2026-11-10: in Free Play the guardian option means one guardian at a time, the first at 2:00, then the next 2 minutes after the previous one is freed. Only one guardian is ever alive (no multiple bosses). Guardians follow the Adventure order (Brood first; Foundry's guardian-order branch changes the ladder in parallel).

## Acceptance
- With the guardian option on: first guardian enters at 2:00 of play; each next guardian enters 120 s after the previous one is freed (time paused does not count); never two alive. A run shorter than 2:00 meets none.
- The option label reads "Every 2 min" (old saves with 'every3' load as the new option). The single chosen boss option is unchanged.
- Deterministic; Endless and Adventure untouched (bit identical).
- Tests: first entrance at 120 s, next 120 s after a kill, never two alive, label and old save mapping. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/forge-fp-guardians.md under 10 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Deterministic simulation. Touch only. No em or en dashes.
