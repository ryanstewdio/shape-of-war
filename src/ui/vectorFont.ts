// Vector headline font (Ryan, after R6): an original stroke font drawn in code, in the spirit of
// vector arcade lettering. No font files: every glyph is straight segments and a few arcs on a
// 4 wide by 6 tall grid (y down, 0 at the cap line, 6 on the baseline), with chamfered corners for
// the slightly squared look and one stroke width for every glyph. Headlines only: the title, screen
// headlines, the big results score, the main card buttons and the HUD score. Body text keeps the
// clean UI font.
// Lower case letters draw as capitals. A lower case "x" with no letter either side ("x3", "3 x 4")
// draws as a small multiply sign; inside a word ("Next") it is a capital.
// The colours come from BASE_PALETTE at the saturation applyNeon last set and the glow follows its
// glow alpha: main.ts calls syncVectorFontStyle from an onNeonChanged listener, as it does for the
// 4th star, so this module never sets a neon value itself.
// Accessibility: the SVG is aria-hidden; the host carries the text in an aria-label and a visually
// hidden span, so screen readers and tests read the words.
import { BASE_PALETTE, type PaletteKey } from '../render/neon';

/** One glyph: its width in grid units and its path on the grid (absolute M, L, A and Z only). */
export interface Glyph {
  readonly w: number;
  readonly d: string;
}

/** Grid height in units (cap line to baseline). */
export const GRID_H = 6;
/** Gap between two glyphs in grid units, before any extra letter spacing. */
export const GLYPH_GAP = 1;
/** Stroke width in grid units, the same for every glyph. */
export const STROKE_UNITS = 0.6;

const O_PATH = 'M1 0 L3 0 L4 1 L4 5 L3 6 L1 6 L0 5 L0 1 Z';
const P_PATH = 'M0 6 L0 0 L3 0 L4 1 L4 2 L3 3 L0 3';

