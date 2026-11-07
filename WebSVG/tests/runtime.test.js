import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSVG } from '../src/websvg.js';

class FakeElement {
  constructor(attributes = {}, children = [], name = 'g') {
    this.attributes = new Map(Object.entries(attributes));
    this.children = children;
    this.localName = name;
    this.id = attributes.id ?? '';
  }

  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  matches(selector) {
    const match = /^\\[([^\\]]+)\\]$/.exec(selector);
    return match ? this.hasAttribute(match[1]) : false;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
}

function fixture() {
  const a = new FakeElement({ 'data-websvg-id': 'rep:A', 'data-mode': 'P' });
  const b = new FakeElement({ 'data-websvg-id': 'rep:B' });
  const edge = new FakeElement({ 'data-websvg-id': 'rep:edge:A:B' });
  const svg = new FakeElement({}, [a, b, edge], 'svg');
  const manifest = {
    schema: 'websvg/test/0.1',
    document_set: 'test-set',
    documents: [{ id: 'main', file: 'drawing.svg' }],
    representation: {
      identity_attribute: 'data-websvg-id',
      local_value_attributes: ['data-mode'],
    },
    bindings: [
      { representation_ref: 'rep:A', semantic_ref: 'entity:A', kind: 'node' },
      { representation_ref: 'rep:B', semantic_ref: 'entity:B', kind: 'node' },
    ],
    binding_rules: [],
    relation_rules: [],
    relation_binding_rules: [{
      relation_type: 'dependency',
      representation_template: 'rep:edge:{from}:{to}',
      from_prefix: 'entity:',
      to_prefix: 'entity:',
    }],
    relations: {
      dependencies: [{
        id: 'dep:A:B', type: 'dependency', from: 'entity:A', to: 'entity:B',
      }],
    },
  };
  return { a, b, edge, svg, manifest };
}

function installBrowserStubs(fixture) {
  const original = {
    document: globalThis.document,
    DOMParser: globalThis.DOMParser,
    fetch: globalThis.fetch,
    CustomEvent: globalThis.CustomEvent,
  };
  globalThis.document = {
    baseURI: 'https://fixture.example/',
    importNode: node => node,
  };
  globalThis.DOMParser = class {
    parseFromString(_source, type) {
      assert.equal(type, 'image/svg+xml');
      return { documentElement: fixture.svg, querySelector: () => null };
    }
  };
  globalThis.fetch = async url => {
    assert.equal(String(url), 'https://fixture.example/drawing.svg');
    return { ok: true, text: async () => '<svg />' };
  };
  if (typeof globalThis.CustomEvent !== 'function') {
    globalThis.CustomEvent = class extends Event {
      constructor(type, options = {}) {
        super(type);
        this.detail = options.detail;
      }
    };
  }
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  };
}

test('loads SVG document and indexes exact representation-to-semantic bindings', async () => {
  const f = fixture();
  const restore = installBrowserStubs(f);
  try {
    const engine = new WebSVG();
    let loaded;
    engine.events.addEventListener('websvg:loaded', event => { loaded = event.detail; });
    await engine.load(f.manifest, { baseUrl: 'https://fixture.example/' });
    assert.equal(loaded.documentSet, 'test-set');
    assert.equal(loaded.documentCount, 1);
    assert.equal(loaded.representationCount, 3);
    assert.deepEqual(engine.semanticRefs('node'), ['entity:A', 'entity:B']);
    assert.deepEqual(engine.representationsForSemantic('entity:A'), ['rep:A']);
    assert.deepEqual(engine.representationsForRelation('dep:A:B'), ['rep:edge:A:B']);
    assert.deepEqual(engine.relations('entity:A').map(item => item.id), ['dep:A:B']);
    assert.deepEqual(engine.localValuesForRepresentation('rep:A')[0].attributes, { 'data-mode': 'P' });
  } finally { restore(); }
});

test('semantic selection keeps canonical identity in bindings, not SVG geometry', async () => {
  const f = fixture();
  const restore = installBrowserStubs(f);
  try {
    const engine = await new WebSVG().load(f.manifest, { baseUrl: 'https://fixture.example/' });
    const selection = engine.selectSemantic('entity:A');
    assert.equal(selection.ref, 'entity:A');
    assert.equal(f.a.getAttribute('data-websvg-highlight'), 'primary');
    assert.equal(f.edge.getAttribute('data-websvg-highlight'), 'relation');
    assert.equal(f.b.getAttribute('data-websvg-highlight'), 'related');
    engine.clearSelection();
    assert.equal(f.a.getAttribute('data-websvg-highlight'), null);
    assert.equal(f.edge.getAttribute('data-websvg-highlight'), null);
    assert.equal(f.b.getAttribute('data-websvg-highlight'), null);
  } finally { restore(); }
});

test('selecting a relation highlights its representation and endpoint semantics', async () => {
  const f = fixture();
  const restore = installBrowserStubs(f);
  try {
    const engine = await new WebSVG().load(f.manifest, { baseUrl: 'https://fixture.example/' });
    const selection = engine.selectRepresentation('rep:edge:A:B');
    assert.equal(selection.type, 'relation');
    assert.equal(selection.ref, 'dep:A:B');
    assert.equal(f.edge.getAttribute('data-websvg-highlight'), 'primary');
    assert.equal(f.a.getAttribute('data-websvg-highlight'), 'related');
    assert.equal(f.b.getAttribute('data-websvg-highlight'), 'related');
  } finally { restore(); }
});

test('generates relation edges from explicit rules, independent of SVG coordinates', () => {
  const engine = new WebSVG();
  const path = new FakeElement({ 'data-mode': 'W' });
  engine.manifest = {
    relation_rules: [{
      type: 'handoff',
      representation_prefix: 'rep:h:',
      from_semantic_prefix: 'step:',
      to_semantic_prefix: 'step:',
      mode_attribute: 'data-mode',
    }],
  };
  engine._representations.set('rep:h:prepare:deliver', [{ element: path }]);
  assert.deepEqual(engine._expandRelationRules(), [{
    id: 'rel:handoff:prepare:deliver', type: 'handoff',
    from: 'step:prepare', to: 'step:deliver',
    generated_by: 'relation_rule', mode: 'W',
  }]);
});

test('rejects malformed binding records without silently inventing semantics', () => {
  const engine = new WebSVG();
  engine.manifest = {
    bindings: [{ semantic_ref: 'entity:A' }],
    binding_rules: [],
    relation_binding_rules: [],
  };
  assert.throws(() => engine._indexBindings(), /binding\\.representation_ref is required/);
});

test('does not index undeclared visual representations as semantic nodes', () => {
  const engine = new WebSVG();
  engine.manifest = {
    bindings: [{ representation_ref: 'rep:not-present', semantic_ref: 'entity:phantom' }],
    binding_rules: [],
    relation_binding_rules: [],
  };
  engine._indexBindings();
  assert.deepEqual(engine.semanticRefs(), []);
});

test('rejects manifests without an SVG document to load', async () => {
  const original = globalThis.document;
  globalThis.document = { baseURI: 'https://fixture.example/' };
  try {
    await assert.rejects(() => new WebSVG().load({
      schema: 'websvg/test/0.1', document_set: 'empty', documents: [],
    }), /no SVG documents/);
  } finally {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  }
});
