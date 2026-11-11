# @argus-table/header-menu

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
