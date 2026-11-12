# @argus-table/themes

## 1.0.0

No changes in this release.

## 0.5.0

No changes in this release.

## 0.4.0

### Minor Changes

- 08c5fcf: **Breaking (formulas):** the formula editor's text-colour tokens end in `-fg`, like every other text colour:

  - `--argus-formula-error-color` → `--argus-formula-error-fg`
  - `--argus-formula-function-color` → `--argus-formula-function-fg`
  - `--argus-formula-ref-color` → `--argus-formula-ref-fg`
  - `--argus-formula-number-color` → `--argus-formula-number-fg`
  - `--argus-formula-text-color` → `--argus-formula-text-fg`

  **Fallbacks (column menu and formula editor):** each token now has one fallback per role:

  - Lines and popup edges fall back to 20% of the text colour.
  - Form controls fall back to 30% of the text colour.
  - The hovered item falls back to 10% of the text colour.

  **Themes:** all five themes set the add-on tokens (`--argus-menu-*`, `--argus-dialog-*`, `--argus-formula-*`), so the column menu and the formula editor take on each theme. They also follow the renamed table tokens (`--argus-border`, `--argus-border-radius`, `--argus-row-odd-bg`, `--argus-row-pinned-bg`).

### Patch Changes

- bb8194e: Every theme styles column group headers (`header-group-cell`) like its column headers.
- 50ad445: The README links the new theme creator in the docs: start from one of these themes, change a few seeds or any token, check contrast in light and dark, and copy, download or share the CSS.

## 0.3.0

### Minor Changes

- 690eb29: A new theme, `@argus-table/themes/minimal.css`: a quiet, airy table that reads like a timeline. Header and body share one surface, there are no column lines, only faint hairlines between rows, column labels are small and uppercase, rows are 44 / 56 / 68px by density, and one amber accent marks focus, the sorted column, the resize handle and selected rows.

  It uses Instrument Sans but loads no fonts: load it on the page, for example from `@fontsource/instrument-sans` (400, 500 and 600); without it the table uses the system font. Like the other themes, it follows the system's light or dark setting, and `data-argus-theme="dark"` or `"light"` on the table or an ancestor forces one.

- d052e1d: Every theme colours the new filter mark in filtered headers (`--argus-filter-indicator-color`) with its accent colour.
- f8c9887: Two new themes, each a CSS file like the others: load one theme per page.

  - `@argus-table/themes/fluent.css`, Fluent-inspired: Fluent 2's neutral greys and brand blue, Segoe UI (the system font where it isn't installed; the theme loads no fonts), a flat header on the body colour, 34 / 44 / 52px rows by density, a brand-tinted selection and Fluent's black (white in dark mode) focus ring.
  - `@argus-table/themes/bootstrap.css`, Bootstrap-inspired: looks like a Bootstrap 5 `.table.table-striped.table-hover` without loading Bootstrap, with its colours, system font stack, padding (`.table-sm`'s at `compact`), striped rows, hover colour and the 2px divider under the header. Turn the stripes off with `argus-table { --argus-row-stripe-bg: var(--argus-bg); }`.

  Both follow the system's light or dark setting, and `data-argus-theme="dark"` or `"light"` on the table or an ancestor forces one. Both colour the selection checkboxes with their accent.

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
