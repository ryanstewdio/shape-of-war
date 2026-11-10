// How to guide (Ryan: "a How to section with a button on the main menu so new players quickly learn
// how to play ... enough for a 7 year old to understand and play better"). A paged card: swipe or
// Next and Back, a row of page dots, Close. Headings use the pixel font; body lines are short plain
// sentences, one idea per line. Icons are the game's own neon shapes (render shape specs, read
// only) or small stroke drawings, never image assets.
// The words come from the real tables where they can: enemy names and types (FOE_INFO), weapon
// kinds and pair names (WEAPON_KINDS, COMBO_TABLE), Turbo and super numbers, drone modes, star caps
// and difficulty lives, so the guide stays true when those change. Pure except createHowToScreen.
import { DIFFICULTY, DIFFICULTIES, type Difficulty } from '../core/difficulty';
import { DRONE_MODES, type DroneMode } from '../core/events';
import { INSANE_STARS, STAR_CAP } from '../core/stars';
import { DRONE_ARM_SEC } from '../game/drones';
import { SUPER_DURATION, TURBO_DURATION, TURBO_MAX_TOTAL, TURBO_SCALE } from '../game/supers';
import { COMBO_TABLE, WEAPON_DURATION, WEAPON_KINDS } from '../game/weapons';
import { Kind } from '../game/world';
import type { DroneKind } from '../levelgen/leveldef';
import type { BaseWeaponKind } from '../core/events';
import type { PaletteKey } from '../render/neon';
import { SHAPE_SPECS } from '../render/shapeSpecs';
import { button, createScreen, el, type Screen } from './dom';
import { FOE_INFO, iconCanvas, paletteCss, specCanvas, type FoeKind, type FoeType } from './enemyIntro';
import { iconStrokes, strokeCanvas, type Stroke } from './parReward';
import { difficultyLabel } from './settings';
import { setVectorText, type VectorTone } from './vectorFont';
import { bus } from '../core/events';
import { attachScrollbar } from './scrollbar';

export const HOW_TO_TITLE = 'How to';
/** Hard ceiling per page section (tests); the writing aims for about 30. */
export const MAX_SECTION_WORDS = 40;
/** A horizontal finger move this long, in CSS px, turns the page. */
export const SWIPE_PX = 50;
/** Large icon edge in CSS px (section icons); item icons are smaller. */
export const HOW_TO_ICON_PX = 56;
export const HOW_TO_ITEM_PX = 40;

/** Drawn helpers the shape specs do not cover. */
export type DrawId = 'moveStick' | 'aimStick' | 'superRing' | 'membrane' | 'drift' | 'star' | 'star4' | 'goal';

export type HowToIcon =
  | { readonly t: 'foe'; readonly kind: FoeKind }
  | { readonly t: 'shape'; readonly kind: 'ship' | 'drone' | 'dronePickup' | 'geom' | 'mine' | 'slime' | 'weaponPickup' }
  | { readonly t: 'reward'; readonly icon: 'life' | 'bomb' | BaseWeaponKind }
  | { readonly t: 'draw'; readonly id: DrawId };

/** One icon row: an icon, a short name and a few words. */
export interface HowToItem {
  readonly icon: HowToIcon;
  readonly name: string;
  readonly text: string;
  /** Neon colour of the name, so each named item in a list reads apart. */
  readonly colour?: PaletteKey;
}

export interface HowToSection {
  readonly heading: string;
  readonly icon?: HowToIcon;
  readonly lines: readonly string[];
  readonly items: readonly HowToItem[];
  /** Heading tone when the heading is itself a list title (Survive, Destroy, Score, Boss). */
  readonly tone?: VectorTone;
  /** Lead word of a line (the text before its first colon) to neon colour. */
  readonly leads?: Readonly<Record<string, PaletteKey>>;
}

export interface SecOpts {
  readonly tone?: VectorTone;
  readonly leads?: Readonly<Record<string, PaletteKey>>;
}

