# Story bible

Status: draft for Ryan's approval. Nothing here is built until Ryan approves it and the ruling lands in `docs/DECISIONS.md`. Written by Scribe, 2026-11-09. Source of the ask: tester Mike (story between Adventure levels, like old 8 and 16 bit cut scenes or pre-fight enemy introductions). Ryan ruled: build it in P1, tone light and funny, family audience (docs/16-public-plan.md, ruling 1: everyone including children, English).

The game name is Shape Legend. Enemy names come from `FOE_INFO` in `src/ui/enemyIntro.ts`. Boss order is generator V9: Brood 5, Warden 10, Spindle 15, Ember 20, Mirage 25, Gravitas 30, Bastion 35, Tempest 40, Twins 45, Prism 50.

## World premise
1. The Neon Grid is a glowing playground where every shape has a job.
2. One day a hiccup of static, the Fizz, made the shapes bouncy and silly.
3. Now they zoom, spin, hide and bump into things they should not.
4. Pip, a tiny triangle pilot, is the Grid's best bumper.
5. Pip pops the wobbly shapes into sparkles so they can reset and be calm again.

## Cast

### Pilot: Pip
- Look: the player's own ship shape (the neon triangle) with two round eyes and a tiny antenna. Cyan, the ship palette key.
- Voice: eager, brave, a little too keen. Says "Okay!" and "Got it!". Never scared, sometimes surprised.
- Job in a scene: asks the question a 7 year old would ask, then repeats the tip back in plain words.

### Guide: Professor Glim
- Look: a floating hexagon with big round glasses and one wobbly eyebrow, drawn in neon lines, soft gold. Bobs up and down.
- Voice: warm, fussy, loves long words and then explains them badly on purpose ("It is... a spinny thing").
- Running jokes: Glim always loses his clipboard; Glim names things after snacks; Glim says "Fascinating!" right before something goes wrong in a harmless way.
- Job in a scene: says what is coming, what it does, and one tip.

### Enemies are wobbly, not wicked
Enemies never say they want to hurt Pip. They are silly, proud or shy. Defeated shapes "pop" into sparkles and say a short goodbye ("Whoops!", "See you next hiccup!"). Words to avoid: kill, die, dead, destroy, blood, weapon of war. Say "pop", "bump", "reset", "fizz out".

| Foe | Personality | Catchphrase |
|---|---|---|
| Grunt | Cheerful, follows Pip like a puppy | "Wait for me!" |
| Wanderer | Daydreamer, lost, polite | "Sorry, wrong way!" |
| Pinwheel | Show off, loves spinning | "Watch me twirl!" |
| Weaver | Dancer, zigzags on purpose | "Catch me if you can!" |
| Dart | Tiny, fast, giggles in packs | "Zoom zoom!" |
| Snake | Long, sleepy, slow to turn | "Mmm, what a long day." |
| Charger | Dramatic runner, announces dashes | "Ready... ready... GO!" |
| Bulwark | Shy, hides behind a big shield | "Nobody look at me." |
| Blink | Prankster, pops up from nowhere | "Boo! Just kidding!" |
| Swirl | Dizzy, circles everything | "Whee, round and round!" |
| Sower | Gardener who plants buzzing mines | "Plant a little, grow a lot." |
| Splime | Gooey, leaves sticky puddles by accident | "Oops, my bad." |
| Leaver | Weaver that bursts into six tiny pals | "Everyone out!" |
| Gravity well | Grumpy hole that hugs things too hard | "Come closer..." |
| Spawner | Busy mum shape sending out darts | "Off to school, little ones!" |

## Tone guide
Five do:
1. Do make the joke about the situation. "Glim lost his clipboard. Again."
2. Do give the foe a quirk before a threat. "Blink loves surprise parties."
3. Do keep tips as one plain action. "Shoot the sides, not the shield."
4. Do let Pip be brave and a little silly. "I will bump it with my face!" "Please do not."
5. Do end every scene on the tip or a grin, never on worry.

Five do not:
1. Do not use fear words or danger scores: no "kill", "doom", "blood", "scary".
2. Do not make fun of a person, a body, an accent or a culture. Teasing only targets shapes.
3. Do not reference other games, shows, brands or real places.
4. Do not use sarcasm or put Pip down. Glim never says "you failed".
5. Do not write long lines, hard words without a joke, or more than 2 lines per panel.

