# argus-table

## 0.5.0

### Minor Changes

- 29fdb31: New plugin host member `header(def)`. It returns a column's or column group's own header as the table shows it, ready to nest in a plugin's template: ``html`<b>${host.header(def)}</b>` ``.

  - It calls a function `header`, and a group without a header shows its id.
  - It wraps the result like `content()`, so React and Vue content still renders.
  - Since plugin hooks see content as `unknown`, this replaces the `(def.header as () => unknown)()` assertion that nesting a header used to need.

  The column menu and formula columns now use it.

### Patch Changes

- 22b625b: The user's own scrolling, clicks and key presses now reliably stop a position that `setState()` (or `scrollToRow()`) is still scrolling to. Before, when the next `dataSource` page arrived within a frame or two of the input, the table could finish the restore and move the rows away from where the user had taken over.

## 0.4.0

### Minor Changes

- 333ad32: **Breaking:** attribute, type and plugin API changes for 1.0 (ADR 0004).

  - **Boolean attributes:** `virtualize-columns="false"` and `selection-checkboxes="false"` now turn the feature off, like the column flags (`sortable="false"`). Before, any value turned it on.
  - **Saved state:**
    - `getState()` now includes `version: 1`. `setState()` ignores state of any other version, as it ignores unknown column ids, and reads state without a version as version 1.
    - `scroll.left` is renamed `scroll.inline`: it is the offset from the start edge, positive in RTL too. A saved `scroll` without `inline` restores only the row.
  - **State arrays are `readonly`:** `SortState`, `ColumnOrderState`, `SelectionState` and a set filter's `values`.
  - **New type:** `SortDirection` (`'asc' | 'desc'`).
  - **Plugins:**
    - Every `PluginHost` member is now required: `columns()`, `setPin()`, `setHidden()`, `setFilter()`, `filterValues()`, `filteredIndexes()`, `row()` and `content()`. You no longer need to check that they exist.
    - `setSort(columnId, undefined)` clears a sort; it used to take `null`.
    - `ColumnInfo.filterValue` is renamed `columnFilter`, and `ColumnInfo.filter` is no longer optional. `ColumnInfo.sorted` is a `SortDirection | undefined`.
    - The `columns` and `columnGroups` hooks see content as `unknown` (`ColumnDef<T, unknown>`), since in React and Vue it is the framework's own content. They may return `undefined` to leave the columns as they are.
    - `willUpdate` gets a `ReadonlySet<string>` of property names.
  - `toColumnDef()` and `toColumnGroup()` on `<argus-column>` and `<argus-column-group>` are internal and no longer in the Custom Elements Manifest.

- 443f4be: More for column groups:

  - Resize a group: drag the handle on its header, or press Alt+Arrow on it. The change is spread over its resizable columns in proportion to their widths, within their bounds. A double-click on the handle fits each of its columns to its content. These are column resizes: `argus-column-resize` fires once per column that changes.
  - `reorderable: false` on a group (`reorderable="false"` on `<argus-column-group>`) keeps it from moving as a whole; its columns still move within it.
  - Plugins can change the groups before the table reads them, with a new `columnGroups(groups, host)` hook beside `columns`.

- bb8194e: Column groups: headers over several columns, nested to any depth. Set `columnGroups`, or wrap `<argus-column>`s in `<argus-column-group>`:

  ```js
  table.columnGroups = [
    {
      id: 'customer',
      header: 'Customer',
      columns: ['name', { id: 'address', header: 'Address', columns: ['city', 'country'] }],
    },
    { id: 'order', header: 'Order', columns: ['status', 'total'] },
  ];
  ```

  ```html
  <argus-column-group group-id="customer" header="Customer">
    <argus-column column-id="name" header="Name"></argus-column>
    <argus-column column-id="city" header="City"></argus-column>
  </argus-column-group>
  ```

  - Each level of nesting adds a header row above the column headers. `columns` stays a flat list, and so do `columnOrder`, the other state properties and what plugins see.
  - A group's columns stay next to each other: on its first column's place, even when `columnOrder` lists them apart. Columns move only within their group, and a group moves as a whole: drag its header, or press Alt+Shift+Arrow on it. `argus-column-reorder` then has a `groupId`.
  - A group whose columns are pinned to different sides shows on each side, sticky with its columns. A wide group's label stays in view while its columns scroll past, `virtualizeColumns` included.
  - Group headers are column headers (`aria-colspan` over their columns) in the keyboard navigation: ArrowUp from a column header goes to its group, ArrowDown back. Columns without a group at a level sit under an empty filler cell. Groups don't sort or resize.
  - New parts: `header-group-row`, `header-group-cell`, `header-group-cell-dragging` and `header-group-filler`. Group headers take `--argus-header-bg` and `--argus-header-fg`, and each header row is `--argus-row-height` tall.
  - The CDN bundle grows by about 3.3 kB (min+gzip), to 58.2 kB; its size budget goes from 55 to 59 kB.

