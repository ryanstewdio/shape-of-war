HAND-OFF Scribe: guide-update-1c52828
Branch: feat/scribe-guide-1c52828. Files: docs/player-guide/README.md, img/diagrams/hud-cover.svg and hud-main.svg (level code removed from the HUD level line).
Header now 1c52828 (tester-1+1c52828), written 2026-11-12. Changed in this version rewritten; new Changelog top row. No tags older than two versions existed.
Sections changed: 1 (guardians 35 to 50 serve Vecta), 4 (HUD clock, goal label, level line, boss strip; guardian par per difficulty), 5 (start card, mission headlines, no clock on destroy and guardian), 6 (enemies after a guardian enters; trough pull row), 7 (shelter pool float, trough pull), 8 (Pierce on Bulwark and guardians), 10 (Bulwark), 11 (visual cues), 12 (trough levels, guardian arenas), 13 (health bar, phases, cracks, fury, hit feedback, waves by difficulty, Normal par bonus, every guardian's hit points, Brood split and frenzy, Warden, Spindle, Ember, Mirage, Gravitas fury rows), 14 (Brood first, Every 2 min, Arena surface), 16 (Reset progress), 17 (tick, old hit cue gone), 18 (footer, tester session items, Android app), 19 (Fury, Shelter pool, Shield strip, Trough).
All three 2026-11-11 gaps fixed (Every 2 min, Arena surface Flat / Trough, Brood then Warden).
Canon conflicts (code wins, guide follows code):
- docs/01-game-design.md:305 level line "L3  Par 1,000  #abcd1234"; code shows the code only in dev sessions (src/ui/hud.ts levelLine showCode).
- docs/01-game-design.md:372 five build label taps reveal the stress button; code needs a dev session (src/ui/settings.ts:583).
- docs/13-v3-spec-addendum.md:86 Endless boss 1 is Warden; code opens with Brood (src/levelgen/boss.ts orderedBossOfNumber, bossForSegment).
- docs/11-v2-spec-addendum.md:30 Bulwark shield absorbs player bullets; Pierce passes through for 2 damage (src/game/combat.ts:210, src/game/enemies/bulwark.ts PIERCE_BULWARK_DAMAGE).
Unknowns: none written as unknown. Note: the guardian kill bonus reads Normal par on every difficulty (src/game/bosses/core.ts:851 w.level.par); the guide now says so.
