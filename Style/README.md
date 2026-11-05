# Style

Canonical visual contract for WebGUI and WebEngine surfaces.

Style contains no application logic and no domain-specific presentation rules. It consumes the stable presentation contracts defined by WebGUI and WebEngine and implements them with reusable CSS.

## Deployment

```text
Style repository
-> /style/
```

Canonical entry:

```text
/style/style.css
```

## Ownership

```text
WebGUI
  -> .wg-* primitive/component semantics

WebEngine
  -> .we-* application/composition semantics

Style
  -> visual implementation for .wg-* and .we-*
  -> semantic tokens
  -> dark/light themes

Domain
  -> uses the contracts
  -> does not create a parallel design system
```

Theme selection is explicit:

```html
<html data-theme="dark">
<html data-theme="light">
```

If `data-theme` is absent, the current default is dark.

See `Contracts/` for canonical boundaries.
