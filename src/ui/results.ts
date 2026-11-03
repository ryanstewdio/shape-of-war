// Results screen (docs/01 section 10), redesigned in R2 for clarity on the cover and main screens.
// Top to bottom: the outcome headline, the title line (level and arena), the score, score against
// par with a bar, the stars earned (with the iridescent 4th for an Insane win), the difficulty, the
// best, the boss line, the par reward chooser when earned (ui/parReward.ts), small detail lines,
// and two big buttons: Next (a won Adventure level) or Retry, and Menu.
// Endless: score, high score badge, best, time and the endless seed, no stars.
// Free Play (R2): score and time only; no stars, no best, no par.
// The Space physics line shows the level in effect when the run ended, omitted when Off (docs/11
// SPEC 3.6). A win on a boss level shows "Boss defeated, bonus N" (docs/13 SPEC 3.6 rule 6).
import type { StartBonus } from '../core/bonus';
import type { SpaceLevelSetting } from '../core/settings';
import { button, createScreen, el, type Screen } from './dom';
import type { LevelResult } from './flow';
import { formatClock, formatInt, starGlyphs } from './format';
import { fourthStarEl, hasFourthStar } from './fourthStar';
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

/** Pure: "Boss defeated, bonus 1,000" for a win where the boss died, '' otherwise (a loss, Endless, no boss). */
export function bossLine(r: LevelResult): string {
  if (r.mode !== 'adventure' || !r.success || r.bossBonus === undefined) return '';
  return `Boss defeated, bonus ${formatInt(r.bossBonus)}`;
}

/** Pure: score against par as a bar fill, 0 to 1 (full at par). 0 with no par. */
export function parFraction(r: Pick<LevelResult, 'score' | 'par'>): number {
  return r.par > 0 ? Math.max(0, Math.min(1, r.score / r.par)) : 0;
}

export type PrimaryButton = 'next' | 'retry';

export interface ResultText {
  /** Outcome headline: "Level 2 complete", "Level 2 failed", "Game over", "Free Play over". */
  title: string;
  /** Title line under the headline: the arena ("Circle arena"), '' when unknown. */
  sub: string;
  score: string;
  /** "Score 4,500 / Par 1,000", '' without par. */
  par: string;
  /** Bar fill for score against par, 0 to 1. */
  parFill: number;
  /** True when the par bar shows. */
  showPar: boolean;
  stars: string;
  /** R1: true when the iridescent 4th star shows after the three glyphs (an Insane win). */
  fourthStar: boolean;
  /** "Difficulty: Hard" when the result names one, '' otherwise. */
  difficulty: string;
  /** "Best 4,500  New best", '' in Free Play. */
  best: string;
  /** Small print: level hash, Endless seed, or the run time. */
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

function arenaSub(r: LevelResult): string {
  return r.arena === undefined || r.arena === '' ? '' : `${r.arena} arena`;
}

/** Pure: the text lines shown for a result. */
export function resultLines(r: LevelResult): ResultText {
  const physics = physicsLine(r.space);
  const difficulty = r.difficulty === undefined ? '' : `Difficulty: ${difficultyLabel(r.difficulty)}`;
  const time = r.timeSec === undefined ? '' : `Time ${formatClock(r.timeSec)}`;
  const none = { par: '', parFill: 0, showPar: false, stars: '', fourthStar: false, boss: '', parReached: false, primary: 'retry' as const };
  if (r.mode === 'freeplay') {
    return { ...none, title: 'Free Play over', sub: arenaSub(r), score: formatInt(r.score), difficulty, best: '', detail: time, badge: '', physics };
  }
  if (r.mode === 'endless') {
    return {
      ...none,
      title: 'Game over',
      sub: arenaSub(r),
      score: formatInt(r.score),
      difficulty,
      best: `Best ${formatInt(r.best)}`,
      detail: [time, `Endless seed ${r.seed ?? 0}`].filter((t) => t !== '').join('\n'),
      badge: badgeText(r),
      physics,
    };
  }
  return {
    title: r.success ? `Level ${r.levelIndex} complete` : `Level ${r.levelIndex} failed`,
    sub: arenaSub(r),
    score: formatInt(r.score),
    par: `Score ${formatInt(r.score)} / Par ${formatInt(r.par)}`,
    parFill: parFraction(r),
    showPar: r.par > 0,
    stars: starGlyphs(r.stars),
    fourthStar: hasFourthStar(r.stars),
    difficulty,
    best: `Best ${formatInt(r.best)}${r.newBest ? '  New best' : ''}`,
    detail: `Level #${r.hash}`,
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
  const title = el('div', 'sow-title');
  title.setAttribute('data-results', 'title');
  const sub = el('div', 'sow-small');
  const score = el('div', 'sow-title sow-results-score');
  const badge = el('div', 'sow-badge');
  const parBox = el('div', 'sow-par');
  parBox.setAttribute('data-results', 'par');
  const parText = el('div', 'sow-card-line');
  const parBar = el('div', 'sow-par-bar');
  const parFill = el('div', 'sow-par-fill');
  parBar.append(parFill);
  parBox.append(parText, parBar);
  const starsEl = el('div', 'sow-stars');
  starsEl.setAttribute('data-results', 'stars');
  const glyphs = el('span', '');
  const star4 = fourthStarEl();
  starsEl.append(glyphs, star4);
  const diff = el('div', 'sow-small');
  diff.setAttribute('data-results', 'difficulty');
  const best = el('div', 'sow-card-line');
  best.setAttribute('data-results', 'best');
  const boss = el('div', 'sow-card-line');
  boss.setAttribute('data-results', 'boss');
  const reward = createRewardChooser((b, nextLevel) => actions.reward?.(b, nextLevel));
  const detail = el('div', 'sow-small');
  detail.style.whiteSpace = 'pre-line';
  const physics = el('div', 'sow-small');
  physics.setAttribute('data-results', 'physics');
  const row = el('div', 'sow-row sow-results-buttons');
  let primaryKind: PrimaryButton = 'retry';
  const primary = button(PRIMARY_LABEL.retry, () => (primaryKind === 'next' ? actions.next() : actions.retry()));
  primary.classList.add('sow-big');
  primary.setAttribute('data-results', 'primary');
  const menu = button('Menu', actions.menu);
  menu.classList.add('sow-big');
  row.append(primary, menu);
  card.append(title, sub, score, badge, parBox, starsEl, diff, best, boss, reward.root, detail, physics, row);
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
      score.textContent = t.score;
      showText(badge, t.badge);
      parText.textContent = t.par;
      parFill.style.width = `${Math.round(t.parFill * 1000) / 10}%`;
      parBar.classList.toggle('sow-par-full', t.parFill >= 1);
      parBox.style.display = t.showPar ? '' : 'none';
      glyphs.textContent = t.stars;
      star4.style.display = t.fourthStar ? '' : 'none';
      starsEl.style.display = t.stars === '' ? 'none' : '';
      starsEl.setAttribute('aria-label', t.fourthStar ? '4 stars' : t.stars);
      showText(diff, t.difficulty);
      showText(best, t.best);
      showText(boss, t.boss);
      reward.open(r);
      showText(detail, t.detail);
      showText(physics, t.physics);
      primaryKind = t.primary;
      primary.textContent = PRIMARY_LABEL[t.primary];
      s.show();
    },
  };
}
