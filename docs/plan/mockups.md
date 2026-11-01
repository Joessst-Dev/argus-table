# Mockups

[← Back to contents](README.md)

All mockups live on one design canvas: **[Argus Table mockups](https://claude.ai/artifact/6tB5SCnXBD2szrqk2kmaWw)** (private until shared; open it while signed in to Claude).

The sample order data in the mockups is invented. "Material-inspired" borrows the general feel only, not Google's exact spec.

| # | Artboard | Size | What it shows |
| --- | --- | --- | --- |
| 1 | Default theme | 1200 × 640 | Order column pinned left and actions column pinned right with the middle scrolled sideways; pinned "Totals" row; sorted by Created; Customer column mid-resize with a width readout; keyboard focus on one cell; two skeleton rows still loading; a formula column marked `ƒx`. Tweaks: row density (comfortable / compact) and accent colour. |
| 2 | Material-inspired theme | 1200 × 640 | Same table with taller rows, rounded surface, tinted status chips and stronger shadows on pinned columns. |
| 3 | Minimal theme, dark | 1200 × 640 | Borderless, airy rows, uppercase column labels, status as a coloured dot plus label, amber accent. |
| 4 | Add formula column | 1200 × 800 | Dialog over the table: column name, formula `ROUND([Total] * 1.19, 2)` with syntax colouring, argument hint for `ROUND`, buttons to insert columns, live preview of the first 5 rows, Cancel / Add column. |
| 5 | Column header menu | 1200 × 680 | Menu open on the formula column Total: sort, pin left/right, fit width, hide, Formula group (edit formula with current formula shown, rename, delete), and "Add formula column…". |

## Design choices used across the mockups

- Typeface: Geist / Geist Mono (default theme), Roboto (Material-inspired), Instrument Sans / JetBrains Mono (minimal dark)
- Default accent `#2F5BD3`; status badges differ in lightness as well as hue
- Real `<button>` elements for sortable headers and menu items, `aria-sort` on the sorted header, `aria-label` on icon-only buttons
