// R2 Free Play: a main menu item that opens this options screen. Free Play options (docs/14):
// sections Difficulty, Arena (type, size, barriers), Enemies (a toggle grid of every kind with its
// neon icon, density, All and None), Rules (lives, run length), Loadout (starting weapon, pickups,
// drone, super) and Hazards (bosses, wells, drum drift shown only for the drum). The sections
// scroll inside the card; Start and Back sit below them and stay on screen. Start builds the run
// with freePlayLevel and createEndlessGame (ui/freePlayRun.ts). The last setup persists under
// sow.settings.freePlay (core/settings.ts); difficulty stays the card's last choice.
import type { Difficulty } from '../core/difficulty';
import { DIFFICULTIES } from '../core/difficulty';
import type { BaseWeaponKind } from '../core/events';
import type {
  FreePlayBosses,
  FreePlayConfig,
  FreePlayDensity,
  FreePlayDrift,
  FreePlayLength,
  FreePlayLives,
  FreePlaySize,
  FreePlayWells,
} from '../core/freeplayConfig';
import { DEFAULT_FREE_PLAY_SETUP, FREE_PLAY_ENEMY_KINDS } from '../core/settings';
import type { FreePlayArena } from '../levelgen/freeplay';
import { BOSS_IDS, type DroneKind, type EnemyKind, type SuperKind } from '../levelgen/leveldef';
import { bossName } from './boss';
import { button, createScreen, el, type Screen } from './dom';
import { FOE_INFO, iconCanvas } from './enemyIntro';
import { scoreAttackLabel } from './results';
import { DIFFICULTY_ROW_LABEL, difficultyLabel } from './settings';
import { setVectorText } from './vectorFont';

export const FREE_PLAY_TITLE = 'Free Play';
export const ARENA_ROW_LABEL = 'Arena';
export const BARRIERS_ROW_LABEL = 'Barriers';
export const SIZE_ROW_LABEL = 'Size';
export const ENEMIES_ROW_LABEL = 'Enemies';
export const DENSITY_ROW_LABEL = 'Density';
export const LIVES_ROW_LABEL = 'Lives';
export const LENGTH_ROW_LABEL = 'Length';
export const WEAPON_ROW_LABEL = 'Weapon';
export const PICKUPS_ROW_LABEL = 'Pickups';
export const DRONE_ROW_LABEL = 'Drone';
export const SUPER_ROW_LABEL = 'Super';
export const BOSSES_ROW_LABEL = 'Bosses';
export const WELLS_ROW_LABEL = 'Wells';
export const DRIFT_ROW_LABEL = 'Drum drift';
export const ENEMIES_NONE_NOTE = 'None picked plays every enemy (the normal Endless mix).';

export const FREE_PLAY_ARENAS: readonly FreePlayArena[] = ['rect', 'circle', 'drum'];
export const FREE_PLAY_SIZES: readonly FreePlaySize[] = ['small', 'medium', 'large'];
export const FREE_PLAY_DENSITIES: readonly FreePlayDensity[] = ['low', 'normal', 'swarm'];
export const FREE_PLAY_LIVES: readonly FreePlayLives[] = [1, 3, 5, 'infinite'];
export const FREE_PLAY_LENGTHS: readonly FreePlayLength[] = ['endless', 180, 300, 600];
export const FREE_PLAY_WEAPONS: readonly (BaseWeaponKind | null)[] = [null, 'spread', 'rapid', 'pierce', 'orbit'];
export const FREE_PLAY_DRONES: readonly DroneKind[] = ['attack', 'collect', 'ram'];
export const FREE_PLAY_SUPERS: readonly SuperKind[] = ['homing', 'detonate', 'turbo'];
export const FREE_PLAY_BOSSES: readonly FreePlayBosses[] = ['off', 'every3', ...BOSS_IDS];
export const FREE_PLAY_WELLS: readonly FreePlayWells[] = ['off', 'normal', 'many'];
export const FREE_PLAY_DRIFTS: readonly FreePlayDrift[] = ['off', 'low', 'high'];

export interface FreePlayChoice {
  readonly difficulty: Difficulty;
  readonly arena: FreePlayArena;
  readonly barriers: boolean;
  readonly config: FreePlayConfig;
}

export const DEFAULT_FREE_PLAY: FreePlayChoice = { difficulty: 'normal', ...DEFAULT_FREE_PLAY_SETUP };

const ARENA_LABELS: Readonly<Record<FreePlayArena, string>> = { rect: 'Rectangle', circle: 'Circle', drum: 'Drum' };

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pure: the label on one arena button. */
export function arenaLabel(a: FreePlayArena): string {
  return ARENA_LABELS[a];
}

/** Pure: the text on an on or off button (barriers, pickups). */
export function barriersLabel(on: boolean): string {
  return on ? 'On' : 'Off';
}

/** Pure: Small, Medium, Large; Low, Normal, Swarm; Off, Normal, Many; Off, Low, High. */
export function wordLabel(v: FreePlaySize | FreePlayDensity | FreePlayWells | FreePlayDrift): string {
  return cap(v);
}

