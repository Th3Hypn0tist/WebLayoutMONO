import test from 'node:test';
import assert from 'node:assert/strict';

import { BOX_INSTANCE_STRIDE, RenderStore } from '../core/render_store.js';
import {
  Dimension,
  Distribution,
  MetricPointCloud,
  MetricSpace,
  Observation,
  RangeSelection,
  VisualEncoding,
} from '../domains/statistics/index.js';

const observations = [
  new Observation({ id: 'a', label: 'A', values: { quality: 20, speed: 10, latency: 200 } }),
  new Observation({ id: 'b', label: 'B', values: { quality: 60, speed: 30, latency: 100 } }),
  new Observation({ id: 'c', label: 'C', values: { quality: 100, speed: 50, latency: 0 } }),
];

function approximately(actual, expected, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test('statistics dimensions project observations into explicit metric space bounds', () => {
  const space = new MetricSpace({
    dimensions: [
      new Dimension({ id: 'quality', domain: [0, 100] }),
      new Dimension({ id: 'speed', domain: [0, 50] }),
      new Dimension({ id: 'latency', domain: [0, 200] }),
    ],
    axes: { x: 'quality', y: 'speed', z: 'latency' },
  });

  const projected = space.project(observations[1]);
  approximately(projected[0], 0.2);
  approximately(projected[1], 0.2);
  approximately(projected[2], 0);
  assert.deepEqual(
    space.project(observations[1], { min: [0, 0, 0], max: [10, 20, 30] }),
    [6, 12, 15],
  );
});

test('MetricSpace.fit derives domains only from supplied observations', () => {
  const space = MetricSpace.fit({
    dimensions: [
      new Dimension({ id: 'quality' }),
      new Dimension({ id: 'speed' }),
      new Dimension({ id: 'latency' }),
    ],
    axes: { x: 'quality', y: 'speed', z: 'latency' },
    observations,
  });

  assert.deepEqual(space.dimension('quality').domain, [20, 100]);
  assert.deepEqual(space.dimension('speed').domain, [10, 50]);
  assert.deepEqual(space.dimension('latency').domain, [0, 200]);
  assert.deepEqual(space.project(observations[1]), [0, 0, 0]);
});

test('constant dimensions have one defined midpoint projection', () => {
  const dimension = new Dimension({ id: 'constant', domain: [4, 4] });
  assert.equal(dimension.normalize(4), 0.5);
  assert.throws(() => dimension.normalize(5), /constant domain/);
});

test('Distribution exposes deterministic descriptive statistics', () => {
  const distribution = new Distribution([1, 2, 3, 4]);
  assert.equal(distribution.summary.count, 4);
  assert.equal(distribution.mean(), 2.5);
  assert.equal(distribution.median(), 2.5);
  assert.equal(distribution.quantile(0.25), 1.75);
  assert.equal(distribution.variance('population'), 1.25);
  approximately(distribution.variance('sample'), 5 / 3);
});

test('RangeSelection filters observations without interpreting metadata', () => {
  const selection = new RangeSelection({
    quality: [50, 100],
    latency: [0, 120],
  });
  assert.deepEqual(selection.filter(observations).map(item => item.id), ['b', 'c']);
});

test('VisualEncoding maps numeric dimensions into independent visual channels', () => {
  const space = new MetricSpace({
    dimensions: [
      new Dimension({ id: 'quality', domain: [0, 100] }),
      new Dimension({ id: 'speed', domain: [0, 50] }),
      new Dimension({ id: 'latency', domain: [0, 200] }),
    ],
    axes: { x: 'quality', y: 'speed', z: 'latency' },
  });
  const encoding = new VisualEncoding({
    bindings: {
      'position.x': { dimension: 'quality', range: [-10, 10] },
      'rotation.y': { dimension: 'latency', range: [0, Math.PI] },
      'scale.z': { dimension: 'speed', range: [0.1, 2.1] },
      'color.r': { dimension: 'quality', range: [0, 1] },
      'color.b': { dimension: 'latency', range: [1, 0] },
    },
  });
  const encoded = encoding.encode(observations[1], space, {
    position: [0, 2, 3],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: [0.2, 0.4, 0.6, 1],
  });
  assert.deepEqual(encoded.position, [2, 2, 3]);
  approximately(encoded.rotation[1], Math.PI / 2);
  approximately(encoded.scale[2], 1.3);
  approximately(encoded.color[0], 0.6);
  assert.equal(encoded.color[1], 0.4);
  approximately(encoded.color[2], 0.5);
  assert.equal(encoded.color[3], 1);
});

test('RenderStore accepts packed box instances as one bulk append', () => {
  const store = new RenderStore();
  store.begin(new Float32Array(16));
  const count = 4096;
  const instances = new Float32Array(count * BOX_INSTANCE_STRIDE);
  store.boxInstances(instances, 'solid');
  const snapshot = store.snapshot();
  assert.equal(snapshot.counts.solidBoxes, count);
  assert.equal(snapshot.solidBoxes.length, count * BOX_INSTANCE_STRIDE);
});

test('MetricPointCloud submits cached packed instance buffers instead of one draw call per observation', () => {
  const space = MetricSpace.fit({
    dimensions: [
      new Dimension({ id: 'quality' }),
      new Dimension({ id: 'speed' }),
      new Dimension({ id: 'latency' }),
    ],
    axes: { x: 'quality', y: 'speed', z: 'latency' },
    observations,
  });
  const cloud = new MetricPointCloud({ id: 'cloud', space, observations, showAxes: false });
  const calls = [];
  const renderer = {
    boxInstances(instances, kind) { calls.push({ instances, kind }); },
  };
  cloud.draw(renderer);
  cloud.draw(renderer);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].instances.length, observations.length * BOX_INSTANCE_STRIDE);
  assert.strictEqual(calls[0].instances, calls[1].instances);
  assert.equal(calls[0].kind, 'solid');
});

