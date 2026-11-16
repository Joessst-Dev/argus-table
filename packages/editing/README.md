# @argus-table/editing

Cell editing for [`<argus-table>`](https://www.npmjs.com/package/argus-table): text, number, date, select and checkbox editors, custom ones, the keys of a spreadsheet, and an `argus-cell-edit` event your app applies. The table never changes your data itself.

**[Docs and live examples](https://joessst-dev.github.io/argus-table/)** · [GitHub](https://github.com/Joessst-Dev/argus-table)

## Install

```bash
npm i argus-table @argus-table/editing
```

`argus-table` and `lit` are peer dependencies.

## Use

```js
import 'argus-table';
import { applyEdit, cellEditing } from '@argus-table/editing';

const table = document.querySelector('argus-table');
table.columns = [
  { id: 'name', header: 'Name', accessor: 'name', meta: { edit: true } },
  { id: 'qty', header: 'Quantity', accessor: 'qty', filter: 'number', meta: { edit: true } },
];
table.plugins = [cellEditing()];

// The app applies each edit: here to `data`, or send it to your server.
table.addEventListener('argus-cell-edit', (e) => {
  table.data = applyEdit(table.data, e.detail, table.columns);
});
```

`argus-cell-edit` fires when an edit is committed with a value that differs from the one before. `detail: { row, rowId, index, columnId, value, previous, pinned? }`; `pinned` is `'top'` or `'bottom'` for a row from `pinnedRows`. Until you apply it, the cell shows the old value. With a `dataSource`, save the edit and call `table.refresh()`.

`applyEdit(data, detail, columns)` returns a new array with the edited row replaced by a copy holding the new value. A column whose `accessor` is a path (`'qty'`, `'address.city'`) needs nothing more; one with a function accessor needs `meta.edit.set`. Pinned rows are your own objects: `applyEdit` leaves `data` as it is for them.

## Keys

| Where         | Key                                  | Does                                                                           |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| Editable cell | Enter, F2, double-click              | Edit, starting from the value                                                  |
| Editable cell | A character                          | Edit, starting from that character                                             |
| Editable cell | Delete, Backspace                    | Edit, starting empty                                                           |
| Editor        | Enter                                | Commit; the cell below becomes active (Shift+Enter: above)                     |
| Editor        | Tab                                  | Commit; the next editable cell in the row becomes active (Shift+Tab: previous) |
| Editor        | Escape                               | Cancel; focus goes back to the cell                                            |
| Editor        | Focus leaving it (a click elsewhere) | Commit                                                                         |

On an editable cell Enter edits rather than firing `argus-cell-click`; other cells keep it. Space stays the table's (it selects rows), and keys with Ctrl, Cmd or Alt never start editing.

## Options

```js
cellEditing({
  enterMoves: false, // after Enter, keep the edited cell active (default: move down)
  typeToEdit: false, // only Enter, F2, Delete, Backspace and a double-click edit (default: typing too)
  labels: { notANumber: 'Bitte eine Zahl eingeben' },
});
```

### Per column: `meta.edit`

`meta: { edit: true }` edits a column with the defaults. An object says how:

```js
{
  id: 'status',
  accessor: 'status',
  meta: {
    edit: {
      editor: 'select',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'done', label: 'Done' },
      ],
      editable: (row) => !row.locked,
      validate: (value, row) => (value === 'done' && !row.owner ? 'Needs an owner' : undefined),
    },
  },
}
```

- `editor`: `'text'`, `'number'`, `'date'`, `'select'`, `'checkbox'`, or a function for a custom editor (below). Without one, the column's `filter` kind picks it: `'number'` → the number editor, `'date'` → the date editor, `'set'` with `filterOptions` → a select of them, anything else → text.
  - The date editor keeps the column's kind of value: a string stays `yyyy-mm-dd`, anything else becomes a `Date` at local midnight; empty is `null`.
  - The checkbox editor has no editing mode: a click on the checkbox, Space, Enter or F2 toggles the value and commits it. The cell shows the checkbox unless the column has a `cell` of its own.
- `options`: the select's choices, `{ value, label }`. Default: the column's `filterOptions`.
- `editable(row)`: whether a row's cell can be edited. A key on a cell that can't be is announced to screen readers.
- `parse(text, row)`: the text and number editors' text to a value. The number editor reads numbers, a decimal comma (`2,5`) and empty text (`null`).
- `validate(value, row)`: a message keeps the editor open and shows under it; `undefined` lets the edit through.
- `set(row, value)`: a copy of the row with the value set, for `applyEdit()` on a column with a function accessor.

Formula columns (`@argus-table/formulas`) can't be edited.

### Custom editors

`editor` as a function returns the cell's content while it is edited, like a column's `cell`: a Lit template, a DOM node, or with the React, Vue and Angular wrappers a component. It gets `{ value, row, rowId, columnId, label, commit(value), cancel() }`:

```js
editor: ({ value, label, commit, cancel }) => html`<input
  type="range" min="1" max="5" aria-label=${label} .value=${String(value)}
  @change=${(e) => commit(Number(e.target.value))}
  @keydown=${(e) => e.key === 'Tab' && cancel()}
/>`,
```

The plugin focuses the editor's first control. `commit(value)` validates the value (`validate`), fires `argus-cell-edit` if it changed and puts focus back on the cell; `cancel()` and Escape close it without a change. Enter and Tab are the editor's own; focus leaving it cancels, since only the editor knows its value.

## Styling

The editor is light-DOM content of the cell, so it takes the cell's font, colour and alignment, and page CSS reaches it: `.argus-edit-input` is the input or select, `.argus-edit-error` the validation message. Tokens, each falling back to the table's own:

| Token                         | Default                                      |
| ----------------------------- | -------------------------------------------- |
| `--argus-editor-bg`           | `var(--argus-bg)`                            |
| `--argus-editor-border-color` | `var(--argus-border-color)`                  |
| `--argus-editor-error-color`  | the text colour (the message and the border) |

## Labels

Every built-in text is in `labels`: the editor's accessible name (`editor: ({ column, row }) => …`, "Quantity, row 12"), `notANumber` and `notEditable: ({ column }) => …`. Keys you leave out stay English.

## Accessibility

Without an editing plugin the table tells assistive technology that it is read-only; with `cellEditing()`, the cells of columns that can't be edited are marked read-only instead. The editor is labelled by its column and row, focus stays in the grid's active cell while editing, and a validation message is announced.
