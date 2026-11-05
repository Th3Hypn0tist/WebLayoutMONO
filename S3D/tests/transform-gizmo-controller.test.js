import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneObject } from '../core/objects/object.js';
import { BOX_INSTANCE_STRIDE, RenderStore } from '../core/render_store.js';
import { TransformGizmoController, candidatePosition, candidateRotation, positionHandleHit, setCandidatePosition, setCandidateRotation } from '../core/interaction/transform-gizmo-controller.js';

const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

function approximately(actual, expected, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

function approximatelyVector(actual, expected, epsilon = 1e-12) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index += 1) approximately(actual[index], expected[index], epsilon);
}

test('SceneObject exposes reactive rotation state', () => {
  const object = new SceneObject({ id: 'object' });
  let event = null;
  object.on('rotationChanged', value => { event = value; });
  object.setRotation([.1, .2, .3]);
  assert.deepEqual(object.rotation, [.1, .2, .3]);
  assert.deepEqual(event.previous, [0, 0, 0]);
  assert.deepEqual(event.rotation, [.1,.2,.3]);
});

test('RenderStore box instances carry Euler rotation and replicated face color', () => {
  const store = new RenderStore();
  store.begin(identity);
  store.box([1,2,3], [4,5,6], [1,0,.5,.5], false, [.5,.25,.125]);
  const snapshot = store.snapshot();
  assert.equal(snapshot.counts.transparentBoxes, 1);
  assert.equal(snapshot.transparentBoxes.length, BOX_INSTANCE_STRIDE);
  assert.deepEqual([...snapshot.transparentBoxes.slice(0, 9)], [1,2,3,4,5,6,.5,.25,.125]);
  for (let offset = 9; offset < BOX_INSTANCE_STRIDE; offset += 4) {
    assert.deepEqual([...snapshot.transparentBoxes.slice(offset, offset + 4)], [1,0,.5,.5]);
  }
});

test('transform gizmo helpers prefer candidate adapters', () => {
  const candidate = {
    position: [0,0,0], rotation: [0,0,0],
    gizmoGetPosition: () => [1,2,3],
    gizmoGetRotation: () => [.1,.2,.3],
    gizmoSetPosition(value) { this.position = value.map(item => item * 2); return this; },
    gizmoSetRotation(value) { this.rotation = value.map(item => item * 3); return this; },
  };
  assert.deepEqual(candidatePosition(candidate), [1,2,3]);
  assert.deepEqual(candidateRotation(candidate), [.1,.2,.3]);
  setCandidatePosition(candidate, [2,3,4]);
  setCandidateRotation(candidate, [.2,.3,.4]);
  assert.deepEqual(candidate.position, [4,6,8]);
  approximatelyVector(candidate.rotation, [.6,.9,1.2]);
});

test('position gizmo exposes pickable Y and Z handles', () => {
  const center = [0, 0, 0];
  const size = 1;
  const yRay = { origin: [0, .75, -3], direction: [0, 0, 1] };
  const zRay = { origin: [0, 3, .75], direction: [0, -1, 0] };
  assert.equal(positionHandleHit(yRay, center, size)?.handle, 'y');
  assert.equal(positionHandleHit(zRay, center, size)?.handle, 'z');
});

test('Y and Z handle drags constrain motion to the selected axis', () => {
  const listeners = new Map();
  const canvas = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    getBoundingClientRect() { return { width: 800, height: 600 }; },
    hasPointerCapture() { return false; },
  };
  const scene = { addLayer() { return () => {}; } };
  const candidate = {
    position: [1, 2, 3],
    gizmoGetPosition() { return [...this.position]; },
    gizmoSetPosition(value) { this.position = [...value]; return this; },
  };
  const camera = { ray(x, y) { return { origin: [x / 100, y / 100, -5], direction: [0, 0, 1] }; } };
  const controller = new TransformGizmoController(canvas, camera, scene, { enabled: true });

  controller.pointer = { candidate, handle: 'y', startPosition: [1, 2, 3], startAxisParameter: 0 };
  camera.ray = () => ({ origin: [1, 5, -5], direction: [0, 0, 1] });
  controller.positionPointerHandle({ clientX: 0, clientY: 0 });
  assert.deepEqual(candidate.position, [1, 5, 3]);

  candidate.position = [1, 2, 3];
  controller.pointer = { candidate, handle: 'z', startPosition: [1, 2, 3], startAxisParameter: 0 };
  camera.ray = () => ({ origin: [5, 2, 6], direction: [-1, 0, 0] });
  controller.positionPointerHandle({ clientX: 0, clientY: 0 });
  assert.deepEqual(candidate.position, [1, 2, 6]);

  controller.destroy();
});

test('disabling transform gizmos releases active pointer capture immediately', () => {
  let captured = 7;
  const listeners = new Map();
  const canvas = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    hasPointerCapture(id) { return captured === id; },
    releasePointerCapture(id) { if (captured === id) captured = null; },
  };
  const scene = { addLayer() { return () => {}; } };
  const controller = new TransformGizmoController(canvas, {}, scene, { enabled: true });
  controller.pointer = { id: 7 };
  controller.selected = { id: 'selected' };

  controller.setEnabled(false);

  assert.equal(controller.pointer, null);
  assert.equal(controller.selected, null);
  assert.equal(captured, null);
  controller.destroy();
});

test('destroying transform gizmos releases active pointer capture', () => {
  let captured = 11;
  const listeners = new Map();
  const canvas = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    hasPointerCapture(id) { return captured === id; },
    releasePointerCapture(id) { if (captured === id) captured = null; },
  };
  let layerRemoved = false;
  const scene = { addLayer() { return () => { layerRemoved = true; }; } };
  const controller = new TransformGizmoController(canvas, {}, scene, { enabled: true });
  controller.pointer = { id: 11 };
  controller.selected = { id: 'selected' };

  controller.destroy();

  assert.equal(captured, null);
  assert.equal(controller.pointer, null);
  assert.equal(controller.selected, null);
  assert.equal(layerRemoved, true);
  assert.equal(listeners.size, 0);
});
