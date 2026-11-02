# Hand off: glow cylinder-fixes (G9)

Branch feat/glow-cylinder-fixes. Session: https://claude.ai/code/session_018Gwqi3Rd6EcogEZYgLXpQ8

## What changed
- Hard circle and dark ring at the well. The GW6 shader faded the gas to 0 at the visual disc rim, then the haze jumped straight back to 0.15 just outside it and ran to the very edge of the quad. That made a dark ring at the disc rim and a lit band out to the pull radius: the "silhouette circle with hard lines". Now there is one continuous haze envelope: it is flat under the disc and eases smoothly to 0 at FLUID_CLEAR (0.86 of the quad, so 14 percent inside its own bounds). The gas is composited over the haze with a premultiplied "over", so there is no seam. Every pixel from 0.86 out writes vec4(0).
- The quad now honours the mesh alpha (uColor.a times uWorldColorAlpha.a). Before, it drew at full strength on the drum's back half while everything else was dimmed.
- Black marks on cylinder arenas: I could not reproduce these on a device. Pixi's blend for this mesh is premultiplied (Texture.WHITE premultiplies on upload), so it is not a non-premultiplied blend. My best diagnosis is the dark ring above, plus motes and glints stretched pi times wide across the haze edge (next item). The fix removes both.
- Drum attachment. The tilt scene pass mapped the shared well layer, the snake core and the saw with one projection, linearised at the centre of their bounds. That transform stretches u by pi at the front and is anchored wherever the bounds happen to centre, so layers detached and the saw grew about 3x and lifted off the drum. The new pure module src/render/drumPen.ts draws every point relative to an owner. The owner goes through drumProject from its current wrapped position (the short delta from the camera u). Offsets are scaled by the owner's depth and mirrored on the back half, exactly like entity billboards. The back half dims through the fill and stroke alpha, and stroke widths follow depth. On flat and tilted levels the pen is the identity and those levels draw as before.
- Owners: well glints, motes, sparks, bands, the core flare and the calm swirl follow their well. Arrival rings and emergence bursts follow their own position. Each emergence trail point and each nova snake core point is its own owner. Saw teeth, ghosts and the chain follow the ship.
- Nova snake glints are not drawn on the drum at all, per Ryan's note (there is no cheap owner for them).
- The drum camera u now updates before anything is drawn, so the pen and the scene pass use the same u.

## Files
src/render/drumPen.ts (new), src/render/renderer.ts, src/render/tiltScene.ts (new optional drumDrawn list), src/render/wellFluid.ts, tests/render/glowCylinder.test.ts (new, 14 tests), tests/render/wellFluid.test.ts (haze test updated), tests/render/spikeSaw.test.ts (source match updated for the pen).

## Tests and build
npm test: 3906 passed, 1 failed. The failure is the accepted levelgen perf test "200 levels under 350 ms" (639 ms in this VM). npm run build: pass. The v7 grep prints nothing. tests/qa is untouched.

## Risks
- Per frame cost on the drum: one drumProject per point (about 128 motes per nova, plus the snake and the saw). This is trig only, with no allocation. Flat levels add a few multiplies.
- The saw is now drawn at flat size around the ship on the drum, as asked. Other orbit blades (particles) still project per particle.

## Contracts for other roles
None changed. createTiltScene takes an optional drumDrawn list. No events touched.

## Device check for Ryan
1. Open a cylinder level with a gravity well on Standard. Let it nova. Look at the edge of the whirlpool: there should be no circle line and no black marks, just a faint glow that fades out before the pull edge.
2. Fly past the well so the drum turns a long way. The glints and dust should stay inside the whirlpool and travel round the drum with it, dimming when it goes to the back.
3. Let a nova snake crawl out and keep the drum turning. The white core line should stay on the snake's body the whole time.
4. Pick the orbit saw on a cylinder. The teeth and the bar should be the same size as on a flat level and stay round the ship as you circle the drum.
5. Repeat step 1 on a flat level with tilt off and on. The whirlpool should look the same as before, minus the ring.