export interface HowToPage {
  readonly id: string;
  readonly title: string;
  readonly sections: readonly HowToSection[];
}

const sec = (heading: string, lines: readonly string[], icon?: HowToIcon, items: readonly HowToItem[] = [], opts: SecOpts = {}): HowToSection => ({
  heading,
  lines,
  items,
  ...(icon === undefined ? {} : { icon }),
  ...(opts.tone === undefined ? {} : { tone: opts.tone }),
  ...(opts.leads === undefined ? {} : { leads: opts.leads }),
});

/** Pure: the lead word of a line, the text before its first colon, or '' when it has none. */
export function leadWord(line: string): string {
  const i = line.indexOf(':');
  return i > 0 ? line.slice(0, i) : '';
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

// ---- Words from the data tables --------------------------------------------------------------

/** A few words per enemy kind, for a young reader. */
export const FOE_WORDS: Readonly<Record<FoeKind, string>> = {
  grunt: 'Chases you.',
  wanderer: 'Bounces around. Does not chase.',
  weaver: 'Chases you and dodges shots.',
  pinwheel: 'Spins and bounces. Hit it twice.',
  dart: 'Fast. Turns to follow you.',
  snake: 'Shoot the head. The tail hurts too.',
  charger: 'Aims, then dashes at you.',
  bulwark: 'Shield in front. Hit its side.',
  blink: 'Jumps close to you.',
  swirl: 'Circles you, then dives.',
  sower: 'Drops mines near the walls.',
  splime: 'Leaves slime that slows you.',
  leaver: 'Breaks into pieces that chase you.',
  well: 'Pulls you in.',
  spawner: 'Makes Darts.',
};

/** Group headings on the Enemies page, by the one word type the intro card uses. */
export const FOE_GROUPS: readonly { readonly type: FoeType; readonly heading: string }[] = [
  { type: 'chaser', heading: 'Chasers' },
  { type: 'tank', heading: 'Tough ones' },
  { type: 'swarm', heading: 'Swarms' },
  { type: 'splitter', heading: 'Splitters' },
  { type: 'hazard', heading: 'Tricky ones' },
];

/** Every enemy kind on the Enemies page: all FOE_INFO kinds except the gravity well (Hazards). */
export function enemyKinds(): FoeKind[] {
  return (Object.keys(FOE_INFO) as FoeKind[]).filter((k) => k !== 'well');
}

export const WEAPON_WORDS: Readonly<Record<BaseWeaponKind, string>> = {
  spread: 'Three shots in a fan. You start with it.',
  rapid: 'A fast stream of shots.',
  pierce: 'Big shots that go through.',
  orbit: 'Spikes spin around you.',
};

export const DRONE_WORDS: Readonly<Record<DroneKind, string>> = {
  attack: 'Flies around you and shoots.',
  collect: 'Follows you and grabs geoms.',
  ram: 'Flies around you and bashes enemies.',
};
export const DRONE_KINDS: readonly DroneKind[] = ['attack', 'collect', 'ram'];

export const DRONE_MODE_WORDS: Readonly<Record<DroneMode, string>> = {
  homing: 'shots chase enemies',
  detach: 'it stays put to trick enemies',
  rapid: 'it shoots fast',
  double: 'you get two drones',
};

/** Pure: the lives part of a difficulty line ("2 extra lives", "1 less life", "normal lives"). */
export function livesWords(extra: number): string {
  if (extra > 0) return `${plural(extra, 'extra life', 'extra lives')}`;
  if (extra < 0) return `${plural(-extra, 'less life', 'less lives')}`;
  return 'normal lives';
}

const DIFF_WORDS: Readonly<Record<Difficulty, string>> = {
  easy: 'Slower enemies',
  normal: 'The real game',
  hard: 'Faster, tougher enemies',
  insane: 'The hardest of all',
};

/** Pure: one line per difficulty from the DIFFICULTY table. */
export function difficultyLines(): string[] {
  return DIFFICULTIES.map((d) => `${difficultyLabel(d)}: ${DIFF_WORDS[d]}, ${livesWords(DIFFICULTY[d].extraLives)}.`);
}

/** Pure: one line per difficulty with its star cap; Insane wins give INSANE_STARS. */
export function starCapLines(): string[] {
  return DIFFICULTIES.map((d) =>
    d === 'insane'
      ? `${difficultyLabel(d)}: win to get ${INSANE_STARS} stars.`
      : `${difficultyLabel(d)}: up to ${plural(STAR_CAP[d], 'star', 'stars')}.`,
  );
}

// ---- Colours for lists of titles ---------------------------------------------------------------
// Each list gives every named item its own colour from the neon palette. Tests assert no two items
// in one list share a colour.

/** Goal page headings, one pixel font tone each. */
export const GOAL_TONES: Readonly<Record<'Survive' | 'Destroy' | 'Score' | 'Boss', VectorTone>> = {
  Survive: 'green',
  Destroy: 'red',
  Score: 'yellow',
  Boss: 'magenta',
};
/** Hazard headings, one pixel font tone each. */
export const HAZARD_TONES: Readonly<Record<'Gravity wells' | 'Mines and slime' | 'Membranes' | 'Drums', VectorTone>> = {
  'Gravity wells': 'red',
  'Mines and slime': 'orange',
  Membranes: 'purple',
  Drums: 'cyan',
};
export const WEAPON_COLOURS: Readonly<Record<BaseWeaponKind, PaletteKey>> = { spread: 'yellow', rapid: 'rapid', pierce: 'pierce', orbit: 'orbit' };
export const DRONE_COLOURS: Readonly<Record<DroneKind, PaletteKey>> = { attack: 'red', collect: 'green', ram: 'orange' };
export const DRONE_MODE_COLOURS: Readonly<Record<DroneMode, PaletteKey>> = { homing: 'homing', detach: 'purple', rapid: 'cyan', double: 'yellow' };
export const SUPER_COLOURS: Readonly<Record<'Homing' | 'Turbo' | 'Detonate', PaletteKey>> = { Homing: 'homing', Turbo: 'orange', Detonate: 'yellow' };
export const DIFFICULTY_COLOURS: Readonly<Record<Difficulty, PaletteKey>> = { easy: 'green', normal: 'cyan', hard: 'orange', insane: 'red' };
export const REWARD_NAME_COLOURS: Readonly<Record<'Life' | 'Bomb' | 'Weapon', PaletteKey>> = { Life: 'green', Bomb: 'bomb', Weapon: 'yellow' };

/** Pure: lead word to colour for the difficulty lines, which start with the difficulty label. */
export function difficultyLeads(): Record<string, PaletteKey> {
  return Object.fromEntries(DIFFICULTIES.map((d) => [difficultyLabel(d), DIFFICULTY_COLOURS[d]]));
}

/** Headings on pages 3 to 5, one pixel font tone each, no two alike on a page. */
export const BOMBS_TONES: Readonly<Record<'Bomb' | 'Super' | 'Kinds of Super' | 'When to use them', VectorTone>> = {
  Bomb: 'cyan',
  Super: 'yellow',
  'Kinds of Super': 'orange',
  'When to use them': 'green',
};
export const WEAPONS_TONES: Readonly<Record<'Four weapons' | 'Pickups' | 'Super weapons', VectorTone>> = {
  'Four weapons': 'yellow',
  Pickups: 'green',
  'Super weapons': 'magenta',
};
export const DRONES_TONES: Readonly<Record<'Your drone' | 'Drone pickups', VectorTone>> = {
  'Your drone': 'cyan',
  'Drone pickups': 'purple',
};

// ---- The pages -------------------------------------------------------------------------------

/** Pure: the nine pages in order. */
export function howToPages(): HowToPage[] {
  const weaponItems = WEAPON_KINDS.map((w): HowToItem => ({ icon: { t: 'reward', icon: w }, name: cap(w), text: WEAPON_WORDS[w], colour: WEAPON_COLOURS[w] }));
  const combos = COMBO_TABLE.map((c) => `${cap(c.a)} + ${cap(c.b)} = ${c.name}`);
  const foeItems = (type: FoeType): HowToItem[] =>
    enemyKinds()
      .filter((k) => FOE_INFO[k].type === type)
      .map((k) => ({ icon: { t: 'foe', kind: k }, name: FOE_INFO[k].name, text: FOE_WORDS[k] }));
  return [
    {
      id: 'move',
      title: 'Move and aim',
      sections: [
        sec('Left thumb', ['Put your left thumb down on the left side.', 'Slide it to fly.'], { t: 'draw', id: 'moveStick' }),
        sec('Right thumb', ['Put your right thumb down on the right side.', 'Slide it to aim.', 'Your ship shoots by itself while you aim.'], {
          t: 'draw',
          id: 'aimStick',
        }),
        sec('Tip', ['Lift a thumb and the stick goes away.', 'Put it down again anywhere on that side.']),
      ],
    },
    {
      id: 'goal',
      title: 'Your goal',
      sections: [
        sec('Every level', ['Each level has one goal at the top.', 'Finish it before your lives run out.', 'Touching an enemy costs a life.'], {
          t: 'draw',
          id: 'goal',
        }),
        sec('Survive', ['Stay alive until the timer ends.'], undefined, [], { tone: GOAL_TONES.Survive }),
        sec('Destroy', ['Shoot the number of enemies shown.'], undefined, [], { tone: GOAL_TONES.Destroy }),
        sec('Score', ['Reach the target score before time runs out.'], undefined, [], { tone: GOAL_TONES.Score }),
        sec('Boss', ['On a boss level, survive until the boss arrives.', 'Then defeat it to win.'], undefined, [], { tone: GOAL_TONES.Boss }),
      ],
    },
    {
      id: 'bombs',
      title: 'Bombs and Super',
      sections: [
        sec('Bomb', ['Tap the round Bomb button on the right.', 'It wipes out every enemy on screen.', 'You only have a few. Save them.'], {
          t: 'reward',
          icon: 'bomb',
        }, [], { tone: BOMBS_TONES.Bomb }),
        sec('Super', ['Grab green geoms to fill the Super ring.', 'It sits just above the Bomb button.', 'When it is full, tap it.'], {
          t: 'draw',
          id: 'superRing',
        }, [], { tone: BOMBS_TONES.Super }),
        sec(
          'Kinds of Super',
          [
            `Homing: your shots chase enemies for ${SUPER_DURATION} seconds.`,
            `Turbo: shoot ${TURBO_SCALE} times as fast for ${TURBO_DURATION} seconds. Kills add time, up to ${TURBO_MAX_TOTAL}.`,
            'Detonate: your drone blows up enemies near it.',
          ],
          undefined,
          [],
          { leads: SUPER_COLOURS, tone: BOMBS_TONES['Kinds of Super'] },
        ),
        sec('When to use them', ['Bomb when you are trapped.', 'Super when lots of enemies come.'], undefined, [], { tone: BOMBS_TONES['When to use them'] }),
      ],
    },
    {
      id: 'weapons',
      title: 'Weapons',
      sections: [
        sec('Four weapons', [], undefined, weaponItems, { tone: WEAPONS_TONES['Four weapons'] }),
        sec('Pickups', ['Shoot enemies and a weapon drops.', 'Fly over it to grab it.', `It lasts ${WEAPON_DURATION} seconds.`, 'Lose a life and you go back to Spread.'], {
          t: 'shape',
          kind: 'weaponPickup',
        }, [], { tone: WEAPONS_TONES.Pickups }),
        sec('Super weapons', ['Grab a different weapon while you have one. They join!', ...combos], undefined, [], { tone: WEAPONS_TONES['Super weapons'] }),
      ],
    },
    {
      id: 'drones',
      title: 'Drones',
      sections: [
        sec(
          'Your drone',
          ['A drone helps you. Nothing can hurt it.'],
          { t: 'shape', kind: 'drone' },
          DRONE_KINDS.map((d): HowToItem => ({ icon: { t: 'shape', kind: 'drone' }, name: cap(d), text: DRONE_WORDS[d], colour: DRONE_COLOURS[d] })),
          { tone: DRONES_TONES['Your drone'] },
        ),
        sec(
          'Drone pickups',
          [`Grab one to power up your drone for ${DRONE_ARM_SEC} seconds.`, ...DRONE_MODES.map((m) => `${cap(m)}: ${DRONE_MODE_WORDS[m]}.`)],
          { t: 'shape', kind: 'dronePickup' },
          [],
          { leads: Object.fromEntries(DRONE_MODES.map((m) => [cap(m), DRONE_MODE_COLOURS[m]])), tone: DRONES_TONES['Drone pickups'] },
        ),
      ],
    },
    {
      id: 'enemies',
      title: 'Enemies',
      sections: FOE_GROUPS.map((g) => sec(g.heading, [], undefined, foeItems(g.type))).filter((s) => s.items.length > 0),
    },
    {
      id: 'hazards',
      title: 'Hazards',
      sections: [
        sec('Gravity wells', ['A well pulls you in. Touching it costs a life.', 'Shoot it to pop it.', 'Wait too long and snakes crawl out.'], {
          t: 'foe',
          kind: 'well',
        }, [], { tone: HAZARD_TONES['Gravity wells'] }),
        sec('Mines and slime', ['Sowers drop mines. Do not touch them.', 'Splimes drop slime. It slows you down.', 'A bomb clears both.'], {
          t: 'shape',
          kind: 'mine',
        }, [], { tone: HAZARD_TONES['Mines and slime'] }),
        sec('Membranes', ['Glowing bars block you and your shots.', 'Enemies squeeze through slowly.', 'They come out angry and fast.'], {
          t: 'draw',
          id: 'membrane',
        }, [], { tone: HAZARD_TONES.Membranes }),
        sec('Drums', ['On a drum level the floor flows.', 'Watch for the warning, then push back.'], { t: 'draw', id: 'drift' }, [], { tone: HAZARD_TONES.Drums }),
      ],
    },
    {
      id: 'stars',
      title: 'Stars, par and rewards',
      sections: [
        sec('Par', ['Par is the score to beat.', 'Reach par for 1 star.', '1.25 times par for 2.', '1.5 times par for 3.'], { t: 'draw', id: 'star' }),
        sec('Stars by difficulty', starCapLines(), { t: 'draw', id: 'star4' }, [], { leads: difficultyLeads() }),
        sec(
          'Rewards',
          ['Win and reach par to pick a reward for the next level:'],
          undefined,
          [
            { icon: { t: 'reward', icon: 'life' }, name: 'Life', text: 'One more life.', colour: REWARD_NAME_COLOURS.Life },
            { icon: { t: 'reward', icon: 'bomb' }, name: 'Bomb', text: 'One more bomb.', colour: REWARD_NAME_COLOURS.Bomb },
            { icon: { t: 'reward', icon: 'rapid' }, name: 'Weapon', text: 'Start with a weapon.', colour: REWARD_NAME_COLOURS.Weapon },
          ],
        ),
      ],
    },
    {
      id: 'modes',
      title: 'Difficulty and Free Play',
      sections: [
        sec('Difficulty', [...difficultyLines(), 'Pick it on the level start card before each level.'], undefined, [], { leads: difficultyLeads() }),
        sec('Free Play', ['Pick the arena, enemies, weapons and rules.', 'Play as long as you like.', 'No stars here, just fun.']),
        sec('Endless', ['Waves never stop.', 'Beat your high score.']),
      ],
    },
  ];
}

/** Pure: words in a string (tokens with a letter or digit; "+" and "=" do not count). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Pure: every word a section shows: heading, lines and each item's name and text. */
export function sectionText(s: HowToSection): string {
  return [s.heading, ...s.lines, ...s.items.flatMap((i) => [i.name, i.text])].join(' ');
}

/** Pure: the whole text of a page, title first. */
export function pageText(p: HowToPage): string {
  return [p.title, ...p.sections.map(sectionText)].join(' ');
}

/** Pure: page index after a turn, clamped to the pages. */
export function turnPage(page: number, delta: number, pages: number): number {
  return Math.max(0, Math.min(Math.max(1, pages) - 1, Math.floor(page) + Math.sign(delta)));
}

/** Pure: a swipe of dx CSS px: -1 (left, next page), 1 (right, back) or 0. Mostly vertical moves do not count. */
export function swipeDelta(dx: number, dy: number, min = SWIPE_PX): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy)) return 0;
  return dx < 0 ? -1 : 1;
}