- ed14d91: Two plugin additions for columns computed from more than their definitions:

  - The `willUpdate(changed, host)` hook runs at the start of each update with the names of the properties that changed, before the `columns` hooks. A `host.invalidateColumns()` there runs `columns` again in the same update.
  - `host.filteredIndexes(except?)` gives the indexes in `data` of the rows the filters and the quick filter keep, leaving out the filters on the `except` columns and their text in the quick filter. An accessor of one of those columns may call it while the table filters or sorts.

- 218350c: **Breaking:** state events are renamed to `argus-<property>-change`. Each event's `detail` now holds the new value under the property's name, followed by what caused the change:

  | Before                 | After                            | `detail`                                                                                             |
  | ---------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
  | `argus-sort-change`    | `argus-sorting-change`           | `{ sorting }`                                                                                        |
  | `argus-column-resize`  | `argus-column-sizing-change`     | `{ columnSizing, columnId, width }` (was `sizing`)                                                   |
  | `argus-column-reorder` | `argus-column-order-change`      | `{ columnOrder, columnId, groupId? }` (was `order`)                                                  |
  | `argus-column-pin`     | `argus-column-pinning-change`    | `{ columnPinning, columnId, pin }` (was `pinning`)                                                   |
  | `argus-column-hide`    | `argus-column-visibility-change` | `{ columnVisibility, columnId, visible }` (was `visibility`, and `hidden` with the opposite meaning) |
  | `argus-column-filter`  | `argus-column-filters-change`    | `{ columnFilters, columnId, columnFilter }` (was `filters` and `filter`)                             |
  | `argus-row-select`     | `argus-selection-change`         | `{ selection }`                                                                                      |
  - The exported constants follow the new names: `SORTING_CHANGE`, `COLUMN_SIZING_CHANGE`, `COLUMN_ORDER_CHANGE`, `COLUMN_PINNING_CHANGE`, `COLUMN_VISIBILITY_CHANGE`, `COLUMN_FILTERS_CHANGE` and `SELECTION_CHANGE`.
  - The detail types are renamed too: `SortingChangeDetail`, `ColumnSizingChangeDetail`, `ColumnOrderChangeDetail`, `ColumnPinningChangeDetail`, `ColumnVisibilityChangeDetail`, `ColumnFiltersChangeDetail` and `SelectionChangeDetail`.
  - `argus-range-change` now reports `{ first, last }` (both inclusive) instead of `{ start, end }`.
  - `argus-cell-click` now also has `rowId` and `index`, like `argus-row-click`.

- 08c5fcf: **Breaking:** renamed tokens and a renamed part, plus new parts, for 1.0 (ADR 0004).

  **Renamed tokens:**

  | Before                  | After                   |
  | ----------------------- | ----------------------- |
  | `--argus-pinned-row-bg` | `--argus-row-pinned-bg` |
  | `--argus-row-stripe-bg` | `--argus-row-odd-bg`    |
  | `--argus-outline`       | `--argus-border`        |
  | `--argus-radius`        | `--argus-border-radius` |

  **Renamed part:** `cell-pinned-row` → `cell-in-pinned-row`. `cell-pinned` keeps meaning a cell in a pinned _column_.

  **New parts:**

  - `header-cell-sorted-asc` and `header-cell-sorted-desc`, so you can style the sort direction; `::part()` can't read `aria-sort`.
  - `sort-indicator`, the chevron in a sortable header.
  - `header-cell-pinned` and `header-cell-pinned-edge`, like the body cells' `cell-pinned` and `cell-pinned-edge`.
  - `row-error` on the rows of a `dataSource` page that failed to load, next to `row-loading`.

  The CDN bundle's size budget goes from 59 to 59.5 kB.