/** The glyph table. Original design: drawn on the grid for this game, not traced from any font. */
export const GLYPHS: Readonly<Record<string, Glyph>> = {
  A: { w: 4, d: 'M0 6 L0 2 L2 0 L4 2 L4 6 M0 4 L4 4' },
  B: { w: 4, d: 'M0 0 L3 0 L4 1 L4 2 L3 3 L0 3 M3 3 L4 4 L4 5 L3 6 L0 6 L0 0' },
  C: { w: 4, d: 'M4 0 L1 0 L0 1 L0 5 L1 6 L4 6' },
  D: { w: 4, d: 'M0 0 L2.5 0 L4 1.5 L4 4.5 L2.5 6 L0 6 Z' },
  E: { w: 4, d: 'M4 0 L0 0 L0 6 L4 6 M0 3 L3 3' },
  F: { w: 4, d: 'M4 0 L0 0 L0 6 M0 3 L3 3' },
  G: { w: 4, d: 'M4 1 L3 0 L1 0 L0 1 L0 5 L1 6 L3 6 L4 5 L4 3 L2 3' },
  H: { w: 4, d: 'M0 0 L0 6 M4 0 L4 6 M0 3 L4 3' },
  I: { w: 2, d: 'M0 0 L2 0 M1 0 L1 6 M0 6 L2 6' },
  J: { w: 4, d: 'M4 0 L4 5 L3 6 L1 6 L0 5 L0 4' },
  K: { w: 4, d: 'M0 0 L0 6 M4 0 L1 3 L4 6 M0 3 L1 3' },
  L: { w: 4, d: 'M0 0 L0 6 L4 6' },
  M: { w: 4, d: 'M0 6 L0 0 L2 3 L4 0 L4 6' },
  N: { w: 4, d: 'M0 6 L0 0 L4 6 L4 0' },
  O: { w: 4, d: O_PATH },
  P: { w: 4, d: P_PATH },
  Q: { w: 4, d: `${O_PATH} M2.5 4.5 L4 6` },
  R: { w: 4, d: `${P_PATH} M2 3 L4 6` },
  S: { w: 4, d: 'M4 0 L1 0 L0 1 L0 2 L1 3 L3 3 L4 4 L4 5 L3 6 L0 6' },
  T: { w: 4, d: 'M0 0 L4 0 M2 0 L2 6' },
  U: { w: 4, d: 'M0 0 L0 5 L1 6 L3 6 L4 5 L4 0' },
  V: { w: 4, d: 'M0 0 L2 6 L4 0' },
  W: { w: 4, d: 'M0 0 L1 6 L2 3 L3 6 L4 0' },
  X: { w: 4, d: 'M0 0 L4 6 M4 0 L0 6' },
  Y: { w: 4, d: 'M0 0 L2 3 L4 0 M2 3 L2 6' },
  Z: { w: 4, d: 'M0 0 L4 0 L0 6 L4 6' },
  '0': { w: 4, d: 'M0 2 A2 2 0 0 1 4 2 L4 4 A2 2 0 0 1 0 4 Z' },
  '1': { w: 3, d: 'M0 1 L1.5 0 L1.5 6 M0 6 L3 6' },
  '2': { w: 4, d: 'M0 2 A2 2 0 0 1 4 2 L0 6 L4 6' },
  '3': { w: 4, d: 'M0 0 L4 0 L1.5 2.5 L3 2.5 L4 3.5 L4 5 L3 6 L0 6' },
  '4': { w: 4, d: 'M3 6 L3 0 L0 4 L4 4' },
  '5': { w: 4, d: 'M4 0 L0 0 L0 2.5 L3 2.5 L4 3.5 L4 5 L3 6 L0 6' },
  '6': { w: 4, d: 'M3.5 0 L1 0 L0 1 L0 5 L1 6 L3 6 L4 5 L4 3.5 L3 2.5 L0 2.5' },
  '7': { w: 4, d: 'M0 0 L4 0 L1.5 6' },
  '8': { w: 4, d: 'M1 0 L3 0 L4 1 L4 2 L3 3 L1 3 L0 2 L0 1 Z M1 3 L3 3 L4 4 L4 5 L3 6 L1 6 L0 5 L0 4 Z' },
  '9': { w: 4, d: 'M4 3.5 L1 3.5 L0 2.5 L0 1 L1 0 L3 0 L4 1 L4 5 L3 6 L0.5 6' },
  '.': { w: 1, d: 'M0.5 5.6 L0.5 6' },
  ',': { w: 1, d: 'M0.5 5.4 L0.5 6 L0 7' },
  ':': { w: 1, d: 'M0.5 1.6 L0.5 2 M0.5 5.6 L0.5 6' },
  '!': { w: 1, d: 'M0.5 0 L0.5 4 M0.5 5.6 L0.5 6' },
  '?': { w: 4, d: 'M0 2 A2 2 0 0 1 4 2 L2 4 L2 4.4 M2 5.6 L2 6' },
  '-': { w: 4, d: 'M0.5 3 L3.5 3' },
  '+': { w: 4, d: 'M0.5 3 L3.5 3 M2 1.5 L2 4.5' },
  '/': { w: 4, d: 'M0 6 L4 0' },
  '%': { w: 4, d: 'M0 6 L4 0 M0.5 0.5 L1.5 0.5 L1.5 1.5 L0.5 1.5 Z M2.5 4.5 L3.5 4.5 L3.5 5.5 L2.5 5.5 Z' },
  '#': { w: 4, d: 'M1.5 1 L1 5 M3 1 L2.5 5 M0 2.3 L4 2.3 M0 3.7 L4 3.7' },
  x: { w: 4, d: 'M0.5 3 L3.5 6 M3.5 3 L0.5 6' },
  ' ': { w: 3, d: '' },
};

/** Every character with its own glyph. */
export const SUPPORTED_CHARS = Object.keys(GLYPHS).join('');

/** Any character without a glyph draws as an open box the size of a capital. */
export const FALLBACK_GLYPH: Glyph = { w: 4, d: 'M0 0 L4 0 L4 6 L0 6 Z' };

/** Pure: the glyph for one character. Lower case maps to capitals except "x"; unknown is a box. */
export function glyphFor(ch: string): Glyph {
  return GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? FALLBACK_GLYPH;
}