// ---- Drawn icons -----------------------------------------------------------------------------

function starPts(cx: number, cy: number, r: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 === 0 ? r : r * 0.45;
    out.push(Math.round((cx + Math.cos(a) * k) * 1000) / 1000, Math.round((cy + Math.sin(a) * k) * 1000) / 1000);
  }
  return out;
}

/** A thumb pad over a stick knob: a rounded poly from the knob down to the bottom edge. */
function thumb(x: number): Stroke {
  return { t: 'poly', pts: [x - 0.1, 0.42, x + 0.1, 0.42, x + 0.16, 0.62, x + 0.12, 0.98, x - 0.16, 0.98, x - 0.16, 0.62], fill: false };
}

/** Pure: the strokes and colour of each drawn helper icon, in a unit box. */
export function drawStrokes(id: DrawId): { strokes: Stroke[]; colour: PaletteKey } {
  switch (id) {
    case 'moveStick':
      return {
        colour: 'cyan',
        strokes: [
          { t: 'circle', x: 0.5, y: 0.4, r: 0.32, fill: false },
          { t: 'circle', x: 0.5, y: 0.4, r: 0.1, fill: true },
          { t: 'line', x1: 0.5, y1: 0.02, x2: 0.5, y2: 0.12 },
          { t: 'line', x1: 0.08, y1: 0.4, x2: 0.16, y2: 0.4 },
          { t: 'line', x1: 0.84, y1: 0.4, x2: 0.92, y2: 0.4 },
          thumb(0.5),
        ],
      };
    case 'aimStick':
      return {
        colour: 'orange',
        strokes: [
          { t: 'circle', x: 0.5, y: 0.4, r: 0.32, fill: false },
          { t: 'circle', x: 0.66, y: 0.26, r: 0.1, fill: true },
          { t: 'line', x1: 0.74, y1: 0.18, x2: 0.92, y2: 0.02 },
          { t: 'line', x1: 0.82, y1: 0.02, x2: 0.92, y2: 0.02 },
          { t: 'line', x1: 0.92, y1: 0.02, x2: 0.92, y2: 0.12 },
          thumb(0.62),
        ],
      };
    case 'superRing':
      return {
        colour: 'homing',
        strokes: [
          { t: 'circle', x: 0.5, y: 0.5, r: 0.4, fill: false },
          { t: 'circle', x: 0.5, y: 0.5, r: 0.28, fill: false },
          { t: 'poly', pts: starPts(0.5, 0.5, 0.18), fill: true },
        ],
      };
    case 'membrane':
      return {
        colour: 'purple',
        strokes: [0.12, 0.32, 0.52, 0.72].flatMap((y): Stroke[] => [
          { t: 'line', x1: 0.42, y1: y, x2: 0.42, y2: y + 0.12 },
          { t: 'line', x1: 0.58, y1: y + 0.06, x2: 0.58, y2: y + 0.18 },
        ]),
      };
    case 'drift':
      return {
        colour: 'cyan',
        strokes: [0.25, 0.5, 0.75].flatMap((y): Stroke[] => [
          { t: 'line', x1: 0.12, y1: y, x2: 0.86, y2: y },
          { t: 'line', x1: 0.86, y1: y, x2: 0.72, y2: y - 0.1 },
          { t: 'line', x1: 0.86, y1: y, x2: 0.72, y2: y + 0.1 },
        ]),
      };
    case 'star':
      return { colour: 'yellow', strokes: [{ t: 'poly', pts: starPts(0.5, 0.52, 0.42), fill: false }] };
    case 'star4':
      return {
        colour: 'magenta',
        strokes: [
          { t: 'poly', pts: starPts(0.5, 0.52, 0.42), fill: false },
          { t: 'poly', pts: starPts(0.5, 0.52, 0.18), fill: true },
        ],
      };
    case 'goal':
      return {
        colour: 'green',
        strokes: [
          { t: 'circle', x: 0.5, y: 0.5, r: 0.4, fill: false },
          { t: 'circle', x: 0.5, y: 0.5, r: 0.24, fill: false },
          { t: 'circle', x: 0.5, y: 0.5, r: 0.08, fill: true },
        ],
      };
  }
}

