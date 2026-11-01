# Goals and non-goals for v1

[← Back to contents](../README.md)

v1 is a fast, styleable read-only table; editing and spreadsheet features wait.

## Goals

- 100k rows × 50 columns scroll at 60fps on a mid-range laptop
- Fixed columns (left and right) and fixed rows (top and bottom)
- Column resizing by drag, plus content-based auto width
- Infinite loading from a remote data source with unknown total count
- Restyle everything with CSS only: tokens, parts and slotted cell content
- Two themes at launch (default + Material-inspired), more after
- Works in plain HTML, React, Vue and Angular with typed usage
- Keyboard and screen-reader support from the first release
- Core bundle under 30 KB min+gzip (target, to be checked in the spike)

## Non-goals for v1

- Cell editing, range selection, copy/paste
- Grouping, tree rows, aggregation (formula columns come post-launch as an add-on, see [Formula columns](09-formula-columns.md))
- Excel/CSV/PDF export
- Canvas rendering (dropped for good: it would break CSS styling, slotted cells and accessibility)
- Legacy browsers or polyfills