### Patch Changes

- 6edb3cd: Corrected API docs. The `dataSource` docs now mention `filters` and `quickFilter`, `argus-range-change` reports the rows in view, the `resize-handle` part also sits on column group headers, and `cell-sorted`, `cell-pinned` and `cell-pinned-edge` also cover pinned-row cells. `sorting` documents how several items sort. `@argus-table/themes` now releases with the other packages under one version.

## 0.3.0

### Minor Changes

- 1d1a6f0: `rowHeight: 'auto'` (`row-height="auto"`) fits each row to its content: wrapped text in `wrap` columns, and content taller than a line.

  ```html
  <argus-table row-height="auto"></argus-table>
  ```

  - The row height from `density` or `--argus-row-height` is the least a row is, and the header's height: the header doesn't grow. Pinned rows grow like body rows.
  - Content sits at the top of the cell, with the padding that centres one line, so one-line rows look as before. The new `--argus-cell-padding-block` token sets that padding.
  - Rows are measured as they render (framework content included), and again when their content changes size, such as an image loading: give images a size, so rows don't move then. Rows not seen yet count as one row.
  - Rows above the view that get taller don't move the rows you're looking at, and don't cut a scroll short.
  - Heights follow rows through sorting and filtering. Keyboard navigation, `scrollToRow()`, `getState()`/`setState()` and a million rows work as with fixed heights.
  - With `virtualizeColumns`, a row's height counts the columns rendered: a tall cell scrolling in from the side makes its row taller then.

- d052e1d: Rows can be filtered. `columnFilters` sets a filter per column id and saves as JSON; `quickFilter` searches every shown column, for your own search box:

  ```js
  table.columnFilters = {
    city: { kind: 'set', values: ['Lisbon', 'Oslo'] },
    total: { kind: 'number', op: 'between', value: 100, to: 500 },
  };
  table.quickFilter = 'oslo paid'; // or <argus-table quick-filter="…">
  ```

  - Four kinds of filter: `text` (contains, equals, starts with, empty, not empty, ignoring case), `number` and `date` (equal, not equal, less, greater, between, empty, not empty; dates by day, from ISO strings), and `set` (one of a list of values). A row shows when it passes every filter, and each word of `quickFilter` is found in one of its shown columns.
  - A column's `filter` (`'text'`, `'number'`, `'date'` or `'set'`, also as an `<argus-column filter>` attribute) lets users filter it from plugins such as the column menu. `filterFn(value, filter, row)` replaces the built-in matching, and `filterOptions` lists the values a `set` filter offers.
  - Filtered headers get the `header-cell-filtered` part and a funnel mark (part `filter-indicator`, token `--argus-filter-indicator-color`), and screen readers hear "Filtered" on them and the number of rows left after a change.
  - With a `dataSource`, the server filters: `getRows()` now receives `filters` and `quickFilter`, and a change reloads from the top.
  - Like `columnPinning`, `columnFilters` is uncontrolled until you set it. Plugins use the new `host.setFilter()`, which fires `argus-column-filter` (`{ columnId, filter, filters }`), and `host.filterValues()` for the values of a set filter. `host.column()` now reports a column's `filter` kind and its `filterValue`.
  - Select-all and Shift ranges take the rows the filters leave.
  - The bundle with everything inlined grows by about 1.9 kB (gzip).

- 090fcba: Columns take a `formula` (and `<argus-column>` a `formula` attribute) for the new `@argus-table/formulas` plugin, which computes the column from other columns. Without the plugin the table ignores it.

  Fixed: when a column kept its `id` but got a different `accessor`, cells kept showing the old values and the rows kept their old sort order until `data` changed. They now follow the new accessor.

