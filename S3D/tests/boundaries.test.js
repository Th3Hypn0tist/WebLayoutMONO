import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PerspectiveCamera } from '../core/index.js';
import { BOX_INSTANCE_STRIDE, RenderStore } from '../core/render_store.js';
import { distanceFromRay, intersectPlane } from '../core/interaction/plane-drag-controller.js';
import { FrequencyRangeController, OrthogonalFieldSlices, SpeakerNode, SampledFieldPlane } from '../domains/acoustics/index.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('core never imports domains', async () => {
  const pending = [join(root, 'core')];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.name.endsWith('.js')) assert.doesNotMatch(await readFile(path, 'utf8'), /domains\//);
    }
  }
});

test('acoustics modules are independently instantiable', () => {
  const controller = new FrequencyRangeController({ minHz: 20, maxHz: 120, selectedHz: 60, mode: 'single' });
  assert.deepEqual(controller.snapshot(), { minHz: 20, maxHz: 120, selectedHz: 60, mode: 'single' });
  controller.destroy();
});

test('camera center ray points at its target and intersects the floor', () => {
  const camera = new PerspectiveCamera({ position: [0, 4, 4], target: [0, 0, 0] });
  const ray = camera.ray(50, 50, { left: 0, top: 0, width: 100, height: 100 });
  const point = intersectPlane(ray, 0);
  assert.ok(Math.abs(point[0]) < 1e-9);
  assert.ok(Math.abs(point[2]) < 1e-9);
});

test('ray picking measures draggable objects in full 3D', () => {
  const ray = { origin: [0, 0, 0], direction: [0, 0, 1] };
  assert.deepEqual(distanceFromRay(ray, [0, 2, 5]), { distance: 2, along: 5 });
  assert.equal(distanceFromRay(ray, [0, 0, -1]).distance, Infinity);
});

test('speaker movement invalidates dependent field data without waiting for drag end', () => {
  const speaker = new SpeakerNode({ id: 'speaker-1', position: [0, .2, 0] });
  let changes = 0;
  speaker.on('positionChanged', () => changes++);
  const field = new SampledFieldPlane({
    id: 'field',
    field: (x, _y, z) => Math.hypot(x - speaker.position[0], z - speaker.position[2]),
    bounds: { min: [-1, 0, -1], max: [1, 0, 1] },
    resolution: [4, 3],
  });
  field.update();
  assert.equal(field.samples.length, 12);
  speaker.setPosition([.5, .2, .25]);
  field.invalidate();
  field.update();
  assert.equal(changes, 1);
  assert.equal(field.dirty, false);
});

test('orthogonal field slices sample the X, Y and Z planes with one shared range', () => {
  const field = new OrthogonalFieldSlices({
    id: 'volume-slices',
    field: (x, y, z) => x + y + z,
    bounds: { min: [0, 0, 0], max: [4, 3, 2] },
    slices: { x: 1, y: 1.5, z: .5 },
    resolution: { xz: [4, 2], xy: [4, 3], yz: [2, 3] },
  });
  field.update();
  assert.equal(field.samples.length, 26);
  assert.ok(field.samples.some(sample => sample.axis === 'x' && sample.position[0] === 1));
  assert.ok(field.samples.some(sample => sample.axis === 'y' && sample.position[1] === 1.5));
  assert.ok(field.samples.some(sample => sample.axis === 'z' && sample.position[2] === .5));
  assert.ok(field.range[1] > field.range[0]);
  field.setSlice('y', 2);
  assert.equal(field.dirty, true);
});

test('orthogonal field slices distribute transparent slices by axis count', () => {
  const field = new OrthogonalFieldSlices({
    id: 'multi-slices',
    field: (x, y, z) => x + y + z,
    bounds: { min: [0, 0, 0], max: [4, 3, 2] },
    counts: { x: 2, y: 3, z: 0 },
    resolution: { xz: [2, 2], xy: [2, 2], yz: [2, 2] },
    opacity: .35,
  });
  field.update();
  assert.equal(field.samples.length, 20);
  assert.deepEqual([...new Set(field.samples.filter(sample => sample.axis === 'x').map(sample => sample.slice))], [4 / 3, 8 / 3]);
  assert.deepEqual([...new Set(field.samples.filter(sample => sample.axis === 'y').map(sample => sample.slice))], [.75, 1.5, 2.25]);
  assert.equal(field.samples.some(sample => sample.axis === 'z'), false);
  assert.ok(field.samples.every(sample => sample.color[3] === .35));
  field.setSliceCount('z', 2);
  assert.equal(field.dirty, true);
});

test('render store routes alpha boxes into a transparent RGBA batch', () => {
  const store = new RenderStore();
  store.begin(new Float32Array(16));
  store.box([0, 0, 0], [1, 1, 1], [1, .5, 0, .25]);
  store.box([0, 0, 0], [1, 1, 1], [0, 1, 0]);
  const snapshot = store.snapshot();
  assert.equal(snapshot.counts.transparentBoxes, 1);
  assert.equal(snapshot.counts.solidBoxes, 1);
  assert.equal(snapshot.transparentBoxes.length, BOX_INSTANCE_STRIDE);
  assert.ok(Math.abs(snapshot.transparentBoxes[BOX_INSTANCE_STRIDE - 1] - .25) < 1e-6);
});
