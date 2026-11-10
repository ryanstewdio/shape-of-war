HAND-OFF glow: trough-depth. Branch: feat/glow-trough-depth (head in the commit). Files: src/render/troughDepth.ts (new), drum.ts, troughGeom.ts, grid.ts, latticeView.ts, renderer.ts.
Depth scale: troughProject's s now carries 1 (floor) to TROUGH_DEPTH_SCALE 1.35 (rim) by ground height, so ship, enemies, bullets, geoms, pickups and effects all grow up the slope; positions and sim hit areas untouched.
Rim light: low tier grid and the outline cut into 6 height buckets, wider and brighter toward the rims (alpha capped at 1 per pass); lattice tiers pick a per node rim texel (floor 0.5, rim 1) written once, no per frame uv upload on a trough. Slope shade kept. Colours stay palette.grid under gridAlpha.
Tests: tests/render/troughDepth.test.ts (11: floor, mid, rim scale, every tilt, billboard pass, cylinder unchanged, rim brightness and width rise, buckets, lattice uv); trough.test.ts updated (s now includes the rim scale).
npm test: pass except the accepted generator perf test (548 ms). npm run build: pass. Legacy v7 grep: clean.
Perf: troughProject about 89 ns per call against 78 ns before (Node, desktop); static lines rebuild only on arena, tilt, fit or neon change; lattice drops its per frame uv upload on a trough. Fold 7 not measured here.
Device: ?dev=1&trough=1 on any flat level, tilt off, low, high, each effects tier; climb a slope and watch the ship grow; rims should read brighter and thicker.
Known gaps: lattice lines are one device pixel (WebGL), so on standard and high they brighten toward the rims but do not thicken; the outline does. Free form layers not drum drawn would miss the scale (none listed today).
Dependencies requested: none. Requests: none.
