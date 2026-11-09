# @argus-table/themes

## 0.2.0

### Minor Changes

- eebb8a1: The default theme colours the drop line of a dragged column (column reordering in `argus-table`) with its accent colour.
- 19012fe: New Material-inspired theme, `@argus-table/themes/material.css`. It uses the Material 3 baseline colours in light and dark, Roboto, taller rows (40, 52 and 60px by density), an outlined surface with rounded corners and deeper shadows on pinned columns. The theme loads no fonts: load Roboto 400 and 500 yourself, for example from `@fontsource/roboto`. The default theme sets the new `--argus-radius` and `--argus-outline` tokens and looks the same as before.
- aa1a40b: The default theme styles pinned rows (`pinnedRows` in `argus-table`) like the header, with a line between the body and the bottom rows.
- d86671c: The default theme colours the skeleton bars that `argus-table` shows while `dataSource` rows load (`--argus-skeleton-bg`), in light and dark.

## 0.1.0

### Minor Changes

- ef3fdb9: New package `@argus-table/themes` with the default theme, `@argus-table/themes/default.css`. It is neutral: it uses the page's font, follows the system's light or dark setting through `light-dark()`, and uses one accent colour for focus, the sorted header and the resize handle. Put `data-argus-theme="dark"` or `"light"` on the table or an ancestor to force a scheme. The theme sets only tokens and `::part()` rules, so any token can be overridden after it. `argus-table` documents `--argus-row-selected-bg` as reserved for row selection; the table doesn't read it yet.

### Patch Changes

- 62b7cdb: The default theme keeps its header background, borders and hover colours in the automatic colour scheme (no `data-argus-theme`) when your build tool polyfills `light-dark()`, as Vite 8's Lightning CSS minifier does. Before, the header turned transparent and rows showed through it while scrolling.
