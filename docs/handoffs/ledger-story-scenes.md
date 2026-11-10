# Hand-off Ledger: story scenes

Branch feat/ledger-story-scenes. Every scene line is word for word from docs/19 (a test parses the bible and compares). npm test: 1 fail, the accepted generator perf test (557 ms against 500). Build ok, v7 grep clean.
- Data and rules: src/story/scenes.ts (39 scenes keyed opening, foe:, combo:, boss:, freed:), src/story/triggers.ts, src/story/callsign.ts.
- Player: src/ui/story/ (canvas visuals, typewriter at 40 cps, Skip, call sign picker). Level select gets a "Replay story" toggle. main.ts: scenes play over the intro card at level start; a boss win plays the freeing scene, then the results, with the sim held.
- Storage: sow.progress.callsign and sow.progress.storySeen (trigger id to level), device only, registered in tests/qa. Reset progress leaves both alone.
- Events: 'ui:story' start, panel (each), end (also on skip).

Device check (Fold 7, cover and inner):
1. Fresh profile (clear site data). Menu, Adventure. Expect the opening: a dot, the lattice, the ship, then the picker. Tap New name twice, type "Ace7", Done. P3 types "Ace7" above the ship.
2. Tap through P4 and P5: Torus turns beside the ship, his line has a small Torus icon. Then the Grunt briefing; Skip ends it in one tap. The intro card is under it.
3. Fold and unfold during a scene: text, Skip and the canvas refit, with nothing clipped.
4. Play level 5, beat Brood. The freeing scene (green returns, one star) plays before results.
5. Level select, Replay story, tap 1: the opening and briefings replay. Endless and Free Play show no scenes.

Known gaps: the call sign cannot be changed after the opening (not required now). Combos wait until both kinds are briefed. A save from before this build gets the opening on its next Adventure start and only the briefings due from then on.
Requests: none. Dependencies: none.
