// Reusable high-density render store.
// Pure data batching only: no globals, host semantics or renderer mutation.

import { BOX_FACE_ORDER } from './box_geometry.js';

const BOX_INSTANCE_TRANSFORM_STRIDE = 9;
const BOX_FACE_COLOR_STRIDE = 4;
const BOX_FACE_COLOR_OFFSET = BOX_INSTANCE_TRANSFORM_STRIDE;
const BOX_INSTANCE_STRIDE = BOX_INSTANCE_TRANSFORM_STRIDE + BOX_FACE_ORDER.length * BOX_FACE_COLOR_STRIDE;
const BOX_INSTANCE_KINDS = Object.freeze(['solid', 'transparent', 'outline']);

function writeColor(buffer, offset, color) {
  buffer[offset] = Number(color[0]);
  buffer[offset + 1] = Number(color[1]);
  buffer[offset + 2] = Number(color[2]);
  const rawAlpha = Number(color[3] ?? 1);
  buffer[offset + 3] = Number.isFinite(rawAlpha) ? Math.max(0, Math.min(1, rawAlpha)) : 1;
}

function validateTarget(buffer, offset, label) {
  if (!(buffer instanceof Float32Array)) throw new Error(`${label} requires Float32Array`);
  if (!Number.isInteger(offset) || offset < 0 || offset + BOX_INSTANCE_STRIDE > buffer.length) {
    throw new Error(`${label} offset is outside the target buffer`);
  }
}

function writeTransform(buffer, offset, position, scale, rotation) {
  buffer[offset] = Number(position[0]);
  buffer[offset + 1] = Number(position[1]);
  buffer[offset + 2] = Number(position[2]);
  buffer[offset + 3] = Number(scale[0]);
  buffer[offset + 4] = Number(scale[1]);
  buffer[offset + 5] = Number(scale[2]);
  buffer[offset + 6] = Number(rotation[0] ?? 0);
  buffer[offset + 7] = Number(rotation[1] ?? 0);
  buffer[offset + 8] = Number(rotation[2] ?? 0);
}

function writeBoxFaceInstance(buffer, offset, position, scale, rotation, faceColors) {
  validateTarget(buffer, offset, 'writeBoxFaceInstance');
  if (!Array.isArray(faceColors) || faceColors.length !== BOX_FACE_ORDER.length) {
    throw new Error(`writeBoxFaceInstance requires ${BOX_FACE_ORDER.length} face colors in canonical order`);
  }
  writeTransform(buffer, offset, position, scale, rotation);
  for (let faceIndex = 0; faceIndex < BOX_FACE_ORDER.length; faceIndex += 1) {
    const color = faceColors[faceIndex];
    if (!Array.isArray(color) || ![3, 4].includes(color.length)) {
      throw new Error(`writeBoxFaceInstance face ${BOX_FACE_ORDER[faceIndex]} must be RGB or RGBA`);
    }
    writeColor(buffer, offset + BOX_FACE_COLOR_OFFSET + faceIndex * BOX_FACE_COLOR_STRIDE, color);
  }
}

function writeBoxInstance(buffer, offset, position, scale, rotation, color) {
  validateTarget(buffer, offset, 'writeBoxInstance');
  if (!Array.isArray(color) || ![3, 4].includes(color.length)) throw new Error('writeBoxInstance color must be RGB or RGBA');
  writeTransform(buffer, offset, position, scale, rotation);
  for (let faceIndex = 0; faceIndex < BOX_FACE_ORDER.length; faceIndex += 1) {
    writeColor(buffer, offset + BOX_FACE_COLOR_OFFSET + faceIndex * BOX_FACE_COLOR_STRIDE, color);
  }
}

function boxInstanceHasTransparency(buffer, offset = 0) {
  validateTarget(buffer, offset, 'boxInstanceHasTransparency');
  for (let faceIndex = 0; faceIndex < BOX_FACE_ORDER.length; faceIndex += 1) {
    const alphaOffset = offset + BOX_FACE_COLOR_OFFSET + faceIndex * BOX_FACE_COLOR_STRIDE + 3;
    if (buffer[alphaOffset] < 1) return true;
  }
  return false;
}

class FloatStore {
  constructor(initialCapacity = 1024) {
    this.buffer = new Float32Array(Math.max(1, initialCapacity));
    this.length = 0;
  }
  clear() { this.length = 0; }
  ensure(additional) {
    const required = this.length + additional;
    if (required <= this.buffer.length) return;
    let capacity = this.buffer.length;
    while (capacity < required) capacity *= 2;
    const next = new Float32Array(capacity);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }
  push(...values) {
    this.ensure(values.length);
    this.buffer.set(values, this.length);
    this.length += values.length;
  }
  append(values) {
    if (!(values instanceof Float32Array)) throw new Error('FloatStore.append requires Float32Array');
    this.ensure(values.length);
    this.buffer.set(values, this.length);
    this.length += values.length;
  }
  view() { return this.buffer.subarray(0, this.length); }
}

