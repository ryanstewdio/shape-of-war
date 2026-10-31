# Swarm hand off: boss abilities

Branch: feat/swarm-boss-abilities (from main 8a312ef)
Session: https://claude.ai/code/session_018Gwqi51KevzKtDahLjTxuF

## What changed
- Warden shield and swarm (phase 2 on): every 14 s of attack time Warden stops and its core closes for 4 s. `BossState.shielded` and `shieldLeft` are new, and `BossView.shielded` and `shieldLeft` are optional fields for Glow. It releases Hornets in two bursts, at 0.5 s and 2.0 s, then opens for a guaranteed 2 s. Hornets live in the add slots, so the 8 add cap holds. They fly straight out for 0.35 s, chase `targetOf` at 260 u/s and die on their own at 5.35 s. Contact kills from 0.6 s. A bomb, a ship death or the boss going down clears them, and a shot pops one for no score.
- Gravitas split: at the stage 2 crack the body and anchors go and two Gravitants (160 hits each) orbit a centre that seeks `targetOf`. Each carries its own pull at 50 u/s (half strength). Rings keep collapsing onto the pair centre and contact kills. The bar is the sum of the two, and the fight ends with the second one, with the bonus once.
- Mirage mirrors: at the stage 2 crack two Mirrors appear and the body stays (`bs.split` stays false). 0.6 s after each warp, mirror 0 moves to where Mirage left from and mirror 1 to the position before that. Missing mirrors return every 6 s of Mirage time. Mirrors never kill on contact and pop for no score.
- `sim:bossSplit { id, parts }` fires once per split (Gravitas 2, Mirage 2). No event declarations changed.

## Render contract (Glow, next wave; until then the generic part look)
| Part | PartType (w.a) | Kind | radius | hp (tenths) | w.rot | Notes |
|---|---|---|---|---|---|---|
| Hornet | 5 | BossPart (in an add slot, not bs.parts) | 10 | 10 | heading | age is w.t; armed from 0.6 s |
| Gravitant | 6 | BossPart, slots 0 and 1 | 28 | 1600 | orbit angle | each sits on a Pull hazard (w.vx 50) |
| Mirror | 7 | BossPart, slots 0 and 1 | Mirage body radius (50) | 10 | copies the Mirage shield arc (w.rot of the body) | never lethal |
Warden shield: `readBoss(...).shielded` and `.shieldLeft` (4 s down to 0).

## Files touched
src/game/bosses: core.ts, gravitas.ts, index.ts, mirage.ts, state.ts, table.ts, types.ts, view.ts, warden.ts
tests/game (new): bossWardenShield.test.ts (11), bossGravitasSplit.test.ts (9), bossMirageMirrors.test.ts (7)

## Tests and build
- npm test: 3097 passed, 1 skipped, 1 todo, 1 failed. The failure is `tests/levelgen/generator.test.ts` "generation is fast: 200 levels under 350 ms". It is a wall-clock budget sized for the Mac and it also fails on unmodified main in this container (410 to 506 ms). Every existing boss test passes unmodified, and tests/qa snapshots are unchanged.
- npm run build: pass. The v7 API grep is empty, and there is no Math.random in src/game/bosses (the 60 s determinism tests stub it to throw).

## Risks
- The brief's 8 to 12 Hornets per shield meets the 8 add cap. Both bursts fall inside a Hornet's life, so at most 8 are ever out (fewer when other adds are up), and 9 to 12 are clipped by the cap.
- Gravitants total 320 hits against about 231 left at the crack, so the boss bar jumps up at the split. Brood's split does the same.
- The renderer treats any `sim:bossSplit` as Brood's green shard burst (render/bossSplit.ts), so Gravitas and Mirage splits may show it until Glow keys it by id.
- Mirrors are full body size decoys and soak bullets, which is intended, but the Mirage fight gets longer below 33 percent.

## Requests (outside my ownership)
- Glow: draw Hornet, Gravitant and Mirror per the table, show the Warden shield, and key the split burst by boss id.

## Dependencies requested
None.

## Open questions
- Should the Hornet count drop to 8 (or bursts space out past a Hornet's life) so the 8 to 12 wording holds?
- Should Gravitas rings stop after the split, leaving the two pulls as the whole threat?

## Device check for Ryan
1. ?boss=warden: bring it under half health and wait about 14 s. It should freeze with a closed core for 4 s while two waves of small fast hornets pour out in every direction and chase you. A bomb should wipe them. When the shield drops, the core should take hits for 2 s.
2. ?boss=gravitas: take it under a third. It should burst into two smaller wells circling each other and drifting toward you, each tugging you, with rings still closing in. Kill both to end the fight; the bonus should show once.
3. ?boss=mirage: take it under a third. Two copies should appear where it just was and keep trailing its last two spots a moment after each warp. Shots pop them with no score, touching them is safe, and they come back about every 6 s.
