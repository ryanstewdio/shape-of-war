// Story scenes (docs/19 story bible, approved). Every line here is copied word for word from the
// bible. Pure data, JSON serialisable, keyed by trigger id: opening, foe:<kind>,
// combo:<kindA>+<kindB>, boss:<id>, freed:<id>. Each panel carries the bible's visual description
// (note) and a small enum (visual plus marks) the scene player draws from code. Guide and Vecta
// lines keep their speaker in `who`; the "Torus:" marker is not part of the text.
import type { BossId } from '../levelgen/leveldef';
import type { FoeKind } from '../ui/enemyIntro';

export type SceneType = 'opening' | 'briefing' | 'guardian' | 'freed';
export type Speaker = 'narrator' | 'torus' | 'vecta';

export interface SceneLine {
  readonly who: Speaker;
  readonly text: string;
}

/** What the centre of a panel shows. The player draws each one in code. */
export type Visual =
  | 'lattice' // black screen, one grid dot glows, the lattice draws out from it
  | 'ship' // the pilot ship at centre with a glow pulse
  | 'shipName' // the call sign above the ship, the grid brightens once
  | 'gridDrain' // wide grid, colour drains from the far corners
  | 'torus' // Torus beside the ship
  | 'foe' // one or more enemy icons
  | 'foeAction' // the ship with enemy icons and action strokes
  | 'boss' // a guardian silhouette, grey and glitching
  | 'bossTouched' // Vecta's grey outline brushes the guardian, its colour fades
  | 'bossAttack' // the guardian with its attack strokes
  | 'bossFreed' // colour floods back into the guardian, a star lights
  | 'vectaFar' // a grey ship outline far on the rim
  | 'vectaTruth' // a grey ship outline drinking colour from ten guardians
  | 'vectaFlee'; // the grey outline pulls away into a far dark star

/** Simple strokes drawn in the enemy or guardian colour. */
export type Mark =
  | 'static'
  | 'shots'
  | 'shards'
  | 'path'
  | 'lane'
  | 'slime'
  | 'mines'
  | 'ring'
  | 'flock'
  | 'shield'
  | 'gate'
  | 'clock'
  | 'arms'
  | 'pods'
  | 'anchors'
  | 'turrets'
  | 'bar'
  | 'copies'
  | 'trail'
  | 'bomb'
  | 'pull'
  | 'flash';

export interface Panel {
  readonly visual: Visual;
  /** The bible's visual description, kept for review and for screen readers. */
  readonly note: string;
  readonly lines: readonly SceneLine[];
  readonly foes?: readonly FoeKind[];
  readonly boss?: BossId;
  readonly marks?: readonly Mark[];
  /** Freed panels: how many stars are lit above the grid. */
  readonly stars?: number;
  /** Opening P2: the call sign picker opens after the text. */
  readonly picker?: boolean;
}

export interface Scene {
  readonly id: string;
  readonly type: SceneType;
  /** Act 1 to 5, from the nominal level; Torus grows larger each act. */
  readonly act: number;
  /** The bible's nominal level (the trigger decides when it really plays). */
  readonly level: number;
  readonly panels: readonly Panel[];
}

/** The token the call sign replaces in scene text. Counted as 10 characters by the line check. */
export const CALLSIGN_TOKEN = '{callsign}';

const n = (text: string): SceneLine => ({ who: 'narrator', text });
const t = (text: string): SceneLine => ({ who: 'torus', text });
const v = (text: string): SceneLine => ({ who: 'vecta', text });

const actOf = (level: number): number => Math.min(5, Math.max(1, Math.ceil(level / 10)));

function scene(id: string, type: SceneType, level: number, panels: readonly Panel[]): Scene {
  return { id, type, act: actOf(level), level, panels };
}

/** Guardian order (V9 Adventure): Brood at 5, Warden at 10, and so on to Prism at 50. */
export const GUARDIAN_ORDER: readonly BossId[] = ['brood', 'warden', 'spindle', 'ember', 'mirage', 'gravitas', 'bastion', 'tempest', 'twins', 'prism'];

/** The combos the bible briefs, as [kindA, kindB]. */
export const COMBOS: readonly (readonly [FoeKind, FoeKind])[] = [
  ['charger', 'splime'],
  ['well', 'snake'],
  ['sower', 'spawner'],
];

