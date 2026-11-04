// Results screen (docs/01 section 10), redesigned in R2, R3 and again in R5.
// R5 (Ryan, build 64a20eb, results 2 of 5): "still not every value labelled, not enough padding".
// One column, blocks 24 px apart in a card padded 24 px, every value labelled, top to bottom:
//   (1) the outcome headline (Victory or Defeated; Game over in Endless and Free Play), the level
//       and arena line and the difficulty under it;
//   (2) Score: the big score, a labelled "Par 3.3M" row, a bar with three labelled star ticks and
//       the score marker, Stars earned (with the iridescent 4th for an Insane win) and the cap
//       ("Normal: up to 2 stars");
//   (3) Best with its stars;
//   (4) the par reward chooser when earned (ui/parReward.ts);
//   (5) two big buttons: Next or Retry, and Menu;
//   then a collapsed Details row (ui/details.ts): Time, Kills, Geoms, Best multiplier, Boss bonus,
//   Space physics, Seed, Level code, Build, each labelled ("Seed 42", "Kills 412", "Time 3:31").
// Endless: score, high score badge and Best, no stars. Free Play: score only.
// R6 (Ryan, gate R5, results 3.75): the difficulty is a chip with the setting alone ("Easy"), no
// "Difficulty" label; the Details toggle looks like Next and Menu (ui/details.ts). Par and the star
// targets arrive already scaled by the run's difficulty (main.ts, core/stars.ts targetsFor).
import type { StartBonus } from '../core/bonus';
import type { SpaceLevelSetting } from '../core/settings';
import { createDetails, inline, shownItems } from './details';
import { button, createScreen, el, type Screen } from './dom';
import type { LevelResult } from './flow';
import { formatClock, formatCompact, formatInt, starGlyphs } from './format';
import { fourthStarEl, hasFourthStar } from './fourthStar';
import { starCapLine, type LabelledValue } from './intro';
import { createRewardChooser, earnsParReward } from './parReward';
import { difficultyLabel, SPACE_ROW_LABEL, spaceLabel } from './settings';

export interface ResultsActions {
  next(): void;
  retry(): void;
  menu(): void;
  /** R2: the par reward picked on this result, for the level after it. */
  reward?(bonus: StartBonus, nextLevel: number): void;
}

export const SCORE_LABEL = 'Score';
export const PAR_LABEL = 'Par';
export const STARS_EARNED_LABEL = 'Stars earned';
export const BEST_LABEL = 'Best';
export const NEW_BEST_TEXT = 'New best';
export const TIME_LABEL = 'Time';
export const KILLS_LABEL = 'Kills';
export const GEOMS_LABEL = 'Geoms';
export const MULTIPLIER_LABEL = 'Best multiplier';
export const BOSS_LABEL = 'Boss bonus';
export const SEED_LABEL = 'Seed';
export const LEVEL_CODE_LABEL = 'Level code';
export const BUILD_LABEL = 'Build';
export const SCORE_MARKER_LABEL = 'Your score';

/** Where the third star target sits on the score bar, so a score past it still shows. */
export const BAR_THIRD_AT = 0.85;

/** Pure: Endless badge text for a top 10 rank (1 based, 0 when outside the table). */
export function badgeText(r: LevelResult): string {
  if (r.mode !== 'endless') return '';
  const rank = r.rank ?? 0;
  if (rank === 1) return 'New high score';
  if (rank > 1) return `Top 10: #${rank}`;
  return '';
}

/** Pure: the Space physics detail, or null when the level is off or unknown. */
export function physicsItem(level: SpaceLevelSetting | undefined): LabelledValue | null {
  if (level === undefined || level === 'off') return null;
  return { label: SPACE_ROW_LABEL, value: spaceLabel(level) };
}

/** Pure: "Space physics Medium", or '' when the level is off or unknown. */
export function physicsLine(level: SpaceLevelSetting | undefined): string {
  const v = physicsItem(level);
  return v === null ? '' : inline(v);
}

/** Pure: the boss bonus detail on a win where the boss died, null otherwise (a loss, Endless, no boss). */
export function bossItem(r: LevelResult): LabelledValue | null {
  if (r.mode !== 'adventure' || !r.success || r.bossBonus === undefined) return null;
  const who = r.bossName === undefined || r.bossName === '' ? 'boss' : r.bossName;
  return { label: BOSS_LABEL, value: `${formatInt(r.bossBonus)} (${who} defeated)` };
}