- 9a28979: Columns can be pinned, unpinned, hidden and shown at runtime. Two new properties do it by column id, over each column's own settings, and save as JSON:

  ```js
  table.columnPinning = { total: 'end', id: false }; // pin total to the end, unpin id
  table.columnVisibility = { email: false }; // hide email
  ```

  - A column definition (or `<argus-column>`) can start hidden with `hidden`, and `pinnable: false` or `hideable: false` keep users from pinning or hiding it.
  - A hidden column isn't rendered, but the table still sorts by it and it keeps its place in the column order. Keyboard moves (Alt+Shift+Arrow) step over it, and focus on a column being hidden moves to the next one.
  - A pinned column joins its side nearest its place in the order, and a `{ flex }` column takes a fixed width while it's pinned.
  - Like `columnOrder`, both are uncontrolled until you set them. Plugins pin and hide columns with the new `host.setPin()` and `host.setHidden()`, which fire `argus-column-pin` (`{ columnId, pin, pinning }`) and `argus-column-hide` (`{ columnId, hidden, visibility }`, also when a column is shown). When the property is controlled, the event carries the proposed state and nothing changes until you set it. `host.column()` now describes hidden columns too, and `host.columns()` lists every column in order.

- e611a9e: Column virtualization for wide tables. Add `virtualize-columns` (the `virtualizeColumns` property) and the table renders only the scrolling columns in view, plus two on each side, instead of every column in every row:

  ```html
  <argus-table virtualize-columns></argus-table>
  ```

  - Pinned columns, the checkbox column and the focused cell's column always render. Focus survives scrolling sideways, and the arrow keys, Home and End reach every column.
  - `width: 'auto'` columns out of view still fit their content, and `autosizeColumns()` still measures columns out of view.
  - Column reordering by drag works across columns that aren't rendered yet: the table scrolls, and the columns render as they come into view.
  - Off by default. With it on, cells are reused as columns scroll in and out, so their order in the DOM no longer follows the columns: page CSS that relies on it (`:nth-child` on cells) doesn't apply. `aria-colindex` gives each cell's position.

- b48284b: Columns can wrap their text: `wrap: true` on a column, or `wrap` on `<argus-column>`, wraps cell text onto more lines instead of cutting it off.

  ```js
  { id: 'note', header: 'Note', accessor: 'note', wrap: true }
  ```

  - Rows keep their height. Text that fits stays centred; longer text starts at the top and is clipped, so give wrapped columns room with `rowHeight` or `--argus-row-height`.
  - Headers don't wrap.
  - A `width: 'auto'` column fits its text unwrapped, up to `maxWidth`.

- 55b84a3: Headers and cells can show content from a framework, such as React elements. A `header` or `cell` may now return content the table doesn't render itself; it goes to the table's new `contentRenderer` (`render(target, content)`, `release(target)`, `flush()`), which the framework wrappers set for you. Each cell keeps its target while the table scrolls, so the framework updates the content in place instead of remounting it, and the content is committed before the table measures `width: 'auto'` columns or the page paints.

  - `ColumnDef` takes the content type as an optional second parameter (`ColumnDef<Row, MyContent>`), for wrappers and frameworks.
  - Plugins that nest a column's header or cell in their own template wrap it with the new `host.content()` (also exported as `content()`), so framework content works there too.

- d1716be: Plugins can read body rows in the current order with `host.row(index)`, and a dialog a plugin opens from a header no longer sorts the column or starts a column drag when it's pressed.
- fc539da: Plugins. The new `plugins` property takes add-ons, such as the column menu from `@argus-table/header-menu`:

  ```js
  import { headerMenu } from '@argus-table/header-menu';
  table.plugins = [headerMenu()];
  ```

  - A plugin is an object with a `name` and any of three hooks. `connect(host)` runs while the table is connected and may return a cleanup function. `columns(defs, host)` changes the column definitions before the table reads them, for example to add computed columns or wrap headers. `keydown(event, target, host)` sees keys on a focused header or cell before the table does, and returns `true` to claim one.
  - The `host` lets a plugin read the resolved columns (`column(id)`), find the header or cell of an event (`cellOf(event)`), sort (`setSort(columnId, 'asc' | 'desc' | null)`, which follows the controlled and uncontrolled rules of `sorting`), focus a header, announce a message to screen readers, and re-render. The table's own API is on `host.element`.
  - Plugins run in array order. A new array with the same plugins changes nothing, and a plugin that throws is reported in the console and skipped instead of breaking the table.
  - The types `ArgusPlugin`, `PluginHost`, `CellTarget` and `ColumnInfo` are exported.

  Clicks on interactive content in a header (a button, a link, an input) no longer sort the column.

