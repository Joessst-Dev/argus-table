---
'argus-table': minor
---

More for column groups:

- Resize a group: drag the handle on its header, or press Alt+Arrow on it. The change is spread over its resizable columns in proportion to their widths, within their bounds. A double-click on the handle fits each of its columns to its content. These are column resizes: `argus-column-resize` fires once per column that changes.
- `reorderable: false` on a group (`reorderable="false"` on `<argus-column-group>`) keeps it from moving as a whole; its columns still move within it.
- Plugins can change the groups before the table reads them, with a new `columnGroups(groups, host)` hook beside `columns`.
