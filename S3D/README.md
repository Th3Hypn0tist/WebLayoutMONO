# S3D

> **License notice:** S3D is proprietary source-available software, not open source. The public source may be inspected and evaluated, but it may not be implemented, integrated, embedded, ported, adapted, redistributed, or used as part of your own software without a separate written license. See `LICENSE`.

S3D is a standalone structural spatial/3D framework.

## Canonical responsibility split

```text
IAM        = who
AccessCore = authority / may
DWH        = where / what relates to what
WebEngine  = execute the declared web structure
WebGUI     = generic UI primitives
S3D        = spatial / 3D primitives
```

S3D owns only the reusable spatial/3D primitive and reusable spatial-domain layer.

## Role

```text
DWH declarations
      ↓
 WebEngine
      ↓
     S3D
      ↓
spatial / 3D runtime
```

S3D does not know who the user is, whether the user is authorized, where canonical website relations live or why a host application chose to instantiate a spatial object.

## Dependency boundary

```text
WebEngine -> S3D        when spatial presentation is required
S3D -/-> WebEngine
S3D -/-> DWH
S3D -/-> IAM
S3D -/-> AccessCore
```

S3D remains independently usable without AIGM.fi or WebEngine.

## Framework layers

```text
domains/* -> core
core -/-> domains/*

host -> core
host -> domains/*
```

`core` contains domain-independent structural runtime, objects, transforms, math, rendering contracts and generic runtime mechanics.

`domains/*` contains reusable, independently instantiable domain implementations.

The host owns application instances, project state, source semantics, wiring and host-specific workflow.

## Current first-class domains

```text
domains/acoustics
domains/statistics
```

Domain terminology is allowed. Domain lock-in is not. A domain module must remain reusable outside the application that first required it.

## Core capability baseline

S3D core provides scene/object hierarchy, groups and links, transforms, reusable math/runtime primitives, renderer callbacks, packed render stores, box batching, lines, glyphs, flow pulses, picking, dragging and transform-gizmo infrastructure.

These capabilities are runtime primitives. They do not own canonical host-application meaning.

## Host authority rule

Data or relations supplied by WebEngine or another host remain host-owned canonical semantics.

```text
host declaration/state
      ↓ projection/input
     S3D
      ↓ runtime representation
spatial presentation state
```

S3D runtime state must not silently become canonical DWH/application truth.

## Architectural invariants

1. S3D is standalone and host-independent.
2. S3D does not consume DWH semantic symbols directly.
3. S3D does not authenticate or authorize.
4. S3D does not own WebEngine page/composition semantics.
5. S3D core does not import domain modules.
6. Domain modules remain independently importable.
7. Host-provided semantics remain host-owned.
8. Rendering backends do not own domain or application meaning.

See `Contracts/` for machine-readable framework and domain boundaries.
