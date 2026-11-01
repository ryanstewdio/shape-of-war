// GW4 fluid whirlpool: the flow parameters and the shader source for the nova well quad. Pure: no
// pixi.js import, so the helpers and the shader text are unit tested here; wellFluidView.ts owns the
// GPU side. Each nova well (at most NOVA_SLOTS) is one quad sized to its pull radius. The fragment
// shader works in the quad's unit disc: it samples 3 octave value noise (domain warped) at the
// point the gas came from, so white gas (hsl 0 0 95 percent) streams, curls and shears like liquid
// spiralling down a drain. The source point is the pixel turned back against a clockwise angular
// speed that rises toward the core (fluidOmega) and pushed out by an inward radial drift
// (fluidSourceRadius). Advection time runs in two staggered cycles of FLUID_CYCLE seconds that cross
// fade (fluidPhaseWeights), so the shear never winds up without bound. The gas is densest near the
// core, fades to nothing at the pull radius edge (fluidEdgeFade) and carries a bright core and thin
// prismatic refraction fringes along the gas band edges in the palette hues.
// GW5 galaxy: the flow runs at GALAXY_SPEED (1.3x angular speed and inward drift). The gas is
// brighter and denser, a soft additive glow pass (a low frequency noise sample advected with the
// gas) lifts the white without raising the alpha as much, a broad galactic core bulge sits under the
// tight core, and GALAXY_ARMS log spiral arms of brighter gas (the same spiral the motes ride, turned
// by uArm) carry dark dust lanes just off their crests.

import type { EffectsTier } from './effects';
import { GALAXY_ARMS, GALAXY_SPEED, WHIRL_CW, WHIRL_HAZE, WHIRL_TWIST, WHIRL_VISUAL } from './wellNova';

/** Pure: Standard and High draw the nova gas with the shader quad; Low keeps the geometry path. */
export function fluidShaderOn(tier: EffectsTier): boolean {
  return tier !== 'low';
}

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** Clockwise on screen: with y pointing down, an increasing atan2 angle turns clockwise. */
export const FLUID_CW = 1;
/**
 * Angular speed profile omega(u) = spin x (FLUID_OMEGA_BASE + FLUID_OMEGA_RISE / (u + FLUID_OMEGA_SOFT))
 * at radius share u (0 core, 1 edge): 1 rad/s at the edge and about 4.7 rad/s at share 0.12, the
 * same as the GW2 whirlpool, with a soft core so it stays finite at the centre.
 */
export const FLUID_OMEGA_SOFT = 0.08;
export const FLUID_OMEGA_RISE = 0.908;
export const FLUID_OMEGA_BASE = 1 - FLUID_OMEGA_RISE / (1 + FLUID_OMEGA_SOFT);
/** Inward radial drift rate (1/s): gas falls from the edge to share 0.12 in about 2 s. */
export const FLUID_DRIFT = Math.log(1 / 0.12) / 2;
/** Advection cycle (s): two cycles offset by half cross fade so the shear stays bounded. */
export const FLUID_CYCLE = 1.6;
/** World units per noise cell, the domain warp strength (cells) and the octave count. */
export const FLUID_SCALE = 46;
export const FLUID_WARP = 0.85;
export const FLUID_OCTAVES = 3;
/** The gas fades from this radius share to nothing at the edge. */
export const FLUID_EDGE0 = 0.7;
/** Core glow radius share. */
export const FLUID_CORE = 0.16;
/** Refraction fringe half width (in noise value) and its strength. */
export const FLUID_FRINGE_W = 0.022;
export const FLUID_FRINGE_A = 0.32;
/** GW5: flow speed multiplier on the angular speed and the inward drift (1.3x GW4). */
export const FLUID_SPEED = GALAXY_SPEED;
/** GW5: galactic core bulge radius share and strength. */
export const FLUID_BULGE = 0.3;
export const FLUID_BULGE_A = 0.42;
/** GW5: soft additive glow pass strength and its noise scale (x the gas noise frequency). */
export const FLUID_GLOW_A = 0.34;
export const FLUID_GLOW_SCALE = 0.42;
/** GW5: arm brightening, the dust lane depth, and the lane offset (rad of arm phase) behind the crest. */
export const FLUID_ARM_A = 0.55;
export const FLUID_LANE = 0.72;
export const FLUID_LANE_OFF = 1.15;

