// Results screen (docs/01 section 10), redesigned in R2 and again in R3.
// R3 (Ryan, build a4d6be6): "Par needs to be organised and clarified better. The details after par
// are unlabelled and confusing. More padding and margin is needed." Top to bottom, every value with
// a label, blocks apart by at least 16 px in a card padded 20 px:
//   headline (Victory or Defeated; Game over in Endless and Free Play) and the title line;
//   Score block: the score, Par, a bar against the three star targets with a mark at each, the
//   targets as labelled columns, Stars earned (with the iridescent 4th for an Insane win) and the
//   difficulty cap ("Normal: max 2 stars");
//   Best; the boss bonus; small labelled details (Time, Seed, Level code, Space physics);
//   the par reward chooser when earned (ui/parReward.ts); two big buttons: Next or Retry, and Menu.
// Endless: score, high score badge, best, time and seed, no stars. Free Play: score and time only.
import type { StartBonus } from '../core/bonus';
import type { SpaceLevelSetting } from '../core/settings';
import { button, createScreen, el, type Screen } from './dom';
import type { LevelResult } from './flow';
import { formatClock, formatInt, starGlyphs } from './format';
import { fourthStarEl, hasFourthStar } from './fourthStar';
import { labelled, starCapLine, starTargets, type LabelledValue } from './intro';
import { createRewardChooser, earnsParReward } from './parReward';
import { difficultyLabel, SPACE_ROW_LABEL, spaceLabel } from './settings';

export interface ResultsActions {
  next(): void;
  retry(): void;
  menu(): void;
  /** R2: the par reward picked on this result, for the level after it. */
  reward?(bonus: StartBonus, nextLevel: number): void;
}

/** Pure: Endless badge text for a top 10 rank (1 based, 0 when outside the table). */
export function badgeText(r: LevelResult): string {
  if (r.mode !== 'endless') return '';
  const rank = r.rank ?? 0;
  if (rank === 1) return 'New high score';
  if (rank > 1) return `Top 10: #${rank}`;
  return '';
}

/** Pure: "Space physics: Medium", or '' when the level is off or unknown. */
export function physicsLine(level: SpaceLevelSetting | undefined): string {
  if (level === undefined || level === 'off') return '';
  return `${SPACE_ROW_LABEL}: ${spaceLabel(level)}`;
}

/** Pure: "Boss bonus: 1,000 (Warden defeated)" on a win where the boss died, '' otherwise (a loss, Endless, no boss). */
export function bossLine(r: LevelResult): string {
  if (r.mode !== 'adventure' || !r.success || r.bossBonus === undefined) return '';
  const who = r.bossName === undefined || r.bossName === '' ? 'boss' : r.bossName;
  return `Boss bonus: ${formatInt(r.bossBonus)} (${who} defeated)`;
}

/** Pure: score against par as a bar fill, 0 to 1 (full at par). 0 with no par. */
export function parFraction(r: Pick<LevelResult, 'score' | 'par'>): number {
  return r.par > 0 ? Math.max(0, Math.min(1, r.score / r.par)) : 0;
}

export interface ScoreBar {
  /** Fill, 0 to 1: score against the third star target (or par when the targets are unknown). */
  fill: number;
  /** Where each star target sits on the bar, 0 to 1. Empty without targets. */
  marks: number[];
}

/** Pure: the score bar against the three star targets; falls back to score against par. */
export function scoreBar(r: Pick<LevelResult, 'score' | 'par' | 'starTargets'>): ScoreBar {
  const t = r.starTargets;
  if (t === undefined || !(t[2] > 0)) return { fill: parFraction(r), marks: [] };
  const top = t[2];
  const f = (v: number): number => Math.max(0, Math.min(1, v / top));
  return { fill: f(r.score), marks: t.map(f) };
}

/** One star target column on the results: label, value and whether the score reached it. */
export interface TargetColumn extends LabelledValue {
  readonly hit: boolean;
}

export type PrimaryButton = 'next' | 'retry';

export const SCORE_LABEL = 'Score';
export const PAR_LABEL = 'Par';
export const STARS_EARNED_LABEL = 'Stars earned';
export const BEST_LABEL = 'Best';
export const TIME_LABEL = 'Time';
export const SEED_LABEL = 'Seed';
export const LEVEL_CODE_LABEL = 'Level code';

