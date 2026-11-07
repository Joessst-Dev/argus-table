---
'@argus-table/themes': patch
---

The default theme keeps its header background, borders and hover colours in the automatic colour scheme (no `data-argus-theme`) when your build tool polyfills `light-dark()`, as Vite 8's Lightning CSS minifier does. Before, the header turned transparent and rows showed through it while scrolling.
