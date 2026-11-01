// Wave 6 contract stub (Fable): the render only 3D tilt level (docs/12 Wave V3-G). Ledger's setting
// calls setTilt; Glow owns this file and builds the projection behind it. 'off' is the v3 render.
export type TiltLevel = 'off' | 'low' | 'high';

let level: TiltLevel = 'off';

/** Set the tilt level (off, low 7 deg, high 13 deg). */
export function setTilt(next: TiltLevel): void {
  level = next;
}

/** The current tilt level. */
export function getTilt(): TiltLevel {
  return level;
}
