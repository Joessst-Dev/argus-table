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
render() reads: TableController (row model) + VirtualController (range) + InteractionController (active cell)
```

- The element pushes properties into controllers in `willUpdate`, gated on `changed.has(...)`. Controllers expose read-only results to `render()`.
- Controllers never set the element's public properties. A state change that the host controls goes out as an event (controlled mode) instead.
- Keep controllers independent: if one needs another's output, the element passes it in (`this.virtual.setCount(this.table.rowCount)`), so each can be tested alone with a stub host.

## TanStack adapters

The project pins **TanStack Table v9** (9.3 is on the stable `latest` tag) and uses the official Lit adapters. The installed package ships its own guides in `node_modules/@tanstack/lit-table/skills/`; check them before copying the shapes below. Whatever the version, **wrap it in `@argus-table/core`'s adapter** (`core/src/table/create-table.ts`) and export argus-table's own types, so TanStack types never reach the public API.

### Table (`@tanstack/lit-table`)

```ts
import {
  TableController,
  tableFeatures,
  columnPinningFeature,
  columnSizingFeature,
  rowPinningFeature,
} from '@tanstack/lit-table';

// Features are registered explicitly in v9; keep this a module constant.
const features = tableFeatures({ columnPinningFeature, columnSizingFeature, rowPinningFeature });

#table = new TableController<typeof features, Row>(this);   // one per host, takes only the host

render() {
  const table = this.#table.table({                       // options on every render
    features,
    columns: this.resolvedColumns,   // memoised in willUpdate
    data: this.rows,
    getRowId: this.getRowId,
    initialState: { columnPinning: { start: ['name'], end: ['actions'] } },
  });
  const rows = table.getCenterRows();   // virtualize these; pinned rows come from getTopRows()/getBottomRows()
  …
}
```

- Pass **stable references** (`columns`, `data`, callbacks); new arrays every render make TanStack recompute row models.
- **Pinning is logical in v9:** positions are `'start' | 'end'` (column pinning state is `{ start: [], end: [] }`), the same names as the public `pin` value, so core's adapter needs no left/right mapping.
  - Offsets for sticky columns come from `column.getStart('start')` and `column.getAfter('end')`; cells from `row.getStartVisibleCells()`, `getCenterVisibleCells()` and `getEndVisibleCells()`.
  - Give the pinned cell next to the scrolling columns the `cell-pinned-edge` part, plus a private `data-pin="start|end"` so the component can mirror the shadow.
  - Row pinning is `'top' | 'bottom'`.
- Server-side sorting and filtering: set `manualSorting` / `manualFiltering` and pass the state to `dataSource.getRows`.

### Virtualizer (`@tanstack/lit-virtual`)

```ts
import { VirtualizerController } from '@tanstack/lit-virtual';

#virtual?: VirtualizerController<HTMLElement, Element>;

firstUpdated() {
  this.#virtual = new VirtualizerController(this, {
    count: this.rowCount,
    getScrollElement: () => this.scroller,
    estimateSize: () => this.rowHeightPx,
    overscan: this.overscan,
    getItemKey: (i) => this.rowIdAt(i),
  });
}

render() {
  const v = this.#virtual?.getVirtualizer();
  const items = v?.getVirtualItems() ?? [];
  return html`
    <div part="table" role="presentation">          <!-- the one scroll container -->
      ${renderHeader(…)}
      <div part="body" role="rowgroup">
        <div style=${styleMap({ height: `${v?.getTotalSize() ?? 0}px` })}></div>
        ${repeat(this.pooled(items), (p) => p.pool, (p) => this.renderRow(p))}   <!-- keyed by row-pool slot -->
      </div>
    </div>`;
}
```

- Body rows are keyed by their **row-pool slot**, not by `it.key`, so DOM is recycled instead of recreated (see "Templates" in SKILL.md and ADR 0001). `getItemKey` still matters: it keeps the virtualizer's measurements attached to the right row.
- The scroll element only exists after the first render, so create the controller in `firstUpdated` (or construct early and return the element lazily from `getScrollElement`).
- When `count` or sizes change, update options: `v.setOptions({ ...v.options, count })` then `v.measure()` if estimates changed, in `willUpdate`.
- Auto row heights: attach `v.measureElement` via the `ref` directive on rows with `data-index`; this can trigger the one allowed extra pass.
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
