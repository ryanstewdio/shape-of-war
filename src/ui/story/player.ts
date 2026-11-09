// Scene player (docs/19 "Panel spec for the builder"): a full screen DOM overlay with a code drawn
// canvas, the panel text below it and a large Skip button top right. Tap to complete a line, tap
// again to advance; Skip ends the whole scene. Touch only (pointer events). The opening's picker
// panel shows the call sign picker. The machine in run.ts decides everything; this file is the
// DOM and animation frame edge.
import { button, el } from '../dom';
import { suggestCallsign, sanitizeCallsign, isValidCallsign } from '../../story/callsign';
import { OPENING_ID } from '../../story/scenes';
import { drawPanel, drawTorusIcon } from './draw';
import { currentPanel, currentScene, panelLines, pickedRun, runOver, skipRun, startRun, tapRun, tickRun, type Step, type StoryEvent, type StoryRun } from './run';
import { injectStoryStyles } from './style';

export const SKIP_LABEL = 'Skip';
export const REROLL_LABEL = 'New name';
export const DONE_LABEL = 'Done';
export const TAP_HINT = 'Tap to continue';
export const PICKER_PROMPT = 'Your call sign';

export interface StoryDeps {
  /** 'ui:story' events, in order. */
  emit(e: StoryEvent): void;
  /** A scene ended (played through or skipped): mark it seen. */
  seen(id: string): void;
  loadCallsign(): string | null;
  saveCallsign(name: string): void;
  /** Fresh seed for a call sign suggestion (src/core/rng.ts freshSeed). */
  seed(): number;
  /** Animation frame scheduler; defaults to window.requestAnimationFrame. */
  raf?: (cb: (ms: number) => void) => void;
}

export interface StoryPlayer {
  readonly root: HTMLDivElement;
  /** Play scenes in order, then call onDone. Returns false (and calls nothing) when ids is empty. */
  play(ids: readonly string[], onDone: () => void): boolean;
  active(): boolean;
}

/** Pure: the call sign used in scene text: the stored one, else the current suggestion. */
export function callsignFor(stored: string | null, suggestion: string): string {
  return stored ?? suggestion;
}

