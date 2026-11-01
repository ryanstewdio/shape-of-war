# Glow: gw6-compact

Create and check out branch feat/glow-gw6-compact before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: sonnet
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/audio/, src/ui/, src/input/, src/main.ts, docs/ other than your hand off
Read first: the fluid whirlpool shader module and wellNova.ts (search FLUID_ and WHIRL_), the glint helper, src/render/partLooks.ts (Tempestling look)

## Goal
Device retest (build fb7dff2, Ryan): whirlpool fluid 4.5 of 5: "we can scale down the size of the whirlpools, concentrate gas and shimmers". Tempestlings: "a little too hot coloured".

## Acceptance
- Whirlpool visual radius: draw the gas disc to 65 percent of the sim pull radius (the pull itself is sim and unchanged), with the gas, arms, star dust and glints concentrated into that smaller disc (same counts, so density rises; brighter core). Beyond the disc only a faint 15 percent alpha haze fades out to the pull radius so the pull area is still hinted. Keep the galaxy look from gw5-galaxy, clockwise, inward. Update the tests for the new radius ratio.
- Tempestling colour: cool the palette by moving its body hue 25 degrees toward the boss accent and reducing saturation 20 percent and brightness 10 percent; keep the bright leading edge but in white rather than hot orange. Through the palette and applyNeon only.
- npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/glow-gw6-compact.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
