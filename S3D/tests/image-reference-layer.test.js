import test from 'node:test';
import assert from 'node:assert/strict';
import { ImageReferenceLayer } from '../core/geometry/image-reference-layer.js';

test('image reference transform round-trips image and local coordinates', () => {
  const layer = new ImageReferenceLayer({
    image: { width: 100, height: 50 },
    transform: { position: [2, 3], rotation: Math.PI / 6, scale: [.02, .03] },
  });
  const image = [40, 20];
  const local = layer.imageToLocal(image);
  const roundTrip = layer.localToImage(local);
  assert.ok(Math.abs(roundTrip[0] - image[0]) < 1e-9);
  assert.ok(Math.abs(roundTrip[1] - image[1]) < 1e-9);
});

test('image reference layer queues a textured plane through renderer interface', () => {
  const image = { width: 100, height: 50 };
  const layer = new ImageReferenceLayer({
    image,
    opacity: .4,
    transform: { position: [1, 2], rotation: .25, scale: [.01, .02] },
    y: .003,
  });
  let queued = null;
  layer.draw({ imagePlane(source, transform) { queued = { source, transform }; } });
  assert.equal(queued.source, image);
  assert.deepEqual(queued.transform.position, [1, 2]);
  assert.deepEqual(queued.transform.scale, [.01, .02]);
  assert.equal(queued.transform.rotation, .25);
  assert.equal(queued.transform.opacity, .4);
  assert.equal(queued.transform.y, .003);
});
