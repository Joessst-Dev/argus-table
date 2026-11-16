# ADR 0009: Cell editing as an add-on, applied by the app

- **Status:** Accepted (16 November 2026).
- **Builds on:** [ADR 0004](0004-api-1-0.md) (`PluginHost` and plugin hooks grow in minor releases), [ADR 0002](0002-framework-content.md) (framework content in cells), [ADR 0007](0007-header-text-and-column-meta.md) (`ColumnDef.meta` for plugins' own fields).

## Context

"Cell editing, range selection, copy/paste" was a v1 non-goal ([Goals and non-goals](../plan/plan/02-goals-and-non-goals.md)), and editing was the first item on the scope-creep risk ("plugin hooks instead of core features"). With 1.0 out, export shipped as the first former non-goal ([ADR 0006](0006-export.md)), and editing is the gap people hit next when they compare the table with AG Grid or MUI X. The `argus-table-integrate` skill's migration guides list it as having no equivalent.

What shapes the design:

- **The table never changes `data`.** `data` is a property the app replaces; with a `dataSource` the rows live on the server. Every user-changeable state so far follows the controlled pattern: the table proposes a change in an event and the app (or `controllable()`) applies it. The formula editor already works this way: it fires `argus-formula-column-*` with the new columns and never sets them itself.
- **What the table already offers plugins covers most of it.** The `keydown` hook gets keys on a focused cell before the table's own; the `columns` hook can wrap a column's `cell`, so an editor renders in the cell's light-DOM content (page CSS, the table's tokens, framework content through `host.content()`); `host.cellOf(event)` turns a double-click into a cell; `ColumnDef.meta` takes typed per-column settings; the wrappers bind add-on events (`tools/generate-wrappers/src/addon-events.ts`). The active row and column stay rendered while scrolled away, so an open editor survives virtualization.
- **The CDN budget.** `argus-table` is at 50.73 of 51 kB gzipped after the split of `argus-table.ts` (#148–#150). Editors, parsing and validation can't go into the element.
- **Accessibility.** The WAI-ARIA grid pattern has an editing mode: Enter or F2 enters it, Escape leaves it, and focus is on the editing widget in the cell meanwhile. Today the grid sets no `aria-readonly`, so screen readers may announce a read-only table's cells as editable.

## Decision

### An add-on, `@argus-table/editing`

- **`cellEditing(options?)`** is a plugin, built like header-menu and formulas: peers `argus-table` and `lit`, in the `fixed` changesets group, per-table state in a `WeakMap` keyed by the element, a constructable stylesheet adopted into the table's root node (`@layer argus-editing`), its own labels (`EditingLabels`), and its own size budget in `.size-limit.js`.
- **Columns opt in through `meta.edit`**, typed by augmenting `ColumnMeta` (as export does with `meta.export`):

  ```ts
  { id: 'qty', accessor: 'qty', filter: 'number', meta: { edit: true } }
  { id: 'status', accessor: 'status', meta: { edit: {
      editor: 'select',
      options: [{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }],
      editable: (row) => !row.locked,
      validate: (value, row) => (value === 'done' && !row.owner ? 'Needs an owner' : undefined),
  } } }
  ```

  - `editor`: `'text'` (default), `'number'`, `'date'`, `'select'`, `'checkbox'`, or a function for a custom editor (below). Without one, a column's `filter` kind picks it: `number` → number, `date` → date, `set` with `filterOptions` → select.
  - `editable(row)`: per-row opt-out. `parse(text, row)`: the built-in editors' text to value. `validate(value, row)`: a message blocks the commit and shows under the editor (`aria-invalid`, `aria-describedby`).
  - Formula columns are never editable; neither is the checkbox column.

- **Custom editors** are a function `(context: EditorContext<T>) => content` with `{ value, row, rowId, columnId, commit(value), cancel() }`. The content goes through `host.content()`, so React, Vue and Angular editors work like custom cells; the wrappers type the return as their content type. The plugin focuses the first focusable element in it after it renders.

### The app applies edits

- **A commit fires `argus-cell-edit`** on the table: `detail: { row, rowId, index, columnId, value, previous, pinned? }`. The table and the plugin change nothing: the app updates `data` (or its server, then `refresh()` with a `dataSource`). It isn't an `argus-<property>-change` event, since no property holds the value (ADR 0004's naming rule).
- **`applyEdit(data, detail, columns)`** is exported as a helper: it returns a new array with the edited row replaced by a copy where the column's `accessor` path holds the value. A column with a function accessor, which has no path, gives `meta.edit.set(row, value)`.
- A commit with a value equal to `previous` (`Object.is`) fires nothing.
- After the app applies it, the row may move or vanish (sorting, filters): the active cell follows the row id, as for any data change.

