import { Measurement, resolveAnchor } from './measurement.js';

function clonePolygon(polygon) {
  return { vertices: (polygon?.vertices ?? []).map(vertex => ({ ...vertex })), closed: Boolean(polygon?.closed) };
}

function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

function residuals(polygon, measurements) {
  return measurements.map(measurement => {
    const a = resolveAnchor(measurement.anchors[0], polygon);
    const b = resolveAnchor(measurement.anchors[1], polygon);
    const actual = distance(a, b);
    return { id: measurement.id, target: measurement.value, actual, error: actual - measurement.value, confidence: measurement.confidence, source: measurement.source };
  });
}

class ConstraintGeometrySolver {
  constructor({ iterations = 160, tolerance = 1e-4, learningRate = .18, shapeWeight = .02 } = {}) {
    this.iterations = Math.max(1, Math.floor(Number(iterations) || 160));
    this.tolerance = Math.max(0, Number(tolerance) || 0);
    this.learningRate = Math.max(1e-5, Number(learningRate) || .18);
    this.shapeWeight = Math.max(0, Number(shapeWeight) || 0);
  }

  solve(polygon, measurements = []) {
    const source = clonePolygon(polygon?.toPolygon?.() ?? polygon);
    if (source.vertices.length < 2) throw new Error('ConstraintGeometrySolver requires a polygon with at least two vertices');
    const normalized = measurements.map(value => value instanceof Measurement ? value : new Measurement(value));
    const solved = clonePolygon(source);
    const original = source.vertices.map(vertex => [vertex.x, vertex.z]);
    const vertexIndex = new Map(solved.vertices.map((vertex, index) => [vertex.id, index]));

    const objective = () => {
      let total = 0;
      for (const item of residuals(solved, normalized)) {
        const weight = item.source === 'measured' ? 4 : item.source === 'drawing' ? 1 : .5;
        total += item.error * item.error * weight * Math.max(.05, item.confidence);
      }
      for (let index = 0; index < solved.vertices.length; index++) {
        const dx = solved.vertices[index].x - original[index][0];
        const dz = solved.vertices[index].z - original[index][1];
        total += this.shapeWeight * (dx * dx + dz * dz);
      }
      return total;
    };

    const epsilon = 1e-4;
    let previous = objective();
    let iterations = 0;
    for (; iterations < this.iterations; iterations++) {
      const gradients = solved.vertices.map(() => [0, 0]);
      for (let index = 0; index < solved.vertices.length; index++) {
        for (let axis = 0; axis < 2; axis++) {
          const vertex = solved.vertices[index];
          const key = axis === 0 ? 'x' : 'z';
          vertex[key] += epsilon;
          const plus = objective();
          vertex[key] -= 2 * epsilon;
          const minus = objective();
          vertex[key] += epsilon;
          gradients[index][axis] = (plus - minus) / (2 * epsilon);
        }
      }
      let maxStep = 0;
      for (let index = 0; index < solved.vertices.length; index++) {
        const vertex = solved.vertices[index];
        const dx = -this.learningRate * gradients[index][0];
        const dz = -this.learningRate * gradients[index][1];
        const limited = Math.max(1, Math.hypot(dx, dz) / .2);
        vertex.x += dx / limited;
        vertex.z += dz / limited;
        maxStep = Math.max(maxStep, Math.abs(dx / limited), Math.abs(dz / limited));
      }
      const current = objective();
      if (current > previous * 1.25) this.learningRate *= .5;
      previous = current;
      if (maxStep <= this.tolerance) break;
    }

    const solvedMeasurements = residuals(solved, normalized);
    const conflicts = solvedMeasurements.filter(item => Math.abs(item.error) > Math.max(this.tolerance * 10, .01));
    return {
      polygon: solved,
      measurements: solvedMeasurements,
      diagnostics: {
        iterations,
        objective: previous,
        converged: conflicts.length === 0,
        conflicts,
        vertexCount: solved.vertices.length,
        measurementCount: normalized.length,
      },
      vertexIndex,
    };
  }
}

export { ConstraintGeometrySolver, residuals };