- 5c08bb1: Row selection. Set `selectionMode` (or the `selection-mode` attribute) to `'single'` or `'multi'`, and the selected rows' ids are in `selection`:

  ```html
  <argus-table selection-mode="multi"></argus-table>
  <script type="module">
    const table = document.querySelector('argus-table');
    table.getRowId = (order) => order.id;
    table.addEventListener('argus-row-select', (e) => console.log(e.detail.selection)); // ['o2', 'o7']
  </script>
  ```

  - A click selects a row. In `'multi'` mode, Ctrl+click (Cmd+click on macOS) adds or removes a row, Shift+click selects the range from the last row clicked, and Ctrl+Shift+click adds that range.
  - From the keyboard, Space toggles the focused row. In `'multi'` mode, Shift+ArrowUp/ArrowDown and Shift+PageUp/PageDown extend the selection, and Ctrl+A (Cmd+A) selects every row.
  - `selection` is uncontrolled until you set it, like `sorting`. Once set, a change only fires `argus-row-select` with the proposed ids, and the table waits for you to set them. `ROW_SELECT` and `RowSelectDetail` are exported.
  - Clicks on buttons, links and inputs inside cells don't select. Pinned rows can't be selected, and neither can `dataSource` rows still loading. With a `dataSource`, Ctrl+A selects the rows loaded so far.
  - Ids stay selected through sorting and new data, and show again when their rows come back.
  - Selected rows get the part `row-selected` and `aria-selected="true"`. `--argus-row-selected-bg` paints them (pinned columns too), which the default and Material-inspired themes already set. Without it, they use the system highlight colour.

- cfbc794: `getState()` and `setState()` save and restore a user's layout. `getState()` returns the sort order, column widths, column order, pins, hidden columns, filters, selection, `quickFilter` and the scroll position as one object of plain JSON (the new `TableState` type), and `setState(state)` puts it back:

  ```js
  const KEY = 'orders-table';
  await table.setState(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  addEventListener('pagehide', () => {
    localStorage.setItem(KEY, JSON.stringify(table.getState()));
  });
  ```

  - `setState()` changes only the keys it's given, and ignores ids of columns that no longer exist. It fires no events, like setting a property.
  - Properties you control are left alone: set them yourself. The others stay uncontrolled, so users go on changing them as before.
  - `scroll` (`{ row, left }`: the row at the top and the horizontal offset, positive in RTL too) is applied after the rest. With a `dataSource`, a row beyond the rows counted so far is scrolled to as its pages arrive, unless the user scrolls, clicks or presses a key first.
  - `getState()` returns a copy, with controlled properties at the values you set.
  - The bundle with everything inlined grows by about 0.5 kB (gzip).

- a691e9d: A checkbox column for row selection. Add `selection-checkboxes` (the `selectionCheckboxes` property) to a table with a `selectionMode`:

  ```html
  <argus-table selection-mode="multi" selection-checkboxes></argus-table>
  ```

  - The column comes first, pinned to the start. A row's checkbox selects or deselects that row and keeps the others, and Shift+click adds the range from the last row clicked.
  - In `multi` mode the header has a select-all checkbox. It's checked when every row is selected and mixed when some are. A click selects every row, or clears the selection when all are selected. With a `dataSource` it covers the rows loaded so far.
  - Space on a focused checkbox cell, or on the header, does the same as clicking its checkbox. The checkboxes don't take focus themselves, so the arrow keys keep working.
  - The column isn't one of your `columns`. It isn't in `columnOrder` or `columnSizing`, can't be sorted, resized or moved, and clicks in it fire no `argus-cell-click` or `argus-row-click`. Its id, `--argus-selection`, is reserved.
  - New parts: `cell-selection`, `header-cell-selection`, and `selection-checkbox` on the checkboxes, so `::part(selection-checkbox) { accent-color: … }` colours them.

  Also: Ctrl+A (Cmd+A) now adds every row to the selection instead of replacing it, so ids selected on `dataSource` pages that were dropped from memory stay selected.

### Patch Changes