## Panel spec for the builder

### Format
- A scene has 2 to 4 panels. A panel has at most 2 lines of at most 40 characters. In this doc lines are written `line one | line two`.
- Panel layout: a portrait or foe picture on the left (about 30 percent), a speech box on the right with the speaker name, on a dark panel with a neon line border. Fits the cover and inner Fold screens; stack picture above text when the width is under 480 px.
- Colours: palette keys only, through `src/render/neon.ts`. No new image, font or audio file. Text uses the pixel arcade font for the speaker name and the plain HUD font for lines.

### Visual library (all drawn, none loaded)
| Visual | Source |
|---|---|
| Foe icon | `iconCanvas(kind, px)` from `src/ui/enemyIntro.ts`, at 72 to 96 px for story panels. Well and spawner included |
| Boss silhouette | The boss shape spec from `src/render/shapeSpecs.ts` drawn with `specCanvas`, filled at low alpha plus tier colour outline. Ask Glow only if a boss has no spec |
| Pip portrait | The ship spec plus two eye dots and an antenna line, drawn on a small 2D canvas |
| Glim portrait | A hexagon (regular polygon, 6 sides), two circles for glasses, one bent line for the eyebrow |
| Props | Clipboard (rect plus lines), arrow, sparkle (4 short lines), exclamation mark, drum wrap arrows |

### Animations (CSS or canvas, no new dependency)
- Typewriter: text types at about 40 characters per second; a tap while typing shows the whole line, a second tap goes to the next panel.
- Blink: portraits blink every 3 to 4 s (eye dots shrink for 120 ms).
- Slide: the picture slides in from the left over 200 ms; the next panel crossfades over 150 ms.
- Bob: Glim bobs 4 px up and down on a 2 s sine.
- Foe wiggle: the foe icon rotates 3 degrees each way on a 1.2 s loop. Boss silhouettes pulse alpha on a 1.6 s loop.
- Reduced motion (system setting): no slide, bob or wiggle; text appears at once.

### Skip, replay, never twice
- One tap on a "Skip" button (top right, 48 px target) ends the scene at once. The first tap of a panel is never a skip; skip is its own button.
- Every scene has an id (`S01`, `B05` and so on). The first time a scene finishes or is skipped its id is saved in the player's story seen list (Ledger owns the storage key, in the existing settings or progression record).
- Auto play happens only for ids not in the seen list. A returning player who saw or skipped a scene is never shown it again unasked.
- At most one auto scene per level. If a level qualifies for two, the second waits for the next level that has a free slot.
- Replay: level select shows a small "Story" chip on levels whose scene was seen. Tapping it plays the scene with no seen-list change. Locked levels show no chip, so no spoilers.
- The scene shows after the existing intro card and before play starts. It never runs during play and never delays a retry: a level restarted after death skips straight to play.
- A Settings toggle "Story scenes" (on by default) is Ledger's call; open question 2 below.

### Trigger rule (runtime)
- Foe scene: the first level of a run whose `newFoes(def, earlier)` contains the kind. The level table below is the expected order, because rosters are drawn from the run seed; the rule, not the table, decides.
- Combo scene: plays on its listed level when both kinds are in the roster, else its slot goes to the next level that has both.
- Boss scene: always on the boss level of the Adventure run, before the pre-fight start. Bosses after level 50 (the loop from Ember) show a short repeat panel only on replay.
- Endless and Free Play show no scenes; the existing intro card covers them.
- A foe met before its scene (band 1 shows three kinds on level 1) gets its scene on the next free level; the intro card still names it.

## Scene library

Notation: `[visual]` then lines. P1 to P4 are panels.

### S01 Welcome and Grunt (level 1)
Trigger: first level of a run, Grunt.
1. [Glim] Welcome to the Neon Grid! | I am Professor Glim.
2. [Pip] I'm Pip! Where is everybody? | Glim: Hiccuping. Look out!
3. [Grunt] Grunts chase you like puppies. | They're friendly. Just bumpy.
4. [Glim, Pip] Tip: shoot them from far away. | Pip: Pew pew! Got it!

### S02 Wanderer and Pinwheel (level 2)
Trigger: Wanderer, Pinwheel.
1. [Wanderer] Wanderers drift around lost. | They never aim at you.
2. [Pip] So I can ignore them? | Glim: Just do not bump them.
3. [Pinwheel] Pinwheels spin and love it. | Their blades are the sharp part.
4. [Glim] Tip: shoot the middle fast, | before the twirling gets close.

