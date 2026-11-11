# Swarm hand-off: pierce-bulwark
Branch feat/swarm-pierce-bulwark. Pierce (style pierce, combos too) now deals PIERCE_BULWARK_DAMAGE (2, exported from bulwark.ts) to a Bulwark from any side; still passes the front arc. Two hits kill.
Other enemies, weapons and bossDamageForStyle unchanged (combat.ts pierce branch only).
Tests: tests/game/pierceArms.test.ts (front 2, back 2, two kill, spread front absorbed, spread back 1).
npm test: all pass; npm run build: see run. Requests: none. Known gaps: Ryan to tune the 2 on device.
