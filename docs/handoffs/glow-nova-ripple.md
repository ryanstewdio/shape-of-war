# Hand-off Glow: nova-ripple
Branch feat/glow-nova-ripple. Owned files only: src/render/{pondWave,ripple,latticeView,renderer}.ts, new src/render/lattice/pondGlow.ts, tests/render/pondWave.test.ts (28), new tests/render/pondGlow.test.ts (2).
- No telegraph: warn ring, PondWarn api and the 'sim:rippleWarn' listener are gone; RIPPLE_WARN_SEC is no longer read. 'sim:ripple' starts the wave the same frame.
- Floor: amplitude 40 to 80 u by strength (was 10 to 26). The lead crest is the sim band (cos squared, half width POND_WAVE_WIDTH 160), then a trough and two trailing crests 360 u apart (0.6 and 0.36 height). Life POND_WAVE_LIFE 3.2. A test checks the grid never folds over.
- Brightness: lattice lines burn toward white with crest height (pond glow added onto the heat mesh, standard and high). The crest ring outlines go whiter and thicker by height on every tier.
- Low tier with tilt on: the projected v1 grid now bends and lifts under a live wave (tracePondGridProjected).
- Drums: the lattice wave wraps across the seam (wrapDelta by drum width); crest rings go through the owner pen.
- Dev drop ?dev=1&pond=1: a strength 1 wave every 4.5 s, no telegraph.
- Perf (desktop Node, per frame): nothing runs with no wave live; at most 3 waves. Standard lattice (2661 nodes) 0.15 ms with 1 wave, 0.34 ms with 3; spacing 20 (4127 nodes) 0.23 ms and 0.54 ms; low tier tilted trace 0.39 ms with 3. Expect about 3x that on the phone.
- npm test: 2 failures, neither from this branch. One is the accepted generator perf test. The other is tests/game/pondRipple.test.ts "stacks live waves additively", which also fails on main 0296932 (it comes from the width 160 stub; Forge lane). npm run build passes.
- Device check: ?dev=1&pond=1, tilt off, then on. A still screenshot mid wave should show bent, white-lit rings. Then low tier with tilt on and a drum level.
- Known gaps: the low tier drum grid (static rings and u lines) does not bend, only the crest rings show there. Sound is Chorus's job (src/audio is not mine).
- Requests: Fable to delete RIPPLE_WARN_SEC and 'sim:rippleWarn' at merge (nothing in src/render reads them now).
