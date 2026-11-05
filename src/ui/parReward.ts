// R2 par reward. A successful Adventure level whose final score reached par offers one reward for
// the next level start: an extra life, an extra bomb, or starting with a weapon (spread, rapid,
// pierce, orbit). The results screen shows the choice; main.ts stores it (core/settings
// savePendingBonus) and passes it to the next level as GameOptions.startBonus. One reward per level
// completion: the chooser locks after the first pick.
// Icons are drawn on small canvases from the pure stroke lists below; no image assets.
import type { StartBonus } from '../core/bonus';
import type { BaseWeaponKind } from '../core/events';
import { button, el } from './dom';
import type { LevelResult } from './flow';
import { setVectorText } from './vectorFont';

export const PAR_REACHED = 'Par reached';
export const REWARD_PROMPT = 'Choose a reward for the next level';
export const WEAPONS: readonly BaseWeaponKind[] = ['spread', 'rapid', 'pierce', 'orbit'];

/** Pure: true when this result earns the par reward. */
export function earnsParReward(r: Pick<LevelResult, 'mode' | 'success' | 'score' | 'par'>): boolean {
  return r.mode === 'adventure' && r.success && r.par > 0 && r.score >= r.par;
}

export type RewardIcon = 'life' | 'bomb' | BaseWeaponKind;

export interface RewardOption {
  readonly icon: RewardIcon;
  readonly word: string;
  readonly bonus: StartBonus;
}

/** Pure: the six buttons in order: Life, Bomb, then the four weapons. */
export function rewardOptions(): RewardOption[] {
  return [
    { icon: 'life', word: 'Life', bonus: { kind: 'life' } },
    { icon: 'bomb', word: 'Bomb', bonus: { kind: 'bomb' } },
    ...WEAPONS.map((w): RewardOption => ({ icon: w, word: title(w), bonus: { kind: 'weapon', weapon: w } })),
  ];
}

