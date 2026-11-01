import { Container, Graphics, Particle, ParticleContainer, Point, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { BACK_ALPHA, drumProject, makeDrum, type DrumPoint } from '../../src/render/drum';
import { makeCamera } from '../../src/render/project';
import { createTiltScene, PARK, scaleColourAlpha } from '../../src/render/tiltScene';

const W = 1216;
const H = 860;
const P = (): DrumPoint => ({ x: 0, y: 0, s: 1, a: 1, m: 1 });

function scene(): {
  front: Container;
  back: Container;
  free: Graphics;
  pc: ParticleContainer;
  bullets: ParticleContainer;
  live: Particle;
  backP: Particle;
  parked: Particle;
  bullet: Particle;
  tilt: ReturnType<typeof createTiltScene>;
} {
  const entities = new Container();
  const front = new Container();
  front.position.set(120, -200);
  front.scale.set(1.5);
  front.rotation = 0.7;
  const back = new Container();
  back.position.set(W / 2 - 40, 100);
  back.scale.set(2);
  back.rotation = 0.4;
  back.alpha = 0.8;
  const free = new Graphics();
  free.circle(-W / 2 + 30, 50, 20).stroke({ width: 2, color: 0xffffff });
  entities.addChild(front, back, free);
  const pc = new ParticleContainer({ texture: Texture.WHITE, dynamicProperties: { position: true, rotation: true, vertex: true, color: true } });
  const live = new Particle({ texture: Texture.WHITE, x: -300, y: 350, scaleX: 2, scaleY: 3, rotation: 0.3 });
  const backP = new Particle({ texture: Texture.WHITE, x: W / 2 - 10, y: 0, alpha: 0.9, tint: 0x336699 });
  const parked = new Particle({ texture: Texture.WHITE, x: PARK, y: PARK });
  pc.addParticle(live, backP, parked);
  const bullets = new ParticleContainer({ texture: Texture.WHITE });
  const bullet = new Particle({ texture: Texture.WHITE, x: 200, y: -300 });
  bullets.addParticle(bullet);
  const tilt = createTiltScene({
    billboardParents: [entities],
    particles: [
      { layer: pc, scale: true },
      { layer: bullets, scale: false },
    ],
    freeform: [free],
  });
  return { front, back, free, pc, bullets, live, backP, parked, bullet, tilt };
}

describe('drum scene pass', () => {
  it('front billboards move and scale by depth at full alpha; back ones dim, shrink and mirror', () => {
    const s = scene();
    const d = makeDrum(W, H, 0);
    const wf = drumProject(120, -200, 0, d, P());
    const wb = drumProject(W / 2 - 40, 100, 0, d, P());
    s.tilt.projectDrum(d);
    expect(s.front.position.x).toBeCloseTo(wf.x, 9);
    expect(s.front.position.y).toBeCloseTo(wf.y, 9);
    expect(s.front.scale.x).toBeCloseTo(1.5 * wf.s, 9);
    expect(s.front.alpha).toBe(1);
    expect(s.front.rotation).toBe(0.7);
    expect(s.back.position.x).toBeCloseTo(wb.x, 9);
    expect(s.back.alpha).toBeCloseTo(0.8 * BACK_ALPHA, 9);
    expect(s.back.scale.x).toBeCloseTo(-2 * wb.s, 9);
    expect(s.back.scale.y).toBeCloseTo(2 * wb.s, 9);
    expect(s.back.scale.y).toBeLessThan(2 * wf.s);
    expect(s.back.rotation).toBe(-0.4);
    s.tilt.restore();
    expect(s.front.position.x).toBe(120);
    expect(s.back.position.x).toBe(W / 2 - 40);
    expect(s.back.scale.x).toBe(2);
    expect(s.back.alpha).toBe(0.8);
    expect(s.back.rotation).toBe(0.4);
  });

  it('particles: position, scale and back half alpha through the packed colour, restored exactly', () => {
    const s = scene();
    const d = makeDrum(W, H, 12);
    const want = drumProject(-300, 350, 0, d, P());
    const c0 = s.backP.color;
    const b0 = s.bullet.scaleX;
    s.tilt.projectDrum(d);
    expect(s.live.x).toBeCloseTo(want.x, 9);
    expect(s.live.scaleX).toBeCloseTo(2 * want.s, 9);
    expect(s.live.rotation).toBe(0.3);
    expect((s.backP.color >>> 24) & 255).toBe(((((c0 >>> 24) & 255) * BACK_ALPHA) | 0) & 255);
    expect(s.backP.color & 0xffffff).toBe(c0 & 0xffffff);
    expect(s.parked.x).toBe(PARK);
    // A static vertex layer still gets its depth scale (it is re-uploaded this frame).
    expect(s.bullet.scaleX).not.toBe(b0);
    s.tilt.restore();
    expect(s.live.x).toBe(-300);
    expect(s.live.scaleX).toBe(2);
    expect(s.backP.color).toBe(c0);
    expect(s.bullet.scaleX).toBe(b0);
  });

  it('free form Graphics across the seam use the linearisation at their centre', () => {
    const s = scene();
    const d = makeDrum(W, H, 0);
    d.camU = W / 2 - 20;
    s.tilt.projectDrum(d);
    const want = drumProject(-W / 2 + 30, 50, 0, d, P());
    s.free.updateLocalTransform();
    const got = s.free.localTransform.apply(new Point(-W / 2 + 30, 50));
    expect(got.x).toBeCloseTo(want.x, 4);
    expect(got.y).toBeCloseTo(want.y, 4);
    expect(s.free.alpha).toBe(1);
    s.tilt.restore();
    s.free.updateLocalTransform();
    expect(s.free.localTransform.a).toBe(1);
    expect(s.free.localTransform.tx).toBe(0);
  });

  it('flat path unchanged: a recorded frame survives the off pass and a drum frame bit for bit', () => {
    const s = scene();
    const rec = [s.front.position.x, s.front.scale.x, s.back.alpha, s.live.x, s.live.scaleY, s.backP.color, s.bullet.y];
    const now = (): number[] => [s.front.position.x, s.front.scale.x, s.back.alpha, s.live.x, s.live.scaleY, s.backP.color, s.bullet.y];
    s.tilt.project(makeCamera(0, H));
    expect(s.tilt.saved).toBe(0);
    expect(now()).toEqual(rec);
    s.tilt.restore();
    const d = makeDrum(W, H, 22);
    for (let f = 0; f < 200; f++) {
      d.camU = ((f * 37) % W) - W / 2;
      s.tilt.projectDrum(d);
      s.tilt.restore();
    }
    expect(now()).toEqual(rec);
    // And the tilt path still works after drum frames.
    s.tilt.project(makeCamera(22, H));
    s.tilt.restore();
    expect(now()).toEqual(rec);
  });

  it('scaleColourAlpha scales only the alpha byte', () => {
    const p = new Particle({ texture: Texture.WHITE, tint: 0xabcdef, alpha: 1 });
    const c = scaleColourAlpha(p.color, 0.25);
    expect((c >>> 24) & 255).toBe(63);
    expect(c & 0xffffff).toBe(p.color & 0xffffff);
    expect(scaleColourAlpha(p.color, 1) >>> 0).toBe(p.color >>> 0);
  });
});
