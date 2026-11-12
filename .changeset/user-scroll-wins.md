---
'argus-table': patch
---

The user's own scrolling, clicks and key presses now reliably stop a position that `setState()` (or `scrollToRow()`) is still scrolling to. Before, when the next `dataSource` page arrived within a frame or two of the input, the table could finish the restore and move the rows away from where the user had taken over.
