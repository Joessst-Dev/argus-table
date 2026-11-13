# Public API draft

[← Back to contents](../README.md)

One element, `<argus-table>`, configured through JS properties; attributes only for simple flags. Part and token names are frozen at 1.0, so this section is the thing to review hardest.

## Basic usage

```html
<argus-table id="orders" density="compact"></argus-table>
<script type="module">
  import 'argus-table';
  const table = document.querySelector('#orders');
  table.columns = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
    { id: 'customer', header: 'Customer', accessor: 'customer.name', width: 'auto' },
    { id: 'total', header: 'Total', accessor: 'total', align: 'end', sortable: true },
    { id: 'actions', header: '', width: 64, pin: 'end', cell: (row) => html`<button>…</button>` },
  ];
  table.data = orders; // or: table.dataSource = { getRows }
</script>
```

## Declarative columns (alternative to `columns`)

Columns can also be written as `<argus-column>` children. They are data-only elements: the table reads them into the same `ColumnDef[]`, so both styles share one code path.

```html
<argus-table>
  <argus-column column-id="id" header="Order" accessor="id" width="90" pin="start"></argus-column>
  <argus-column
    column-id="customer"
    header="Customer"
    accessor="customer.name"
    width="auto"
  ></argus-column>
  <argus-column
    column-id="total"
    header="Total"
    accessor="total"
    align="end"
    sortable
  ></argus-column>
  <argus-column column-id="actions" width="64" pin="end" resizable="false">
    <template><button>…</button></template>
  </argus-column>
</argus-table>
```

