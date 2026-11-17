# Detail rows (master/detail), and tables that fit their content

- **Date:** 17 November 2026
- **Status:** Design, for review (builder check done)

## Intent

A row can open a **detail panel** under it: content people work in, such as a form to edit the row, buttons, or a nested `<argus-table>` (an order's line items). It's the most common gap when people migrate to argus-table: 7 of the 9 libraries the `argus-table-integrate` skill migrates from have it (AG Grid, MUI X, PrimeNG/PrimeVue, Ant Design, Element Plus, Vuetify, Angular Material), and `skills/argus-table-integrate/references/gaps.md` tells people to keep the old grid on those screens today.

It's built on core's own row model ([ADR 0010](../../adr/0010-own-row-model.md)) as **rows the table shows that aren't data rows**. Tree data and row grouping, the next two features on the roadmap, need the same mechanism, so this design builds it once.

The work comes in two parts, shipped in this order:

1. **Tables that fit their content** up to a maximum height. A nested table in a panel needs it, and it's useful on its own (a short table on a page shouldn't leave empty space under its last row).
2. **Detail panels.**

Everything here is public API, frozen once released under [ADR 0004](../../adr/0004-api-1-0.md)'s compatibility policy.

## Goals

- Any body row the app allows can show a panel under it, opened and closed with a chevron button in a column of its own.
- Panel content is anything a cell can hold: Lit templates, DOM nodes, React, Vue or Angular content through the existing content renderers. Page CSS and the page's own components work inside, as in cells.
- Panels are interactive: forms, buttons and nested tables work with the mouse and the keyboard, and a nested `<argus-table>` keeps its own focus, keys, sorting and scrolling.
- A panel is as tall as its content up to a maximum (default 400 px), past which its content scrolls inside it.
- Several panels can be open at once. Which ones is state (`expanded`, row ids) that follows the controlled/uncontrolled pattern and is saved by `getState()`.
- Every public index keeps meaning "the nth data row in the current order": panels never shift `scrollToRow(index)`, `argus-cell-click`/`argus-row-click`'s `index`, `argus-range-change`, range selection or the plugin host.
- It stays fast at 1M rows with panels open, in all three engines, and scrolling with panels open passes the benchmark gate.
- It works with `data` and with a `dataSource`, with sorting and filtering, pinned columns, column virtualization, `rowHeight: 'auto'` and fixed row heights, RTL, and the React, Vue and Angular wrappers.
- Screen readers can reach and read a panel; axe passes.

## Non-goals

- Panels on pinned rows (`pinnedRows`).
- A panel per cell, or several panels per row.
- Nested panels inside a panel. A nested table in a panel can have its own panels: it's a separate table.
- Panels in exports (`@argus-table/export` keeps exporting data rows only).
- Opening a panel by clicking anywhere on the row. Apps that want it toggle `expanded` from `argus-row-click`.
- A one-panel-at-a-time mode. Apps get it by setting `expanded` to the newest id on `argus-expanded-change`; a mode can be added later without breaking anything.
- Tree data and row grouping. They come next and reuse the displayed-rows mechanism; nothing here should be built for them beyond that mechanism.
- Virtualizing against the page's scroll (a table with no maximum height that scrolls with the page).

## Anti-goals (failure even if it technically works)

- **Panels shift public indexes.** Any API that already counts data rows must keep counting data rows only.
- **Typed input is lost when a panel scrolls out of view and back** while it stays open (the row object unchanged).
- **Scrolling stalls in WebKit.** WebKit cancels a wheel scroll's animation whenever slot assignment changes inside the scroller (see `steadyWindow` in core and the "Pooled rows" section of `CLAUDE.md`). Panels must not assign or unassign light-DOM nodes to slots while scrolling.
- **Rows in view jump** when a panel above them opens, closes, loads or changes height.
- **A table without panels pays for them:** no measurable slowdown at 1M rows, and no extra DOM, when `rowDetail` isn't set.
- **The outer table takes keys meant for a panel's content** (a nested table's arrow keys, a form's Enter).

## Constraints

