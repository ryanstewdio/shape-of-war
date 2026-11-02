# Hand-off: scribe guide-v3

Branch: docs/scribe-guide-v3

## What changed
- docs/player-guide/README.md header now describes main at 91c49c8 (v3, 2026-11-02).
- "Changed in this version" rewritten as 7 bullets: ten bosses, six combos, drone pickups, chainsaw, wells and nova snakes, settings and music, cylinder levels.
- One v3 line added to the Changelog table.

## Files touched
- docs/player-guide/README.md
- docs/handoffs/scribe-guide-v3.md (this file)

## Tests added
None (docs only).

## Test and build
- npm test: not run (docs only, per brief).
- npm run build: failed with BUILD_EXIT=2. node_modules is not installed in this VM, so tsc cannot find the node and vite/client types. Not caused by this change.

## Risks
- Other guide sections still describe v2.0.0; the header says so.
- Boss one-liners come from docs/13 roster and src/game/bosses/table.ts. No numbers for bosses or the chainsaw are in the guide.
- Chainsaw wording ("hold aim and the bar extends") is from commit titles, not confirmed in source.
- Settings bullet is brief on Effects and Music, which already existed in v2.
- The brief's add_repo step has no tool in this session; I added the origin remote by hand.

## Contracts for other roles
None. No code, events or images touched.

## Device check for Ryan
Open the guide on the branch and read the top. The header should name 91c49c8 and v3. Under "Changed in this version" you should see seven bullets and the last Changelog row should be v3. Confirm the ten boss names and six combo names match what you see in game, and that the chainsaw line matches how it plays.

Session: https://claude.ai/code/session_018Gwqi2tCEXvdtKkmSfNjQ7
