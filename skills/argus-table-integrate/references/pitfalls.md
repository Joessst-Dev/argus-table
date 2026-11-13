# Pitfalls

One section per `check.mjs` rule, with the same id. Each says what goes wrong and how to write it instead.

## versions-mixed

Every `argus-table` and `@argus-table/*` package is released together, at one version. A wrapper or add-on built for another version of the element can miss properties or register a second copy of it. Install them all at the same version: `setup.mjs` prints the command, or

```bash
npm install argus-table@1.1.2 @argus-table/react@1.1.2 @argus-table/themes@1.1.2
```

## duplicate-argus-table

Two copies of `argus-table` in the bundle (a wrapper with its own nested copy, or two versions in the lockfile). The second one throws `argus-table has already been defined` when it registers the element. Align the versions (see versions-mixed), reinstall, and run `npm dedupe` / `pnpm dedupe`.

## version-below-minimum

These references describe argus-table 1.1. With 1.0, `labels`, `scrollToColumn()`, `scrollToRow()` options, `argus-column-resize-end`, the header menu's `sort` / `fitWidth` options, the formula events on the wrappers and `@argus-table/export` don't exist. Upgrade every argus-table package together.

## feature-needs-newer-version

The code uses something the installed version doesn't have (listed under version-below-minimum). Upgrade every argus-table package together, or remove the use.

## framework-peer

The wrappers need React 18.3 or 19, Vue 3.5 or later, Angular 20, 21 or 22. With an older framework, upgrade it, or use the `<argus-table>` element directly ([frameworks/vanilla.md](frameworks/vanilla.md)).

## wrapper-mismatch

A wrapper for another framework is installed (`@argus-table/react` in a Vue app). Remove it and use the one for the project's framework.

## raw-element

`<argus-table>` written directly in JSX, a Vue template or an Angular template without the wrapper. React 18 passes every prop as a string attribute, so `columns` and `data` never arrive; React 19 and Vue set properties, but there are no typed props, no framework content in cells and no two-way state. Use the wrapper:

```tsx
// Wrong (React)
<argus-table columns={columns} data={rows} />;
// Right
import { ArgusTable } from '@argus-table/react';
<ArgusTable aria-label="Orders" columns={columns} data={rows} />;
```

In Angular the wrapper sits on the same tag: add `ARGUS_TABLE` to the component's `imports` and drop `CUSTOM_ELEMENTS_SCHEMA`.

## attribute-for-property

`columns`, `data`, `dataSource`, `pinnedRows`, `getRowId`, `plugins`, `labels` and the state properties hold objects, arrays and functions. Attributes are strings, so these must be set as properties:

```vue
<!-- Wrong -->
<ArgusTable columns="columns" />
<!-- Right -->
<ArgusTable :columns="columns" />
```

```js
// Wrong
table.setAttribute('columns', JSON.stringify(columns));
// Right
table.columns = columns;
```

Attributes exist for the simple values: `density`, `row-height`, `overscan`, `virtualize-columns`, `quick-filter`, `selection-mode`, `selection-checkboxes`.

## no-theme

Without a theme the table uses neutral system colours. Import one, once, where the app's global CSS goes:

```js
import '@argus-table/themes/default.css'; // or material, fluent, bootstrap, minimal
```

In Angular, `@import '@argus-table/themes/default.css';` in `src/styles.css`. In Nuxt, `css: ['@argus-table/themes/default.css']`. A custom theme (a CSS file setting `--argus-*` tokens on `argus-table`) counts too.

## multiple-themes

Each theme sets the same tokens, so the last one loaded wins and the others are dead weight. Load one; change single tokens with CSS after it:

```css
argus-table {
  --argus-header-bg: #f4f4f5;
}
```

## missing-label

A grid needs an accessible name for screen readers. Add `aria-label="Orders"`, or `aria-labelledby="orders-heading"` pointing at a visible heading.

## unstable-identity

The table compares `columns`, `plugins`, `columnGroups`, `pinnedRows` and `dataSource` by identity. A new array on every render re-resolves the columns and re-reads (and re-sorts) every row; new plugin instances reconnect and close open menus; a new `dataSource` object reloads the data.

```tsx
// Wrong: new arrays on every render
function Orders({ rows }) {
  const columns = [{ id: 'id', header: 'Order', accessor: 'id' }];
  return <ArgusTable columns={columns} plugins={[headerMenu()]} data={rows} />;
}

// Right: once, at module scope (or useMemo with what they depend on)
const columns: ReactColumnDef<Order>[] = [{ id: 'id', header: 'Order', accessor: 'id' }];
const plugins = [headerMenu<Order>()];
function Orders({ rows }: { rows: Order[] }) {
  return <ArgusTable aria-label="Orders" columns={columns} plugins={plugins} data={rows} />;
}
```

Columns that depend on props or state: `useMemo(() => [...], [deps])`. Columns a component receives as a prop are fine: the stability is the caller's job. In Angular, a `get columns()` that returns a new array is read on every change detection: use a readonly field or a `computed()`. Keep accessor functions stable too: a column whose `accessor` is a new function makes the table re-read its values. In Vue, declare them in `<script setup>`, not inline in the template; in Angular, as readonly class fields.

## selection-without-row-id

Without `getRowId`, a row's id is its index in `data`. Selection is a list of ids, so after new data (or with a `dataSource`, after a sort) the selected ids point at other rows. Return a stable string:

```ts
getRowId = (order: Order) => String(order.id);
```

## plugin-order

Add-ons wrap each other's work, so their order matters: `[tableExport(), formulas(), headerMenu()]`. `tableExport()` reads the text headers before the others wrap them; `formulas()` names columns before the menu adds its button.

## addon-not-installed

