// Pure lattice depth fade for the tilt (G6 tilt-depth). No pixi.js import, no PRNG.
// Under tilt the lattice lines farther away read slightly thinner. WebGL lines are one device
// pixel wide, so "thinner" is an alpha multiplier only (the applyNeon rule holds: gridAlpha stays
// the layer alpha, this is a fixed multiplier under it). The multiplier is 1 at the near wall and
// falls linearly to 1 - FAR_FADE x k at the far wall, k = sin T / sin(high tilt), so low tilt
// fades less and off never fades.
// The line meshes sample a two texel texture (texel 0 at FADE_TEXEL, texel 1 opaque) with linear
// filtering; each node's u picks its multiplier. Written once per build or camera change from the
// rest positions, never per frame.
import { TILT_DEG, type Camera } from '../project';

/** Share of line alpha lost at the far wall at the high tilt. */
export const FAR_FADE = 0.3;
/** Alpha of texel 0 of the fade texture: the lowest multiplier the texture can show. */
export const FADE_TEXEL = 0.6;

const SIN_HIGH = Math.sin((TILT_DEG.high * Math.PI) / 180);

/** Pure: the line alpha multiplier at arena y (arena height h) for cam. 1 when off. */
export function lineDepthAlpha(y: number, h: number, cam: Camera): number {
  if (!cam.on || !(h > 0)) return 1;
  const k = Math.min(1, cam.sin / SIN_HIGH);
  // 0 at the near wall (y = h / 2), 1 at the far wall (y = -h / 2).
  const t = Math.min(1, Math.max(0, 0.5 - y / h));
  const a = 1 - FAR_FADE * k * t;
  return a < FADE_TEXEL ? FADE_TEXEL : a;
}

/** Pure: the u that samples alpha a from the linear two texel fade texture (texel centres 0.25, 0.75). */
export function fadeU(a: number): number {
  const t = (a - FADE_TEXEL) / (1 - FADE_TEXEL);
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 0.25 + 0.5 * c;
}

/** Write each node's fade u (v stays 0) from its rest y. uv holds count (u, v) pairs. */
export function writeFadeUv(uv: Float32Array, restY: ArrayLike<number>, count: number, h: number, cam: Camera): void {
  const n = Math.min(count, uv.length >> 1, restY.length);
  for (let i = 0; i < n; i++) {
    uv[2 * i] = fadeU(lineDepthAlpha(restY[i] ?? 0, h, cam));
    uv[2 * i + 1] = 0;
  }
}
