# @argus-table/formulas

Formula columns for [`<argus-table>`](https://www.npmjs.com/package/argus-table): a column with a `formula` computes its value per row from other columns, as in a spreadsheet. It's a plugin, so the table stays small when you don't need it.

**[Docs and live examples](https://joessst-dev.github.io/argus-table/)** · [GitHub](https://github.com/Joessst-Dev/argus-table)

## Install

```bash
npm i argus-table @argus-table/formulas
```

`argus-table` and `lit` are peer dependencies.

## Use

```js
import 'argus-table';
import { formulas } from '@argus-table/formulas';

const table = document.querySelector('argus-table');
table.plugins = [formulas()];
table.columns = [
  { id: 'price', header: 'Unit price', accessor: 'price' },
  { id: 'qty', header: 'Quantity', accessor: 'qty' },
  { id: 'total', header: 'Total', formula: '[Unit price] * [qty]', sortable: true },
  { id: 'gross', header: 'Gross', formula: 'ROUND([Total] * 1.19, 2)' },
  { id: 'stock', header: 'Stock', formula: 'IF([qty] < 10, "Low", "OK")' },
];
```

Or as markup: `<argus-column column-id="total" header="Total" formula="[price] * [qty]">`.

A formula column is an ordinary column: it sorts, resizes, pins, moves and virtualizes like any other, and its other settings (`width`, `pin`, `sortable`, a `cell` function…) apply. The formula replaces its `accessor`.

In the framework wrappers it's the `plugins` prop. Keep the array the same between renders: a new plugin instance compiles every formula again. One `formulas()` can serve several tables.

**With `headerMenu()`**, list `formulas()` first: `plugins = [formulas(), headerMenu()]`. The header menu turns text headers into functions, and formulas name columns by their text header.

## Formulas

```text
[price] * [quantity]
ROUND([Total] * 1.19, 2)
IF([stock] < 10, "Low", "OK")
CONCAT([first_name], " ", [last_name])
DAYS(TODAY(), [created_at])
[amount] / SUM([[amount]])
COUNTIF([[customer]], [customer])
```

- **Columns** go in square brackets, by `id` or by text `header` (case doesn't matter): `[Unit price]` is the row's value. A formula can use other formula columns.
- **Whole columns** go in double brackets: `[[amount]]` is every value of the column, for the functions in the Columns group and `SUM`, `MIN`, `MAX` and `AVERAGE` (see [Whole columns](#whole-columns)).
- **Operators:** `+ - * / ^`, `%` after a number (`20%` is 0.2), `&` joins text, and `= <> < <= > >=` compare. `^` goes left to right and a leading minus binds tightest, as in spreadsheets: `-2^2` is 4.
- **Values:** numbers with `.` as the decimal point, text in double quotes (`""` for a quote inside), `TRUE` and `FALSE`. A leading `=` is allowed.
- **Types** convert as in spreadsheets: an empty cell is 0 in arithmetic and `""` in text, numeric text counts as a number, and text compares without case.

Numbers show with up to 15 significant digits, so `0.1 + 0.2` shows `0.3`. Columns whose formula gives a number or date align to the end unless they set `align`.

## Functions

Names are case-insensitive.

| Group   | Functions                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Math    | `SUM`, `MIN`, `MAX`, `AVERAGE` (over their arguments and whole columns, skipping empty ones), `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `ABS`, `INT`, `MOD`, `POWER`, `SQRT` |
| Columns | `COUNT`, `COUNTA`, `COUNTBLANK`, `SUMIF`, `COUNTIF`, `AVERAGEIF`, `XLOOKUP`, `MATCH`, `INDEX`, `RANK`                                                               |
| Logic   | `IF`, `IFS`, `AND`, `OR`, `NOT`, `IFERROR`, `ISBLANK`                                                                                                               |
| Text    | `CONCAT`, `LEFT`, `RIGHT`, `MID`, `LEN`, `UPPER`, `LOWER`, `TRIM`, `TEXT`                                                                                           |
| Date    | `TODAY`, `YEAR`, `MONTH`, `DAY`, `DAYS`, `DATEDIF`                                                                                                                  |

`TEXT(value, pattern)` takes number patterns (`0.00`, `#,##0`, `0%`, `"€ "0.00`) and date patterns (`yyyy-mm-dd`, `d mmm yyyy`, `hh:mm`, `h:mm AM/PM`). Dates are `Date` values or ISO text (`2024-03-09` is local midnight).

## Whole columns

`[[name]]` is a whole column: the column's values in every row the table's filters keep, in `data` order (whatever the sort). Totals follow the filters, as Excel's `SUBTOTAL` does:

```text
Share    = [amount] / SUM([[amount]])
Orders   = COUNTIF([[customer]], [customer])
Big ones = SUMIF([[amount]], ">1000")
Manager  = XLOOKUP([manager_id], [[id]], [[name]], "—")
Position = RANK([amount], [[amount]])
```

- **Filters on the column itself don't count.** A filter on `Share`, or the quick filter finding text in it, hides rows but leaves the totals `Share` is computed from alone; a filter on `region` changes them. The same holds for every formula column using whole columns, directly or through another formula column. Pinned rows aren't part of any whole column, though their formulas use the same totals.
- **In functions only.** `SUM`, `MIN`, `MAX`, `AVERAGE` and the Columns group take whole columns; a whole column anywhere else (`[[amount]] * 2`, `ROUND([[amount]])`, your own functions) is `#VALUE!`. In a whole column, totals count numbers and numeric text and skip the rest.
- **Criteria** (`SUMIF`, `COUNTIF`, `AVERAGEIF`) are a value (equal, text without case), or text starting with `=`, `<>`, `<`, `<=`, `>` or `>=` (`">10"`, `"<>done"`, `">=" & [limit]`, dates as ISO text). In `=` and `<>` text, `*` matches any characters and `?` one.
- **Lookups:** `XLOOKUP(value, column, result_column, [if_not_found])` finds the first exact match (text without case); `MATCH(value, column, [type])` gives a position, `0` for an exact match and `1` (the default) or `-1` for sorted data; `INDEX(column, position)` reads one, from 1. `RANK(value, column, [ascending])` ranks among the column's numbers, the largest first unless `ascending`; ties share a rank.
- **With a `dataSource`**, whole columns are `#N/A`: its rows aren't all loaded.
- **Speed.** A part that doesn't depend on the row, such as `SUM([[amount]])`, is computed once per set of rows; criteria and lookups that change from row to row go through an index of the column built once, not a scan per row. Wildcard and text-order criteria scan the column once per distinct criterion. A change of filters, quick filter or `data` computes the columns using whole columns again, and only those.

### Your own functions

```js
table.plugins = [
  formulas({
    functions: {
      VAT: { fn: (net) => Number(net) * 0.19, args: [1, 1], returns: 'number' },
    },
  }),
];
// [price] + VAT([price])
```

`fn` gets the argument values. If one is an error, the cell shows that error and `fn` doesn't run; if `fn` throws, the cell shows `#VALUE!`. `args` is `[fewest, most]` (default: any number), and `returns` sets the alignment. `params` (`['net']`, `'[digits]'` for an optional one) and `description` feed the editor's hint. Your names can replace built-in ones.

## Editing from the column menu

With [`@argus-table/header-menu`](https://www.npmjs.com/package/@argus-table/header-menu), users can work with formulas from the column menu. `editing` sets how far:

| `editing`          | Column menu                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `'view'` (default) | "View formula…" on formula columns, showing the formula; it opens the editor read-only                       |
| `'edit'`           | "Edit formula…", "Rename…" and "Delete column" on formula columns, and "Add formula column…" on every column |
| `'none'`           | Nothing                                                                                                      |

```js
table.plugins = [formulas({ editing: 'edit' }), headerMenu()];
const apply = (event) => {
  table.columns = event.detail.columns;
  saveLayout(event.detail.columns); // if you keep the user's columns
};
table.addEventListener('argus-formula-column-add', apply);
table.addEventListener('argus-formula-column-change', apply);
table.addEventListener('argus-formula-column-remove', apply);
```

**Your app owns the columns.** The plugin doesn't change them: it fires an event with the change, and you apply it. Each event's `detail` has the `column` added, changed or removed, and `columns`: the table's columns with the change applied. `argus-formula-column-change` also has the `previous` column. Renaming a column also renames it in the formulas that use its header. With `<argus-column>` children, change your markup instead (`detail.column` has what to add or change). A new column gets an id from its name (`gross`, `gross-2`…) and is sortable.

The editor is a modal dialog, loaded the first time it opens (about 7 kB). It has:

- a name and a formula field, both checked before saving: an empty or taken name, a syntax error, an unknown column or function, a wrong number of arguments and a cycle are explained under the field and underlined in the formula;
- syntax colouring, and suggestions as you type: columns after `[`, functions and `TRUE`/`FALSE` by name (ArrowUp/ArrowDown to choose, Enter or Tab to take one, Escape to close the list; Alt+ArrowDown opens it);
- the arguments of the function the cursor is in, with the current one underlined;
- buttons that insert a column, and a list of all functions;
- a preview of the result on the first five rows, in the table's current order, with the result type.

Labels are in English.

## Errors

Errors are cell values, never crashes. They pass through the rest of the formula, show their code, and explain themselves in a tooltip. They sort last, in both directions.

| Value     | Meaning                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------- |
| `#DIV/0!` | Division by zero                                                                                  |
| `#VALUE!` | A value has the wrong type, such as text in arithmetic, or a whole column where one value belongs |
| `#REF!`   | No column has that name                                                                           |
| `#NAME?`  | No function has that name                                                                         |
| `#NUM!`   | The number is out of range, such as `SQRT(-1)`                                                    |
| `#N/A`    | No condition in `IFS` is true, no match in a lookup, or whole columns with a `dataSource`         |
| `#CYCLE!` | The formula depends on its own result                                                             |
| `#ERROR!` | The formula can't be read; the console says why, once                                             |

A `cell` function on a formula column only gets values: the plugin shows errors itself. `IFERROR([a] / [b], 0)` replaces an error with a value.

## How it works

Each formula is parsed and compiled once into plain functions: there is no `eval` or `new Function`, and a formula can only reach the columns and functions it names. Results are cached per row object, so replace `data` to update, as with the table itself. Formula columns are evaluated in dependency order, and only for the rows the table reads.

**With a `dataSource`**, formula columns can't be sorted: the server sorts, and it doesn't know the formulas.

## Styling

| Class                 | Element                            |
| --------------------- | ---------------------------------- |
| `argus-formula-error` | An error value in a cell           |
| `argus-formula-mark`  | The `ƒx` before a formula's header |
| `argus-formula-label` | The header text next to the mark   |

Pass `formulas({ marker: false })` to leave headers alone. The add-on's CSS is in the `argus-formulas` cascade layer, so your rules win. The editor is light-DOM content of a header, so it takes the tokens set on `argus-table` or a theme:

| Token                                                                                                                                                 | Default                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `--argus-formula-error-color`                                                                                                                         | The text colour: error values, problems and their underline     |
| `--argus-dialog-bg`, `--argus-dialog-fg`                                                                                                              | `--argus-menu-bg` / `--argus-menu-fg`, then the table's colours |
| `--argus-dialog-accent`, `--argus-dialog-accent-fg`                                                                                                   | `Highlight`, `HighlightText`: the save button                   |
| `--argus-dialog-shadow`, `--argus-dialog-backdrop`                                                                                                    | A soft shadow; black at 40% behind the dialog                   |
| `--argus-formula-font`                                                                                                                                | `ui-monospace` and other monospace fonts                        |
| `--argus-formula-input-bg`                                                                                                                            | `--argus-bg`: behind the formula as you type                    |
| `--argus-formula-function-color`, `--argus-formula-ref-bg`, `--argus-formula-ref-color`, `--argus-formula-number-color`, `--argus-formula-text-color` | The text colour; column names on a faint tint                   |

The editor also uses the table's `--argus-border-color`, `--argus-focus-ring`, `--argus-header-bg`, `--argus-font` and the menu tokens for its suggestion list. Its classes start with `argus-formula-` (the dialog is `argus-formula-editor`).

## Without a bundler

The add-on imports `lit` by name. jsDelivr's `+esm` builds resolve that for you:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/argus-table/dist/cdn/argus-table.js"
></script>
<script type="module">
  import { formulas } from 'https://cdn.jsdelivr.net/npm/@argus-table/formulas/+esm';
  document.querySelector('argus-table').plugins = [formulas()];
</script>
```

MIT licensed.
