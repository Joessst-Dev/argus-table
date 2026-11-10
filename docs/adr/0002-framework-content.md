# ADR 0002: Framework content through a content renderer, in pooled targets

- **Status:** Accepted (10 November 2026).
- **Builds on:** [ADR 0001](0001-shadow-vs-light-dom.md): light-DOM cell content, keyed and reused by pool slot.

## Context

Cells and headers took Lit templates, DOM nodes, strings and numbers. The React, Vue and Angular wrappers passed `columns` through as they were, so JSX, Vue components and Angular templates couldn't go in cells. The workaround was building DOM by hand.

Two facts make this harder than it sounds:

- **Cells are pooled.** A cell's light-DOM container is reused for other rows as the table scrolls (ADR 0001). Nothing signalled when a container started to show another row or went away. A framework, though, needs a place to mount, updates while that place is reused, and a moment to unmount.
- **The table measures content right after rendering it.** `width: 'auto'` reads the rendered cells in `updated()`. A framework that renders later (React's scheduled render, Vue's `nextTick`) would be measured empty, and the user would see one frame of stale content in a recycled cell.

## Decision

- **Foreign content.** `header` and `cell` may return anything. What the table can't render itself goes to a table-level `contentRenderer`: anything other than a string, a number, a Lit template or directive result, a DOM node, or an array of those. The wrappers set the renderer; users just return JSX, VNodes or template references.
- **Pooled targets.** A Lit `AsyncDirective`, `content()`, holds one target element (`div.argus-content`, `display: contents`) per light-DOM part. It hands foreign content to `renderer.render(target, content)` on every update. The target stays while the part lives, so a recycled cell updates its framework content in place (a React portal re-renders with new props, a Vue VNode tree patches, an Angular view gets a new context) instead of remounting.
  - The target is a child, never the container: the container holds Lit's markers.
- **Release.** The directive calls `renderer.release(target)` in four cases:
  - its part goes away (`repeat` drops a row slot or a column);
  - the content stops being foreign (a skeleton row, a plain value);
  - the renderer changes;
  - the table is disconnected. The table disconnects the `RootPart` that `render()` returned, and reconnecting renders the content again.
- **A synchronous flush.** After the light DOM renders, and before anything measures it, the table calls `flush()` once on each renderer that did work in that update. React commits all its portals there with `flushSync`. Vue's `render()` and Angular's `detectChanges()` are synchronous already. Content is then in place before `width: 'auto'` measures and before the browser paints.
- **Plugins** that nest a column's content in their own template wrap it with `host.content(value)` (also exported as `content()`), so foreign content works inside the column menu's header and formula headers.

## Options not taken

- **Per-row nodes keyed by row id**, returned from `cell` by the wrapper. This needs no element change, but every row scrolling in mounts a new component tree and every row leaving unmounts one: the churn pooling exists to avoid. And without a signal the wrapper can't tell when a node can be unmounted.
- **A per-column `cellRenderer`.** Explicit, but wrappers would have to rewrite every column, headers would need a second path, and users would learn a new key instead of returning JSX from `cell`.
- **Rendering frameworks asynchronously and re-measuring.** It would flash stale content in recycled cells and complicate `width: 'auto'` (a column measured too early is final).

## Consequences

- Framework cells behave like pooled list items in a virtualized list: a component's own state belongs to its pooled cell, not to a row. The wrapper docs say so: keep per-row state in the data, or key it by `rowId`.
- Each wrapper brings its renderer: React portals committed with `flushSync` (`react-dom` is now a peer of `@argus-table/react`), Vue's synchronous `render()` with the wrapper's app context and injections, and Angular embedded views moved into the target (the CDK portal pattern) with `detectChanges()`. Vue slots (`#cell-<id>`) and Angular templates (`argusCell`) reach the columns through an internal plugin that each wrapper puts first in `plugins`.
- The element grows by the directive (about 0.9 kB gzip), which with filtering took the CDN bundle to 51.2 kB and its budget from 51 to 52 kB. Plain content takes the same path as before, plus one directive per cell.
