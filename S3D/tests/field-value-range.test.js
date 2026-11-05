import test from 'node:test';
import assert from 'node:assert/strict';
import { FieldViewRangeCoordinator } from '../domains/acoustics/field-view-range-coordinator.js';
import { SampledFieldPlane } from '../domains/acoustics/sampled-field-plane.js';
import { MAX_SLICES_PER_AXIS, OrthogonalFieldSlices } from '../domains/acoustics/orthogonal-field-slices.js';

const field = { sample: (x, y, z) => x + y + z };

test('SampledFieldPlane can recolor existing samples with an explicit shared range', () => {
  const view = new SampledFieldPlane({ id: 'plane-range', field, bounds: { min: [0, 0, 0], max: [2, 0, 2] }, resolution: [2, 2] });
  view.rebuild();
  assert.deepEqual(view.sampleRange, [1, 3]);
  const valuesBefore = view.samples.map(sample => sample.value);
  view.setRange([0, 10]);
  assert.deepEqual(view.range, [0, 10]);
  assert.deepEqual(view.samples.map(sample => sample.value), valuesBefore);
  assert.equal(view.dirty, false);
});

test('OrthogonalFieldSlices exposes sample range separately from the shared display range', () => {
  const view = new OrthogonalFieldSlices({
    id: 'slice-range',
    field,
    bounds: { min: [0, 0, 0], max: [2, 2, 2] },
    counts: { x: 1, y: 1, z: 1 },
    resolution: { xz: [2, 2], xy: [2, 2], yz: [2, 2] },
  });
  view.rebuild();
  const sampled = [...view.sampleRange];
  view.setRange([0, 12]);
  assert.deepEqual(view.sampleRange, sampled);
  assert.deepEqual(view.range, [0, 12]);
  assert.equal(view.dirty, false);
});

test('increasing slice count redistributes slice positions evenly', () => {
  const view = new OrthogonalFieldSlices({
    id: 'slice-position',
    field,
    bounds: { min: [0, 0, 0], max: [8, 4, 6] },
    counts: { x: 2, y: 0, z: 0 },
    resolution: { yz: [2, 2] },
  });
  assert.deepEqual(view.slicePositions('x'), [8 / 3, 16 / 3]);
  view.setSliceCount('x', 3);
  assert.deepEqual(view.slicePositions('x'), [2, 4, 6]);
});

test('changing slice count resamples the complete redistributed topology', () => {
  let sampleCount = 0;
  const countedField = { sample: (x, y, z) => { sampleCount += 1; return x + y + z; } };
  const view = new OrthogonalFieldSlices({
    id: 'slice-sampling',
    field: countedField,
    bounds: { min: [0, 0, 0], max: [8, 4, 6] },
    counts: { x: 2, y: 0, z: 0 },
    resolution: { yz: [2, 2] },
  });
  view.rebuild();
  const firstPass = sampleCount;
  assert.equal(firstPass, 8);
  view.setSliceCount('x', 3);
  view.rebuild();
  assert.equal(sampleCount - firstPass, 12);
});

test('slice count is limited to ten per axis', () => {
  const view = new OrthogonalFieldSlices({ id: 'slice-limit', field, bounds: { min: [0, 0, 0], max: [2, 2, 2] } });
  assert.equal(MAX_SLICES_PER_AXIS, 10);
  assert.doesNotThrow(() => view.setSliceCount('x', 10));
  assert.throws(() => view.setSliceCount('x', 11), /0 to 10/);
});

test('shared range stays stable when only slice topology changes', () => {
  const heatmap = new SampledFieldPlane({ field, id: '2d', bounds: { min: [0, 0, 0], max: [2, 0, 2] }, resolution: [2, 2] });
  const slices = new OrthogonalFieldSlices({
    field: { sample: (x, y, z) => x + y + z + (x > 1 ? 100 : 0) },
    id: '3d',
    bounds: { min: [0, 0, 0], max: [2, 2, 2] },
    counts: { x: 1, y: 0, z: 0 },
    resolution: { yz: [2, 2] },
  });
  const coordinator = new FieldViewRangeCoordinator({ views: [heatmap, slices] });
  heatmap.visible = true;
  slices.visible = true;
  coordinator.update();
  const initial = [...coordinator.range];
  const heatmapColors = heatmap.samples.map(sample => [...sample.color]);

  slices.setSliceCount('x', 2);
  coordinator.invalidate();
  coordinator.update();

  assert.deepEqual(coordinator.range, initial);
  assert.deepEqual(heatmap.samples.map(sample => sample.color), heatmapColors);
});

test('shared range does not shrink when the same analysis is attenuated', () => {
  let gain = 1;
  const attenuatedField = { sample: (x, y, z) => gain * (x + z + 1) };
  const heatmap = new SampledFieldPlane({ field: attenuatedField, id: '2d', frequency: 63, bounds: { min: [0, 0, 0], max: [2, 0, 2] }, resolution: [2, 2] });
  const coordinator = new FieldViewRangeCoordinator({ views: [heatmap] });
  coordinator.update();
  const initial = [...coordinator.range];
  gain = .25;
  heatmap.invalidate();
  coordinator.invalidate();
  coordinator.update();
  assert.deepEqual(coordinator.range, initial);
  assert.ok(heatmap.sampleRange[1] < initial[1]);
});

test('changing analysis frequency establishes a new display range', () => {
  let gain = 1;
  const changingField = { sample: (x, y, z) => gain * (x + z + 1) };
  const heatmap = new SampledFieldPlane({ field: changingField, id: '2d', frequency: 63, bounds: { min: [0, 0, 0], max: [2, 0, 2] }, resolution: [2, 2] });
  const coordinator = new FieldViewRangeCoordinator({ views: [heatmap] });
  coordinator.update();
  const initial = [...coordinator.range];
  gain = .25;
  heatmap.setFrequency(80);
  coordinator.invalidate();
  coordinator.update();
  assert.ok(coordinator.range[1] < initial[1]);
  assert.deepEqual(coordinator.range, heatmap.sampleRange);
});

test('explicit reset allows same-analysis range to normalize again', () => {
  let gain = 1;
  const changingField = { sample: (x, y, z) => gain * (x + z + 1) };
  const heatmap = new SampledFieldPlane({ field: changingField, id: '2d', frequency: 63, bounds: { min: [0, 0, 0], max: [2, 0, 2] }, resolution: [2, 2] });
  const coordinator = new FieldViewRangeCoordinator({ views: [heatmap] });
  coordinator.update();
  const initial = [...coordinator.range];
  gain = .25;
  heatmap.invalidate();
  coordinator.resetRange().update();
  assert.ok(coordinator.range[1] < initial[1]);
  assert.deepEqual(coordinator.range, heatmap.sampleRange);
});

test('field analysis signature changes establish a new range without explicit coordinator invalidation', () => {
  let component = 'hybrid';
  let gain = 1;
  const changingField = {
    sample: (x, y, z) => gain * (x + z + 1),
    analysisSignature: () => `component:${component}`,
  };
  const heatmap = new SampledFieldPlane({ field: changingField, id: '2d', frequency: 63, bounds: { min: [0, 0, 0], max: [2, 0, 2] }, resolution: [2, 2] });
  const coordinator = new FieldViewRangeCoordinator({ views: [heatmap] });
  coordinator.update();
  const initial = [...coordinator.range];
  component = 'modal';
  gain = .25;
  heatmap.invalidate();
  coordinator.update();
  assert.ok(coordinator.range[1] < initial[1]);
  assert.deepEqual(coordinator.range, heatmap.sampleRange);
});
