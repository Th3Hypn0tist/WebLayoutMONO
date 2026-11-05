# WebGUI

WebGUI is a standalone, concept-free, minimalist DOM library for structural rendering.

It provides DOM construction, controls, structural composition, mounting and instance-owned theme selection. It does not contain application concepts, application state management, integration with another framework or host-specific adapters.

```js
import { WebGUI } from './WebGUI/webgui.js';

const gui = new WebGUI({ theme: 'default' });
document.body.append(gui.stack([
  gui.field('Name', gui.input({ name: 'name' })),
  gui.button('Save')
]));
```

Built-in themes are addressed by name and always remain in `themes/`:

```js
new WebGUI({ theme: 'default' });
```

A consuming project may keep its own theme anywhere and pass only its path or URL:

```js
new WebGUI({ theme: '/assets/themes/project.css' });
new WebGUI({ theme: new URL('./project.css', import.meta.url) });
```

The root contains one JavaScript entry point, `webgui.js`. It assembles all internal dependencies. See `Contracts/` for the binding rules.
