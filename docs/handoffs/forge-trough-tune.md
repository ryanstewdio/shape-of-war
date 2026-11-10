HAND-OFF forge: trough-tune
TROUGH_PULL 96 to 144 (1.5x): rim pull about 240 u/s at Normal, about 382 u/s at Insane, under SHIP_SPEED 420, so the rim stays reachable on every difficulty.
Tests: rim bounds now 220 to 260; reachability test asserts the Insane rim pull is below SHIP_SPEED (was 0.75 of it).
Branch: feat/forge-trough-tune
