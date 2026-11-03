# Foundry: r2-freeplay

Create and check out branch feat/foundry-r2-freeplay before any edit. Never push main. Start from the current local main.

Model: opus
Owned paths: src/levelgen/, tests/levelgen/, tests/qa level pins (update only, list each)
Do not touch: src/core/, src/game/, src/render/, src/audio/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: src/levelgen/freeplay.ts (the stub: FreePlayOptions, freePlayLevel returns an EndlessDef), src/levelgen/generator.ts (generateEndless, generateEndlessSegment, cylinder and drum patterns, boss levels and the v5 waves they still use), src/levelgen/leveldef.ts

## Goal
Release gate R2 (Ryan): a Free Play mode (endless style, the player picks arena rectangle, circle or drum and barriers on or off); boss levels: "pre boss time felt a little long, reduce slightly; level 5 pre boss enemies are produced slowly and not in high volume even on Insane".

## Acceptance
- freePlayLevel(o): an EndlessDef whose arena follows o.arena (rect, circle, or a cylinder drum with surface cylinder and a width multiple of 64) and o.barriers (rect and circle: obstacles from the existing placement; drum: a ring or pillar pattern; off: none), with the normal endless segments and roster. Deterministic from o.seed; validates; tests for each arena and barrier combination.
- Boss levels: move the boss to 200 s (from 240) and give the pre boss waves the v6 pacing (no dead air over 3 s, surges and swarms, volume like a v6 level of the same band), keeping boss levels flat. Update the boss tests this breaks in tests/levelgen only and list any test outside your ownership that needs Fable.
- Flat invariants for the V1 to V5 configs, determinism, a version bump stated. npm test and npm run build pass on the branch (accepted perf exception aside). Commit on the branch. Do not push; the dispatcher reports the branch. Hand off under 40 lines as your final message.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. No em or en dashes.