- 282b5eb: Fix `virtualizeColumns`: after scrolling sideways, cells no longer wrap onto extra lines within their row, which left the table overlapping and unreadable. Each cell now stays on its row's line.
- ad09697: In Firefox, the header and the rows pinned to the top stay in view deep in large tables. Firefox lets go of them once a table has scrolled more than about 8.95M px (about 220,000 rows of 40 px), so the table now keeps its scroll range under that there, as it already does past the browsers' maximum element height. Tables that tall scroll a little further per wheel step in Firefox.

## 0.2.2

### Patch Changes

- 8cd61c8: Clicking a header, tabbing into the table, or moving focus through the header or pinned rows no longer scrolls the body in Chromium- and WebKit-based browsers. A header click, for example to sort, used to move the body by several rows. Focused body cells still scroll clear of the header, the pinned rows and the pinned columns.

## 0.2.1

### Patch Changes

- fe9949e: Mouse-wheel scrolling from the top of a table no longer stalls in WebKit. Each wheel step moved only a few pixels until the table had rendered a full window of rows, because every new row's slots cancelled WebKit's scroll animation. The table now renders that full window from the start, with the overscan that has no room at either end on the other side, so scrolling only reuses rows.

## 0.2.0

### Minor Changes

- b9b0b2e: Declarative columns: write columns as `<argus-column>` children instead of setting the `columns` property.

  ```html
  <argus-table>
    <argus-column column-id="id" header="Order" accessor="id" width="90" pin="start"></argus-column>
    <argus-column
      column-id="customer"
      header="Customer"
      accessor="customer.name"
      width="1fr"
      sortable
    ></argus-column>
    <argus-column column-id="actions" header="Actions" width="100" resizable="false">
      <template><button>Open</button></template>
    </argus-column>
  </argus-table>
  ```

  - Attributes cover the plain fields: `column-id`, `header`, `accessor`, `width` (`90`, `auto` or `2fr`), `min-width`, `max-width`, `pin`, `align`, `sortable`, `resizable` and `reorderable` (`resizable="false"` turns resizing off). Functions and rich content go in properties: `accessor`, `header` and `cell`.
  - A `<template>` child is static content for every cell of the column. Use the `cell` property for content that depends on the row.
  - The table follows its children: add, remove or move a column, or change an attribute, and the columns update, keeping widths, order and sorting. Loops in Vue, Angular or React just work.
  - A non-empty `columns` property wins over the children.

- 8f008b3: Auto column widths: a column with `width: 'auto'` fits its content: the header, the pinned rows and the rows in view, within `minWidth` and `maxWidth`. It measures once the first rows render and then keeps its width, so scrolling or new data never move the columns. Templates and components in cells are measured as rendered.

  - Double-click a column's resize handle to fit it to the rows in view.
  - `autosizeColumns(ids?)` fits several columns at once (default: every resizable column).
  - Both count as resizes: they update `columnSizing` (or only propose it, when you control it) and fire `argus-column-resize`, once per column that changes.
  - A press on a resize handle without dragging no longer changes the column's width. Before, it fixed a `{ flex }` column at its current width and fired `argus-column-resize`.

- eebb8a1: Column reordering: drag a header to move its column. A line shows where it will land, and Escape cancels the drag. Columns move within their own group: start-pinned columns among themselves, scrolling columns among theirs, end-pinned columns among theirs. Dragging a scrolling column toward the table's edge scrolls the table.

  - From the keyboard, focus a header and press Alt+Shift+Arrow to move it one place (mirrored in right-to-left layouts). Focus stays on the header, and screen readers hear where it went, for example "Customer moved to column 3 of 8".
  - `columnOrder` holds the order as column ids, and `argus-column-reorder` fires with `{ columnId, order }` after each move. Like `sorting` and `columnSizing`, it is uncontrolled until you set it. Once you set it, a move only proposes the new order, so you can save it and restore it later.
  - `reorderable: false` on a column keeps it from being dragged or moved. Other columns can still move past it.
  - New parts `header-cell-dragging` and `drop-indicator`, and a new token `--argus-drop-indicator-color`.
  - A drag on a header starts after the pointer moves a few pixels, so a click still sorts. Header text can no longer be selected by dragging across it.

