---
'@argus-table/formulas': minor
---

New package: formula columns for `<argus-table>`. Add the plugin, and a column with a `formula` computes its value per row from other columns, as in a spreadsheet:

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
