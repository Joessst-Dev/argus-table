# Formula columns (Phase 3)

[← Back to contents](../README.md)

End users can add their own columns computed from other columns, Excel-style, through the UI: one formula per column, run on every row, referencing columns by name. It ships as the optional package `@argus-table/formulas`, so the core stays small.

> **Status:** step 1 is built: the engine and the `formulas()` plugin, with formula columns declared in `columns` (`formula` on a column definition, or `<argus-column formula>`). Step 2 is the UI: the editor and the header-menu entries to add, edit, rename and delete formula columns.

## Syntax

```text
Total        = [price] * [quantity]
Gross        = ROUND([Total] * 1.19, 2)
Status label = IF([stock] < 10, "Low", "OK")
Full name    = CONCAT([first_name], " ", [last_name])
Age in days  = DAYS(TODAY(), [created_at])
```

- Columns in square brackets, by id or text header (case-insensitive; the id wins); spaces allowed (`[Unit price]`).
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

`SUM`, `MIN`, `MAX` and `AVERAGE` work on values within one row (`SUM([q1], [q2], [q3])`), skipping blanks. Whole-column aggregates and lookups across rows are a later step. `IF`, `IFS`, `AND`, `OR`, `IFERROR` and `ISBLANK` evaluate only the arguments they need. `TEXT` takes number patterns (`0.00`, `#,##0`, `0%`, quoted text) and date patterns (`yyyy`, `mmm`, `dd`, `hh:mm`, `AM/PM`). All are written in-house (the whole package is 7.3 kB min+gzip).

## How it works

1. A tokenizer and Pratt parser turn the formula into a syntax tree whose nodes keep their source offsets (for the editor's errors and highlighting). No `eval`, no `new Function`, only allowlisted functions, and no property access in the grammar, so user input can never run code.
2. Each formula is compiled once into closures and evaluated per row; results are cached per row object, so a new `data` array computes again and nothing is re-parsed. A compiled column is kept while its formula and the columns it reads stay the same, so a re-render doesn't recompute.
3. Formula columns can use other formula columns: they are compiled in dependency order (Tarjan's components), and every column of a cycle is `#CYCLE!`.
4. Each formula column becomes a normal column definition with an `accessor`, so sorting, pinning, resizing and virtualization work unchanged. The table drops cached values and sorts again when a column's accessor changes under the same id.
5. Errors are cell values, not crashes: `#DIV/0!`, `#VALUE!`, `#REF!` (no such column), `#NAME?` (no such function), `#NUM!`, `#N/A` (`IFS` without a match), `#CYCLE!`, and `#ERROR!` for a formula that can't be read (also reported once in the console). They pass through the rest of the formula, sort last, and render in the cell's light-DOM content as `.argus-formula-error` with a tooltip, coloured by `--argus-formula-error-color`. A value-dependent `cell-error` part would need a new part API on the table; the light-DOM class reaches page CSS without one.
6. The result type (number, text, boolean, date) is inferred from the syntax tree; numbers and dates align to the end. Numbers show with 15 significant digits, as in spreadsheets.

The flowchart is in [Code architecture: Formula pipeline](../code-architecture/05-formula-pipeline.md).

## UI (step 2)

- "Add formula column…" entry in the column header menu, enabled with the `formulas` property.
- Formula editor: autocomplete for column and function names, syntax highlighting, argument hints, live preview on the first 5 rows, inline error messages.
- Edit, rename and delete through the column header menu.

See the "Add formula column" and "Column header menu" [mockups](../mockups.md).

## API

- `formula` on a column definition, `<argus-column formula="…">`: the formula lives with its column, so order, pinning, width and the framework wrappers' `columns` binding apply as to any column. (This replaces the earlier `formulaColumns` property, designed before plugin hooks existed.)
- `formulas({ functions, marker })`: the plugin. `functions` adds functions per plugin instance (`{ VAT: { fn, args: [1, 1], returns: 'number' } }`), in place of a global `registerFunction`; `marker: false` drops the `ƒx` before formula headers.
- Step 2: events `argus-formula-column-add`, `argus-formula-column-change`, `argus-formula-column-remove` carry the proposed column definition so the host app, which owns `columns`, can apply and save it; `formulaEditing: 'none' | 'view' | 'edit'` controls whether end users can see or change formulas; formulas are included in `getState()` / `setState()` once those exist.

## Open points

- [x] Server-side `dataSource`: the server can't sort or filter by a formula column. Decided: formula columns aren't sortable with a `dataSource`. Still open: passing the syntax tree to `getRows` so a server can implement them.
- [x] Size budget for `@argus-table/formulas`: 8 kB min+gzip (`lit` and `argus-table` excluded; 7.3 kB at first release), checked by `pnpm size`.
- [x] Function implementations: written in-house rather than borrowed from [`@formulajs/formulajs`](https://www.jsdelivr.com/package/npm/@formulajs/formulajs): the 34 functions, parser and plugin fit the budget above together, with spreadsheet error values and coercions throughout.
- [x] Rejected engines: [HyperFormula](https://hyperformula.handsontable.com/docs/guide/licensing.md) (GPLv3/proprietary, incompatible with MIT users) and [expr-eval](https://nvd.nist.gov/vuln/detail/CVE-2025-12735) (critical code-execution CVE).
