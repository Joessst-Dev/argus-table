---
'argus-table': minor
'@argus-table/header-menu': minor
'@argus-table/formulas': minor
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

The built-in text can be translated. Set `labels` on the table, and pass a `labels` option to `headerMenu()` and `formulas()`. Keys you leave out stay English.

```js
table.labels = {
  selectRow: 'Zeile auswählen',
  rowCount: ({ count }) => (count === 1 ? '1 Zeile' : `${count} Zeilen`),
};
table.plugins = [
  formulas({ labels: { editFormula: 'Formel bearbeiten…' } }),
  headerMenu({ labels: { sortAscending: 'Aufsteigend sortieren' } }),
];
```

- The table's labels cover the checkbox, resize handle and Retry button labels, the "No rows" text, the `aria-description` of filtered headers, and the announcements: the row count after filtering, and a column or group moved from the keyboard.
- The column menu's labels cover its items, the filter form with its operators, and its announcements.
- The formulas labels cover the menu items, the announcements and the editor. Function names, error codes, error messages and function descriptions stay English.
- Text with values in it is a function of an object, such as `({ count }) => …`, so it can pick a plural form with `Intl.PluralRules`. Numbers are passed unformatted.
- The types are `TableLabels` (also exported by the React, Vue and Angular wrappers, which get a `labels` prop), `HeaderMenuLabels` and `FormulasLabels`.

The formula editor's preview of a single row now reads "Preview, first row" instead of "first 1 rows".