const isLetter = (ch: string | undefined): boolean => ch !== undefined && /\p{L}/u.test(ch);

/** Pure: the glyph for the character at index i, reading its neighbours for the "x" rule. */
export function glyphAt(chars: readonly string[], i: number): Glyph {
  const ch = chars[i] ?? '';
  if (ch === 'x' && (isLetter(chars[i - 1]) || isLetter(chars[i + 1]))) return GLYPHS.X ?? FALLBACK_GLYPH;
  return glyphFor(ch);
}

/** Pure: how far one character moves the pen, in grid units, gap included. Always positive. */
export function glyphAdvance(ch: string): number {
  return glyphFor(ch).w + GLYPH_GAP;
}

function num(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Pure: a grid path scaled by `unit` and moved right by `dx`. */
export function placePath(d: string, unit: number, dx: number): string {
  const tokens = d.match(/[MLAZ]|-?\d*\.?\d+/g) ?? [];
  const out: string[] = [];
  let i = 0;
  const next = (): number => Number(tokens[i++] ?? 0);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'L') {
      const x = next();
      const y = next();
      out.push(`${cmd}${num(x * unit + dx)} ${num(y * unit)}`);
    } else if (cmd === 'A') {
      const rx = next();
      const ry = next();
      const rot = next();
      const large = next();
      const sweep = next();
      const x = next();
      const y = next();
      out.push(`A${num(rx * unit)} ${num(ry * unit)} ${num(rot)} ${large} ${sweep} ${num(x * unit + dx)} ${num(y * unit)}`);
    } else if (cmd === 'Z') {
      out.push('Z');
    }
  }
  return out.join(' ');
}

export interface VectorLayout {
  /** SVG path data for the whole line, pen starting at x 0, cap line at y 0. */
  readonly d: string;
  /** Advance width in px, from the left edge of the first glyph to the right edge of the last. */
  readonly width: number;
  /** Cap height in px (the size asked for). */
  readonly height: number;
  /** One grid unit in px. */
  readonly unit: number;
  /** Stroke width in px. */
  readonly stroke: number;
}

/**
 * Pure: lay out one line. `size` is the cap height in px, `letterSpacing` extra px between glyphs
 * (negative values count as 0, so the width always grows with the text).
 */
export function layoutVector(text: string, size: number, letterSpacing = 0): VectorLayout {
  const h = Number.isFinite(size) ? Math.max(0, size) : 0;
  const unit = h / GRID_H;
  const extra = Number.isFinite(letterSpacing) ? Math.max(0, letterSpacing) : 0;
  const parts: string[] = [];
  let x = 0;
  let width = 0;
  const chars = [...text];
  for (let i = 0; i < chars.length; i += 1) {
    const g = glyphAt(chars, i);
    if (g.d !== '') parts.push(placePath(g.d, unit, x));
    width = x + g.w * unit;
    x = width + GLYPH_GAP * unit + extra;
  }
  return { d: parts.join(' '), width, height: h, unit, stroke: STROKE_UNITS * unit };
}

// ---- Neon look -----------------------------------------------------------------------------

/** Headline tones: stroke colour and glow colour, both palette keys. */
export const VECTOR_TONES = {
  cyan: { stroke: 'cyan', glow: 'cyan' },
  white: { stroke: 'white', glow: 'cyan' },
  yellow: { stroke: 'yellow', glow: 'yellow' },
  green: { stroke: 'geom', glow: 'green' },
  red: { stroke: 'red', glow: 'red' },
} as const satisfies Record<string, { stroke: PaletteKey; glow: PaletteKey }>;

export type VectorTone = keyof typeof VECTOR_TONES;

export const VECTOR_CLASS = 'sow-vec';
export const VECTOR_HOST_CLASS = 'sow-vec-host';
export const VECTOR_STYLE_ID = 'sow-vec-style';
/** The SVG is this many em tall (padding included); the cap height comes out near 0.72 em. */
export const CAP_EM = 0.72;
/** Room round the glyphs in the view box, in grid units, for the stroke, the comma tail and the glow. */
const PAD_UNITS = 1;

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

function pct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

