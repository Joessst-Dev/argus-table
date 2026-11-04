---
'@argus-table/themes': minor
'argus-table': patch
---

New package `@argus-table/themes` with the default theme, `@argus-table/themes/default.css`. It is neutral: it uses the page's font, follows the system's light or dark setting through `light-dark()`, and uses one accent colour for focus, the sorted header and the resize handle. Put `data-argus-theme="dark"` or `"light"` on the table or an ancestor to force a scheme. The theme sets only tokens and `::part()` rules, so any token can be overridden after it. `argus-table` documents `--argus-row-selected-bg` as reserved for row selection; the table doesn't read it yet.
