Kickoff: 2026-10-27T08:49:39Z
History: docs/STATUS-ARCHIVE.md. Decisions: docs/DECISIONS.md (newest rows at the bottom).

## Current position (2026-11-11)
- Game: Shape Legend. Repo ryanstewdio/shape-of-war (public). Live web: https://play.shapelegend.com (deploy on every merge to main). Android: Capacitor debug APKs built on the Mac by dispatcher shell jobs; Ryan's test APKs are dev builds (npm run build:cap:dev: dev items on, Settings "Unlock all levels", fight timer on results and as a 6 s toast).
- Main is protected: PR only, required check "gate", branch up to date, merge commits only. Morpheus merges builder PRs with .agents/merge-pr.sh; only Ryan merges Furiosa cx/* PRs.
- Generator: V14 is current for Adventure guardian levels (par per difficulty over a tiered fight, LevelDef.difficultyPar); V13 arenas from 10; V12 troughs from 24; V1 to V13 frozen.
- Guardians: Shield (blue) over Health (red) bar, crack at the Shield end. Fury mid point (shared, src/game/bosses/fury.ts): 4.5 s invincible break, then enraged. Live for Warden (dash charge), Spindle (needle arms, 4 arms enraged), Ember (enraged Leavers on stun), Mirage (false landings), Gravitas (tide); Brood's body has none, its Broodlings enrage (pincer). Regular enemies after a guardian enters: Easy 0, Normal 25 percent, Hard 50 percent, Insane 60 percent. Pierce 1.5x on guardians; Pierce passes through Bulwark's front shield. Enraged Ember is a blue flame. Hit feedback: flash, sparks, tick, crack glow.
- Furiosa lane live: PR 15, 20 and 27 merged; publishes through the GitHub connector only (never git push); runs unattended ("Approve for me", ruled 2026-11-11); issues stay test only or isolated files; checkout starts at 8ba70ea, cause unknown.

## Open checks and items
- Awaiting Ryan's device check on dev APK 4a5e3bc (sent 2026-11-11; b79c954 and ecc5807 are superseded and were never checked). Three templates were sent: (1) wave check: enraged Spindle 4 arms, Ember blue flame, crack width, Bulwark with Pierce (passes the shield, 2 damage, PIERCE_BULWARK_DAMAGE), tick only hit sound, level 15 par reachable (V14), fight lines and ratings for Brood, Spindle, Ember; (2) sweep of levels 25, 30, 35, 40, 45, 50 on Normal (fight line and rating each); (3) fury three: Broodling frenzy and pincer, Mirage false landings and double image, Gravitas tide and ring flash.
- From Ryan's fury three check on 4a5e3bc (2026-11-12): (1) FIX MIRAGE first: fight not finishable in reasonable time (tiny damage opening, little damage per hit, over 6 minutes); diagnose before any number change (shield gate arc, hit points 1620, fury break, mirrors). (2) Gravitas needs a redesign, Ryan's idea: it leaves low gravity puddles that disappear over time; propose a design for his approval. (3) Brood pincer not noticeable: propose a telegraph or stronger move. Mirage looks and false landings were not rated. Wave check and sweep templates still unanswered.
- Fury table approved by Ryan for all seven. Landed: Brood, Mirage, Gravitas (swarm-fury-three PR 52, glow-fury-three PR 53; constants BROOD_FRENZY, MIRAGE_FURY, GRAVITAS_FURY in src/game/bosses/table.ts, all untuned). Next: wave 2 Bastion (wall in: four membrane walls; Foundry must widen validator M1 beyond drums first), Tempest (crosswind), Twins (hunting bond); wave 3 Prism (crown walls).
- Swarm requests from fury three, not built: a signed pull strength in src/game/bosses/core.ts so the Gravitas push lives in bossContacts; createBossView defaults for frenzy, tide, tideFlipIn. Known gaps: Brood slime and dart clocks pause during a pincer; the push pauses with the boss step (bomb stagger); the pincer has no telegraph field of its own.
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
Diagnose and fix Mirage (Swarm), with Ryan's yes on the proposed numbers. Propose the Gravitas redesign (low gravity puddles) and a more noticeable Brood pincer for approval. Then wave 2: Bastion, Tempest, Twins. Dispatcher sequence: next job is 1161.
