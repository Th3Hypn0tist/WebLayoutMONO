import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialSamplingPolicy, viewSamplingFrequency } from '../domains/acoustics/spatial-sampling-policy.js';

test('SpatialSamplingPolicy keeps base resolution when it already resolves the requested frequency', () => {
  const policy = new SpatialSamplingPolicy();
  const state = policy.resolutionFor({ lengths: [6, 4.5], baseResolution: [42, 32], frequencyHz: 900 });
  assert.deepEqual(state.resolution, [42, 32]);
  assert.equal(state.limited, false);
});

test('SpatialSamplingPolicy increases resolution with frequency before reaching its cost cap', () => {
  const policy = new SpatialSamplingPolicy();
  const state = policy.resolutionFor({ lengths: [6, 4.5], baseResolution: [32, 24], frequencyHz: 1000 });
  assert.deepEqual(state.resolution, [44, 33]);
  assert.equal(state.limited, false);
});

test('SpatialSamplingPolicy caps linear resolution growth and reports when the requested frequency exceeds it', () => {
  const policy = new SpatialSamplingPolicy();
  const state = policy.resolutionFor({ lengths: [6, 4.5], baseResolution: [32, 24], frequencyHz: 5000 });
  assert.deepEqual(state.resolution, [64, 48]);
  assert.deepEqual(state.caps, [64, 48]);
  assert.equal(state.limited, true);
  assert.ok(state.maxResolvableHz < 5000);
});

test('viewSamplingFrequency uses range maximum for aggregated field views', () => {
  assert.equal(viewSamplingFrequency({ frequency: 100, frequencyRange: [80, 1200] }), 1200);
  assert.equal(viewSamplingFrequency({ frequency: 915, frequencyRange: null }), 915);
});