/** Pure: 1, 3, 5 or the infinity sign. */
export function livesLabel(v: FreePlayLives): string {
  return v === 'infinite' ? '∞' : String(v);
}

/** Pure: Endless, or the timed length as minutes ("3 min"). */
export function lengthLabel(v: FreePlayLength): string {
  return v === 'endless' ? 'Endless' : `${v / 60} min`;
}

/** Pure: None or the base weapon's name. */
export function weaponLabel(v: BaseWeaponKind | null): string {
  return v === null ? 'None' : cap(v);
}

/** Pure: Attack, Collect, Ram; Homing, Detonate, Turbo. */
export function kindLabel(v: DroneKind | SuperKind): string {
  return cap(v);
}

/** Pure: Off, Every 3 min, or the chosen boss's name. */
export function bossesLabel(v: FreePlayBosses): string {
  if (v === 'off') return 'Off';
  if (v === 'every3') return 'Every 3 min';
  return bossName(v);
}

/** Pure: an enemy kind's name on its toggle. */
export function enemyLabel(k: EnemyKind): string {
  return FOE_INFO[k].name;
}

/** Pure: the enemy list with `k` switched on or off, in screen order. */
export function toggleEnemy(list: readonly EnemyKind[], k: EnemyKind): EnemyKind[] {
  const on = list.includes(k);
  return FREE_PLAY_ENEMY_KINDS.filter((e) => (e === k ? !on : list.includes(e)));
}

/** Pure: "Score attack 5:00" for a timed run, else null. */
export function timedLabel(length: FreePlayLength): string | null {
  return length === 'endless' ? null : scoreAttackLabel(length);
}

/** Pure: one line summary, also the Start button's accessible name. */
export function freePlaySummary(c: FreePlayChoice): string {
  const len = timedLabel(c.config.length) ?? 'Endless';
  return `${difficultyLabel(c.difficulty)}, ${arenaLabel(c.arena)} arena, barriers ${c.barriers ? 'on' : 'off'}, ${len}`;
}

export interface FreePlayActions {
  start(choice: FreePlayChoice): void;
  back(): void;
}

export interface FreePlayScreen extends Screen {
  /** Open with this choice marked (main.ts passes the last one, with the last card difficulty). */
  open(choice: FreePlayChoice): void;
  current(): FreePlayChoice;
}

interface Row<T> {
  readonly row: HTMLDivElement;
  mark(v: T): void;
}

function choiceRow<T>(label: string, values: readonly T[], text: (v: T) => string, pick: (v: T) => void, wrap = false): Row<T> {
  const row = el('div', 'sow-choice');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', label);
  const buttons = values.map((v) => button(text(v), () => pick(v)));
  const btns = el('div', wrap ? 'sow-choice-btns sow-fp-wrap' : 'sow-choice-btns');
  btns.append(...buttons);
  row.append(el('div', 'sow-choice-label', label), btns);
  return {
    row,
    mark(cur) {
      values.forEach((v, i) => {
        const b = buttons[i];
        if (b === undefined) return;
        b.classList.toggle('sow-on', v === cur);
        b.setAttribute('aria-pressed', String(v === cur));
      });
    },
  };
}

function section(title: string, ...rows: HTMLElement[]): HTMLDivElement {
  const s = el('div', 'sow-fp-section');
  s.append(el('div', 'sow-fp-head', title), ...rows);
  return s;
}

