# Scribe: story-bible

Create and check out branch feat/scribe-story-bible before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: new docs/18-story-bible.md only
Do not touch: anything else (other sessions edit src/ui, src/economy, src/levelgen and native files in parallel)
Read first: docs/00-START-HERE.md (game map), docs/16-public-plan.md (audience: everyone including children; English), src/ui/enemyIntro.ts (FOE_INFO: enemy names and one line descriptions), src/levelgen/boss.ts (boss list; under generator V9 Brood is level 5 and Warden level 10), how the generator introduces enemy kinds by level (src/levelgen/generator.ts roster bands, read only)

## Goal
Tester Mike asked for story between Adventure levels, like 8 and 16 bit cut scenes or pre-fight enemy introductions, that tells the player what is coming. Ryan ruled: build it in P1, tone light and funny, for a family audience. This doc is the script and spec Ryan approves before any UI work.

## Acceptance
- Cast: a player pilot (name it) and a quirky guide character who briefs the pilot, plus enemy personalities. Original names only; no references to existing games or franchises. Keep it child safe: no gore, no real world violence, no scary content; jokes kind, not mean.
- Briefing scenes: one short scene (2 to 4 panels, each panel at most 2 lines of 40 characters) before every Adventure level that introduces a new enemy kind or a notable combo, and before every boss level a pre-fight boss intro (name, a one line taunt, what to watch for, in plain words a 7 year old understands). List them in level order for levels 1 to 50 with the trigger (which new enemy or boss).
- Each scene teaches the counter: what the new enemy does and one tip.
- Panel spec for the builder: which existing visuals each panel shows (enemy icon, boss silhouette, pilot or guide portrait drawn in the neon line style), simple animations (blink, slide, typewriter text), skippable with one tap, replayable from level select, never blocking a returning player twice.
- A short world premise (5 lines max) and a tone guide with 5 do and 5 do not examples.
- Under 400 lines. Sentence case headings, no em or en dashes. Hand off at docs/handoffs/scribe-story-bible.md under 8 lines. Commit and push the branch. Stop.
