---
'@argus-table/formulas': minor
---

Users can now view, add, edit, rename and delete formula columns from the column menu of `@argus-table/header-menu`. Set how far with `editing`:

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
