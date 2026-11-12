# Formula columns (Phase 3)

[← Back to contents](../README.md)

End users can add their own columns computed from other columns, Excel-style, through the UI: one formula per column, run on every row, referencing columns by name. It ships as the optional package `@argus-table/formulas`, so the core stays small.

> **Status:** built. Step 1: the engine and the `formulas()` plugin, with formula columns declared in `columns` (`formula` on a column definition, or `<argus-column formula>`). Step 2: the editor and the column-menu entries to view, add, edit, rename and delete formula columns. Step 3: whole columns (`[[name]]`) with totals, conditional totals, lookups and rank over the rows the filters keep.

## Syntax

```text
Total        = [price] * [quantity]
Gross        = ROUND([Total] * 1.19, 2)
Status label = IF([stock] < 10, "Low", "OK")
Full name    = CONCAT([first_name], " ", [last_name])
Age in days  = DAYS(TODAY(), [created_at])
Share        = [amount] / SUM([[amount]])
Orders       = COUNTIF([[customer]], [customer])
Manager      = XLOOKUP([manager_id], [[id]], [[name]], "—")
```

- Columns in square brackets, by id or text header (case-insensitive; the id wins); spaces allowed (`[Unit price]`). That is the row's value; double brackets (`[[amount]]`) are the whole column (see [Whole columns](#whole-columns)).
- Operators `+ - * / ^`, `%` after a value (percent: `20%` is 0.2; the remainder is `MOD`), comparisons `= <> < <= > >=`, `&` joins text. Spreadsheet precedence: a leading minus binds tightest (`-2^2` is 4), then `%`, then `^` (left to right), `* /`, `+ -`, `&`, comparisons.
- Numbers use `.` as decimal point, text in double quotes (`""` for a quote inside), `TRUE` / `FALSE`; function names are case-insensitive and arguments are separated by `,`. A leading `=` is allowed.
- Types convert as in spreadsheets: a blank is 0 in arithmetic and `""` in text, numeric text is a number, text compares without case, and different types order numbers < text < booleans. Dates are `Date` values or ISO text (a bare date is local midnight).
- Formulas are stored in this one canonical form; a localised display (German `;` and decimal comma) can come later.

## Functions in the first release

| Group | Functions |
| --- | --- |
| Math | `SUM`, `MIN`, `MAX`, `AVERAGE`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `ABS`, `INT`, `MOD`, `POWER`, `SQRT` |
| Logic | `IF`, `IFS`, `AND`, `OR`, `NOT`, `IFERROR`, `ISBLANK` |
| Text | `CONCAT`, `LEFT`, `RIGHT`, `MID`, `LEN`, `UPPER`, `LOWER`, `TRIM`, `TEXT` |
| Date | `TODAY`, `YEAR`, `MONTH`, `DAY`, `DAYS`, `DATEDIF` |
| Columns | `COUNT`, `COUNTA`, `COUNTBLANK`, `SUMIF`, `COUNTIF`, `AVERAGEIF`, `XLOOKUP`, `MATCH`, `INDEX`, `RANK` |

`SUM`, `MIN`, `MAX` and `AVERAGE` work on values within one row (`SUM([q1], [q2], [q3])`) and on whole columns (`SUM([[q1]])`), skipping blanks. `IF`, `IFS`, `AND`, `OR`, `IFERROR` and `ISBLANK` evaluate only the arguments they need. `TEXT` takes number patterns (`0.00`, `#,##0`, `0%`, quoted text) and date patterns (`yyyy`, `mmm`, `dd`, `hh:mm`, `AM/PM`). All are written in-house.

## Whole columns