/** Pure: "Boss bonus 1,000 (Warden defeated)", or ''. */
export function bossLine(r: LevelResult): string {
  const v = bossItem(r);
  return v === null ? '' : inline(v);
}

/** Pure: score against par as a fraction, 0 to 1 (full at par). 0 with no par. */
export function parFraction(r: Pick<LevelResult, 'score' | 'par'>): number {
  return r.par > 0 ? Math.max(0, Math.min(1, r.score / r.par)) : 0;
}

/** One star target on the bar. */
export interface BarTick {
  /** Position on the bar, 0 to 1. */
  readonly at: number;
  /** "1 star", "2 stars", "3 stars". */
  readonly label: string;
  /** The target, short ("2.1M"). */
  readonly value: string;
  /** The score reached it. */
  readonly hit: boolean;
}

export interface ScoreBar {
  /** Fill and score marker position, 0 to 1. */
  fill: number;
  /** The three star targets, [] without targets. */
  ticks: BarTick[];
}

/** Pure: "1 star", "2 stars", "3 stars". */
export function starWord(n: number): string {
  return n === 1 ? '1 star' : `${n} stars`;
}

/** Pure: the short tick caption over a target ("2★"). Its full label is starWord. */
export function tickCaption(n: number): string {
  return `${n}★`;
}

/**
 * Pure: the score bar. With targets the third sits at BAR_THIRD_AT and the others in proportion;
 * without them the bar is score against par.
 */
export function scoreBar(r: Pick<LevelResult, 'score' | 'par' | 'starTargets'>): ScoreBar {
  const t = r.starTargets;
  if (t === undefined || !(t[2] > 0)) return { fill: parFraction(r), ticks: [] };
  const top = t[2] / BAR_THIRD_AT;
  const f = (v: number): number => Math.max(0, Math.min(1, v / top));
  return {
    fill: f(r.score),
    ticks: t.map((v, i) => ({ at: f(v), label: starWord(i + 1), value: formatCompact(v), hit: r.score >= v })),
  };
}

export type PrimaryButton = 'next' | 'retry';

export interface ResultText {
  /** Headline: "Victory", "Defeated", or "Game over" in Endless and Free Play ("Time up" for a finished score attack). */
  title: string;
  /** "Level 2  Circle arena", "Endless  Drum arena", "Free Play  Rectangle arena". */
  sub: string;
  /** The difficulty chip text alone ("Normal"), '' when the result names none. */
  difficulty: string;
  /** Endless rank badge, ''. */
  badge: string;
  /** The score value; its label is SCORE_LABEL. */
  score: string;
  /** "Par 3.3M", '' without par. */
  par: string;
  bar: ScoreBar;
  /** True when the score bar shows. */
  showBar: boolean;
  /** Glyphs of the stars earned, '' when the mode has none. Label: STARS_EARNED_LABEL. */
  stars: string;
  /** R1: the iridescent 4th star shows after the three glyphs (an Insane win). */
  fourthStar: boolean;
  /** "Normal: up to 2 stars", '' outside Adventure or without a difficulty. */
  starCap: string;
  /** Best score, '' in Free Play. Label: BEST_LABEL. */
  best: string;
  /** Glyphs of the stars stored with the best, '' when none are known. */
  bestStars: string;
  newBest: boolean;
  /** Everything else, labelled, for the collapsed Details row. */
  details: LabelledValue[];
  /** R2: the par reward shows. */
  parReached: boolean;
  /** R2: the big left button. */
  primary: PrimaryButton;
}

/** Pure: "Score attack 5:00" for a timed Free Play length in seconds. */
export function scoreAttackLabel(sec: number): string {
  return `Score attack ${formatClock(sec)}`;
}

function subLine(head: string, r: LevelResult): string {
  return r.arena === undefined || r.arena === '' ? head : `${head}  ${r.arena} arena`;
}

const num = (label: string, v: number | undefined): LabelledValue | null => (v === undefined ? null : { label, value: formatInt(v) });

