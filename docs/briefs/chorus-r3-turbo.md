# Chorus: r3-turbo

Create and check out branch feat/chorus-r3-turbo before any edit. Never push main. Start from the current local main.

Model: opus
Owned paths: src/audio/, tests/audio/
Do not touch: everything else
Read first: src/core/events.ts ('fx:turbo', read only), src/audio/music/engine.ts (layers and tone stage), the existing turbo cue if any (search turbo in src/audio)

## Goal
Release gate R3 (Ryan): "Turbo must have its own music and sound effects while it is active." Turbo now lasts 10 s and can extend to 15 s.

## Acceptance
- On 'fx:turbo' active: a rising ignition sweep (0.4 s), then while active a driving turbo layer over the current tune: tempo feel doubled with a 16th note arpeggio of the current chord in a bright pulse lead, a pumping bass, and a light high hat, mixed through the existing tone stage (soft highs); the base tune ducks 30 percent. A subtle looping engine hum under it. On end: a falling power down sweep and the layer fades out in 0.3 s. One instance only; restarts cleanly if Turbo retriggers.
- Respects music and sfx volume; silent at 0. Tests for the lifecycle (start, extend, end, no stacking) and the pure parameter helpers. npm test and npm run build pass on the branch (accepted perf exception aside). Commit on the branch. Do not push; the dispatcher reports the branch. Hand off under 30 lines as your final message.

## Rules
TypeScript strict, no any. No assets: synthesised only. No em or en dashes.
