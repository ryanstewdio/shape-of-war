import { Container, Graphics, Particle, ParticleContainer, Point, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { makeCamera, project, type Projected } from '../../src/render/project';
import { createTiltScene, PARK } from '../../src/render/tiltScene';

const P = (): Projected => ({ x: 0, y: 0, s: 1 });

function scene(): {
  entities: Container;
  view: Container;
  free: Graphics;
  hidden: Container;
  pc: ParticleContainer;
  bullets: ParticleContainer;
  live: Particle;
  parked: Particle;
  bullet: Particle;
  tilt: ReturnType<typeof createTiltScene>;
} {
  const entities = new Container();
  const view = new Container();
  view.position.set(300, -200);
  view.scale.set(1.5);
  view.rotation = 0.7;
  const free = new Graphics();
  free.circle(500, 300, 40).stroke({ width: 2, color: 0xffffff });
  const hidden = new Container();
  hidden.position.set(10, 10);
  hidden.visible = false;
  entities.addChild(view, free, hidden);
  const pc = new ParticleContainer({ texture: Texture.WHITE });
  const live = new Particle({ texture: Texture.WHITE, x: -400, y: 350, scaleX: 2, scaleY: 3 });
  const parked = new Particle({ texture: Texture.WHITE, x: PARK, y: PARK });
  pc.addParticle(live, parked);
  const bullets = new ParticleContainer({ texture: Texture.WHITE });
  const bullet = new Particle({ texture: Texture.WHITE, x: 700, y: -500, scaleX: 1, scaleY: 1 });
  bullets.addParticle(bullet);
  const tilt = createTiltScene({
    billboardParents: [entities],
    particles: [
      { layer: pc, scale: true },
      { layer: bullets, scale: false },
    ],
    freeform: [free],
  });
  return { entities, view, free, hidden, pc, bullets, live, parked, bullet, tilt };
}

describe('tilt scene pass', () => {
  it('off: project touches nothing', () => {
    const s = scene();
    s.tilt.project(makeCamera(0, 1100));
    expect(s.tilt.saved).toBe(0);
    expect(s.view.position.x).toBe(300);
    expect(s.view.scale.x).toBe(1.5);
    expect(s.live.x).toBe(-400);
    s.free.updateLocalTransform();
    expect(s.free.localTransform.a).toBe(1);
    s.tilt.restore();
    expect(s.view.position.y).toBe(-200);
  });

  it('billboards move and scale by depth, keep their rotation, and restore exactly', () => {
    const s = scene();
    const cam = makeCamera(22, 1100);
    const want = project(300, -200, 0, cam, P());
    s.tilt.project(cam);
    expect(s.view.position.x).toBeCloseTo(want.x, 9);
    expect(s.view.position.y).toBeCloseTo(want.y, 9);
    expect(s.view.scale.x).toBeCloseTo(1.5 * want.s, 9);
    expect(s.view.scale.y).toBeCloseTo(1.5 * want.s, 9);
    expect(s.view.rotation).toBe(0.7);
    expect(s.hidden.position.x).toBe(10);
    s.tilt.restore();
    expect(s.view.position.x).toBe(300);
    expect(s.view.position.y).toBe(-200);
    expect(s.view.scale.x).toBe(1.5);
    expect(s.view.scale.y).toBe(1.5);
  });

  it('free form Graphics get the projection linearised at their bounds centre, then restore', () => {
    const s = scene();
    const cam = makeCamera(22, 1100);
    s.tilt.project(cam);
    const want = project(500, 300, 0, cam, P());
    s.free.updateLocalTransform();
    const got = s.free.localTransform.apply(new Point(500, 300));
    expect(got.x).toBeCloseTo(want.x, 6);
    expect(got.y).toBeCloseTo(want.y, 6);
    // A point on the ring is within half a unit of its exact projection.
    const edge = project(540, 300, 0, cam, P());
    const e = s.free.localTransform.apply(new Point(540, 300));
    expect(Math.abs(e.x - edge.x)).toBeLessThan(0.5);
    expect(Math.abs(e.y - edge.y)).toBeLessThan(0.5);
    s.tilt.restore();
    s.free.updateLocalTransform();
    expect(s.free.position.x).toBe(0);
    expect(s.free.position.y).toBe(0);
    expect(s.free.scale.x).toBe(1);
    expect(s.free.scale.y).toBe(1);
    expect(s.free.rotation).toBe(0);
    expect(s.free.skew.x).toBe(0);
    expect(s.free.skew.y).toBe(0);
    expect(s.free.localTransform.a).toBe(1);
    expect(s.free.localTransform.d).toBe(1);
  });

  it('particles: parked left alone, scale only where asked, restore exactly', () => {
    const s = scene();
    const cam = makeCamera(12, 1000);
    const want = project(-400, 350, 0, cam, P());
    const wantB = project(700, -500, 0, cam, P());
    s.tilt.project(cam);
    expect(s.live.x).toBeCloseTo(want.x, 9);
    expect(s.live.y).toBeCloseTo(want.y, 9);
    expect(s.live.scaleX).toBeCloseTo(2 * want.s, 9);
    expect(s.live.scaleY).toBeCloseTo(3 * want.s, 9);
    expect(s.parked.x).toBe(PARK);
    expect(s.parked.y).toBe(PARK);
    expect(s.bullet.x).toBeCloseTo(wantB.x, 9);
    expect(s.bullet.scaleX).toBe(1);
    s.tilt.restore();
    expect(s.live.x).toBe(-400);
    expect(s.live.y).toBe(350);
    expect(s.live.scaleX).toBe(2);
    expect(s.live.scaleY).toBe(3);
    expect(s.bullet.x).toBe(700);
    expect(s.bullet.y).toBe(-500);
  });

  it('a thousand frames of project and restore leave no drift', () => {
    const s = scene();
    const cam = makeCamera(22, 1100);
    // Grow the scene past the first buffer size once; later frames reuse it.
    for (let i = 0; i < 400; i++) s.pc.addParticle(new Particle({ texture: Texture.WHITE, x: i, y: -i }));
    for (let f = 0; f < 1000; f++) {
      s.tilt.project(cam);
      s.tilt.restore();
    }
    expect(s.view.position.x).toBe(300);
    expect(s.view.scale.x).toBe(1.5);
    expect(s.live.x).toBe(-400);
    expect(s.live.scaleY).toBe(3);
    s.free.updateLocalTransform();
    expect(s.free.localTransform.tx).toBe(0);
    const last = s.pc.particleChildren[s.pc.particleChildren.length - 1];
    expect(last?.x).toBe(399);
    expect(last?.y).toBe(-399);
  });
});
