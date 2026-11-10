---
'@argus-table/header-menu': minor
---

New package: a column menu for `<argus-table>`. Add it as a plugin and each sortable or resizable column gets a menu button in its header:

```js
import { headerMenu } from '@argus-table/header-menu';
table.plugins = [headerMenu()];
```

- The menu sorts the column ascending or descending, clears its sort, and fits its width to its content. With a controlled `sorting` or `columnSizing`, it only fires the events, as a header click does.
- From the keyboard: Alt+ArrowDown on a focused header opens it, and so do the context menu key and Shift+F10; a right-click on a header opens it too. Arrow keys, Home and End move through it, Enter or Space runs an item, and Escape or Tab closes it. Focus returns to the header.
- The menu is a native popover, so a small table or a pinned column doesn't clip it. Style it with `--argus-menu-bg`, `--argus-menu-fg`, `--argus-menu-shadow` and `--argus-menu-item-active-bg`, or with the classes `argus-header-menu-button`, `argus-header-menu` and `argus-header-menu-item`. It also uses the table's `--argus-border-color`, `--argus-focus-ring` and `--argus-font`.
- Labels are in English.
