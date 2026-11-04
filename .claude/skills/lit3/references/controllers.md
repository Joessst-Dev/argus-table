# Reactive controllers in argus-table

## The interface

```ts
interface ReactiveController {
  hostConnected?(): void;    // host connected (also after a move)
  hostDisconnected?(): void; // host removed: undo hostConnected
  hostUpdate?(): void;       // before host.update(); runs before render
  hostUpdated?(): void;      // after host.updated()
}
```

Register with `host.addController(this)` in the controller constructor. If the host is already connected, `hostConnected` runs immediately.

## Data flow

```
properties ─▶ element.willUpdate ─▶ controller setters ─▶ controller state
user input ─▶ InteractionController ─▶ table state ─▶ host.requestUpdate()
scroll ─────▶ VirtualController (TanStack Virtual) ─▶ range ─▶ host.requestUpdate()
                                                 └▶ DataController.load(range)
render() reads: TableController (model) + VirtualController (window) + InteractionController (active cell)
```

- The element pushes properties into controllers in `willUpdate`, gated on `changed.has(...)`. Controllers expose read-only results to `render()`.
- Controllers never set the element's public properties. A state change that the host controls goes out as an event (controlled mode) instead.
- Keep controllers independent: if one needs another's output, the element passes it in (`this.virtual.setCount(this.table.rowCount)`), so each can be tested alone with a stub host.

## TanStack adapters

The project pins **TanStack Table v9** (`@tanstack/table-core` 9.3). The element does **not** use `@tanstack/lit-table`: TanStack sits behind `@argus-table/core`'s adapter (`core/src/table/create-table.ts`), the only module that imports it, so TanStack types never reach the public API. The installed package ships its own guides in `node_modules/@tanstack/table-core/skills/`; read them before changing the adapter.

### Table (core's adapter, wrapped by `TableController`)

```ts
// packages/table/src/controllers/table-controller.ts
readonly model = createTableModel<T, CellContent>({ columns: [], data: [], getRowId: undefined, sorting: [], columnSizing: {} });

// argus-table.ts
protected override willUpdate(changed: PropertyValues<this>) {
  if (changed.has('columns') || changed.has('data') || changed.has('getRowId')) {
    this.#table.update({ columns: this.columns, data: this.data, getRowId: this.getRowId });
  }
}

render() {
  const { columns, rowCount } = this.#table.model;   // ColumnView[] in visual order
  …
}
```

- The model **owns no state.** Sorting and sizing come in through `update()`; `nextSorting(columnId)` and `nextSizing(columnId, px)` only *propose* the next state. The element runs the proposal through `controllable` (controlled or uncontrolled), applies it if allowed, and fires the event after the update.
- Pass **stable references** (`columns`, `data`, callbacks). `update()` ignores unchanged references; new arrays make TanStack recompute row models.
- **Pinning is logical:** `pin: 'start' | 'end'`, the same names as TanStack v9, so no left/right mapping.
  - `ColumnView` carries `colIndex` (1-based, for `aria-colindex`), `offset` (the sticky inset from the start or end edge) and `pinEdge` (the pinned column next to the scrolling ones).
  - Give that edge cell the `cell-pinned-edge` part, plus a private `data-pin="start|end"` so the component can mirror the shadow.
- Read cells through the model: `valueAt(index, columnId)`, `cellContext(index, columnId)` for `cell` functions, `rowAt(index)` for `{ id, index, original }`.
- Server-side sorting and filtering (Phase 2): the adapter gets `manualSorting` / `manualFiltering`, and the state goes to `dataSource.getRows`.

### Virtualizer (`@tanstack/lit-virtual`, wrapped with the row pool by `VirtualController`)

```ts
// The virtualizer registers itself with the host. Its hostUpdated runs *before*
// the element's firstUpdated, so look the scroll element up lazily.
readonly #virtual = new VirtualController(this, () =>
  this.renderRoot.querySelector<HTMLElement>('[part~="table"]'),
);

willUpdate() {
  this.#virtual.configure({ count, rowHeight: this.#rowPx, overscan, rowIdAt });
}

render() {
  const { rows, totalSize } = this.#virtual.computeWindow();   // { slot, index, start }[] in pool order
  return html`
    <div part="table" role="presentation">            <!-- the one scroll container -->
      ${renderHeader(columns)}
      ${renderBody(rows, columns, totalSize)}         <!-- rows keyed by pool slot -->
    </div>`;
}
```

- Body rows are keyed by their **row-pool slot**, not by row id or index, so DOM is recycled instead of recreated, and they stay in pool order (ADR 0001 and its addendum). Screen readers get the position from `aria-rowindex`.
- `computeWindow()` updates the pool, so call it once per render.
- Rows are fixed height in v0.1. The height comes from CSS (`--argus-row-height`, density defaults), measured from a hidden probe element with a `ResizeObserver`, so themes change the virtualizer too. When it changes, `configure()` calls `measure()`.
- Auto row heights (Phase 2): attach `v.measureElement` via the `ref` directive on rows with `data-index`, and give the virtualizer `getItemKey` so measurements follow the row. This can trigger the one allowed extra pass.
- Column virtualization (for >30 columns, off by default) is a second virtualizer with `horizontal: true`; pinned columns are always rendered outside it.

## The one-extra-pass guard

```ts
#inMeasurePass = false;

protected updated() {
  if (!this.#inMeasurePass && this.#measureRenderedRows()) {
    this.#inMeasurePass = true;   // sizes changed: render exactly once more
    this.requestUpdate();
    return;                       // events fire after the extra pass
  }
  this.#inMeasurePass = false;
  // fire argus-range-change etc. here
}
```

Any equivalent works; the point is that measuring can trigger at most one extra update, then stops even if sizes still differ (auto heights and auto widths can otherwise chase each other forever).

## Testing a controller alone

```ts
class TestHost extends EventTarget implements ReactiveControllerHost {
  controllers: ReactiveController[] = [];
  updateComplete = Promise.resolve(true);
  addController(c: ReactiveController) { this.controllers.push(c); }
  removeController() {}
  requestUpdate = vi.fn();
}
```

Or render a tiny `LitElement` that only hosts the controller, in Vitest browser mode, when the controller needs real DOM.
