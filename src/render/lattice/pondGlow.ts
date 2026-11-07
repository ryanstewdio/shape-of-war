// T4 pond crest glow on the lattice heat mesh. Pure, no pixi.js. The heat mesh draws every
// lattice segment in the bloom layer with a per node RGBA colour; while a pond wave is live the
// renderer adds each node's crest glow (pondGlow, 0 to 1) on top of the heat colours as white,
// so the lines burn toward white as they lift and the bloom carries the wave through a busy fight.

/** Share of full white a node reaches at glow 1. */
export const POND_GLOW_WHITE = 0.85;

/** Add white of glow[i] x POND_GLOW_WHITE onto RGBA bytes in place for the first n nodes. Allocates nothing. */
export function addPondGlow(rgba: Uint8Array, glow: Float32Array, n: number): void {
  const m = Math.min(n, glow.length, rgba.length >> 2);
  for (let i = 0; i < m; i++) {
    const g = glow[i] ?? 0;
    if (!(g > 0)) continue;
    const w = Math.round(255 * POND_GLOW_WHITE * (g > 1 ? 1 : g));
    const o = 4 * i;
    const r = Math.min(255, (rgba[o] ?? 0) + w);
    const gg = Math.min(255, (rgba[o + 1] ?? 0) + w);
    const b = Math.min(255, (rgba[o + 2] ?? 0) + w);
    rgba[o] = r;
    rgba[o + 1] = gg;
    rgba[o + 2] = b;
    const a = r > gg ? (r > b ? r : b) : gg > b ? gg : b;
    if (a > (rgba[o + 3] ?? 0)) rgba[o + 3] = a;
  }
}
