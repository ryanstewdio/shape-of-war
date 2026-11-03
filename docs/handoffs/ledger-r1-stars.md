# Ledger hand off: r1-stars

Branch `feat/ledger-r1-stars`, local dispatcher run 0548 (no cloud session URL, not pushed).

## What changed
- Intro card: the Difficulty line is now a four way selector (Easy, Normal, Hard, Insane) marked with the saved setting. A tap saves `sow.settings.difficulty`, rebuilds that level at the new difficulty (the sim has not stepped yet) and holds the card until a tap on the card ("tap to start"), so the 1.5 s timer cannot cut the choice off.
- Settings row and parser accept `insane`.
- Stars: new pure `src/core/stars.ts`. `awardStars(scoreStars, difficulty, success)` caps score stars at Easy 1, Normal 2, Hard 3; an Insane win is 4; a failed Insane run keeps the Hard cap. main.ts applies it in `onGameOver` with `runDifficulty`, the difficulty the world was built with.
- Saved bests: `LevelBest.stars` is 0 to 4 plus an optional `difficulty`. A higher star count replaces a lower one together with its difficulty. Pre R1 entries load unchanged.
- 4th star: `src/ui/fourthStar.ts`, a CSS glyph star whose hue cycles through BASE_PALETTE keys at the saturation `applyNeon` last set (main.ts syncs it from `onNeonChanged`), a shimmer and one turn per 6 s. Shown on the results screen and on level select buttons. Turned off under prefers-reduced-motion. Results also show a "Difficulty: X" line.
- docs/13 key table: four values, and the optional `difficulty` field in `sow.scores.adventure`. No new key.

## Files
src/core/stars.ts (new), src/core/settings.ts, src/ui/fourthStar.ts (new), src/ui/intro.ts, src/ui/results.ts, src/ui/levelSelect.ts, src/ui/flow.ts, src/ui/settings.ts (comments), src/main.ts, docs/13-v3-spec-addendum.md (key table only), tests/ui/stars.test.ts (new, 11), tests/ui/fourthStar.test.ts (new, 10), tests/settings/difficulty.test.ts, tests/qa/normalDifficulty.test.ts (+1), tests/qa/storageKeysV3.test.ts (+1), tests/ui/release.test.ts, tests/ui/fakeDom.ts (replaceChildren).

## Tests and build
npm test: 4172 passed, 1 failed (accepted perf exception: generator "200 levels under 350 ms"). npm run build: exit 0. v7 API grep: clean.

## Risks
- The `game:over` event still carries 0 to 3 score stars (events.ts untouched); the cap and the 4 are applied in main.ts only.
- Old saves keep any 3 stars earned before the cap existed.
- The 4th star CSS reads glowAlpha for its blur radius; it sets no neon value.
- Changing difficulty on the card re-runs startLevel (same seed and level hash).

## Contracts for other roles
`awardStars`, `STAR_CAP`, `StarCount` in src/core/stars.ts; `LevelResult.difficulty`; `holdIntro` and `introHeld` in src/ui/intro.ts.

## Device check for Ryan
1. Open Adventure, pick any level. The intro card shows a Difficulty row with four buttons, your saved choice lit. Tap Insane: it lights, the card stays up and the hint says "tap to start". Tap the card to play.
2. Open Settings: the Difficulty row also shows Insane lit.
3. Win a level on Normal with a big score: results show at most two stars. On Easy, at most one. On Hard, up to three.
4. Win a level on Insane: results show three gold stars plus a fourth star that shifts colour, glimmers and slowly turns (about one turn every 6 s). Level select shows the same spinning fourth star on that level.
5. Replay that level on Easy and win: level select still shows four stars.
