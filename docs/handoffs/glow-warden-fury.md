HAND-OFF glow: warden-fury  Branch: feat/glow-warden-fury  Head: see git log (code and hand-off in one commit)
Files: src/render/wardenFury.ts (new, pure), src/render/renderer.ts (fury body, spikes, dash aim layer); tests/render/wardenFury.test.ts (new, 20)
Look: fury 1 shakes the drawn body (4 u, sines of furyT), flashes blue and white 2 to 11 Hz, crosses to hot red (palette red lifted 12 percent), six corner spikes grow 0 to 1.5 R. Fury 2: hot red body and glow (white body context tinted, cracks kept), full spikes, 1 Hz alpha pulse 0.6 to 1. Fury absent or 0: unchanged.
Dash aim: dashAim >= 0 draws a 3 u red dashed blinking line from the Warden along dashHeading to the arena edge (box, or circle for circle and hexagon arenas; cylinder stops at the rims or half a width). Drum and trough sample each dash through the drum pen; flat and tilt via the tilt pass.
npm test: 5220 pass, 1 fail (accepted generator perf timing, 552 ms vs 500)  npm run build: pass  v7 grep: clean
Verify on device: 1. Empty the Warden shield bar: it shakes, flashes faster, turns red, spikes grow. 2. After 4.5 s: red, spiked, slow blink, clear on the cover. 3. Dash charge: blinking red dashed line to the wall on flat, drum and trough levels.
Dependencies: none. Requests: none. Gaps: no extra spark burst added (existing effects only); aim line has no bloom copy.
Session: https://claude.ai/code/session_018Gwqi3vfL71Z53n3iTFYf4