test('MetricPointCloud writes visual encodings directly into packed instances', () => {
  const space = new MetricSpace({
    dimensions: [
      new Dimension({ id: 'quality', domain: [0, 100] }),
      new Dimension({ id: 'speed', domain: [0, 50] }),
      new Dimension({ id: 'latency', domain: [0, 200] }),
    ],
    axes: { x: 'quality', y: 'speed', z: 'latency' },
  });
  const visualEncoding = new VisualEncoding({
    bindings: {
      'rotation.x': { dimension: 'quality', range: [0, 1] },
      'scale.y': { dimension: 'speed', range: [0.5, 1.5] },
      'color.g': { dimension: 'latency', range: [0, 1] },
    },
  });
  const cloud = new MetricPointCloud({
    id: 'encoded-cloud',
    space,
    observations,
    visualEncoding,
    showAxes: false,
  });
  const calls = [];
  cloud.draw({ boxInstances(instances, kind) { calls.push({ instances, kind }); } });
  assert.equal(calls.length, 1);
  const b = BOX_INSTANCE_STRIDE;
  approximately(calls[0].instances[b + 6], 0.6, 1e-6);
  approximately(calls[0].instances[b + 4], 1.1, 1e-6);
  approximately(calls[0].instances[b + 10], 0.5, 1e-6);
  assert.equal(calls[0].instances.length, observations.length * BOX_INSTANCE_STRIDE);
});

test('MetricPointCloud renders selection as a second small instanced overlay', () => {
  const space = MetricSpace.fit({
    dimensions: [
      new Dimension({ id: 'quality' }),
      new Dimension({ id: 'speed' }),
      new Dimension({ id: 'latency' }),
    ],
    axes: { x: 'quality', y: 'speed', z: 'latency' },
    observations,
  });
  const cloud = new MetricPointCloud({ id: 'cloud', space, observations });
  cloud.select(['b']);

  const store = new RenderStore();
  store.begin(new Float32Array(16));
  cloud.draw(store);
  const snapshot = store.snapshot();

  assert.equal(snapshot.counts.solidBoxes, 4);
  assert.equal(snapshot.counts.lineVertices, 6);
  assert.equal(cloud.nearest([0, 0, 0]).observation.id, 'b');
  assert.deepEqual(cloud.projectedPoints().filter(point => point.selected).map(point => point.observation.id), ['b']);
});

test('MetricPointCloud rejects selection ids not present in the dataset', () => {
  const space = MetricSpace.fit({
    dimensions: [
      new Dimension({ id: 'quality' }),
      new Dimension({ id: 'speed' }),
      new Dimension({ id: 'latency' }),
    ],
    axes: { x: 'quality', y: 'speed', z: 'latency' },
    observations,
  });
  const cloud = new MetricPointCloud({ id: 'cloud', space, observations });
  assert.throws(() => cloud.select(['missing']), /unknown observation/);
});
