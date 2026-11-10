# Scribe: guide-rewrite-96dcc2a

Create and check out branch feat/scribe-guide-96dcc2a before any edit. Never push main. You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: docs/player-guide/README.md and docs/player-guide/img/diagrams/ only
Do not touch: src/, tests/, scripts/, docs/player-guide/img/shapes/ (Shipwright regenerates them in parallel), every other doc except your hand off
Read first: docs/player-guide/README.md (all of it), docs/00-START-HERE.md, docs/19-story-bible.md, src/story/scenes.ts, src/ui/enemyIntro.ts (FOE_INFO), src/levelgen/ (generator V11 config, bosses, drums, Free Play), src/core/difficulty.ts, src/core/settings.ts, src/ui/settings.ts, src/ui/howTo.ts, SPEC.md with docs/11, docs/13, docs/14, and the newest 40 rows of docs/DECISIONS.md

## Goal
Full rewrite of the player guide for the game as it is on main at 96dcc2a6f82be801797281c8cbdd30075afdf3d3. This is not a small update: the header says v3 (91c49c8) but every numbered section still describes v2.0.0 (13b7d96), 482 commits and 236 changed source files ago. Ryan will also use this guide as the source for the public website's field guide, so every statement must be true of the current code.

## Acceptance
- The game's name is Shape Legend (Ryan, 2026-11-09 and again 2026-11-10). Title "Shape Legend player guide". The words "Shape of War" and "Shapes of War" appear nowhere except old changelog rows, where the old name may stand once as "(then named Shape of War)". Diagram titles inside docs/player-guide/img/diagrams/*.svg are renamed too.
- Header line exactly: "Describes main at 96dcc2a6f82be801797281c8cbdd30075afdf3d3 (version tester-1+96dcc2a), written <ISO date>." with no caveat sentence after it.
- Every section is rewritten against the current code, not patched: read the code for each number. Code wins over docs. List every conflict between code and SPEC, addenda or DECISIONS in the hand off with file and line; do not resolve them.
- Remove the "(v2)" markers and the sentence that explains them. Mark nothing as new except in "Changed in this version" and the changelog.
- New content that must be covered, each from code:
  - A new section "The legend" placed before Quick start: the story. Premise, the names (Vertane, the Dim, Torus, Vecta, Geoms), how scenes work in play (opening, call sign, briefings before a new enemy, guardian intro and freeing, skip, replay from level select). Copy story lines word for word from src/story/scenes.ts; never write new story text. Spoiler limit set by Ryan: story text only up to and including level 30 (Gravitas freed). Do not quote or summarise scenes after level 30, do not mention the Hollow Star, Act 6 or how the story ends. State in one line that the story was not in any earlier edition of this guide.
  - Guardians (bosses): one entry per boss in the current Adventure order with level, title from the story bible, image img/shapes/boss-<id>.svg, health, phases, attacks, tells, the open or weak state, counter, score or reward, damage cracks and splits, what bombs and supers do to it. All ten get rules entries; only the first six (to level 30) get story lines. Boss levels: schedule, the survive then defeat goal, Easy and Insane differences, the loop after level 50 described as game rules only, bosses in Endless and Free Play.
  - Difficulty (Easy, Normal, Hard, Insane) and the fourth star.
  - Free Play and its setup options. Endless as it is now (segments, bosses, extra lives schedule).
  - Level length and pacing under the current generator version, the clock and time warnings, mission types on the start card as they are on main today, par and the score goal, par rewards.
  - Every enemy kind in FOE_INFO, including any added since v2 (for example Leaver), each with image img/shapes/<kind lower case>.svg.
  - Gravity wells as they are now (arrive in play, super nova, nova snakes, pond ripple), spawners, membranes, slime, mines.
  - Weapons: the four base weapons as they are now, the six combos, orbit as it is now, expiry and upgrade sounds. Drone modes and drone pickups. Supers as they are now, and where the bomb and super buttons sit.
  - Surfaces: flat and cylinder (drum), drum maps, 3D tilt, drift.
  - Settings: every row in the current settings screen, defaults from src/core/settings.ts, Reset progress as it behaves on main.
  - Music and sound as they are now (tunes, boss tracks, menu themes, Turbo music, story cues, time warnings).
  - Install and device: the game address is https://play.shapelegend.com. Android phones and iPhones, not only the Fold. The Android app wrapper exists but is not in any store: say only that the game is played from the web address. Remove the link to docs/07-install-runbook.md and any other link that leaves the guide; the guide must stand alone.
  - Gems: describe only what a player can see on main today. If nothing is visible, leave gems out and say so in the hand off.
- Not in the guide: anything not merged on main (the trough surface beyond a stub, the hunt objective, PVP, co-op, tanks, shops, store launch, prices). Developer only items (stress test button, dev panel, URL parameters, level hash line) go in one short "For testers" subsection or are left out; list which in the hand off.
- Controls and HUD diagrams in img/diagrams/: check each against the current layout code and redraw any that is wrong (bomb and super button positions changed in v3). Keep the same file names. If a diagram is right, leave it byte identical.
- Images: reference shape images by the naming contract above even though the files arrive on another branch. Use img/shapes/_all.svg for the all shapes sheet and img/shapes/_bosses.svg for the guardian sheet. List every image path you reference in the hand off so the orchestrator can check them after both merges.
- "Changed in this version": rewritten as the list of what this edition adds over the v2.0.0 edition. Changelog: keep the four old rows, add rows for v2.1.0, v3.0.0 and tester-1 from git tags (date and one line each, from git log), then a top row for tester-1+96dcc2a.
- Never invent a number or a behaviour. If the code does not settle it, write "unknown" and list it in the hand off.
- Player facing language, short sentences, sentence case headings, no em or en dashes anywhere (check with: perl -CSD -ne 'print "$ARGV:$.: $_" if /[\x{2013}\x{2014}]/' docs/player-guide/README.md docs/player-guide/img/diagrams/*.svg, which must print nothing).
- Use sub agents inside your session for reading code areas in parallel if that helps; you write the final text yourself and spot check at least five numbers per section against the source file.

## Hand off
Write docs/handoffs/scribe-guide-rewrite-96dcc2a.md: sections and their sources, every Canon conflict with file and line, every unknown, every content question for Ryan (anything where the code, the story bible and the rulings disagree, or where a player facing choice is not obvious), the list of image paths referenced, the dash check result, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). Commit "scribe: guide rewrite 96dcc2a" and push the branch. Stop.
