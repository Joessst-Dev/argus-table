# Exporting detail rows: design

- **Status:** draft for review (18 November 2026).
- **Package:** `@argus-table/export` (ADR 0006). Builds on detail rows (`rowDetail`, ADR 0011).

## Intent

A table with detail panels shows, for each row, more data than its columns: an order's lines, say. Today an export holds the table's rows only. An export should be able to carry the data behind the panels too, so the file has each order with its lines.

The export can't read a panel: a panel is whatever `rowDetail` renders (a form, a nested table, a component). The app hands the export the data instead: the detail rows of a row, and their columns.

## Goals

- **Every exported row gets its detail rows**, whether or not its panel is open. (Decided by the maintainer.) The rows exported are the export's own: all rows in view order, or the selected ones (`rows: 'selected'`), with `allRows` for a `dataSource`.
- **People can pick with or without details** in the column menu. (Decided by the maintainer.) Code picks per call.
- **Each format gets the layout that suits it:**
  - **Excel:** each row followed by its detail rows, indented, under a header row of their own, grouped (outline level 1) so Excel's outline buttons collapse them.
  - **PDF:** the same layout, indented.
  - **CSV:** one flat table: the parent's columns, then the detail columns, one line per detail row with the parent's values repeated. A row without detail rows is one line with the detail columns empty.

## Non-goals

- Reading what a panel renders. Only data the app supplies goes in.
- More than one level (details of details).
- Detail rows in the table's own `getState()` or anywhere outside the export.
- Pinned rows (summary rows) get no detail rows.

## Anti-goals

- An export without `detail` must produce exactly the same files as today (the writers' existing tests must pass unchanged).
- A table without `rowDetail` can still use `detail` (an export of orders with lines doesn't need panels on screen): `detail` doesn't depend on `rowDetail`.
- Fetching detail rows must not freeze the page or start thousands of requests at once.

## The API (a public API decision: additions only, ADR 0004)

A new `detail` option in `ExportOptions` (so in `tableExport()` and per call in `exportTable()` / `downloadTable()`):

```ts
interface ExportDetail<T, D = unknown> {
  /** The detail rows' columns, in order. */
  columns: readonly ExportDetailColumn<D>[];
  /**
   * A row's detail rows. May return a promise (fetch the lines). Called once per
   * exported body row, never for pinned rows, nor for rows `rowExpandable` rejects.
   */
  rows(row: T, context: { rowId: string; signal: AbortSignal | undefined }): readonly D[] | Promise<readonly D[]>;
}

interface ExportDetailColumn<D> {
  id: string;
  header: string;
  /** What to write; default: the detail row's property named `id`. */
  value?(item: D): unknown;
  align?: ColumnAlign;   // default 'start'
  /** Width in px, for Excel and PDF; default 120. */
  width?: number;
}
```

- **Typing the detail rows (my call).** `ExportOptions<T>` keeps one type parameter, and its `detail` is `ExportDetail<T>` (`D` = `unknown`). `rows` and `value` are declared with method syntax, which TypeScript checks bivariantly, so a typed app writes `value: (line: Line) => line.qty` with no cast, and `ExportDetail<Order, Line>` can be written out where an app wants its columns checked against what `rows()` returns. No second type parameter on the public functions (TypeScript can't infer it partially) and no runtime helper.
- **`rowId`** is the id the export uses for the row everywhere else: `getRowId`'s, else the row's index as a string (my call: one rule, the same as `collect.ts` today). Apps that need their own key read it from `row`.
- `detail: false` in a per-call option turns a plugin-level `detail` off for that export.
- Values go through `toValue` like the table's values (dates stay dates, objects become JSON).
- `rowExpandable`: when the table has one, rows it rejects get no detail rows and `rows()` isn't called for them (the export reads it from `host.element`).

## Approaches (the maintainer picked A)

- **A. The sheet model carries each row's detail rows (picked).** `ExportSheet` gets an optional `detail`: the detail columns once, and per body row its detail rows (or none). Each writer lays them out its own way. All three writers change, but each gets what it needs and the formats can differ as agreed; the writers stay pure functions of the sheet, tested in Node.
- **B. Flatten before the writers.** One row list with a level marker over a union of columns. Smallest writer change, but CSV wants another shape (parent values repeated, no parent lines) so it would need its own path, and a union of columns makes Excel's header row confusing.
- **C. A second sheet or file.** Simplest, but the details aren't under their row, and CSV would need two files.

## What changes

### The sheet (`sheet.ts`)

```ts
interface ExportSheet {
  columns: ExportColumn[];
  groups: ExportHeaderCell[][];
  rows: ExportValue[][];
  /** Detail rows: the columns, and per entry of `rows` its detail rows (`undefined`: none, or a pinned row). */
  detail?: { columns: ExportColumn[]; rows: (ExportValue[][] | undefined)[] };
}
```

### Collecting (`collect.ts`)

- After the rows are read (all three paths: view, selected, `allRows`), call `detail.rows()` for each body row, **in order, at most 6 at a time**, passing the export's `signal`. An abort rejects the export like today.
- **Yielding (my call):** collecting detail rows yields to the event loop between batches (every 50 rows, through `setTimeout(0)`), so a large export with synchronous `rows()` doesn't hold the page in one long task. The writers stay synchronous, as today; making them yield is out of scope.
- A rejected `rows()` fails the export (the column menu announces `failed`, as today).

### Excel (`xlsx/xlsx.ts`)

- After a row with detail rows: a header row of the detail columns (header style), then the detail rows, all starting one column in (column B: the indent), with `outlineLevel="1"`; the sheet gets `<sheetFormatPr outlineLevelRow="1">` and `<sheetPr><outlinePr summaryBelow="0"/></sheetPr>` so the collapse button sits on the parent row. Groups start expanded.
- Column widths: the wider of the table's column and the detail column at that position.
- **No `autoFilter` when the sheet has detail rows** (my call): a filter over interleaved rows would filter detail rows as data. Frozen panes stay as today.

### PDF (`pdf/pdf.ts`)

- Detail rows under their row, indented (my call: 16 pt), with a header row of the detail columns in the header style. When a detail block runs onto a new page, the page starts with the table's header (as today) and then the detail header again.

### CSV (`csv.ts`)

- Columns: the table's, then the detail columns (their headers as given; the app renames a clash through `header`). One line per detail row with the parent's values repeated; a row without detail rows is one line with empty detail columns. Group header rows: unchanged over the table's columns, empty over the detail columns.

### The column menu (`plugin.ts`, `labels.ts`)

- With a plugin-level `detail`, the Export group is followed by a second group, **"Export with details"**, with the same formats (my call: a second group, since header-menu items have no checkbox; it needs no change in header-menu). The first group exports without details.
- New label: `withDetails` (`Export with details`), with its German text in the labels story; `exported` keeps counting the table's rows.

## Docs and tooling

- `apps/docs` export page: a section with an example in four flavours (orders with lines), and its e2e.
- A Storybook story (Add-ons / Export) with a play function.
- The integrate skill: `api.mjs` and `references/api.md` list the new option (the sync test fails otherwise).
- A changeset (`@argus-table/export`: minor).
- Size budgets (`.size-limit.js`): the plugin chunk (2.8 kB), the XLSX writer (3.1 kB) and the PDF writer (2.9 kB) will grow; raises need the maintainer's approval, stated in the PR.

## Left to the builder

- Names of internal helpers, the concurrency helper, test layout.
- Exact PDF spacing within the agreed layout.
- Whether `ExportDetailColumn.value` gets the row index too (only if a test needs it).