/** Pure: the Details items for a result, in screen order; missing values are left out. */
export function detailItems(r: LevelResult): LabelledValue[] {
  const seed = r.seed === undefined ? null : { label: SEED_LABEL, value: `${r.seed >>> 0}${r.typedSeed === true ? ' (typed)' : ''}` };
  return shownItems([
    r.timeSec === undefined ? null : { label: TIME_LABEL, value: formatClock(r.timeSec) },
    num(KILLS_LABEL, r.kills),
    num(GEOMS_LABEL, r.geoms),
    r.peakMultiplier === undefined ? null : { label: MULTIPLIER_LABEL, value: `x${formatInt(r.peakMultiplier)}` },
    bossItem(r),
    physicsItem(r.space),
    seed,
    { label: LEVEL_CODE_LABEL, value: r.hash },
    { label: BUILD_LABEL, value: r.build ?? '' },
  ]);
}

/** Pure: the text shown for a result. */
export function resultLines(r: LevelResult): ResultText {
  const difficulty = r.difficulty === undefined ? '' : difficultyLabel(r.difficulty);
  const none = {
    difficulty,
    badge: '',
    score: formatInt(r.score),
    par: '',
    bar: { fill: 0, ticks: [] },
    showBar: false,
    stars: '',
    fourthStar: false,
    starCap: '',
    best: '',
    bestStars: '',
    newBest: false,
    details: detailItems(r),
    parReached: false,
    primary: 'retry' as const,
  };
  if (r.mode === 'freeplay') {
    // Free Play options: a timed run reads "Score attack 5:00"; running the clock out is "Time up".
    const timed = r.scoreAttackSec === undefined ? null : scoreAttackLabel(r.scoreAttackSec);
    const head = timed === null ? 'Free Play' : `Free Play  ${timed}`;
    return { ...none, title: timed !== null && r.success ? 'Time up' : 'Game over', sub: subLine(head, r) };
  }
  if (r.mode === 'endless') {
    return { ...none, title: 'Game over', sub: subLine('Endless', r), badge: badgeText(r), best: formatInt(r.best), newBest: r.rank === 1 };
  }
  const bar = scoreBar(r);
  return {
    ...none,
    title: r.success ? 'Victory' : 'Defeated',
    sub: subLine(`Level ${r.levelIndex}`, r),
    par: r.par > 0 ? `${PAR_LABEL} ${formatCompact(r.par)}` : '',
    bar,
    showBar: r.par > 0 || bar.ticks.length > 0,
    stars: starGlyphs(r.stars),
    fourthStar: hasFourthStar(r.stars),
    starCap: r.difficulty === undefined ? '' : starCapLine(r.difficulty),
    best: formatInt(r.best),
    bestStars: r.bestStars === undefined ? '' : starGlyphs(r.bestStars),
    newBest: r.newBest,
    parReached: earnsParReward(r),
    primary: r.success ? 'next' : 'retry',
  };
}

export const PRIMARY_LABEL: Readonly<Record<PrimaryButton, string>> = { next: 'Next', retry: 'Retry' };

export interface ResultsScreen extends Screen {
  showResult(r: LevelResult): void;
}

const pct = (f: number): string => `${Math.round(f * 1000) / 10}%`;

