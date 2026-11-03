// R1 (Ryan): the 4th star, earned only by completing a level on Insane. An iridescent star whose
// hue cycles through the neon palette, with a soft shimmer and a slow spin (one turn per 6 s). DOM
// and CSS only, no image files. The colours come from BASE_PALETTE at the saturation that
// applyNeon last set: main.ts calls syncFourthStarStyle from an onNeonChanged listener, so this
// module never sets any neon value itself. Honours prefers-reduced-motion like the menu rows.
import { BASE_PALETTE, type PaletteKey } from '../render/neon';
import type { StarCount } from '../core/stars';
import { el } from './dom';

export const FOURTH_STAR_CLASS = 'sow-star4';
export const FOURTH_STAR_STYLE_ID = 'sow-star4-style';
export const FOURTH_STAR_GLYPH = '★';
/** Seconds per full turn of the spin. */
export const FOURTH_STAR_SPIN_SEC = 6;
/** Seconds per full trip round the hue stops. */
export const FOURTH_STAR_HUE_SEC = 3;
/** Seconds per shimmer pulse. */
export const FOURTH_STAR_SHIMMER_SEC = 1.6;

/** Neon palette keys in hue order round the wheel: cyan, blue, purple, magenta, pink, yellow, lime, green. */
export const IRIDESCENT_KEYS: readonly PaletteKey[] = ['cyan', 'blue', 'purple', 'magenta', 'homing', 'yellow', 'geom', 'green'];

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

function pct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

/** Pure: the CSS colours of the hue stops at a neon saturation multiplier (NeonParams.saturation). */
export function iridescentColours(saturation: number): string[] {
  const mul = Number.isFinite(saturation) ? Math.max(0, saturation) : 1;
  return IRIDESCENT_KEYS.map((k) => {
    const [h, s, l] = BASE_PALETTE[k];
    return `hsl(${h}, ${pct(clamp01(s * mul))}, ${pct(Math.max(0.6, l))})`;
  });
}

/** Pure: the stylesheet for the 4th star at the current neon saturation and glow alpha (0 to 1). */
export function fourthStarCss(saturation: number, glowAlpha: number): string {
  const c = iridescentColours(saturation);
  const blur = Math.round(4 + 14 * clamp01(glowAlpha));
  const first = c[0] ?? 'hsl(185, 90%, 60%)';
  const stops = [...c, first]
    .map((col, i, all) => {
      const next = all[(i + 1) % all.length] ?? col;
      const at = Math.round((i / (all.length - 1)) * 1000) / 10;
      return `${at}% { color: ${col}; text-shadow: 0 0 ${blur}px ${col}, 0 0 ${blur * 2}px ${next}; }`;
    })
    .join(' ');
  return `
.${FOURTH_STAR_CLASS} { display: inline-block; letter-spacing: 0; margin-left: 0.15em; transform-origin: 50% 55%;
  color: ${first}; text-shadow: 0 0 ${blur}px ${first}; will-change: transform;
  animation: sow-star4-hue ${FOURTH_STAR_HUE_SEC}s linear infinite, sow-star4-spin ${FOURTH_STAR_SPIN_SEC}s linear infinite,
    sow-star4-shimmer ${FOURTH_STAR_SHIMMER_SEC}s ease-in-out infinite; }
@keyframes sow-star4-hue { ${stops} }
@keyframes sow-star4-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes sow-star4-shimmer { 0%, 100% { filter: brightness(1) saturate(1); } 50% { filter: brightness(1.5) saturate(1.3); } }
@media (prefers-reduced-motion: reduce) { .${FOURTH_STAR_CLASS} { animation: none; } }
`;
}

/** Pure: true when a star count includes the iridescent 4th star. */
export function hasFourthStar(stars: StarCount): boolean {
  return stars === 4;
}

/** DOM edge: create or refresh the 4th star stylesheet. Call from an onNeonChanged listener. */
export function syncFourthStarStyle(saturation: number, glowAlpha: number, doc: Document = document): void {
  const css = fourthStarCss(saturation, glowAlpha);
  let s = doc.getElementById(FOURTH_STAR_STYLE_ID);
  if (s === null) {
    s = doc.createElement('style');
    s.id = FOURTH_STAR_STYLE_ID;
    doc.head.append(s);
  }
  if (s.textContent !== css) s.textContent = css;
}

/** DOM edge: one iridescent star, hidden from screen readers (the parent carries the label). */
export function fourthStarEl(): HTMLSpanElement {
  const s = el('span', FOURTH_STAR_CLASS, FOURTH_STAR_GLYPH);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('data-star', '4');
  return s;
}
