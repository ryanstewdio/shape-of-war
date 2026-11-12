# Shipwright hand-off: guide-images-1c52828

Branch: feat/shipwright-guide-img-1c52828
Regenerated with `node scripts/guide-images.ts` at main 1c52828 (after `npm ci`, no new dependency).
Images added: none. Images removed: none.
Images changed: docs/player-guide/img/shapes/boss-mirage.svg and docs/player-guide/img/shapes/_bosses.svg (Mirage shut body and spokes now start at angle 0 instead of a rotated start).
Script: no Kind or guardian was missed (it reads Kind, BOSS_IDS and BOSS_SPECS at runtime), so scripts/guide-images.ts is unchanged.
Determinism: two consecutive runs gave identical sha256 for every file under img/shapes/.
npm run build: pass. npm test: 5441 pass, 1 fail (tests/levelgen/generator.test.ts timing check, 588 ms vs 500 ms, fails alone too; unrelated to svg files, slow cloud box).