- d86671c: Infinite loading: set `dataSource` instead of `data` to load rows from a server, page by page, as they scroll into view. `getRows({ start, end, sorting, signal })` gets the rows to load (`end` exclusive, like `slice`) and resolves to `{ rows, total? }`; `pageSize` sets the page size (default 100).

  - Only the pages in view are requested, once scrolling settles, so a fast fling loads only where it stops. Requests for pages that scroll away are aborted through `signal`.
  - Rows still loading show skeleton bars (parts `row-loading` and `skeleton`, colour `--argus-skeleton-bg`). The bars pulse, except with reduced motion.
  - Without a `total`, the table grows as pages arrive and ends at a page with fewer rows than it asked for. Screen readers hear an unknown row count until then.
  - Sorting happens on the server: `sorting` comes with every request, and a new order reloads from the top.
  - A page that fails fires `argus-load-error` (`{ error, start, end }`, also exported as `LOAD_ERROR`) and shows a Retry button (part `retry`) in its first visible row. Enter on a cell of a failed row retries too.
  - New method `refresh()`: drops the loaded pages and loads the rows in view again, keeping the scroll position.

- 8550539: More keyboard navigation in the grid. PageDown and PageUp move focus by a page of rows (the rows that fit below the header) in the same column, and the view scrolls with it, so the focused cell keeps its place on screen. Ctrl+Home jumps to the first header and scrolls to the top, and Ctrl+End jumps to the last row's last cell, even 100,000 rows down. Cmd+Home and Cmd+End do the same on macOS. As before, keys pressed inside cell content are left to that content.
- aa1a40b: Pinned rows: `pinnedRows: { top?, bottom? }` keeps rows fixed below the header or at the bottom of the view while the body scrolls, for a totals or summary row. They are separate objects, not rows of `data`: the columns read them as usual, they are never sorted, and they work the same with a `dataSource`.

  - A column's `cell` function gets `pinned: 'top' | 'bottom'` in its context, so it can show a summary row its own way.
  - The keyboard moves through them like any row: from the header into the top rows, the body, and on to the bottom rows; Ctrl+End lands on the last one. PageUp and PageDown page through the body only.
  - Clicks and Enter on them fire `argus-cell-click` and `argus-row-click`, with `pinned` in the detail and `index` counted within their list.
  - New parts `row-pinned`, `row-pinned-top`, `row-pinned-bottom` and `cell-pinned-row`, and a new token `--argus-pinned-row-bg` for their background.
  - Screen readers count them as rows: the first body row's `aria-rowindex` now comes after the top pinned rows.

- 6b33bbc: Any number of rows now scrolls to the last one. Browsers limit how tall an element can be (about 33.5M px in Chromium and Safari, 17.9M px in Firefox), so before, the last rows of a very large table couldn't be reached: from about 840k rows of 40 px in Chromium and Safari, and in Firefox a table of more than about 450k rows didn't scroll at all. Past the browser's limit the table now renders a shorter body and scales the scroll position onto the rows: the scrollbar still spans every row, and a wheel step covers proportionally more of them. Keyboard navigation, `scrollToRow()` and focus keep working as before. Smaller tables are unchanged.
- 19012fe: New `--argus-radius` and `--argus-outline` tokens. `--argus-radius` rounds the table's corners, and the header, rows and pinned columns are clipped to them. `--argus-outline` draws a border around the whole table, as a `border` shorthand such as `1px solid #ddd`. By default the table stays square with no border.

### Patch Changes

- 2b954bf: The CDN build (`dist/cdn/argus-table.js`) is now fully minified and about 5 kB smaller gzipped. The npm build that bundlers use is unchanged.
- a5aa931: Sorting large tables is much faster, most of all in Firefox: sorting 1M rows took over a minute there and now takes under a second (Chromium: about 2.6 s, now about 0.65 s).
- 0f5a5a6: `columns`, `data` and `overscan` now treat `null` and `undefined` as their defaults (`[]`, `[]` and 6) instead of failing. Framework bindings set `undefined` when a prop is removed. The Custom Elements Manifest now has the type of each event's detail.

## 0.1.0

### Minor Changes

- 619ebe5: Ship a CDN build and bundled type declarations.

  - `dist/cdn/argus-table.js` is one minified ES module with Lit and TanStack inlined, for use straight from jsDelivr or unpkg (`<script type="module" src="https://cdn.jsdelivr.net/npm/argus-table">`).
  - The type declarations are one `dist/index.d.ts` with no import of internal packages.