class RenderStore {
  constructor() {
    this.solidBoxes = new FloatStore(BOX_INSTANCE_STRIDE * 1024);
    this.transparentBoxes = new FloatStore(BOX_INSTANCE_STRIDE * 1024);
    this.outlineBoxes = new FloatStore(BOX_INSTANCE_STRIDE * 512);
    this.lines = new FloatStore(6 * 2048);
    this.glyphs = new FloatStore(14 * 4096);
    this.flowPulses = new FloatStore(14 * 2048);
    this.viewProjection = null;
    this.counts = { solidBoxes: 0, transparentBoxes: 0, outlineBoxes: 0, lineVertices: 0, glyphs: 0, flowPulses: 0 };
  }
  begin(viewProjection) {
    if (!viewProjection || viewProjection.length !== 16) throw new Error('RenderStore.begin requires a 4x4 viewProjection matrix');
    this.viewProjection = viewProjection;
    this.solidBoxes.clear();
    this.transparentBoxes.clear();
    this.outlineBoxes.clear();
    this.lines.clear();
    this.glyphs.clear();
    this.flowPulses.clear();
    for (const key of Object.keys(this.counts)) this.counts[key] = 0;
  }
  _appendBoxInstance(instance, outline) {
    const transparent = !outline && boxInstanceHasTransparency(instance);
    const target = outline ? this.outlineBoxes : transparent ? this.transparentBoxes : this.solidBoxes;
    target.append(instance);
    if (outline) this.counts.outlineBoxes += 1;
    else if (transparent) this.counts.transparentBoxes += 1;
    else this.counts.solidBoxes += 1;
  }
  box(position, scale, color, outline = false, rotation = [0, 0, 0]) {
    if (!this.viewProjection) throw new Error('RenderStore.box requires begin()');
    const instance = new Float32Array(BOX_INSTANCE_STRIDE);
    writeBoxInstance(instance, 0, position, scale, rotation, color);
    this._appendBoxInstance(instance, outline);
  }
  boxFaces(position, scale, faceColors, outline = false, rotation = [0, 0, 0]) {
    if (!this.viewProjection) throw new Error('RenderStore.boxFaces requires begin()');
    const instance = new Float32Array(BOX_INSTANCE_STRIDE);
    writeBoxFaceInstance(instance, 0, position, scale, rotation, faceColors);
    this._appendBoxInstance(instance, outline);
  }
  boxInstances(instances, kind) {
    if (!this.viewProjection) throw new Error('RenderStore.boxInstances requires begin()');
    if (!(instances instanceof Float32Array)) throw new Error('RenderStore.boxInstances requires Float32Array');
    if (instances.length % BOX_INSTANCE_STRIDE !== 0) {
      throw new Error(`RenderStore.boxInstances length must be divisible by ${BOX_INSTANCE_STRIDE}`);
    }
    if (!BOX_INSTANCE_KINDS.includes(kind)) {
      throw new Error(`RenderStore.boxInstances kind must be one of: ${BOX_INSTANCE_KINDS.join(', ')}`);
    }
    const count = instances.length / BOX_INSTANCE_STRIDE;
    if (count === 0) return;
    const target = kind === 'solid' ? this.solidBoxes : kind === 'transparent' ? this.transparentBoxes : this.outlineBoxes;
    target.append(instances);
    if (kind === 'solid') this.counts.solidBoxes += count;
    else if (kind === 'transparent') this.counts.transparentBoxes += count;
    else this.counts.outlineBoxes += count;
  }
  line(start, end, color) {
    if (!this.viewProjection) throw new Error('RenderStore.line requires begin()');
    this.lines.push(
      Number(start[0]), Number(start[1]), Number(start[2]), Number(color[0]), Number(color[1]), Number(color[2]),
      Number(end[0]), Number(end[1]), Number(end[2]), Number(color[0]), Number(color[1]), Number(color[2]),
    );
    this.counts.lineVertices += 2;
  }
  glyph(center, size, uvRect, color, baselineOffset = 0, billboard = false) {
    if (!this.viewProjection) throw new Error('RenderStore.glyph requires begin()');
    this.glyphs.push(
      Number(center[0]), Number(center[1]), Number(center[2]),
      Number(size[0]), Number(size[1]),
      Number(uvRect[0]), Number(uvRect[1]), Number(uvRect[2]), Number(uvRect[3]),
      Number(color[0]), Number(color[1]), Number(color[2]),
      Number(baselineOffset),
      billboard ? 1 : 0,
    );
    this.counts.glyphs += 1;
  }
  flow(start, end, scale, color, phase = 0, speed = 0) {
    if (!this.viewProjection) throw new Error('RenderStore.flow requires begin()');
    this.flowPulses.push(
      Number(start[0]), Number(start[1]), Number(start[2]),
      Number(end[0]), Number(end[1]), Number(end[2]),
      Number(scale[0]), Number(scale[1]), Number(scale[2]),
      Number(color[0]), Number(color[1]), Number(color[2]),
      Number(phase), Number(speed),
    );
    this.counts.flowPulses += 1;
  }
  snapshot() {
    return {
      viewProjection: this.viewProjection,
      solidBoxes: this.solidBoxes.view(),
      transparentBoxes: this.transparentBoxes.view(),
      outlineBoxes: this.outlineBoxes.view(),
      lines: this.lines.view(),
      glyphs: this.glyphs.view(),
      flowPulses: this.flowPulses.view(),
      counts: { ...this.counts },
    };
  }
}

export {
  BOX_FACE_COLOR_OFFSET,
  BOX_FACE_COLOR_STRIDE,
  BOX_INSTANCE_KINDS,
  BOX_INSTANCE_STRIDE,
  BOX_INSTANCE_TRANSFORM_STRIDE,
  FloatStore,
  RenderStore,
  boxInstanceHasTransparency,
  writeBoxFaceInstance,
  writeBoxInstance,
};
