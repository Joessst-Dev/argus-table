# Formula columns (post-launch, v0.4–v0.5)

[← Back to contents](../README.md)

End users can add their own columns computed from other columns, Excel-style, through the UI: one formula per column, run on every row, referencing columns by name. It ships as the optional package `@argus-table/formulas`, so the core stays small.

## Syntax

```text
Total        = [price] * [quantity]
Gross        = ROUND([Total] * 1.19, 2)
Status label = IF([stock] < 10, "Low", "OK")
Full name    = CONCAT([first_name], " ", [last_name])
Age in days  = DAYS(TODAY(), [created_at])
```

- Columns in square brackets, by header or id; spaces allowed (`[Unit price]`).
- Operators `+ - * / ^ %`, comparisons `= <> < <= > >=`, `&` joins text.
- Numbers use `.` as decimal point, text in double quotes, `TRUE` / `FALSE`; function names are case-insensitive and arguments are separated by `,`.
- Formulas are stored in this one canonical form; a localised display (German `;` and decimal comma) can come later.

## Functions in the first release

| Group | Functions |
| --- | --- |
| Math | `SUM`, `MIN`, `MAX`, `AVERAGE`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `ABS`, `INT`, `MOD`, `POWER`, `SQRT` |
| Logic | `IF`, `IFS`, `AND`, `OR`, `NOT`, `IFERROR`, `ISBLANK` |
| Text | `CONCAT`, `LEFT`, `RIGHT`, `MID`, `LEN`, `UPPER`, `LOWER`, `TRIM`, `TEXT` |
| Date | `TODAY`, `YEAR`, `MONTH`, `DAY`, `DAYS`, `DATEDIF` |

`SUM`, `MIN`, `MAX` and `AVERAGE` work on values within one row (`SUM([q1], [q2], [q3])`). Whole-column aggregates and lookups across rows are a later step.

## How it works

1. A tokenizer and Pratt parser turn the formula into a syntax tree. No `eval`, no `new Function`, only allowlisted functions, and no property access in the grammar, so user input can never run code.
2. Each formula is compiled once into a closure, evaluated per row, and cached by row id + data version.
3. Formula columns can use other formula columns: they are evaluated in dependency order, and a cycle is reported in the editor.
4. Each formula column becomes a normal column definition with an `accessorFn`, so sorting, filtering, pinning, resizing and virtualization work unchanged.
5. Errors are cell values, not crashes: `#DIV/0!`, `#VALUE!`, `#REF!` (column deleted), `#CYCLE!`; styled through a `cell-error` part.
6. The result type (number, text, boolean, date) is inferred for alignment and formatting.

The flowchart is in [Code architecture: Formula pipeline](../code-architecture/05-formula-pipeline.md).

## UI

- "Add formula column…" entry in the column header menu, enabled with the `formulas` property.
- Formula editor: autocomplete for column and function names, syntax highlighting, argument hints, live preview on the first 5 rows, inline error messages.
- Edit, rename and delete through the column header menu.

See the "Add formula column" and "Column header menu" [mockups](../mockups.md).

## API additions

- `formulaColumns` property: `[{ id, header, formula }]`; also `<argus-column formula="…">`.
- Events `argus-formula-column-add`, `argus-formula-column-change`, `argus-formula-column-remove` carry the definition so the host app can save it; formulas are included in `getState()` / `setState()`.
- `registerFunction(name, fn, signature)` lets developers add their own functions to the allowlist.
- `formulaEditing: 'none' | 'view' | 'edit'` controls whether end users can see or change formulas.

## Open points

- [ ] Server-side `dataSource`: the server can't sort or filter by a formula column. Default: disable sorting/filtering on formula columns in server mode; option: pass the syntax tree to `getRows` so the server can implement it.
- [ ] Size budget for `@argus-table/formulas` (to be set after a prototype).
- [ ] Function implementations: borrow from [`@formulajs/formulajs`](https://www.jsdelivr.com/package/npm/@formulajs/formulajs) (MIT) or write our own, decided by bundle size.
- [x] Rejected engines: [HyperFormula](https://hyperformula.handsontable.com/docs/guide/licensing.md) (GPLv3/proprietary, incompatible with MIT users) and [expr-eval](https://nvd.nist.gov/vuln/detail/CVE-2025-12735) (critical code-execution CVE).
