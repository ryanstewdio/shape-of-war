HAND-OFF ledger: scene-revise
Branch: feat/ledger-scene-revise
Cause of the Resume bug: while a story scene held the sim, the loop returned before polling touch input. A pause press latched during the scene (Skip sits under the pause button) fired on the first live step, so level 1 opened on the pause screen. The call sign keyboard could also flip the aspect class on resize and auto pause the run.
Fix: src/story/hold.ts. stepInput always polls and drops input while a scene is open; resizePauseAllowed blocks the resize pause during a scene. Wired in src/main.ts.
Scenes: src/story/scenes.ts matches docs/19 (opening 7 panels, two Torus lines; Grunt briefing 4 panels). New visuals gridFull, dimSpread, dimSwarm in src/ui/story/draw.ts.
Tests: tests/story/hold.test.ts (4, reproduces the bug), tests/story/scenes.test.ts (opening exception).
npm test: pass except the accepted generator perf test (859ms vs 500ms). npm run build: pass.
Verify on device: finish the opening with Skip and with typed call sign, confirm level 1 plays, not Resume.
Dependencies requested: none. Requests: none. Known gaps: draw code for the new visuals not seen on device.
