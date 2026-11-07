# Foundry: ripple-off

Create and check out branch feat/foundry-ripple-off before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/levelgen/ (ripples.ts, generator.ts, validate.ts, leveldef.ts ripples field), tests/levelgen/, tests/qa/ pins that move because of this change
Do not touch: src/game/, src/render/, src/audio/, src/ui/, src/core/, docs/ other than your hand off
Read first: src/levelgen/ripples.ts, the ripple parts of generator.ts and validate.ts, tests/levelgen/t3.test.ts

## Goal
Ryan's T3 device check on 1f1efb5: the scheduled ripples were "underwhelming and almost not noticeable. I expected the plane (floor) to animate more. With so much going on it's hard to understand the waves are coming." Push rated 1 (no push felt). His direction: attach the ripple to gravity wells. A ripple happens only when a well in super nova is destroyed, right after it is destroyed. No visual warning and no alert sound: just the ripple pushing ship and enemies, with one short wave sound (deep whoomp plus watery whoosh) at the wave start. src/core/pondRipple.ts now has POND_WAVE_WIDTH 160 and POND_WAVE_LIFE 3.2 (Fable); RIPPLE_WARN_SEC is deprecated, stop using it; Fable deletes it and 'sim:rippleWarn' at merge. So the generator must stop scheduling ripples. V9 has been live about an hour; Fable's call: amend V9 in place (no V10), since nothing depends on the ripple field yet.

## Acceptance
- Under V9 the generator no longer emits LevelDef.ripples; remove src/levelgen/ripples.ts, the RIPPLE stream draw and the validator K1 and T1 ripple checks. Keep the LevelDef.ripples field and the RippleEvent type (mark them deprecated in the comment) so Forge's branch still compiles; Fable deletes them at merge. Everything else in V9 (Brood at 5, Warden at 10, first fight 0.75, level 8 drum taste with noDrift) unchanged.
- Earlier versions stay frozen and bit identical. Update the V9 pins that move (hash fold, gcTriage) with a one line reason each; remove the ripple tests from t3.test.ts and keep the rest.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/foundry-ripple-off.md under 10 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Deterministic generator. No em or en dashes.
