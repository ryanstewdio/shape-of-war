# Release polish (tester build)

Agreed with Ryan on 2026-11-02 after G11. Target: send the tester link before Thursday 2026-11-05.

## Requirements
1. Name: Shapes of War (title, manifest, menu, guide). No Geometry Wars references anywhere in code, docs or text.
2. Original neon app icon and a title splash on open.
3. Testers: a few friends, one link (GitHub Pages), Android phones and iPhones. Feedback by message to Ryan: a small version and seed line on the menu they can screenshot.
4. Hide fps and debug readouts by default (still in Settings). Test URL knobs (?boss, ?tilt, ?seed, ?level, ?debug, ?surface) work only with ?dev=1.
5. Short interactive tutorial on first run (move, aim, bomb, super) in about 60 seconds, replayable from Settings.
6. Difficulty choice Easy, Normal, Hard (src/core/difficulty.ts): enemy speed, hit points, spawn rate, boss scale, lives.
7. Level length: non boss levels average at least 5 minutes; boss levels at least 4 minutes of waves, then at least 3.5 minutes of boss fight. Bosses scale with level and difficulty (Warden at level 5 gentler for new players on Easy and Normal).
8. Open drum levels get a slow constant drift with short speed bursts so the player must keep moving.
9. Barrier ring levels get membrane gaps: enemies squeeze through slowly, the ship and its bullets cannot.
10. Device checks: iPhone Safari install, fullscreen and audio unlock; small phone layout (6 inch, notch safe).

## Not in scope (Ryan's choice)
Weaker GPU auto fallback, portrait warning, store builds, in-game feedback form.

## Free Play options (Ryan, 2026-11-03 after R3)
Setup screen options, all built from existing features: enemy kinds on or off and spawn density (Low, Normal, Swarm); lives (1, 3, 5, infinite) and run length (Endless, or a timed 3, 5 or 10 minute score attack); loadout (starting weapon, weapon pickups on or off, drone type, super type); bosses (off, every 3 minutes, or one chosen boss), gravity wells (off, normal, many), drum drift (off, low, high); arena size (small, medium, large). Not chosen: music choice, saved presets.
