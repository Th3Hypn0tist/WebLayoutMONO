import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOX_FACE_COLOR_OFFSET,
  BOX_FACE_COLOR_STRIDE,
  BOX_INSTANCE_STRIDE,
} from '../core/render_store.js';
import { WebGLBatchRenderer } from '../core/webgl_batch_renderer.js';

test('WebGL box attributes match the packed canonical face layout', () => {
  const pointers = [];
  const divisors = [];
  const enabled = [];
  const buffer = { id: 'box-instances' };
  const gl = {
    ARRAY_BUFFER: 0x8892,
    FLOAT: 0x1406,
    bindBuffer(target, value) {
      assert.equal(target, this.ARRAY_BUFFER);
      assert.strictEqual(value, buffer);
    },
    enableVertexAttribArray(location) { enabled.push(location); },
    vertexAttribPointer(location, size, type, normalized, stride, offset) {
      pointers.push({ location, size, type, normalized, stride, offset });
    },
    vertexAttribDivisor(location, divisor) { divisors.push({ location, divisor }); },
  };

  const renderer = Object.create(WebGLBatchRenderer.prototype);
  renderer.gl = gl;
  renderer.configureBoxAttributes(buffer);

  assert.deepEqual(enabled, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(divisors, enabled.map(location => ({ location, divisor: 1 })));
  assert.deepEqual(
    pointers.map(({ location, size, stride, offset }) => ({ location, size, stride, offset })),
    [
      { location: 1, size: 3, stride: BOX_INSTANCE_STRIDE * 4, offset: 0 },
      { location: 2, size: 3, stride: BOX_INSTANCE_STRIDE * 4, offset: 3 * 4 },
      { location: 3, size: 3, stride: BOX_INSTANCE_STRIDE * 4, offset: 6 * 4 },
      ...Array.from({ length: 6 }, (_, faceIndex) => ({
        location: 4 + faceIndex,
        size: 4,
        stride: BOX_INSTANCE_STRIDE * 4,
        offset: (BOX_FACE_COLOR_OFFSET + faceIndex * BOX_FACE_COLOR_STRIDE) * 4,
      })),
    ],
  );
  assert.ok(pointers.every(pointer => pointer.type === gl.FLOAT && pointer.normalized === false));
});
