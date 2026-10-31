# Ledger hand-off: hud-menu

Branch `feat/ledger-hud-menu`. Session: https://claude.ai/code/session_018Gwqi5jkocHDqYdep9QYXM

## What changed
- Drone indicator (GW1): the mode name (Homing, Detach, Rapid, Double) in title case and in the mode colour, with a 20 s countdown bar. It flashes on `fx:droneArm`, fades over 0.8 s on `fx:droneExpire`, and disappears at once when a drone is lost on death (an empty `hud:droneWeapon` with no expire event). Cover: it sits in the row under the weapon indicator (the objective, level line and column boss rows move down 22 px). Main: it sits right of the weapon indicator in the same row, and the run up to the objective and boss boxes is split between the two. The top band, columns and play rect are unchanged.
- Combine flash: on `fx:weaponCombine` the weapon label glows, shows the pair name (HAIL, TRIDENT, HALO, NEEDLE, WHIRL, ECLIPSE) and gets a small "combined" caption for 1.5 s. The caption is a CSS `::after` that reads `data-note`, so the label's textContent stays the name.
- Clock: the countdown, flashes and fade all advance on `hud:score`, like the boss banner, so a pause freezes them. Each step is capped at 0.25 s.
- Multiplier boxes are narrower to make room: cover 52 to 40 px, main 64 to 48 px. Both still fit x999 (existing test).
- Main menu: a centred panel with a double border (cyan border plus magenta offset outline, both glowing) and the title in the existing `.sow-title` style. Four stacked framed rows; the focused or last tapped row has a warm orange frame. The info line sits under the rows and a thin footer under that shows the build id. Rows enter with a 200 ms stagger, every time the menu opens. The screen is dimmed less, so the grid shows through. Cover: title on the left, rows and info on the right. Main: everything stacked. All geometry comes from the pure `menuLayout`, and rows are never under 44 px. Touch only, and the existing callbacks and labels are unchanged.

## Files touched
src/ui/indicator.ts (new), src/ui/hud.ts, src/ui/hudFrame.ts, src/ui/menu.ts, src/ui/dom.ts (CSS), src/main.ts (hud.clearDrone on a new world, menu.layout in relayout, menu.setFooter).

## Tests added
- tests/ui/indicator.test.ts: 29 (state machine and HUD wiring on the fake DOM).
- tests/ui/menu.test.ts: 20 (layout fits on 4 cover and 4 main viewports x 4 inset sets, 44 px hit size, no block overlap, stagger, CSS rules, callbacks, focus, no key or mouse code).
- tests/ui/hudFrame.test.ts: +7 (drone boxes clear of every box, the boss bar on both cover variants, buttons, arena, play rect and banner; beside the weapon; labels fit).

## Test and build output
- `npm test`: 3231 passed, 1 failed. The failure is the accepted exception: generator "200 levels under 350 ms" took 424 ms in this VM.
- `npm run build`: pass. The v7 API grep prints nothing. No em or en dashes.
- Menu screenshots checked in headless Chromium at 960x411 and 832x750: both readable, panel inside the screen.

## Risks
- Label fit uses estimated glyph widths. On main screens narrower than about 800 px, "ECLIPSE combined" may lose its last letter or two (it is clipped, never spills).
- The focused row is held in memory only. "Last used" resets when the app restarts.

## Open questions
- Should the first row say "Play" instead of "Adventure" on a fresh save? I kept `continueLabel(1) === 'Adventure'` because an existing test pins it.
- The drone mode hues (homing 335, detach 95, rapid 22, double 290) are UI-local. If Glow adds mode colours to neon.ts, the HUD should read them from there.

## Contracts for other roles
- Ledger consumes `fx:droneArm`, `hud:droneWeapon`, `fx:droneExpire` and `fx:weaponCombine` as they are. No payload change.
- Swarm: please keep sending `hud:droneWeapon` with remaining 0 on death or disarm, after `fx:droneExpire` on expiry. That order is what tells fade apart from instant hide.

## Device check for Ryan
1. Open the game folded (cover). The menu shows a glowing panel: the title on the left, four framed rows on the right, and Adventure or Continue in an orange frame. The rows slide in one after another. The seed line is under the rows and the build id is on the bottom line. Tap Settings, then come back: Settings now has the orange frame.
2. Unfold. The menu restacks into one column with the title on top, and every row is easy to hit.
3. Play a level until a drone pickup drops and collect it. Next to the weapon indicator (folded: just below it), a coloured mode name such as "Homing" flashes, and a bar starts draining over 20 s. Let it run out: the name and bar fade away in under a second.
4. Collect two different weapon pickups in a row. The weapon label flashes, shows the pair name (for example TRIDENT) and a small "combined" for about a second and a half.
5. During a boss fight on both screens, the drone indicator never touches the boss bar or the arena.
