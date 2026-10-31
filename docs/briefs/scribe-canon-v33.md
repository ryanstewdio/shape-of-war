# Scribe: canon-v33

Create and check out branch docs/scribe-canon-v33 before any edit. Never push main.

Branch: docs/scribe-canon-v33 (create and check out before any edit; never push main)
Model: sonnet
Owned paths: docs/13-v3-spec-addendum.md, docs/01-game-design.md
Do not touch: anything else
Read first: docs/13-v3-spec-addendum.md sections SPEC 3.4, 3.5, 3.6 and the Boss projectiles and Drone pickups clauses; docs/01-game-design.md sections 4 and 6; docs/DECISIONS.md entries from 54:40 onward

## Goal
Bring the v3 canon in line with what shipped and what Ryan decided after the device gates, so builders read current rules.

## Acceptance
- docs/13: boss rule 9 already says boss death completes the level; add: Ember colour is flame red with shifting multicolour flames; bosses lose outline segments as damage (no dark marks); Warden shield and hornet ability (first at 10 s then every 14 s, 8 hornets own cap, 2.5 s window); Gravitas splits into two Gravitants and Mirage leaves mirrors at the second crack; Brood splits into three Broodlings; orbit weapon v2 (two counter rotating spike rings at 80 and 100 u, chainsaw stretch toward the aim, no forward bullet, pairs inherit); drone pickup modes homing, detach, rapid, double with a HUD indicator; gravity well supernova after 5 to 7 s (pull radius x1.25, strength x1.3, white tornado look, multicolour shimmer) and nova snakes after 3 to 4 s; three battle tracks in minor keys with cross fades; the hazard cap of 8. Mark each line with the DECISIONS clock reference.
- docs/01: section 6.7 well table gains the nova rows; section 4 weapon table gains the orbit v2 and pair rows; the boss catalogue summary points to docs/13.
- No em or en dashes; sentence case headings; npm run build stays green.

## Rules
No em or en dashes in any file you write. Do not change any other file.

## Hand off
Write docs/handoffs/scribe-canon-v33.md (under 50 lines): what changed, files touched, tests added, test and build output summary, risks, open questions, render or event contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
