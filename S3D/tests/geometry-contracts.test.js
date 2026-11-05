import test from 'node:test';
import assert from 'node:assert/strict';
import { ConstraintGeometrySolver, ExtrudedVolume, ImageReferenceLayer, Measurement, PolygonEditor } from '../core/index.js';

test('ImageReferenceLayer transforms round-trip', () => {
  const layer = new ImageReferenceLayer({ transform: { position: [2, 3], rotation: .3, scale: [2, 1.5] } });
  const local = layer.imageToLocal([.4, .7]);
  const image = layer.localToImage(local);
  assert.ok(Math.abs(image[0] - .4) < 1e-9);
  assert.ok(Math.abs(image[1] - .7) < 1e-9);
});

test('PolygonEditor preserves ids and undo redo geometry', () => {
  const polygon = new PolygonEditor({ vertices: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 2, z: 0 }, { id: 'c', x: 2, z: 1 }], closed: true });
  polygon.moveVertex('b', { x: 3, z: 0 });
  assert.equal(polygon.vertex('b').x, 3);
  assert.equal(polygon.undo(), true);
  assert.equal(polygon.vertex('b').x, 2);
  assert.equal(polygon.redo(), true);
  assert.equal(polygon.vertex('b').x, 3);
});

test('ConstraintGeometrySolver fits explicit vertex distance without changing topology', () => {
  const polygon = new PolygonEditor({ vertices: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 1.5, z: 0 }, { id: 'c', x: 1.5, z: 1 }, { id: 'd', x: 0, z: 1 }], closed: true });
  const measurement = new Measurement({ id: 'width', anchors: [{ type: 'vertex', target: 'a' }, { type: 'vertex', target: 'b' }], value: 2, confidence: 1, source: 'measured' });
  const solved = new ConstraintGeometrySolver({ iterations: 300 }).solve(polygon, [measurement]);
  assert.deepEqual(solved.polygon.vertices.map(vertex => vertex.id), ['a', 'b', 'c', 'd']);
  assert.ok(Math.abs(solved.measurements[0].actual - 2) < .03);
});

test('ExtrudedVolume exposes floor ceiling and walls', () => {
  const polygon = { closed: true, vertices: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 2, z: 0 }, { id: 'c', x: 2, z: 1 }, { id: 'd', x: 0, z: 1 }] };
  const volume = new ExtrudedVolume({ polygon, height: 2.5 });
  assert.equal(volume.surfaces.floor.vertices.length, 4);
  assert.equal(volume.surfaces.ceiling.vertices[0][1], 2.5);
  assert.equal(volume.surfaces.walls.length, 4);
});
