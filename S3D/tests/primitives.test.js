import test from 'node:test';
import assert from 'node:assert/strict';
import { Cylinder } from '../core/objects/primitives.js';

test('Cylinder is a reusable primitive and renders through line geometry', () => {
  const lines = [];
  const cylinder = new Cylinder({ id: 'cylinder', position: [1, 2, 3], scale: [.5, 1, .5], segments: 8 });
  assert.equal(cylinder.primitive, 'cylinder');
  cylinder.draw({ line: (...args) => lines.push(args) });
  assert.ok(lines.length >= 16);
});
