import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOX_EDGE_INDICES,
  BOX_FACE_COLOR_OFFSET,
  BOX_FACE_COLOR_STRIDE,
  BOX_FACE_INDICES,
  BOX_FACE_ORDER,
  BOX_FACES,
  BOX_INSTANCE_STRIDE,
  BOX_INSTANCE_TRANSFORM_STRIDE,
  BOX_VERTICES,
  RenderStore,
  boxFaceIndex,
  boxInstanceHasTransparency,
  writeBoxFaceInstance,
  writeBoxInstance,
} from '../core/index.js';

test('box face order is canonical and axis-addressable', () => {
  assert.deepEqual(BOX_FACE_ORDER, ['z-', 'z+', 'x-', 'x+', 'y-', 'y+']);
  assert.deepEqual(
    BOX_FACES.map(({ id, axis, sign }) => ({ id, axis, sign })),
    [
      { id: 'z-', axis: 'z', sign: -1 },
      { id: 'z+', axis: 'z', sign: 1 },
      { id: 'x-', axis: 'x', sign: -1 },
      { id: 'x+', axis: 'x', sign: 1 },
      { id: 'y-', axis: 'y', sign: -1 },
      { id: 'y+', axis: 'y', sign: 1 },
    ],
  );
});

test('each canonical box face owns exactly two triangles', () => {
  assert.equal(BOX_FACES.length, 6);
  assert.equal(BOX_FACE_INDICES.length, 36);
  for (const face of BOX_FACES) assert.equal(face.indices.length, 6);
  assert.deepEqual(BOX_FACE_INDICES, BOX_FACES.flatMap(face => face.indices));
});

test('box geometry exposes one eight-vertex cube and twelve edges', () => {
  assert.equal(BOX_VERTICES.length, 24);
  assert.equal(BOX_EDGE_INDICES.length, 24);
});

test('boxFaceIndex resolves canonical face ids and rejects unknown faces', () => {
  for (let index = 0; index < BOX_FACE_ORDER.length; index += 1) {
    assert.equal(boxFaceIndex(BOX_FACE_ORDER[index]), index);
  }
  assert.throws(() => boxFaceIndex('front'), /unknown box face: front/);
});

test('packed box layout contains one transform and six canonical RGBA face slots', () => {
  assert.equal(BOX_INSTANCE_TRANSFORM_STRIDE, 9);
  assert.equal(BOX_FACE_COLOR_OFFSET, 9);
  assert.equal(BOX_FACE_COLOR_STRIDE, 4);
  assert.equal(BOX_INSTANCE_STRIDE, 33);
});

test('writeBoxInstance replicates one uniform color into every canonical face slot', () => {
  const instance = new Float32Array(BOX_INSTANCE_STRIDE);
  writeBoxInstance(instance, 0, [1, 2, 3], [4, 5, 6], [.5, .25, .125], [.25, .5, .75, .5]);
  assert.deepEqual([...instance.slice(0, 9)], [1, 2, 3, 4, 5, 6, .5, .25, .125]);
  for (let faceIndex = 0; faceIndex < BOX_FACE_ORDER.length; faceIndex += 1) {
    const offset = BOX_FACE_COLOR_OFFSET + faceIndex * BOX_FACE_COLOR_STRIDE;
    assert.deepEqual([...instance.slice(offset, offset + 4)], [.25, .5, .75, .5]);
  }
  assert.equal(boxInstanceHasTransparency(instance), true);
});

test('writeBoxFaceInstance preserves canonical per-face color order exactly', () => {
  const faceColors = [
    [1, 0, 0, 1],
    [0, 1, 0, 1],
    [0, 0, 1, 1],
    [1, 1, 0, 1],
    [1, 0, 1, 1],
    [0, 1, 1, .25],
  ];
  const instance = new Float32Array(BOX_INSTANCE_STRIDE);
  writeBoxFaceInstance(instance, 0, [0, 0, 0], [1, 1, 1], [0, 0, 0], faceColors);
  for (let faceIndex = 0; faceIndex < BOX_FACE_ORDER.length; faceIndex += 1) {
    const offset = BOX_FACE_COLOR_OFFSET + faceIndex * BOX_FACE_COLOR_STRIDE;
    assert.deepEqual([...instance.slice(offset, offset + 4)], faceColors[faceIndex]);
  }
  assert.equal(boxInstanceHasTransparency(instance), true);
});

test('RenderStore routes a box with one transparent face into the transparent batch', () => {
  const store = new RenderStore();
  store.begin(new Float32Array(16));
  store.boxFaces(
    [0, 0, 0],
    [1, 1, 1],
    [
      [1, 0, 0, 1],
      [0, 1, 0, 1],
      [0, 0, 1, 1],
      [1, 1, 0, 1],
      [1, 0, 1, 1],
      [0, 1, 1, .5],
    ],
  );
  const snapshot = store.snapshot();
  assert.equal(snapshot.counts.solidBoxes, 0);
  assert.equal(snapshot.counts.transparentBoxes, 1);
  assert.equal(snapshot.transparentBoxes.length, BOX_INSTANCE_STRIDE);
});

test('writeBoxFaceInstance rejects partial face color sets', () => {
  const instance = new Float32Array(BOX_INSTANCE_STRIDE);
  assert.throws(
    () => writeBoxFaceInstance(instance, 0, [0, 0, 0], [1, 1, 1], [0, 0, 0], [[1, 1, 1, 1]]),
    /requires 6 face colors in canonical order/,
  );
});
