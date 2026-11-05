import { finiteNumber } from './dimension.js';

function numericSample(values) {
  if (!Array.isArray(values) || !values.length) throw new Error('statistical sample must be a non-empty array');
  return values.map((value, index) => finiteNumber(value, `sample[${index}]`));
}

function mean(values) {
  const sample = numericSample(values);
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

function quantile(values, probability) {
  const sample = numericSample(values).sort((a, b) => a - b);
  const q = finiteNumber(probability, 'quantile probability');
  if (q < 0 || q > 1) throw new Error('quantile probability must be between 0 and 1');
  if (sample.length === 1) return sample[0];
  const index = (sample.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sample[lower];
  const fraction = index - lower;
  return sample[lower] + (sample[upper] - sample[lower]) * fraction;
}

function median(values) {
  return quantile(values, 0.5);
}

function variance(values, mode = 'population') {
  const sample = numericSample(values);
  if (!['population', 'sample'].includes(mode)) throw new Error(`unsupported variance mode: ${mode}`);
  if (mode === 'sample' && sample.length < 2) throw new Error('sample variance requires at least two values');
  const center = mean(sample);
  const divisor = mode === 'sample' ? sample.length - 1 : sample.length;
  return sample.reduce((sum, value) => sum + (value - center) ** 2, 0) / divisor;
}

function standardDeviation(values, mode = 'population') {
  return Math.sqrt(variance(values, mode));
}

function extent(values) {
  const sample = numericSample(values);
  return [Math.min(...sample), Math.max(...sample)];
}

function summarize(values) {
  const sample = numericSample(values);
  const [min, max] = extent(sample);
  return Object.freeze({
    count: sample.length,
    min,
    max,
    mean: mean(sample),
    median: median(sample),
    q1: quantile(sample, 0.25),
    q3: quantile(sample, 0.75),
    variance: variance(sample, 'population'),
    standardDeviation: standardDeviation(sample, 'population'),
  });
}

export { extent, mean, median, numericSample, quantile, standardDeviation, summarize, variance };
