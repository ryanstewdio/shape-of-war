// Pixel headline font (Ryan, font check on 4a49922): an original arcade style pixel font drawn in
// code. No font files: every glyph is a bitmap on a 5 wide by 7 tall cell grid (y down, row 0 at
// the cap line, row 6 on the baseline), drawn as one SVG path of square cells with crispEdges.
// Headlines only: the title, screen headlines, the big results score and the main card buttons.
// The HUD score and body text keep the plain UI font.
// Cells are whole CSS px: the cell is the host font size over 10, rounded to an integer (cellPx),
// and the stylesheet applies the same rounding with CSS round(), so cells stay sharp on the cover
// and main screens at every size the call sites use (PIXEL_SITES).
// Lower case letters draw as capitals. A lower case "x" with no letter either side ("x3", "3 x 4")
// draws as a small multiply sign; inside a word ("Next") it is a capital.
// Colours come from BASE_PALETTE at the saturation applyNeon last set and the glow follows its
// glow alpha: main.ts calls syncVectorFontStyle from an onNeonChanged listener, so this module
// never sets a neon value itself. Each line also draws a 1 cell drop shadow in a darker shade of
// its own hue at low alpha (never black).
// Accessibility: the SVG is aria-hidden; the host carries the text in an aria-label and a visually
// hidden span, so screen readers and tests read the words.
import { BASE_PALETTE, type PaletteKey } from '../render/neon';

/** One glyph: rows top to bottom, '#' a lit cell, '.' empty. Every row has the glyph's width. */
export interface Glyph {
  readonly w: number;
  readonly rows: readonly string[];
}

/** Grid width in cells (the widest glyph). */
export const GRID_W = 5;
/** Grid height in cells (cap line to baseline). */
export const GRID_H = 7;
/** Gap between two glyphs in cells. */
export const GLYPH_GAP = 1;
/** Shadow offset in cells, right and down. */
export const SHADOW_CELLS = 1;
/** Cell size in em before rounding to whole px: a 20 px host draws 2 px cells, 14 px capitals. */
export const CELL_EM = 0.1;

const g = (art: string): Glyph => {
  const rows = art.trim().split(/\s+/);
  return { w: rows[0]?.length ?? 0, rows };
};

/** The glyph table. Original design: drawn cell by cell for this game, not traced from any font. */
export const GLYPHS: Readonly<Record<string, Glyph>> = {
  A: g('.###. #...# #...# ##### #...# #...# #...#'),
  B: g('####. #...# #...# ####. #...# #...# ####.'),
  C: g('.#### #.... #.... #.... #.... #.... .####'),
  D: g('###.. #..#. #...# #...# #...# #..#. ###..'),
  E: g('##### #.... #.... ####. #.... #.... #####'),
  F: g('##### #.... #.... ####. #.... #.... #....'),
  G: g('.#### #.... #.... #.### #...# #...# .###.'),
  H: g('#...# #...# #...# ##### #...# #...# #...#'),
  I: g('### .#. .#. .#. .#. .#. ###'),
  J: g('..### ...#. ...#. ...#. ...#. #..#. .##..'),
  K: g('#...# #..#. #.#.. ##... #.#.. #..#. #...#'),
  L: g('#.... #.... #.... #.... #.... #.... #####'),
  M: g('#...# ##.## #.#.# #.#.# #...# #...# #...#'),
  N: g('#...# ##..# #.#.# #..## #...# #...# #...#'),
  O: g('.###. #...# #...# #...# #...# #...# .###.'),
  P: g('####. #...# #...# ####. #.... #.... #....'),
  Q: g('.###. #...# #...# #...# #.#.# #..#. .##.#'),
  R: g('####. #...# #...# ####. #.#.. #..#. #...#'),
  S: g('.#### #.... #.... .###. ....# ....# ####.'),
  T: g('##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..'),
  U: g('#...# #...# #...# #...# #...# #...# .###.'),
  V: g('#...# #...# #...# #...# #...# .#.#. ..#..'),
  W: g('#...# #...# #...# #.#.# #.#.# ##.## #...#'),
  X: g('#...# #...# .#.#. ..#.. .#.#. #...# #...#'),
  Y: g('#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..'),
  Z: g('##### ....# ...#. ..#.. .#... #.... #####'),
  '0': g('.###. #...# #..## #.#.# ##..# #...# .###.'),
  '1': g('..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.'),
  '2': g('.###. #...# ....# ...#. ..#.. .#... #####'),
  '3': g('####. ....# ....# .###. ....# ....# ####.'),
  '4': g('...#. ..##. .#.#. #..#. ##### ...#. ...#.'),
  '5': g('##### #.... ####. ....# ....# #...# .###.'),
  '6': g('..##. .#... #.... ####. #...# #...# .###.'),
  '7': g('##### ....# ...#. ..#.. .#... .#... .#...'),
  '8': g('.###. #...# #...# .###. #...# #...# .###.'),
  '9': g('.###. #...# #...# .#### ....# ...#. .##..'),
  '.': g('. . . . . . #'),
  ',': g('.. .. .. .. .# .# #.'),
  ':': g('. . # . . . #'),
  '!': g('# # # # # . #'),
  '?': g('.###. #...# ....# ...#. ..#.. ..... ..#..'),
  '-': g('..... ..... ..... .###. ..... ..... .....'),
  '+': g('..... ..#.. ..#.. ##### ..#.. ..#.. .....'),
  '/': g('....# ....# ...#. ..#.. .#... #.... #....'),
  '%': g('##..# ##..# ...#. ..#.. .#... #..## #..##'),
  '#': g('.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.'),
  x: g('..... ..... #...# .#.#. ..#.. .#.#. #...#'),
  ' ': g('... ... ... ... ... ... ...'),
};

