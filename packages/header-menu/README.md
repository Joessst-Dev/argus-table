# @argus-table/header-menu

A column menu for [`<argus-table>`](https://www.npmjs.com/package/argus-table). It's a plugin: each sortable or resizable column gets a button in its header that opens a menu to sort the column, clear its sort, or fit its width to its content.

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

## What it does

- **Sort ascending**, **Sort descending** and **Unsorted** for sortable columns, **Fit width** for resizable ones. They go through the table's own rules: with a controlled `sorting` or `columnSizing`, the menu only fires `argus-sort-change` or `argus-column-resize`, like a header click or a double-click on the resize handle.
- **Mouse:** the button in the header, or a right-click on the header.
- **Keyboard:** on a focused header, Alt+ArrowDown, the context menu key or Shift+F10 opens the menu. ArrowUp and ArrowDown move (they wrap), Home and End jump, Enter or Space runs an item, Escape or Tab closes the menu. Focus goes back to the header.
- **Screen readers:** the button is labelled "Column menu" and the menu is labelled by the column's header. Fitting a column announces its new width. Labels are in English.
- The menu is a native [popover](https://developer.mozilla.org/docs/Web/API/Popover_API) in the top layer, so a short table or a pinned column doesn't clip it.

## Styling

The button and the menu are light-DOM content of the table, so page CSS reaches them through these classes:

| Class                      | Element                                    |
| -------------------------- | ------------------------------------------ |
| `argus-header-menu-button` | The button in each header                  |
| `argus-header-menu`        | The menu                                   |
| `argus-header-menu-item`   | Each item; `aria-checked` on the sort ones |

The add-on's own CSS is in the `argus-header-menu` cascade layer, so your rules win. Tokens, set on `argus-table` or a theme:

| Token                         | Default                                  |
| ----------------------------- | ---------------------------------------- |
| `--argus-menu-bg`             | `--argus-bg`, then `Canvas`              |
| `--argus-menu-fg`             | `--argus-fg`, then `CanvasText`          |
| `--argus-menu-shadow`         | `0 4px 16px rgb(0 0 0 / 0.16)`           |
| `--argus-menu-item-active-bg` | The text colour at 10% (hover and focus) |

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
