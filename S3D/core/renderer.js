// Renderer interface for the generic 3D foundation.
// Concrete consumers provide drawing callbacks; this layer has no WebGL or host dependency.
class Renderer {
  constructor({ box = null, boxInstances = null, line = null, flow = null, point = null, text = null, primitive = null, imagePlane = null } = {}) {
    for (const [name, fn] of Object.entries({ box, boxInstances, line, flow, point, text, primitive, imagePlane })) {
      if (fn !== null && typeof fn !== 'function') throw new Error(`Renderer ${name} callback must be a function or null`);
    }
    this.handlers = { box, boxInstances, line, flow, point, text, primitive, imagePlane };
  }
  box(...args) { return this.handlers.box?.(...args); }
  boxInstances(...args) {
    if (!this.handlers.boxInstances) throw new Error('Renderer boxInstances callback is required for instanced submissions');
    return this.handlers.boxInstances(...args);
  }
  line(...args) { return this.handlers.line?.(...args); }
  flow(...args) { return this.handlers.flow?.(...args); }
  point(...args) {
    if (this.handlers.point) return this.handlers.point(...args);
    const [position, scale, color, object, context] = args;
    return this.handlers.box?.(position, scale, color, false, object, context);
  }
  text(...args) { return this.handlers.text?.(...args); }
  primitive(...args) { return this.handlers.primitive?.(...args); }
  imagePlane(...args) { return this.handlers.imagePlane?.(...args); }
}

export { Renderer };
