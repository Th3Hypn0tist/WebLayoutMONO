function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function numericDomain(value, label = 'domain') {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${label} must be [min,max]`);
  const min = finiteNumber(value[0], `${label}[0]`);
  const max = finiteNumber(value[1], `${label}[1]`);
  if (min > max) throw new Error(`${label} min must be <= max`);
  return [min, max];
}

class Dimension {
  constructor({ id, label = id, unit = '', domain = null } = {}) {
    this.id = nonEmptyString(id, 'Dimension id');
    this.label = nonEmptyString(label, 'Dimension label');
    if (typeof unit !== 'string') throw new Error('Dimension unit must be a string');
    this.unit = unit;
    this.domain = domain == null ? null : numericDomain(domain, `Dimension ${this.id} domain`);
  }

  withDomain(domain) {
    return new Dimension({ id: this.id, label: this.label, unit: this.unit, domain });
  }

  requireDomain() {
    if (this.domain == null) throw new Error(`Dimension ${this.id} has no domain`);
    return [...this.domain];
  }

  validate(value) {
    return finiteNumber(value, `Dimension ${this.id} value`);
  }

  contains(value) {
    const number = this.validate(value);
    const [min, max] = this.requireDomain();
    return number >= min && number <= max;
  }

  normalize(value) {
    const number = this.validate(value);
    const [min, max] = this.requireDomain();
    if (min === max) {
      if (number !== min) throw new Error(`Dimension ${this.id} constant domain only accepts ${min}`);
      return 0.5;
    }
    return (number - min) / (max - min);
  }

  normalizeClamped(value) {
    return Math.max(0, Math.min(1, this.normalize(value)));
  }

  denormalize(position) {
    const normalized = finiteNumber(position, `Dimension ${this.id} normalized position`);
    const [min, max] = this.requireDomain();
    if (min === max) return min;
    return min + (max - min) * normalized;
  }
}

export { Dimension, finiteNumber, numericDomain, nonEmptyString };
