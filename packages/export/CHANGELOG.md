# @argus-table/export

## 1.3.0

### Patch Changes

- Updated dependencies [39d2808]
- Updated dependencies [afb3792]
- Updated dependencies [71eb419]
- Updated dependencies [077fbf6]
- Updated dependencies [9350927]
  - argus-table@1.3.0

## 1.2.0

### Minor Changes

- 3cdbe9c: A column can carry its own export options as `meta.export`, next to its definition, instead of in the `columns` option keyed by id:

  ```js
  { id: 'total', header: 'Total', accessor: 'total', meta: { export: { header: 'Total (EUR)', value: (v) => Math.round(v) } } },
  { id: 'actions', cell: () => html`…`, meta: { export: { exclude: true } } },
  ```

  - `meta.export` takes the same `header`, `value` and `exclude` as the `columns` option, typed for your rows. The `columns` option of `tableExport()` and of each call still applies and wins field by field.
  - Columns and groups whose header is a template, JSX or a slot are now named in the header row by their header's text mode (`header: ({ text }) => (text ? 'Total' : …)`), else by their id.
  - `tableExport()` no longer has to come first in `plugins`: it reads the names when it exports, and the other add-ons pass them through.

### Patch Changes

- Updated dependencies [3cdbe9c]
  - argus-table@1.2.0

## 1.1.0

### Minor Changes

- 7397d32: New add-on: `@argus-table/export` saves what the table shows as CSV, Excel (.xlsx) or PDF, written in the browser with no dependencies.

  ```js
  import { downloadTable, exportTable, tableExport } from '@argus-table/export';

  table.plugins = [tableExport({ filename: 'orders' }), headerMenu()];
  await downloadTable(table, 'xlsx'); // orders.xlsx
  const csv = await exportTable(table, 'csv'); // a Blob
  ```

  - An export holds the shown columns in their order and every row the filters keep, sorted, with the pinned rows and the group header rows. Options export only the selected rows (`rows: 'selected'`), include hidden columns, rename a column, change or leave out its values, and with a `dataSource` fetch every row through `getRows` (`allRows`).
  - Excel files have typed cells (numbers, dates, booleans), merged group headers, frozen header rows and pinned columns, and a filter on the header row. PDFs repeat the header rows on every page and number the pages; they use the built-in Helvetica, so text outside Latin-1 shows as `?`. CSV is UTF-8 with a byte order mark, and text that a spreadsheet would run as a formula is escaped.
  - With `headerMenu()`, each column menu gets an Export group with the formats (`menu: false` leaves it out).
  - The Excel and PDF writers load on first use. List `tableExport()` first in `plugins`, so it sees the text headers before other plugins wrap them.

### Patch Changes

- Updated dependencies [696a67b]
- Updated dependencies [806fc7d]
- Updated dependencies [7397d32]
- Updated dependencies [94353ae]
- Updated dependencies [696a67b]
- Updated dependencies [3a96001]
  - argus-table@1.1.0