/** The enemy toggle grid: one button per kind with its neon icon and name, plus All and None. */
function enemyGrid(pick: (list: readonly EnemyKind[] | ((cur: readonly EnemyKind[]) => EnemyKind[])) => void): Row<readonly EnemyKind[]> {
  const row = el('div', 'sow-fp-enemies');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', ENEMIES_ROW_LABEL);
  const grid = el('div', 'sow-fp-grid');
  const toggles = FREE_PLAY_ENEMY_KINDS.map((k) => {
    const b = button('', () => pick((cur) => toggleEnemy(cur, k)));
    b.classList.add('sow-fp-foe');
    b.setAttribute('aria-label', enemyLabel(k));
    b.setAttribute('data-kind', k);
    b.append(iconCanvas(k, 26), el('span', 'sow-fp-foe-name', enemyLabel(k)));
    return b;
  });
  grid.append(...toggles);
  const all = button('All', () => pick([...FREE_PLAY_ENEMY_KINDS]));
  const none = button('None', () => pick([]));
  const shortcuts = el('div', 'sow-choice-btns');
  shortcuts.append(all, none);
  const note = el('div', 'sow-small sow-fp-note', ENEMIES_NONE_NOTE);
  row.append(grid, shortcuts, note);
  return {
    row,
    mark(cur) {
      FREE_PLAY_ENEMY_KINDS.forEach((k, i) => {
        const b = toggles[i];
        if (b === undefined) return;
        const on = cur.includes(k);
        b.classList.toggle('sow-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      note.style.display = cur.length === 0 ? '' : 'none';
    },
  };
}

export function createFreePlayScreen(parent: HTMLElement, actions: FreePlayActions): FreePlayScreen {
  const s = createScreen(parent);
  s.root.classList.add('sow-card-screen');
  const card = el('div', 'sow-card sow-fp-card');
  const title = el('div', 'sow-title');
  setVectorText(title, FREE_PLAY_TITLE);
  const note = el('div', 'sow-small', 'Endless waves on your rules. No stars, no bests.');
  let choice: FreePlayChoice = DEFAULT_FREE_PLAY;
  const set = (patch: Partial<Omit<FreePlayChoice, 'config'>>): void => {
    choice = { ...choice, ...patch };
    paint();
  };
  const setCfg = (patch: Partial<FreePlayConfig>): void => {
    choice = { ...choice, config: { ...choice.config, ...patch } };
    paint();
  };
  const diff = choiceRow(DIFFICULTY_ROW_LABEL, DIFFICULTIES, difficultyLabel, (d) => set({ difficulty: d }));
  const arena = choiceRow(ARENA_ROW_LABEL, FREE_PLAY_ARENAS, arenaLabel, (a) => set({ arena: a }));
  const size = choiceRow(SIZE_ROW_LABEL, FREE_PLAY_SIZES, wordLabel, (v) => setCfg({ size: v }));
  const barriers = choiceRow(BARRIERS_ROW_LABEL, [true, false], barriersLabel, (b) => set({ barriers: b }));
  const enemies = enemyGrid((v) => setCfg({ enemies: typeof v === 'function' ? v(choice.config.enemies) : v }));
  const density = choiceRow(DENSITY_ROW_LABEL, FREE_PLAY_DENSITIES, wordLabel, (v) => setCfg({ density: v }));
  const lives = choiceRow(LIVES_ROW_LABEL, FREE_PLAY_LIVES, livesLabel, (v) => setCfg({ lives: v }));
  const length = choiceRow(LENGTH_ROW_LABEL, FREE_PLAY_LENGTHS, lengthLabel, (v) => setCfg({ length: v }));
  const weapon = choiceRow(WEAPON_ROW_LABEL, FREE_PLAY_WEAPONS, weaponLabel, (v) => setCfg({ weapon: v }), true);
  const pickups = choiceRow(PICKUPS_ROW_LABEL, [true, false], barriersLabel, (v) => setCfg({ pickups: v }));
  const drone = choiceRow(DRONE_ROW_LABEL, FREE_PLAY_DRONES, kindLabel, (v) => setCfg({ drone: v }));
  const superRow = choiceRow(SUPER_ROW_LABEL, FREE_PLAY_SUPERS, kindLabel, (v) => setCfg({ superType: v }));
  const bosses = choiceRow(BOSSES_ROW_LABEL, FREE_PLAY_BOSSES, bossesLabel, (v) => setCfg({ bosses: v }), true);
  const wells = choiceRow(WELLS_ROW_LABEL, FREE_PLAY_WELLS, wordLabel, (v) => setCfg({ wells: v }));
  const drift = choiceRow(DRIFT_ROW_LABEL, FREE_PLAY_DRIFTS, wordLabel, (v) => setCfg({ drift: v }));
  const start = button('Start', () => actions.start(choice));
  start.classList.add('sow-big');
  setVectorText(start, 'Start', { tone: 'white' });
  const back = button('Back', actions.back);
  back.classList.add('sow-big');
  function paint(): void {
    const c = choice.config;
    diff.mark(choice.difficulty);
    arena.mark(choice.arena);
    size.mark(c.size);
    barriers.mark(choice.barriers);
    enemies.mark(c.enemies);
    density.mark(c.density);
    lives.mark(c.lives);
    length.mark(c.length);
    weapon.mark(c.weapon);
    pickups.mark(c.pickups);
    drone.mark(c.drone);
    superRow.mark(c.superType);
    bosses.mark(c.bosses);
    wells.mark(c.wells);
    drift.mark(c.drift);
    drift.row.style.display = choice.arena === 'drum' ? '' : 'none';
    start.setAttribute('aria-label', `Start: ${freePlaySummary(choice)}`);
  }
  const body = el('div', 'sow-fp-body');
  body.append(
    note,
    section('Difficulty', diff.row),
    section('Arena', arena.row, size.row, barriers.row),
    section('Enemies', enemies.row, density.row),
    section('Rules', lives.row, length.row),
    section('Loadout', weapon.row, pickups.row, drone.row, superRow.row),
    section('Hazards', bosses.row, wells.row, drift.row),
  );
  const row = el('div', 'sow-row sow-fp-foot');
  row.append(start, back);
  card.append(title, body, row);
  s.root.append(card);
  paint();
  return {
    ...s,
    open(c) {
      choice = c;
      paint();
      s.show();
    },
    current: () => choice,
  };
}
