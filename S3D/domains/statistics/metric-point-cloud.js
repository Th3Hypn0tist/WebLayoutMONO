import { SceneObject } from '../../core/objects/object.js';
import { BOX_INSTANCE_STRIDE, writeBoxInstance } from '../../core/render_store.js';
import { finiteNumber } from './dimension.js';
import { MetricSpace, finiteVec3, projectionBounds } from './metric-space.js';
import { Observation } from './observation.js';
import { VisualEncoding } from './visual-encoding.js';

function positiveVec3(value, label) {
  const result = finiteVec3(value, label);
  if (result.some(component => component <= 0)) throw new Error(`${label} components must be positive`);
  return result;
}

function colorValue(value, label) {
  if (!Array.isArray(value) || ![3, 4].includes(value.length)) throw new Error(`${label} must be RGB or RGBA`);
  const color = value.map((component, index) => finiteNumber(component, `${label}[${index}]`));
  if (color.some(component => component < 0 || component > 1)) throw new Error(`${label} components must be between 0 and 1`);
  return color;
}

function instanceKind(color) {
  return (color[3] ?? 1) < 1 ? 'transparent' : 'solid';
}

function sameVec3(a, b) {
  return a.length === 3 && b.length === 3 && a.every((value, index) => value === b[index]);
}

class MetricPointCloud extends SceneObject {
  constructor({
    id,
    space,
    observations = [],
    bounds = { min: [-1, -1, -1], max: [1, 1, 1] },
    pointScale = [0.04, 0.04, 0.04],
    color = [0.35, 0.7, 1],
    visualEncoding = null,
    selectedColor = [1, 0.75, 0.2],
    selectedScaleMultiplier = 1.35,
    axisColor = [0.4, 0.4, 0.4],
    showAxes = true,
    showSelectedLabels = true,
    metadata = {},
  } = {}) {
    super({ id, metadata, selectable: false });
    if (!(space instanceof MetricSpace)) throw new Error('MetricPointCloud requires a MetricSpace');
    if (visualEncoding !== null && !(visualEncoding instanceof VisualEncoding)) {
      throw new Error('MetricPointCloud visualEncoding must be a VisualEncoding or null');
    }
    this.space = space;
    this.bounds = projectionBounds(bounds);
    this.pointScale = positiveVec3(pointScale, 'MetricPointCloud pointScale');
    this.color = colorValue(color, 'MetricPointCloud color');
    this.visualEncoding = visualEncoding;
    this.selectedColor = colorValue(selectedColor, 'MetricPointCloud selectedColor');
    this.selectedScaleMultiplier = finiteNumber(selectedScaleMultiplier, 'MetricPointCloud selectedScaleMultiplier');
    if (this.selectedScaleMultiplier <= 1) throw new Error('MetricPointCloud selectedScaleMultiplier must be > 1');
    this.axisColor = colorValue(axisColor, 'MetricPointCloud axisColor');
    this.showAxes = Boolean(showAxes);
    this.showSelectedLabels = Boolean(showSelectedLabels);
    this.selectedIds = new Set();
    this._indexById = new Map();
    this._positions = new Float32Array(0);
    this._instances = new Float32Array(0);
    this._selectedInstances = new Float32Array(0);
    this._origin = [NaN, NaN, NaN];
    this._projectionDirty = true;
    this._selectionDirty = true;
    this.setObservations(observations);
  }

  _markProjectionDirty() {
    this._projectionDirty = true;
    this._selectionDirty = true;
  }

  setPosition(position, options = {}) {
    super.setPosition(position, options);
    this._markProjectionDirty();
    return this;
  }

  setSpace(space) {
    if (!(space instanceof MetricSpace)) throw new Error('MetricPointCloud requires a MetricSpace');
    this.space = space;
    this._markProjectionDirty();
    return this;
  }

  setBounds(bounds) {
    this.bounds = projectionBounds(bounds);
    this._markProjectionDirty();
    return this;
  }

  setVisualEncoding(visualEncoding) {
    if (visualEncoding !== null && !(visualEncoding instanceof VisualEncoding)) {
      throw new Error('MetricPointCloud visualEncoding must be a VisualEncoding or null');
    }
    this.visualEncoding = visualEncoding;
    this._markProjectionDirty();
    return this;
  }