export const foeId = (k: FoeKind): string => `foe:${k}`;
export const comboId = (a: FoeKind, b: FoeKind): string => `combo:${a}+${b}`;
export const bossId = (b: BossId): string => `boss:${b}`;
export const freedId = (b: BossId): string => `freed:${b}`;
export const OPENING_ID = 'opening';

const LIST: readonly Scene[] = [
  scene(OPENING_ID, 'opening', 1, [
    { visual: 'lattice', note: 'black screen; one grid dot glows, then the lattice draws out from it', lines: [n('You wake in the dark. No sky. No ground.'), n('Only lines of light, and one small ship.')] },
    { visual: 'ship', note: 'pilot ship at centre, glow pulse; call sign picker opens after the text', picker: true, lines: [n('The ship is yours. It waits for a name.'), n('What will Vertane call you?')] },
    { visual: 'shipName', note: 'the call sign types out above the ship; the grid brightens once', lines: [n('{callsign}. The grid hums it back,'), n('as if it waited a long time to hear it.')] },
    { visual: 'gridDrain', note: 'wide grid; colour drains from the far corners in a slow dim', lines: [n('This is Vertane, a world of shapes.'), n('Once it sang. Now the dim is spreading.')] },
    { visual: 'torus', note: 'Torus fades in beside the ship, nested shapes turning', lines: [n('Vertane called you here, on purpose.'), t('You heard it. Good. Now, the trials.')] },
  ]),

  scene(foeId('grunt'), 'briefing', 1, [
    { visual: 'foe', foes: ['grunt'], marks: ['static'], note: 'Grunt icon, blue, pulsing; grey static flickers on it', lines: [n('The first dim shapes are small squares.'), n('Grunts. They come straight at you.')] },
    { visual: 'foeAction', foes: ['grunt'], marks: ['shots'], note: 'ship circling, shots leading the Grunt', lines: [n('Keep moving and shoot where they go.'), n('A touch costs a life, so stay clear.')] },
    { visual: 'foeAction', foes: ['grunt'], marks: ['shards'], note: 'a Grunt breaks into shards of light', lines: [n('Break one and it turns to light again.'), t('Every shape here was good, once.')] },
  ]),
  scene(foeId('wanderer'), 'briefing', 2, [
    { visual: 'foe', foes: ['wanderer'], note: 'Wanderer icon, violet bow tie, spinning', lines: [n('Wanderers drift and do not hunt you.'), n('They bounce off walls like lost birds.')] },
    { visual: 'foeAction', foes: ['wanderer'], marks: ['path'], note: 'a dotted path bounces off a wall; the ship steps aside', lines: [n('Read their path and step out of it.'), n('Do not let one drift into you.')] },
  ]),
  scene(foeId('pinwheel'), 'briefing', 3, [
    { visual: 'foe', foes: ['pinwheel'], note: 'Pinwheel icon, pink, slow spin', lines: [n('Pinwheels turn slow and drift wide.'), n('They are tough. One hit is not enough.')] },
    { visual: 'foeAction', foes: ['pinwheel'], marks: ['shots', 'shards'], note: 'two shots land, the Pinwheel breaks', lines: [n('Hit each one twice to set it free.'), n('Slow does not mean safe. Keep space.')] },
  ]),

  scene(bossId('brood'), 'guardian', 5, [
    { visual: 'boss', boss: 'brood', note: 'Brood silhouette, grey green, glitching; slow reveal', lines: [n('Brood, Keeper of the Nest, wakes.'), n('It kept small shapes safe and warm.')] },
    { visual: 'bossTouched', boss: 'brood', note: 'a grey ship outline brushes Brood; its green fades', lines: [n('A fallen legend took its green light.'), n('Now it guards its nest from everyone.')] },
    { visual: 'bossAttack', boss: 'brood', marks: ['pods', 'lane'], note: 'three pods orbit Brood; pods glow pulse; a lane line flashes', lines: [n('Three pods shield it. Break all three,'), n('then strike. Step off its charge line.')] },
    { visual: 'torus', note: 'Torus, small, beside the ship', lines: [t('It is not cruel, {callsign}. It is lost.')] },
  ]),
  scene(freedId('brood'), 'freed', 5, [
    { visual: 'bossFreed', boss: 'brood', stars: 1, note: 'green floods back into Brood; it shrinks to a calm glow; one star lights above the grid', lines: [n('Green light returns. Brood is free.'), n('One star wakes. Vertane remembers you.')] },
  ]),

  scene(foeId('weaver'), 'briefing', 6, [
    { visual: 'foeAction', foes: ['weaver'], marks: ['shots'], note: 'Weaver icon, green diamond, sidestepping a shot', lines: [n('Weavers are quick. They see your shots'), n('and slip aside at the last moment.')] },
    { visual: 'foeAction', foes: ['weaver'], marks: ['shots'], note: 'a spread of shots, one catches the Weaver', lines: [n('Shoot wide, or let it come close.'), n('Then it has no room to slip away.')] },
  ]),
  scene(foeId('dart'), 'briefing', 6, [
    { visual: 'foe', foes: ['dart'], marks: ['flock'], note: 'a flock of Dart icons, orange arrowheads, curving in', lines: [n('Darts fly in flocks of five or more.'), n('Fast and thin, they turn to follow you.')] },
    { visual: 'foeAction', foes: ['dart'], marks: ['flock', 'shots'], note: 'ship circles wide; the flock bunches; one sweep of shots', lines: [n('Circle wide so they bunch up behind you,'), n('then turn and sweep the flock away.')] },
  ]),
  scene(foeId('charger'), 'briefing', 7, [
    { visual: 'foe', foes: ['charger'], marks: ['lane'], note: 'Charger icon; a lane line draws out from it', lines: [n('Chargers draw a line before they dash.'), n('The line shows exactly where they go.')] },
    { visual: 'foeAction', foes: ['charger'], marks: ['lane'], note: 'ship steps off the line; Charger dashes past into a wall', lines: [n('When you see the line, step off it.'), n('Then hit it while it rests.')] },
  ]),
  scene(foeId('swirl'), 'briefing', 9, [
    { visual: 'foeAction', foes: ['swirl'], marks: ['ring'], note: 'Swirl icon circling the ship, closing in', lines: [n('Swirls circle you, closer and closer.'), n('Then they dive straight in.')] },
    { visual: 'foeAction', foes: ['swirl'], marks: ['lane'], note: 'Swirl turns inward; ship sidesteps', lines: [n('When it turns toward you, sidestep.'), n('Its dive only goes in a straight line.')] },
  ]),

  scene(bossId('warden'), 'guardian', 10, [
    { visual: 'boss', boss: 'warden', marks: ['gate'], note: 'Warden silhouette, grey blue; a gate of light behind it, closed', lines: [n('Warden, Keeper of the Old Gate.'), n('It once opened the ways between places.')] },
    { visual: 'bossTouched', boss: 'warden', marks: ['gate'], note: 'grey outline passes; the gate goes dark', lines: [n('The fallen legend broke its trust.'), n('Now it shuts every way, for everyone.')] },
    { visual: 'bossAttack', boss: 'warden', marks: ['ring'], note: 'a ring with a gap flies out; the shell opens for a moment', lines: [n('Fly through the gap in its rings.'), n('Its shell opens just after each ring.')] },
    { visual: 'torus', note: 'Torus, glow pulse', lines: [t('A closed gate still remembers the key.')] },
  ]),
  scene(freedId('warden'), 'freed', 10, [
    { visual: 'bossFreed', boss: 'warden', marks: ['gate'], stars: 2, note: 'blue returns; the gate of light opens; a second star lights', lines: [n('Blue light returns. The Old Gate opens.'), n('Far off, a grey shape watches, and goes.')] },
  ]),

  scene(foeId('splime'), 'briefing', 11, [
    { visual: 'foe', foes: ['splime'], marks: ['slime'], note: 'Splime icon, slow; puddles of slime left behind', lines: [n('Splimes ooze slow and leave slime.'), n('Slime does not hurt, but it slows you.')] },
    { visual: 'foeAction', foes: ['splime'], marks: ['slime', 'bomb'], note: 'ship flies around a puddle; a bomb flash clears them', lines: [n('Fly around the puddles. Keep your speed.'), n('A bomb clears all the slime at once.')] },
  ]),
  scene(foeId('well'), 'briefing', 12, [
    { visual: 'foe', foes: ['well'], marks: ['pull'], note: 'well icon, rings around a white core, pulling grid lines in', lines: [n('Gravity wells pull you and shapes in.'), n('Left alone, they swell and burst bright.')] },
    { visual: 'foeAction', foes: ['well'], marks: ['shots', 'shards'], note: 'shots hit the well; it shrinks and breaks into light', lines: [n('Shoot a well down early, from far away.'), n('When a big one breaks, a wave rolls out.')] },
  ]),
  scene(comboId('charger', 'splime'), 'briefing', 13, [
    { visual: 'foeAction', foes: ['charger', 'splime'], marks: ['slime', 'lane'], note: 'slime puddles on the floor; a Charger line crosses one', lines: [n('Slime slows you, and Chargers dash fast.'), n('Slow feet cannot step off a dash line.')] },
    { visual: 'foeAction', foes: ['charger'], marks: ['slime', 'lane'], note: 'ship stays on clear floor, steps off the line', lines: [n('Keep to clean floor when Chargers come,'), n('so you can always step aside.')] },
  ]),

  scene(bossId('spindle'), 'guardian', 15, [
    { visual: 'boss', boss: 'spindle', marks: ['clock'], note: 'Spindle silhouette, grey yellow; a clock face of grid lines', lines: [n('Spindle, Turner of Days.'), n('It turned the hours of Vertane gently.')] },
    { visual: 'bossTouched', boss: 'spindle', marks: ['clock', 'static'], note: 'grey outline; the clock lines tangle and glitch', lines: [n('The fallen legend tangled its turning.'), n('Now its arms sweep only to push away.')] },
    { visual: 'bossAttack', boss: 'spindle', marks: ['arms'], note: 'two long arms; they freeze thin and dim, then turn the other way', lines: [n('Stay in the open space between its arms.'), n('When the arms go dim, they turn back.')] },
    { visual: 'torus', note: 'Torus beside the ship', lines: [t('A legend came before you. Remember that.')] },
  ]),
  scene(freedId('spindle'), 'freed', 15, [
    { visual: 'bossFreed', boss: 'spindle', marks: ['clock'], stars: 3, note: 'yellow returns; the clock lines turn smoothly; a third star lights', lines: [n('Yellow light returns. Days turn again.'), n('Somewhere, a grey legend loses a little.')] },
  ]),

  scene(foeId('snake'), 'briefing', 16, [
    { visual: 'foe', foes: ['snake'], note: 'Snake icon, cyan hexagon head and a long chain of circles', lines: [n('Snakes weave at you, long and bright.'), n('Only the head can be hurt.')] },
    { visual: 'foeAction', foes: ['snake'], marks: ['shots', 'shards'], note: 'shots hit the body and stop; one hits the head; the chain fades to light', lines: [n('Their bodies block shots. Do not touch.'), n('Aim at the head, never at the tail.')] },
  ]),
  scene(foeId('bulwark'), 'briefing', 17, [
    { visual: 'foe', foes: ['bulwark'], marks: ['shield'], note: 'Bulwark icon with a bright shield arc in front', lines: [n('Bulwarks carry a shield on their front.'), n('Shots from the front just bounce away.')] },
    { visual: 'foeAction', foes: ['bulwark'], marks: ['shield', 'shots'], note: 'ship circles round; shots hit its back', lines: [n('Fly around it and hit it from behind.'), n('A bomb ignores the shield.')] },
  ]),
  scene(foeId('blink'), 'briefing', 18, [
    { visual: 'foeAction', foes: ['blink'], marks: ['ring'], note: 'Blink icon fades to a ghost; a ring appears near the ship', lines: [n('Blinks vanish and pop up near you.'), n('A ring shows where one will land.')] },
    { visual: 'foeAction', foes: ['blink'], marks: ['ring'], note: 'ship moves away from the ring; Blink appears in empty space', lines: [n('When you see a ring, move away from it.'), n('Then turn and hit the Blink.')] },
  ]),
  scene(foeId('spawner'), 'briefing', 19, [
    { visual: 'foe', foes: ['spawner', 'dart'], marks: ['flock'], note: 'Spawner icon, octagon, a flock of Darts leaving it', lines: [n('Spawners make Darts, again and again.'), n('They drift slowly after you.')] },
    { visual: 'foeAction', foes: ['spawner'], marks: ['shots', 'shards'], note: 'ship shoots the Spawner; it breaks into light', lines: [n('Break the Spawner before the flock.'), n('Then the Darts stop coming.')] },
  ]),
  scene(comboId('well', 'snake'), 'briefing', 19, [
    { visual: 'foeAction', foes: ['well', 'snake'], marks: ['pull'], note: 'a well pulling the ship toward a Snake body', lines: [n('Wells pull you, and Snakes are long.'), n('A pull can drag you into a tail.')] },
    { visual: 'foeAction', foes: ['well', 'snake'], marks: ['shots', 'shards'], note: 'ship shoots the well first; it breaks; the Snake follows', lines: [n('Break the well first, then the Snake.'), n('Then the floor is yours again.')] },
  ]),

  scene(bossId('ember'), 'guardian', 20, [
    { visual: 'boss', boss: 'ember', note: 'Ember silhouette, grey orange, flickering like a cold hearth', lines: [n('Ember, the Hearth Flame.'), n('It kept all of Vertane warm.')] },
    { visual: 'bossTouched', boss: 'ember', note: 'grey outline feeds on its glow; Ember flares wild', lines: [n('The fallen legend fed on its fire.'), n('Now it burns wild and cannot rest.')] },
    { visual: 'bossAttack', boss: 'ember', marks: ['lane', 'mines'], note: 'a dash line; Ember bounces off a wall and stops, dizzy', lines: [n('It dashes and drops mines on the way.'), n('Hit it when it stops after a wall.')] },
    { visual: 'torus', note: 'Torus, steady glow', lines: [t('Help it rest, and it will warm you.')] },
  ]),
  scene(freedId('ember'), 'freed', 20, [
    { visual: 'bossFreed', boss: 'ember', stars: 4, note: 'warm orange returns; the grid glows gently; a fourth star lights', lines: [n('Orange light returns. Vertane is warm.'), n('Two acts of the trial are done.')] },
  ]),

  scene(foeId('leaver'), 'briefing', 21, [
    { visual: 'foeAction', foes: ['leaver'], marks: ['shards'], note: 'Leaver icon, nested squares; it splits into small shards', lines: [n('Leavers look like Weavers, but split.'), n('Break one and its shards chase you.')] },
    { visual: 'foeAction', foes: ['leaver'], marks: ['shards', 'shots'], note: 'shards pause, then dart; the ship backs away and shoots', lines: [n('After you break one, back away at once.'), n('Shards are quick, so shoot as they come.')] },
  ]),

  scene(bossId('mirage'), 'guardian', 25, [
    { visual: 'boss', boss: 'mirage', marks: ['copies'], note: 'Mirage silhouette, grey magenta, three copies flicker', lines: [n('Mirage, Keeper of True Sight.'), n('It showed Vertane what was real.')] },
    { visual: 'bossTouched', boss: 'mirage', marks: ['copies'], note: "grey outline; Mirage's copies multiply", lines: [n('The fallen legend taught it to trick.'), n('Now it shows only what is not there.')] },
    { visual: 'bossAttack', boss: 'mirage', marks: ['ring', 'lane', 'shield'], note: 'a ring marks a spot; Mirage lands; lanes burst out; the open arc on its shield glows', lines: [n('A ring shows where it will land. Move.'), n('Shoot through the gap in its shield.')] },
    { visual: 'torus', note: 'Torus, glow pulse', lines: [t('When it sees true, you will see too.')] },
  ]),
  scene(freedId('mirage'), 'freed', 25, [
    { visual: 'bossFreed', boss: 'mirage', stars: 5, note: 'magenta returns; the copies melt into one; a fifth star lights', lines: [n('Magenta light returns. Mirage sees true.'), n('And it shows you what really happened.')] },
    { visual: 'vectaTruth', note: 'a grey ship outline drinking colour from ten guardians, drawn as a slow reveal', lines: [n('A legend named Vecta took their light.'), n('He wanted all of it for himself.')] },
  ]),

  scene(bossId('gravitas'), 'guardian', 30, [
    { visual: 'boss', boss: 'gravitas', marks: ['pull'], note: 'Gravitas silhouette, grey violet, grid lines bending toward it', lines: [n('Gravitas, Heart of the Deep.'), n('Its pull held all of Vertane together.')] },
    { visual: 'bossTouched', boss: 'gravitas', marks: ['pull'], note: "Vecta's outline; the pull grows too strong; lines stretch", lines: [n('Vecta made its pull too strong.'), n('Now it pulls everything to itself.')] },
    { visual: 'bossAttack', boss: 'gravitas', marks: ['anchors', 'ring'], note: 'three anchors orbit it; a ring closes in with a gap', lines: [n('Break its three anchors to weaken it.'), n('Fly out through the gap in each ring.')] },
    { visual: 'torus', note: 'Torus, larger and brighter now', lines: [t('No more riddles. I am with you.')] },
  ]),
  scene(freedId('gravitas'), 'freed', 30, [
    { visual: 'bossFreed', boss: 'gravitas', stars: 6, note: 'violet returns; grid lines relax; a sixth star lights', lines: [n('Violet light returns. The heart is calm.'), n('Vertane holds together again.')] },
    { visual: 'vectaFar', note: 'far on the rim, a grey ship outline, clear for the first time', lines: [n('And now you see him, far on the rim.'), n('Vecta, the Grey Legend, sees you too.')] },
  ]),

  scene(foeId('sower'), 'briefing', 31, [
    { visual: 'foe', foes: ['sower'], marks: ['mines'], note: 'Sower icon hugging the arena edge, dropping mines', lines: [n('Sowers creep along the arena walls.'), n('They leave mines behind them.')] },
    { visual: 'foeAction', foes: ['sower'], marks: ['shots'], note: 'ship holds the middle; shoots the Sower from afar', lines: [n('Keep away from the walls they creep on.'), n('Hit them from the middle of the floor.')] },
  ]),
  scene(comboId('sower', 'spawner'), 'briefing', 32, [
    { visual: 'foeAction', foes: ['spawner', 'dart'], marks: ['mines', 'flock'], note: 'mines on the edges; a Spawner drifting in, Darts leaving it', lines: [n('Mines line the edges. Darts fly in.'), n('The open middle is your safe ground.')] },
    { visual: 'foeAction', foes: ['spawner', 'sower'], marks: ['shots', 'shards'], note: 'ship in the centre breaks the Spawner first', lines: [n('Hold the middle. Break Spawners first.'), n('Then clear the Sowers one by one.')] },
  ]),

  scene(bossId('bastion'), 'guardian', 35, [
    { visual: 'boss', boss: 'bastion', marks: ['turrets'], note: 'Bastion silhouette, grey red, a square fort with four corner towers', lines: [n('Bastion, the Last Wall.'), n('It gave every shape shelter from storms.')] },
    { visual: 'bossTouched', boss: 'bastion', marks: ['turrets'], note: "Vecta's outline; the towers turn outward", lines: [n('Vecta turned its towers outward.'), n('Now it shuts everyone out.')] },
    { visual: 'bossAttack', boss: 'bastion', marks: ['turrets', 'lane', 'shield'], note: 'corner turrets glow in turn; two break; the core opens; a Bulwark arrives', lines: [n('Its four towers fire lanes. Break two'), n('and the core opens. Watch for Bulwarks.')] },
    { visual: 'torus', note: 'Torus beside the ship', lines: [t('He is angry. So you are close.')] },
  ]),
  scene(freedId('bastion'), 'freed', 35, [
    { visual: 'bossFreed', boss: 'bastion', marks: ['turrets'], stars: 7, note: 'red returns; the towers face inward like arms; a seventh star lights', lines: [n('Red light returns. The Wall shelters.'), n('Your ship shines brighter than before.')] },
  ]),

  scene(bossId('tempest'), 'guardian', 40, [
    { visual: 'boss', boss: 'tempest', marks: ['trail'], note: 'Tempest silhouette, grey red, racing round the arena edge', lines: [n('Tempest, Rider of the Rim.'), n('Its winds carried light to every corner.')] },
    { visual: 'bossTouched', boss: 'tempest', marks: ['trail'], note: "Vecta watching from the rim; Tempest's trail turns dim", lines: [n('Vecta turned its wind into a storm.'), n('He watches from the rim as it rages.')] },
    { visual: 'bossAttack', boss: 'tempest', marks: ['slime', 'lane'], note: 'slime trail along the wall; a dash line across the floor', lines: [n('It races the walls and leaves slime.'), n('Step off its dash. Bombs clear slime.')] },
    { visual: 'torus', note: 'Torus, glow pulse', lines: [t('Be the calm. The storm will follow.')] },
  ]),
  scene(freedId('tempest'), 'freed', 40, [
    { visual: 'bossFreed', boss: 'tempest', marks: ['trail'], stars: 8, note: 'red returns; light flows around the rim; an eighth star lights', lines: [n('Light rides the wind again.'), n('Vecta is gone from the rim. Two remain.')] },
  ]),

  scene(bossId('twins'), 'guardian', 45, [
    { visual: 'boss', boss: 'twins', marks: ['bar'], note: 'two silhouettes, grey red, a bright bar between them', lines: [n('The Twins, the Bound Stars.'), n('Two friends who never left each other.')] },
    { visual: 'bossTouched', boss: 'twins', marks: ['bar'], note: "Vecta's outline; the bond between them turns into a blade of light", lines: [n('Vecta turned their bond into a bar.'), n('It sweeps the floor as they turn.')] },
    { visual: 'bossAttack', boss: 'twins', marks: ['bar', 'ring'], note: 'the bar sweeps; rings with gaps; one twin dims, the other speeds up', lines: [n('Keep clear of the bar between them.'), n('When one falls, the other gets fast.')] },
    { visual: 'torus', note: 'Torus beside the ship', lines: [t('Free them both. A bond can heal.')] },
  ]),
  scene(freedId('twins'), 'freed', 45, [
    { visual: 'bossFreed', boss: 'twins', marks: ['bar'], stars: 9, note: 'both twins glow red and gold, the bar becomes a soft ribbon; a ninth star lights', lines: [n('The bond is light again, not a bar.'), n('Nine stars shine. One crown is left.')] },
  ]),

  scene(bossId('prism'), 'guardian', 50, [
    { visual: 'boss', boss: 'prism', note: 'Prism silhouette, all grey, the outline of a crown', lines: [n('Prism, Crown of All Colours.'), n('It shared every colour with the world.')] },
    { visual: 'bossTouched', boss: 'prism', note: "Vecta's grey outline above Prism, Prism holding colours locked inside", lines: [n('Vecta made it his throne.'), n('It holds every colour in, for him alone.')] },
    { visual: 'bossAttack', boss: 'prism', marks: ['flash'], note: "Prism cycles through each guardian's attack as small icons; it flashes white", lines: [n("It uses every guardian's trick in turn."), n('Strike hard when it flashes white.')] },
    { visual: 'torus', note: 'Torus, full size, every shape in it glowing', lines: [t('Every legend began like you, {callsign}.')] },
  ]),
  scene(freedId('prism'), 'freed', 50, [
    { visual: 'bossFreed', boss: 'prism', stars: 10, note: 'colour bursts out of Prism to all ten guardians; the tenth star lights; the whole grid floods with colour', lines: [n('Every colour returns to Vertane.'), n('Ten stars shine. You are a Shape Legend.')] },
    { visual: 'vectaFlee', note: "Vecta's grey outline pulls away into a far dark star", lines: [n('Vecta flees to the Hollow Star.'), v('This is not the end, little legend.')] },
  ]),
];

/** Every scene keyed by trigger id. */
export const SCENES: Readonly<Record<string, Scene>> = Object.fromEntries(LIST.map((s) => [s.id, s]));

/** Every trigger id in bible order (also the replay order on one level). */
export const SCENE_IDS: readonly string[] = LIST.map((s) => s.id);

export function sceneById(id: string): Scene | undefined {
  return SCENES[id];
}

/** Pure: the shown text of a line with the call sign put in. */
export function fillCallsign(text: string, callsign: string): string {
  return text.split(CALLSIGN_TOKEN).join(callsign);
}

/** Pure: the counted length of a line, with the call sign token counted as 10 (the call sign cap). */
export function countedLength(text: string): number {
  return text.split(CALLSIGN_TOKEN).join('0123456789').length;
}
