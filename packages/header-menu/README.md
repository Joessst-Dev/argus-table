# @argus-table/header-menu

A column menu for [`<argus-table>`](https://www.npmjs.com/package/argus-table). It's a plugin: each column gets a button in its header that opens a menu to sort the column, clear its sort, filter it, pin it to a side, fit its width to its content, or hide it, and to show hidden columns again.

**[Docs and live examples](https://joessst-dev.github.io/argus-table/)** · [GitHub](https://github.com/Joessst-Dev/argus-table)

## Install

```bash
npm i argus-table @argus-table/header-menu
```

`argus-table` and `lit` are peer dependencies.

## Use

```js
import 'argus-table';
import { headerMenu } from '@argus-table/header-menu';

const table = document.querySelector('argus-table');
table.plugins = [headerMenu()];
```

In the framework wrappers it's the `plugins` prop. Keep the array the same between renders: a new plugin instance reconnects and closes an open menu.

```tsx
// React: outside the component, or in useMemo.
const plugins = [headerMenu<Order>()];
<ArgusTable columns={columns} data={orders} plugins={plugins} />;
```

One `headerMenu()` can serve several tables.

### Options

`headerMenu({ pin: false })` leaves out the pin items, `headerMenu({ hide: false })` the hide and show items, and `headerMenu({ filter: false })` the filter items; all default to `true`. With all three off, only sortable and resizable columns (and columns with items from other plugins) get a menu. To keep a single column out, set `pinnable: false` or `hideable: false` on it, or leave out its `filter`.

## What it does

- **Sort ascending**, **Sort descending** and **Unsorted** for sortable columns, **Fit width** for resizable ones.
- **Filter…** for columns with a `filter` kind, and **Clear filter** on a filtered one. Filter… opens a small form under the header: a condition and a value for `text` (contains, equals, starts with, empty), a comparison or a range for `number` and `date`, or a searchable checkbox list for `set`, listing the values the other filters leave (with a `dataSource`, the column's `filterOptions`). Typed values apply when typing pauses; Enter or **Done** closes the form, Escape closes it as it is, and **Clear** removes the column's filter. The form sets the table's `columnFilters`.
- **Pin to start**, **Pin to end** and **Don't pin** for columns with `pinnable` (the default), **Hide column** for columns with `hideable` (the default) while another column is shown, and a **Hidden columns** group with **Show …** for each hidden column (and **Show all**) in every menu. Hiding a column moves focus to the header that takes its place.
- Every item goes through the table's own rules: with a controlled `sorting`, `columnSizing`, `columnPinning`, `columnVisibility` or `columnFilters`, the menu only fires `argus-sort-change`, `argus-column-resize`, `argus-column-pin`, `argus-column-hide` or `argus-column-filter`, like a header click or a double-click on the resize handle.
- **Mouse:** the button in the header, or a right-click on the header.
- **Keyboard:** on a focused header, Alt+ArrowDown, the context menu key or Shift+F10 opens the menu. ArrowUp and ArrowDown move (they wrap), Home and End jump, Enter or Space runs an item, Escape or Tab closes the menu. Focus goes back to the header.
- **Screen readers:** the button is labelled "Column menu" and the menu is labelled by the column's header. Fitting, pinning, hiding and showing a column are announced, and the table announces the rows a filter leaves. The filter form is a dialog labelled "Filter" and the column's name, with labelled fields. Labels are in English.
- The menu and the filter form are native [popovers](https://developer.mozilla.org/docs/Web/API/Popover_API) in the top layer, so a short table or a pinned column doesn't clip them.

## Items from other plugins

Other plugins can add items to the menu: any plugin in the table's `plugins` with a `headerMenuItems(columnId, host)` method, before or after `headerMenu()`. It returns groups of items; each group comes after a separator, with an optional heading. [`@argus-table/formulas`](https://www.npmjs.com/package/@argus-table/formulas) adds its formula items this way.

```ts
import type { ArgusPlugin } from 'argus-table';
import type { HeaderMenuContributor } from '@argus-table/header-menu';

const copyId: ArgusPlugin<Order> & HeaderMenuContributor<Order> = {
  name: 'copy-id',
  headerMenuItems: (columnId, host) => [
    {
      items: [
        {
          label: 'Copy column id',
          detail: columnId,
          run: () => {
            void navigator.clipboard.writeText(columnId);
            host.focusHeader(columnId);
          },
        },
      ],
    },
  ],
};
table.plugins = [headerMenu(), copyId];
```

- An item has a `label`, an optional `detail` (shown dimmed after it, and part of its accessible name) and `danger` (for items that remove something), and `run()`.
- `run()` runs after the menu closes. Focus is the item's to place: open a dialog, or call `host.focusHeader()`.
- A column with items gets a menu button even if it can't sort or resize.
- The method runs while headers render and when a menu opens, so keep it cheap. One that throws is reported in the console and skipped.

## Styling

The button and the menu are light-DOM content of the table, so page CSS reaches them through these classes:

| Class                           | Element                                           |
| ------------------------------- | ------------------------------------------------- |
| `argus-header-menu-button`      | The button in each header                         |
| `argus-header-menu`             | The menu                                          |
| `argus-header-menu-item`        | Each item; `aria-checked` on the sort ones        |
| `argus-header-menu-item-detail` | The dimmed text after an item from another plugin |
| `argus-header-menu-item-danger` | An item that removes something                    |
| `argus-header-menu-group-label` | A group's heading                                 |
| `argus-header-filter`           | The filter form (it uses the menu's tokens)       |
| `argus-header-filter-field`     | A labelled field of the form                      |
| `argus-header-filter-values`    | The checkbox list of a set filter                 |
| `argus-header-filter-button`    | The Clear and Done buttons                        |

The add-on's own CSS is in the `argus-header-menu` cascade layer, so your rules win. Tokens, set on `argus-table` or a theme:

| Token                         | Default                                  |
| ----------------------------- | ---------------------------------------- |
| `--argus-menu-bg`             | `--argus-bg`, then `Canvas`              |
| `--argus-menu-fg`             | `--argus-fg`, then `CanvasText`          |
| `--argus-menu-shadow`         | `0 4px 16px rgb(0 0 0 / 0.16)`           |
| `--argus-menu-item-active-bg` | The text colour at 10% (hover and focus) |
| `--argus-menu-danger-fg`      | The text colour                          |
| `--argus-menu-detail-font`    | `ui-monospace, monospace`                |

The menu also uses the table's `--argus-border-color`, `--argus-border-width`, `--argus-focus-ring` and `--argus-font`.

## Without a bundler

The add-on imports `lit` by name. jsDelivr's `+esm` builds resolve that for you:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/argus-table/dist/cdn/argus-table.js"
></script>
<script type="module">
  import { headerMenu } from 'https://cdn.jsdelivr.net/npm/@argus-table/header-menu/+esm';
  document.querySelector('argus-table').plugins = [headerMenu()];
</script>
```

MIT licensed.