/** GW6: the gas disc is WHIRL_VISUAL of the quad (the pull radius); a faint haze fills the rest. */
export const FLUID_VISUAL = WHIRL_VISUAL;
export const FLUID_HAZE = WHIRL_HAZE;
/** GW6: gas and glow brightness multiplier inside the smaller disc (same noise, denser light). */
export const FLUID_BRIGHT = 1.18;

/** Pure: haze alpha outside the visual disc at quad radius share r (0 inside the disc, FLUID_HAZE just outside, 0 at the pull radius). */
export function fluidHaze(r: number): number {
  const c = fin(r, 1);
  if (c <= FLUID_VISUAL || c >= 1) return 0;
  const v = (c - FLUID_VISUAL) / (1 - FLUID_VISUAL);
  return FLUID_HAZE * (1 - v * v * (3 - 2 * v));
}

/** Pure: angular speed (rad/s, positive is clockwise on screen) at radius share u for a spin. */
export function fluidOmega(u: number, spin = 1): number {
  const c = Math.max(0, Math.min(1, fin(u, 1)));
  return FLUID_CW * FLUID_SPEED * fin(spin, 1) * (FLUID_OMEGA_BASE + FLUID_OMEGA_RISE / (c + FLUID_OMEGA_SOFT));
}

/** Pure: the angle gas at (theta, share u) had tau seconds ago (turned back against the flow). */
export function fluidSourceAngle(theta: number, u: number, tau: number, spin = 1): number {
  return fin(theta, 0) - fluidOmega(u, spin) * fin(tau, 0);
}

/** Pure: the radius share gas at share u had tau seconds ago (it drifts inward, so it was further out). */
export function fluidSourceRadius(u: number, tau: number): number {
  return Math.max(0, fin(u, 0)) * Math.exp(FLUID_DRIFT * FLUID_SPEED * Math.max(0, fin(tau, 0)));
}

/** Pure: edge fade 1 inside FLUID_EDGE0, smoothly to 0 at the pull radius (share 1) and beyond. */
export function fluidEdgeFade(u: number): number {
  const c = fin(u, 1);
  if (c <= FLUID_EDGE0) return 1;
  if (c >= 1) return 0;
  const v = (c - FLUID_EDGE0) / (1 - FLUID_EDGE0);
  return 1 - v * v * (3 - 2 * v);
}

/** Pure: gas density at radius share u: densest at the core, thinning toward the edge. */
export function fluidDensity(u: number): number {
  const c = Math.max(0, Math.min(1, fin(u, 1)));
  return 1 - 0.65 * c;
}

/**
 * Pure: the two advection cycles at timeSec, written into out as [tau1, weight1, tau2, weight2]:
 * each cycle's own advection time (0 to FLUID_CYCLE) and its cross fade weight (0 when that cycle
 * restarts, 1 at its middle). The weights sum to 1. Allocates nothing.
 */
export function fluidPhaseWeights(timeSec: number, out: Float32Array): Float32Array {
  const ph = fin(timeSec, 0) / FLUID_CYCLE;
  const f1 = ph - Math.floor(ph);
  const p2 = ph + 0.5;
  const f2 = p2 - Math.floor(p2);
  const w1 = 1 - Math.abs(2 * f1 - 1);
  out[0] = f1 * FLUID_CYCLE;
  out[1] = w1;
  out[2] = f2 * FLUID_CYCLE;
  out[3] = 1 - w1;
  return out;
}

/** Pure: 0xRRGGBB to r, g, b in 0 to 1 written into out at offset o. */
export function rgbUnit(c: number, out: Float32Array, o = 0): Float32Array {
  const v = Math.max(0, Math.floor(fin(c, 0))) & 0xffffff;
  out[o] = ((v >> 16) & 0xff) / 255;
  out[o + 1] = ((v >> 8) & 0xff) / 255;
  out[o + 2] = (v & 0xff) / 255;
  return out;
}