/** Every character with its own glyph. */
export const SUPPORTED_CHARS = Object.keys(GLYPHS).join('');

/** Any character without a glyph draws as a hollow box the size of a capital. */
export const FALLBACK_GLYPH: Glyph = g('##### #...# #...# #...# #...# #...# #####');

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

/** Pure: how far one character moves the pen, in cells, gap included. Always positive. */
export function glyphAdvance(ch: string): number {
  return glyphFor(ch).w + GLYPH_GAP;
}

/** One horizontal run of lit cells: x, y and length, in cells. */
export type CellRun = readonly [x: number, y: number, n: number];

/** Pure: the lit runs of one glyph moved right by `dx` cells. */
export function glyphRuns(glyph: Glyph, dx = 0): CellRun[] {
  const out: CellRun[] = [];
  glyph.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') {
        x += 1;
        continue;
      }
      const start = x;
      while (row[x] === '#') x += 1;
      out.push([start + dx, y, x - start]);
    }
  });
  return out;
}

export interface PixelLayout {
  /** Every lit run of the line, pen starting at x 0, cap line at y 0, in cells. */
  readonly runs: readonly CellRun[];
  /** Width in cells from the left edge of the first glyph to the right edge of the last. */
  readonly width: number;
}

/** Pure: lay out one line on the cell grid. */
export function layoutPixels(text: string): PixelLayout {
  const runs: CellRun[] = [];
  const chars = [...text];
  let x = 0;
  let width = 0;
  for (let i = 0; i < chars.length; i += 1) {
    const glyph = glyphAt(chars, i);
    runs.push(...glyphRuns(glyph, x));
    width = x + glyph.w;
    x = width + GLYPH_GAP;
  }
  return { runs, width };
}

/** Pure: SVG path data for runs, one closed rectangle per run, integers only. */
export function runsPath(runs: readonly CellRun[]): string {
  return runs.map(([x, y, n]) => `M${x} ${y}h${n}v1h${-n}z`).join('');
}

/** Pure: the cell size in whole CSS px for a host font size in px (never below 1). */
export function cellPx(fontPx: number): number {
  if (!Number.isFinite(fontPx) || fontPx <= 0) return 1;
  return Math.max(1, Math.round(fontPx * CELL_EM));
}

/**
 * The host font sizes each call site can take, in CSS px (from the dom.ts rules and the menu
 * layout). Tests check that every integer size in each range draws whole px cells.
 */
export const PIXEL_SITES = {
  title: { min: 28, max: 64 },
  splashTitle: { min: 34, max: 84 },
  menuTitle: { min: 18, max: 52 },
  cardTitle: { min: 22, max: 44 },
  resultsScore: { min: 26, max: 56 },
  parReached: { min: 20, max: 34 },
  bigButton: { min: 20, max: 20 },
} as const satisfies Record<string, { min: number; max: number }>;

/** Pure: the SVG geometry for a line: path, view box and size in cells (shadow included). */
export function pixelBox(text: string): { d: string; viewBox: string; wCells: number; hCells: number } {
  const L = layoutPixels(text);
  const wCells = L.width + SHADOW_CELLS;
  const hCells = GRID_H + SHADOW_CELLS;
  return { d: runsPath(L.runs), viewBox: `0 0 ${wCells} ${hCells}`, wCells, hCells };
}

/** Pure: the drawn width in px of `text` at a host font size, shadow included. */
export function pixelWidthPx(text: string, fontPx: number): number {
  return pixelBox(text).wCells * cellPx(fontPx);
}

// ---- Neon look -----------------------------------------------------------------------------

/** Headline tones: fill colour and glow colour, both palette keys. */
export const VECTOR_TONES = {
  cyan: { fill: 'cyan', glow: 'cyan' },
  white: { fill: 'white', glow: 'cyan' },
  yellow: { fill: 'yellow', glow: 'yellow' },
  green: { fill: 'geom', glow: 'green' },
  red: { fill: 'red', glow: 'red' },
} as const satisfies Record<string, { fill: PaletteKey; glow: PaletteKey }>;