### S03 Weaver (level 6)
1. [Glim] Fascinating! New shapes ahead. | They are far wigglier.
2. [Weaver] Weavers zigzag like dancers. | Shots aimed straight may miss.
3. [Glim, Pip] Tip: aim a little ahead | of where it will wiggle next.

### S04 Dart (level 7)
1. [Dart] Darts are tiny and quick. | They come in giggly packs.
2. [Pip] That's a lot of giggles! | Glim: A bomb helps with packs.
3. [Glim] Tip: slide sideways and sweep | your shots across the pack.

### S05 The drum (level 8, notable level)
Trigger: the gentle open drum, always on level 8.
1. [Glim, drum arrows] This arena is a drum! | Go off the left, come in the right.
2. [Pip] Whoa, I went through the wall! | Glim: Shapes can do it too.
3. [Glim] Tip: watch both edges. | Surprises wrap around.

### S06 Charger (level 9)
1. [Charger] Chargers stop, shout, then run. | Ready... ready... GO!
2. [Glim] A line shows where it will dash. | It only runs straight.
3. [Pip, Glim] Tip: step off the line | and let it zoom past.

### S07 Swirl (level 11)
1. [Swirl] Swirls circle round and round. | Then they dive at you.
2. [Pip] They look dizzy! | Glim: Dizzy, then dive.
3. [Glim] Tip: keep moving. When it dives, | slip out of its line.

### S08 Splime (level 12)
1. [Splime] Splimes are slow and gooey. | They leave sticky puddles.
2. [Pip, puddle] Puddles slow me down. | They are not harmful, only sticky.
3. [Glim] Tip: pop the Splime first. | Shoot it from far away.

### S09 Pack and weave (level 13, combo: Dart and Weaver)
1. [Dart, Weaver] A zippy pack and a dancer! | They arrive together today.
2. [Glim] Darts go straight. Weavers wiggle. | Shoot darts first, then dance.
3. [Pip] Fast ones first. Got it! | Glim: Fascinating!

### S10 Snake (level 16)
1. [Snake] Snakes are long and sleepy. | Only the head turns.
2. [Pip] Can I shoot the tail? | Glim: Tails are just for show.
3. [Glim, Snake] Tip: go for the head. | Do not touch the tail either.

### S11 Gravity well (level 17)
1. [Well] A gravity well! It hugs things | a bit too hard.
2. [Pip] It's pulling me! | Glim: Swim away from the middle.
3. [Glim] Tip: keep your distance. | It is calm at the edge.

### S12 Bulwark (level 18)
1. [Bulwark] Bulwarks are shy. | They hide behind a big shield.
2. [Pip] My shots just bounce! | Glim: Rude, but shy.
3. [Glim] Tip: go around to the side | and shoot where there is no shield.

### S13 Blink (level 19)
1. [Blink] Blinks love surprise parties. | They vanish and pop up near you.
2. [Pip] Where did it go? | Glim: A ring shows where.
3. [Glim] Tip: watch for the ring | and step away before it lands.

### S14 Leaver (level 21)
1. [Leaver] Leavers look like Weavers. | But when popped, they burst!
2. [Pip] Six little friends! | Glim: Six little bumpers.
3. [Glim] Tip: pop it from far away | and keep your space.

### S15 Spawner (level 22)
1. [Spawner] A Spawner! Like a busy mum | sending darts off to school.
2. [Pip] There are so many darts! | Glim: Pop the mum, stop the line.
3. [Glim] Tip: fly to the Spawner | and pop it first.

### S16 Shield and dash (level 23, combo: Bulwark and Charger)
1. [Bulwark, Charger] A shy one and a speedy one. | A funny team today!
2. [Glim] Chargers run into things. | Even into shields. Hee hee.
3. [Pip, Glim] Tip: stand so the Charger | dashes past, then shoot the side.

### S17 Now you see me (level 24, combo: Blink and Swirl)
1. [Blink, Swirl] A dizzy one and a sneaky one. | Round and round, boo!
2. [Glim] When Swirl dives, step aside. | When Blink lands, step away.
3. [Pip] Step and step. Got it! | Glim: Excellent footwork.

