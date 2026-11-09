# Scribe: legend-bible

Create and check out branch feat/scribe-legend-bible before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: new docs/18-story-bible.md only
Do not touch: anything else (other sessions edit src/ui, src/economy, src/levelgen and native files in parallel). Ignore any branch feat/scribe-story-bible: that brief was cancelled.
Read first: docs/00-START-HERE.md (game map), docs/16-public-plan.md (audience everyone including children, English, future modes), src/ui/enemyIntro.ts (FOE_INFO: enemy names, looks, behaviour), src/levelgen/boss.ts plus the T3 order (generator V9: Brood level 5, Warden level 10, Spindle 15, Ember 20, Mirage 25, Gravitas 30, Bastion 35, Tempest 40, Twins 45, Prism 50), src/levelgen/generator.ts roster bands (read only) to learn at which levels each enemy kind first appears

## Goal
The game is Shape Legend. Ryan rejected a light, silly tone. He wants an epic, mythic legend that is safe for families, built from his interview answers (2026-11-09):
- Premise: a human pilot suddenly wakes in a geometric universe. The pilot must become a Shape Legend to survive.
- Feel: mythic legend, told like an ancient prophecy: trials, a world that remembers its legends.
- Arrival: the world itself summoned the pilot on purpose.
- Enemies: the world was once in harmony; a corruption turned its shapes hostile. Bosses are corrupted guardians; defeating one frees it.
- Source of the corruption: a fallen legend, a past champion who grew hungry for power and corrupted the guardians; the final foe the pilot must surpass.
- Guide: a friendly, ancient shape being who speaks to the pilot, cryptic at first, a true ally later. (It answers the world's call; it did not summon the pilot.)
- Pilot: the player names the pilot (a call sign chosen at the start); the pilot is silent in scenes so anyone can see themselves.
- Goal: become the legend. Home is not the goal.
- Voice: mostly narration. A narrator tells the legend; characters say little. Lines are weighty but in short, simple words a 7 year old can follow.
- Delivery: pre-level briefings (before levels that bring a new enemy kind or a notable combo, each teaching one counter) and boss intros (before each guardian fight, plus a short freeing moment after the win). No chapter cut scenes, no codex for now.
- Future modes framed by the story: PVP and battle modes are legend trials where legends test each other; tank battles are war forms the pilot unlocks; co-op is legends fighting the corruption together.

## Acceptance
- World premise (6 lines max), the names of the world, the guide, the fallen legend and each guardian (original names; the existing boss names may be kept as the guardians' names or given a title, for example "Warden, Keeper of the Old Gate"; nothing that echoes an existing game or franchise).
- Narrative arc across levels 1 to 50 in five acts of ten levels, each act tied to two guardians, building toward the fallen legend (state where the fallen legend appears and how a later update could hold the final confrontation).
- Scene list in level order, levels 1 to 50: trigger (new enemy kind, combo or guardian), 2 to 4 panels per scene, each panel at most 2 lines of 40 characters, narration first, at most one short line from the guide. Every briefing names the threat and gives one plain counter tip. Every boss intro gives the guardian's title, what corrupted it, and what to watch for; every freeing moment is one or two panels.
- Opening scene (before level 1) where the pilot wakes, the call sign is chosen, and the world's call is heard. Keep it under 6 panels.
- Endless and Free Play: one line each on how the story frames them.
- Legend trials framing for PVP, co-op and tanks: half a page, hooks only.
- Panel spec for the builder: what each panel shows using visuals the game can draw in code (enemy icons, boss silhouettes, the pilot ship, the guide drawn as a neon geometric being, the world's grid), simple animations (slow reveal, glow pulse, typewriter text), skippable with one tap, replayable from level select, shown once per new trigger.
- Safety: no gore, no death of named characters on screen, no real world violence, nothing frightening for young children; corruption is shown as colour loss, glitching and dimming, freeing as colour and light returning.
- Under 450 lines. Sentence case headings, no em or en dashes. Hand off at docs/handoffs/scribe-legend-bible.md under 8 lines. Commit and push the branch. Stop.