- **Size budget:** the CDN build is at 41.23 of 42 kB after ADR 0010. Part 2 will need a raise; the PR states the new size and asks for approval (raises need the maintainer's approval). Part 1 should fit as it is.
- **Pooled rows and slots:** body rows are keyed by pool slot, and light-DOM content is slotted `c-{poolSlot}-{col}` (ADR 0001). The steady window keeps the pool the same size while scrolling.
- **Heights:** `VirtualController` lays rows out with core's `RowSizes` (a Fenwick tree, O(log n)). Measuring, held corrections (`#hold`) and the px grid are `rowHeight: 'auto'` only today.
- **Scroll scaling** past the engines' maximum element height has to keep working (`ScrollScale`, `bodyCap`).
- **No hard-coded user-visible text:** labels go through `TableLabels` with English defaults, JSDoc and German text in the Features/Labels story.
- **Every feature gets** a Storybook story (with axe), a docs-site feature page in four flavours, its place in the integrate skill (`scripts/lib/api.mjs`, `references/api.md`, `gaps.md` and the migrate guides' `fit` for master/detail), a changeset, and updated `CLAUDE.md` sections.
- Wrappers are generated from the Custom Elements Manifest; content-typed properties need generator support (see below).

## Approaches considered

- **A. Panels as rows of their own (chosen).** Core's row model gets a list of displayed rows: data rows, plus a panel row after each open one. The virtualizer, `aria-rowindex` and keyboard moves work over displayed positions; every public surface keeps data indexes through one mapping in core. Chosen because interactive content needs a real grid row (arrow down lands on it, Enter goes into the form), and tree data and grouping need the same mechanism. It's the biggest change: the virtual controller, navigation, range selection, row measuring and light-DOM rendering stop assuming "position = data index".
- **B. The panel inside its row.** The row's box grows to hold the panel under its cells; no index mapping. Rejected: the panel would be an extra cell in a row with one more cell than there are columns, Down arrow would skip it, screen readers would read the form as part of the row, and it gives tree data and grouping nothing to build on.
- **An add-on (`@argus-table/detail`).** Rejected: plugins can't add rows. Letting them would mean building A anyway, plus a public plugin API for it to freeze.

For panel height, three behaviours were weighed: grow to fit (one scrollbar, but a nested table can't virtualize and needs a fit-to-content mode), a set height with the content scrolling inside (any row count, but scroll inside scroll and empty space under short content), and **grow to fit up to a maximum, then scroll inside (chosen)**, which needs the fit-to-content mode of part 1.

## Part 1: tables that fit their content

### Behaviour

A table whose height is `auto` is as tall as its header, pinned rows and body rows, up to its `max-block-size`; past that it keeps that height, scrolls and virtualizes as today:

```css
argus-table.items {
  block-size: auto;
  max-block-size: 360px;
}
```

No new property: it's CSS on the element. The default stays `block-size: 400px`.

### How (decided)

- The scroller (`[part~='table']`) keeps `block-size: 100%` and gets `max-block-size: inherit`, so a host with `block-size: auto` gets a scroller as tall as its content, capped by the host's maximum. The virtualizer already sizes its window from the scroller's height and the body from `RowSizes`, so nothing else should change; the builder confirms that the steady window and the `ResizeObserver` on the scroller settle in one extra update at most when the content height changes.
- A table with `block-size: auto` and **no** maximum would render every row (its view is as tall as its body). Decided by the maintainer: such a table is **capped at the window's height** (`window.innerHeight`, followed on resize) and scrolls inside past it, as if it had that `max-block-size`. It warns once in the console (`argus-table: block-size is auto without a max-block-size; capped at the window's height`). Letting it grow to all its rows with only the first screenful rendered was rejected: it leaves blank space that looks broken. Virtualizing against the page's scroll is a non-goal.
- A `max-block-size` in `%` is resolved against the host's container, which `inherit` can't carry; the docs say to use a length.

### Done when

- A table with 3 rows and `block-size: auto; max-block-size: 360px` is exactly as tall as its header and 3 rows, in all three engines; with 2,000 rows it's 360 px tall and virtualizes.
- Adding or removing rows, a `dataSource` page arriving, `rowHeight: 'auto'` measurements and density changes resize it.
- A story, a docs-site section ("Fit to content" on the sizing or layout page, four flavours), unit tests, and a changeset.

## Part 2: detail panels

### Public API (decided)

Names marked _(my call)_ were proposed by me and not discussed; they're easy to change before the build.

| Kind        | Name                                 | Shape                                                                | Notes                                                                                                                                                                       |
| ----------- | ------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property    | `rowDetail` _(my call)_              | `(context: { row: T; rowId: string; index: number }) => CellContent` | Setting it adds the toggle column. Property only. `index` is the data index in the current order.                                                                           |
| Property    | `rowExpandable` _(my call)_          | `(row: T) => boolean`                                                | Rows it returns `false` for get no chevron and can't open. Default: every row.                                                                                              |
| Property    | `expanded`                           | `readonly string[]` (row ids)                                        | Controllable, like `selection`: the table keeps it until the app sets it; set `undefined` to hand it back. Ids are never pruned. Ids of rows that can't expand are ignored. |
| Event       | `argus-expanded-change`              | `detail: { expanded, rowId, open }`                                  | Fired like the other state events (after the update, or right away with the proposed value when controlled). The wrappers derive two-way binding from the name.             |
| State       | `TableState.expanded`                | `string[]`                                                           | In `getState()` / `setState()`; `version` stays `1` (an added key).                                                                                                         |
| Token       | `--argus-detail-max-height`          | default `400px`                                                      | The most a panel is; its content scrolls past it.                                                                                                                           |
| Token       | `--argus-detail-bg` _(my call)_      | default `var(--argus-bg)`                                            | Panel background.                                                                                                                                                           |
| Token       | `--argus-detail-padding` _(my call)_ | default `var(--_pad)` (the cell padding)                             | Panel padding.                                                                                                                                                              |
| Part        | `row-detail`                         |                                                                      | The panel row.                                                                                                                                                              |
| Part        | `detail`                             |                                                                      | The panel's one cell (spans the width, scrolls past the maximum).                                                                                                           |
| Part        | `row-expanded`                       |                                                                      | Added to `row` on a body row whose panel is open.                                                                                                                           |
| Part        | `cell-expand`, `header-cell-expand`  |                                                                      | The toggle column's cells, like `cell-selection`.                                                                                                                           |
| Part        | `expand-toggle`                      |                                                                      | The chevron button.                                                                                                                                                         |
| Labels      | `expandRow`, `collapseRow`           | `'Show details'`, `'Hide details'`                                   | The button's accessible name, plain strings like `selectRow` _(my call)_.                                                                                                   |
| Plugin host | none                                 |                                                                      | Nothing new; `focusCell(index)` and the read members keep data indexes. Members can be added later (ADR 0004).                                                              |

Per-row maximum heights: the panel's content can style itself (`max-block-size` on the app's own element); the token sets the table-wide maximum _(my call; I said "overridable per row" in the conversation, and this is how)_.

### Behaviour (decided)

- **Toggle column:** a system column like the checkbox column (`kind: 'expand'`, id `EXPAND_COLUMN_ID`), pinned at the start, after the checkbox column when both show. It's not part of `columns`, `columnOrder`, `columnSizing` or click events. Only rows `rowExpandable` allows, and loaded rows, show a chevron. Its header cell is empty (no expand-all _(my call)_).
- **Keyboard:** on the chevron cell, Enter or Space toggles. Down arrow from a row with an open panel lands on the panel's cell; Enter or F2 there moves focus to the first focusable element in the panel; Escape inside the panel returns focus to the panel's cell. Keys from inside the panel's content are left to it, as for cell content today (so a nested table's keys stay its own). Home/End, PageUp/PageDown and Ctrl+Home/End count panel rows as rows.
- **Screen readers:** the chevron button has `aria-expanded` and `aria-controls` (the panel row's id), and its label. The panel row is a `row` with one `gridcell` with `aria-colspan` over every column. `aria-rowcount` and `aria-rowindex` count panel rows.
- **Width:** the panel spans the scroller's visible width and stays in place when the table scrolls sideways (sticky at the inline start, as wide as the visible area), in LTR and RTL.
- **Sorting, filtering, new `data`:** open panels follow their row by id. A filtered-out row keeps its id in `expanded`. A row the app replaces (a new object) renders its panel again from `rowDetail`.
- **When `rowDetail` runs** _(my call, after the builder check)_: on every update of a rendered panel, like a column's `cell`, rendered into the same target. Lit templates update in place, and React, Vue and Angular content re-renders into the same root, so component state, a half-typed form and a nested table's sort and scroll survive app updates, a new row object for the same id (polling, `applyEdit` from `@argus-table/editing`) and sorting (`context.index` is current at each call). As with `cell`, a `rowDetail` that creates a new DOM node on each call replaces the old one; the docs say to return a template or framework content, or to keep nodes per row id.
- **Typed input survives scrolling:** an open panel's target (and so its content) is kept per row id while the row is out of the window, and put back when it comes back. It's released when the panel closes, the row id leaves the data or the table disconnects.
- **Clicks inside a panel** fire no `argus-cell-click` or `argus-row-click` _(my call)_: otherwise an app that toggles `expanded` from `argus-row-click` would close a panel on every click into its form. A nested table's clicks are its own: the outer table attributes a click to a row only when that row is its own (today `#activate` takes the first `role="row"` on the event path, so a nested table's row would be read as an outer row; this fixes it).
- **A panel is at least one row tall** _(my call)_, even when its content is empty, so no more positions fit in view than rows do and the pools keep their size (see "How").
- **`dataSource`:** works the same. A row that isn't loaded shows no chevron and no panel; when its page loads, its panel appears (with rows in view held in place).
- **Selection:** panel rows can't be selected and don't count in ranges; Ctrl+A is unchanged. Clicking inside a panel doesn't select its row.
- **Striping:** `row-even`/`row-odd` stay by data index.
- **Focus kept:** like the active row, a panel holding focus stays rendered outside the window.
- **Opening above the rows in view** (from code, or a page loading) doesn't move the rows in view.

### How (decided)

- **Displayed rows in core.** A small module (working name `DisplayRows`) maps between data indexes and displayed positions: the data indexes with an open panel, sorted, and `position(dataIndex)`, `at(position)` → `{ kind: 'data', index } | { kind: 'detail', index }`, and the count. Built from the row order, `expanded` and `rowExpandable` when one of them changes (O(k log k) for k open panels plus the id lookups `indexOf` already makes); lookups in O(log k). Without `rowDetail` it's the identity and costs nothing.
- **The body works in displayed positions.** `RowLayout`'s body count, `aria-rowindex`, the virtualizer's count and `rowIdAt`, the window, the pool, the navigation controller's active cell and the light-DOM render use positions; everything public converts at the edge (events, `scrollToRow`, `argus-range-change`, the plugin host, selection). Ids for panel rows are derived from the row id (for example `detail:{rowId}`), so heights and pool slots follow them.
- **Heights:** panel rows are measured (`RowMeasure`) in both modes and their heights kept by id in `RowSizes`. With fixed `rowHeight`, data rows aren't measured: only panel rows are, with the held-correction logic applied to them. The builder decides how the fixed and auto paths share the code; the constraint is that a table without panels keeps today's fixed-height path (nothing allocated).
- **Two pools, and no slot changes while scrolling** _(my call, after the builder check)_: data rows keep today's pool; panel rows get a pool of their own, sized like the steady window (the most panels that can be in view at one row each, plus the overscan). A pooled row never switches between a data row and a panel row, since that would remove its `c-{slot}-{col}` slots and add a panel slot, which is the slot change that stalls WebKit's wheel scrolling. Every panel pool slot keeps its slotted element (`d-{poolSlot}`) rendered and assigned once created, hidden while unused. The per-row content node (the content directive's target, `div.argus-content`) is moved into and out of it, which doesn't change slot assignment. Kept targets are held in a map by row id and released through the content renderer when the panel closes.
- **Rendering:** `render/body.ts` renders a panel row for displayed positions of kind `detail`; `renderLightDom` renders the panel content; framework content goes through `content()` and `flushContent()` like cells, before measuring.
- **Wrappers:** the generator learns `rowDetail` as a content-typed property: React types it for React nodes (`withContent()` already renders through portals), Vue gets a `#detail` slot (mapped by the wrapper; it isn't a column, so not through the `vue-slots` plugin's column mapping), Angular gets `ng-template[argusDetail]` (an `ArgusDetailDirective`, like `ArgusCellDirective`). `argus-expanded-change` comes from `@fires` as usual.
- **ADR 0011** records the displayed-rows mechanism (positions inside, data indexes outside) for tree data and grouping to build on.

### Left to the builder

- Internal names (`DisplayRows`, the panel row ids, private attributes), file layout, and how the fixed-height and auto-height measuring paths share code.
- Where exactly each public surface converts between positions and data indexes, as long as every public index is a data index.
- The panel's internal styles (padding, borders, scroll shadow) within the tokens above.
- How focus moves into a panel when its first focusable element is inside a nested table (it lands on the nested table's tab stop).
- Test layout, story names, docs-site page names and examples.

## Done when

- The goals hold, checked by unit tests in all three engines, e2e (opening, typing, scrolling away and back, sorting with panels open, 1M rows with panels open, RTL), a Storybook story per behaviour with axe, and the docs-site page in four flavours (with e2e and axe per flavour).
- The benchmark has a variant with panels open (`VARIANTS`), and it passes the gate in Chromium, Firefox and WebKit; the default page's numbers are unchanged.
- The integrate skill knows the feature (`api.mjs`, `references/api.md`), `gaps.md` and the migrate guides no longer list master/detail as a gap, and `nx test skills` passes.
- `CLAUDE.md` describes displayed rows and panels; ADR 0011 is written; changesets for `argus-table` and the wrappers.
