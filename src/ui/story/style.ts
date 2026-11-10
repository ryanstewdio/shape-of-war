// Scene player stylesheet. Plain HUD font (system-ui), large, high contrast; safe areas respected;
// the layout fits a 360 px tall landscape phone and both Fold 7 screens.
import { MIN_HIT_PX } from '../dom';

const STYLE_ID = 'sow-story-style';

export const STORY_CSS = `
.sow-story { position: absolute; inset: 0; z-index: 30; display: none; pointer-events: auto; touch-action: none;
  flex-direction: column; align-items: center; justify-content: center; gap: 2vmin; box-sizing: border-box;
  background: rgb(3, 5, 12); color: hsl(190, 30%, 96%);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  padding: max(8px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
    max(8px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px)); }
.sow-story.sow-open { display: flex; }
.sow-story-stage { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
.sow-story-canvas { display: block; }
.sow-story-text { flex: 0 0 auto; width: min(900px, 100%); min-height: calc(2 * 1.35em + 8px);
  font-size: clamp(16px, 4.6vmin, 28px); line-height: 1.35; text-align: center; font-weight: 600;
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.9); }
.sow-story-line { display: flex; align-items: center; justify-content: center; gap: 0.4em; white-space: pre-wrap; }
.sow-story-line.sow-torus { color: hsl(45, 90%, 82%); }
.sow-story-line.sow-vecta { color: hsl(220, 8%, 78%); font-style: italic; }
.sow-story-icon { flex: 0 0 auto; width: 1.2em; height: 1.2em; }
.sow-story-skip { position: absolute; top: max(8px, env(safe-area-inset-top, 0px)); right: max(12px, env(safe-area-inset-right, 0px));
  min-width: 112px; min-height: ${Math.max(MIN_HIT_PX, 52)}px; font-size: 18px; font-weight: 700; letter-spacing: 0.06em; z-index: 2; }
.sow-story-hint { flex: 0 0 auto; font-size: 13px; opacity: 0.55; min-height: 1.2em; }
.sow-story-picker { flex: 0 0 auto; display: none; flex-direction: column; align-items: center; gap: 8px;
  width: min(520px, 100%); padding: 10px 14px; box-sizing: border-box; background: rgba(2, 6, 16, 0.9);
  border: 2px solid hsl(185, 95%, 62%); border-radius: 12px; }
.sow-story-picker.sow-open { display: flex; }
.sow-story-name { font-size: clamp(22px, 6vmin, 36px); font-weight: 700; letter-spacing: 0.05em; color: hsl(185, 90%, 82%); }
.sow-story-picker .sow-row { width: 100%; flex-wrap: nowrap; gap: 8px; }
.sow-story-picker .sow-btn { min-width: 0; flex: 1 1 0; min-height: ${MIN_HIT_PX}px; font-size: 16px; padding: 6px 10px; }
.sow-story-picker .sow-btn[aria-disabled="true"] { opacity: 0.45; }
.sow-story-picker .sow-input { text-align: center; font-size: 18px; }
@media (max-height: 420px) { .sow-story-picker { flex-direction: row; flex-wrap: wrap; justify-content: center; padding: 6px 10px; }
  .sow-story-picker .sow-row { width: auto; flex: 1 1 240px; }
  .sow-story-picker .sow-input { flex: 1 1 140px; min-width: 120px; max-width: 200px; } }
`;

export function injectStoryStyles(doc: Document = document): void {
  if (typeof doc.getElementById !== 'function' || doc.getElementById(STYLE_ID) !== null) return;
  const s = doc.createElement('style');
  s.id = STYLE_ID;
  s.textContent = STORY_CSS;
  doc.head.append(s);
}
