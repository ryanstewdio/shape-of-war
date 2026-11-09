# Shape Legend story bible

Status: approved by Ryan 2026-11-09, with his names: the guide is Torus and the fallen legend is Vecta (replacing the draft names Torus and Vecta, which collided with an AI company and a TV villain). Builders take scene text from here word for word.

Scribe, 2026-11-09, from Ryan's interview answers of the same day (brief docs/briefs/scribe-legend-bible.md). Audience: everyone, children included (docs/16). Language: English, short words a 7 year old can follow. This doc is story canon for scene text; it adds no game feature by itself. Builders take scene text from here word for word.

## World premise
A human pilot wakes alone in Vertane, a world made of shapes and lines of light.
Vertane was in harmony once. Ten guardians kept its colours, and its shapes sang.
Long ago a champion, the Grey Legend Vecta, grew hungry for their light and took it.
Without their colour the guardians and the small shapes turned dim, glitchy and hostile.
Vertane called a new pilot on purpose. The old guide Torus heard the call and came to help.
To survive, the pilot must pass the trials, free the guardians, and become a Shape Legend.

## Names
| What | Name | Notes |
|---|---|---|
| The world | Vertane | The world's grid (the lattice) is its body. It remembers every legend. |
| The corruption | the dim | Shown as colour loss, glitching and dimming. Never as hurt or injury. |
| The guide | Torus, the Old Shape | Ancient, friendly. Made of every shape at once. Answers the world's call; did not summon the pilot. |
| The fallen legend | Vecta, the Grey Legend | The last champion before the pilot. Took the guardians' light. Grey, flickering outline of a ship like the pilot's. |
| The pilot | the player's call sign | Chosen at the start. Silent in every scene. Token `{callsign}` in scene text. |
| Freed light | shards of light | The geoms. What a dim shape becomes when you break it. |

Guardians, in the V9 Adventure order:
| Level | Guardian | What it kept | What the dim made it |
|---|---|---|---|
| 5 | Brood, Keeper of the Nest | Safe homes for small shapes | Guards its nest from everyone |
| 10 | Warden, Keeper of the Old Gate | The way between places | Shuts every way, opens for no one |
| 15 | Spindle, Turner of Days | The turning of time | Turns its arms only to sweep |
| 20 | Ember, the Hearth Flame | Warmth for all | Burns wild and will not rest |
| 25 | Mirage, Keeper of True Sight | Showing what is real | Shows only tricks |
| 30 | Gravitas, Heart of the Deep | The pull that holds Vertane together | Pulls everything to itself |
| 35 | Bastion, the Last Wall | Shelter in storms | Shuts out and pushes away |
| 40 | Tempest, Rider of the Rim | Winds that carry light | A storm that circles and never stops |
| 45 | The Twins, the Bound Stars | Friendship | Their bond became a sweeping bar |
| 50 | Prism, Crown of All Colours | Every colour, shared out | Vecta's throne, holding all colour in |

Name check: Vertane, Torus and Vecta are coined for this game; the guardian names are the existing boss ids with new titles. None is taken from another game or franchise to Scribe's knowledge; Fable to confirm with a search before release.

## Arc: five acts, levels 1 to 50
Each act is ten levels with two guardians (levels 5 and 10 of the act). Each freed guardian lights one star in the sky above the grid (a visual in its freeing panel only, no new menu).

1. **Act 1, The Waking (levels 1 to 10).** Brood, Warden. The pilot learns to fly and the dim is named. Torus speaks only in riddles. After Warden is freed, a grey outline is seen far off, then gone. Theme: you were called.
2. **Act 2, The Turning (levels 11 to 20).** Spindle, Ember. The world's time and warmth return. Torus starts to explain: a legend came before. Theme: the world remembers.
3. **Act 3, The True Sight (levels 21 to 30).** Mirage, Gravitas. Freeing Mirage shows the truth: Vecta took the light. Freeing Gravitas, the heart, shows Vecta clearly for the first time, on the far rim. Torus stops speaking in riddles and becomes a plain, true ally. Theme: seeing clearly.
4. **Act 4, The Walls and Winds (levels 31 to 40).** Bastion, Tempest. Vecta stops hiding and sends the dim harder. The pilot's ship shines brighter with each guardian freed. Theme: standing firm.
5. **Act 5, The Crown (levels 41 to 50).** The Twins, Prism. The last two guardians. Prism is Vecta's throne. When Prism is freed, all colour returns to the guardians, and Vecta flees beyond the last star to the Hollow Star. The pilot is named a Shape Legend. Theme: becoming the legend.

