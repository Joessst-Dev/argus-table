# @argus-table/themes

## 0.1.0

### Minor Changes

- ef3fdb9: New package `@argus-table/themes` with the default theme, `@argus-table/themes/default.css`. It is neutral: it uses the page's font, follows the system's light or dark setting through `light-dark()`, and uses one accent colour for focus, the sorted header and the resize handle. Put `data-argus-theme="dark"` or `"light"` on the table or an ancestor to force a scheme. The theme sets only tokens and `::part()` rules, so any token can be overridden after it. `argus-table` documents `--argus-row-selected-bg` as reserved for row selection; the table doesn't read it yet.

### Patch Changes

- 62b7cdb: The default theme keeps its header background, borders and hover colours in the automatic colour scheme (no `data-argus-theme`) when your build tool polyfills `light-dark()`, as Vite 8's Lightning CSS minifier does. Before, the header turned transparent and rows showed through it while scrolling.
