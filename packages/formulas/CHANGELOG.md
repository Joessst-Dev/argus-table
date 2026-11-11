# @argus-table/formulas

## 0.3.0

### Minor Changes

- d1716be: Users can now view, add, edit, rename and delete formula columns from the column menu of `@argus-table/header-menu`. Set how far with `editing`:

  ```js
  table.plugins = [formulas({ editing: 'edit' }), headerMenu()];
  const apply = (event) => (table.columns = event.detail.columns);
  table.addEventListener('argus-formula-column-add', apply);
  table.addEventListener('argus-formula-column-change', apply);
  table.addEventListener('argus-formula-column-remove', apply);
  ```

  - `'view'` (the default) shows a formula column's formula in its menu and opens it read-only. `'edit'` adds "Edit formula…", "Rename…" and "Delete column" to formula columns and "Add formula column…" to every column. `'none'` adds nothing.
  - The editor is a modal dialog, loaded the first time it opens. It colours the formula, suggests columns after `[` and functions by name, shows the arguments of the function you're in, inserts columns and functions from buttons, previews the result on the first five rows, and explains problems before you save.
  - Your app owns the columns: the plugin proposes each change through `argus-formula-column-add`, `-change` and `-remove`, with `detail.columns` ready to set. A rename also updates the formulas that used the old name.
  - The editor takes the table's tokens, and `--argus-dialog-*` and `--argus-formula-*` tokens style it. Custom functions can describe themselves for its hints with `params` and `description`.

- 090fcba: New package: formula columns for `<argus-table>`. Add the plugin, and a column with a `formula` computes its value per row from other columns, as in a spreadsheet:

  ```js
  import { formulas } from '@argus-table/formulas';
  table.plugins = [formulas()];
  table.columns = [
    { id: 'price', header: 'Unit price', accessor: 'price' },
    { id: 'qty', header: 'Quantity', accessor: 'qty' },
    { id: 'total', header: 'Total', formula: '[Unit price] * [qty]', sortable: true },
    { id: 'gross', header: 'Gross', formula: 'ROUND([Total] * 1.19, 2)' },
  ];
  ```

  - Columns are named in brackets by id or header, and a formula can use other formula columns. Operators `+ - * / ^ %`, `&` for text and comparisons work as in spreadsheets, and so do 34 functions: math (`SUM`, `ROUND`, `MOD`…), logic (`IF`, `IFS`, `IFERROR`…), text (`CONCAT`, `LEFT`, `TEXT`…) and dates (`TODAY`, `DAYS`, `DATEDIF`…). Add your own with `formulas({ functions: { VAT: { fn: (n) => Number(n) * 0.19, args: [1, 1] } } })`.
  - Formula columns sort, resize, pin, move and virtualize like any other column. Numbers and dates align to the end, and an `ƒx` mark goes before the header (`marker: false` turns it off).
  - Errors are cell values, never crashes: `#DIV/0!`, `#VALUE!`, `#REF!`, `#NAME?`, `#NUM!`, `#N/A`, `#CYCLE!`, and `#ERROR!` for a formula that can't be read. Each has a tooltip that explains it, and they sort last. Colour them with `--argus-formula-error-color` or the `argus-formula-error` class.
  - Formulas are compiled once and never run as code. Results are cached per row, so replace `data` to update.
  - With a `dataSource`, formula columns can't be sorted: the server doesn't know the formulas.
  - With the column menu, list it first: `plugins = [formulas(), headerMenu()]`.

### Patch Changes

- d052e1d: Formula columns can be filtered like other columns (an error counts as an empty value), and the table's quick filter finds their results. With a `dataSource` they can't be filtered, as they can't be sorted: the server doesn't know the formulas.
- 55b84a3: Column headers with framework content (such as JSX from `@argus-table/react`) keep it when the column menu or a formula mark wraps them.
- Updated dependencies [1d1a6f0]
- Updated dependencies [d052e1d]
- Updated dependencies [090fcba]
- Updated dependencies [9a28979]
- Updated dependencies [282b5eb]
- Updated dependencies [e611a9e]
- Updated dependencies [b48284b]
- Updated dependencies [ad09697]
- Updated dependencies [55b84a3]
- Updated dependencies [d1716be]
- Updated dependencies [fc539da]
- Updated dependencies [5c08bb1]
- Updated dependencies [cfbc794]
- Updated dependencies [a691e9d]
  - argus-table@0.3.0