- e382ee9: Resize columns. Resizable columns (the default) get a `resize-handle` on their header's inline-end edge: drag it, or press Alt+Arrow on a focused header for 10 px steps, mirrored in RTL. Widths stay within `minWidth` and `maxWidth`, and a resized flex column becomes fixed. The `columnSizing` property works uncontrolled or controlled like `sorting`, and `argus-column-resize` carries `{ columnId, width, sizing }` on every change, including each frame of a drag. The handle's line uses `--argus-resize-handle-color`.
- 63985c4: Enter on a focused body cell fires `argus-cell-click` and then `argus-row-click`, as a mouse click does. Enter pressed in content inside a cell (an input, a button) is left to that content.
- 8015153: Keyboard navigation and click events. The grid is one tab stop (roving tabindex): it starts on the first header, the arrow keys move between cells and between the header and the body (Left and Right are mirrored in RTL), and Home and End jump to the first or last cell of the row. The focused row stays rendered while it is scrolled out of view, so focus survives virtualization, and it stays on the same row when sorting changes the order. Focused cells show `--argus-focus-ring`. Keys pressed in content inside a cell are left to that content. Clicks in the body fire `argus-cell-click` `{ row, columnId, value }` and then `argus-row-click` `{ row, rowId, index }`; both are exported as `CELL_CLICK` and `ROW_CLICK`.
- 66d9155: Pin columns with `pin: 'start'` or `pin: 'end'`. Pinned header and body cells stay in place while the other columns scroll sideways, in LTR and RTL. Body cells in pinned columns get the `cell-pinned` part, and the one next to the scrolling columns also gets `cell-pinned-edge`, with a shadow from `--argus-pinned-shadow` (mirrored for the end side and in RTL; `none` removes it).
- 173c543: Render columns and data. `<argus-table>` now takes `columns`, `data`, `getRowId`, `rowHeight`, `density` and `overscan`, virtualizes rows (100,000 rows keep a small, bounded DOM), slots header and cell content from the light DOM (templates, DOM nodes, strings or numbers), exposes the grid to assistive tech with `aria-rowcount`, `aria-rowindex` and `aria-colindex`, fires `argus-range-change`, and adds `scrollToRow(index)`, the `empty` slot, the structural parts and the first tokens.
- 8d2d1a7: Sort by a column. Headers of columns with `sortable: true` cycle ascending, descending and unsorted on click, or on Enter and Space when focused. The `sorting` property works uncontrolled (the table keeps the order) or controlled (set it, and a click only proposes the new order through `argus-sort-change`; set `undefined` to hand it back). The sorted header gets `aria-sort` and the `header-cell-sorted` part, its body cells `cell-sorted`, and empty values sort last in both directions.

### Patch Changes

- ef3fdb9: New package `@argus-table/themes` with the default theme, `@argus-table/themes/default.css`. It is neutral: it uses the page's font, follows the system's light or dark setting through `light-dark()`, and uses one accent colour for focus, the sorted header and the resize handle. Put `data-argus-theme="dark"` or `"light"` on the table or an ancestor to force a scheme. The theme sets only tokens and `::part()` rules, so any token can be overridden after it. `argus-table` documents `--argus-row-selected-bg` as reserved for row selection; the table doesn't read it yet.
- 55f76be: Smaller bundle: the element's styles now ship minified (about 0.6 kB less gzipped in the CDN build). They render the same.
- 63985c4: The grid is one tab stop in Firefox too. Firefox makes the scroll container a tab stop of its own; Tab into the grid now moves straight on to the active cell, and Shift+Tab leaves the grid without stopping on the container.
- c2afe97: Pinned columns no longer make vertical scrolling stutter in Safari. Pinned body cells are now sticky only while the table scrolls sideways, and the pinned edge's shadow is drawn once per side instead of on every row. Nothing changes in the DOM, the accessibility tree, the `cell-pinned` and `cell-pinned-edge` parts, or `--argus-pinned-shadow`.
- 0269a6e: `<argus-table>` now also has `role="grid"` as an attribute (unless the page sets its own `role`), so accessibility checkers such as axe-core, which don't read the ElementInternals role, see the grid. The sort chevron no longer points sideways in right-to-left layouts.
