# Swarm hand-off: boss-scale

Branch feat/swarm-boss-scale. Session https://claude.ai/code/session_018Gwqi71b5nPsmAPDkiGbGx

## What changed
- Fight length: hit points raised in BOSS_TABLE so every boss at Normal on its own level lasts about 235 s on the bossFightLength script (measured 233 to 240 s, band 210 to 260). Damage windows unchanged. Rows past the Int16 store keep the bar at 32767 and turn the rest into armour (armourFor): core hits, and split body parts, are divided by it with the fraction carried, so no tenth is lost. Detonate still takes 10 percent of the bar.
- Enrage moves from 90 s to 240 s, so a long fight is not enraged for most of its length.
- Level scale: levelAttackScale gives 0.75 at level 5 and below, 1.0 at 20, 1.15 at 50 and later, linear between; loops (hpMul above 1) play at 1.15; Endless (level index 0) uses the boss's first pass level. It multiplies the attack clock (bossAdt, also in the Broodling, Gravitant and Tempestling clocks) and every boss bullet speed (shot rows, Warden drop ring, Tempestling fan, rotation). The pool still caps speed at 240.
- Difficulty: applyBossScaling multiplies hit points and cadence by difficultyOf(w).bossScale at spawn (normal until Forge wires it).
- Variety: new rotation.ts. On top of its signature attack every boss fires a bullet volley every 6.5, 6, 5.5 or 5 s of attack time (by tier), cycling aimed fan, radial burst (ship midway between two bullets) and pincer (pairs either side, none on the bearing). It never repeats a pattern. Each phase is one escalation: one more bullet per side and 12 percent shorter gaps. It obeys the 300 u range rule, waits while any volley charges, pauses for entrance, ship down, stagger, phase change and shield, and emits fx:bossShot once per volley.

## Files touched
src/game/bosses: table.ts, core.ts, state.ts, rotation.ts (new), shots.ts, warden.ts, brood.ts, gravitas.ts, tempest.ts. tests/game: bossHelpers.ts, bossFightLength, and the old mechanics files listed under Risks.

## Tests added
bossScale.test.ts (14: curve, Endless, armour, Easy/Normal/Hard on every boss, Warden ring and Spindle pellet at level 5 vs 20, loops). bossDifficulty.test.ts (4: difficultyOf stubbed with vi.mock). bossRotation.test.ts (25: pure patterns and escalation, all ten bosses in play, determinism of all ten with the rotation on and Math.random throwing). bossFightLength.test.ts now covers all ten (11).

## Test and build
npm test: 3997 pass, 2 fail. (1) generator "200 levels under 350 ms" (494 ms, the accepted VM perf exception). (2) tests/qa/bossFairnessSweep "is not vacuous": it expects more than 5 boss kills inside 60 s sessions, which 4 minute fights cannot give. Every per-boss "no violation" sweep passes with the rotation on. npm run build: pass. The v7 API grep is clean.

## Risks
- Mechanics tests tuned on the old hit points pin them with legacyBossHp() for their file or describe (LEGACY_BOSS_HP in bossHelpers). The boss tests default to level 20 (scale 1.0) and rotation off (BossState.rotOn, a test switch like the stress flag).
- Windows timed on attack time get longer on early levels and shorter late (Tempest's rest at 1.1 cadence). bossGw5 pins its scale at 1.0 for the GW5 numbers.
- Warden seeks the ship, so a player who stays close rarely sees its rotation (the range rule).
- Hard Spindle, Mirage, Twins and Gravitas go past the store and rely on armour.

## Contracts for other roles
- Proctor: in tests/qa/bossFairnessSweep, lengthen sessions or relax the boss down count (Request).
- Forge: difficultyOf only needs to return the chosen table; Swarm reads bossScale at spawn.
- Glow and Chorus: no new events. Rotation volleys use fx:bossShot and the enemy bullet pool.

## Device check for Ryan
1. Start a new run on Normal and play to level 5. When the Warden arrives, note the time on a clock.
2. Watch its rings: they come about every 5 s at first, about a second slower than before.
3. Stay more than a third of the arena away. About every 9 s you should see a charged bullet volley: first a narrow fan at you, next a full ring with a gap where you are, then two pairs either side of you. After it drops below half health the volleys carry more bullets.
4. Fight it to the end. The kill should come about 3.5 to 4 minutes after it arrived, and there should be no lag in the fight.
5. Repeat at level 20 (Ember). Its fans should feel faster than the Warden's.
