---
'argus-table': minor
---

More keyboard navigation in the grid. PageDown and PageUp move focus by a page of rows (the rows that fit below the header) in the same column, and the view scrolls with it, so the focused cell keeps its place on screen. Ctrl+Home jumps to the first header and scrolls to the top, and Ctrl+End jumps to the last row's last cell, even 100,000 rows down. Cmd+Home and Cmd+End do the same on macOS. As before, keys pressed inside cell content are left to that content.
