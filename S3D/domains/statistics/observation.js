import { finiteNumber, nonEmptyString } from './dimension.js';

function numericValues(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Observation values must be an object');
  const entries = Object.entries(values);
  if (!entries.length) throw new Error('Observation requires at least one value');
  const result = {};
  for (const [key, value] of entries) {
    const id = nonEmptyString(key, 'Observation dimension id');
    result[id] = finiteNumber(value, `Observation value ${id}`);
  }
  return result;
}

class Observation {
  constructor({ id, label = id, values, metadata = {} } = {}) {
    this.id = nonEmptyString(id, 'Observation id');
    this.label = nonEmptyString(label, 'Observation label');
    this.values = Object.freeze(numericValues(values));
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Observation metadata must be an object');
    this.metadata = { ...metadata };
  }

  has(dimensionId) {
    return Object.hasOwn(this.values, dimensionId);
  }

  value(dimensionId) {
    const id = nonEmptyString(dimensionId, 'dimensionId');
    if (!this.has(id)) throw new Error(`Observation ${this.id} has no value for dimension ${id}`);
    return this.values[id];
  }
}

export { Observation, numericValues };