### S18 Nova night (level 26, combo: well and Snake)
1. [Well, Snake] Wells can burst into | little Nova snakes. Harmless!
2. [Pip] They just drift around? | Glim: Yes. Do not touch them.
3. [Glim] Tip: pop the well to push | everything away in a ripple.

### S19 Sticky shields (level 28, combo: Splime and Bulwark)
1. [Splime, Bulwark] Goo and a shield. Messy! | Glim: Clipboard? Where is it?
2. [Pip] I slid on a puddle! | Glim: Go around, not through.
3. [Glim] Tip: pop the goo first, | then circle the shield.

### S20 Sower (level 31)
1. [Sower] Sowers plant buzzing mines | along the wall. A gardener!
2. [Pip] Mines in the garden? | Glim: Mines wait. Do not touch.
3. [Glim] Tip: stay off the wall paths | and pop the Sower early.

### S21 Mines and wells (level 32, combo: Spawner and well)
1. [Spawner, Well] A busy mum and a hugger. | Look in the middle.
2. [Glim] Darts come from the Spawner. | The well pulls them close.
3. [Pip, Glim] Tip: pop the Spawner first. | Then fly from the well.

### S22 Everybody at once (level 33, recap)
1. [Glim, all foes] Today everybody came! | Even Glim's clipboard!
2. [Pip] Shoot the small, step round | the shields. I remember!
3. [Glim] You are a real Neon Grid legend. | Fascinating!

### S23 Teleport tag (level 36, combo: Blink and Sower)
1. [Blink, Sower] A prankster and a gardener. | Mines and surprises!
2. [Glim] Blink may pop up next to a mine. | Mines do not move.
3. [Pip, Glim] Tip: keep away from the wall | and the rings.

### S24 Last long walk (level 41, recap)
1. [Glim] You have met every shape now. | Almost everyone, anyway.
2. [Pip] What is left? | Glim: Bigger bosses, bigger fun.
3. [Glim, Pip] Tip: stay calm, move small. | Pip: Small. Calm. Got it!

## Boss intros
Every boss scene has 3 panels: P1 name and taunt, P2 what to watch for, P3 the tip plus a joke. All use the boss silhouette in its tier colour (tier 1 green, 2 orange, 3 red, 4 rainbow, matching `bossTierOf`). A boss scene is mandatory for the level, ahead of the S-scenes.

### B05 Brood (level 5)
1. [Brood] I am Brood! I hug everyone. | And I hug FAST.
2. [Brood] It chases you, then dashes. | At the end it splits in three.
3. [Glim] Tip: shoot it while it rests. | Keep moving, and step aside.

### B10 Warden (level 10)
1. [Warden] I am Warden! Nobody passes. | Not even Glim's clipboard.
2. [Warden] It sends rings with a gap. | A swarm of hornets helps it.
3. [Glim] Tip: fly through the gap. | Shoot its glowing middle.

### B15 Spindle (level 15)
1. [Spindle] I am Spindle! Dizzy yet? | I spin until you are!
2. [Spindle] Long arms sweep around. | Sometimes it shoots a slow ball.
3. [Glim] Tip: stand in the gap | between arms. Shoot, step, shoot.

### B20 Ember (level 20)
1. [Ember] I'm Ember! I'm warm, | and very fast.
2. [Ember] A line shows its dash. | It leaves mines along the way.
3. [Glim] Tip: step off the line. | Shoot when it rests.

### B25 Mirage (level 25)
1. [Mirage] I'm Mirage! Which one? | Hee hee hee.
2. [Mirage] It hops and sends beams. | A ring shows where it lands.
3. [Glim] Tip: shoot through the gap | in its shield ring.

### B30 Gravitas (level 30)
1. [Gravitas] I'm Gravitas! Come closer. | I only want a hug.
2. [Gravitas] It pulls you in slowly. | Three anchors guard its middle.
3. [Glim] Tip: pop the anchors first. | The pull gets weaker each time.

### B35 Bastion (level 35)
1. [Bastion] I am Bastion! My four | turrets take turns. Politely.
2. [Bastion] Corner turrets fire slow balls. | The middle waits.
3. [Glim] Tip: pop two turrets, then | shoot the middle. Dodge the slow balls.

### B40 Tempest (level 40)
1. [Tempest] I'm Tempest! Whoosh! | I run laps. For fun!
2. [Tempest] It circles the wall, leaves | slime, then dashes at you.
3. [Glim] Tip: stay inside the slime-free | middle, and shoot when it rests.

