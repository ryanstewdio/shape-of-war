HAND-OFF foundry: ripple-off
Branch: feat/foundry-ripple-off
Changed: removed src/levelgen/ripples.ts, the RIPPLE stream draw and rippleClear in generator.ts, the K1 check in validate.ts; LevelDef.ripples and RippleEvent kept, marked deprecated. V9 amended in place.
Tests: t3.test.ts ripple block removed, rest kept. No pins moved: hash fold and gcTriage levels carried no ripples, so their values are unchanged.
npm test: 4835 pass, 2 fail. generator perf (accepted exception) and tests/game/pondRipple.test.ts "stacks live waves additively" (fails on the base commit too, from the POND_WAVE_WIDTH/LIFE change; src/game is not mine). npm run build: pass.
Requests: Fable to delete LevelDef.ripples, RippleEvent, and fix or drop the pondRipple stacking test at merge.
Known gaps: none.
