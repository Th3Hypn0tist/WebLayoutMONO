const BOX_VERTICES = Object.freeze([
  -1, -1, -1,
   1, -1, -1,
   1,  1, -1,
  -1,  1, -1,
  -1, -1,  1,
   1, -1,  1,
   1,  1,  1,
  -1,  1,  1,
]);

const BOX_FACES = Object.freeze([
  Object.freeze({ id: 'z-', axis: 'z', sign: -1, indices: Object.freeze([0, 2, 1, 0, 3, 2]) }),
  Object.freeze({ id: 'z+', axis: 'z', sign:  1, indices: Object.freeze([4, 5, 6, 4, 6, 7]) }),
  Object.freeze({ id: 'x-', axis: 'x', sign: -1, indices: Object.freeze([0, 4, 7, 0, 7, 3]) }),
  Object.freeze({ id: 'x+', axis: 'x', sign:  1, indices: Object.freeze([1, 2, 6, 1, 6, 5]) }),
  Object.freeze({ id: 'y-', axis: 'y', sign: -1, indices: Object.freeze([0, 1, 5, 0, 5, 4]) }),
  Object.freeze({ id: 'y+', axis: 'y', sign:  1, indices: Object.freeze([3, 7, 6, 3, 6, 2]) }),
]);

const BOX_FACE_ORDER = Object.freeze(BOX_FACES.map(face => face.id));
const BOX_FACE_INDICES = Object.freeze(BOX_FACES.flatMap(face => face.indices));
const BOX_EDGE_INDICES = Object.freeze([
  0, 1, 1, 2, 2, 3, 3, 0,
  4, 5, 5, 6, 6, 7, 7, 4,
  0, 4, 1, 5, 2, 6, 3, 7,
]);

function boxFaceIndex(faceId) {
  const index = BOX_FACE_ORDER.indexOf(faceId);
  if (index < 0) throw new RangeError(`unknown box face: ${faceId}`);
  return index;
}

export {
  BOX_VERTICES,
  BOX_FACES,
  BOX_FACE_ORDER,
  BOX_FACE_INDICES,
  BOX_EDGE_INDICES,
  boxFaceIndex,
};