function title(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pure: "Extra life", "Extra bomb" or "Start with Pierce". */
export function bonusLabel(b: StartBonus): string {
  switch (b.kind) {
    case 'life':
      return 'Extra life';
    case 'bomb':
      return 'Extra bomb';
    case 'weapon':
      return `Start with ${title(b.weapon)}`;
  }
}

/** Pure: the line after a pick: "Extra life ready for level 7". */
export function rewardChosenLine(b: StartBonus, nextLevel: number): string {
  return `${bonusLabel(b)} ready for level ${Math.max(1, Math.floor(nextLevel))}`;
}

/** One stroke of an icon in a 0 to 1 box. */
export type Stroke =
  | { readonly t: 'line'; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
  | { readonly t: 'circle'; readonly x: number; readonly y: number; readonly r: number; readonly fill: boolean }
  | { readonly t: 'poly'; readonly pts: readonly number[]; readonly fill: boolean };

/** Pure: the strokes of each icon, in a unit box. */
export function iconStrokes(icon: RewardIcon): Stroke[] {
  switch (icon) {
    case 'life': // the ship: an arrowhead
      return [{ t: 'poly', pts: [0.5, 0.12, 0.84, 0.86, 0.5, 0.68, 0.16, 0.86], fill: false }];
    case 'bomb': // a ring with a filled core
      return [
        { t: 'circle', x: 0.5, y: 0.5, r: 0.36, fill: false },
        { t: 'circle', x: 0.5, y: 0.5, r: 0.16, fill: true },
      ];
    case 'spread': // three shots fanning out
      return [
        { t: 'line', x1: 0.5, y1: 0.88, x2: 0.5, y2: 0.12 },
        { t: 'line', x1: 0.5, y1: 0.88, x2: 0.16, y2: 0.2 },
        { t: 'line', x1: 0.5, y1: 0.88, x2: 0.84, y2: 0.2 },
      ];
    case 'rapid': // a column of quick shots
      return [0.2, 0.5, 0.8].map((y): Stroke => ({ t: 'circle', x: 0.5, y, r: 0.09, fill: true }));
    case 'pierce': // a long bolt through a bar
      return [
        { t: 'line', x1: 0.5, y1: 0.9, x2: 0.5, y2: 0.1 },
        { t: 'line', x1: 0.5, y1: 0.1, x2: 0.36, y2: 0.28 },
        { t: 'line', x1: 0.5, y1: 0.1, x2: 0.64, y2: 0.28 },
        { t: 'line', x1: 0.22, y1: 0.55, x2: 0.78, y2: 0.55 },
      ];
    case 'orbit': // a core with a satellite on its ring
      return [
        { t: 'circle', x: 0.5, y: 0.5, r: 0.12, fill: true },
        { t: 'circle', x: 0.5, y: 0.5, r: 0.34, fill: false },
        { t: 'circle', x: 0.84, y: 0.5, r: 0.08, fill: true },
      ];
  }
}

const ICON_PX = 36;
const ICON_COLOR = 'hsl(185, 95%, 70%)';

/** Edge: draw an icon on a small canvas. Silently blank where the 2D context is missing (tests). */
function iconCanvas(icon: RewardIcon): HTMLCanvasElement {
  const c = strokeCanvas(iconStrokes(icon), ICON_PX, ICON_COLOR, 'sow-reward-icon');
  c.setAttribute('data-icon', icon);
  return c;
}

/** Edge: unit box strokes on a small square canvas in one neon colour (also used by the How to guide). */
export function strokeCanvas(strokes: readonly Stroke[], px: number, colour: string, cls: string): HTMLCanvasElement {
  const c = el('canvas', cls);
  const dpr = Math.min(3, typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);
  c.width = Math.round(px * dpr);
  c.height = Math.round(px * dpr);
  c.style.width = `${px}px`;
  c.style.height = `${px}px`;
  c.setAttribute('aria-hidden', 'true');
  const ctx = typeof c.getContext === 'function' ? c.getContext('2d') : null;
  if (ctx === null) return c;
  const s = px * dpr;
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 2.5 * dpr;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = colour;
  ctx.shadowBlur = 6 * dpr;
  for (const k of strokes) {
    ctx.beginPath();
    if (k.t === 'line') {
      ctx.moveTo(k.x1 * s, k.y1 * s);
      ctx.lineTo(k.x2 * s, k.y2 * s);
      ctx.stroke();
    } else if (k.t === 'circle') {
      ctx.arc(k.x * s, k.y * s, k.r * s, 0, Math.PI * 2);
      if (k.fill) ctx.fill();
      else ctx.stroke();
    } else {
      for (let i = 0; i + 1 < k.pts.length; i += 2) {
        const x = (k.pts[i] ?? 0) * s;
        const y = (k.pts[i + 1] ?? 0) * s;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (k.fill) ctx.fill();
      else ctx.stroke();
    }
  }
  return c;
}

export interface RewardChooser {
  readonly root: HTMLDivElement;
  /** Show the chooser for a result, or hide it when the result does not earn the reward. */
  open(r: LevelResult): void;
  /** The reward picked for the result shown now, or null. */
  chosen(): StartBonus | null;
}

/**
 * DOM edge: "Par reached" with its flourish, then three groups: Extra life, Extra bomb, Start with a
 * weapon (four small buttons). `onPick` fires once per opened result; later taps are ignored.
 */
export function createRewardChooser(onPick: (b: StartBonus, nextLevel: number) => void): RewardChooser {
  const root = el('div', 'sow-reward');
  root.setAttribute('data-results', 'reward');
  const head = el('div', 'sow-par-reached');
  setVectorText(head, PAR_REACHED, { tone: 'yellow' });
  const prompt = el('div', 'sow-small', REWARD_PROMPT);
  const groups = el('div', 'sow-reward-groups');
  const opts = rewardOptions();
  const buttons: HTMLButtonElement[] = [];
  let picked: StartBonus | null = null;
  let next = 1;
  const paint = (): void => {
    opts.forEach((o, i) => {
      const b = buttons[i];
      if (b === undefined) return;
      const on = picked !== null && JSON.stringify(picked) === JSON.stringify(o.bonus);
      b.classList.toggle('sow-on', on);
      b.classList.toggle('sow-off', picked !== null && !on);
      b.setAttribute('aria-pressed', String(on));
    });
    prompt.textContent = picked === null ? REWARD_PROMPT : rewardChosenLine(picked, next);
  };
  const make = (o: RewardOption): HTMLButtonElement => {
    const b = button('', () => {
      if (picked !== null) return; // one reward per level completion
      picked = o.bonus;
      paint();
      onPick(o.bonus, next);
    });
    b.classList.add('sow-reward-btn');
    b.setAttribute('aria-label', bonusLabel(o.bonus));
    b.append(iconCanvas(o.icon), el('span', 'sow-reward-word', o.word));
    buttons.push(b);
    return b;
  };
  const group = (label: string, items: RewardOption[]): HTMLDivElement => {
    const g = el('div', 'sow-reward-group');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    const row = el('div', 'sow-reward-row');
    row.append(...items.map(make));
    g.append(row, el('div', 'sow-reward-label', label));
    return g;
  };
  groups.append(group('Extra life', opts.slice(0, 1)), group('Extra bomb', opts.slice(1, 2)), group('Start with a weapon', opts.slice(2)));
  root.append(head, prompt, groups);
  return {
    root,
    open(r) {
      picked = null;
      next = r.levelIndex + 1;
      paint();
      root.style.display = earnsParReward(r) ? '' : 'none';
    },
    chosen: () => picked,
  };
}