const SHAPE_KIND = {
  ship: Kind.Ship,
  drone: Kind.Drone,
  dronePickup: Kind.DronePickup,
  geom: Kind.Geom,
  mine: Kind.Mine,
  slime: Kind.Slime,
  weaponPickup: Kind.WeaponPickup,
} as const;

/** Reward and weapon icons use the weapon colours; life and bomb keep the reward cyan. */
const REWARD_COLOUR: Readonly<Record<'life' | 'bomb' | BaseWeaponKind, PaletteKey>> = {
  life: 'cyan',
  bomb: 'bomb',
  spread: 'yellow',
  rapid: 'rapid',
  pierce: 'pierce',
  orbit: 'orbit',
};

/** Pure: a stable id for an icon, written to data-howto-icon. */
export function iconId(i: HowToIcon): string {
  switch (i.t) {
    case 'foe':
      return `foe:${i.kind}`;
    case 'shape':
      return `shape:${i.kind}`;
    case 'reward':
      return `reward:${i.icon}`;
    case 'draw':
      return `draw:${i.id}`;
  }
}

/** Edge: an icon on a small canvas. */
function iconEl(i: HowToIcon, px: number): HTMLCanvasElement {
  let c: HTMLCanvasElement;
  switch (i.t) {
    case 'foe':
      c = iconCanvas(i.kind, px);
      break;
    case 'shape':
      c = specCanvas(SHAPE_SPECS[SHAPE_KIND[i.kind]], px, 'sow-foe-icon');
      break;
    case 'reward':
      c = strokeCanvas(iconStrokes(i.icon), px, paletteCss(REWARD_COLOUR[i.icon]), 'sow-reward-icon');
      break;
    case 'draw': {
      const d = drawStrokes(i.id);
      c = strokeCanvas(d.strokes, px, paletteCss(d.colour), 'sow-reward-icon');
      break;
    }
  }
  c.classList.add('sow-howto-icon');
  c.setAttribute('data-howto-icon', iconId(i));
  return c;
}

