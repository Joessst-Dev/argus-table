---
'argus-table': minor
---

Plugins. The new `plugins` property takes add-ons, such as the column menu from `@argus-table/header-menu`:

```js
import { headerMenu } from '@argus-table/header-menu';
table.plugins = [headerMenu()];
```

- A plugin is an object with a `name` and any of three hooks. `connect(host)` runs while the table is connected and may return a cleanup function. `columns(defs, host)` changes the column definitions before the table reads them, for example to add computed columns or wrap headers. `keydown(event, target, host)` sees keys on a focused header or cell before the table does, and returns `true` to claim one.
- The `host` lets a plugin read the resolved columns (`column(id)`), find the header or cell of an event (`cellOf(event)`), sort (`setSort(columnId, 'asc' | 'desc' | null)`, which follows the controlled and uncontrolled rules of `sorting`), focus a header, announce a message to screen readers, and re-render. The table's own API is on `host.element`.
- Plugins run in array order. A new array with the same plugins changes nothing, and a plugin that throws is reported in the console and skipped instead of breaking the table.
- The types `ArgusPlugin`, `PluginHost`, `CellTarget` and `ColumnInfo` are exported.

Clicks on interactive content in a header (a button, a link, an input) no longer sort the column.
