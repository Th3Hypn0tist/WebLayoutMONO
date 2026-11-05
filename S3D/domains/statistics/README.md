# S3D Statistics

`domains/statistics` provides reusable statistical structures and spatial projections.

The domain understands statistical concepts such as dimensions, observations, distributions, ranges, selections and metric-space projections. It does **not** understand the semantics of a consuming application.

```text
consumer semantics
       |
       v
S3D statistics
       |
       v
S3D core
```

A consumer maps its own values into `Observation` instances and declares the dimensions used by a `MetricSpace`.

```js
import {
  Dimension,
  MetricPointCloud,
  MetricSpace,
  Observation,
} from './domains/statistics/index.js';

const observations = [
  new Observation({ id: 'a', values: { quality: 82, speed: 31, latency: 120 } }),
  new Observation({ id: 'b', values: { quality: 74, speed: 46, latency: 88 } }),
];

const space = MetricSpace.fit({
  dimensions: [
    new Dimension({ id: 'quality' }),
    new Dimension({ id: 'speed', unit: '1/s' }),
    new Dimension({ id: 'latency', unit: 'ms' }),
  ],
  axes: { x: 'quality', y: 'speed', z: 'latency' },
  observations,
});

const cloud = new MetricPointCloud({
  id: 'comparison',
  space,
  observations,
});
```

Applications own source data, semantic labels, filtering policy and wiring. The statistics domain owns only reusable statistical and spatial behavior.
