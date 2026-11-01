# Hand-off: chorus roar-level

Branch: feat/chorus-roar-level
Session: https://claude.ai/code/session_018Gwqi5EgLGE6HrynckFVKB

## What changed
- Whirlpool roar gain 0.16 to 0.088 (down 45 percent).
- Roar filter sweep top capped at 1.2 kHz (NOVA_FILTER_HI = 1200).
- Pan sweep depth halved (NOVA_PAN_DEPTH = 0.5, applied through a gain node on the pan LFO).
- Second concurrent roar is 6 dB under the first (novaLevelFor).
- Well arrival whoosh gain 0.14 to 0.098, thud 0.2 to 0.14 (down 30 percent), band pass top 2400 to 2000 Hz.

## Files touched
src/audio/gw2.ts, src/audio/gw2Synth.ts, tests/audio/gw2.test.ts

## Tests added
1 new test in gw2.test.ts on the pure helpers (gains, caps, pan depth, 6 dB step); pan assertion updated to the new depth.

## Test and build
npm test: 264 files, 3723 passed, 1 todo, no failures. npm run build: pass. V7 API grep: empty.

## Risks
- Roar is now much quieter; the second roar is quieter still. Retune constants if it is too faint.
- Backend startLoop gained an optional level argument (compatible with existing callers).

## Contracts for other roles
No event changes. sim:wellArrive, sim:wellNova, sim:saw, sim:bossShield untouched.

## Device check for Ryan
Start a level with a gravity well and let it arrive: the arrival whoosh should be clearly softer and less hissy. Let the whirlpool roar start: it should be a darker, lower rumble that pans gently rather than swinging hard side to side. With two wells active, the second roar should be audibly quieter than the first. Other sounds should be unchanged.