### B45 Twins (level 45)
1. [Twins] We are the Twins! | We finish each other's...
2. [Twins] Two bodies spin with a tether. | Do not touch the line!
3. [Glim] Tip: pop one twin. The other | gets grumpy and faster.

### B50 Prism (level 50)
1. [Prism] I'm Prism! I've learned | a trick from every boss.
2. [Prism] It changes colour, then white. | White means it can be hit.
3. [Glim, Pip] Tip: shoot when it flashes white. | Pip: Last one! Let's go!

## Level order, levels 1 to 50
Trigger is the kind or boss the scene teaches. "Free" means no scene is expected; the runtime plays one only if `newFoes` finds a kind still unmet (the carry rule).

| Level | Scene | Trigger |
|---|---|---|
| 1 | S01 | Grunt |
| 2 | S02 | Wanderer, Pinwheel |
| 3 | Free | Band 1 has no more kinds |
| 4 | Free | Same |
| 5 | B05 | Boss Brood |
| 6 | S03 | Weaver |
| 7 | S04 | Dart |
| 8 | S05 | The drum |
| 9 | S06 | Charger |
| 10 | B10 | Boss Warden |
| 11 | S07 | Swirl |
| 12 | S08 | Splime |
| 13 | S09 | Combo Dart and Weaver |
| 14 | Free | |
| 15 | B15 | Boss Spindle |
| 16 | S10 | Snake |
| 17 | S11 | Gravity well |
| 18 | S12 | Bulwark |
| 19 | S13 | Blink |
| 20 | B20 | Boss Ember |
| 21 | S14 | Leaver (first level it can appear) |
| 22 | S15 | Spawner |
| 23 | S16 | Combo Bulwark and Charger |
| 24 | S17 | Combo Blink and Swirl |
| 25 | B25 | Boss Mirage |
| 26 | S18 | Combo well and Snake |
| 27 | Free | |
| 28 | S19 | Combo Splime and Bulwark |
| 29 | Free | |
| 30 | B30 | Boss Gravitas |
| 31 | S20 | Sower |
| 32 | S21 | Combo Spawner and well |
| 33 | S22 | Recap, everyone |
| 34 | Free | |
| 35 | B35 | Boss Bastion |
| 36 | S23 | Combo Blink and Sower |
| 37 to 39 | Free | |
| 40 | B40 | Boss Tempest |
| 41 | S24 | Recap, last stretch |
| 42 to 44 | Free | |
| 45 | B45 | Boss Twins |
| 46 to 49 | Free | |
| 50 | B50 | Boss Prism |

Count: 24 S scenes plus 10 B scenes, 34 in all. Kinds appear where the seed puts them (band 2 starts at level 6, band 3 at 16, band 4 at 31, Leaver from 21), so any foe scene whose level has no matching kind moves to the next level that has it.

## Build notes for the Ledger and Glow briefs (not part of this task)
- Data: one `STORY` table in `src/ui/story.ts`: id, trigger (`kind`, `kinds`, `boss`, `level`), panels (visual keys and two text lines). Pure helper `sceneFor(def, earlier, seen)` returns the scene id or null. Vitest on the helper, including the carry rule and the seen list.
- Test every string: at most 2 lines, each at most 40 characters, no em or en dashes, none of the banned words in the tone guide.
- Persistence: seen list in the existing progression record, defensive read like the other stored fields.

## Open questions for Ryan
1. Names: Pip, Professor Glim and the Fizz are working names. Rename any before UI work starts.
2. Add a Settings toggle "Story scenes"? Recommended yes, default on, because skipping one scene at a time is tedious for a returning player.
3. Level 3, 4, 14 and the Free rows have no scene. Want a light "pep talk" panel pair there, or keep levels fast?
4. Scenes in Endless and Free Play: left out in this draft.

## Known gaps
- The spec says a scene may carry a kind met before its scene (level 1 shows three kinds). A better fix is a seed-aware generator hook, which is a levelgen change and is out of scope here.
- Boss levels after 50 (the loop from Ember) have no new scenes.
- Spindle and Prism lines describe the table rows in `src/game/bosses/table.ts`; Swarm should confirm the wording matches in game before copy is final.
- Silhouettes assume each boss has a shape spec; if one is missing Glow adds it.
