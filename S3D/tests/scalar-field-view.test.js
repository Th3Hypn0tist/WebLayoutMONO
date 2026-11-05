import test from 'node:test';
import assert from 'node:assert/strict';
import { ScalarFieldView } from '../domains/acoustics/scalar-field-view.js';
import { SampledFieldPlane } from '../domains/acoustics/sampled-field-plane.js';
import { OrthogonalFieldSlices } from '../domains/acoustics/orthogonal-field-slices.js';

const field = { sample(x, y, z) { return x + y + z; } };

test('ScalarFieldView exposes frequency range aggregation and visibility contract', () => {
  const view = new ScalarFieldView({ id: 'base-view', field });
  const events = [];
  view.on('frequencyChanged', event => events.push(event.type));
  view.on('frequencyRangeChanged', event => events.push(event.type));
  view.on('aggregationChanged', event => events.push(event.type));
  view.setFrequency(63).setFrequencyRange(40, 80).setAggregation('rms').hide().show();
  assert.equal(view.frequency, 63);
  assert.deepEqual(view.frequencyRange, [40, 80]);
  assert.equal(view.aggregation, 'rms');
  assert.equal(view.visible, true);
  assert.deepEqual(events, ['frequencyChanged', 'frequencyRangeChanged', 'aggregationChanged']);
});

test('2D and 3D acoustic views implement ScalarFieldView', () => {
  const plane = new SampledFieldPlane({ id: 'plane', field, bounds: { min: [0, 0, 0], max: [1, 0, 1] }, resolution: [2, 2] });
  const slices = new OrthogonalFieldSlices({ id: 'slices', field, bounds: { min: [0, 0, 0], max: [1, 1, 1] }, counts: { x: 1, y: 1, z: 1 } });
  assert.ok(plane instanceof ScalarFieldView);
  assert.ok(slices instanceof ScalarFieldView);
  plane.setFrequency(50).setAggregation('single');
  slices.setFrequencyRange([40, 80]).setAggregation('peak');
  assert.equal(plane.frequency, 50);
  assert.deepEqual(slices.frequencyRange, [40, 80]);
});
