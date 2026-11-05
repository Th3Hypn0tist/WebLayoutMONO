import { Dimension, finiteNumber, nonEmptyString } from './dimension.js';
import { Observation } from './observation.js';

function finiteVec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} must be a finite [x,y,z] vector`);
  return value.map((component, index) => finiteNumber(component, `${label}[${index}]`));
}

function projectionBounds(value = { min: [-1, -1, -1], max: [1, 1, 1] }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('projection bounds must be an object');
  const min = finiteVec3(value.min, 'projection bounds min');
  const max = finiteVec3(value.max, 'projection bounds max');
  if (min.some((component, index) => component > max[index])) throw new Error('projection bounds min must be <= max');
  return { min, max };
}

class MetricSpace {
  constructor({ dimensions, axes } = {}) {
    if (!Array.isArray(dimensions) || !dimensions.length || dimensions.some(item => !(item instanceof Dimension))) {
      throw new Error('MetricSpace dimensions must be a non-empty Dimension array');
    }
    this.dimensions = new Map();
    for (const dimension of dimensions) {
      if (this.dimensions.has(dimension.id)) throw new Error(`duplicate Dimension id: ${dimension.id}`);
      this.dimensions.set(dimension.id, dimension);
    }

    if (!axes || typeof axes !== 'object' || Array.isArray(axes)) throw new Error('MetricSpace axes must be an object');
    this.axes = {
      x: nonEmptyString(axes.x, 'MetricSpace x axis'),
      y: nonEmptyString(axes.y, 'MetricSpace y axis'),
      z: nonEmptyString(axes.z, 'MetricSpace z axis'),
    };
    const axisIds = Object.values(this.axes);
    if (new Set(axisIds).size !== 3) throw new Error('MetricSpace x, y and z axes must use distinct dimensions');
    for (const id of axisIds) {
      const dimension = this.dimensions.get(id);
      if (!dimension) throw new Error(`MetricSpace axis references unknown dimension: ${id}`);
      dimension.requireDomain();
    }
  }

  dimension(id) {
    const key = nonEmptyString(id, 'Dimension id');
    const dimension = this.dimensions.get(key);
    if (!dimension) throw new Error(`MetricSpace has no dimension: ${key}`);
    return dimension;
  }

  normalized(observation) {
    if (!(observation instanceof Observation)) throw new Error('MetricSpace projection requires an Observation');
    return ['x', 'y', 'z'].map(axis => {
      const dimension = this.dimension(this.axes[axis]);
      return dimension.normalize(observation.value(dimension.id));
    });
  }

  project(observation, bounds = { min: [-1, -1, -1], max: [1, 1, 1] }) {
    const box = projectionBounds(bounds);
    return this.normalized(observation).map(
      (value, index) => box.min[index] + (box.max[index] - box.min[index]) * value,
    );
  }

  withAxes(axes) {
    return new MetricSpace({ dimensions: [...this.dimensions.values()], axes });
  }

  static fit({ dimensions, axes, observations } = {}) {
    if (!Array.isArray(dimensions) || !dimensions.length || dimensions.some(item => !(item instanceof Dimension))) {
      throw new Error('MetricSpace.fit dimensions must be a non-empty Dimension array');
    }
    if (!Array.isArray(observations) || !observations.length || observations.some(item => !(item instanceof Observation))) {
      throw new Error('MetricSpace.fit observations must be a non-empty Observation array');
    }
    const fitted = dimensions.map(dimension => {
      const values = observations.map(observation => observation.value(dimension.id));
      return dimension.withDomain([Math.min(...values), Math.max(...values)]);
    });
    return new MetricSpace({ dimensions: fitted, axes });
  }
}

export { MetricSpace, finiteVec3, projectionBounds };