### Keys and pointer

| Where         | Key                                          | Does                                                                                |
| ------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Editable cell | Enter, F2                                    | Edit, with the value                                                                |
| Editable cell | A printable character                        | Edit, starting from that character (text and number editors)                        |
| Editable cell | Delete, Backspace                            | Edit, starting empty                                                                |
| Editable cell | Double-click                                 | Edit                                                                                |
| Editor        | Enter                                        | Commit, then the cell below becomes active (Shift+Enter: above)                     |
| Editor        | Tab                                          | Commit, then the next editable cell in the row becomes active (Shift+Tab: previous) |
| Editor        | Escape                                       | Cancel; focus back on the cell                                                      |
| Editor        | Focus leaving the grid, or a click elsewhere | Commit                                                                              |

- **Options:** `cellEditing({ enterMoves: false })` keeps the edited cell active after Enter, as most data grids do; `cellEditing({ typeToEdit: false })` starts editing only with Enter, F2, Delete, Backspace and a double-click, for tables that are mostly read. Both default to spreadsheet behaviour.
- Arrow keys, Home and End stay in the editor's input. Keys with Ctrl, Cmd or Alt don't start editing, so the table's shortcuts keep working.
- On an editable cell, Enter edits instead of firing `argus-cell-click` and `argus-row-click`. A click still fires them. Cells that aren't editable keep Enter as a click.
- Opening a checkbox editor toggles it and commits, without an editing mode (Space too).

### What the table adds

All additions are optional members or hooks (ADR 0004):

- **`PluginHost.focusCell(index, columnId, section?)`** (the argument order of `value()` and `row()`): makes a cell active and focuses it after the update, like `focusHeader`. Escape, Enter and Tab need it to put focus back on a cell.
- **`ArgusPlugin.editable?(columnId, host): boolean`**, read when the model's columns change. With no plugin implementing it, the grid gets `aria-readonly="true"`: today's table is read-only, and saying so is an accessibility fix on its own. With one, the grid gets no `aria-readonly`, and cells of columns no plugin calls editable get `aria-readonly="true"`. A per-row `editable(row)` isn't reflected in ARIA; the editor doesn't open there and the plugin announces why (`labels.notEditable`).
- Nothing else: the editor is the plugin's content in the cell, so the table's rendering, pooling and measuring don't change. The estimate is under 150 B gzipped for the element; the budget stays 51 kB if it fits, else the PR asks.

### Accessibility

- The editor's input is labelled by the column's header text (`host.headerText()`) and the row's position: "Quantity, row 12". The cell stays the grid's active cell meanwhile, so leaving the editor returns to it.
- Starting and leaving editing aren't announced: focus moving into and out of the input says it. A failed validation is (`aria-live` on the message). A commit the app hasn't applied yet isn't: the plugin can't tell "not yet" from "rejected".
- Verified with VoiceOver (Safari) and NVDA (Firefox) before the release, not only axe.

## Options not taken

- **Editing in the element.** Every editor, the parsing and the validation would ship to apps that never edit, and the CDN build has 270 B to spare. Keys, focus and rendering already have plugin hooks.
- **The table applies edits itself** (mutating the row object, or an `editedValues` overlay). It breaks the rule that `data` is the app's, can't work with a `dataSource`, and would leave the app's copy out of step. An optimistic display (show the committed value until the app's next `data`) is a possible later option of the plugin, if apps ask: without a way to tell "rejected" from "not applied yet", it would show values that were never saved.
- **A controlled `editingCell` property** (which cell is in editing mode). No use case needed it outside the plugin, and it would be public, frozen API on the element.
- **`contenteditable` cells.** Typed values, selects, dates and validation would all have to be rebuilt on top of it, and it fights the pooled light-DOM content.
- **Range selection, copy and paste, fill handles** in the same add-on. They need a selection model over cells, a different decision; copying the active cell or the selected rows could come first as a small add-on of its own.

## Consequences

- A new published package in the `fixed` group, with its own Storybook stories (each editor, custom React and Vue editors, validation, a `dataSource`), the German labels in the Features/Labels story, its tokens in the theme creator's `catalog.ts` (`--argus-editor-*`, checked by its test), and its options in the `argus-table-integrate` skill's `api.mjs` and `references/api.md` (checked by `nx test skills`). The migration guides' "editing" rows change from no equivalent to this add-on.
- The wrappers bind `argus-cell-edit` through the generator's add-on events, with `CellEditDetail` written per wrapper (like `formula-events.ts`).
- `PluginHost.focusCell` and the `editable` hook are public plugin API from their release on.
- Hand-publishing the new package's first version follows the existing process for new packages.
