// Pure arcade button look for the bomb and super buttons (thumbs-button-look). CSS px throughout.
// A filled disc at 25 percent in the button colour, a neon rim, and a ring of small square cells
// inside the disc in the same colour so the button reads as pixel styled. Pressed brightens the
// fill to 50 percent; an empty bomb stock or an uncharged super dims it. No DOM, no colours: the
// HUD turns these alphas into CSS with the palette colour at the saturation applyNeon last set.

/** Fill alpha at rest, pressed, and dimmed (empty or charging). */
export const FILL_REST = 0.25;
export const FILL_PRESSED = 0.5;
export const FILL_DIM = 0.08;
/** Charging super: the rising bright fill alpha, drawn in a contrasting colour from the rest fill. */
export const FILL_CHARGE = 0.6;
/** Full super: the pulse peaks at this fill alpha and this rim glow multiplier, once per second. */
export const FILL_READY = 0.7;
export const GLOW_READY = 1.5;
export const PULSE_HZ = 1;
/** Rim width in CSS px (the brief allows 1.5 to 2). */
export const RIM_W = 2;
/** Pixel cell size and the gap kept between the rim's inner edge and the cell ring. */
export const CELL = 4;
export const CELL_INSET = 2;

export interface ButtonState {
  /** A finger holds the button now. */
  held: boolean;
  /** Bomb: at least one bomb left. Super: fully charged. */
  ready: boolean;
}

export interface ButtonPaint {
  /** Disc fill alpha (the charged sweep, for a charging super). */
  fill: number;
  /** Fill alpha of the uncharged sweep of a charging super; equal to fill otherwise. */
  rest: number;
  /** Rim alpha. */
  rim: number;
  /** Pixel cell alpha. */
  cells: number;
  /** Rim glow multiplier (1 normally, up to GLOW_READY on a pulsing full super). */
  glow: number;
}

/**
 * Pure: alphas for one button. Held always shows the pressed look (a press on an empty bomb still
 * answers the finger). Not ready dims the whole button, as the charging super did before.
 */
export function buttonPaint(s: ButtonState): ButtonPaint {
  if (s.held) return { fill: FILL_PRESSED, rest: FILL_PRESSED, rim: 1, cells: 0.95, glow: 1 };
  if (s.ready) return { fill: FILL_REST, rest: FILL_REST, rim: 1, cells: 0.7, glow: 1 };
  return { fill: FILL_DIM, rest: FILL_DIM, rim: 0.45, cells: 0.3, glow: 1 };
}

/** Pure: pulse level from 0 to 1 at PULSE_HZ for a clock in ms. Starts at 0, peaks at half a period. */
export function pulse(tMs: number): number {
  const t = Number.isFinite(tMs) ? tMs : 0;
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * PULSE_HZ * (t / 1000));
}

/**
 * Pure: super paint for a charge from 0 to 1 and a clock in ms. Charging: a bright fill (FILL_CHARGE)
 * over a rest fill of FILL_REST, which the HUD draws in two colours rising from the bottom. Full: the
 * whole button pulses between FILL_REST and FILL_READY with the rim glow up to GLOW_READY.
 */
export function superPaint(charge: number, held: boolean, tMs = 0): ButtonPaint {
  const c = Number.isFinite(charge) ? Math.max(0, Math.min(1, charge)) : 0;
  const p = buttonPaint({ held, ready: c >= 1 });
  if (held) return p;
  if (c >= 1) {
    const k = pulse(tMs);
    const fill = FILL_REST + (FILL_READY - FILL_REST) * k;
    return { ...p, fill, rest: fill, glow: 1 + (GLOW_READY - 1) * k };
  }
  return { ...p, fill: FILL_CHARGE, rest: FILL_REST };
}

/** One square pixel cell: top left corner and side, whole CSS px, local to the disc's box. */
export interface Cell {
  x: number;
  y: number;
  s: number;
}

/**
 * Pure: a ring of square cells inside a disc of diameter `d`, just inside the rim. Cells sit on a
 * whole pixel grid, one cell apart along the ring, so the ring reads as pixel art, not a smooth line.
 */
export function pixelRing(d: number, cell = CELL): Cell[] {
  const r = d / 2 - RIM_W - CELL_INSET - cell / 2;
  if (!(r > cell)) return [];
  const n = Math.max(4, Math.floor((2 * Math.PI * r) / (2 * cell)));
  const out: Cell[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const x = Math.round(d / 2 + r * Math.cos(a) - cell / 2);
    const y = Math.round(d / 2 + r * Math.sin(a) - cell / 2);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x, y, s: cell });
  }
  return out;
}
