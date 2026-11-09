# Ledger: story-scenes

Create and check out branch feat/ledger-story-scenes before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: new src/story/ (scene data and trigger rules), new src/ui/story/ (scene player and call sign picker), src/ui/levelSelect.ts (a "Replay story" entry only), src/main.ts (flow hooks only), src/core/settings.ts or the storage key registry (two new device only keys), tests/story/, tests/ui/story*.test.ts, tests/qa storage key registrations
Do not touch: src/ui/menu.ts, index.html, vite.config.ts, .github/ (a parallel session is moving the domain and edits those), src/audio/ (Chorus adds scene sounds in parallel), src/economy/, src/game/, src/levelgen/, src/render/, src/core/events.ts (the 'ui:story' event is already stubbed by Morpheus; use it as is), docs/ other than your hand off
Read first: docs/19-story-bible.md (approved canon, take every line word for word; its "Scene rules" and "Panel spec for the builder" sections are your spec), src/ui/enemyIntro.ts (newFoes, iconCanvas, specCanvas, FOE_INFO), src/ui/intro.ts and src/ui/flow.ts (level start flow), src/ui/results.ts (where a boss win lands), src/core/events.ts ('ui:story'), src/core/rng.ts

## Goal
Ryan approved the story bible (guide Torus, fallen legend Vecta). Build the scenes exactly as specified: opening with call sign picker before the first Adventure level, briefings for new enemy kinds and combos, guardian intros before boss levels, freeing scenes after a boss win before results.

## Acceptance
- src/story/scenes.ts: all scene text from docs/19 as JSON serialisable data keyed by trigger id (opening, foe:<kind>, combo:<a>+<b>, boss:<id>, freed:<id>), each panel with its visual description mapped to a small enum the player can draw. A Vitest checks every line: at most 40 characters with {callsign} counted as 10, at most 2 lines per panel, at most one Torus line per scene, no em or en dashes, every boss id and every enemy kind in the bible covered.
- src/story/triggers.ts: pure rules that pick the scenes for a level start (newFoes rule, at most two briefings, the rest deferred to the next level, combo when both kinds first share a level) and for a boss win; shown once per save per trigger; Adventure only (Endless and Free Play show none).
- Player (src/ui/story/): full screen overlay, one panel at a time, drawn in code only (enemy icons, boss silhouettes grey when corrupted and in palette colour when freed, the pilot ship, Torus as nested slowly turning polygons, Vecta as a large grey flickering ship outline never close, the grid, stars), slow reveal, glow pulse, typewriter text about 40 characters per second (tap completes the line, next tap advances), colour drain and return tweens, no flashes faster than 3 per second. A large Skip button skips the whole scene in one tap. Plain HUD font for scene text, high contrast; the Torus icon before his line. Fits the Fold 7 cover and inner screens and a 360 px wide phone in landscape, safe areas respected. Touch only.
- Call sign picker in the opening: a suggested call sign from two word lists (seeded draw through src/core/rng.ts only), a reroll button, optional typing (letters and digits, 3 to 10 characters). Stored on the device only under a new registered sow. key; never sent anywhere. Changeable later is not required now.
- Seen scenes stored under a second registered sow. key; level select offers "Replay story" for a level whose scenes were seen.
- Emit 'ui:story' { id, type, panel, phase } at scene start, each panel, and end or skip.
- No change to gameplay, the simulation or generated levels. Existing tests stay green.
- Tests: data checks above, trigger rules (new kinds, deferral, combos, boss and freed, once per save, not in Endless or Free Play), picker validation, storage round trip, event emission order. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-story-scenes.md under 20 lines with a device check. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. Touch only. applyNeon(n) only for neon. No image, audio or font files. No em or en dashes.
