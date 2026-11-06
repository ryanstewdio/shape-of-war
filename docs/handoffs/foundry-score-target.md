# Hand-off: foundry-score-target
Branch: feat/foundry-score-target. Session: https://claude.ai/code/session_018Gwqi3u944vvcuHHuSDHsa

## What changed
- src/levelgen/generator.ts: when par comes from the whole level model (version 6 and 8, every R1+ level), the scoreInTime target is wholeLevelTarget(par) = 0.6 x par on the PAR_STEP grid, at least PAR_MIN. V1 to V5 targets unchanged (pinned).
- src/game/difficulty.ts: objectiveFor and levelWithTarget scale the target with parScale through core/stars scaleTarget, the same rounding as par and the stars, so it never passes the 1 star line. Normal returns the same object.
- src/game/game.ts: createGame applies levelWithTarget next to levelWithLiveCap, so world.level.objective holds the scaled target the sim judges.
- src/ui/intro.ts: introCard goal and victory lines read objectiveFor(objective, difficulty).
- Tester 1 style seed 2471588027 level 4: goal 576.5K at Normal (par 960.5K, Hard 1 star 1.1M). Was about 11K.

## Tests
- tests/levelgen/scoreTarget.test.ts (9), tests/game/scoreTarget.test.ts (6), tests/ui/scoreTarget.test.ts (3).
- The sweep spreads 500 seeds over levels 1 to 60 (6 levels per seed, 50 seeds per level, 3000 levels, about 9 s). A full 500 x 60 grid takes about 90 s.
- Moved pins: tests/levelgen/gcTriage.test.ts L7 D54392E1 to 67CA3136, L31 DDB938BA to FB62FC82; tests/levelgen/r3length.test.ts V6 fold 3a33d889 to fd696876. No tests/qa pin moved.
- npm test: 4749 pass, 1 fail (accepted perf exception, generation is fast, fails on main too). npm run build: pass. v7 grep: clean.

## Request (outside my ownership, needed for the HUD and results)
- src/main.ts lines 445, 815 and 882 pass level.objective (unscaled) to objectiveProgress, settleAdventure and fallbackStatus. Change all three to world.level.objective. Until then the HUD bar on Easy, Hard and Insane shows the Normal target.

## Device check
1. Hard, a scoreInTime level: intro goal, HUD bar "Score x / T" and the win at the clock all use the same T, about 0.69 x Normal par.
2. Normal: goal is about 60 percent of the 1 star line.
