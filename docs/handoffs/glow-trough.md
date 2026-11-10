HAND-OFF Glow: trough
Branch: feat/glow-trough  Head: f41b613 (feature commit; this hand-off is the next commit)
Files changed: src/render/drum.ts, drumPen.ts, latticeView.ts, renderer.ts, troughGeom.ts (new); tests/render/trough.test.ts (new)
Tests added: tests/render/trough.test.ts, 15 (profile at bottom, slope, rim; no seam; tilt; pen no wrap; cylinder unchanged; shade, outline, grid)
npm test: 5053 pass, 1 fail (accepted generator perf exception, 514 ms)  npm run build: pass
How to verify on device: 1. Open ?dev=1&trough=1&level=24&seed=11 (render only knob: any non cylinder level drawn as a trough, no pull). 2. Play typed seed, check the valley: edges sag to the middle, rims brighter. 3. Repeat with tilt off, low, high, cover and inner screen, each effects tier. 4. Without the knob, a flat and a drum level look as before. 5. Read FPS on the dev panel against the same seed without the knob.
Perf: headless swiftshader, same seed, trough vs flat: 101.6 vs 99.3 ms, 71.5 vs 69.2 ms (about 2 to 3 percent, software GL). Lattice path is the cylinder's (projects every node each frame); outline, grid, shade and obstacles are static. Fold 7 cost not measured here.
Dependencies requested: none
Requests (changes outside my ownership): Foundry sets def.surface 'trough' (level 24 up, Free Play option); Ledger may list 'trough' in DEV_KNOBS (src/ui/devGate.ts).
Known gaps: lattice lift is along the view axis, not the surface normal; snake glints stay off as on drums; drift streaks off on troughs.
