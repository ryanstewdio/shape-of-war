# Swarm hand-off: boss-health
Branch feat/swarm-boss-health. Fight bot seconds (tests/game/bossFightBot.ts: default weapon open fire on the exposed core, parts popped at 0.5 s), Adventure levels (Brood 5, Warden 10, then 15 to 50), before / after:

| Guardian | Easy | Normal | Insane | Table hp |
|---|---|---|---|---|
| brood | 183 / 32 | 330 / 59 | 530 / 103 | 4060 / 459 + Broodlings 3 x 60 |
| warden | 282 / 58 | 313 / 72 | 372 / 76 | 2576 / 519 |
| spindle | 181 / 41 | 329 / 75 | 533 / 121 | 5918 / 1350 |
| ember | 149 / 40 | 345 / 85 | over 600 / 167 | 3205 / 822 |
| mirage | 181 / 49 | 330 / 90 | 534 / 146 | 5932 / 1620 |
| gravitas | 180 / 54 | 326 / 96 | 527 / 155 | 7602 / 1704 |
| bastion | 178 / 62 | 328 / 114 | 535 / 185 | 5222 / 1833 |
| tempest | 178 / 65 | 329 / 121 | 562 / 199 | 5020 / 1832 |
| twins | 181 / 69 | 329 / 125 | 533 / 202 | 5918 / 2250 |
| prism | 182 / 79 | 335 / 150 | 546 / 247 | 1840 / 844 |

Brood first fight discount kept (x0.75, level 5): Easy 140 / 22, Normal 246 / 45, Insane 398 / 78. Pierce: PIERCE_GUARDIAN_MULT 1.5 (table.ts), 60 tenths on bodies, cores and parts via bossDamageForStyle; regular enemies unchanged. bossBar is real: SHIELD_SHARE = 1 - CRACK_AT[0] (0.34), so stage 1 fires as the shield empties and stage 2 sits halfway down Health. Brood's body never dies (held at 1 tenth), then splits; Broodlings scale with hpMul x bossScale and carry their own bar (BossState.splitMax, label "Broodlings"). Gravitas now carries its remaining hp into the Gravitants (its bar dropped too). Twins cracks wait for the shared shield. Bastion turret cut floored (four stay within 20 percent).
Request (Ledger): BossView gained barOn, barHp, barMax, broodlings; readBoss keeps active false after a split, so draw the bar when barOn is true, not when active is. hud:boss maxHp is splitMax during the Broodlings. Known gaps: Warden on Easy is barely shorter (its windows follow cadence, which bossScale also slows). Tests: bossBar.test.ts (19), bossFightLength.test.ts (bands, 20 percent). npm test and npm run build pass.