  setObservations(observations) {
    if (!Array.isArray(observations) || observations.some(item => !(item instanceof Observation))) {
      throw new Error('MetricPointCloud observations must be an Observation array');
    }
    const ids = observations.map(observation => observation.id);
    if (new Set(ids).size !== ids.length) throw new Error('MetricPointCloud observation ids must be unique');
    this.observations = [...observations];
    this._indexById = new Map(this.observations.map((observation, index) => [observation.id, index]));
    this.selectedIds = new Set([...this.selectedIds].filter(id => this._indexById.has(id)));
    this._markProjectionDirty();
    return this;
  }

  select(ids) {
    if (!Array.isArray(ids) && !(ids instanceof Set)) throw new Error('MetricPointCloud.select requires an array or Set');
    const requested = [...ids];
    const unknown = requested.filter(id => !this._indexById.has(id));
    if (unknown.length) throw new Error(`MetricPointCloud cannot select unknown observation id(s): ${unknown.join(', ')}`);
    this.selectedIds = new Set(requested);
    this._selectionDirty = true;
    this.emit('selectionChanged', { ids: [...this.selectedIds] });
    return this;
  }

  clearSelection() {
    if (!this.selectedIds.size) return this;
    this.selectedIds.clear();
    this._selectionDirty = true;
    this.emit('selectionChanged', { ids: [] });
    return this;
  }

  _rebuildProjection(origin) {
    const count = this.observations.length;
    const positions = new Float32Array(count * 3);
    const instances = new Float32Array(count * BOX_INSTANCE_STRIDE);
    const xDimension = this.space.dimension(this.space.axes.x);
    const yDimension = this.space.dimension(this.space.axes.y);
    const zDimension = this.space.dimension(this.space.axes.z);
    const min = this.bounds.min;
    const max = this.bounds.max;

    for (let index = 0; index < count; index += 1) {
      const observation = this.observations[index];
      const defaultPosition = [
        origin[0] + min[0] + (max[0] - min[0]) * xDimension.normalize(observation.value(xDimension.id)),
        origin[1] + min[1] + (max[1] - min[1]) * yDimension.normalize(observation.value(yDimension.id)),
        origin[2] + min[2] + (max[2] - min[2]) * zDimension.normalize(observation.value(zDimension.id)),
      ];
      const encoded = this.visualEncoding
        ? this.visualEncoding.encode(observation, this.space, {
          position: defaultPosition,
          rotation: [0, 0, 0],
          scale: this.pointScale,
          color: this.color,
        })
        : { position: defaultPosition, rotation: [0, 0, 0], scale: this.pointScale, color: this.color };
      const positionOffset = index * 3;
      positions[positionOffset] = encoded.position[0];
      positions[positionOffset + 1] = encoded.position[1];
      positions[positionOffset + 2] = encoded.position[2];
      writeBoxInstance(
        instances,
        index * BOX_INSTANCE_STRIDE,
        encoded.position,
        encoded.scale,
        encoded.rotation,
        encoded.color,
      );
    }

    this._positions = positions;
    this._instances = instances;
    this._origin = [...origin];
    this._projectionDirty = false;
    this._selectionDirty = true;
  }

  _ensureProjection() {
    const origin = this.worldPosition();
    if (this._projectionDirty || !sameVec3(origin, this._origin)) this._rebuildProjection(origin);
  }