An `@argus-table/*` package is imported but isn't a dependency of this project. It may work through hoisting today and break under pnpm, Yarn PnP or in CI. Install it at the same version as the other argus-table packages. (`argus-table` itself comes with the wrappers; list it too when the code imports it directly.)

## addon-not-registered

An add-on is imported but its factory is never called: it does nothing until it's in `plugins`.

```ts
const plugins = [headerMenu<Order>()];
// <ArgusTable plugins={plugins} … />
```

## addon-unused

An add-on (or the themes package) is installed but never used. Use it, or remove it.

## server-component-props

In Next.js App Router, a Server Component can render `<ArgusTable>` (the wrapper is a client module), but only with props that serialize: plain data and columns without functions. Functions (`cell`, accessor functions, `getRowId`, event handlers, `plugins`, `dataSource`) fail with "Functions cannot be passed directly to Client Components". Put the table in a client component and pass it data:

```tsx
// app/orders/page.tsx (Server Component)
import { OrdersTable } from './orders-table';
export default async function Page() {
  const orders = await getOrders();
  return <OrdersTable orders={orders} />;
}
```

`app/orders/orders-table.tsx`, with the directive as its first line:

```tsx
'use client';

import { ArgusTable, type ReactColumnDef } from '@argus-table/react';
const columns: ReactColumnDef<Order>[] = [/* … cells may be JSX … */];
export function OrdersTable({ orders }: { orders: Order[] }) {
  return <ArgusTable aria-label="Orders" columns={columns} data={orders} getRowId={(o) => o.id} />;
}
```

## datasource-without-row-id

With a `dataSource` and no `getRowId`, a row's id is its position in the server's order. Saved selection, `scrollToRow({ id })` and anything keyed by row id then point at other rows after a sort or filter. Return the server's id, as a string:

```ts
getRowId = (user: User) => String(user.id);
```

## controlled-without-handler

Binding `sorting`, `selection`, `columnSizing`, `columnOrder`, `columnPinning`, `columnVisibility` or `columnFilters` one way makes it controlled. The table then shows what you pass and only proposes changes through the event: without a handler that stores the new value, clicks seem to do nothing.

```tsx
// React
const [sorting, setSorting] = useState<SortState>([]);
<ArgusTable sorting={sorting} onSortingChange={(e) => setSorting(e.detail.sorting)} … />
```

```vue
<!-- Vue -->
<ArgusTable v-model:sorting="sorting" … />
```

```html
<!-- Angular -->
<argus-table [(sorting)]="sorting" … />
```

For a starting value only (a default sort), leave the property out and call `setState({ sorting: [{ id: 'date', desc: true }] })` once after mount, or bind it two-way as above.

## sortable-never-set

Columns sort only with `sortable: true`. AG Grid, MUI X and Vuetify sort every column by default, so a migrated table loses sorting unless the columns opt in. Add `sortable: true` to each column users sorted before. With `--scan` or `--from` such a grid, the check also names the data columns that don't sort yet; leave one out on purpose when the old column had `sortable: false`.

## leftover-library

A migrated file still imports the old table library or its CSS. Finish the migration of that table, then remove the import, its CSS and any module registration (`ModuleRegistry.registerModules`, `app.use(…)`).

## unused-dependency

The old table library is a dependency, but nothing imports it any more. Remove it (`npm uninstall …`), after asking the user, once no table uses it.

## unknown-prop

A prop the table doesn't have, usually left over from the old grid. Common ones:

| Old                                               | argus-table                                             |
| ------------------------------------------------- | ------------------------------------------------------- |
| `rowData`, `rows`, `items`, `value`               | `data`                                                  |
| `columnDefs`, `headers`                           | `columns`                                               |
| `rowKey`, `dataKey`, `getRowNodeId`, `item-value` | `getRowId`                                              |
| `pagination`, `paginationModel`, `pageSize`       | none: the table scrolls ([gaps.md](gaps.md#pagination)) |
| `loading`                                         | none: `dataSource` shows loading rows as skeletons      |
| `sortModel`, `filterModel`                        | `sorting`, `columnFilters`                              |
| `localeText`, `locale`                            | `labels`                                                |

## unknown-event

An event the table doesn't fire, usually from the old grid (`onRowClicked`, `rowClicked`) or from before 0.4 (`argus-sort-change` → `argus-sorting-change`, `argus-column-resize` → `argus-column-sizing-change`, `argus-row-select` → `argus-selection-change`). The events are listed in [api.md](api.md#events).

## unknown-column-field

A column field that isn't part of `ColumnDef`, usually the old grid's name: `field` / `accessorKey` / `dataIndex` / `prop` → `accessor`; `headerName` / `title` / `label` → `header`; `renderCell` / `cellRenderer` / `render` → `cell`; `pinned: 'left'` / `fixed: 'left'` → `pin: 'start'`; `flex: 1` → `width: { flex: 1 }`; `hide` → `hidden`. Unknown fields are ignored, so the behaviour silently disappears.

## data-mutated

The table sees a change of `data` when it gets a new array. `push`, `splice`, `sort()` in place or `rows[i] = …` change the same array, so nothing re-renders:

```ts
// Wrong
rows.push(newRow);
// Right
rows = [...rows, newRow]; // or setRows((r) => [...r, newRow])
```

To edit rows in place on purpose (very large data), call `table.refresh()` afterwards.

## set-filter-needs-options

With `data`, a `'set'` filter lists the column's distinct values. With a `dataSource` the table hasn't loaded every row, so it can't: give `filterOptions` (the values from your API), or the column menu offers no filter for that column.

## cdn-and-bundle

The page loads argus-table from the CDN bundle and the app also imports it from npm: two copies, and the second throws `argus-table has already been defined`. Use one way: npm packages with a bundler, or the CDN script (with add-ons from jsDelivr's `+esm` builds).
