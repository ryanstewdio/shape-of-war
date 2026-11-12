Kickoff: 2026-10-27T08:49:39Z
History: docs/STATUS-ARCHIVE.md. Decisions: docs/DECISIONS.md (newest rows at the bottom).

## Current position (2026-11-12)
- Game: Shape Legend. Repo ryanstewdio/shape-of-war (public). Live web: https://play.shapelegend.com (deploy on every merge to main). Android: Capacitor debug APKs built on the Mac by dispatcher shell jobs; Ryan's test APKs are dev builds (npm run build:cap:dev: dev items on, Settings "Unlock all levels", fight timer on results and as a 6 s toast).
- Main is protected: PR only, required check "gate", branch up to date, merge commits only. Morpheus merges builder PRs with .agents/merge-pr.sh; only Ryan merges Furiosa cx/* PRs.
- Generator: V14 is current for Adventure guardian levels (par per difficulty over a tiered fight, LevelDef.difficultyPar); V13 arenas from 10; V12 troughs from 24; V1 to V13 frozen.
- Guardians: Shield (blue) over Health (red) bar, crack at the Shield end. Fury mid point (shared, src/game/bosses/fury.ts): 4.5 s invincible break, then enraged. Live for Warden (dash charge), Spindle (needle arms, 4 arms enraged), Ember (enraged Leavers on stun), Mirage (false landings), Gravitas (tide plus shelter pools: no pull or push inside, the ship floats); Brood's body has none, its Broodlings enrage (pincer: 0.8 s aim with flash and aim lines, 320 u/s drive). Mirage's shield opening is 180 deg turning 0.8 rad/s, 1150 hp, one lane per burst aimed at the ship; the fight bot is gate aware. Regular enemies after a guardian enters: Easy 0, Normal 25 percent, Hard 50 percent, Insane 60 percent. Pierce 1.5x on guardians; Pierce passes through Bulwark's front shield. Enraged Ember is a blue flame. Hit feedback: flash, sparks, tick, crack glow.
- Furiosa lane live: PR 15, 20 and 27 merged; publishes through the GitHub connector only (never git push); runs unattended ("Approve for me", ruled 2026-11-11); issues stay test only or isolated files; checkout starts at 8ba70ea, cause unknown.

## Open checks and items
- Awaiting Ryan's device check on dev APK 5e6fe77 (fury fixes, sent 2026-11-12; supersedes 4a5e3bc). Template: Mirage (half ring opening, aimed lane, fight line, ratings), Gravitas pools (shelter, float, fight line, still boring?), Brood pincer (telegraph noticeable, drive dodgeable, fight line), fps.
- Still unanswered from 4a5e3bc: wave check template (Spindle 4 arms, Ember blue flame, crack width, Bulwark with Pierce, tick only sound, level 15 par, fight lines for Spindle and Ember) and the sweep of levels 35 to 50 on Normal. Resend when Ryan is ready; never fill a blank field.
- Fury fixes known gaps (swarm-fury-fixes, glow-fury-fixes): the aimed Mirage lane is spawned on the opposite bearing then turned onto the ship (request: a spawnLane aimed flag in core.ts); the float starts the step after the ship enters a pool; holdT carries from a float into low or medium handling; the lattice is not flattened inside pools. Mirage bot: Easy 43.8 s, Normal 96.3 s, Insane 173.1 s.
- Fury table approved by Ryan for all seven. Landed: Brood, Mirage, Gravitas (fury three PR 52 and 53, fury fixes PR 56 to 58; constants BROOD_FRENZY, MIRAGE, MIRAGE_FURY, GRAVITAS_FURY, GRAVITAS_POOL in src/game/bosses/table.ts). Next: wave 2 Bastion (wall in: four membrane walls; decide with Ryan whether they are runtime sim objects or level data, which would need Foundry to widen validator M1), Tempest (crosswind), Twins (hunting bond); wave 3 Prism (crown walls).
- Swarm requests from fury three, not built: a signed pull strength in src/game/bosses/core.ts so the Gravitas push lives in bossContacts (createBossView defaults and the pincer view fields landed in PR 56). Known gaps: Brood slime and dart clocks pause during a pincer; the push pauses with the boss step (bomb stagger).
- Guardian par known gap: a tier 3 or 4 guardian killed in about 30 s leaves Normal par at 0.96 to 1.32 of available.
- Fight lines (dev timer) not yet recorded by Ryan; hit points tuned from his ratings: Brood 3, Warden 4, Spindle 4, Ember 4 on 9c799e2.
- Later queue: hunt objective, gems wiring to results and storage, native icons and splash, Dependabot alerts, Foundry clean up of the old 'every3' levelgen bosses, ripple "pixelated short decay" sound idea.
- Not yet tested: iPhone Safari install and audio, small phone layout, fps at Insane plus Swarm.

## Recent gates (newest first)
| Gate | Date | Result | Evidence from Ryan |
|---|---|---|---|
| Fury three | 2026-11-12 | partial | 4a5e3bc: Brood split flash yes, hot green frenzy yes, pincer not noticeable but fair, fight 1:52 total, rated 3.5 acceptable; Mirage broken: only takes damage through a tiny opening and takes little damage, would take over 6 minutes; Gravitas break yes, ring flash yes, push and pull readable and fair, fight 2:35, rated 3, but a bit boring and needs a redesign; fps not given |
| Boss calm and arenas | 2026-11-11 | pass with notes | 9c799e2: Brood 3, Spindle 4, arena right, needles fair, enraged Spindle 3 arms (bug), Ember 4, Leavers yes, calmer waves yes, hits readable, cracks too thick in places, 59 fps |
| Fury two | 2026-11-11 | partial | ecde5b2: Brood 0:22 rated 1, refill yes; levels after 10 too hard (swarm plus small arena); hits hard to read; 60 fps |
| Warden fury | 2026-11-11 | pass | 1580146: unlock yes, one bar yes, Warden fun 4, break, enraged form and aim line clear |
| Boss health | 2026-11-11 | partial | 1d724e3: footer right over the old app, bar on the wrong element, Brood 150 to 170 s, Warden 37 s, Pierce yes, trough 60 fps |
| Trough and native | 2026-11-10 | pass | 6987c7c after clearing data: troughs, pull 3, 3D 4; Auto Backup cause found |

## Next action
Ryan's device check on 5e6fe77 (fury fixes). Then wave 2: Bastion, Tempest, Twins (decide with Ryan whether Bastion's membrane walls are runtime sim objects or level data before any brief). Dispatcher sequence: next job is 1185.
