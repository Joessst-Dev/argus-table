---
'argus-table': patch
---

Pinned columns no longer make vertical scrolling stutter in Safari. Pinned body cells are now sticky only while the table scrolls sideways, and the pinned edge's shadow is drawn once per side instead of on every row. Nothing changes in the DOM, the accessibility tree, the `cell-pinned` and `cell-pinned-edge` parts, or `--argus-pinned-shadow`.