// ---- Screen ----------------------------------------------------------------------------------

export interface HowToActions {
  close(): void;
}

export interface HowToScreen extends Screen {
  /** Open on page `page` (0 based, the first page by default). */
  open(page?: number): void;
  /** The page shown now, 0 based. */
  page(): number;
  /** Turn the page by -1 or 1 (the buttons and swipes call this). */
  turn(delta: number): void;
}

function sectionEl(s: HowToSection): HTMLDivElement {
  const box = el('div', 'sow-howto-section');
  const head = el('div', 'sow-howto-head');
  setVectorText(head, s.heading, { tone: s.tone ?? 'yellow' });
  const top = el('div', 'sow-howto-top');
  if (s.icon !== undefined) top.append(iconEl(s.icon, HOW_TO_ICON_PX));
  const lines = el('div', 'sow-howto-lines');
  for (const line of s.lines) {
    const lead = leadWord(line);
    const colour = s.leads?.[lead];
    if (colour === undefined) {
      lines.append(el('div', 'sow-howto-line', line));
      continue;
    }
    const row = el('div', 'sow-howto-line');
    const word = el('span', 'sow-howto-lead', lead);
    word.style.color = paletteCss(colour);
    word.setAttribute('data-howto-lead', lead);
    row.append(word, el('span', '', line.slice(lead.length)));
    lines.append(row);
  }
  top.append(lines);
  box.append(head, top);
  if (s.items.length > 0) {
    const list = el('div', 'sow-howto-items');
    for (const it of s.items) {
      const row = el('div', 'sow-howto-item');
      const words = el('div', 'sow-howto-words');
      const name = el('div', 'sow-howto-name', it.name);
      if (it.colour !== undefined) name.style.color = paletteCss(it.colour);
      words.append(name, el('div', 'sow-howto-text', it.text));
      row.append(iconEl(it.icon, HOW_TO_ITEM_PX), words);
      list.append(row);
    }
    box.append(list);
  }
  return box;
}