Where the fallen legend appears: a grey outline brushing each guardian in its intro (from level 5); seen far off after level 10; seen clearly after level 30; watching from the rim in the level 40 intro; flees after level 50, his one spoken line.

Final confrontation (later update): Act 6, The Grey Legend, a trial beyond level 50 at the Hollow Star. The pilot does not destroy Vecta; the pilot surpasses him. When he is beaten his colour returns, he remembers who he was, and he becomes the keeper of the legend trials (see the trials section). Until that update, Adventure after level 50 plays the guardian echoes: the dim sends grey echoes of freed guardians (the existing loop from Ember with more hit points), and the pilot frees them again. No new scenes for echoes.

## Scene rules
- Kinds of scene: opening (once), briefing (new enemy kind or combo), guardian intro (before each boss level), freeing (after the boss is beaten, before results).
- Trigger: a briefing plays before the first level of the run where that kind is in play (the same `newFoes` rule the intro card uses, src/ui/enemyIntro.ts). The generator draws rosters per run seed, so the level in the list below is the nominal level (the first level the kind's band allows); the trigger decides. A combo plays before the first level where both kinds are in play.
- More than one new kind on one level: play their briefings in roster order, at most two. The rest play before the next level. The intro card still lists every new kind, so nothing arrives unnamed.
- Shown once per save, per trigger. Replayable from level select. One tap skips the whole scene.
- Voice: narration first. At most one guide line per scene, marked `Torus:`. The pilot never speaks.
- Text: at most 2 lines per panel, at most 40 characters per line, with `{callsign}` counted as 10 (the call sign cap).
- Every briefing names the threat and gives one plain counter tip. Every guardian intro gives the title, what the dim did to it, and what to watch for.

Panel notation: `Pn (visual): "line one" | "line two"`.

## Opening, before level 1
- P1 (black screen; one grid dot glows, then the lattice draws out from it): "You wake in the dark. No sky. No ground." | "Only lines of light, and one small ship."
- P2 (pilot ship at centre, glow pulse; call sign picker opens after the text): "The ship is yours. It waits for a name." | "What will Vertane call you?"
- P3 (the call sign types out above the ship; the grid brightens once): "{callsign}. The grid hums it back," | "as if it waited a long time to hear it."
- P4 (wide grid; colour drains from the far corners in a slow dim): "This is Vertane, a world of shapes." | "Once it sang. Now the dim is spreading."
- P5 (Torus fades in beside the ship, nested shapes turning): "Vertane called you here, on purpose." | Torus: "You heard it. Good. Now, the trials."

## Scene list, levels 1 to 50

### Level 1: Grunt (new kind)
- P1 (Grunt icon, blue, pulsing; grey static flickers on it): "The first dim shapes are small squares." | "Grunts. They come straight at you."
- P2 (ship circling, shots leading the Grunt): "Keep moving and shoot where they go." | "A touch costs a life, so stay clear."
- P3 (a Grunt breaks into shards of light): "Break one and it turns to light again." | Torus: "Every shape here was good, once."

### Level 1 to 4: Wanderer (new kind, nominal level 2)
- P1 (Wanderer icon, violet bow tie, spinning): "Wanderers drift and do not hunt you." | "They bounce off walls like lost birds."
- P2 (a dotted path bounces off a wall; the ship steps aside): "Read their path and step out of it." | "Do not let one drift into you."

### Level 1 to 4: Pinwheel (new kind, nominal level 3)
- P1 (Pinwheel icon, pink, slow spin): "Pinwheels turn slow and drift wide." | "They are tough. One hit is not enough."
- P2 (two shots land, the Pinwheel breaks): "Hit each one twice to set it free." | "Slow does not mean safe. Keep space."

### Level 5: Brood (guardian intro)
- P1 (Brood silhouette, grey green, glitching; slow reveal): "Brood, Keeper of the Nest, wakes." | "It kept small shapes safe and warm."
- P2 (a grey ship outline brushes Brood; its green fades): "A fallen legend took its green light." | "Now it guards its nest from everyone."
- P3 (three pods orbit Brood; pods glow pulse; a lane line flashes): "Three pods shield it. Break all three," | "then strike. Step off its charge line."
- P4 (Torus, small, beside the ship): Torus: "It is not cruel, {callsign}. It is lost."

### Level 5: Brood freed
- P1 (green floods back into Brood; it shrinks to a calm glow; one star lights above the grid): "Green light returns. Brood is free." | "One star wakes. Vertane remembers you."

### Level 6 to 15: Weaver (new kind, nominal level 6)
- P1 (Weaver icon, green diamond, sidestepping a shot): "Weavers are quick. They see your shots" | "and slip aside at the last moment."
- P2 (a spread of shots, one catches the Weaver): "Shoot wide, or let it come close." | "Then it has no room to slip away."

### Level 6 to 15: Dart (new kind, nominal level 6)
- P1 (a flock of Dart icons, orange arrowheads, curving in): "Darts fly in flocks of five or more." | "Fast and thin, they turn to follow you."
- P2 (ship circles wide; the flock bunches; one sweep of shots): "Circle wide so they bunch up behind you," | "then turn and sweep the flock away."

### Level 6 to 15: Charger (new kind, nominal level 7)
- P1 (Charger icon; a lane line draws out from it): "Chargers draw a line before they dash." | "The line shows exactly where they go."
- P2 (ship steps off the line; Charger dashes past into a wall): "When you see the line, step off it." | "Then hit it while it rests."

### Level 6 to 15: Swirl (new kind, nominal level 9)
- P1 (Swirl icon circling the ship, closing in): "Swirls circle you, closer and closer." | "Then they dive straight in."
- P2 (Swirl turns inward; ship sidesteps): "When it turns toward you, sidestep." | "Its dive only goes in a straight line."

### Level 10: Warden (guardian intro)
- P1 (Warden silhouette, grey blue; a gate of light behind it, closed): "Warden, Keeper of the Old Gate." | "It once opened the ways between places."
- P2 (grey outline passes; the gate goes dark): "The fallen legend broke its trust." | "Now it shuts every way, for everyone."
- P3 (a ring with a gap flies out; the shell opens for a moment): "Fly through the gap in its rings." | "Its shell opens just after each ring."
- P4 (Torus, glow pulse): Torus: "A closed gate still remembers the key."

### Level 10: Warden freed
- P1 (blue returns; the gate of light opens; a second star lights): "Blue light returns. The Old Gate opens." | "Far off, a grey shape watches, and goes."

### Level 11 to 15: Splime (new kind, nominal level 11)
- P1 (Splime icon, slow; puddles of slime left behind): "Splimes ooze slow and leave slime." | "Slime does not hurt, but it slows you."
- P2 (ship flies around a puddle; a bomb flash clears them): "Fly around the puddles. Keep your speed." | "A bomb clears all the slime at once."

### Level 6 to 15: Gravity well (new kind, nominal level 12)
- P1 (well icon, rings around a white core, pulling grid lines in): "Gravity wells pull you and shapes in." | "Left alone, they swell and burst bright."
- P2 (shots hit the well; it shrinks and breaks into light): "Shoot a well down early, from far away." | "When a big one breaks, a wave rolls out."

### Level 6 to 15: Charger with Splime (combo, nominal level 13)
- P1 (slime puddles on the floor; a Charger line crosses one): "Slime slows you, and Chargers dash fast." | "Slow feet cannot step off a dash line."
- P2 (ship stays on clear floor, steps off the line): "Keep to clean floor when Chargers come," | "so you can always step aside."

### Level 15: Spindle (guardian intro)
- P1 (Spindle silhouette, grey yellow; a clock face of grid lines): "Spindle, Turner of Days." | "It turned the hours of Vertane gently."
- P2 (grey outline; the clock lines tangle and glitch): "The fallen legend tangled its turning." | "Now its arms sweep only to push away."
- P3 (two long arms; they freeze thin and dim, then turn the other way): "Stay in the open space between its arms." | "When the arms go dim, they turn back."
- P4 (Torus beside the ship): Torus: "A legend came before you. Remember that."

### Level 15: Spindle freed
- P1 (yellow returns; the clock lines turn smoothly; a third star lights): "Yellow light returns. Days turn again." | "Somewhere, a grey legend loses a little."

### Level 16 to 30: Snake (new kind, nominal level 16)
- P1 (Snake icon, cyan hexagon head and a long chain of circles): "Snakes weave at you, long and bright." | "Only the head can be hurt."
- P2 (shots hit the body and stop; one hits the head; the chain fades to light): "Their bodies block shots. Do not touch." | "Aim at the head, never at the tail."

### Level 16 to 30: Bulwark (new kind, nominal level 17)
- P1 (Bulwark icon with a bright shield arc in front): "Bulwarks carry a shield on their front." | "Shots from the front just bounce away."
- P2 (ship circles round; shots hit its back): "Fly around it and hit it from behind." | "A bomb ignores the shield."

### Level 16 to 30: Blink (new kind, nominal level 18)
- P1 (Blink icon fades to a ghost; a ring appears near the ship): "Blinks vanish and pop up near you." | "A ring shows where one will land."
- P2 (ship moves away from the ring; Blink appears in empty space): "When you see a ring, move away from it." | "Then turn and hit the Blink."

### Level 16 to 30: Spawner (new kind, nominal level 19)
- P1 (Spawner icon, octagon, a flock of Darts leaving it): "Spawners make Darts, again and again." | "They drift slowly after you."
- P2 (ship shoots the Spawner; it breaks into light): "Break the Spawner before the flock." | "Then the Darts stop coming."

### Level 16 to 30: Gravity well with Snake (combo, nominal level 19)
- P1 (a well pulling the ship toward a Snake body): "Wells pull you, and Snakes are long." | "A pull can drag you into a tail."
- P2 (ship shoots the well first; it breaks; the Snake follows): "Break the well first, then the Snake." | "Then the floor is yours again."

### Level 20: Ember (guardian intro)
- P1 (Ember silhouette, grey orange, flickering like a cold hearth): "Ember, the Hearth Flame." | "It kept all of Vertane warm."
- P2 (grey outline feeds on its glow; Ember flares wild): "The fallen legend fed on its fire." | "Now it burns wild and cannot rest."
- P3 (a dash line; Ember bounces off a wall and stops, dizzy): "It dashes and drops mines on the way." | "Hit it when it stops after a wall."
- P4 (Torus, steady glow): Torus: "Help it rest, and it will warm you."

### Level 20: Ember freed
- P1 (warm orange returns; the grid glows gently; a fourth star lights): "Orange light returns. Vertane is warm." | "Two acts of the trial are done."

### Level 21 to 30: Leaver (new kind, nominal level 21)
- P1 (Leaver icon, nested squares; it splits into small shards): "Leavers look like Weavers, but split." | "Break one and its shards chase you."
- P2 (shards pause, then dart; the ship backs away and shoots): "After you break one, back away at once." | "Shards are quick, so shoot as they come."

### Level 25: Mirage (guardian intro)
- P1 (Mirage silhouette, grey magenta, three copies flicker): "Mirage, Keeper of True Sight." | "It showed Vertane what was real."
- P2 (grey outline; Mirage's copies multiply): "The fallen legend taught it to trick." | "Now it shows only what is not there."
- P3 (a ring marks a spot; Mirage lands; lanes burst out; the open arc on its shield glows): "A ring shows where it will land. Move." | "Shoot through the gap in its shield."
- P4 (Torus, glow pulse): Torus: "When it sees true, you will see too."

### Level 25: Mirage freed
- P1 (magenta returns; the copies melt into one; a fifth star lights): "Magenta light returns. Mirage sees true." | "And it shows you what really happened."
- P2 (a grey ship outline drinking colour from ten guardians, drawn as a slow reveal): "A legend named Vecta took their light." | "He wanted all of it for himself."

### Level 30: Gravitas (guardian intro)
- P1 (Gravitas silhouette, grey violet, grid lines bending toward it): "Gravitas, Heart of the Deep." | "Its pull held all of Vertane together."
- P2 (Vecta's outline; the pull grows too strong; lines stretch): "Vecta made its pull too strong." | "Now it pulls everything to itself."
- P3 (three anchors orbit it; a ring closes in with a gap): "Break its three anchors to weaken it." | "Fly out through the gap in each ring."
- P4 (Torus, larger and brighter now): Torus: "No more riddles. I am with you."

### Level 30: Gravitas freed
- P1 (violet returns; grid lines relax; a sixth star lights): "Violet light returns. The heart is calm." | "Vertane holds together again."
- P2 (far on the rim, a grey ship outline, clear for the first time): "And now you see him, far on the rim." | "Vecta, the Grey Legend, sees you too."

### Level 31 to 50: Sower (new kind, nominal level 31)
- P1 (Sower icon hugging the arena edge, dropping mines): "Sowers creep along the arena walls." | "They leave mines behind them."
- P2 (ship holds the middle; shoots the Sower from afar): "Keep away from the walls they creep on." | "Hit them from the middle of the floor."

### Level 31 to 50: Sower with Spawner (combo, nominal level 32)
- P1 (mines on the edges; a Spawner drifting in, Darts leaving it): "Mines line the edges. Darts fly in." | "The open middle is your safe ground."
- P2 (ship in the centre breaks the Spawner first): "Hold the middle. Break Spawners first." | "Then clear the Sowers one by one."

### Level 35: Bastion (guardian intro)
- P1 (Bastion silhouette, grey red, a square fort with four corner towers): "Bastion, the Last Wall." | "It gave every shape shelter from storms."
- P2 (Vecta's outline; the towers turn outward): "Vecta turned its towers outward." | "Now it shuts everyone out."
- P3 (corner turrets glow in turn; two break; the core opens; a Bulwark arrives): "Its four towers fire lanes. Break two" | "and the core opens. Watch for Bulwarks."
- P4 (Torus beside the ship): Torus: "He is angry. So you are close."

### Level 35: Bastion freed
- P1 (red returns; the towers face inward like arms; a seventh star lights): "Red light returns. The Wall shelters." | "Your ship shines brighter than before."

### Level 40: Tempest (guardian intro)
- P1 (Tempest silhouette, grey red, racing round the arena edge): "Tempest, Rider of the Rim." | "Its winds carried light to every corner."
- P2 (Vecta watching from the rim; Tempest's trail turns dim): "Vecta turned its wind into a storm." | "He watches from the rim as it rages."
- P3 (slime trail along the wall; a dash line across the floor): "It races the walls and leaves slime." | "Step off its dash. Bombs clear slime."
- P4 (Torus, glow pulse): Torus: "Be the calm. The storm will follow."

### Level 40: Tempest freed
- P1 (red returns; light flows around the rim; an eighth star lights): "Light rides the wind again." | "Vecta is gone from the rim. Two remain."

### Level 45: The Twins (guardian intro)
- P1 (two silhouettes, grey red, a bright bar between them): "The Twins, the Bound Stars." | "Two friends who never left each other."
- P2 (Vecta's outline; the bond between them turns into a blade of light): "Vecta turned their bond into a bar." | "It sweeps the floor as they turn."
- P3 (the bar sweeps; rings with gaps; one twin dims, the other speeds up): "Keep clear of the bar between them." | "When one falls, the other gets fast."
- P4 (Torus beside the ship): Torus: "Free them both. A bond can heal."

### Level 45: The Twins freed
- P1 (both twins glow red and gold, the bar becomes a soft ribbon; a ninth star lights): "The bond is light again, not a bar." | "Nine stars shine. One crown is left."

### Level 50: Prism (guardian intro)
- P1 (Prism silhouette, all grey, the outline of a crown): "Prism, Crown of All Colours." | "It shared every colour with the world."
- P2 (Vecta's grey outline above Prism, Prism holding colours locked inside): "Vecta made it his throne." | "It holds every colour in, for him alone."
- P3 (Prism cycles through each guardian's attack as small icons; it flashes white): "It uses every guardian's trick in turn." | "Strike hard when it flashes white."
- P4 (Torus, full size, every shape in it glowing): Torus: "Every legend began like you, {callsign}."

### Level 50: Prism freed
- P1 (colour bursts out of Prism to all ten guardians; the tenth star lights; the whole grid floods with colour): "Every colour returns to Vertane." | "Ten stars shine. You are a Shape Legend."
- P2 (Vecta's grey outline pulls away into a far dark star): "Vecta flees to the Hollow Star." | Vecta: "This is not the end, little legend."

Note: P2 is the one spoken line of Vecta in the whole bible. It is a cliffhanger, said calmly, never shouted; Torus has no line in this scene.

## Endless and Free Play
- Endless: the long watch at the rim, where a Shape Legend holds back the dim for as long as it lasts.
- Free Play: the training grounds Torus shapes for you, where any shape can be called to practise.

## Legend trials: future modes
Hooks only; each mode keeps its own plan in docs/16.
- **PVP and battle modes (P3, P5): the legend trials.** Once a pilot becomes a Shape Legend, legends test each other in friendly trials to keep their light strong. Nobody is defeated for good: the loser's ship fades and returns, as in Adventure. Shield battle is "the trial of the shield", hockey "the trial of the spark", hide and seek "the trial of the dim" (hide in grey, seek by light). After the Act 6 update, Vecta, restored, keeps the trials as a way to make amends.
- **Co-op: legends together.** Two or more legends fight the dim side by side. Framing: the world has called more than one pilot, and Torus links their ships with a light thread on the grid. Fits Endless co-op first (the long watch, shared).
- **Tanks (P4): war forms.** A legend's ship can take heavier forms, shaped from the guardians' gifts: the Bastion form (overhead tank, heavy and shielded), later the Tempest form (fast) and the Gravitas form (artillery, long range pull and arc). Unlocked as a legend earns them, framed as gifts from freed guardians, never as weapons of a real army. Battles are trials between war forms on the grid, with no real world settings, uniforms or flags.

## Panel spec for the builder
Everything is drawn in code from shapes the game already has. No images, no fonts beyond the existing pixel headline font and HUD font.
- **Stage.** Full screen DOM overlay over a dark grid background, or a small PixiJS scene if the owner prefers; landscape on cover and inner screen, safe areas respected. One panel at a time, centred visual, text below it.
- **Visuals available.**
  - Enemy icons: `iconCanvas(kind)` and `specCanvas` from src/ui/enemyIntro.ts (read only), drawn larger (for example 96 px).
  - Pilot ship: the ship shape spec through `specCanvas`.
  - Boss silhouettes: each boss's own shape spec, drawn as an outline. Corrupted: grey (low saturation) with a light glitch. Freed: full palette colour.
  - Torus: nested regular polygons (triangle, square, pentagon, hexagon, circle) on one centre, each turning slowly at its own speed, soft white with a gold tint. Small in Act 1, larger each act. Made of shape primitives only.
  - Vecta: the pilot ship outline, larger, grey, flickering opacity. Never close up, never with eyes or a face, never sudden.
  - The grid: lattice lines; dim by lowering saturation and alpha from the edges; freeing by restoring them from the centre.
  - Stars: small four point stars above the grid, one per freed guardian, lit in order.
  - Slime, mines, rings, lanes, arms, pods, turrets, bars: simple strokes in the boss or enemy colour.
- **Animations.** Slow reveal (fade or draw on over 0.6 to 1.0 s), glow pulse (alpha sine about 1 Hz), typewriter text (about 40 characters per second; tap during typing completes the line), gentle drift or rotation of icons, colour drain and return as a hue saturation tween. No shakes, no flashes faster than 3 per second (photosensitivity), no sudden loud cues.
- **Text.** Pixel headline font is not used for scene lines (plain HUD font, large, high contrast). At most 2 lines per panel, 40 characters per line, `{callsign}` up to 10 characters. A guide line is prefixed by a small Torus icon instead of the word "Torus:" if the owner prefers; the word stays in the data for screen readers.
- **Controls.** Tap to advance a panel. A Skip button (top right, large touch target) skips the whole scene in one tap. No timers that force reading speed. Touch only.
- **When shown.** Opening once per save. Each briefing, intro and freeing once per save per trigger (see scene rules). Freeing plays after the boss level's win, before the results screen. A level select entry offers "Replay story" for scenes already seen on that level. Shown on every difficulty; Easy and Insane see the same text.
- **Data.** Scene text as a pure data module (owner decides the path), keyed by trigger id (`opening`, `foe:<kind>`, `combo:<kindA>+<kindB>`, `boss:<id>`, `freed:<id>`), JSON serialisable, with a Vitest that checks every line is 40 characters or fewer with `{callsign}` counted as 10, at most 2 lines per panel, at most one Torus line per scene, no em or en dashes.
- **Sound.** Synthesised only: a soft rising tone for a reveal, the existing boss motif under a guardian intro, a warm chord when colour returns. Chorus owns it.
- **Call sign.** Picker at the opening: a suggested call sign from two random word lists (seeded draw through src/core/rng.ts) with a reroll button, plus optional typing (letters and digits, 3 to 10 characters). Stored on the device only. Not sent anywhere. Any future online use (PVP, co-op) needs its own moderation and privacy design first (docs/16 child privacy).

## Safety
- No gore, no blood, no injury. Shapes "break", "fade", "turn to light", "are set free". The ship "loses a life" and "returns".
- No named character dies, on screen or off. Every guardian is freed, never destroyed. Vecta flees and, in the later update, is restored.
- No real world violence, wars, weapons, flags, places or people. Tank war forms are guardian gifts on the grid.
- Nothing frightening for young children: no faces, no screams, no jump scares, no dark threats. Vecta is calm and distant; his one line is a cliffhanger, not a threat to the player.
- Corruption is always shown as colour loss, glitching and dimming. Freeing is always colour and light returning.
- Plain words, short lines, readable at a glance; every scene skippable in one tap.
- Call sign: no request for a real name, stored locally only.