/** Pure: the CSS colour of a palette key at a neon saturation multiplier, kept bright for text. */
export function toneColour(key: PaletteKey, saturation: number, alpha = 1): string {
  const mul = Number.isFinite(saturation) ? Math.max(0, saturation) : 1;
  const [h, s, l] = BASE_PALETTE[key];
  const a = clamp01(alpha);
  return `hsla(${h}, ${pct(clamp01(s * mul))}, ${pct(Math.max(0.62, l))}, ${Math.round(a * 100) / 100})`;
}

/** Pure: glow blur radius in px at a glow alpha from the neon state (0 to 1). */
export function glowBlur(glowAlpha: number): number {
  return Math.round((2 + 7 * clamp01(glowAlpha)) * 10) / 10;
}

/** Pure: the stylesheet for vector headlines at the current neon saturation and glow alpha. */
export function vectorFontCss(saturation: number, glowAlpha: number): string {
  const blur = glowBlur(glowAlpha);
  const a = 0.45 + 0.5 * clamp01(glowAlpha);
  const tones = (Object.keys(VECTOR_TONES) as VectorTone[])
    .map((t) => {
      const k = VECTOR_TONES[t];
      const glow = toneColour(k.glow, saturation, a);
      return `.${VECTOR_CLASS}.${VECTOR_CLASS}-${t} { stroke: ${toneColour(k.stroke, saturation)};
  filter: drop-shadow(0 0 ${blur}px ${glow}) drop-shadow(0 0 ${Math.round(blur * 2.4)}px ${glow}); }`;
    })
    .join('\n');
  return `${tones}\n`;
}

/** DOM edge: create or refresh the vector headline stylesheet. Call from an onNeonChanged listener. */
export function syncVectorFontStyle(saturation: number, glowAlpha: number, doc: Document = document): void {
  const css = vectorFontCss(saturation, glowAlpha);
  let s = doc.getElementById(VECTOR_STYLE_ID);
  if (s === null) {
    s = doc.createElement('style');
    s.id = VECTOR_STYLE_ID;
    doc.head.append(s);
  }
  if (s.textContent !== css) s.textContent = css;
}

/** Pure: the SVG geometry for a line: view box and size in em, so it follows the host font size. */
export function vectorBox(text: string): { d: string; viewBox: string; wEm: number; hEm: number; stroke: number } {
  const L = layoutVector(text, GRID_H);
  const vbW = Math.max(L.width, 0) + 2 * PAD_UNITS;
  const vbH = GRID_H + 2 * PAD_UNITS;
  const hEm = (CAP_EM * vbH) / GRID_H;
  const r = (v: number): number => Math.round(v * 1000) / 1000;
  return { d: L.d, viewBox: `${-PAD_UNITS} ${-PAD_UNITS} ${r(vbW)} ${vbH}`, wEm: r((hEm * vbW) / vbH), hEm: r(hEm), stroke: STROKE_UNITS };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface VectorTextOptions {
  tone?: VectorTone;
  /** What to draw when it differs from the spoken text (the Details "+" or "-" suffix). */
  drawn?: string;
}

/**
 * DOM edge: draw `text` in the vector font inside `host`, replacing its children. The SVG is
 * aria-hidden; the host gets an aria-label and a visually hidden span with the text.
 */
export function setVectorText(host: HTMLElement, text: string, opts: VectorTextOptions = {}): void {
  const tone = opts.tone ?? 'cyan';
  const drawn = opts.drawn ?? text;
  const box = vectorBox(drawn);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `${VECTOR_CLASS} ${VECTOR_CLASS}-${tone}`);
  svg.setAttribute('viewBox', box.viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('style', `width: ${box.wEm}em; height: ${box.hEm}em`);
  svg.setAttribute('data-vec', drawn);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', box.d);
  path.setAttribute('stroke-width', String(box.stroke));
  svg.append(path);
  const sr = document.createElement('span');
  sr.className = 'sow-sr';
  sr.textContent = text;
  host.classList.add(VECTOR_HOST_CLASS);
  host.setAttribute('aria-label', text);
  host.replaceChildren(svg, sr);
}
