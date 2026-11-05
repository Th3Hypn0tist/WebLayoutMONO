import { SceneObject } from '../objects/object.js';

function finite(value, name) {
  value = Number(value);
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function cloneVertices(vertices) { return vertices.map(vertex => ({ ...vertex })); }

function normalizeVertex(value, fallbackId) {
  const id = String(value?.id ?? fallbackId ?? '');
  if (!id) throw new Error('Polygon vertex requires a non-empty id');
  return { id, x: finite(value?.x, 'Vertex x'), z: finite(value?.z, 'Vertex z') };
}

function polygonEdges(polygon) {
  const vertices = polygon?.vertices ?? [];
  const count = vertices.length;
  if (count < 2) return [];
  const edgeCount = polygon.closed ? count : count - 1;
  return Array.from({ length: edgeCount }, (_, index) => {
    const start = vertices[index];
    const end = vertices[(index + 1) % count];
    return { id: `edge:${start.id}:${end.id}`, index, start, end };
  });
}

class PolygonEditor extends SceneObject {
  constructor({ id = 'polygon-editor', vertices = [], closed = false, y = 0, color = [.7, .82, 1], selectedColor = [1, .75, .2], metadata = {} } = {}) {
    super({ id, selectable: false, metadata });
    this.vertices = vertices.map((vertex, index) => normalizeVertex(vertex, `vertex-${index + 1}`));
    if (new Set(this.vertices.map(vertex => vertex.id)).size !== this.vertices.length) throw new Error('Polygon vertex ids must be unique');
    this.closed = Boolean(closed);
    this.y = finite(y, 'Polygon y');
    this.color = [...color];
    this.selectedColor = [...selectedColor];
    this.selection = new Set();
    this.sequence = this.vertices.length;
    this.undoStack = [];
    this.redoStack = [];
  }

  snapshot() { return { vertices: cloneVertices(this.vertices), closed: this.closed, selection: [...this.selection] }; }

  restore(snapshot, { emit = true } = {}) {
    this.vertices = cloneVertices(snapshot.vertices ?? []);
    this.closed = Boolean(snapshot.closed);
    this.selection = new Set(snapshot.selection ?? []);
    if (emit) {
      this.emit('geometryChanged', { polygon: this.toPolygon() });
      this.emit('selectionChanged', { selection: [...this.selection] });
    }
    return this;
  }

  mutate(mutator, event = 'geometryChanged') {
    const previous = this.snapshot();
    mutator();
    this.undoStack.push(previous);
    this.redoStack.length = 0;
    this.emit(event, event === 'selectionChanged' ? { selection: [...this.selection] } : { polygon: this.toPolygon() });
    return this;
  }

  addVertex(value, index = this.vertices.length) {
    const vertex = normalizeVertex(value, `vertex-${++this.sequence}`);
    if (this.vertices.some(item => item.id === vertex.id)) throw new Error(`Polygon vertex id already exists: ${vertex.id}`);
    index = Math.max(0, Math.min(this.vertices.length, Math.floor(Number(index))));
    this.mutate(() => this.vertices.splice(index, 0, vertex));
    return vertex;
  }

  vertex(vertexOrId) {
    const vertex = typeof vertexOrId === 'string' ? this.vertices.find(item => item.id === vertexOrId) : vertexOrId;
    if (!vertex || !this.vertices.includes(vertex)) throw new Error('Unknown polygon vertex');
    return vertex;
  }

  moveVertex(vertexOrId, value) {
    const vertex = this.vertex(vertexOrId);
    this.mutate(() => {
      vertex.x = finite(value?.x ?? vertex.x, 'Vertex x');
      vertex.z = finite(value?.z ?? vertex.z, 'Vertex z');
    });
    return vertex;
  }

  removeVertex(vertexOrId) {
    const vertex = this.vertex(vertexOrId);
    const index = this.vertices.indexOf(vertex);
    this.mutate(() => {
      this.vertices.splice(index, 1);
      this.selection.delete(vertex.id);
      if (this.vertices.length < 3) this.closed = false;
    });
    return vertex;
  }

  insertVertex(afterVertexOrId, value) {
    const vertex = this.vertex(afterVertexOrId);
    return this.addVertex(value, this.vertices.indexOf(vertex) + 1);
  }

  closePolygon() {
    if (this.closed) return this;
    if (this.vertices.length < 3) throw new Error('Polygon requires at least three vertices to close');
    this.mutate(() => { this.closed = true; }, 'polygonClosed');
    this.emit('geometryChanged', { polygon: this.toPolygon() });
    return this;
  }

  openPolygon() {
    if (!this.closed) return this;
    this.mutate(() => { this.closed = false; }, 'polygonOpened');
    this.emit('geometryChanged', { polygon: this.toPolygon() });
    return this;
  }

  select(vertexOrId, { additive = false } = {}) {
    const vertex = this.vertex(vertexOrId);
    const previous = this.snapshot();
    if (!additive) this.selection.clear();
    this.selection.add(vertex.id);
    this.undoStack.push(previous);
    this.redoStack.length = 0;
    this.emit('selectionChanged', { selection: [...this.selection] });
    return this;
  }

  clearSelection() {
    if (!this.selection.size) return this;
    const previous = this.snapshot();
    this.selection.clear();
    this.undoStack.push(previous);
    this.redoStack.length = 0;
    this.emit('selectionChanged', { selection: [] });
    return this;
  }

  undo() {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return false;
    this.redoStack.push(this.snapshot());
    this.restore(snapshot);
    return true;
  }

  redo() {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return false;
    this.undoStack.push(this.snapshot());
    this.restore(snapshot);
    return true;
  }

  toPolygon() { return { vertices: cloneVertices(this.vertices), closed: this.closed }; }
  edges() { return polygonEdges(this); }

  draw(renderer, context = {}) {
    if (!renderer) return;
    const world = vertex => {
      const base = this.worldPosition();
      return [base[0] + vertex.x, base[1] + this.y, base[2] + vertex.z];
    };
    for (const edge of this.edges()) renderer.line?.(world(edge.start), world(edge.end), this.color, this, context);
    for (const vertex of this.vertices) {
      const color = this.selection.has(vertex.id) ? this.selectedColor : this.color;
      renderer.point?.(world(vertex), [.045, .045, .045], color, this, context);
    }
  }
}

export { PolygonEditor, polygonEdges };