export interface ResultText {
  /** Headline: "Victory", "Defeated", or "Game over" in Endless and Free Play. */
  title: string;
  /** Title line: "Level 2  Circle arena", "Endless  Drum arena", "Free Play  Rectangle arena". */
  sub: string;
  /** The score value; its label is SCORE_LABEL. */
  score: string;
  /** "Par: 1,000", '' without par. */
  par: string;
  /** Bar fill for the score bar, 0 to 1. */
  parFill: number;
  /** Star target marks on the bar, 0 to 1. */
  parMarks: number[];
  /** True when the score bar shows. */
  showPar: boolean;
  /** The three star targets with a hit flag, [] without targets. */
  targets: TargetColumn[];
  /** Glyphs of the stars earned, '' when the mode has none. Label: STARS_EARNED_LABEL. */
  stars: string;
  /** R1: true when the iridescent 4th star shows after the three glyphs (an Insane win). */
  fourthStar: boolean;
  /** The difficulty cap on stars ("Normal: max 2 stars"), '' outside Adventure or without a difficulty. */
  starCap: string;
  /** "Difficulty: Hard" when the result names one, '' otherwise. */
  difficulty: string;
  /** "Best: 4,500  New best", '' in Free Play. */
  best: string;
  /** Labelled small print, one per line: Time, Seed, Level code. */
  detail: string;
  badge: string;
  /** Space physics line, '' when off. */
  physics: string;
  /** Boss line, '' when the level had no boss or it was not beaten. */
  boss: string;
  /** R2: the par reward shows. */
  parReached: boolean;
  /** R2: the big left button. */
  primary: PrimaryButton;
}

function subLine(head: string, r: LevelResult): string {
  return r.arena === undefined || r.arena === '' ? head : `${head}  ${r.arena} arena`;
}

function details(items: readonly (LabelledValue | null)[]): string {
  return items
    .filter((v): v is LabelledValue => v !== null && v.value !== '')
    .map(labelled)
    .join('\n');
}

/** Pure: the text lines shown for a result. */
export function resultLines(r: LevelResult): ResultText {
  const physics = physicsLine(r.space);
  const difficulty = r.difficulty === undefined ? '' : `Difficulty: ${difficultyLabel(r.difficulty)}`;
  const time = r.timeSec === undefined ? null : { label: TIME_LABEL, value: formatClock(r.timeSec) };
  const none = {
    par: '',
    parFill: 0,
    parMarks: [],
    showPar: false,
    targets: [],
    stars: '',
    fourthStar: false,
    starCap: '',
    boss: '',
    parReached: false,
    primary: 'retry' as const,
  };
  if (r.mode === 'freeplay') {
    return { ...none, title: 'Game over', sub: subLine('Free Play', r), score: formatInt(r.score), difficulty, best: '', detail: details([time]), badge: '', physics };
  }
  if (r.mode === 'endless') {
    return {
      ...none,
      title: 'Game over',
      sub: subLine('Endless', r),
      score: formatInt(r.score),
      difficulty,
      best: `${BEST_LABEL}: ${formatInt(r.best)}`,
      detail: details([time, { label: SEED_LABEL, value: String(r.seed ?? 0) }]),
      badge: badgeText(r),
      physics,
    };
  }
  const bar = scoreBar(r);
  const targets: TargetColumn[] = r.starTargets === undefined ? [] : starTargets(r.starTargets).map((v, i) => ({ ...v, hit: r.score >= (r.starTargets?.[i] ?? Infinity) }));
  return {
    title: r.success ? 'Victory' : 'Defeated',
    sub: subLine(`Level ${r.levelIndex}`, r),
    score: formatInt(r.score),
    par: r.par > 0 ? `${PAR_LABEL}: ${formatInt(r.par)}` : '',
    parFill: bar.fill,
    parMarks: bar.marks,
    showPar: r.par > 0 || targets.length > 0,
    targets,
    stars: starGlyphs(r.stars),
    fourthStar: hasFourthStar(r.stars),
    starCap: r.difficulty === undefined ? '' : starCapLine(r.difficulty),
    difficulty,
    best: `${BEST_LABEL}: ${formatInt(r.best)}${r.newBest ? '  New best' : ''}`,
    detail: details([{ label: LEVEL_CODE_LABEL, value: r.hash }]),
    badge: '',
    physics,
    boss: bossLine(r),
    parReached: earnsParReward(r),
    primary: r.success ? 'next' : 'retry',
  };
}

export const PRIMARY_LABEL: Readonly<Record<PrimaryButton, string>> = { next: 'Next', retry: 'Retry' };

export interface ResultsScreen extends Screen {
  showResult(r: LevelResult): void;
}

