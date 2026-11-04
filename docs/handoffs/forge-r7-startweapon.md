HAND-OFF forge: r7-startweapon
Branch: feat/forge-r7-startweapon  Head: see git log (this commit)
Files changed: src/game/ship.ts, src/render/renderer.ts (markSpikes and drawBullets only), src/render/spikeSaw.ts, tests/game/startWeaponDraw.test.ts (new), tests/render/spikeSaw.test.ts
Tests added: tests/game/startWeaponDraw.test.ts 14 (per start weapon: all live bullets draw visibly, and draw codes match the pickup path; orbit teeth marked from frame 1; shot sound rules), tests/render/spikeSaw.test.ts +3 (markSpikeMask, bulletDrawCode)
npm test: 4657 pass, 1 fail (levelgen "200 levels under 500 ms" timing, the accepted perf exception)  npm run build: pass. v7 grep: empty.
Finding: no live player bullet goes undrawn. The sim is identical for a start weapon and a pickup (same equipWeapon call); only the bullet slot ids differ (start orbit teeth sit in slots 0 to 7). A real Chromium run (dev server, ?dev=1&stress=1 with the stored reward, synthetic touch aim) drew the orbit saw, rapid and pierce, on a fresh boot and after Restart, with bloom and with ?glow=sprite.
Cause of the report: orbit fires nothing forward (docs/01 Orbit v2, docs/13 rule 6), but ship.ts emitted sfx 'shot' on every volley at orbit's rate of 6 per second. Holding the aim stick sounded like shooting with no bullet on screen, and the saw teeth made the kills.
Fix: ship.ts plays 'shot' only when a volley spawned a bullet (or one was dropped on a full pool). Orbit is now silent apart from the saw ('sim:saw'). Spread, rapid, pierce and the orbit pairs (Halo, Whirl, Eclipse) are unchanged.
Render: markSpikeMask and bulletDrawCode moved out of renderer.ts into pure functions in spikeSaw.ts, so the tests run the renderer's real per bullet choice. Look unchanged.
How to verify on device:
1. Reach par on a level and pick Orbit, then Next.
2. Hold the aim stick: the saw teeth stretch toward the aim with the saw sound, and no shot sound plays.
3. Wait 20 s for orbit to expire: spread bullets draw and the shot sound plays.
4. Repeat with Rapid and Pierce rewards: bullets draw from the first volley.
Dependencies requested: none
Requests (changes outside my ownership): Chorus/Fable: confirm orbit should have no shot sound. If Ryan wants a firing cue, the saw sound is the hook.
Known gaps: if Ryan saw no saw teeth at all on device, this branch does not reproduce that. A screenshot from the device would settle it. The brief's add_repo step was not available in this session; origin was added by hand.
