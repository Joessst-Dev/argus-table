---
'argus-table': minor
---

Tables can fit their rows: with `block-size: auto` and a `max-block-size` (a length), the table is as tall as its header and rows up to that height, and past it scrolls and virtualizes as usual. A table with `block-size: auto` and no maximum stops at the window's height instead of rendering every row, and says so once in the console.