export type VectorTone = keyof typeof VECTOR_TONES;

export const VECTOR_CLASS = 'sow-vec';
export const VECTOR_HOST_CLASS = 'sow-vec-host';
export const VECTOR_STYLE_ID = 'sow-vec-style';
/** Shadow lightness and alpha: a dark shade of the tone's hue, never black. */
export const SHADOW_LIGHTNESS = 0.24;
export const SHADOW_ALPHA = 0.5;

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

function pct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

function hsla(key: PaletteKey, saturation: number, light: number, alpha: number): string {
  const mul = Number.isFinite(saturation) ? Math.max(0, saturation) : 1;
  const [h, s] = BASE_PALETTE[key];
  return `hsla(${h}, ${pct(clamp01(s * mul))}, ${pct(light)}, ${Math.round(clamp01(alpha) * 100) / 100})`;
}

/** Pure: the CSS colour of a palette key at a neon saturation multiplier, kept bright for text. */
export function toneColour(key: PaletteKey, saturation: number, alpha = 1): string {
  return hsla(key, saturation, Math.max(0.62, BASE_PALETTE[key][2]), alpha);
}

/** Pure: the drop shadow colour of a tone: same hue, darker, low alpha. */
export function shadowColour(tone: VectorTone, saturation: number): string {
  return hsla(VECTOR_TONES[tone].fill, saturation, SHADOW_LIGHTNESS, SHADOW_ALPHA);
}

/** Pure: glow blur radius in px at a glow alpha from the neon state (0 to 1). */
export function glowBlur(glowAlpha: number): number {
  return Math.round((2 + 7 * clamp01(glowAlpha)) * 10) / 10;
}

/** Pure: the stylesheet for pixel headlines at the current neon saturation and glow alpha. */
export function vectorFontCss(saturation: number, glowAlpha: number): string {
  const blur = glowBlur(glowAlpha);
  const a = 0.45 + 0.5 * clamp01(glowAlpha);
  const tones = (Object.keys(VECTOR_TONES) as VectorTone[])
    .map((t) => {
      const k = VECTOR_TONES[t];
      const glow = toneColour(k.glow, saturation, a);
      const sel = `.${VECTOR_CLASS}.${VECTOR_CLASS}-${t}`;
      return `${sel} { filter: drop-shadow(0 0 ${blur}px ${glow}) drop-shadow(0 0 ${Math.round(blur * 2.4)}px ${glow}); }
${sel} .${VECTOR_CLASS}-fg { fill: ${toneColour(k.fill, saturation)}; }
${sel} .${VECTOR_CLASS}-sh { fill: ${shadowColour(t, saturation)}; }`;
    })
    .join('\n');
  return `${tones}\n`;
}

/** DOM edge: create or refresh the pixel headline stylesheet. Call from an onNeonChanged listener. */
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

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface VectorTextOptions {
  tone?: VectorTone;
  /** What to draw when it differs from the spoken text (the Details "+" or "-" suffix). */
  drawn?: string;
}

/**
 * DOM edge: draw `text` in the pixel font inside `host`, replacing its children. The SVG is
 * aria-hidden; the host gets an aria-label and a visually hidden span with the text. The SVG size
 * is set in cells (--sow-cw, --sow-ch); the shared stylesheet turns cells into whole px.
 */
export function setVectorText(host: HTMLElement, text: string, opts: VectorTextOptions = {}): void {
  const tone = opts.tone ?? 'cyan';
  const drawn = opts.drawn ?? text;
  const box = pixelBox(drawn);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `${VECTOR_CLASS} ${VECTOR_CLASS}-${tone}`);
  svg.setAttribute('viewBox', box.viewBox);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('style', `--sow-cw: ${box.wCells}; --sow-ch: ${box.hCells}`);
  svg.setAttribute('data-vec', drawn);
  const shadow = document.createElementNS(SVG_NS, 'path');
  shadow.setAttribute('class', `${VECTOR_CLASS}-sh`);
  shadow.setAttribute('d', box.d);
  shadow.setAttribute('transform', `translate(${SHADOW_CELLS} ${SHADOW_CELLS})`);
  const fg = document.createElementNS(SVG_NS, 'path');
  fg.setAttribute('class', `${VECTOR_CLASS}-fg`);
  fg.setAttribute('d', box.d);
  svg.append(shadow, fg);
  const sr = document.createElement('span');
  sr.className = 'sow-sr';
  sr.textContent = text;
  host.classList.add(VECTOR_HOST_CLASS);
  host.setAttribute('aria-label', text);
  host.replaceChildren(svg, sr);
}
