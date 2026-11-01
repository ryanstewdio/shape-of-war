# Handoff: chorus gw2-sfx

Branch: feat/chorus-gw2-sfx
Session: https://claude.ai/code/session_018Gwqi6AHC881YUe2Km7ogT

## What changed
- New pure module src/audio/gw2.ts: envelope and parameter helpers plus installGw2(), the bus wiring controller.
- New src/audio/gw2Synth.ts: Web Audio backend. Native node graphs only (LFOs and ramps scheduled at voice start), so no per frame work or allocation.
- src/audio/synth.ts: installs the controller in installAudio, routes through the sfx master (volume setting applies), counts loops in sfxVoiceCount, keeps 4 slots reserved for loops under the 24 voice cap, and play() now steals against the cap minus live loops.
- Saw: two detuned sawtooths near 110 Hz, 28 Hz wobble, band pass sweep, 60 ms in, 120 ms out, one voice.
- Whirlpool: noise plus sub, rising low pass, sine pan LFO, max 2, stopped by fx:kill of Kind.GravityWell with that id.
- Arrival whoosh 1.5 s with thud, snake slither, shield chord plus hum, shatter with falling pings.
- Everything also stops on game:start, game:quit, game:over; a boss down stops its hum.

## Files touched
src/audio/gw2.ts, src/audio/gw2Synth.ts, src/audio/synth.ts, tests/audio/gw2.test.ts, tests/audio/gw2Synth.test.ts, docs/handoffs/chorus-gw2-sfx.md

## Tests added
gw2.test.ts (15: helpers and wiring), gw2Synth.test.ts (2: real synth with fake context, no stacking, voice cap).

## Test and build
npm test: 226 files, 3274 passed, 1 todo, no failures. npm run build: pass. v7 shim grep: clean.

## Risks
- Pause: the saw and loops keep sounding during pause, because the sim sends sim:saw only on edges and a restart on resume would need a new event.
- Whirlpool stops only on a well fx:kill; if a well leaves another way it stops at game end.
- Mix levels are by ear on paper only; gains are constants at the top of gw2.ts.

## Contracts for other roles
None changed. Relies on sim:saw, sim:wellNova, sim:wellSpawn, sim:wellArrive, sim:bossShield, fx:kill (kind and id), sim:bossDown. Request to Forge: emit sim:saw off on game:pause, on again at resume.

## Device check for Ryan
Start a level with the orbit saw and switch it on: a buzzing growl should fade in at once and fade out right after it stops. Let a well arrive: a rising whoosh for about a second and a half ending in a soft thud. When a well goes nova, a low roar should swirl left to right and brighten until the well dies, then fade. Snakes bursting out should give a short wet slither. Fight the Warden: the shield coming up should chime with a hum under it, and breaking it should shatter with falling pings. Turn the volume to 0 and confirm all is silent.
