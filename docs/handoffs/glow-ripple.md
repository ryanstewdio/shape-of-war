HAND-OFF glow: ripple
Branch: feat/glow-ripple  Head: see git log (this commit)
Files changed: src/render/pondWave.ts (new), src/render/latticeView.ts (setPond, render time overlay plus tilt lift), src/render/ripple.ts (traceRippledGrid takes pond waves), src/render/renderer.ts (events, sim clock aging, telegraph and crest outlines, dev drops)
Tests added: tests/render/pondWave.test.ts 23 (front radius = POND_WAVE_SPEED x age, peak push on the sim front, 3 crests, fade, telegraph life, at most 3 waves, cleanup flat, lattice nodes and v1 trace)
npm test: 4794 pass, 1 fail (accepted generator perf exception: 200 levels 710 ms over 500 ms)  npm run build: pass. v7 grep empty.
How to verify on device: 1. Open the dev URL with ?dev=1&pond=1 (add &tilt=low or &tilt=high to check tilt) and start any flat level. 2. Every 4.5 s a ring tightens and pulses at a drop point for 1 s, then a pond wave with 2 trailing crests spreads out at 360 u/s, fades, and the grid is flat again by 2.6 s. 3. Check effects low, standard and high, and tilt off, low and high.
Look: render time displacement (never integrated), so the grid returns exactly to rest. Amp 10 to 26 u by strength, wavelength 135 u, lift x1.2 under tilt. Colour is palette.grid mixed toward palette.white; no bloom knobs touched. Waves age on the sim clock (w.time), so a pause freezes them with the sim.
Perf: nothing runs while no wave or telegraph is live. Overlay with 3 live waves: 0.38 ms per frame at 2500 nodes and 0.64 ms at 5000 on the cloud container CPU, plus the position upload the ambient drift already does. Not measured on the Fold 7 yet; please read the frame time with ?dev=1&pond=1.
Dependencies requested: none
Requests (changes outside my ownership): none
Known gaps: low effects tier with tilt on shows the telegraph and crest outlines but not the grid bend (same gap as the explosion ripple). Wave age starts at the draw after the event, so it can lag the sim by up to one tick (about 6 u). No heat colour pulse on the lattice yet.
