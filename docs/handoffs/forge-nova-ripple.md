# Forge hand-off: nova-ripple

Branch: feat/forge-nova-ripple. Ripples now start only when a Gravity well in super nova is destroyed: shot down, cut by orbit blades, or blown up at MASS_LIMIT. The ripple starts at the well centre on that same step and fires 'sim:ripple' { x, y, strength }. LevelDef.ripples is no longer read and 'sim:rippleWarn' is never sent.
- strength: 0.6 for a base size well, rising linearly with radius to 1 at full mass (novaStrength).
- Push: SHIP_PUSH is 0.8 x ship speed (336 u/s), ENEMY_PUSH is double that. The band profile is a raised cosine, so the push eases in and out. At strength 1, an idle ship 300 u out is shoved about 192 u. A grunt in the same spot is shoved about 512 u, because enemies ride the front. driftScale applies. Same immunities as T3. Walls and obstacles block. Distances use surface.delta, so the drum seam works.
- Runs in Adventure and Free Play. Endless stays inactive (it has no wells). With no live wave, stepPond returns at once, so runs without a nova kill are bit identical.
- Bombs reset wells; they do not destroy them. So a bomb makes no ripple. Making bombs destroy nova wells would be a design change; that is for Fable to decide.
- Pin moved: tests/qa/normalDifficulty.test.ts, open drum (seed 7 level 33), drift hash changed to 954469006. Reason: a nova well is shot down at 10.86 s and now ripples. The drift off check also turns the pond off, so it still matches the pre release hash.
- Requests: Glow and Chorus can drop the 'sim:rippleWarn' handlers. Fable can delete RIPPLE_WARN_SEC.
- Try on device: seed 7 level 33 (nova at 5.1 s), or seed 42 level 9 (nova at 6.6 s). Wait for the nova, shoot the well down and stay about 300 u away.
