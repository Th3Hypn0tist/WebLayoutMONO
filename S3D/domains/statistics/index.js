// Reusable, host-independent statistical structures and spatial projections.
export { Dimension } from './dimension.js';
export { Observation } from './observation.js';
export { Distribution } from './distribution.js';
export {
  extent,
  mean,
  median,
  quantile,
  standardDeviation,
  summarize,
  variance,
} from './descriptive.js';
export { MetricSpace } from './metric-space.js';
export { RangeSelection } from './selection.js';
export { VISUAL_CHANNELS, VisualChannelBinding, VisualEncoding } from './visual-encoding.js';
export { MetricPointCloud } from './metric-point-cloud.js';
