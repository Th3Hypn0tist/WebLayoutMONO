import { finiteNumber, nonEmptyString } from './dimension.js';

const VISUAL_CHANNELS = Object.freeze([
  'position.x', 'position.y', 'position.z',
  'rotation.x', 'rotation.y', 'rotation.z',
  'scale.x', 'scale.y', 'scale.z',
  'color.r', 'color.g', 'color.b',
]);

function outputRange(value, label) {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${label} must be [min,max]`);
  return [
    finiteNumber(value[0], `${label}[0]`),
    finiteNumber(value[1], `${label}[1]`),
  ];
}

class VisualChannelBinding {
  constructor({ dimension, range } = {}) {
    this.dimension = nonEmptyString(dimension, 'VisualChannelBinding dimension');
    this.range = outputRange(range, 'VisualChannelBinding range');
  }

  encode(observation, space) {
    const dimension = space.dimension(this.dimension);
    const normalized = dimension.normalize(observation.value(dimension.id));
    return this.range[0] + (this.range[1] - this.range[0]) * normalized;
  }
}

class VisualEncoding {
  constructor({ bindings = {} } = {}) {
    if (bindings == null || typeof bindings !== 'object' || Array.isArray(bindings)) {
      throw new Error('VisualEncoding bindings must be an object');
    }
    this.bindings = new Map();
    for (const [channel, binding] of Object.entries(bindings)) {
      if (!VISUAL_CHANNELS.includes(channel)) {
        throw new Error(`VisualEncoding unknown channel: ${channel}`);
      }
      this.bindings.set(
        channel,
        binding instanceof VisualChannelBinding ? binding : new VisualChannelBinding(binding),
      );
    }
  }

  has(channel) {
    return this.bindings.has(channel);
  }

  value(channel, observation, space, fallback) {
    const binding = this.bindings.get(channel);
    return binding ? binding.encode(observation, space) : fallback;
  }

  encode(observation, space, defaults) {
    if (!defaults || typeof defaults !== 'object') throw new Error('VisualEncoding defaults must be an object');
    const position = defaults.position.map((fallback, index) =>
      this.value(`position.${'xyz'[index]}`, observation, space, fallback));
    const rotation = defaults.rotation.map((fallback, index) =>
      this.value(`rotation.${'xyz'[index]}`, observation, space, fallback));
    const scale = defaults.scale.map((fallback, index) =>
      this.value(`scale.${'xyz'[index]}`, observation, space, fallback));
    const color = defaults.color.map((fallback, index) => (
      index < 3 ? this.value(`color.${'rgb'[index]}`, observation, space, fallback) : fallback
    ));

    if (scale.some(component => component <= 0)) {
      throw new Error('VisualEncoding scale channels must encode positive values');
    }
    if (color.some(component => component < 0 || component > 1)) {
      throw new Error('VisualEncoding color channels must encode values between 0 and 1');
    }
    return { position, rotation, scale, color };
  }
}

export { VISUAL_CHANNELS, VisualChannelBinding, VisualEncoding };