export function createStoryPlayer(parent: HTMLElement, deps: StoryDeps): StoryPlayer {
  if (typeof document !== 'undefined') injectStoryStyles(document);
  const root = el('div', 'sow-story');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Story');
  const stage = el('div', 'sow-story-stage');
  const canvas = el('canvas', 'sow-story-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stage.append(canvas);
  const text = el('div', 'sow-story-text');
  text.setAttribute('aria-live', 'polite');
  const hint = el('div', 'sow-story-hint', '');
  const skip = button(SKIP_LABEL, () => apply(skipRun(run)));
  skip.classList.add('sow-story-skip');

  // Call sign picker: suggestion, reroll, optional typing (letters and digits, 3 to 10), Done.
  const picker = el('div', 'sow-story-picker');
  picker.addEventListener('pointerdown', (e) => e.stopPropagation());
  picker.addEventListener('pointerup', (e) => e.stopPropagation());
  const prompt = el('div', 'sow-small', PICKER_PROMPT);
  const nameEl = el('div', 'sow-story-name', '');
  const input = el('input', 'sow-input');
  input.type = 'text';
  input.maxLength = 10;
  input.autocomplete = 'off';
  input.placeholder = 'Or type one';
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('aria-label', 'Type a call sign, 3 to 10 letters or digits');
  const reroll = button(REROLL_LABEL, () => {
    rolls += 1;
    suggestion = suggestCallsign((baseSeed + rolls * 0x9e3779b1) >>> 0);
    input.value = '';
    paintPicker();
  });
  const done = button(DONE_LABEL, () => {
    const typed = sanitizeCallsign(input.value);
    if (typed !== '' && !isValidCallsign(typed)) return; // 1 or 2 characters: keep typing
    const name = typed === '' ? suggestion : typed;
    deps.saveCallsign(name);
    input.blur();
    apply(pickedRun(run));
  });
  input.addEventListener('input', () => {
    const clean = sanitizeCallsign(input.value);
    if (clean !== input.value) input.value = clean;
    paintPicker();
  });
  const row = el('div', 'sow-row');
  row.append(reroll, done);
  picker.append(prompt, nameEl, input, row);

  root.append(stage, text, picker, hint, skip);
  parent.append(root);

  let run: StoryRun = { ids: [], scene: 0, panel: 0, typed: 0, age: 0, picking: false };
  let onDone: (() => void) | null = null;
  let playing = false;
  let baseSeed = 0;
  let rolls = 0;
  let suggestion = 'NovaFox';
  let sceneT = 0;
  let lastMs = -1;
  let painted = '';
  const raf = deps.raf ?? ((cb: (ms: number) => void): void => void window.requestAnimationFrame(cb));
  const callsign = (): string => callsignFor(deps.loadCallsign(), suggestion);

  function paintPicker(): void {
    const typed = sanitizeCallsign(input.value);
    nameEl.textContent = typed === '' ? suggestion : typed;
    done.setAttribute('aria-disabled', String(typed !== '' && !isValidCallsign(typed)));
  }

  let armed = -1;
  root.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // keep overlay touches away from the canvas sticks
    armed = e.pointerId;
  });
  root.addEventListener('pointerup', (e) => {
    if (armed !== e.pointerId) return;
    armed = -1;
    apply(tapRun(run, callsign()));
  });

  function apply(step: Step): void {
    const before = run;
    run = step.run;
    for (const e of step.events) {
      if (e.phase === 'end') {
        // A skipped opening still names the pilot: keep the suggestion.
        if (e.id === OPENING_ID && deps.loadCallsign() === null) deps.saveCallsign(suggestion);
        deps.seen(e.id);
      }
      if (e.phase === 'start') sceneT = 0;
      deps.emit(e);
    }
    if (before.scene !== run.scene || before.panel !== run.panel) painted = '';
    if (runOver(run)) finish();
    else paint();
  }

  function finish(): void {
    if (!playing) return;
    playing = false;
    root.classList.remove('sow-open');
    picker.classList.remove('sow-open');
    const cb = onDone;
    onDone = null;
    cb?.();
  }

  function paintText(): void {
    const p = currentPanel(run);
    if (p === undefined) return;
    const lines = panelLines(p, callsign());
    let left = Math.floor(run.typed);
    const key = `${run.scene}:${run.panel}:${left}`;
    if (key === painted) return;
    painted = key;
    const nodes = lines.map((full, i) => {
      const who = p.lines[i]?.who ?? 'narrator';
      const line = el('div', `sow-story-line${who === 'narrator' ? '' : ` sow-${who}`}`);
      // The speaker stays in the data for screen readers; Torus shows his icon instead of the word.
      line.setAttribute('aria-label', who === 'torus' ? `Torus: ${full}` : who === 'vecta' ? `Vecta: ${full}` : full);
      if (who === 'torus') {
        const icon = el('canvas', 'sow-story-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('data-torus', '1');
        line.append(icon);
      }
      const shown = full.slice(0, Math.max(0, left));
      left -= full.length;
      line.append(el('span', '', shown));
      return line;
    });
    text.replaceChildren(...nodes);
  }

  function paint(): void {
    paintText();
    picker.classList.toggle('sow-open', run.picking);
    if (run.picking) paintPicker();
    const p = currentPanel(run);
    const typedOut = p !== undefined && run.typed >= panelLines(p, callsign()).reduce((s, l) => s + l.length, 0);
    hint.textContent = typedOut && !run.picking ? TAP_HINT : '';
  }

  function draw(): void {
    const sc = currentScene(run);
    const p = currentPanel(run);
    if (sc === undefined || p === undefined) return;
    const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (ctx === null) return;
    const w = Math.max(1, stage.clientWidth || 1);
    const h = Math.max(1, stage.clientHeight || 1);
    const dpr = Math.min(2, typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);
    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPanel(ctx, w, h, sc, p, sceneT, run.age, callsign());
    for (const c of Array.from(text.querySelectorAll('canvas[data-torus]'))) {
      if (!(c instanceof HTMLCanvasElement)) continue;
      const px = Math.max(16, Math.round(c.clientWidth || 24));
      if (c.width !== px * dpr) {
        c.width = px * dpr;
        c.height = px * dpr;
      }
      const ic = c.getContext('2d');
      if (ic === null) continue;
      ic.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTorusIcon(ic, px, sceneT);
    }
  }

  function frame(ms: number): void {
    if (!playing) return;
    const dt = lastMs < 0 ? 0 : Math.min(0.1, Math.max(0, (ms - lastMs) / 1000));
    lastMs = ms;
    sceneT += dt;
    const wasPicking = run.picking;
    run = tickRun(run, dt, callsign());
    if (run.picking && !wasPicking) {
      input.value = '';
    }
    paint();
    try {
      draw();
    } catch {
      // drawing is cosmetic; the text and buttons still work
    }
    raf(frame);
  }

  return {
    root,
    play(ids, cb) {
      if (ids.length === 0) return false;
      baseSeed = deps.seed() >>> 0;
      rolls = 0;
      suggestion = suggestCallsign(baseSeed);
      input.value = '';
      onDone = cb;
      playing = true;
      lastMs = -1;
      sceneT = 0;
      painted = '';
      root.classList.add('sow-open');
      apply(startRun(ids));
      if (playing) raf(frame);
      return true;
    },
    active: () => playing,
  };
}
