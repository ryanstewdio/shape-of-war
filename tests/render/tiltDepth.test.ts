// G6 tilt-depth: the lower angles keep the whole arena (and the raised wall lip) visible, the lip
// geometry, and Off leaves a recorded frame exactly as drawn.
import { Container, Graphics, Particle, ParticleContainer, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { drawWallsProjected } from '../../src/render/grid';
import { FIT_MARGIN } from '../../src/render/layout';
import { cameraFor, fitProjected, project, TILT_DEG, type Projected } from '../../src/render/project';
import { createTiltScene } from '../../src/render/tiltScene';
import { lipPosts, outlinePoints, projectFlat, projectLifted, WALL_LIP } from '../../src/render/tiltGeom';
import { volumeShapeOf } from '../../src/render/volume';
import { createVolumeView } from '../../src/render/volumeView';
import { specForSlot } from '../../src/render/shapeSpecs';
import { arena } from './lattice/fixtures';

describe('lower angles', () => {
  it('low 7 deg and high 13 deg', () => {
    expect(TILT_DEG).toEqual({ off: 0, low: 7, high: 13 });
  });

  const rect = { x: 0, y: 0, w: 1968, h: 1000 };
  for (const shape of ['rect', 'roundRect', 'circle', 'hexagon'] as const) {
    for (const level of ['low', 'high'] as const) {
      it(`keeps a ${shape} arena and its wall lip inside the safe rect at ${level}`, () => {
        const a = arena(shape, shape === 'circle' ? 1100 : 1800, 1100);
        const cam = cameraFor(level, a.height);
        const fit = fitProjected(a.width, a.height, rect, cam);
        const pts = [...projectFlat(outlinePoints(a), cam), ...projectLifted(outlinePoints(a), WALL_LIP, cam)];
        for (let i = 0; i + 1 < pts.length; i += 2) {
          const sx = fit.x + (pts[i] ?? 0) * fit.scale;
          const sy = fit.y + (pts[i + 1] ?? 0) * fit.scale;
          expect(sx).toBeGreaterThanOrEqual(rect.x);
          expect(sx).toBeLessThanOrEqual(rect.x + rect.w);
          expect(sy).toBeGreaterThanOrEqual(rect.y + 0.5 * rect.h * FIT_MARGIN);
          expect(sy).toBeLessThanOrEqual(rect.y + rect.h);
        }
      });
    }
  }
});

describe('wall lip', () => {
  it('the top edge sits up the screen from the floor line, posts at the corners', () => {
    const a = arena('rect', 1800, 1100);
    const cam = cameraFor('high', a.height);
    const flat = outlinePoints(a);
    const base = projectFlat(flat, cam);
    const top = projectLifted(flat, WALL_LIP, cam);
    for (let i = 1; i < base.length; i += 2) expect(top[i] ?? 0).toBeLessThan(base[i] ?? 0);
    expect(lipPosts(flat)).toEqual([0, 1, 2, 3]);
    const circle = outlinePoints(arena('circle', 1100, 1100));
    expect(lipPosts(circle).length).toBe(8);
  });

  it('draws the floor line, the posts and the top edge on the projected walls', () => {
    const g = new Graphics();
    const a = arena('rectObstacles', 1800, 1100, { obstacles: [{ cx: 0, cy: 0, w: 100, h: 60 }] });
    drawWallsProjected(g, a, 0xffffff, [{ width: 2, alpha: 1 }], cameraFor('high', a.height));
    // Per outline: floor line, posts, top edge (three strokes), for the wall and the obstacle.
    const strokes = g.context.instructions.filter((i) => i.action === 'stroke').length;
    expect(strokes).toBe(6);
  });
});

describe('Off equals the current render', () => {
  it('a recorded frame keeps every position, scale and transform exactly, and no volume draws', () => {
    const entities = new Container();
    const views: Container[] = [];
    for (let i = 0; i < 6; i++) {
      const v = new Container();
      v.position.set(-500 + i * 173.25, 300 - i * 97.5);
      v.scale.set(0.8 + i * 0.1);
      v.rotation = i * 0.4;
      entities.addChild(v);
      views.push(v);
    }
    const free = new Graphics();
    free.circle(200, -100, 50).stroke({ width: 2, color: 0xffffff });
    entities.addChild(free);
    const pc = new ParticleContainer({ texture: Texture.WHITE });
    const parts = [new Particle({ texture: Texture.WHITE, x: 120, y: -40 }), new Particle({ texture: Texture.WHITE, x: -333, y: 222, scaleX: 2 })];
    pc.addParticle(...parts);
    const rec = (): number[] => [
      ...views.flatMap((v) => [v.position.x, v.position.y, v.scale.x, v.scale.y, v.rotation]),
      free.position.x,
      free.position.y,
      free.scale.x,
      free.rotation,
      ...parts.flatMap((p) => [p.x, p.y, p.scaleX, p.scaleY]),
    ];
    const before = rec();
    const tilt = createTiltScene({ billboardParents: [entities], particles: [{ layer: pc, scale: true }], freeform: [free] });
    const off = cameraFor('off', 1100);
    const vol = createVolumeView();
    // The renderer's Off frame: the volume layers switch off, the scene pass projects with Off.
    vol.off();
    const shape = volumeShapeOf(specForSlot(1));
    for (const v of views) if (shape) vol.add(shape, v.position.x, v.position.y, v.scale.x, v.rotation, 0xffffff, 1);
    tilt.project(off);
    expect(rec()).toEqual(before);
    tilt.restore();
    expect(rec()).toEqual(before);
    expect(vol.count).toBe(0);
    expect(vol.under.visible).toBe(false);
    expect(vol.under.context.instructions.length).toBe(0);
    // Off projection is the identity anyway.
    const p: Projected = { x: 0, y: 0, s: 1 };
    project(123.5, -77.25, 40, off, p);
    expect(p).toEqual({ x: 123.5, y: -77.25, s: 1 });
  });
});