`[[name]]` is a whole column: its values in the rows the filters keep. Decided: the rows passing the filters (like Excel's `SUBTOTAL`), not every row of `data`, so totals follow what the user narrows the table to.

- **The rows (the "universe").** The rows of `data` (in `data` order; the sort doesn't matter) that pass the column filters and the quick filter, leaving out the filters on *range-dependent* columns and their text in the quick filter. A range-dependent column is a formula column using `[[…]]`, directly or through a formula column it reads. Without that exception a filter on `Share` would change the totals `Share` is computed from, which would change which rows pass it. A filter on a range-dependent column applies on top: it hides rows, the totals stay. Pinned rows aren't in the universe; their formulas use the same totals.
- **A range is a value only functions take.** `SUM`, `MIN`, `MAX`, `AVERAGE` and the Columns group have `ranges` set; a `ColumnRange` in an operator, another function (the app's own too) or as a column's result is `#VALUE!`. Lazy functions pass on what they pick, so `SUM(IF([x] > 0, [[a]], [[b]]))` works. In a range, totals count numbers and numeric text (the package's coercion rule) and skip text, booleans and blanks; an error passes through.
- **Criteria** of `SUMIF`, `COUNTIF`, `AVERAGEIF`: a value (equal; text without case; numeric text equals its number), or text with an operator (`">10"`, `"<>done"`, ISO dates compared as dates), with `*` and `?` wildcards in `=` and `<>` text.
- **Lookups and rank:** `XLOOKUP` (exact matches only, `#N/A` or the fallback), `MATCH` (`0` exact, `1` / `-1` binary search on sorted data, `1` the default as in Excel), `INDEX` (from 1, `#REF!` outside), `RANK` (descending by default, ties share the best rank, `#N/A` for a value not in the column). `INDEX` and `XLOOKUP` take their result column's type (`returnsFrom`).
- **Cycles:** `[[x]]` is an edge in the dependency graph like `[x]`, so `SUM([[Total]])` in `Total` is `#CYCLE!`.
- **With a `dataSource`** whole columns are `#N/A`: the rows aren't all loaded. (Passing whole columns to `getRows` stays open, like the syntax tree.)

**Per-row work stays O(1) amortised** (1M rows would be O(n²) otherwise):

1. A function call that uses a range but no value of the row (`SUM([[amount]])`) is evaluated once and kept (`once()` in `compile.ts`); range-dependent columns are compiled again for each universe, so the kept value is the universe's.
2. Each range is read once per universe and column: `Universe.range()` in `columns.ts`, keyed by what the column reads (its accessor path or function, or the compiled formula column), so two formulas summing `[[amount]]` share it.
3. Criteria and lookups that change from row to row go through indexes kept with the range (`engine/range-index.ts`): a hash map by normalised value for equality, `<>`, `XLOOKUP` and `MATCH 0`; a sorted copy with running totals for `<`, `<=`, `>`, `>=` on numbers and dates and for `RANK`. Running totals answer `SUMIF` only when every summed number is a whole number (below 2^53): differences of float running totals show noise in 15 digits. Other criteria (wildcards, text order, decimal sums) scan once per distinct criterion, memoised.

**Updates.** The plugin's `willUpdate` hook compares what the universe depends on (`data`, the filters other than on range-dependent columns, the quick filter, `columnVisibility`) with what the columns were compiled with; on a change it calls `host.invalidateColumns()`, and the `columns` hook makes a new row source. Range-dependent columns get new accessors (the table re-reads and re-sorts them), the others keep theirs. The universe is read lazily, on the first use of a range, through `host.filteredIndexes(dependent)`: by then the table's model has the new filters, and it reads only the other columns, so calling it from an accessor while the table filters or sorts is safe.

## How it works

1. A tokenizer and Pratt parser turn the formula into a syntax tree whose nodes keep their source offsets (for the editor's errors and highlighting). No `eval`, no `new Function`, only allowlisted functions, and no property access in the grammar, so user input can never run code.
2. Each formula is compiled once into closures and evaluated per row; results are cached per row object, so a new `data` array computes again and nothing is re-parsed. A compiled column is kept while its formula and the columns it reads stay the same, so a re-render doesn't recompute.
3. Formula columns can use other formula columns: they are compiled in dependency order (Tarjan's components), and every column of a cycle is `#CYCLE!`.
4. Each formula column becomes a normal column definition with an `accessor`, so sorting, pinning, resizing and virtualization work unchanged. The table drops cached values and sorts again when a column's accessor changes under the same id.
5. Errors are cell values, not crashes: `#DIV/0!`, `#VALUE!`, `#REF!` (no such column), `#NAME?` (no such function), `#NUM!`, `#N/A` (`IFS` or a lookup without a match, whole columns with a `dataSource`), `#CYCLE!`, and `#ERROR!` for a formula that can't be read (also reported once in the console). They pass through the rest of the formula, sort last, and render in the cell's light-DOM content as `.argus-formula-error` with a tooltip, coloured by `--argus-formula-error-color`. A value-dependent `cell-error` part would need a new part API on the table; the light-DOM class reaches page CSS without one.
6. The result type (number, text, boolean, date) is inferred from the syntax tree; numbers and dates align to the end. Numbers show with 15 significant digits, as in spreadsheets.

The flowchart is in [Code architecture: Formula pipeline](../code-architecture/05-formula-pipeline.md).

## UI

- **Column menu.** `formulas({ editing })` adds items to `headerMenu()`'s menu through its `headerMenuItems` protocol (any plugin can add items that way). `'view'` (the default) shows "View formula…" with the formula on formula columns; `'edit'` adds "Edit formula…", "Rename…" and "Delete column" on formula columns and "Add formula column…" on every column; `'none'` adds nothing. Pin and hide come with `columnPinning` and `columnVisibility` state.
- **Editor**, a modal `<dialog>` loaded on first use (`import()`, about 7.9 kB): column name, formula with syntax colouring (a transparent input over a coloured copy; whole columns in bold), suggestions for columns after `[` or `[[` and functions by name (an ARIA combobox), the argument hint of the function at the cursor, buttons to insert a column or a function, a preview of the first five rows in the table's order with the result type, and problems explained under each field and underlined in the formula. A note that doesn't block saving points out a total of one value of the row (`SUM([amount])`), where the whole column was likely meant. Read-only in `'view'`.
- **Placement.** The dialog renders into an element the plugin puts in the header content of the column it was opened from: the table's tokens reach it there (themes set them on `argus-table`), and the grid keeps only rows as children. A press inside it doesn't sort or start a drag (`dialog` counts as interactive content), and Escape or Cancel returns focus to that header.

See the "Add formula column" and "Column header menu" [mockups](../mockups.md).

## API

- `formula` on a column definition, `<argus-column formula="…">`: the formula lives with its column, so order, pinning, width and the framework wrappers' `columns` binding apply as to any column. (This replaces the earlier `formulaColumns` property, designed before plugin hooks existed.)
- `formulas({ functions, marker })`: the plugin. `functions` adds functions per plugin instance (`{ VAT: { fn, args: [1, 1], returns: 'number' } }`), in place of a global `registerFunction`; `marker: false` drops the `ƒx` before formula headers.
- `editing: 'view' | 'edit' | 'none'` (in place of a `formulaEditing` property) controls whether end users can see or change formulas.
- Events `argus-formula-column-add`, `argus-formula-column-change` and `argus-formula-column-remove` (bubbling, composed, fired on the table) propose a change: `detail.column`, `detail.columns` (the plugin's input columns with the change applied) and, for a change, `detail.previous`. The app owns `columns` and applies them; the table never changes its columns by itself. A rename also renames the column in formulas that name it by its old header. A new column's id comes from its name (`gross`, `gross-2`).
- Formulas aren't part of `getState()` / `setState()`: they live in `columns`, which the app owns and saves with its own data.

## Open points

- [x] Server-side `dataSource`: the server can't sort or filter by a formula column. Decided: formula columns aren't sortable or filterable with a `dataSource` (the plugin drops their `sortable` and `filter`). Still open: passing the syntax tree to `getRows` so a server can implement them. With `data`, formula columns filter like any other (errors are empty values) and the quick filter finds their results.
- [x] Size budgets for `@argus-table/formulas`, min+gzip with `lit` and `argus-table` excluded, checked by `pnpm size`: 12.3 kB for the plugin (11.9 kB with whole columns; 8.5 kB with the menu items; 7.3 kB in step 1) and 8 kB for the editor, which loads on first use (7.9 kB). Whole columns cost 3.4 kB: the range indexes (2.9 kB minified), criteria (2.1 kB) and the Columns functions (1.7 kB).
- [x] Function implementations: written in-house rather than borrowed from [`@formulajs/formulajs`](https://www.jsdelivr.com/package/npm/@formulajs/formulajs): the 34 functions, parser and plugin fit the plugin's budget together, with spreadsheet error values and coercions throughout.
- [x] Rejected engines: [HyperFormula](https://hyperformula.handsontable.com/docs/guide/licensing.md) (GPLv3/proprietary, incompatible with MIT users) and [expr-eval](https://nvd.nist.gov/vuln/detail/CVE-2025-12735) (critical code-execution CVE).
