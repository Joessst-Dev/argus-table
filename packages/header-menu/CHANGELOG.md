# @argus-table/header-menu

## 0.5.0

### Patch Changes

- 29fdb31: New plugin host member `header(def)`. It returns a column's or column group's own header as the table shows it, ready to nest in a plugin's template: ``html`<b>${host.header(def)}</b>` ``.

  - It calls a function `header`, and a group without a header shows its id.
  - It wraps the result like `content()`, so React and Vue content still renders.
  - Since plugin hooks see content as `unknown`, this replaces the `(def.header as () => unknown)()` assertion that nesting a header used to need.

  The column menu and formula columns now use it.

- Updated dependencies [29fdb31]
- Updated dependencies [22b625b]
  - argus-table@0.5.0

## 0.4.0

### Patch Changes

- 333ad32: Follow the 1.0 plugin API (ADR 0004).

  - **Formulas:**
    - Exports `FORMULA_COLUMN_ADD`, `FORMULA_COLUMN_CHANGE` and `FORMULA_COLUMN_REMOVE` for its event names, and `FormulaMenuGroup` and `FormulaMenuItem` for its menu items.
    - `FormulaColumnDetail` and `FormulaColumnChangeDetail` take the columns' content type as a second parameter, which defaults to the table's own. `detail.columns` is a readonly array.
  - **Wrappers:** they re-export the new `SortDirection` type, and a check keeps their type re-exports in step with `argus-table`.

- ef3d303: A right-click on a header opens its column menu again on Linux and macOS. The menu used to open on the press and close as soon as the mouse button came up.
- 08c5fcf: **Breaking (formulas):** the formula editor's text-colour tokens end in `-fg`, like every other text colour:

  - `--argus-formula-error-color` → `--argus-formula-error-fg`
  - `--argus-formula-function-color` → `--argus-formula-function-fg`
  - `--argus-formula-ref-color` → `--argus-formula-ref-fg`
  - `--argus-formula-number-color` → `--argus-formula-number-fg`
  - `--argus-formula-text-color` → `--argus-formula-text-fg`

  **Fallbacks (column menu and formula editor):** each token now has one fallback per role:

  - Lines and popup edges fall back to 20% of the text colour.
  - Form controls fall back to 30% of the text colour.
  - The hovered item falls back to 10% of the text colour.

  **Themes:** all five themes set the add-on tokens (`--argus-menu-*`, `--argus-dialog-*`, `--argus-formula-*`), so the column menu and the formula editor take on each theme. They also follow the renamed table tokens (`--argus-border`, `--argus-border-radius`, `--argus-row-odd-bg`, `--argus-row-pinned-bg`).

- Updated dependencies [6edb3cd]
- Updated dependencies [333ad32]
- Updated dependencies [443f4be]
- Updated dependencies [bb8194e]
- Updated dependencies [ed14d91]
- Updated dependencies [218350c]
- Updated dependencies [08c5fcf]
  - argus-table@0.4.0

## 0.3.0

### Minor Changes

- d052e1d: The column menu filters. Columns with a `filter` kind get **Filter…**, which opens a small form under the header: a condition and a value for text, a comparison or a range for numbers and dates, or a searchable checklist of the values for a `set` (the values the other filters leave, or the column's `filterOptions` with a `dataSource`). Typed values apply as typing pauses; Enter or Done closes the form, Escape closes it as it is, and Clear (or **Clear filter** in the menu) removes the filter. It sets the table's `columnFilters`, so a controlled table only gets `argus-column-filter`. `headerMenu({ filter: false })` turns it off. Style the form through the `argus-header-filter` classes; it takes the menu's tokens.
- d1716be: Other plugins can add items to the column menu: a plugin in `plugins` with a `headerMenuItems(columnId, host)` method returns groups of items (`label`, an optional dimmed `detail`, `danger`, `run()`), shown after the built-in ones with separators and optional headings. A column with items gets a menu button even when it can't sort or resize. The `HeaderMenuContributor`, `HeaderMenuGroup` and `HeaderMenuItem` types are exported, and `--argus-menu-danger-fg` and `--argus-menu-detail-font` style the new parts.
- 2dc9166: The column menu pins and hides columns. Every column's menu now has **Pin to start**, **Pin to end** and **Don't pin**, and **Hide column**, and while columns are hidden, a **Hidden columns** group shows them again (one at a time, or **Show all**). They set the table's `columnPinning` and `columnVisibility`, or only fire `argus-column-pin` and `argus-column-hide` when you control those. Pinning, hiding and showing are announced to screen readers, and hiding a column moves focus to the header that takes its place.

  Columns that can neither sort nor resize now get a menu button too. Set `pinnable: false` or `hideable: false` on a column to leave it out of those items, or turn them off with `headerMenu({ pin: false, hide: false })`.

- fc539da: New package: a column menu for `<argus-table>`. Add it as a plugin and each sortable or resizable column gets a menu button in its header:

  ```js
  import { headerMenu } from '@argus-table/header-menu';
  table.plugins = [headerMenu()];
  ```

  - The menu sorts the column ascending or descending, clears its sort, and fits its width to its content. With a controlled `sorting` or `columnSizing`, it only fires the events, as a header click does.
  - From the keyboard: Alt+ArrowDown on a focused header opens it, and so do the context menu key and Shift+F10; a right-click on a header opens it too. Arrow keys, Home and End move through it, Enter or Space runs an item, and Escape or Tab closes it. Focus returns to the header.
  - The menu is a native popover, so a small table or a pinned column doesn't clip it. Style it with `--argus-menu-bg`, `--argus-menu-fg`, `--argus-menu-shadow` and `--argus-menu-item-active-bg`, or with the classes `argus-header-menu-button`, `argus-header-menu` and `argus-header-menu-item`. It also uses the table's `--argus-border-color`, `--argus-focus-ring` and `--argus-font`.
  - Labels are in English.

### Patch Changes

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