/** DOM edge: the How to card, opened from the main menu. */
export function createHowToScreen(parent: HTMLElement, actions: HowToActions): HowToScreen {
  const s = createScreen(parent);
  s.root.classList.add('sow-card-screen', 'sow-howto');
  const pages = howToPages();
  const card = el('div', 'sow-card sow-howto-card');
  const title = el('div', 'sow-title');
  const body = el('div', 'sow-howto-body');
  const dots = el('div', 'sow-howto-dots');
  dots.setAttribute('role', 'group');
  dots.setAttribute('aria-label', 'Pages');
  const dotEls = pages.map((p, i) => {
    const d = el('span', 'sow-howto-dot');
    d.setAttribute('aria-label', `Page ${i + 1}: ${p.title}`);
    dots.append(d);
    return d;
  });
  let page = 0;
  const back = button('Back', () => turn(-1));
  const next = button('Next', () => turn(1));
  const close = button('Close', () => actions.close());
  for (const b of [back, next, close]) b.classList.add('sow-big');
  const row = el('div', 'sow-row sow-howto-foot');
  row.append(back, next, close);
  card.append(title, body, dots, row);
  s.root.append(card);
  attachScrollbar(body, bus);

  function paint(): void {
    const p = pages[page];
    if (p === undefined) return;
    setVectorText(title, p.title);
    body.replaceChildren(...p.sections.map(sectionEl));
    body.setAttribute('data-page', p.id);
    if (typeof body.scrollTo === 'function') body.scrollTo(0, 0);
    dotEls.forEach((d, i) => d.classList.toggle('sow-on', i === page));
    back.style.visibility = page > 0 ? 'visible' : 'hidden';
    next.style.visibility = page < pages.length - 1 ? 'visible' : 'hidden';
  }

  function turn(delta: number): void {
    const to = turnPage(page, delta, pages.length);
    if (to === page) return;
    page = to;
    paint();
  }

  // Swipe: a horizontal finger move on the card turns the page. Vertical moves scroll the body.
  let startId = -1;
  let sx = 0;
  let sy = 0;
  card.addEventListener('pointerdown', (e) => {
    startId = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
  });
  card.addEventListener('pointerup', (e) => {
    if (e.pointerId !== startId) return;
    startId = -1;
    const d = swipeDelta(e.clientX - sx, e.clientY - sy);
    if (d !== 0) turn(-d);
  });
  card.addEventListener('pointercancel', () => {
    startId = -1;
  });

  paint();
  return {
    ...s,
    open(p = 0) {
      page = turnPage(Math.floor(p), 0, pages.length);
      paint();
      s.show();
    },
    page: () => page,
    turn,
  };
}
