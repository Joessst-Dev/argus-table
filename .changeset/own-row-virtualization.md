---
'argus-table': patch
---

The table no longer depends on `@tanstack/lit-virtual`: it lays out and windows rows itself, the way it already did for `rowHeight: 'auto'`. The CDN bundle is about 10 kB smaller gzipped (60.4 → 50.3 kB), and installs pull in two packages fewer. Scrolling, `scrollToRow()`, saved scroll positions and infinite loading work as before. A body taller than the browser's maximum element height now re-renders on every scroll, so its rows no longer drift by part of a row until scrolling stops.