export function createResultsScreen(parent: HTMLElement, actions: ResultsActions): ResultsScreen {
  const s = createScreen(parent);
  s.root.classList.add('sow-card-screen');
  const card = el('div', 'sow-card sow-results');
  // (1) Headline.
  const headBox = el('div', 'sow-block sow-results-head');
  headBox.setAttribute('data-results', 'head');
  const title = el('div', 'sow-title');
  title.setAttribute('data-results', 'title');
  const sub = el('div', 'sow-card-line');
  sub.setAttribute('data-results', 'sub');
  const diff = el('div', 'sow-diff-chip');
  diff.setAttribute('data-results', 'difficulty');
  const badge = el('div', 'sow-badge');
  badge.setAttribute('data-results', 'badge');
  headBox.append(title, sub, diff, badge);
  // (2) Score block.
  const scoreBox = el('div', 'sow-block');
  scoreBox.setAttribute('data-results', 'scoreBlock');
  const scoreLabel = el('div', 'sow-block-label', SCORE_LABEL);
  const score = el('div', 'sow-title sow-results-score');
  score.setAttribute('data-results', 'score');
  const par = el('div', 'sow-kv');
  par.setAttribute('data-results', 'par');
  const barBox = el('div', 'sow-sbar');
  barBox.setAttribute('data-results', 'bar');
  const track = el('div', 'sow-sbar-track');
  const fill = el('div', 'sow-par-fill');
  const marker = el('div', 'sow-sbar-marker');
  marker.setAttribute('data-results', 'marker');
  marker.setAttribute('aria-label', SCORE_MARKER_LABEL);
  const tickLabels = el('div', 'sow-sbar-labels');
  barBox.append(track, tickLabels);
  const starsEl = el('div', 'sow-kv sow-stars-earned');
  starsEl.setAttribute('data-results', 'stars');
  const glyphs = el('span', 'sow-v sow-stars');
  const star4 = fourthStarEl();
  starsEl.append(el('span', 'sow-k', STARS_EARNED_LABEL), glyphs, star4);
  const cap = el('div', 'sow-small');
  cap.setAttribute('data-results', 'starCap');
  scoreBox.append(scoreLabel, score, par, barBox, starsEl, cap);
  // (3) Best.
  const best = el('div', 'sow-kv sow-results-best');
  best.setAttribute('data-results', 'best');
  // (4) Par reward, (5) buttons.
  const reward = createRewardChooser((b, nextLevel) => actions.reward?.(b, nextLevel));
  const row = el('div', 'sow-row sow-results-buttons');
  row.setAttribute('data-results', 'buttons');
  let primaryKind: PrimaryButton = 'retry';
  const primary = button(PRIMARY_LABEL.retry, () => (primaryKind === 'next' ? actions.next() : actions.retry()));
  primary.classList.add('sow-big');
  primary.setAttribute('data-results', 'primary');
  const menu = button('Menu', actions.menu);
  menu.classList.add('sow-big');
  row.append(primary, menu);
  const details = createDetails('data-results');
  card.append(headBox, scoreBox, best, reward.root, row, details.root);
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
      showText(diff, t.difficulty);
      diff.classList.toggle('sow-diff-insane', r.difficulty === 'insane');
      showText(badge, t.badge);
      score.textContent = t.score;
      par.replaceChildren();
      if (t.par !== '') par.append(el('span', 'sow-k', PAR_LABEL), el('span', 'sow-v', t.par.slice(PAR_LABEL.length + 1)));
      par.style.display = t.par === '' ? 'none' : '';
      fill.style.width = pct(t.bar.fill);
      track.classList.toggle('sow-par-full', t.bar.ticks.length > 0 ? t.bar.ticks.every((k) => k.hit) : t.bar.fill >= 1);
      marker.style.left = pct(t.bar.fill);
      track.replaceChildren(
        fill,
        ...t.bar.ticks.map((k) => {
          const m = el('div', k.hit ? 'sow-sbar-tick sow-hit' : 'sow-sbar-tick');
          m.setAttribute('data-results', 'tick');
          m.style.left = pct(k.at);
          return m;
        }),
        marker,
      );
      tickLabels.replaceChildren(
        ...t.bar.ticks.map((k, i) => {
          const lab = el('div', k.hit ? 'sow-sbar-label sow-hit' : 'sow-sbar-label');
          lab.setAttribute('data-results', 'tickLabel');
          lab.setAttribute('aria-label', `${k.label} ${k.value}`);
          lab.style.left = pct(Math.max(0.08, Math.min(0.92, k.at)));
          lab.append(el('div', 'sow-sbar-cap', tickCaption(i + 1)), el('div', 'sow-sbar-val', k.value));
          return lab;
        }),
      );
      tickLabels.style.display = t.bar.ticks.length > 0 ? '' : 'none';
      barBox.style.display = t.showBar ? '' : 'none';
      glyphs.textContent = t.stars;
      star4.style.display = t.fourthStar ? '' : 'none';
      starsEl.style.display = t.stars === '' ? 'none' : '';
      starsEl.setAttribute('aria-label', `${STARS_EARNED_LABEL} ${t.fourthStar ? '4 stars' : t.stars}`);
      showText(cap, t.starCap);
      best.replaceChildren();
      if (t.best !== '') {
        best.append(el('span', 'sow-k', BEST_LABEL), el('span', 'sow-v', t.best));
        if (t.bestStars !== '') best.append(el('span', 'sow-v sow-stars sow-best-stars', t.bestStars));
        if (t.newBest) best.append(el('span', 'sow-tag', NEW_BEST_TEXT));
      }
      best.style.display = t.best === '' ? 'none' : '';
      details.fill(t.details);
      reward.open(r);
      primaryKind = t.primary;
      primary.textContent = PRIMARY_LABEL[t.primary];
      s.show();
    },
  };
}