export function createResultsScreen(parent: HTMLElement, actions: ResultsActions): ResultsScreen {
  const s = createScreen(parent);
  s.root.classList.add('sow-card-screen');
  const card = el('div', 'sow-card sow-results');
  const headBox = el('div', 'sow-block');
  const title = el('div', 'sow-title');
  title.setAttribute('data-results', 'title');
  const sub = el('div', 'sow-card-line');
  sub.setAttribute('data-results', 'sub');
  const badge = el('div', 'sow-badge');
  headBox.append(title, sub, badge);
  // Score block.
  const scoreBox = el('div', 'sow-block');
  scoreBox.setAttribute('data-results', 'scoreBlock');
  const scoreLabel = el('div', 'sow-block-label', SCORE_LABEL);
  const score = el('div', 'sow-title sow-results-score');
  score.setAttribute('data-results', 'score');
  const parBox = el('div', 'sow-par');
  parBox.setAttribute('data-results', 'par');
  const parText = el('div', 'sow-kv');
  const parBar = el('div', 'sow-par-bar');
  const parFill = el('div', 'sow-par-fill');
  parBar.append(parFill);
  const cols = el('div', 'sow-cols');
  cols.setAttribute('data-results', 'targets');
  parBox.append(parText, parBar, cols);
  const starsEl = el('div', 'sow-kv sow-stars-earned');
  starsEl.setAttribute('data-results', 'stars');
  const glyphs = el('span', 'sow-v sow-stars');
  const star4 = fourthStarEl();
  starsEl.append(el('span', 'sow-k', `${STARS_EARNED_LABEL}: `), glyphs, star4);
  const cap = el('div', 'sow-small');
  cap.setAttribute('data-results', 'starCap');
  const diff = el('div', 'sow-small');
  diff.setAttribute('data-results', 'difficulty');
  scoreBox.append(scoreLabel, score, parBox, starsEl, cap, diff);
  // Best, boss and details.
  const best = el('div', 'sow-kv');
  best.setAttribute('data-results', 'best');
  const boss = el('div', 'sow-kv');
  boss.setAttribute('data-results', 'boss');
  const detail = el('div', 'sow-small');
  detail.setAttribute('data-results', 'detail');
  detail.style.whiteSpace = 'pre-line';
  const physics = el('div', 'sow-small');
  physics.setAttribute('data-results', 'physics');
  const reward = createRewardChooser((b, nextLevel) => actions.reward?.(b, nextLevel));
  const row = el('div', 'sow-row sow-results-buttons');
  let primaryKind: PrimaryButton = 'retry';
  const primary = button(PRIMARY_LABEL.retry, () => (primaryKind === 'next' ? actions.next() : actions.retry()));
  primary.classList.add('sow-big');
  primary.setAttribute('data-results', 'primary');
  const menu = button('Menu', actions.menu);
  menu.classList.add('sow-big');
  row.append(primary, menu);
  card.append(headBox, scoreBox, best, boss, detail, physics, reward.root, row);
  s.root.append(card);
  const showText = (e: HTMLElement, text: string): void => {
    e.textContent = text;
    e.style.display = text === '' ? 'none' : '';
  };
  return {
    ...s,
    showResult(r) {
      const t = resultLines(r);
      title.textContent = t.title;
      card.classList.toggle('sow-win', r.mode === 'adventure' && r.success);
      card.classList.toggle('sow-lose', r.mode === 'adventure' && !r.success);
      showText(sub, t.sub);
      showText(badge, t.badge);
      score.textContent = t.score;
      showText(parText, t.par);
      parFill.style.width = `${Math.round(t.parFill * 1000) / 10}%`;
      parBar.classList.toggle('sow-par-full', t.parFill >= 1);
      // A mark at the first and second star targets; the third is the bar's right end.
      parBar.replaceChildren(
        parFill,
        ...t.parMarks.slice(0, -1).map((at) => {
          const m = el('div', 'sow-par-mark');
          m.setAttribute('data-results', 'mark');
          m.style.left = `calc(${Math.round(at * 1000) / 10}% - 1px)`;
          return m;
        }),
      );
      cols.replaceChildren(
        ...t.targets.map((v) => {
          const col = el('div', v.hit ? 'sow-col sow-col-hit' : 'sow-col');
          col.append(el('div', 'sow-col-label', v.label), el('div', 'sow-col-value', v.value));
          return col;
        }),
      );
      cols.style.display = t.targets.length > 0 ? '' : 'none';
      parBox.style.display = t.showPar ? '' : 'none';
      glyphs.textContent = t.stars;
      star4.style.display = t.fourthStar ? '' : 'none';
      starsEl.style.display = t.stars === '' ? 'none' : '';
      starsEl.setAttribute('aria-label', `${STARS_EARNED_LABEL}: ${t.fourthStar ? '4 stars' : t.stars}`);
      showText(cap, t.starCap);
      // The cap line names the difficulty; the separate line shows only where there is no cap.
      showText(diff, t.starCap === '' ? t.difficulty : '');
      showText(best, t.best);
      showText(boss, t.boss);
      showText(detail, t.detail);
      showText(physics, t.physics);
      reward.open(r);
      primaryKind = t.primary;
      primary.textContent = PRIMARY_LABEL[t.primary];
      s.show();
    },
  };
}
