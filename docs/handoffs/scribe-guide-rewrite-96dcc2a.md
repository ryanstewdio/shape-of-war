# Hand-off: scribe guide-rewrite-96dcc2a

HAND-OFF Scribe: guide-rewrite-96dcc2a
Branch: feat/scribe-guide-96dcc2a (also pushed to the session branch claude/scribe-guide-rewrite-8va380)
Base: 09b46f9 (main at 96dcc2a plus the two brief commits; no source change between them)
Files changed: docs/player-guide/README.md (full rewrite), docs/player-guide/img/diagrams/controls-cover.svg, controls-main.svg, hud-cover.svg, hud-main.svg (all four redrawn), this hand-off
Tests added: none (docs only). npm test and npm run build not run: no source touched.
Session: https://claude.ai/code/session_018Gwqi3tyPFCj3QLXrfVDxV

## Method

Five read only sub agents each read one code area (guardians; enemies and hazards; weapons, controls and HUD; level generator, modes and difficulty; settings, audio, device, story plumbing and dev items) and returned facts with file:line. I wrote every line of the guide myself and spot checked numbers against source in each section (listed below). Story lines were copied from src/story/scenes.ts by hand and checked against docs/19.

## Sections and their sources

| Section | Main sources | Spot checks I made in source |
|---|---|---|
| Header, Changed in this version | git tags, git log | tag dates and messages for v2.0.0, v2.1.0, v3.0.0, tester-1 |
| 1 The legend | src/story/scenes.ts, src/story/triggers.ts, src/story/callsign.ts, src/ui/story/player.ts, run.ts, src/ui/levelSelect.ts, docs/19 | every quoted line vs scenes.ts:117-256; MAX_BRIEFINGS 2 (triggers.ts:14); COMBOS (scenes.ts:103-107); GUARDIAN_ORDER (scenes.ts:100); call sign 3 to 10 (callsign.ts:32-35) |
| 2 Quick start | as below | super 60 geoms (geoms.ts:19), lives and bombs (validate.ts:118-119) |
| 3 Controls | src/input/stick.ts, model.ts, buttons.ts, stack.ts, reach.ts, src/ui/hudFrame.ts, src/main.ts | BUTTON_HIT 64, SUPER_GAP 12, PAUSE_HIT 56 (stack.ts:10-20); STACK_RIGHT 50, STACK_CLEAR 144 (stack.ts:34-40); stackTop and layoutButtons (buttons.ts:50-88); REST_W 160, REST_H 64, REST_RIGHT 96 (reach.ts:18-23) |
| 4 Core loop and scoring | src/game/scoring.ts, geoms.ts, src/core/stars.ts, src/levelgen/leveldef.ts, src/ui/parReward.ts, src/ui/fourthStar.ts | R1_STAR_MULS 1, 1.25, 1.5 (leveldef.ts:80); STAR_CAP (stars.ts:40); INSANE_STARS 4 (stars.ts:43); awardStars (stars.ts:51-56); main.ts:873 uses level thresholds |
| 5 Levels and missions | src/levelgen/short.ts, pacing.ts, generator.ts, src/ui/intro.ts, src/ui/objective.ts, src/audio/timeWarnSfx.ts, src/ui/results.ts | SHORT_LENGTHS (short.ts:18-21); BOSS_SHORT_LEVEL_AT_SEC 85 (short.ts:42); goalSentence and victorySentence (intro.ts:164-194); formatCompact (format.ts:33-47); no Mission type line in intro.ts (grep for RUSH, HOLD OUT: no hits) |
| 6 Difficulty | src/core/difficulty.ts, src/game/difficulty.ts, src/core/settings.ts, src/game/state.ts | the whole DIFFICULTY table (difficulty.ts:30-37); livesAtStart (state.ts:289-293) |
| 7 Your ship | src/game/ship.ts, player.ts, src/core/physics.ts, src/render/blink.ts | physics table (physics.ts:23-27, read by agent, numbers match v2 edition) |
| 8 Weapons | src/game/weapons.ts, bullets.ts, pickup.ts, combat.ts | WEAPONS (weapons.ts:50-55); WEAPON_DURATION 20, FIRST_DROP_KILL 15, DROP_EVERY 25, COMBINE_DROP_KILLS 12, ORBIT_RADIUS 80, ORBIT_OUTER 100, 2.4 rev/s (weapons.ts:60-70); COMBO_TABLE and pair numbers (weapons.ts:158-185) |
| 9 Bombs, drones, supers | src/game/drones.ts, supers.ts, turbo.ts, player.ts | drone constants (drones.ts:30-41); FIRST_DRONE_DROP 30, DRONE_DROP_EVERY 40 (drones.ts:216-217); SUPER_DURATION 5, HOMING_RADIUS 300, DETONATE_RADIUS 260, DRONE_ABSENT_SEC 3 (supers.ts:25-29); TURBO 10 s, x2.5, x1.35, pierce 2, +0.25 s, cap 15 (turbo.ts:6-16) |
| 10 Enemies | src/ui/enemyIntro.ts (FOE_INFO), src/game/enemies/*.ts, src/levelgen/leveldef.ts, levelgen/leaver.ts | scores and geoms (scoring.ts:29-68, via agent and the v2 edition); Leaver from level 21 (leaver.ts:23); briefings vs scenes.ts |
| 11 Hazards | src/game/enemies/gravitywell.ts, wellArrival.ts, pondRipple.ts, core/pondRipple.ts, membrane.ts, enemies/spawner.ts, slime.ts, mine.ts | PULL_RADIUS 320, EXPLODE_RADIUS 220, NOVA_SEC 6 plus or minus 1, NOVA_RADIUS_MULT 1.25, NOVA_PULL_MULT 1.3, NOVA_SNAKE_SEC 3.5 (gravitywell.ts:50-78); ARRIVE_FIRST 20 to 30, ARRIVE_GAP 25 to 35 (wellArrival.ts:30-33) |
| 12 Arenas and surfaces | src/levelgen/cylinder.ts, drum.ts, generator.ts, src/game/drift.ts, src/render/tilt.ts | BURST_HOLD 1.5, GAP_MIN 9, GAP_MAX 14, DRIFT_WARN 0.6 (drift.ts:26-33); tilt 7 and 13 degrees (tilt.ts:8, via agent) |
| 13 Guardians | src/game/bosses/*.ts, src/levelgen/boss.ts, src/game/scoring.ts, src/ui/boss.ts, src/render/bossDamage.ts | BOSS_TABLE hp, phases, radius (table.ts:30-41); BOSS_DAMAGE (table.ts:44-51); DETONATE 0.1 and 260, reward 20 geoms, HP cap 32767 (table.ts:56-62); ENRAGE_AFTER_SEC 240, rate 1.3 (table.ts:74-76); Warden ringEvery 3.7 and 2.8, openSec 2.0, hornets 10 (table.ts:123-156); Brood podHp, openSec 5 (table.ts:256-259); Bastion hornets 8, openSec 2 (table.ts:460-461); bossBonus (scoring.ts:80-94); BOSS_SCHEDULE and T3 swap (boss.ts:47-117); Free Play cadence (boss.ts:136-143) |
| 14 Endless and Free Play | src/game/endless.ts, levelgen/boss.ts, src/ui/freePlay.ts, src/core/freeplayConfig.ts, levelgen/freeplay.ts, validate.ts | lifeThresholds and applyAwards (endless.ts:99-149); BOSS_SEGMENT_EVERY 6, BOSS_SEGMENT_AT_SEC 10 (boss.ts:9,32); "Every 3 min" label (freePlay.ts:115) |
| 15 Strategy | derived from the sections above | no new numbers |
| 16 Settings | src/core/settings.ts, src/ui/settings.ts, src/render/neon.ts, src/render/effects.ts | row order (settings.ts:562 via agent); trailsOn and mapEffectsOn off on Low (effects.ts:33-40) |
| 17 Music and sound | src/audio/** | LAYER_RAMPS thresholds 0.06, 0.12, 0.2, 0.32, lift (intensity.ts:51-58) |
| 18 Install and device | index.html, public/manifest.webmanifest, vite.config.ts, src/main.ts, src/ui/moveNotice.ts, splash.ts, boot.ts, devpanel.ts | GAME_TITLE (menu.ts:19), move notice host rule (moveNotice.ts:24-27) |
| 19 Glossary, 20 Changelog | the sections above, git tags | tag shas and dates |

## Canon conflicts (code wins in the guide; not resolved)

1. Star thresholds. SPEC.md:75 "Stars at par, 2x par, 4x par" vs code 1, 1.25, 1.5 x par: src/levelgen/leveldef.ts:80 (R1_STAR_MULS), used by src/main.ts:873 and src/main.ts:957. The legacy src/game/scoring.ts:132-138 (stars at 1x, 2x, 4x) is still exported but not used for awards.
2. How to text vs code: src/ui/howTo.ts:349 says "Double par for 2. Four times par for 3." (code: 1.25 and 1.5 x par, see 1).
3. How to text vs code: src/ui/howTo.ts:367 "Change it in Settings." There is no difficulty row in Settings (src/ui/settings.ts row list at :562; src/core/settings.ts:250-255 says the old key is no longer written). Difficulty is picked on the start card (src/ui/intro.ts:395-405).
4. Bomb and super position. SPEC.md:94 "Bomb button bottom centre ... super button above bomb" vs code: both stacked high on the right edge (src/input/buttons.ts:50-88, src/input/stack.ts:34-40). DECISIONS 211:00 agrees with the code.
5. Start card. DECISIONS 335:20 and 335:35 (Mission type line RUSH & SCORE, HOLD OUT, SEEK & DESTROY, GUARDIAN; "Return to Menu"; focused stack) are not on main: src/ui/intro.ts:117-123 and :290-346 still build the R6 card (Goal, Victory, Star targets, New enemies, chips, Start, Details). The guide describes the R6 card.
6. Reset progress. DECISIONS 335:20 "Reset progress clears everything, including story seen and the call sign" vs code: src/core/settings.ts:589-594 clears only unlocked level, Adventure table and held reward, and src/core/settings.ts:701-703 says "Reset progress leaves both alone" (call sign and story seen). Settings, run seed, Endless top 10 and Free Play setup are also kept.
7. Boss enrage. docs/13-v3-spec-addendum.md:99 (boss rule 10) "alive 90 s after its entrance" vs src/game/bosses/table.ts:74 ENRAGE_AFTER_SEC = 240.
8. Bomb stagger. docs/13:96 (rule 7) "staggers the boss for 1.5 s (it stops attacking, stays vulnerable)" vs src/game/bosses/core.ts:518-526: the weak window keeps its state, so a closed guardian stays closed during the stagger.
9. Boss reward. docs/13:100 (rule 11) "20 geoms and a large death burst. No weapon, life or bomb." (with docs/13:13 adding the Endless 5000 x tier score) vs src/game/scoring.ts:80-94: Adventure also adds 25 percent of par, rounded half up to 500. I found no DECISIONS row for the Adventure bonus in the newest 40 rows.
10. Boss shooters. docs/13:103 (rule 14) and docs/13:13 item 9 "Shooters: Spindle, Ember, Bastion" (also the src/game/enemyBullets.ts:1-2 comment) vs code: every boss fires the rotation volleys (src/game/bosses/rotation.ts, table.ts:761-782), and Warden (warden.ts:186) and Tempest (tempest.ts:760) fire bullets too.
11. Boss speeds. docs/13:102 (rule 13) "Boss speeds are not multiplied by speedScale; the tier sets difficulty" vs src/game/bosses/table.ts:731-747: attack cadence and bullet speed scale with level (x0.75 at level 5 to x1.15 at 50). Not a speedScale multiply, but a level scale the rule does not mention.
12. Level length. docs/14-release-polish.md item 7 (non boss levels at least 5 minutes, boss levels 4 minutes of waves) and docs/00-START-HERE.md ("Levels: about 3.5 minutes", "survive until the boss arrives (120 to 200 s)") vs src/levelgen/short.ts:18-21 and :42 (90 to 180 s; boss at 85 s). DECISIONS 333:05 agrees with the code; docs/00 is stale.
13. Dev gating. docs/14 item 4 (debug readouts hidden, test knobs only with ?dev=1) vs code: the debug panel is installed for every player and opens on a two finger long press (src/main.ts:1014, src/render/devpanel.ts:218-232); the stress button appears after 5 taps on the Settings build label without ?dev=1 (src/ui/settings.ts:372-385, :549-560); the HUD level line shows the level hash to every player (src/ui/hud.ts:298-301). URL knobs are gated as specified (src/ui/devGate.ts:1-33).
14. Tutorial. docs/14 item 5 (interactive tutorial replayable from Settings) vs code: a paged How to on the main menu (src/ui/howTo.ts, src/ui/menu.ts:44). DECISIONS 211:00 agrees with the code.
15. Name. docs/14 item 1 "Name: Shapes of War" vs code "Shape Legend" (src/ui/menu.ts:19). DECISIONS 316:20 agrees with the code.
16. Code comment vs code: src/main.ts:388 "Music never plays in menus" vs src/audio/music/index.ts:1269-1270 (menu themes on title and menu).
17. Code comments vs code: src/game/ship.ts:24-26 and :106 (Turbo 2x fire, 1.25 speed) and src/game/combat.ts:160-161, :223 (pass through one enemy) vs src/game/turbo.ts:6-16 (2.5x, 1.35, 2 enemies). src/game/bosses/warden.ts:2, :10 and bastion.ts header (older ring and Hornet numbers) vs table.ts values. src/game/ship.ts:20 (10 Hz blink) vs src/render/blink.ts:6-9 (6 per second).
18. Time warning sound. src/audio/synth.ts:293 comment "last 10 seconds" vs src/audio/timeWarnSfx.ts:46-56 (ticks from 5 s). DECISIONS 334:30 agrees with the code (countdown sound from 5 s).

## Unknowns

- Exact roster, par, destroy count and length of any given level: drawn from the run seed, so the guide gives ranges and rules only.
- Per boss bullet speeds beyond the shared rotation (190 x level scale, cap 240 u/s) and the values quoted per boss: not all read.
- The hidden hold time on a guardian level: LONG_BANDS gives 300 to 360 s by band (src/levelgen/leveldef.ts:818-823); the guide says "5:00 to 6:00 of wave clock". Whether the wave clock runs at full speed through an Adventure fight was not traced end to end (src/game/bosses/core.ts:159-178 keeps 60 percent of spawns).
- Whether Free Play plays the level start sound and sets the music's run mode: it starts without game:start (src/main.ts:591). Left out of the guide.
- Wanderer and Pinwheel bounce physics live in world.ts driftEntity, not read; the bounce claim comes from their file comments and the v2 edition.
- Drone pickup colour: the palette has a teal dronePickup key (src/render/neon.ts:104-105) but the shape spec tint is null (src/render/shapeSpecs.ts:291-313). The guide just says "a spinning ring".
- Weapon pickup marks: described only as "a mark for its weapon" with the images.

## Content questions for Ryan

1. The How to screen says stars are at 2x and 4x par and that difficulty is changed in Settings. Both are wrong on main. Fix the How to text (Ledger)?
2. Endless and Free Play "Every 3 min" use the plain guardian order (Warden first) while Adventure opens with Brood. Intended?
3. The Free Play option reads "Every 3 min" but guardians come at 1:40, then every 5 minutes. Rename the option or change the cadence?
4. Reset progress keeps the call sign and the story seen record on main; your 2026-11-10 ruling says it should clear everything. The guide states what main does. Confirm the ledger-start-card change will land, then the guide needs a one line update.
5. The menu footer still says "v3 build <sha>". Should it read tester-1 or Shape Legend's next version name?
6. The debug panel and the stress button are reachable by any player, and the HUD shows the level code to all. The guide keeps them in a short "For testers" subsection. Gate or remove them before the public site?
7. Guardians 35 to 50 carry their story bible titles (for example "Bastion, the Last Wall") but no story lines, per the spoiler limit. Are the titles alone acceptable on the public site?
8. The premise table names Vecta (revealed in the level 25 freeing scene). That is inside the level 30 limit, but it is a reveal. Keep it?
9. The guide quotes each enemy briefing in that enemy's entry, except Sower (briefing nominal level 31) and the Sower with Spawner combo, which stay out under the spoiler limit. Is quoting briefings in the enemy entries what you want for the field guide?
10. The changelog is now newest first (the old table was oldest first), so the tester-1+96dcc2a row is the top row as the brief asked. Keep that order?

## Gems

Nothing about gems is visible to a player on main: src/economy/* is imported by nothing outside src/economy (grep of src/ui, src/core and src/main.ts for gem, wallet, shop, economy: no hits). src/render/gemGlint.ts is a visual sparkle on nova wells, nova snakes and Leaver shards, not a currency. Gems are left out of the guide.

## Developer only items

In the "For testers" subsection: the HUD level code (and "Level code" and seed in Details), the two finger debug panel, the Settings stress test button. Kept in the main text because they are ordinary settings: Show FPS, Glow, Run seed and Play seed. Left out: every URL parameter (?dev=1 and the knobs boss, tilt, seed, level, debug, surface, glow, stress, particles, bloomRes, bloomQuality, bloomBlur, pond), the corner build label, window.sowDebug, the menu footer seed line.

## Not in the guide (not on main or out of scope)

Trough surface (a stub only: src/core/trough.ts, no generator or UI uses it), the hunt objective (only stubbed events), PVP, co-op, tanks, shops, store launch, prices, the Android app wrapper (the guide says only that the game is played from the web address).

## Image paths referenced

All under docs/player-guide/. Files marked (new) do not exist on main and must arrive with feat/shipwright-guide-img-96dcc2a; the naming follows scripts/guide-images.ts (one file per Kind, lower case) and the brief's boss-<id>.svg contract.

- img/diagrams/controls-cover.svg, img/diagrams/controls-main.svg, img/diagrams/hud-cover.svg, img/diagrams/hud-main.svg (this branch)
- img/shapes/_all.svg, img/shapes/_bosses.svg (new)
- img/shapes/ship.svg, drone.svg, geom.svg, weaponpickup.svg, weaponpickup-rapid.svg, weaponpickup-pierce.svg, weaponpickup-orbit.svg
- img/shapes/dronepickup.svg (new; Kind.DronePickup, should come from the script's per Kind loop)
- img/shapes/grunt.svg, wanderer.svg, pinwheel.svg, weaver.svg, dart.svg, charger.svg, swirl.svg, splime.svg, slime.svg, snakehead.svg, snakebody.svg, bulwark.svg, blink.svg, sower.svg, mine.svg, spawner.svg, gravitywell.svg
- img/shapes/leaver.svg, img/shapes/leavershard.svg (new; Kind.Leaver and Kind.LeaverShard)
- img/shapes/boss-brood.svg, boss-warden.svg, boss-spindle.svg, boss-ember.svg, boss-mirage.svg, boss-gravitas.svg, boss-bastion.svg, boss-tempest.svg, boss-twins.svg, boss-prism.svg (new)

Note: the brief's contract says enemy images are named by FOE_INFO kind, which would give well.svg and snake.svg; the guide uses the existing per Kind names gravitywell.svg, snakehead.svg and snakebody.svg, which the script already writes. Check after both merges.

## Diagrams

All four were wrong against the current layout code and are redrawn with the same file names (they also carried the old name in their titles). Changes: bomb and super moved to a high stack on the right edge with 64 px square hit areas and 56 px discs (super centre (1000, 130) and bomb (1000, 206) on a 1050 x 450 cover; (764, 400) and (764, 476) on an 800 x 720 main), BOMB and super name labels, the thumb rest area, the 68 px main right column, the clock box, the drone row, lives and bombs under the buttons on the cover screen, HUD colours (RAPID light blue, PIERCE violet), and the bottom band layout removed.

## Dash check

`perl -CSD -ne 'print "$ARGV:$.: $_" if /[\x{2013}\x{2014}]/' docs/player-guide/README.md docs/player-guide/img/diagrams/*.svg` printed nothing.

## Name check

"Shape of War" appears once in the guide, in the tester-1 changelog row as "(then named Shape of War)". "Shapes of War" appears nowhere. No diagram title carries either.

## Links

The guide has no links that leave it. The only addresses are the plain text https://play.shapelegend.com. The link to docs/07-install-runbook.md is gone.
