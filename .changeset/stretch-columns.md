---
'argus-table': minor
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

`stretchColumns` (attribute `stretch-columns`) makes the columns fill the table's width: when they're narrower than the table, they stretch in proportion to their widths, up to their `maxWidth`; when the table gets narrower, they shrink back to their own widths and the table scrolls sideways as usual. A column you resize keeps the width you give it, and the other columns share the space it frees; once every column has been resized, the last one takes the free space. Pinned columns and the checkbox and chevron columns keep their widths, and nothing stretches while a `{ flex }` column takes the space. `columnSizing`, `getState()` and the resize events hold each column's own width, never a stretched one, so a saved layout fits any width. Off by default.
