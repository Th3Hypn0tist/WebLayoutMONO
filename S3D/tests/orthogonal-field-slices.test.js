import test from 'node:test';
import assert from 'node:assert/strict';
import { evenSliceFractions, OrthogonalFieldSlices } from '../domains/acoustics/orthogonal-field-slices.js';

const field = { sample: (x, y, z) => x + y + z };
const bounds = { min: [0, 0, 0], max: [2, 2, 2] };

test('OrthogonalFieldSlices supports per-axis opacity', () => {
  const slices = new OrthogonalFieldSlices({
    id: 'field',
    field,
    bounds,
    counts: { x: 1, y: 1, z: 1 },
    opacities: { x: .1, y: .35, z: .7 },
    resolution: { xz: [2, 2], xy: [2, 2], yz: [2, 2] },
  });
  slices.rebuild();
  for (const axis of ['x', 'y', 'z']) {
    const expected = { x: .1, y: .35, z: .7 }[axis];
    assert.ok(slices.samples.filter(sample => sample.axis === axis).every(sample => sample.color[3] === expected));
  }
});

test('setAxisOpacity only changes the selected axis', () => {
  const slices = new OrthogonalFieldSlices({
    id: 'field', field, bounds, opacity: .25,
    resolution: { xz: [2, 2], xy: [2, 2], yz: [2, 2] },
  });
  slices.setAxisOpacity('y', .8).rebuild();
  assert.equal(slices.opacities.x, .25);
  assert.equal(slices.opacities.y, .8);
  assert.equal(slices.opacities.z, .25);
});

test('setOpacity remains a global convenience setter', () => {
  const slices = new OrthogonalFieldSlices({ id: 'field', field, bounds });
  slices.setOpacity(.4);
  assert.deepEqual(slices.opacities, { x: .4, y: .4, z: .4 });
});

test('slice fractions are redistributed evenly whenever count changes', () => {
  assert.deepEqual(evenSliceFractions(2), [1 / 3, 2 / 3]);
  assert.deepEqual(evenSliceFractions(3), [1 / 4, 2 / 4, 3 / 4]);
  assert.deepEqual(evenSliceFractions(4), [1 / 5, 2 / 5, 3 / 5, 4 / 5]);
});

test('all axes use the same even relative distribution', () => {
  const slices = new OrthogonalFieldSlices({ id: 'field', field, bounds, counts: { x: 4, y: 4, z: 4 } });
  for (const axis of ['x', 'y', 'z']) assert.deepEqual(slices.slicePositions(axis), [.4, .8, 1.2, 1.6]);
});