function glf(v: number): string {
  const s = String(v);
  return s.includes('.') || s.includes('e') ? s : `${s}.0`;
}

/** The uniforms the fluid shader declares (all f32 or vec3 f32). */
export const FLUID_UNIFORMS: readonly string[] = ['uTime', 'uRadius', 'uSpin', 'uSeed', 'uAlpha', 'uCore', 'uGlow', 'uWhite', 'uHue0', 'uHue1', 'uHue2', 'uHue3', 'uArm'];

/**
 * Vertex shader: the quad's corners are the unit square -1 to 1 (the mesh scale is the reach), passed
 * on as the disc coordinate. Written like pixi's own programs (no version line, GlProgram adds the
 * defines) with the GlMeshAdaptor uniform names, as latticeView's heat shader.
 */
export const FLUID_VERTEX = `
in vec2 aPosition;

out vec2 vPos;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform vec4 uWorldColorAlpha;
uniform mat3 uTransformMatrix;

void main(void) {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vPos = aPosition;
}
`;

/** Fragment shader: polar domain warped flow noise, premultiplied alpha out. */
export const FLUID_FRAGMENT = `
in vec2 vPos;

out vec4 finalColor;

uniform float uTime;
uniform float uRadius;
uniform float uSpin;
uniform float uSeed;
uniform float uAlpha;
uniform float uCore;
uniform float uGlow;
uniform vec3 uWhite;
uniform vec3 uHue0;
uniform vec3 uHue1;
uniform vec3 uHue2;
uniform vec3 uHue3;
uniform float uArm;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < ${FLUID_OCTAVES}; i++) {
        s += a * vnoise(p);
        p = p * 2.03 + vec2(1.7, 9.2);
        a *= 0.5;
    }
    return s / ${glf(1 - Math.pow(0.5, FLUID_OCTAVES))};
}

vec2 layer(vec2 q, float r, float tau, float salt) {
    float w = ${glf(FLUID_SPEED)} * uSpin * (${glf(FLUID_OMEGA_BASE)} + ${glf(FLUID_OMEGA_RISE)} / (r + ${glf(FLUID_OMEGA_SOFT)}));
    float ang = ${glf(-FLUID_CW)} * w * tau;
    float c = cos(ang);
    float s = sin(ang);
    float k = exp(${glf(FLUID_DRIFT * FLUID_SPEED)} * tau);
    vec2 src = vec2(c * q.x - s * q.y, s * q.x + c * q.y) * k;
    vec2 p = src * (uRadius * ${glf(FLUID_VISUAL)} / ${glf(FLUID_SCALE)}) + vec2(uSeed * 17.0 + salt * 31.7, uSeed * 5.3 - salt * 13.1);
    vec2 warp = vec2(vnoise(p * 0.7 + 3.1), vnoise(p * 0.7 - 7.7)) - 0.5;
    float glow = vnoise(p * ${glf(FLUID_GLOW_SCALE)} + warp + 5.3);
    return vec2(fbm(p + ${glf(FLUID_WARP)} * 2.0 * warp), glow);
}

vec3 hueRing(float h) {
    float v = h * 4.0;
    vec3 c = mix(uHue0, uHue1, clamp(v, 0.0, 1.0));
    c = mix(c, uHue2, clamp(v - 1.0, 0.0, 1.0));
    c = mix(c, uHue3, clamp(v - 2.0, 0.0, 1.0));
    return mix(c, uHue0, clamp(v - 3.0, 0.0, 1.0));
}

void main(void) {
    float r0 = length(vPos);
    if (r0 >= 1.0) {
        finalColor = vec4(0.0);
        return;
    }
    // GW6: the disc is the inner share of the quad; outside it only a faint haze hints the pull area.
    if (r0 > ${glf(FLUID_VISUAL)}) {
        float hv = (r0 - ${glf(FLUID_VISUAL)}) / ${glf(1 - FLUID_VISUAL)};
        float ha = ${glf(FLUID_HAZE)} * (1.0 - hv * hv * (3.0 - 2.0 * hv));
        finalColor = vec4(uWhite * ha, ha) * uAlpha;
        return;
    }
    vec2 q = vPos / ${glf(FLUID_VISUAL)};
    float r = length(q);
    float ph = uTime / ${glf(FLUID_CYCLE)};
    float f1 = fract(ph);
    float f2 = fract(ph + 0.5);
    float w1 = 1.0 - abs(2.0 * f1 - 1.0);
    float w2 = 1.0 - w1;
    vec2 l1 = layer(q, r, f1 * ${glf(FLUID_CYCLE)}, floor(ph));
    vec2 l2 = layer(q, r, f2 * ${glf(FLUID_CYCLE)}, floor(ph + 0.5) + 0.5);
    float wn = sqrt(w1 * w1 + w2 * w2);
    // Variance keeping cross fade, so the gas keeps its contrast mid fade.
    float n = 0.5 + ((l1.x - 0.5) * w1 + (l2.x - 0.5) * w2) / wn;
    float gl = 0.5 + ((l1.y - 0.5) * w1 + (l2.y - 0.5) * w2) / wn;
    float edge = 1.0 - smoothstep(${glf(FLUID_EDGE0)}, 1.0, r);
    float dens = 1.0 - 0.6 * r;
    // Galaxy arms: the motes' log spiral turned by uArm, roughened by the gas noise.
    float th = atan(q.y, q.x);
    float sr = max(r, ${glf(0.12)});
    float armPh = ${glf(GALAXY_ARMS)} * (th - uArm - ${glf(WHIRL_CW * WHIRL_TWIST)} * log(1.0 / sr)) + (n - 0.5) * 1.6;
    float arm = smoothstep(0.35, 1.0, 0.5 + 0.5 * cos(armPh)) * smoothstep(0.08, 0.3, r);
    float lane = smoothstep(0.7, 1.0, 0.5 + 0.5 * cos(armPh + ${glf(FLUID_LANE_OFF)})) * (1.0 - arm) * smoothstep(0.14, 0.4, r);
    float gas = smoothstep(0.36, 0.74, n);
    float fil = smoothstep(0.66, 0.9, n) * (1.0 - r);
    float aGas = (0.16 + 0.6 * gas + 0.42 * fil + ${glf(FLUID_ARM_A)} * arm * (0.5 + gas)) * dens * edge * (0.8 + 0.5 * uGlow) * ${glf(FLUID_BRIGHT)};
    aGas *= 1.0 - ${glf(FLUID_LANE)} * lane;
    // Soft additive glow pass: low frequency gas light, more colour than cover.
    float glow = smoothstep(0.3, 0.85, gl) * (0.55 + 0.45 * arm) * dens * edge * ${glf(FLUID_GLOW_A)} * (0.6 + 0.4 * uGlow) * ${glf(FLUID_BRIGHT)};
    float fr = (1.0 - smoothstep(0.0, ${glf(FLUID_FRINGE_W)}, abs(n - 0.56))) * edge * (0.35 + 0.65 * r);
    float hue = fract(n * 3.0 + atan(q.y, q.x) * 0.1592 + uTime * 0.25);
    float aFr = fr * ${glf(FLUID_FRINGE_A)} * uGlow;
    float aCore = exp(-r * r / ${glf(FLUID_CORE * FLUID_CORE)}) * uCore;
    float aBulge = exp(-r * r / ${glf(FLUID_BULGE * FLUID_BULGE)}) * ${glf(FLUID_BULGE_A)} * (0.6 + 0.4 * uCore);
    vec3 rgb = uWhite * (aGas + aBulge) + hueRing(hue) * aFr + vec3(aCore);
    float a = clamp(aGas + aFr + aCore + aBulge, 0.0, 1.0);
    // Premultiplied out: the glow adds light (rgb above alpha blends additively) for half its cover.
    rgb = min(rgb, vec3(a)) + (uWhite * 0.6 + 0.4) * glow;
    a = clamp(a + 0.5 * glow, 0.0, 1.0);
    finalColor = vec4(min(rgb, vec3(1.0)), a) * uAlpha;
}
`;