  _rebuildSelectionInstances() {
    this._ensureProjection();
    const instances = new Float32Array(this.selectedIds.size * BOX_INSTANCE_STRIDE);
    let targetIndex = 0;
    for (const id of this.selectedIds) {
      const sourceIndex = this._indexById.get(id);
      const sourceOffset = sourceIndex * BOX_INSTANCE_STRIDE;
      const position = [
        this._instances[sourceOffset],
        this._instances[sourceOffset + 1],
        this._instances[sourceOffset + 2],
      ];
      const scale = [
        this._instances[sourceOffset + 3] * this.selectedScaleMultiplier,
        this._instances[sourceOffset + 4] * this.selectedScaleMultiplier,
        this._instances[sourceOffset + 5] * this.selectedScaleMultiplier,
      ];
      const rotation = [
        this._instances[sourceOffset + 6],
        this._instances[sourceOffset + 7],
        this._instances[sourceOffset + 8],
      ];
      writeBoxInstance(
        instances,
        targetIndex * BOX_INSTANCE_STRIDE,
        position,
        scale,
        rotation,
        this.selectedColor,
      );
      targetIndex += 1;
    }
    this._selectedInstances = instances;
    this._selectionDirty = false;
  }

  projectedPoints() {
    this._ensureProjection();
    return this.observations.map((observation, index) => {
      const offset = index * 3;
      return {
        observation,
        position: [this._positions[offset], this._positions[offset + 1], this._positions[offset + 2]],
        selected: this.selectedIds.has(observation.id),
      };
    });
  }

  nearest(position, maxDistance = Infinity) {
    const target = finiteVec3(position, 'MetricPointCloud nearest position');
    if (maxDistance !== Infinity) {
      finiteNumber(maxDistance, 'MetricPointCloud maxDistance');
      if (maxDistance < 0) throw new Error('MetricPointCloud maxDistance must be non-negative');
    }
    this._ensureProjection();
    let bestIndex = -1;
    let bestDistance = maxDistance;
    for (let index = 0; index < this.observations.length; index += 1) {
      const offset = index * 3;
      const dx = this._positions[offset] - target[0];
      const dy = this._positions[offset + 1] - target[1];
      const dz = this._positions[offset + 2] - target[2];
      const distance = Math.hypot(dx, dy, dz);
      if (distance <= bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }
    if (bestIndex < 0) return null;
    const offset = bestIndex * 3;
    const observation = this.observations[bestIndex];
    return {
      observation,
      position: [this._positions[offset], this._positions[offset + 1], this._positions[offset + 2]],
      selected: this.selectedIds.has(observation.id),
      distance: bestDistance,
    };
  }

  _worldBounds() {
    const origin = this.worldPosition();
    return {
      min: this.bounds.min.map((component, index) => component + origin[index]),
      max: this.bounds.max.map((component, index) => component + origin[index]),
    };
  }

  draw(renderer, context = {}) {
    if (!renderer || typeof renderer.boxInstances !== 'function') {
      throw new Error('MetricPointCloud requires renderer.boxInstances for packed instanced rendering');
    }
    this._ensureProjection();
    if (this._selectionDirty) this._rebuildSelectionInstances();

    const bounds = this._worldBounds();
    if (this.showAxes) {
      const origin = [...bounds.min];
      renderer.line?.(origin, [bounds.max[0], origin[1], origin[2]], this.axisColor, this, context);
      renderer.line?.(origin, [origin[0], bounds.max[1], origin[2]], this.axisColor, this, context);
      renderer.line?.(origin, [origin[0], origin[1], bounds.max[2]], this.axisColor, this, context);
    }

    if (this._instances.length) renderer.boxInstances(this._instances, instanceKind(this.color), this, context);
    if (this._selectedInstances.length) renderer.boxInstances(this._selectedInstances, instanceKind(this.selectedColor), this, context);

    if (this.showSelectedLabels && typeof renderer.billboardText === 'function') {
      for (const id of this.selectedIds) {
        const index = this._indexById.get(id);
        const offset = index * 3;
        const observation = this.observations[index];
        const position = [this._positions[offset], this._positions[offset + 1], this._positions[offset + 2]];
        const width = Math.max(0.2, observation.label.length * 0.08);
        const instanceOffset = index * BOX_INSTANCE_STRIDE;
        const encodedScaleY = this._instances[instanceOffset + 4];
        const labelPosition = [
          position[0],
          position[1] + encodedScaleY * this.selectedScaleMultiplier * 2.5,
          position[2],
        ];
        renderer.billboardText(observation.label, labelPosition, width, 0.12, this.selectedColor, this, context);
      }
    }
  }
}

export { MetricPointCloud, colorValue, instanceKind, positiveVec3 };