| Attribute                                | Property         | Notes                                                                                                                           |
| ---------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `column-id`                              | `columnId`       | The column's `id`. Not the global `id` attribute: two tables with the same column would otherwise put duplicate ids in the page |
| `header`                                 | `header`         | Text as an attribute; a template, a node or a function as a property                                                            |
| `accessor`                               | `accessor`       | A path as an attribute; a path or a function as a property                                                                      |
| `formula`                                | `formula`        | A spreadsheet formula, read by the `formulas()` plugin (see [Formula columns](#formula-columns-argus-tableformulas))            |
| —                                        | `cell`           | Property only. Wins over a `<template>` child                                                                                   |
| `width`                                  | `width`          | `90` or `90px`, `auto`, or `2fr` for `{ flex: 2 }`. Anything else means the default                                             |
| `min-width`, `max-width`, `pin`, `align` | same, camelCased |                                                                                                                                 |
| `sortable`, `resizable`, `reorderable`, `pinnable`, `hideable` | same | Absent: the default. `"false"`: off. Any other value: on. So `resizable="false"` turns resizing off |
| `hidden`                                 | `hidden`         | The standard attribute: hides the column, like `hidden` in a column definition |
| `filter`                                 | `filter`         | `text`, `number`, `date` or `set` (see [Filtering](#filtering))                                                                 |
| `wrap`                                   | `wrap`           | A flag like `sortable`. Wraps the cell text                                                                                     |
| —                                        | `filterFn`, `filterOptions` | Properties only                                                                                                      |

- Adding, removing or moving an `argus-column`, or changing one of its attributes or properties, rebuilds the column list, so `v-for`, `@for` or `.map()` in a framework just work. Sizes, order and sorting are kept by id, as with a new `columns` array. The columns tell the table themselves; the table has no `MutationObserver` on its children, which would fire on every cell render while scrolling.
- Only direct children count, in document order, and the children of `<argus-column-group>` children (see [Column groups](#column-groups)).
- A child `<template>` is static content for every cell of the column (cloned once per rendered cell and kept while the cell is recycled). Content that depends on the row needs the `cell` property. Changes inside the template's content aren't picked up: replace the template.
- Rule: a non-empty `columns` property wins, and the children are ignored (with a one-time console warning). `columns` is `[]` by default, so a framework wrapper that always binds it doesn't hide the children.
- The generated cell content is rendered as direct children of the table (slots need direct children; see ADR 0001), into a Lit part that ends at a private comment marker. Children added later go after the marker, so they never mix with the generated content.

## Column definition

| Field                    | Type                                                       | Purpose                                                                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | string                                                     | Stable key (state, parts, persistence). Must be unique and non-empty                                                                                                                                                               |
| `header`                 | `CellContent` \| `() => CellContent`                       | Header content                                                                                                                                                                                                                     |
| `accessor`               | string path (`'customer.name'`) \| `(row, index) => value` | Cell value                                                                                                                                                                                                                         |
| `formula`                | string                                                     | A spreadsheet formula computed per row from other columns (`'[price] * [qty]'`). Read by the `formulas()` plugin from `@argus-table/formulas`, which replaces `accessor`; the table alone ignores it                               |
| `cell`                   | `(row, context) => CellContent`                            | Custom cell content (rendered into light DOM). `context` is `{ row, rowId, index, columnId, value, pinned? }`; `pinned` is `'top'` or `'bottom'` for a row from `pinnedRows`                                                       |
| `width`                  | number \| `'auto'` \| `{ flex }`                           | Width mode. Default 150 px. `{ flex }` is a share of free space, at least `minWidth`; a pinned column takes 150 px instead (within its bounds) while it is pinned. `'auto'` fits the content (see [Column widths](#column-widths)) |
| `minWidth` / `maxWidth`  | number                                                     | Resize bounds. Default 40 px / no limit                                                                                                                                                                                            |
| `pin`                    | `'start'` \| `'end'`                                       | Fixed column. Logical sides: `'start'` is the left in LTR and the right in RTL. `columnPinning` overrides it (see [Pinning and visibility](#pinning-and-visibility))                                                               |
| `hidden`                 | boolean                                                    | Hides the column; `columnVisibility` overrides it. Default `false`                                                                                                                                                                 |
| `pinnable` / `hideable`  | boolean                                                    | Whether the user may pin or unpin the column, and hide it (from the column menu). The properties still apply. Default `true`                                                                                                       |
| `resizable` / `sortable` | boolean                                                    | Feature flags per column. Default: resizable, not sortable                                                                                                                                                                         |
| `reorderable`            | boolean                                                    | Whether the column can be moved (see [Column order](#column-order)). Default: `true`                                                                                                                                               |
| `filter`                 | `'text'` \| `'number'` \| `'date'` \| `'set'`              | The kind of filter users can set (from the column menu). Unset: users can't filter the column; `columnFilters` still applies (see [Filtering](#filtering))                                                                         |
| `filterFn`               | `(value, filter, row) => boolean`                          | Replaces the built-in matching for this column                                                                                                                                                                                     |
| `filterOptions`          | `FilterValue[]`                                            | The values a `'set'` filter offers. Needed with a `dataSource`; with `data` the table lists the column's distinct values                                                                                                            |
| `align`                  | `'start'` \| `'center'` \| `'end'`                         | Text alignment. Default `'start'`                                                                                                                                                                                                  |
| `wrap`                   | `boolean`                                                  | Wraps the cell text onto more lines instead of cutting it off. Default `false`. With a fixed row height the row doesn't grow: text that fits stays centred, longer text starts at the top and is clipped. The header doesn't wrap |

- `CellContent` is a Lit `TemplateResult`, a DOM `Node`, a string or a number.
- Without `cell`, a cell shows its accessor value as text. Empty values (`null`, `undefined`) sort last in both directions.

## Column widths

- `width: 'auto'` fits the column to its header, its pinned rows and the body rows rendered at that moment (visible plus `overscan`), within `minWidth` and `maxWidth`. Rows out of view aren't measured. Pinned columns can be `'auto'` too.
- It measures once the first loaded rows render, and then keeps that width: scrolling, new `data` or a new `columns` array with the same ids don't change it. With no rows it fits the header (and pinned rows), and fits again when rows arrive. While a `dataSource` loads its first page, it keeps the default width.
- The measured width isn't state: it doesn't appear in `columnSizing` and fires no event. A resize wins over it, as it does over `{ flex }`.
- A double-click on a column's `resize-handle` fits it to the rows in view; `autosizeColumns(ids?)` does the same for several. Both are resizes: they write `columnSizing` (or propose it, when controlled) and fire `argus-column-sizing-change`.
- Columns are measured with the browser's own layout (`max-content`), so templates, components, padding, density and the sort indicator are all counted. Web fonts still loading are measured again once they are ready.

## Column order

- A drag on a header moves its column: a `drop-indicator` line marks the header edge it would land at, the dragged header gets `header-cell-dragging`, and the order changes once, on drop. Escape cancels. The drag starts after a few pixels of movement, so a click still sorts; the click that ends a drag doesn't. Presses on interactive header content (a button, an input) and touches don't drag (a touch scrolls the table).
- Alt+Shift+Arrow on a focused header moves it one place, toward the arrow's side (mirrored in RTL). Focus stays on it, and a polite live region announces "Customer moved to column 3 of 8" (`labels.columnMoved`, see [ADR 0005](../../adr/0005-labels.md)). The region sits in the document body: a grid may only own rows.
- Columns move within their own group: start-pinned among start-pinned, scrolling among scrolling, end-pinned among end-pinned. A drag never pins or unpins a column. Dragging a scrolling column near the edge of the scrolling area scrolls it.
- `reorderable: false` keeps a column from being picked up or moved by keys. Other columns can still move past it, so its position can change.
- `columnOrder` is the order as column ids, as the table shows them. `[]` (the default) keeps the order of `columns`; after a move it lists every column. A host-set order is read per group: unknown and repeated ids are ignored, and columns it doesn't list follow the listed ones of their group in `columns` order. A new `columns` array keeps the order, matched by id.

## Column groups

`columnGroups` puts headers over several columns. Groups nest, and each level adds a header row above the column headers.

```ts
table.columnGroups = [
  { id: 'customer', header: 'Customer', columns: ['name', { id: 'address', header: 'Address', columns: ['city', 'country'] }] },
  { id: 'order', header: 'Order', columns: ['status', 'total'] },
];
```

```html
<argus-table>
  <argus-column column-id="id" header="Id"></argus-column>
  <argus-column-group group-id="customer" header="Customer">
    <argus-column column-id="name" header="Name"></argus-column>
    <argus-column-group group-id="address" header="Address">
      <argus-column column-id="city" header="City"></argus-column>
      <argus-column column-id="country" header="Country"></argus-column>
    </argus-column-group>
  </argus-column-group>
</argus-table>
```

- A group is `{ id, header?, reorderable?, columns }`: `columns` lists column ids and nested groups, in order. `header` takes the same content as a column's (text, a template, a node, a function, framework content in the wrappers); without one, the group shows its id. Group ids are unique among groups (an id may equal a column id). Unknown column ids are ignored, a column listed twice belongs to the first group that lists it, and a group left without columns isn't shown.
- `columns` stays a flat list, and so do the state properties and events: groups only add headers and keep their columns together. Plugins see the flat columns as before.
- Groups are top-aligned: a top-level group is in the first header row, a group inside it in the second, and so on. Header rows = the deepest nesting among the shown columns + 1. Columns without a group at a level sit under an empty filler there (part `header-group-filler`). A group whose shown columns are all hidden goes away, and its row with it if it was the deepest.
- A group's columns stay next to each other in the column order: on its first column's place, even when `columnOrder` lists them apart. A column moves only within its innermost group; a group moves as a whole, among the columns and groups beside it, by a drag on its header or Alt+Shift+Arrow on it. A group moves when it may (`reorderable`, default `true`; `reorderable="false"` on `<argus-column-group>`) and every one of its shown columns may; with `reorderable: false` its columns still move within it. `argus-column-order-change` then carries `groupId`, and `columnId` is its first column.
- Pinning splits a group: its columns pinned to a side show under a group cell of their own on that side, sticky with them. The label of a group in the scrolling area stays in view while its columns scroll past.
- A group with a resizable column has a `resize-handle` ("Resize group") on its header. Dragging it, or Alt+Arrow on the focused group header (10 px), resizes the group: the change is spread over its resizable columns in proportion to their widths, each within its `minWidth` and `maxWidth`; the other columns keep their width. A double-click on it fits each of its columns to its content, as `autosizeColumns()` does. These are column resizes: they write `columnSizing` (or propose it) and fire `argus-column-sizing-change` once per column that changes.
- Group headers don't sort or get a column menu. They take part in keyboard navigation (see [Accessibility](08-accessibility.md)).
- A non-empty `columnGroups` wins over `<argus-column-group>` children, and a non-empty `columns` turns off the children, groups included. `<argus-column-group>` takes `group-id` and `header` (text as the attribute; content or a function as the property), and holds `<argus-column>`s and groups.
- `columnGroups` isn't user state: it isn't in `getState()`, and no event changes it.

## Pinning and visibility

- `columnPinning` pins columns at runtime, by id, over their own `pin`: `{ total: 'end', id: false }` pins `total` to the end and unpins `id`. Columns it doesn't list keep their `pin`. `columnVisibility` hides and shows them, over their own `hidden`: `{ email: false, notes: true }` hides `email` and shows `notes`, defined as `hidden`. Both are plain objects, so they save as JSON.
- A pinned column joins its group at the edge nearest its place in `columnOrder` (the order of `columns` while `columnOrder` is `[]`), so pinning a scrolling column to the start puts it after the start columns before it. Pinning doesn't change `columnOrder`, and unpinning puts the column back. A flex column takes a fixed width while it is pinned.
- A hidden column isn't rendered (no cells, no light-DOM content, not counted in `aria-colcount` or `aria-colindex`), but it stays a column: the table can be sorted by it, formula columns read it, and it keeps its place in `columnOrder` and its width. Moves count the shown columns: Alt+Shift+Arrow steps over a hidden column. Focus on a column being hidden moves to the column that takes its place.
- Users pin and hide columns through plugins such as the [column menu](#column-menu-argus-tableheader-menu), with the plugin host's `setPin()` and `setHidden()`. `pinnable: false` and `hideable: false` keep a column out of those, and the last column shown can't be hidden by the user. The properties themselves aren't limited: a host can hide every column.
- Both follow the controlled/uncontrolled rules: once set, a change from a plugin only fires `argus-column-pinning-change` or `argus-column-visibility-change` with the proposed state.

## Filtering

`columnFilters` filters rows by column, and `quickFilter` searches them. A row shows when it passes every filter and the quick filter.

```ts
table.columnFilters = {
  city: { kind: 'set', values: ['Lisbon', 'Oslo'] },
  total: { kind: 'number', op: 'between', value: 100, to: 500 },
  customer: { kind: 'text', op: 'contains', value: 'ada' },
  placed: { kind: 'date', op: 'ge', value: '2026-11-01' },
};
table.quickFilter = 'oslo paid'; // from the app's own search box
```

- Four kinds of filter, by `kind`. `text`: `contains`, `equals`, `startsWith`, `empty`, `notEmpty`, ignoring case. `number`: `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `between` (inclusive; `to` is the upper bound, and a missing bound leaves that end open), `empty`, `notEmpty`; strings that are numbers count as numbers. `date`: the same operators with ISO dates (`'2026-11-10'`), compared by local day; cell values can be `Date`s, timestamps or ISO strings. `set`: `values` lists the values to keep, with `null` for empty ones; `values: []` keeps no rows.
- Empty means `undefined`, `null`, `''` or `NaN`, so a formula column's errors are empty. `ne` keeps empty values (they aren't equal to the number); every other comparison drops them. A text or number filter without a value or bound keeps every row.
- A column's `filterFn(value, filter, row)` replaces the built-in matching for that column, for any filter in its slot.
- `columnFilters` is a plain object keyed by column id, so it saves as JSON. Filters on hidden columns still apply; filters for unknown columns are ignored. It follows the controlled/uncontrolled rules: once set, a change from a plugin only fires `argus-column-filters-change` with the proposed filters.
- `quickFilter` (attribute `quick-filter`) splits into words; each word must be found, ignoring case, in the text of one of the row's shown columns. Strings, numbers and booleans are their text, a `Date` its local day (`2026-11-10`); objects and columns without an accessor aren't searched. It's the app's property: the table has no search box, and it fires no event for it.
- Users set filters through plugins: the [column menu](#column-menu-argus-tableheader-menu) offers a filter form on columns with a `filter` kind, through the plugin host's `setFilter()` and `filterValues()`.
- Filtered headers get the part `header-cell-filtered`, a funnel mark (part `filter-indicator`, coloured by `--argus-filter-indicator-color`) and `aria-description="Filtered"`. After a filter change, the live region announces the rows left ("42 rows"); with a `dataSource` the count isn't known yet, so nothing is announced.
- Row indexes (`argus-row-click`, `scrollToRow()`, `aria-rowindex`, ranges) count the rows the filters leave, in the current order. A focused row that is filtered out hands focus to the row in its place.
- Selection: a Shift range and select-all (Ctrl+A, the header checkbox) take the rows left; ids already selected stay, filtered out or not.
- With a `dataSource`, the table doesn't filter: `filters` and `quickFilter` go to `getRows()` (see [Data source](#data-source)). A `set` filter then offers the column's `filterOptions` only.
- Filtering reads each value once per row and filter through the column's accessor, not through TanStack's filtering feature (smaller bundle, and no slow `row.getValue()` in Firefox). Keep accessor functions stable, as for sorting: a new accessor filters again.

## Properties

| Property              | Attribute              | Type                                                                 | Default                                                                                                                                                             |
| --------------------- | ---------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns`             | —                      | `ColumnDef[]`                                                        | `[]`                                                                                                                                                                |
| `columnGroups`        | —                      | `ColumnGroup[]`                                                      | `[]` (see [Column groups](#column-groups))                                                                                                                          |
| `data`                | —                      | `T[]`                                                                | `[]`                                                                                                                                                                |
| `dataSource`          | —                      | `{ getRows(request), pageSize? }`                                    | — (wins over `data` while set; see [Data source](#data-source))                                                                                                     |
| `pinnedRows`          | —                      | `{ top?: T[], bottom?: T[] }`                                        | — (see [Pinned rows](#pinned-rows))                                                                                                                                 |
| `rowHeight`           | `row-height`           | number \| `'auto'`                                                   | unset: the density (or the `--argus-row-height` token) decides (40px at `comfortable`). A number set explicitly wins over density; `'auto'` fits rows to their content (see [Row heights](#row-heights)) |
| `density`             | `density`              | `'compact'` \| `'comfortable'` \| `'spacious'`                       | `'comfortable'`                                                                                                                                                     |
| `sorting`             | —                      | `SortState` (controlled or uncontrolled)                             | —                                                                                                                                                                   |
| `columnSizing`        | —                      | `Record<id, px>`                                                     | —                                                                                                                                                                   |
| `columnOrder`         | —                      | `string[]` (controlled or uncontrolled)                              | `[]` (see [Column order](#column-order))                                                                                                                            |
| `columnPinning`       | —                      | `Record<id, 'start' \| 'end' \| false>` (controlled or uncontrolled) | `{}` (see [Pinning and visibility](#pinning-and-visibility))                                                                                                        |
| `columnVisibility`    | —                      | `Record<id, boolean>` (controlled or uncontrolled)                   | `{}`                                                                                                                                                                |
| `columnFilters`       | —                      | `Record<id, ColumnFilter>` (controlled or uncontrolled)              | `{}` (see [Filtering](#filtering))                                                                                                                                  |
| `quickFilter`         | `quick-filter`         | string                                                               | `''`                                                                                                                                                                |
| `getRowId`            | —                      | `(row, index) => string`                                             | index (among all rows, for a `dataSource`)                                                                                                                          |
| `overscan`            | `overscan`             | number                                                               | 6                                                                                                                                                                   |
| `virtualizeColumns`   | `virtualize-columns`   | boolean                                                              | `false` (see [Column virtualization](#column-virtualization))                                                                                                       |
| `selectionMode`       | `selection-mode`       | `'none'` \| `'single'` \| `'multi'`                                  | `'none'`, reflected to the attribute (see [Row selection](#row-selection))                                                                                          |
| `selection`           | —                      | `string[]` of row ids (controlled or uncontrolled)                   | `[]`                                                                                                                                                                |
| `selectionCheckboxes` | `selection-checkboxes` | boolean                                                              | `false`: adds the checkbox column while `selectionMode` isn't `'none'`                                                                                              |
| `plugins`             | —                      | `ArgusPlugin[]`                                                      | `[]` (see [Plugins](#plugins))                                                                                                                                      |
| `labels`              | —                      | `Partial<TableLabels>`                                               | `{}`: English (see [Labels](#labels))                                                                                                                               |

## Labels

The built-in text is English. `labels` translates it ([ADR 0005](../../adr/0005-labels.md)): accessible names (`selectRow`, `selectAllRows`, `resizeColumn`, `resizeGroup`, the `filtered` description), the Retry button (`retry`, `retryRows`), the empty state (`noRows`, used when the `empty` slot is empty) and the announcements (`rowCount`, `columnMoved`, `groupMoved`). Keys left out stay English. Text with values in it is a function of an object, so it can pick a word order and a plural form; numbers are passed unformatted:

```js
const plural = new Intl.PluralRules('de');
table.labels = {
  selectRow: 'Zeile auswählen',
  rowCount: ({ count }) => `${count} ${plural.select(count) === 'one' ? 'Zeile' : 'Zeilen'}`,
};
```

`headerMenu({ labels })` and `formulas({ labels })` take the add-ons' text the same way (`HeaderMenuLabels`, `FormulasLabels`). The formula editor's labels load with the editor. Function names, error codes, the engine's error messages and the function descriptions stay English for now.

## Row heights

`rowHeight: 'auto'` (`row-height="auto"`) fits each body and pinned row to its content: wrapped text (`wrap` columns) and content taller than a line.

- The row height the density or `--argus-row-height` gives is the least a row is, and the header's height: the header doesn't grow.
- Content sits at the top of its cell, with the block padding that centres one line of text in a one-row cell (`--argus-cell-padding-block`), so one-line rows look as they do with a fixed height. Content a little taller than a line (a button, a badge) makes its row a little taller; a smaller `--argus-cell-padding-block` keeps such rows compact.
- Rows are measured as they render, once their content has rendered (framework content included). Rows not seen yet count as one row, so the scrollbar's length settles as rows are seen. Heights follow row ids through a sort or filter.
- A row measured above the rows in view doesn't move them: the table keeps the row at the top where it is, without cutting a scroll in progress short.
- A row counts the columns that render: with `virtualizeColumns`, a tall cell scrolling in from the side makes its row taller then.
- Content that changes size later (an image loading, a web font) is noticed and the row moves the rows below it. Give images a size, so rows don't move when they load.
- Rows are whole px tall, an even number of px in a body past 2^24 px (about 400k rows), where engines place elements only to 2 px; so rows stay flush at any position, scaled or not.
- Measuring costs a layout read per update; heights are kept per row in a tree (O(log n) to update and to find a row at an offset), so it works the same for a million rows.

## Data source

`dataSource` loads rows page by page as they scroll into view, instead of `data`. The table owns the cache; the host only answers requests.

```ts
table.dataSource = {
  pageSize: 100, // default
  async getRows({ start, end, sorting, filters, quickFilter, signal }) {
    const query = new URLSearchParams({
      offset: String(start),
      limit: String(end - start),
      sort: JSON.stringify(sorting),
      filters: JSON.stringify(filters),
      q: quickFilter,
    });
    const res = await fetch(`/api/orders?${query}`, { signal });
    const { rows, total } = await res.json();
    return { rows, total }; // total is optional
  },
};
```

- `start` is inclusive and `end` exclusive, like `Array.prototype.slice`, so `end - start` is the limit. (`argus-range-change` reports inclusive indices; the two answer different questions.)
- Only pages in view (plus `overscan`) are requested, once the range has been quiet for 50 ms, so fast scrolling loads where it stops. Pages that scroll more than a page away are aborted through `signal`; answers for an old source, order or `refresh()` are dropped. Pages far from the view (more than 10 pages away) are evicted, so memory stays bounded.
- With `total`, the table has exactly that many rows. Without it, the table keeps one page of skeleton rows below the last row it has, and a page with fewer rows than asked for marks the end. `aria-rowcount` is `-1` while the total is unknown.
- Sorting happens on the server: `sorting` arrives in every request, and a new order clears the cache, aborts what's in flight and scrolls to the top. The `sorting` property keeps its controlled and uncontrolled rules.
- Filtering happens on the server too: `filters` (the `columnFilters` state) and `quickFilter` arrive in every request. A change clears the cache and its row count, aborts what's in flight and scrolls to the top. `getRowId` ids should be the server's, so selection survives a filter.
- Rows not loaded yet render as skeletons: part `row-loading` on the row (with `aria-busy="true"`), part `skeleton` on a bar in each cell, coloured by `--argus-skeleton-bg`. The bars pulse unless `prefers-reduced-motion` is set.
- A page that fails (rejects or throws) fires `argus-load-error` and shows its rows with `skeleton skeleton-error` bars. Its first visible row gets a Retry button (part `retry`, labelled "Retry loading rows 201 to 300"); Enter on any cell of a failed row retries too. A failed page isn't requested again on its own until it scrolls far away and back.
- Clicks and Enter on rows that haven't loaded fire no `argus-cell-click` or `argus-row-click`. Focus can rest on a skeleton cell and stays there when the row arrives.
- `refresh()` drops every page and loads the rows in view again, keeping the scroll position. Replace the `dataSource` object to change `getRows` or `pageSize`.

## Pinned rows

`pinnedRows` fixes rows below the header (`top`) and at the bottom of the view (`bottom`), for example a totals row. They are separate objects, not rows of `data`:

```ts
table.pinnedRows = { bottom: [{ id: 'total', customer: 'Total', total: sum }] };
```

- Columns read them like any row (accessor, `cell`), and `cell` gets `pinned: 'top' | 'bottom'` in its context, so a column can render a totals row its own way. `index` there is the row's index in its list. Without `getRowId`, their ids are `'top-0'`, `'bottom-0'` and so on; with it, `getRowId(row, index)`.
- They are never sorted, aren't counted as data rows, aren't virtualized or pooled, and work the same with `data` and `dataSource` (they don't wait for pages).
- They stay in place while the body scrolls: the bottom rows sit at the bottom of the view, or right after the last row when the body is shorter. With no data rows, the `empty` slot shows between them.
- Rows are numbered header, top, body, bottom: `aria-rowindex` of the first body row is 2 plus the number of top rows, and `aria-rowcount` counts them all (still `-1` while a `dataSource` total is unknown).
- They take part in keyboard navigation (see [Accessibility](08-accessibility.md)), and clicks and Enter fire `argus-cell-click` and `argus-row-click` with `pinned` in the detail.
- Parts: `row row-pinned row-pinned-top` (or `-bottom`) on the row, `cell cell-in-pinned-row` on its cells. `--argus-row-pinned-bg` sets their background, pinned columns included.
- Replace the object to update them.

## Row selection

`selectionMode` turns selection on; `selection` holds the selected row ids, controlled or uncontrolled like `sorting`.

```ts
table.selectionMode = 'multi'; // or <argus-table selection-mode="multi">
table.getRowId = (order) => order.id;
table.addEventListener('argus-selection-change', (e) => console.log(e.detail.selection)); // ['o2', 'o7']
```

- Clicks work like a file list on the desktop. A click selects only that row; Ctrl+click (Cmd+click on macOS) adds or removes one row; Shift+click selects the range from the anchor (the last row clicked without Shift) to the clicked row, and Ctrl+Shift+click adds that range. Ranges follow the current order. In `'single'` mode a click selects that row (clicking it again keeps it), Ctrl+click clears it, and Shift is a plain click.
- Keys on a focused body cell: Space (or Shift+Space) toggles its row. In `'multi'` mode, Shift+ArrowUp/ArrowDown and Shift+PageUp/PageDown move focus through the body and select from the anchor to the focused row, and Ctrl+A (Cmd+A) selects every row, from a header too. See [Accessibility](08-accessibility.md).
- Presses on interactive content inside a cell (a button, a link, an input, a `contenteditable`) don't select. `argus-cell-click` and `argus-row-click` still fire, before `argus-selection-change`.
- Only loaded body rows can be selected. Rows from `pinnedRows` can't, nor `dataSource` rows still loading; a range over unloaded rows selects its loaded rows only. With a `dataSource`, Ctrl+A selects the rows loaded so far: a select-all over the server's whole dataset is the host's to model.
- The table never drops ids on its own. They stay through sorting, a new `data` array or pages evicted and loaded again, and show again when their rows come back. Filter `selection` yourself to drop rows that are gone. Without `getRowId` the ids are indices: in `data` they don't change with sorting, but a `dataSource` numbers rows in the server's order.
- Selected rows get the part `row-selected` and `aria-selected="true"`; every other selectable row has `aria-selected="false"`, and the grid is `aria-multiselectable` in `'multi'` mode. `--argus-row-selected-bg` paints them, pinned columns included, and wins over `--argus-row-hover-bg`. In forced-colors mode they use `Highlight`.
- `selection-checkboxes` adds a checkbox column, pinned first at the start (before the start-pinned columns), 40 px wide. A row's checkbox toggles that row and keeps the others; Shift+click adds the range from the anchor. A click elsewhere in the cell does the same. In `'multi'` mode the header has a select-all checkbox: checked when every selectable row is selected, mixed when some are; a click selects all (keeping ids selected elsewhere) or, when all are selected, clears the selection. Space on a focused checkbox cell, or on the header, does what its checkbox does. The checkboxes aren't focusable: their cell keeps focus, so arrows keep working. Rows that can't be selected (still loading) have no checkbox.
- The checkbox column isn't a column of `columns`: it isn't in `columnOrder` or `columnSizing`, can't be sorted, resized or moved (other columns can't move before it), fires no `argus-cell-click` or `argus-row-click`, and gets no light-DOM content. It counts in `aria-colindex` and `aria-colcount`. Its id, `--argus-selection`, is reserved. Ctrl+A also keeps ids selected elsewhere.

## Plugins

`plugins` takes add-ons that change the table from outside its core, so features such as a column menu or formula columns don't grow the main bundle. The first is the column menu, `@argus-table/header-menu`:

```ts
import { headerMenu } from '@argus-table/header-menu';
table.plugins = [headerMenu()];
```

A plugin is an object with a `name` and any of five hooks:

```ts
interface ArgusPlugin<T> {
  name: string; // in error messages
  connect?(host: PluginHost<T>): (() => void) | undefined; // a cleanup
  willUpdate?(changed: ReadonlySet<string>, host: PluginHost<T>): void;
  columns?(defs: readonly ColumnDef<T, unknown>[], host: PluginHost<T>): readonly ColumnDef<T, unknown>[] | undefined;
  columnGroups?(groups: readonly ColumnGroup<unknown>[], host: PluginHost<T>): readonly ColumnGroup<unknown>[] | undefined;
  keydown?(event: KeyboardEvent, target: CellTarget, host: PluginHost<T>): boolean | undefined;
}
```

- `connect` runs while the table is connected: when the plugin joins a connected table, and again after the table is moved in the DOM. Its cleanup runs when the plugin leaves `plugins` or the table disconnects. Plugins connect in array order and clean up in reverse.
- `willUpdate` runs at the start of each update of the table, before the `columns` and `columnGroups` hooks, with the names of the properties that changed (`data`, `columnFilters`, `quickFilter`, `columnVisibility`, …; on the first update, every property with a value). Calling `host.invalidateColumns()` there runs `columns` again in the same update, for columns computed from more than their definitions: formula columns with whole columns recompute when the filters or the data change.
- `columns` changes the column definitions before the table reads them: add computed columns, wrap a `header`, change defaults. The hooks chain in array order, starting from `columns` (or the `<argus-column>` children). They run again only when those columns or `plugins` change, or after `host.invalidateColumns()`; a `header` or `cell` function a plugin returns still runs on every render, so a plugin's own state shows after `host.requestUpdate()`. Returned columns are ordinary columns: they sort, resize, move and virtualize like any other. Returning `undefined` leaves the columns as they are. Content is `unknown` in these hooks, since a React or Vue table's `header` and `cell` return the framework's own; a plugin nests a column's content in its template through `host.content()`.
- `columnGroups` does the same for the [column groups](#column-groups), starting from `columnGroups` (or the `<argus-column-group>` children), and runs again when those or `plugins` change, or after `host.invalidateColumns()`. The Vue and Angular wrappers' template plugins use it for group headers.
- `keydown` sees a key on a focused header or cell (not the checkbox column) before the table does. Returning `true` claims the key and the table ignores it; the plugin calls `preventDefault()` itself. `target` is `{ section, columnId, rowIndex, rowId }`, with `section` `'header'`, `'top'`, `'body'` or `'bottom'`. Keys pressed in content inside a cell never reach the hook, as they never reach the table.
- A new array with the same plugins in the same order changes nothing, so a framework re-render doesn't reconnect them. A new plugin instance does: keep instances stable (a constant, or `useMemo` in React).
- A hook that throws is reported in the console (`argus-table: plugin "<name>" threw in <hook>`) and skipped; a plugin whose `connect` threw stays off until `plugins` changes. A plugin can't break an update.

`host` (`PluginHost<T>`) is what the table offers. Plugins get it and never implement it, so every member is there, and members added later are additions, not breaking changes ([ADR 0004](../../adr/0004-api-1-0.md)):

| Member                                        | Purpose                                                                                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `element`                                     | The table: its public properties, methods (`autosizeColumns()`, `scrollToRow()`), events and `updateComplete`                                                                                                                                     |
| `column(id)`                                  | A data column as resolved, after every plugin's `columns`: `{ id, sortable, resizable, pinnable, hideable, pin, hidden, width, sorted, filter, columnFilter }`, hidden columns too; `undefined` for unknown ids and the checkbox column                                 |
| `columns()`                                   | Every data column the same way, hidden ones included, in the column order                                                                                                                                                               |
| `cellOf(event)`                               | The header or cell an event happened in, as a `CellTarget`                                                                                                                                                                                        |
| `setSort(columnId, 'asc' \| 'desc' \| undefined)`  | Sorts by a column or clears its sort (`undefined`), through the `sorting` rules: when `sorting` is controlled, only `argus-sorting-change` fires with the proposal. Sortable columns only. A plugin must not set `element.sorting`, which would make it controlled |
| `setPin(columnId, 'start' \| 'end' \| false)` | Pins a column or unpins it, through the `columnPinning` rules. Columns with `pinnable: false` don't move.                                                                                                                                |
| `setHidden(columnId, hidden)`                 | Hides or shows a column, through the `columnVisibility` rules. Columns with `hideable: false`, and the last column shown, don't hide.                                                                                                    |
| `setFilter(columnId, filter \| undefined)`    | Sets a column's filter or clears it, through the `columnFilters` rules. Only columns with a `filter` kind take one.                                                                                                                      |
| `filterValues(columnId, limit?)`              | The values a `set` filter offers: `filterOptions`, else the distinct values of the rows the other filters keep, sorted, at most `limit` (1000) with `truncated`. `undefined` with a `dataSource` and no `filterOptions`.              |
| `filteredIndexes(except?)`                    | The indexes in `data` of the rows the column filters and the quick filter keep, ascending (not sorted), leaving out the filters on the `except` columns and their text in the quick filter. `undefined` with a `dataSource`. An accessor of an `except` column may call it while the table filters or sorts. |
| `focusHeader(columnId)`                       | Moves the grid's focus to a header after the next update                                                                                                                                                                                          |
| `announce(message)`                           | Says something through the table's polite live region                                                                                                                                                                                             |
| `invalidateColumns()`                         | Runs the `columns` and `columnGroups` hooks again on the next update                                                                                                                                                                              |
| `requestUpdate()`                             | Re-renders: header and cell functions run again                                                                                                                                                                                                   |
| `row(index)`                                  | The body row at `index` in the current order; `undefined` past the end and for a `dataSource` row not loaded yet                                                                              |
| `content(value)`                              | Wraps a column's own header or cell content for the plugin's template (see below)                                                                                                                                |
| `header(def)`                                 | A column's or column group's own header as the table shows it (a function `header` called, a group without one shows its id), wrapped like `content()` for the plugin's template |

- Clicks on interactive content in a header (a button, a link, an input, a popover, a dialog) don't sort, so a plugin can put controls and dialogs in headers.
- `content(value)` wraps a column's own header or cell content for the plugin's template, so framework content still reaches the table's `contentRenderer` (see [Framework content](#framework-content)): `` html`<b>${host.content(own)}</b>` ``. For a header, `header(def)` does the whole job: it calls a function `header` (which the hooks type as `unknown`, so the call would otherwise need an assertion) and wraps the result: `` html`<b>${host.header(def)}</b>` ``. The column menu and formula headers use it.
- Later hooks are optional additions and later host members are additions too, so neither breaks existing plugins. A `state` hook (plugin state saved with `getState()` and restored by `setState()`) waits for a plugin that has state of its own: the column menu has none, and formulas live in `columns`.

### Column menu (`@argus-table/header-menu`)

Each column gets a button (`tabindex="-1"`, "Column menu") at the end of its header content. Its menu sorts the column ascending or descending, clears its sort, filters it (Filter… and Clear filter, on columns with a `filter` kind), pins it to the start or end or unpins it, fits its width (a resize, as with a double-click on the handle), and hides it; a "Hidden columns" group shows hidden columns again (one item each, and "Show all"). Items that don't apply to the column are left out: not sortable, not resizable, `pinnable: false`, `hideable: false`, or the last column shown. `headerMenu({ pin: false, hide: false, filter: false })` turns the pin, hide and filter items off. Pinning, hiding and filtering go through the plugin host's `setPin()`, `setHidden()` and `setFilter()`, so they follow the `columnPinning`, `columnVisibility` and `columnFilters` rules. Filter… opens a form under the header (a `popover` with `role="dialog"`): an operator and a value or range for `text`, `number` and `date`, or a searchable checkbox list for `set` from `filterValues()` (the values the other filters leave, or `filterOptions`; a `set` column with a `dataSource` and no `filterOptions` gets no Filter…). Typed values apply 250 ms after typing stops, choices at once; Enter or Done closes the form on its header, Escape closes it as it is, Clear removes the filter, and a press outside closes it. Alt+ArrowDown, the context menu key, Shift+F10 or a right-click on a header opens it; see [Accessibility](08-accessibility.md). The menu is a native `popover` rendered inside the header's light-DOM content: it inherits the table's tokens and sits in the top layer, unclipped by the table. Styling: the classes `argus-header-menu-button`, `argus-header-menu`, `argus-header-menu-item` and `argus-header-filter`, and the `--argus-menu-*` tokens (see [Add-on tokens](#add-on-tokens)). `headerMenu({ labels })` translates its text (see [Labels](#labels)).

Other plugins add items through a method header-menu looks for on every plugin in `plugins`: `headerMenuItems(columnId, host)` returns groups `{ label?, items }` of items `{ label, detail?, danger?, run() }` (the exported `HeaderMenuContributor`, `HeaderMenuGroup` and `HeaderMenuItem` types). Groups follow the built-in items, each after a separator; a labelled one is a `role="group"` with a heading. `run()` runs after the menu closes and places focus itself. A column with items gets a menu even if it can't sort or resize. This is header-menu's contract, not the table's: plugins that don't know about it are unaffected.

### Formula columns (`@argus-table/formulas`)

A column with a `formula` computes its value per row from other columns, as in a spreadsheet: `{ id: 'total', header: 'Total', formula: '[price] * [qty]' }` in `columns`, or `<argus-column formula="…">`. The `formulas()` plugin compiles each formula and turns the column into an ordinary one (an `accessor`, a `cell`, and an `ƒx` mark before its header), so it sorts, resizes, pins, moves and virtualizes like any other. The language, functions and error values are in [Formula columns](09-formula-columns.md).

```ts
import { formulas } from '@argus-table/formulas';
table.plugins = [formulas({ functions: { VAT: { fn: (n) => Number(n) * 0.19, args: [1, 1] } } })];
```

- Options: `functions` adds functions or replaces built-in ones (per plugin instance, not a global registry), `marker: false` leaves headers alone, `labels` translates the menu items, announcements and editor (see [Labels](#labels)).
- List it before `headerMenu()`: formulas name columns by their text header, which the header menu wraps in a function.
- Errors are values: the cell shows the code (`#DIV/0!` and so on) in an element with the class `argus-formula-error` and a tooltip that explains it, coloured by `--argus-formula-error-fg`. They sort last. A column's own `cell` gets values only.
- With a `dataSource`, formula columns can't be sorted: the server sorts and doesn't know them.
- `editing: 'view' | 'edit' | 'none'` (default `'view'`) puts formula items in `headerMenu()`'s menu: view a formula, or edit, rename, delete and add formula columns in a modal editor loaded on first use. Changes are proposed through `argus-formula-column-add`, `-change` and `-remove` (`detail.column`, `detail.columns`, and `detail.previous` on a change); the app sets `columns` to `detail.columns`. See [Formula columns](09-formula-columns.md#ui).

## Events

All `CustomEvent`, bubbling and composed. See [State and events](../code-architecture/04-state-and-events.md) for the controlled/uncontrolled rules.

A change of controllable state fires `argus-<property>-change`: `detail` has the new value under the property's name, then what caused it ([ADR 0004](../../adr/0004-api-1-0.md)). When the property is uncontrolled the event fires after the update that applied the change; when it is controlled, it fires right away with the proposed value and nothing changes until the host sets the property. Setting a property never fires its event.

| Event | Detail |
| --- | --- |
| `argus-sorting-change` | `{ sorting }` |
| `argus-column-sizing-change` | `{ columnSizing, columnId, width }` |
| `argus-column-resize-end` | `{ columnSizing, columnIds }`: once a user's resize is done |
| `argus-column-order-change` | `{ columnOrder, columnId, groupId? }`: `groupId` when a column group moved |
| `argus-column-pinning-change` | `{ columnPinning, columnId, pin }`: `pin` is `'start'`, `'end'` or `false` |
| `argus-column-visibility-change` | `{ columnVisibility, columnId, visible }`: fires when a column is hidden and when it is shown |
| `argus-column-filters-change` | `{ columnFilters, columnId, columnFilter }`: `columnFilter` is `undefined` when it was cleared |
| `argus-selection-change` | `{ selection }`: the selected row ids |
| `argus-cell-click` | `{ row, rowId, index, columnId, value, pinned? }` |
| `argus-row-click` | `{ row, rowId, index, pinned? }` |
| `argus-range-change` | `{ first, last }`: the rows in view, both inclusive |
| `argus-load-error` | `{ error, start, end }`: a `dataSource` page failed; `end` exclusive |

- The package exports each name as a constant (`SORTING_CHANGE`, `COLUMN_SIZING_CHANGE`, `CELL_CLICK`, `ROW_CLICK`, `RANGE_CHANGE`, …), and `HTMLElementEventMap` types each `detail`.
- `argus-sorting-change` fires on a click on a sortable header, or Enter or Space on a focused one; the order cycles ascending → descending → unsorted, by that one column. `sorting` itself may hold several columns, set by the host or a plugin.
- `argus-column-sizing-change` fires when a column is resized by dragging its `resize-handle` or with Alt+Arrow on its focused header (10 px; the arrow toward the inline end grows it), and when a double-click on the handle or `autosizeColumns()` fits it to its content (once per column that changes, each with the whole new `columnSizing`). A press on the handle without moving changes nothing. The handle is a `separator` labelled "Resize column" (`labels.resizeColumn`). During a drag it fires once per animation frame, so a controlled host can follow the drag; `width` is already clamped to `minWidth`/`maxWidth`.
- `argus-column-resize-end` fires once a user's resize is done, for saving widths: a drag released (or cancelled), an Alt+Arrow press, a double-click fit or `autosizeColumns()`. It comes after that resize's `argus-column-sizing-change` events, with `columnSizing` after the resize (the last proposed one when controlled) and `columnIds`, the columns it changed. A resize that changed nothing fires none, and so does setting `columnSizing` or `setState()`.
- `argus-column-order-change` fires when a column or column group is moved: on drop after a header drag, or with Alt+Shift+Arrow on its focused header. `columnOrder` is the whole new order. A drop where the column would stay put, or a cancelled drag, fires nothing.
- `argus-column-pinning-change`, `argus-column-visibility-change` and `argus-column-filters-change` fire when a plugin pins, unpins, hides, shows or filters a column (`setPin()`, `setHidden()`, `setFilter()`).
- `argus-cell-click` and `argus-row-click` fire on a click in the body, in that order, including clicks on content inside a cell (check `event.composedPath()` to skip your own buttons). `row` is the data object, `value` what the column's accessor reads. On a pinned row, `pinned` is `'top'` or `'bottom'` and `index` is the row's index in its list. Enter on a focused body cell fires both too (Enter pressed in content inside a cell is left to that content). Header clicks fire neither.

## Column virtualization

`virtualize-columns` renders only the scrolling columns in view, plus two on each side, for wide tables (a few dozen columns and more). Off by default: then every column renders in every row, as before.

```html
<argus-table virtualize-columns></argus-table>
```

- Always rendered: pinned columns, the checkbox column, the focused cell's column (focus and the tab stop survive scrolling sideways, and arrow keys, Home and End reach every column), a column being dragged, and with a `dataSource` the first data column (it holds the Retry buttons).
- `width: 'auto'` columns out of view still measure: they render until they are measured. `autosizeColumns()` renders its columns for the measurement too.
- Cells are pooled like rows: a column scrolling in reuses the cells of one that scrolled out, so the DOM order of cells is pool order and each cell is placed in its grid column explicitly. `aria-colindex` carries the position. Page CSS that relies on the cells' DOM order (`:nth-child`) doesn't apply.
- Every column keeps its grid track, so `flex` columns work as without it. Smooth to a few thousand columns; Firefox caps a grid at 10,000 columns, with or without it.
- The column overscan isn't configurable yet.

## Methods

`scrollToRow(target, options?)`, `scrollToColumn(id, options?)`, `refresh()`, `autosizeColumns(ids?)`, `getState()` / `setState()`.

- `scrollToRow(target, { align })` (v0.1, options after 1.0): `target` is an index in the current row order (after sorting and filtering) or `{ id }`, a `getRowId` id. `align` (`ScrollAlign`) puts the row at the top of the view (`'start'`, the default: just below the header and the top pinned rows), at the bottom (`'end'`, just above the bottom pinned rows), in the middle (`'center'`), or scrolls only as far as needed to show it in full (`'nearest'`). It works the same in a scaled body and with `rowHeight: 'auto'` (rows measured on the way are taken into account). Resolves `true` once the table has re-rendered there; `false` for an id not in the rows (unknown, filtered out, a pinned row, a `dataSource` row not loaded; nothing scrolls), a negative index, or an index past the last row (it scrolls to the end). With a `dataSource` whose total isn't known, an index past the rows counted so far resolves `false`, and the table scrolls on toward it as pages arrive, unless the user scrolls, clicks or presses a key first.
- `scrollToColumn(id, { align })` (after 1.0): scrolls sideways so the column shows in the scrolling area between the pinned columns. `align` defaults to `'nearest'` (no scroll when the column is in view in full); `'start'`, `'end'` and `'center'` as for rows, logical, so RTL works. Positions are measured from the rendered header, so flex columns land right; with `virtualizeColumns` the column renders first. Resolves `true` once the table has re-rendered there (a pinned column is always in view and doesn't scroll), `false` for an id of no column or of a hidden one.

```js
await table.scrollToRow({ id: 'order-42' }, { align: 'center' });
await table.scrollToColumn('total');
```


- `autosizeColumns(ids?)` (v0.2): fits the given columns (default: every resizable one) to the header, the pinned rows and the rendered body rows, as a resize; see [Column widths](#column-widths). Columns with `resizable: false` keep their width. Resolves once the table has re-rendered.
- `refresh()` (v0.2): with a `dataSource`, drops every loaded page and loads the rows in view again; with `data`, re-renders the cells. Resolves once the table has re-rendered.
- `getState()` (Phase 3): the state users change as one object of plain JSON (`TableState`), for saving a user's layout: `sorting`, `columnSizing`, `columnOrder`, `columnPinning`, `columnVisibility`, `columnFilters`, `selection`, `quickFilter` and `scroll` (`ScrollState`: `row`, the index of the row at the top in the current order, and `inline`, the inline offset in px from the start edge, positive in RTL too), with `version: 1`. Every key is there, controlled ones with the values the host set. A copy: changing it changes nothing.
- `setState(state)` (Phase 3): restores the keys given; the others don't change. State of another `version` is ignored as a whole; state without one is read as version 1. Keys the host controls are left alone (the host sets those itself), the others stay uncontrolled, and no change event fires: like a host setting a property. Ids of columns that no longer exist are ignored, as in the properties. `quickFilter` is set like the property, so an app's own search box shows it only if the app reads it back. `scroll` is applied after the rest has rendered: with a `dataSource`, after the jump to the top a restored sort or filter makes. A `dataSource` row past the rows counted so far (one page past the loaded ones until the total is known) is scrolled to as the pages arrive, unless the user scrolls, clicks or presses a key first. Resolves once the table has re-rendered at the restored position.

```js
const KEY = 'orders-table';
table.setState(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
addEventListener('pagehide', () => localStorage.setItem(KEY, JSON.stringify(table.getState())));
```

## Framework wrappers

`@argus-table/react`, `@argus-table/vue` and `@argus-table/angular` wrap both elements. They are optional: the elements work in any framework without them. Their bindings are generated from the Custom Elements Manifest, so they follow the element; see [Packages](../repo-and-ci/02-packages.md#generated-wrappers). All three follow the same conventions.

Each `argus-*` event drops its prefix and takes the framework's style:

| Element event | React prop | Vue emit | Angular output |
| --- | --- | --- | --- |
| `argus-sorting-change` | `onSortingChange` | `sorting-change` | `sortingChange` |
| `argus-column-sizing-change` | `onColumnSizingChange` | `column-sizing-change` | `columnSizingChange` |
| `argus-column-resize-end` | `onColumnResizeEnd` | `column-resize-end` | `columnResizeEnd` |
| `argus-column-order-change` | `onColumnOrderChange` | `column-order-change` | `columnOrderChange` |
| `argus-column-pinning-change` | `onColumnPinningChange` | `column-pinning-change` | `columnPinningChange` |
| `argus-column-visibility-change` | `onColumnVisibilityChange` | `column-visibility-change` | `columnVisibilityChange` |
| `argus-column-filters-change` | `onColumnFiltersChange` | `column-filters-change` | `columnFiltersChange` |
| `argus-selection-change` | `onSelectionChange` | `selection-change` | `selectionChange` |
| `argus-cell-click` | `onCellClick` | `cell-click` | `cellClick` |
| `argus-row-click` | `onRowClick` | `row-click` | `rowClick` |
| `argus-range-change` | `onRangeChange` | `range-change` | `rangeChange` |
| `argus-load-error` | `onLoadError` | `load-error` | `loadError` |

- Handlers get the element's whole `CustomEvent`, not just its detail, so `composedPath()` stays at hand. Details that carry a row are typed with the row type (`RowClickDetail<T>`, `CellClickDetail<T>`). The exception is Angular's outputs for state changes, below.
- The row type is generic: inferred from `data` and `columns`, or given (`<ArgusTable<Order>>` in React).
- Two-way binding follows from the event names: a property `p` with an event `argus-<p in kebab case>-change` binds two ways, from `detail.p`. That covers the seven controllable properties: `sorting`, `columnSizing`, `columnOrder`, `columnPinning`, `columnVisibility`, `columnFilters` and `selection`. React uses the usual controlled pair (`sorting` with `onSortingChange`); Vue gets `v-model:sorting`, `v-model:column-sizing` and so on (it emits `update:<p>` with the value next to `<p>-change` with the event); Angular gets `[(sorting)]`, `[(columnSizing)]` and so on, where the output `<p>Change` emits the value; the whole event is the element's own, `(argus-column-sizing-change)="…$event.detail…"`. A property left unbound stays uncontrolled.
- The generator fails on an event named `argus-…-change` that matches no property (only `argus-range-change` is exempt), and on an event whose wrapper name equals a property's: an output named like a property would shadow it, which is why the visibility event isn't `argus-column-visibility`.
- Methods are reached through the element: a `ref` in React, typed `ArgusTableElement<T>`. In Vue, a template ref exposes the methods and the `element`; in Angular, a view query gives the component, which has them too.
- Vue: the types follow vue-tsc's shape for a generic `<script setup>` component, so templates check props, events, `v-model` and the template ref against the row type. `h()` can't infer it: `h(ArgusTable<Order>, …)`. The wrapper sets the element's properties itself rather than through Vue's DOM prop patching, which would turn a removed number into `0`. A one-way `:sorting` stays controlled, because Vue props are read-only.
- Angular: standalone components (`ArgusTableComponent`, `ArgusColumnComponent`) on the elements' own tags, so templates need no `CUSTOM_ELEMENTS_SCHEMA`. Inputs are `@Input()` setters that write to the element, and two-way binding is an input with a `…Change` output, so a one-way `[sorting]` stays controlled. Angular passes a static attribute to an input of the same name as a string (`width="90"`); a string for a property that has an attribute goes to the attribute, so the element converts it as in HTML, and the input types accept those strings. `null` (the `async` pipe) means unset.
- Events bubble, so a table nested in another table's cell fires its events on the outer table too. The Angular outputs only re-emit the outer table's own events (`event.target`).
- `<argus-column>` is wrapped too (`ArgusColumn`), so loops over columns work. The wrapper component takes the element's name, so the element classes are re-exported as the types `ArgusTableElement` and `ArgusColumnElement`.
- React: `cell` and `header` may return JSX (any React node). It renders through portals in the app's tree, so it sees the app's providers; see [Framework content](#framework-content). Vue: `#cell-<id>` and `#header-<id>` slots on `<ArgusTable>` (and `#group-<id>` for a column group's header), or `cell`/`header` returning VNodes; slotted cells follow the state they read and see the app's and the table's ancestors' injections. Angular: `<ng-template argusCell="<id>">` / `argusHeader` (and `argusGroupHeader` for a column group) inside `<argus-table>` (`[argusCellOf]` types `let-row`), or `argusTemplate()` from a `cell` function; the views keep the declaring component's bindings and DI.
- Bindings set `undefined` when a prop is removed, so `columns`, `data` and `overscan` read `null` and `undefined` as their defaults.

## Framework content

`header` and `cell` may return content the table doesn't render itself, such as React elements. The table hands it to its `contentRenderer`, which the framework wrappers set ([ADR 0002](../../adr/0002-framework-content.md)):

```ts
interface ContentRenderer {
  render(target: HTMLElement, content: unknown): void; // on every update, per cell showing it
  release(target: HTMLElement): void; // the cell shows no such content any more
  flush?(): void; // once per update that rendered or released, before measuring
}
```

- Foreign content is anything other than a string, a number, a Lit template or directive result, a DOM node, `null`/`undefined`, or an array of those.
- Each header or cell showing it gets a target element (`div.argus-content`, `display: contents`) that stays while the cell is reused for other rows. Framework content there updates in place as the table scrolls, rather than remounting, which is why a cell component's own state belongs to the pooled cell, not to a row.
- `release` comes when the cell goes away (scrolled out and not reused, a hidden or removed column, fewer rows), when it shows plain content again (a row still loading), when the renderer changes, and when the table is disconnected; reconnecting renders it again.
- `flush` lets a renderer batch: it runs after the light DOM renders and before `width: 'auto'` measures, so content must be committed synchronously there.
- Without a renderer, foreign content renders nothing, with one console warning.
- `ColumnDef<T, TContent>` takes the content type as its second parameter (default `CellContent`); the wrappers widen it (`ReactColumnDef<T>` in React).

## Slots

- `empty`: shown instead of the body when there are no rows. Default text: "No rows".
- Cell and header content uses private, generated slot names ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md)); don't target them.

## Parts

`table`, `header`, `header-row`, `header-group-row`, `header-group-cell`, `header-group-cell-dragging`, `header-group-filler`, `header-cell`, `header-cell-sorted`, `header-cell-sorted-asc`, `header-cell-sorted-desc`, `header-cell-pinned`, `header-cell-pinned-edge`, `header-cell-filtered`, `sort-indicator`, `filter-indicator`, `header-cell-dragging`, `header-cell-selection`, `cell-selection`, `selection-checkbox`, `drop-indicator`, `resize-handle`, `body`, `row`, `row-pinned`, `row-pinned-top`, `row-pinned-bottom`, `row-even`, `row-odd`, `row-selected`, `row-loading`, `row-error`, `cell`, `cell-pinned`, `cell-pinned-edge`, `cell-in-pinned-row`, `cell-sorted`, `skeleton`, `skeleton-error`, `retry`, `empty`.

- `row-pinned` is on every row from `pinnedRows`, with `row-pinned-top` or `row-pinned-bottom` for its side (`::part()` can't tell them apart by attribute). Pinned rows also have `row`, but not `row-even`/`row-odd`. Their cells add `cell-in-pinned-row` to `cell`; don't confuse it with `cell-pinned`, which marks cells in pinned _columns_.

- `row-loading`, `row-error`, `skeleton`, `skeleton-error` and `retry` belong to `dataSource` loading; see [Data source](#data-source). A failed page's rows have both `row-loading` and `row-error`.

- `row-selected` is on body rows whose id is in `selection`; see [Row selection](#row-selection).
- `cell-selection` is added to `cell` in the checkbox column (pinned rows included), `header-cell-selection` to its `header-cell`, and `selection-checkbox` is on every one of its checkboxes, the select-all one too. Style them with `accent-color`, for example: `argus-table::part(selection-checkbox) { accent-color: rebeccapurple; }`.

- `header-group-row` is a row of group headers above `header-row` (the column headers), one per level of `columnGroups`. `header-group-cell` is a group's header, spanning its columns; `header-group-filler` is the empty cell over columns without a group at that level, kept apart so a group's borders don't reach it. Group cells take `--argus-header-bg` and `--argus-header-fg`, and are as tall as a header row. See [Column groups](#column-groups).

- `header-cell-dragging` is added to `header-cell` while that header is dragged, and to the headers of a dragged group's columns (the group cell gets `header-group-cell-dragging`); `drop-indicator` is a line inside the header where it would land, on its inline-start or inline-end edge. See [Column order](#column-order).

- `header-cell-sorted` is added next to `header-cell` on a sorted column's header, with `header-cell-sorted-asc` or `header-cell-sorted-desc` for the direction (attribute selectors can't follow `::part()`, so `aria-sort` alone can't be styled). `cell-sorted` is for body cells in that column. They are separate so that `::part(cell-sorted)` never matches headers. `sort-indicator` is the chevron in a sortable header, drawn with borders in `currentColor`.
- `cell-pinned` is on every pinned cell on either side, and `cell-pinned-edge` is added on the pinned cell next to the scrolling columns; headers of pinned columns get `header-cell-pinned` and `header-cell-pinned-edge`. There are no per-side parts; the component mirrors the edge shadow itself.

## Tokens (first set)

`--argus-bg`, `--argus-fg`, `--argus-header-bg`, `--argus-header-fg`, `--argus-border-color`, `--argus-border-width`, `--argus-row-hover-bg`, `--argus-row-odd-bg`, `--argus-row-selected-bg`, `--argus-cell-padding-inline`, `--argus-cell-padding-block`, `--argus-row-height`, `--argus-font`, `--argus-pinned-shadow`, `--argus-resize-handle-color`, `--argus-focus-ring`, `--argus-skeleton-bg`, `--argus-row-pinned-bg`, `--argus-drop-indicator-color`, `--argus-filter-indicator-color`, `--argus-border`, `--argus-border-radius`.

- `--argus-skeleton-bg` colours the skeleton bars of rows still loading. Default: the text colour at 12% opacity.
- `--argus-border` is a `border` shorthand drawn around the whole table, inside its size. `--argus-border-radius` rounds the table's corners; the element's paint containment clips the header, rows and pinned columns to them. Defaults: `none` and `0`. Added in v0.2 for the Material-inspired theme's outlined, rounded surface: a theme can't set `border` or `border-radius` on the host itself.
- `--argus-row-pinned-bg` is the background of the rows from `pinnedRows`, pinned columns included (a background set through `::part(row-pinned)` wouldn't reach the cells in pinned columns, which paint their own). Default: `--argus-bg`.

- `--argus-row-height` and `--argus-cell-padding-inline` each have a default per density: 32 / 40 / 52 px rows and 8 / 12 / 16 px padding for compact / comfortable / spacious; see [Styling and theming](06-styling-and-theming.md).
- `--argus-cell-padding-block` applies with `rowHeight: 'auto'` only: the block padding of body and pinned-row cells, whose content then sits at the top. Default: what centres one line of text (`1lh`) in `--argus-row-height`.
- The element is 400 px tall by default, because a virtualized table needs a bounded height; set `height` (or `block-size`) on it.
- `--argus-row-selected-bg` is the background of selected rows, pinned columns included; it wins over `--argus-row-hover-bg`. Default: the system `Highlight` colour at 22% over `--argus-bg`.
- `--argus-focus-ring` is an `outline` value for the focused cell or header (`:focus-visible`). Default: `2px solid Highlight`.
- `--argus-pinned-shadow` takes a `box-shadow` value written for a shadow falling toward the end side, for example `4px 0 6px -4px rgb(0 0 0 / .2)`. The component mirrors it for the end edge and in RTL. `none` removes it.

### Add-on tokens

The add-ons read these in the table's light DOM, so they are set on the table like its own, and every theme in `@argus-table/themes` sets them (a test checks it). They also read the table's `--argus-bg`, `--argus-fg`, `--argus-font`, `--argus-border-color`, `--argus-focus-ring` and `--argus-header-bg`. The `--argus-menu-*` tokens are shared by every add-on menu, the `--argus-dialog-*` tokens by every add-on dialog.

| Token | Read by | What it sets | Default |
| --- | --- | --- | --- |
| `--argus-menu-bg` | header-menu, formulas | Background of the column menu and the filter form | `var(--argus-bg)` |
| `--argus-menu-fg` | header-menu, formulas | Their text colour | `var(--argus-fg)` |
| `--argus-menu-shadow` | header-menu, formulas | Shadow under the menu and the editor's suggestions | `0 4px 16px rgb(0 0 0 / 0.16)` |
| `--argus-menu-item-active-bg` | header-menu, formulas | The hovered or focused menu item, the editor's selected suggestion | the text colour at 10% |
| `--argus-menu-danger-fg` | header-menu | Destructive items (removing a formula column) | `inherit` |
| `--argus-menu-detail-font` | header-menu | Details in the menu (a formula) | `ui-monospace, monospace` |
| `--argus-dialog-bg` | formulas | Background of the formula editor | `var(--argus-menu-bg)` |
| `--argus-dialog-fg` | formulas | Its text colour | `var(--argus-menu-fg)` |
| `--argus-dialog-accent` | formulas | The save button | `Highlight` |
| `--argus-dialog-accent-fg` | formulas | Text on the save button | `HighlightText` |
| `--argus-dialog-shadow` | formulas | Shadow under the editor | `0 20px 48px rgb(0 0 0 / 0.28)` |
| `--argus-dialog-backdrop` | formulas | Behind the editor | `rgb(0 0 0 / 0.4)` |
| `--argus-formula-error-fg` | formulas | Error values, problems and their underline | the text colour |
| `--argus-formula-font` | formulas | The formula input | `ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace` |
| `--argus-formula-input-bg` | formulas | Background of the formula input | `var(--argus-bg)` |
| `--argus-formula-function-fg` | formulas | Function names in a formula | `inherit` |
| `--argus-formula-ref-bg` | formulas | Background of column names in a formula | the text colour at 10% |
| `--argus-formula-ref-fg` | formulas | Column names in a formula | `inherit` |
| `--argus-formula-number-fg` | formulas | Numbers in a formula | `inherit` |
| `--argus-formula-text-fg` | formulas | Text literals in a formula | `inherit` |
