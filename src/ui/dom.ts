// DOM helpers shared by the UI screens (docs/03 section 1: DOM overlays above the canvas).
// Touch only: buttons activate on pointerup after a pointerdown on the same element.

const STYLE_ID = 'sow-ui-style';

/** Smallest touch target height in CSS px for any button row (docs/01 section 10, v2 addendum). */
export const MIN_HIT_PX = 44;

/** The shared stylesheet text, exported so tests can check the touch target rules without a DOM. */
export const UI_CSS = `
.sow-ui { position: fixed; inset: 0; z-index: 20; pointer-events: none;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: hsl(190, 60%, 90%); user-select: none; -webkit-user-select: none; touch-action: none; }
.sow-screen { position: absolute; inset: 0; pointer-events: auto; display: none;
  flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  background: rgba(2, 4, 12, 0.72);
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
    env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); box-sizing: border-box; }
.sow-screen.sow-open { display: flex; }
.sow-title { font-size: clamp(28px, 7vmin, 64px); font-weight: 700; letter-spacing: 0.06em;
  color: hsl(185, 90%, 70%); text-shadow: 0 0 8px hsl(185, 90%, 55%), 0 0 22px hsl(185, 90%, 45%); margin: 0 0 8px; }
.sow-sub { font-size: 16px; opacity: 0.85; text-align: center; white-space: pre-line; }
.sow-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.sow-btn { font: inherit; font-size: 18px; min-width: 160px; min-height: 52px; padding: 10px 20px;
  color: hsl(190, 60%, 92%); background: rgba(10, 30, 50, 0.85); border: 2px solid hsl(185, 90%, 55%);
  border-radius: 10px; box-shadow: 0 0 10px hsla(185, 90%, 55%, 0.5); touch-action: none; }
.sow-btn:active { background: rgba(20, 60, 90, 0.95); }
.sow-stars { font-size: 34px; letter-spacing: 6px; color: hsl(55, 95%, 62%); text-shadow: 0 0 10px hsl(55, 95%, 50%); }
.sow-screen.sow-see { background: transparent; align-items: flex-start; justify-content: center; }
.sow-panel { display: flex; flex-direction: column; gap: 6px; box-sizing: border-box;
  width: min(440px, 48vw); max-height: 100%; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
  padding: 10px 14px; margin-left: 8px; background: rgba(2, 4, 12, 0.66); border: 1px solid hsla(185, 90%, 55%, 0.45);
  border-radius: 12px; }
.sow-panel .sow-title { font-size: clamp(20px, 5vmin, 34px); margin: 0; }
.sow-panel .sow-btn { min-width: 0; min-height: ${MIN_HIT_PX}px; font-size: 16px; padding: 6px 12px; flex: 1 1 0; }
.sow-panel .sow-row { flex-wrap: nowrap; gap: 8px; }
.sow-choice { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.sow-choice-label { flex: 0 0 auto; font-size: 15px; white-space: nowrap; }
.sow-choice-btns { display: flex; flex: 1 1 240px; gap: 6px; }
.sow-choice .sow-btn { min-width: 0; min-height: ${MIN_HIT_PX}px; font-size: 14px; padding: 6px 4px; flex: 1 1 0; }
.sow-btn.sow-on { background: hsl(185, 90%, 28%); border-color: hsl(185, 100%, 78%); color: #fff; font-weight: 700;
  box-shadow: 0 0 16px hsl(185, 90%, 60%); }
.sow-slider { display: flex; align-items: center; gap: 12px; min-height: ${MIN_HIT_PX}px; touch-action: none; }
.sow-slider-label { min-width: 92px; font-size: 16px; }
.sow-slider-track { position: relative; flex: 1; height: 8px; border-radius: 4px; background: hsla(190, 60%, 90%, 0.2); }
.sow-slider-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: hsl(185, 90%, 55%);
  box-shadow: 0 0 8px hsl(185, 90%, 55%); }
.sow-slider-knob { position: absolute; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%;
  background: hsl(190, 60%, 95%); box-shadow: 0 0 10px hsl(185, 90%, 60%); }
.sow-input { font: inherit; font-size: 16px; min-height: 44px; box-sizing: border-box; padding: 6px 10px; flex: 1 1 0; min-width: 0;
  color: hsl(190, 60%, 92%); background: rgba(10, 30, 50, 0.85); border: 2px solid hsla(185, 90%, 55%, 0.6);
  border-radius: 10px; user-select: text; -webkit-user-select: text; touch-action: manipulation; }
.sow-small { font-size: 13px; opacity: 0.7; }
.sow-badge { font-size: 18px; font-weight: 700; padding: 4px 14px; border-radius: 999px; color: hsl(55, 95%, 70%);
  border: 2px solid hsl(55, 95%, 60%); box-shadow: 0 0 12px hsl(55, 95%, 50%); }
.sow-grid { display: grid; grid-template-columns: repeat(6, minmax(64px, 1fr)); gap: 8px; }
.sow-grid .sow-btn { min-width: 0; min-height: 56px; font-size: 16px; padding: 4px; line-height: 1.2; white-space: pre-line; }
.sow-hud { position: absolute; inset: 0; pointer-events: none; display: none; }
.sow-hud.sow-open { display: block; }
.sow-hud-item { position: absolute; white-space: pre; text-shadow: 0 0 6px hsla(190, 80%, 60%, 0.8); }
.sow-hud-bar { position: absolute; border: 1px solid hsla(190, 60%, 90%, 0.6); border-radius: 3px; overflow: hidden; }
.sow-hud-fill { height: 100%; width: 0; background: hsl(95, 100%, 60%); box-shadow: 0 0 8px hsl(95, 100%, 55%); }
.sow-hud-star { position: absolute; left: 0; bottom: 0; height: 3px; width: 0; background: hsl(55, 95%, 62%);
  box-shadow: 0 0 6px hsl(55, 95%, 55%); }
.sow-hud-tick { position: absolute; bottom: 0; width: 2px; height: 6px; margin-left: -1px; background: hsl(55, 95%, 80%); }
.sow-hud-ring { position: absolute; border-radius: 50%; border: 2px solid hsla(190, 60%, 90%, 0.55);
  display: flex; align-items: center; justify-content: center; box-sizing: border-box; font-size: 16px; }
.sow-hud-item[data-note]:not([data-note=""])::after { content: attr(data-note); margin-left: 0.4em;
  font-size: 0.75em; font-weight: 500; letter-spacing: 0.02em; color: hsl(190, 60%, 92%); }
.sow-screen.sow-menu { background: rgba(2, 4, 12, 0.38); }
.sow-menu-panel { display: grid; box-sizing: border-box; align-items: center; justify-items: stretch;
  background: rgba(2, 6, 16, 0.78); border: 2px solid hsl(185, 95%, 62%); border-radius: 14px;
  outline: 2px solid hsla(300, 90%, 66%, 0.75); outline-offset: 5px;
  box-shadow: 0 0 14px hsla(185, 95%, 55%, 0.65), inset 0 0 18px hsla(185, 95%, 55%, 0.22),
    0 0 26px hsla(300, 90%, 60%, 0.35); }
.sow-menu-panel .sow-title { margin: 0; text-align: center; white-space: nowrap; }
.sow-menu-rows { display: flex; flex-direction: column; }
.sow-btn.sow-menu-row { min-width: 0; width: 100%; padding: 0 16px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; background: rgba(6, 22, 40, 0.82); border: 2px solid hsl(185, 90%, 58%);
  border-radius: 6px; box-shadow: 0 0 10px hsla(185, 90%, 55%, 0.55), inset 0 0 8px hsla(185, 90%, 55%, 0.25);
  text-shadow: 0 0 6px hsla(185, 90%, 60%, 0.8); opacity: 0; animation: sow-row-in 260ms ease-out forwards; }
.sow-btn.sow-menu-row.sow-focus { border-color: hsl(28, 100%, 62%); color: hsl(36, 100%, 88%);
  box-shadow: 0 0 14px hsla(28, 100%, 58%, 0.8), inset 0 0 10px hsla(28, 100%, 58%, 0.35);
  text-shadow: 0 0 8px hsla(28, 100%, 60%, 0.9); }
.sow-menu-info { text-align: center; opacity: 0.85; white-space: pre-line; }
.sow-menu-foot { text-align: center; opacity: 0.55; letter-spacing: 0.06em;
  border-top: 1px solid hsla(185, 90%, 60%, 0.35); padding-top: 4px; }
@keyframes sow-row-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .sow-btn.sow-menu-row { animation: none; opacity: 1; } }
.sow-card-screen { gap: 0; }
.sow-card { display: flex; flex-direction: column; align-items: center; gap: 8px; box-sizing: border-box;
  width: min(560px, 100%); max-height: 100%; overflow-y: auto; overscroll-behavior: contain; padding: 14px 18px;
  background: rgba(2, 6, 16, 0.8); border: 2px solid hsl(185, 95%, 62%); border-radius: 14px; text-align: center;
  box-shadow: 0 0 14px hsla(185, 95%, 55%, 0.55), inset 0 0 18px hsla(185, 95%, 55%, 0.2); }
.sow-card .sow-title { font-size: clamp(22px, 5.5vmin, 44px); margin: 0; }
.sow-card.sow-card-bare { background: transparent; border-color: transparent; box-shadow: none; }
.sow-card.sow-win { border-color: hsl(95, 100%, 62%); box-shadow: 0 0 18px hsla(95, 100%, 55%, 0.6), inset 0 0 18px hsla(95, 100%, 55%, 0.2); }
.sow-card.sow-lose { border-color: hsl(350, 95%, 62%); box-shadow: 0 0 18px hsla(350, 95%, 55%, 0.55), inset 0 0 18px hsla(350, 95%, 55%, 0.18); }
.sow-card-line { font-size: clamp(15px, 3.4vmin, 20px); opacity: 0.92; }
.sow-card .sow-stars { font-size: clamp(20px, 5vmin, 34px); }
.sow-card-stars { font-size: clamp(14px, 3.4vmin, 20px) !important; letter-spacing: 1px; }
.sow-chips { display: flex; gap: 8px; width: 100%; }
.sow-btn.sow-chip { flex: 1 1 0; min-width: 0; min-height: ${MIN_HIT_PX}px; padding: 4px; font-size: 15px; border-radius: 999px; }
.sow-btn.sow-chip-insane.sow-on { border-color: hsl(300, 95%, 72%); background: hsl(300, 70%, 28%); box-shadow: 0 0 16px hsl(300, 90%, 60%); }
.sow-btn.sow-big { min-width: 0; flex: 1 1 0; min-height: 56px; font-size: 20px; font-weight: 700; letter-spacing: 0.06em; }
.sow-card .sow-row { width: 100%; flex-wrap: nowrap; }
.sow-card .sow-choice { width: 100%; }
.sow-card.sow-intro, .sow-card.sow-results { padding: 20px; gap: 16px; }
.sow-block { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sow-block-label { font-size: 12px; letter-spacing: 0.1em; opacity: 0.65; }
.sow-block-body { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sow-play { gap: 10px; }
.sow-play .sow-btn.sow-big { flex: 0 0 auto; width: 100%; }
.sow-kv { font-size: clamp(14px, 3.2vmin, 18px); line-height: 1.35; }
.sow-k { opacity: 0.7; }
.sow-v { font-weight: 600; }
.sow-goal { font-weight: 700; }
.sow-cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; width: 100%; }
.sow-col { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px;
  border: 1px solid hsla(55, 95%, 62%, 0.4); border-radius: 8px; }
.sow-col.sow-col-hit { border-color: hsl(55, 95%, 62%); box-shadow: 0 0 8px hsla(55, 95%, 55%, 0.5); }
.sow-col-label { font-size: 12px; opacity: 0.75; }
.sow-col-value { font-size: clamp(16px, 3.8vmin, 22px); font-weight: 700; color: hsl(55, 95%, 70%); }
.sow-foe { display: flex; align-items: center; gap: 10px; width: 100%; max-width: 360px; }
.sow-foe-icon { flex: 0 0 auto; }
.sow-foe-name { flex: 1 1 auto; text-align: left; font-weight: 600; }
.sow-foe-type { font-size: 13px; opacity: 0.75; }
.sow-seed { font-size: 12px; opacity: 0.55; }
.sow-par-mark { position: absolute; top: 0; bottom: 0; width: 2px; background: hsla(55, 95%, 70%, 0.9); }
.sow-results-score { font-size: clamp(26px, 7vmin, 56px) !important; }
.sow-par { width: 100%; display: flex; flex-direction: column; gap: 4px; }
.sow-par-bar { position: relative; height: 10px; border-radius: 5px; overflow: hidden; border: 1px solid hsla(190, 60%, 90%, 0.6); }
.sow-par-fill { height: 100%; width: 0; background: hsl(185, 90%, 55%); box-shadow: 0 0 8px hsl(185, 90%, 55%); }
.sow-par-bar.sow-par-full .sow-par-fill { background: hsl(55, 95%, 62%); box-shadow: 0 0 10px hsl(55, 95%, 55%); }
.sow-reward { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; }
.sow-par-reached { font-size: clamp(20px, 5vmin, 34px); font-weight: 800; letter-spacing: 0.08em; color: hsl(55, 95%, 72%);
  text-shadow: 0 0 10px hsl(55, 95%, 55%), 0 0 26px hsl(300, 90%, 60%); animation: sow-flourish 900ms ease-out both; }
@keyframes sow-flourish { 0% { opacity: 0; transform: scale(0.6); letter-spacing: 0.5em; }
  60% { opacity: 1; transform: scale(1.12); } 100% { transform: none; letter-spacing: 0.08em; } }
@media (prefers-reduced-motion: reduce) { .sow-par-reached { animation: none; } }
.sow-reward-groups { display: flex; gap: 10px; width: 100%; justify-content: center; flex-wrap: wrap; }
.sow-reward-group { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.sow-reward-row { display: flex; gap: 6px; }
.sow-reward-label { font-size: 12px; opacity: 0.75; }
.sow-btn.sow-reward-btn { min-width: 0; min-height: 60px; width: 62px; padding: 4px 2px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px; font-size: 12px; }
.sow-btn.sow-reward-btn.sow-off { opacity: 0.35; }
.sow-reward-word { font-size: 12px; line-height: 1; }
.sow-screen.sow-splash { z-index: 30; }
.sow-splash-title { font-size: clamp(34px, 10vmin, 84px); white-space: nowrap; opacity: 0.4;
  animation: sow-splash-pulse 1200ms ease-in-out forwards; }
@keyframes sow-splash-pulse {
  0% { opacity: 0.4; text-shadow: 0 0 4px hsl(185, 90%, 55%), 0 0 10px hsl(185, 90%, 45%); }
  50% { opacity: 1; text-shadow: 0 0 14px hsl(185, 95%, 60%), 0 0 40px hsl(185, 95%, 50%), 0 0 70px hsl(300, 90%, 60%); }
  100% { opacity: 0.9; text-shadow: 0 0 8px hsl(185, 90%, 55%), 0 0 22px hsl(185, 90%, 45%); } }
@media (prefers-reduced-motion: reduce) { .sow-splash-title { animation: none; opacity: 1; } }
`;

