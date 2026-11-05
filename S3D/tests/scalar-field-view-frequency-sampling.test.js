import test from 'node:test';
import assert from 'node:assert/strict';
import { SampledFieldPlane } from '../domains/acoustics/sampled-field-plane.js';
import { OrthogonalFieldSlices } from '../domains/acoustics/orthogonal-field-slices.js';

const frequencyField = {
  sample(x, y, z, frequencyHz) { return Number(frequencyHz ?? 0); },
};

test('SampledFieldPlane setFrequency drives field sampling', () => {
  const view = new SampledFieldPlane({
    id: 'frequency-plane',
    field: frequencyField,
    bounds: { min: [0, 0, 0], max: [1, 0, 1] },
    resolution: [2, 2],
  });
  view.setFrequency(63);
  view.update();
  assert.deepEqual(view.samples.map(sample => sample.value), [63, 63, 63, 63]);
});

test('SampledFieldPlane aggregates configured frequency range', () => {
  const view = new SampledFieldPlane({
    id: 'range-plane',
    field: frequencyField,
    bounds: { min: [0, 0, 0], max: [1, 0, 1] },
    resolution: [2, 2],
  });
  view.setFrequencyRange(20, 40).setFrequencySampleCount(3).setAggregation('rms');
  view.update();
  const expected = Math.sqrt((20 ** 2 + 30 ** 2 + 40 ** 2) / 3);
  assert.ok(view.samples.every(sample => Math.abs(sample.value - expected) < 1e-9));
});

test('OrthogonalFieldSlices uses the same ScalarFieldView frequency path', () => {
  const view = new OrthogonalFieldSlices({
    id: 'frequency-slices',
    field: frequencyField,
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
    counts: { x: 1, y: 0, z: 0 },
    resolution: { yz: [2, 2] },
  });
  view.setFrequency(80);
  view.update();
  assert.equal(view.samples.length, 4);
  assert.ok(view.samples.every(sample => sample.value === 80));
});
