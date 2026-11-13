# @argus-table/export

Export for [`<argus-table>`](https://www.npmjs.com/package/argus-table): save what the table shows as CSV, Excel (.xlsx) or PDF. The files are written in the browser with no dependencies. The Excel and PDF writers load the first time they're used.

**[Docs and live examples](https://joessst-dev.github.io/argus-table/)** · [GitHub](https://github.com/Joessst-Dev/argus-table)

## Install

```bash
npm i argus-table @argus-table/export
```

`argus-table` is a peer dependency.

## Use

```js
import 'argus-table';
import { downloadTable, exportTable, tableExport } from '@argus-table/export';

const table = document.querySelector('argus-table');
table.plugins = [tableExport({ filename: 'orders' })];

saveButton.onclick = () => downloadTable(table, 'xlsx'); // orders.xlsx
const blob = await exportTable(table, 'csv'); // or keep the file
```

- `downloadTable(table, format, options?)` exports the table and has the browser download the file. It announces the number of rows to screen readers.
- `exportTable(table, format, options?)` returns the file as a `Blob`, to upload or attach. The format is `'csv'`, `'xlsx'` or `'pdf'`.

Both reject when the table has no `tableExport()` in its `plugins`.

**List it first in `plugins`.** It reads the columns' and groups' text headers before other plugins wrap them in their own content: `[tableExport(), formulas(), headerMenu()]`. A header that is a function returning a string counts as text. A header that isn't text is exported as the column's id, unless `columns: { [id]: { header } }` names it.

With [`@argus-table/header-menu`](https://www.npmjs.com/package/@argus-table/header-menu), every column menu gets an Export group with the formats. `tableExport({ menu: false })` leaves it out, and `tableExport({ formats: ['csv', 'xlsx'] })` picks the formats.

In the framework wrappers it's the `plugins` prop. Keep the array the same between renders. One `tableExport()` can serve several tables.

## What's exported

By default an export holds what the table shows:

- **Columns:** the shown columns, in their order (start-pinned, scrolling, end-pinned), with their alignment.
- **Rows:** every row the filters and the quick filter keep, in the current sort order. The rows pinned to the top and bottom come first and last. Every row is exported, not only the ones scrolled into view.
- **Header rows:** the group header rows over the column headers (`columnGroups`).

Values are what each column's `accessor` reads, not what its `cell` renders. Formula columns are exported with their results, and an error is an empty cell. Use a column's `value` option for a formatted text.

## Options

Pass options to `tableExport()` as defaults for every export of the table, or per call to `exportTable()` / `downloadTable()`.

| Option           | Default                                     | What it does                                                                                       |
| ---------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `rows`           | `'view'`                                    | `'selected'` exports only the selected rows (`selection`), in the order shown                      |
| `pinnedRows`     | `true` (`false` with `rows: 'selected'`)    | Includes the pinned rows                                                                           |
| `hiddenColumns`  | `false`                                     | Includes hidden columns, in their place in the column order (and leaves out the group header rows) |
| `headerGroups`   | `true`                                      | Includes the group header rows                                                                     |
| `allRows`        | `false`                                     | With a `dataSource`: fetches every row through `getRows` (see below)                               |
| `columns`        |                                             | Per column id: `header` (text), `value(value, row)` (what to write), `exclude`                     |
| `signal`         |                                             | An `AbortSignal` that stops the export                                                             |
| `filename`       | `'table'`                                   | `downloadTable()` only: the file name; the extension is added                                      |
| `delimiter`      | `','`                                       | CSV: between fields                                                                                |
| `bom`            | `true`                                      | CSV: starts with a byte order mark, so Excel reads UTF-8                                           |
| `escapeFormulas` | `true`                                      | CSV: puts `'` before text starting with `=`, `+`, `-`, `@`, a tab or a carriage return             |
| `sheetName`      | `'Sheet1'`                                  | Excel: the worksheet's name                                                                        |
| `pageSize`       | `'a4'`                                      | PDF: `'a4'` or `'letter'`                                                                          |
| `orientation`    | landscape when the columns don't fit across | PDF: `'portrait'` or `'landscape'`                                                                 |
| `title`          |                                             | PDF: a heading on the first page and the document's title                                          |

```js
await downloadTable(table, 'csv', {
  rows: 'selected',
  columns: {
    total: { header: 'Total (EUR)', value: (total) => total.toFixed(2) },
    internalId: { exclude: true },
  },
});
```

### With a dataSource

The table loads only the rows near the scroll position, so an export holds the rows that are loaded. With `allRows: true`, it fetches every row from your `getRows`, a page at a time (the source's `pageSize`). It sends the table's sort, filters and quick filter, and stops at `total` or at a page with fewer rows. Pass a `signal` to cancel a long export.

## Formats

- **CSV:** RFC 4180, UTF-8 with a byte order mark, CRLF line endings. Dates are local `YYYY-MM-DD` with `HH:MM` when they have a time. Text a spreadsheet would run as a formula is escaped (CSV injection).
- **Excel (.xlsx):** one worksheet with typed cells: numbers, booleans, and dates with a date format. The group headers are merged cells, and the header rows and start-pinned columns are frozen. The column header row has a filter, and column widths follow the table's.
- **PDF:** pages of rows under the header rows, which repeat on every page, with page numbers in the footer (`labels.page`). Columns keep their widths and alignment, scaled down to fit the page, and long text is cut with `…`. It uses the PDF's built-in Helvetica, so text outside Latin-1 (and `€ „ “ ” – — …`) shows as `?`. For other scripts, export to Excel or print the page.

## Labels

The menu items, the PDF footer and the announcements are English by default. Pass `labels` with any of `group`, `csv`, `xlsx`, `pdf`, `page({ page, pages })`, `exported({ rows, format })` and `failed`:

```js
tableExport({
  labels: {
    group: 'Exportieren',
    page: ({ page, pages }) => `Seite ${page} von ${pages}`,
    exported: ({ rows }) => `${rows} Zeilen exportiert`,
  },
});
```

## Without a bundler

The add-on imports nothing at run time, so its `dist` files load straight from a CDN:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/argus-table/dist/cdn/argus-table.js"
></script>
<script type="module">
  import {
    downloadTable,
    tableExport,
  } from 'https://cdn.jsdelivr.net/npm/@argus-table/export/dist/index.js';
  const table = document.querySelector('argus-table');
  table.plugins = [tableExport()];
  document.querySelector('#save').onclick = () => downloadTable(table, 'xlsx');
</script>
```

MIT licensed.
