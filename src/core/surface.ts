// Parametric play surfaces (docs/09-v2-roadmap.md sections 2.1 to 2.3). The sim calls only delta,
// wrap and the bounds; toXYZ is for render and camera. V3-H C0 (D13) adds the cylinder: u wraps,
// v is bounded by the rims at plus or minus H/2. Pure: no PRNG, no DOM, no allocation in delta or wrap.

/** v1 has a single kind. v2 adds 'cylinder' | 'torus' | 'sphere' | 'capsule' | 'twistedBand'. */
/** V3-H (D13) contract stub by Fable: 'cylinder' wraps u (docs/09 section 2.2). Forge implements it. */
export type SurfaceKind = 'flat' | 'cylinder';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Topology {
  wrapU: boolean;
  wrapV: boolean;
  /** twistedBand with odd halfTwists: crossing the u seam maps v to -v. Always false in v1. */
  flipVOnWrapU: boolean;
}

export interface Surface {
  readonly kind: SurfaceKind;
  readonly topology: Topology;
  /** u extent in arena units. */
  readonly width: number;
  /** v extent in arena units. */
  readonly height: number;
  /** Shortest b minus a in parameter space. Writes into out, returns out. */
  delta(ax: number, ay: number, bx: number, by: number, out: { x: number; y: number }): { x: number; y: number };
  /** Canonicalise a position. Returns true if a Mobius flip occurred (caller mirrors v velocity). */
  wrap(pos: { x: number; y: number }): boolean;
  /** Render and camera only. */
  toXYZ(u: number, v: number, out: Vec3): Vec3;
}

const FLAT_TOPOLOGY: Readonly<Topology> = Object.freeze({ wrapU: false, wrapV: false, flipVOnWrapU: false });

/** The v1 surface: plain Euclidean plane. delta is b minus a, wrap never moves anything, z is 0. */
export function flatSurface(width: number, height: number): Surface {
  return Object.freeze({
    kind: 'flat',
    topology: FLAT_TOPOLOGY,
    width,
    height,
    delta(ax: number, ay: number, bx: number, by: number, out: { x: number; y: number }): { x: number; y: number } {
      out.x = bx - ax;
      out.y = by - ay;
      return out;
    },
    wrap(): boolean {
      return false;
    },
    toXYZ(u: number, v: number, out: Vec3): Vec3 {
      out.x = u;
      out.y = v;
      out.z = 0;
      return out;
    },
  });
}

/**
 * Shortest signed offset on a wrapped axis of length L (docs/09 section 2.1):
 * d = ((d + L/2) mod L + L) mod L minus L/2. Result lies in [-L/2, L/2). Pure.
 */
export function wrapDelta(d: number, L: number): number {
  const h = L / 2;
  return (((d + h) % L) + L) % L - h;
}

/** Canonical coordinate on a wrapped axis of length L centred on 0: result in [-L/2, L/2). */
export function wrapCoord(c: number, L: number): number {
  if (c >= -L / 2 && c < L / 2) return c; // fast path, and keeps in range values bit identical
  return wrapDelta(c, L);
}

const CYLINDER_TOPOLOGY: Readonly<Topology> = Object.freeze({ wrapU: true, wrapV: false, flipVOnWrapU: false });

/**
 * Cylinder (docs/09 section 2.2): u wraps with period width, v is bounded (rims at plus or minus
 * height / 2, enforced by arena confinement, not here). R = W / 2 pi, theta = 2 pi u / W,
 * map (R cos theta, v, R sin theta).
 */
export function cylinderSurface(width: number, height: number): Surface {
  const R = width / (2 * Math.PI);
  const k = (2 * Math.PI) / width;
  return Object.freeze({
    kind: 'cylinder',
    topology: CYLINDER_TOPOLOGY,
    width,
    height,
    delta(ax: number, ay: number, bx: number, by: number, out: { x: number; y: number }): { x: number; y: number } {
      out.x = wrapDelta(bx - ax, width);
      out.y = by - ay;
      return out;
    },
    wrap(pos: { x: number; y: number }): boolean {
      pos.x = wrapCoord(pos.x, width);
      return false;
    },
    toXYZ(u: number, v: number, out: Vec3): Vec3 {
      const t = u * k;
      out.x = R * Math.cos(t);
      out.y = v;
      out.z = R * Math.sin(t);
      return out;
    },
  });
}

/** Build the surface for a level. Unknown kinds fall back to flat. */
export function makeSurface(kind: SurfaceKind, width: number, height: number): Surface {
  return kind === 'cylinder' ? cylinderSurface(width, height) : flatSurface(width, height);
}
