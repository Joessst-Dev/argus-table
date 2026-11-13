# ADR 0006: Export to CSV, XLSX and PDF as a dependency-free add-on

- **Status:** Accepted (13 November 2026).
- **Builds on:** [ADR 0004](0004-api-1-0.md), whose compatibility policy lets `PluginHost` gain required members in a minor release.

## Context

"Excel/CSV/PDF export" was a v1 non-goal ([Goals and non-goals](../plan/plan/02-goals-and-non-goals.md)). Apps that show data in a table usually need to hand it on, and with 1.0 out it became the next feature. Two questions shaped it. First, how the files get written: the common libraries (SheetJS or ExcelJS, jsPDF with autotable) are each larger than the whole table. Second, how an add-on reads the table: `PluginHost` offered the body rows' objects (`row(index)`) but no row count, no cell values, no pinned rows, no row ids and no group structure.

## Decision

- **A plugin package, `@argus-table/export`, with its own writers and no runtime dependencies.**
  - CSV ships in the plugin's chunk.
  - XLSX is a zip of SpreadsheetML: a small zip writer with CRC-32, and deflate from the platform's `CompressionStream`.
  - PDF is PDF 1.4 with the base-14 Helvetica fonts, using metrics taken from Liberation Sans, which has Helvetica's widths.
  - The XLSX and PDF writers load with `import()` on first use, like the formula editor. Each has its own size budget (about 3 kB min+gzip each, the plugin under 3 kB).
- **Writers are pure functions of a format-neutral `ExportSheet`**: columns, group header rows and plain values. They are tested in Node and checked against openpyxl and pypdf.
- **The host gets read members**: `rowCount`, `rowId`, `value` (per `RowSection`: the body in the current order, or a pinned side), `readValue` (a column's accessor on any row, for rows a plugin fetched itself), `headerGroups`, a `section` argument on `row`, and `ColumnInfo.align`. They are thin pass-throughs to the core model and use no core or TanStack types. They cost the table's CDN build about 140 B.
- **Values, not rendered cells.** An export writes what each column's accessor reads, typed (numbers, dates and booleans stay typed in XLSX), not what `cell` renders. A column's `value` option formats it when needed.
- **Header text comes from the plugin's own `columns` and `columnGroups` hooks**, so `tableExport()` goes first in `plugins`. Plugins after it (header-menu, formulas) turn headers into functions returning templates, which have no text. Options can name a header, and the column id is the fallback.

## Options not taken

- **SheetJS, ExcelJS or jsPDF as optional peer dependencies.** They have richer output (styles, embedded Unicode fonts), but each is tens of kB to hundreds of kB and outside our size budgets and review.
- **"PDF" through `window.print()` of a print view.** It has full Unicode and CSS, but it produces no file to upload or attach, depends on the browser's print dialog, and needs its own print layout of a virtualized table.
- **Reading text from the rendered DOM.** Virtualization renders only the rows and columns in view, and the content is the app's own markup.
- **Exposing the core model, or TanStack, to plugins.** It would put internal types into the public API that ADR 0004 froze.

## Consequences

- PDF text is limited to WinAnsi (Latin-1 plus `€ „ “ ” – — …`); anything else prints as `?`. Embedding a Unicode font subset is possible later as an option, at a cost of bytes.
- Export from a `dataSource` holds the loaded rows unless `allRows` fetches every page through `getRows`. Formula columns still read `#N/A` for whole columns there ([Formula columns](../plan/plan/09-formula-columns.md)).
- Any contribution to the column menu gives every column a menu button, so `tableExport()` with `headerMenu()` puts a button on each column. `menu: false` turns the group off.
- The export has no button of its own. The table has no toolbar, so apps call `downloadTable()` from their own buttons.
