import { nonEmptyString, numericDomain } from './dimension.js';
import { Observation } from './observation.js';

class RangeSelection {
  constructor(constraints = {}) {
    if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) throw new Error('RangeSelection constraints must be an object');
    const entries = Object.entries(constraints);
    if (!entries.length) throw new Error('RangeSelection requires at least one constraint');
    this.constraints = new Map();
    for (const [dimensionId, range] of entries) {
      const id = nonEmptyString(dimensionId, 'RangeSelection dimension id');
      this.constraints.set(id, numericDomain(range, `RangeSelection ${id}`));
    }
  }

  matches(observation) {
    if (!(observation instanceof Observation)) throw new Error('RangeSelection.matches requires an Observation');
    for (const [dimensionId, [min, max]] of this.constraints) {
      const value = observation.value(dimensionId);
      if (value < min || value > max) return false;
    }
    return true;
  }

  filter(observations) {
    if (!Array.isArray(observations) || observations.some(item => !(item instanceof Observation))) {
      throw new Error('RangeSelection.filter requires an Observation array');
    }
    return observations.filter(observation => this.matches(observation));
  }
}

export { RangeSelection };
