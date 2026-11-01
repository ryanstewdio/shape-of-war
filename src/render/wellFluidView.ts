// GW4 fluid whirlpool, GPU side (the flow maths and shader text are in wellFluid.ts). NOVA_SLOTS
// quads, created once: one shared unit square geometry (4 vertices, 6 indices) and one Mesh per slot
// with its own Shader and UniformGroup over the one program, so each nova is exactly one quad and one
// draw. Per frame the renderer places each live quad (position, scale = reach) and writes its
// uniforms in place: nothing is allocated per frame. Hidden quads cost nothing.
import { Buffer, BufferUsage, Container, Geometry, Mesh, Shader, Texture, UniformGroup } from 'pixi.js';
import { NOVA_SLOTS } from './wellNova';
import { FLUID_FRAGMENT, FLUID_VERTEX, rgbUnit } from './wellFluid';

function makeUniforms(): UniformGroup<{
  uTime: { value: number; type: 'f32' };
  uRadius: { value: number; type: 'f32' };
  uSpin: { value: number; type: 'f32' };
  uSeed: { value: number; type: 'f32' };
  uAlpha: { value: number; type: 'f32' };
  uCore: { value: number; type: 'f32' };
  uGlow: { value: number; type: 'f32' };
  uWhite: { value: Float32Array; type: 'vec3<f32>' };
  uHue0: { value: Float32Array; type: 'vec3<f32>' };
  uHue1: { value: Float32Array; type: 'vec3<f32>' };
  uHue2: { value: Float32Array; type: 'vec3<f32>' };
  uHue3: { value: Float32Array; type: 'vec3<f32>' };
}> {
  return new UniformGroup({
    uTime: { value: 0, type: 'f32' },
    uRadius: { value: 1, type: 'f32' },
    uSpin: { value: 1, type: 'f32' },
    uSeed: { value: 0, type: 'f32' },
    uAlpha: { value: 1, type: 'f32' },
    uCore: { value: 1, type: 'f32' },
    uGlow: { value: 1, type: 'f32' },
    uWhite: { value: new Float32Array(3), type: 'vec3<f32>' },
    uHue0: { value: new Float32Array(3), type: 'vec3<f32>' },
    uHue1: { value: new Float32Array(3), type: 'vec3<f32>' },
    uHue2: { value: new Float32Array(3), type: 'vec3<f32>' },
    uHue3: { value: new Float32Array(3), type: 'vec3<f32>' },
  });
}

type FluidUniforms = ReturnType<typeof makeUniforms>;

export interface FluidQuadParams {
  x: number;
  y: number;
  /** Quad half size: the pull radius times the growth. */
  reach: number;
  timeSec: number;
  spin: number;
  seed: number;
  alpha: number;
  core: number;
  /** Neon glow multiplier (from applyNeon's settings). */
  glow: number;
  white: number;
  /** Four palette hues for the refraction fringes. */
  hue0: number;
  hue1: number;
  hue2: number;
  hue3: number;
}

export interface WellFluidView {
  /** Add under the entities (the well bodies, motes and glints draw over it). */
  readonly layer: Container;
  /** Show and set slot k's quad for this frame. */
  set(k: number, p: Readonly<FluidQuadParams>): void;
  /** Start of frame: every quad hidden until set again. */
  hideAll(): void;
  /** Quads shown this frame. */
  readonly shown: number;
  destroy(): void;
}

export function createWellFluidView(): WellFluidView {
  const layer = new Container({ label: 'wellFluid' });
  const pos = new Buffer({ data: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), label: 'fluid-pos', usage: BufferUsage.VERTEX });
  const uv = new Buffer({ data: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), label: 'fluid-uv', usage: BufferUsage.VERTEX });
  const idx = new Buffer({ data: new Uint32Array([0, 1, 2, 0, 2, 3]), label: 'fluid-idx', usage: BufferUsage.INDEX });
  const geom = new Geometry({
    attributes: {
      aPosition: { buffer: pos, format: 'float32x2', stride: 8, offset: 0 },
      aUV: { buffer: uv, format: 'float32x2', stride: 8, offset: 0 },
    },
    indexBuffer: idx,
    topology: 'triangle-list',
  });
  const groups: FluidUniforms[] = [];
  const shaders: Shader[] = [];
  const meshes: Mesh<Geometry, Shader>[] = [];
  for (let k = 0; k < NOVA_SLOTS; k++) {
    const ug = makeUniforms();
    const shader = Shader.from({ gl: { vertex: FLUID_VERTEX, fragment: FLUID_FRAGMENT, name: 'well-fluid' }, resources: { fluidUniforms: ug } });
    const m = new Mesh<Geometry, Shader>({ geometry: geom, shader, texture: Texture.WHITE, label: `wellFluid${k}` });
    m.visible = false;
    groups.push(ug);
    shaders.push(shader);
    meshes.push(m);
    layer.addChild(m);
  }
  let shown = 0;

  function set(k: number, p: Readonly<FluidQuadParams>): void {
    const m = meshes[k];
    const ug = groups[k];
    if (!m || !ug) return;
    if (!m.visible) {
      m.visible = true;
      shown++;
    }
    m.position.set(p.x, p.y);
    m.scale.set(Math.max(1e-3, p.reach));
    const u = ug.uniforms;
    u.uTime = p.timeSec;
    u.uRadius = p.reach;
    u.uSpin = p.spin;
    u.uSeed = p.seed;
    u.uAlpha = p.alpha;
    u.uCore = p.core;
    u.uGlow = p.glow;
    rgbUnit(p.white, u.uWhite);
    rgbUnit(p.hue0, u.uHue0);
    rgbUnit(p.hue1, u.uHue1);
    rgbUnit(p.hue2, u.uHue2);
    rgbUnit(p.hue3, u.uHue3);
  }

  function hideAll(): void {
    if (shown === 0) return;
    for (const m of meshes) m.visible = false;
    shown = 0;
  }

  return {
    layer,
    set,
    hideAll,
    get shown(): number {
      return shown;
    },
    destroy(): void {
      layer.destroy({ children: true });
      for (const s of shaders) s.destroy();
      geom.destroy(false);
      pos.destroy();
      uv.destroy();
      idx.destroy();
    },
  };
}
