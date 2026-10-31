# Hand-off: scribe canon-v33

Branch: docs/scribe-canon-v33

## What changed
- docs/13: new section "Canon updates after the device gates (v3.1)" with ten lines, each marked with its DECISIONS clock (47:00, 54:40, 86:30, 88:00, 100:00, 101:20). Covers Ember colour, outline segment damage, Warden shield and hornets (10 s then every 14 s, cap 8, 2.5 s window), Gravitas and Mirage second crack, Brood Broodlings, orbit v2, drone modes with HUD, supernova and nova snakes, three battle tracks, hazard cap 8. Boss rule 9 untouched.
- docs/01: new weapon styles table in section 4 (orbit v2 and the six pairs), supernova and nova snake rows in the 6.7 well table, new 6.8 boss catalogue summary pointing to docs/13.

## Files touched
docs/13-v3-spec-addendum.md, docs/01-game-design.md, docs/handoffs/scribe-canon-v33.md

## Tests added
None (docs only).

## Test and build
npm run build: pass. npm test not run (no code changed). No em or en dashes in added lines.

## Risks
- docs/13 SPEC 3.5 pair table still shows the old Halo, Whirl and Eclipse blade numbers (radius 80, 4 or 5 blades). The new section says it wins on conflict; Swarm should confirm the pair numbers.
- The 6.8 summary is new; docs/01 had no boss catalogue before.

## Open questions
- Nova snake count, speed and lifetime are not specified in the brief or DECISIONS, so none are stated.
- The brief gave no clock for the 10 s, 14 s and 2.5 s Warden numbers beyond 100:00 and 101:20.

## Contracts for other roles
- Glow: Ember flame look, outline segment loss, white tornado well, nova snakes.
- Chorus: three battle tracks with cross fades.
- Swarm: Warden timings, Broodlings, orbit v2, pair inheritance.

## Device check for Ryan
Start a boss level and watch Ember: it should be flame red with shifting multicolour flames. Shoot any boss and confirm it loses outline pieces with no dark marks. On Warden, wait 10 s and check the hornets appear, then again 14 s later, never more than 8 at once. Pick up the orbit weapon and confirm two spike rings that stretch toward your aim with no forward bullet. On a level with a gravity well, wait 5 to 7 s for the white tornado, then 3 to 4 s for the nova snakes.

Session: https://claude.ai/code/session_018Gwqi2rNbNEY8or8ftUNX2
