import { mean, median, numericSample, quantile, standardDeviation, summarize, variance } from './descriptive.js';

class Distribution {
  constructor(values) {
    this.values = Object.freeze(numericSample(values));
    this.summary = summarize(this.values);
  }

  mean() { return mean(this.values); }
  median() { return median(this.values); }
  quantile(probability) { return quantile(this.values, probability); }
  variance(mode = 'population') { return variance(this.values, mode); }
  standardDeviation(mode = 'population') { return standardDeviation(this.values, mode); }
}

export { Distribution };