/** Insert the shared stylesheet once. */
export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID) !== null) return;
  const s = doc.createElement('style');
  s.id = STYLE_ID;
  s.textContent = UI_CSS;
  doc.head.append(s);
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls !== '') e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let tapSound: (() => void) | null = null;

/**
 * B12: called once per completed button tap, before the button's own handler. main.ts sets it to
 * the uiTap cue (rate limited in ui/cueFlow.ts). Pass null to clear.
 */
export function setTapSound(fn: (() => void) | null): void {
  tapSound = fn;
}

function playTapSound(): void {
  if (tapSound === null) return;
  try {
    tapSound();
  } catch {
    // audio is optional; the tap still acts
  }
}

/** A touch button: fires on pointerup when the press started on it. */
export function button(label: string, onTap: () => void): HTMLButtonElement {
  const b = el('button', 'sow-btn', label);
  b.type = 'button';
  let armed = -1;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    armed = e.pointerId;
  });
  b.addEventListener('pointerup', (e) => {
    e.preventDefault();
    if (armed !== e.pointerId) return;
    armed = -1;
    playTapSound();
    onTap();
  });
  b.addEventListener('pointercancel', () => {
    armed = -1;
  });
  return b;
}

/** Full screen overlay panel, hidden until show(). */
export interface Screen {
  readonly root: HTMLDivElement;
  show(): void;
  hide(): void;
}

export function createScreen(parent: HTMLElement): Screen {
  const root = el('div', 'sow-screen');
  // Keep overlay touches away from the canvas sticks.
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  parent.append(root);
  return {
    root,
    show: () => root.classList.add('sow-open'),
    hide: () => root.classList.remove('sow-open'),
  };
}

/**
 * Keep an overlay's content inside a rect given as padding from each screen edge (the padding
 * already includes the safe area insets). Used so pause, results and the intro card never sit on
 * the HUD rings (B6 follow up).
 */
export function confine(root: HTMLElement, pad: { top: number; right: number; bottom: number; left: number }): void {
  root.style.padding = `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`;
}

/** The UI layer above the canvas. Transparent to touches except where a screen is open. */
export function createUiRoot(doc: Document = document): HTMLDivElement {
  injectStyles(doc);
  const root = doc.createElement('div');
  root.className = 'sow-ui';
  root.id = 'sow-ui';
  doc.body.append(root);
  return root;
}
