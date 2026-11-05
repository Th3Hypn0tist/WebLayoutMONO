import { SceneObject } from '../objects/object.js';

function clonePolygon(polygon) {
  return { vertices: (polygon?.vertices ?? []).map(vertex => ({ ...vertex })), closed: Boolean(polygon?.closed) };
}

function positive(value, name) {
  value = Number(value);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

class ExtrudedVolume extends SceneObject {
  constructor({ id = 'extruded-volume', polygon, height = 2.7, baseY = 0, color = [.45, .58, .78], metadata = {} } = {}) {
    super({ id, selectable: false, metadata });
    this.color = [...color];
    this.baseY = Number(baseY);
    if (!Number.isFinite(this.baseY)) throw new Error('ExtrudedVolume baseY must be finite');
    this.height = positive(height, 'ExtrudedVolume height');
    this.polygon = clonePolygon(polygon?.toPolygon?.() ?? polygon);
    this.rebuild();
  }

  setPolygon(polygon) { this.polygon = clonePolygon(polygon?.toPolygon?.() ?? polygon); return this.rebuild(); }
  setHeight(value) { this.height = positive(value, 'ExtrudedVolume height'); return this.rebuild(); }

  rebuild() {
    const vertices = this.polygon.vertices;
    if (!this.polygon.closed || vertices.length < 3) throw new Error('ExtrudedVolume requires a closed polygon with at least three vertices');
    const floor = vertices.map(vertex => [vertex.x, this.baseY, vertex.z]);
    const ceiling = vertices.map(vertex => [vertex.x, this.baseY + this.height, vertex.z]);
    const walls = vertices.map((vertex, index) => {
      const next = vertices[(index + 1) % vertices.length];
      return {
        id: `wall:${vertex.id}:${next.id}`,
        vertexIds: [vertex.id, next.id],
        vertices: [
          [vertex.x, this.baseY, vertex.z],
          [next.x, this.baseY, next.z],
          [next.x, this.baseY + this.height, next.z],
          [vertex.x, this.baseY + this.height, vertex.z],
        ],
      };
    });
    this.surfaces = {
      floor: { id: 'floor', vertices: floor },
      ceiling: { id: 'ceiling', vertices: ceiling },
      walls,
    };
    this.volume = { polygon: clonePolygon(this.polygon), baseY: this.baseY, height: this.height, surfaces: this.surfaces };
    this.mesh = { type: 'extruded-polygon-wireframe', floor, ceiling, walls };
    this.emit('rebuilt', { volume: this.volume, mesh: this.mesh });
    return this;
  }

  draw(renderer, context = {}) {
    if (!renderer?.line) return;
    const base = this.worldPosition();
    const world = point => point.map((value, axis) => value + base[axis]);
    const count = this.surfaces.floor.vertices.length;
    for (let index = 0; index < count; index++) {
      const next = (index + 1) % count;
      const floorA = world(this.surfaces.floor.vertices[index]);
      const floorB = world(this.surfaces.floor.vertices[next]);
      const ceilingA = world(this.surfaces.ceiling.vertices[index]);
      const ceilingB = world(this.surfaces.ceiling.vertices[next]);
      renderer.line(floorA, floorB, this.color, this, context);
      renderer.line(ceilingA, ceilingB, this.color, this, context);
      renderer.line(floorA, ceilingA, this.color, this, context);
    }
  }
}

export { ExtrudedVolume };
