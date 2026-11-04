---
'argus-table': minor
---

Resize columns. Resizable columns (the default) get a `resize-handle` on their header's inline-end edge: drag it, or press Alt+Arrow on a focused header for 10 px steps, mirrored in RTL. Widths stay within `minWidth` and `maxWidth`, and a resized flex column becomes fixed. The `columnSizing` property works uncontrolled or controlled like `sorting`, and `argus-column-resize` carries `{ columnId, width, sizing }` on every change, including each frame of a drag. The handle's line uses `--argus-resize-handle-color`.
