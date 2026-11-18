---
'argus-table': patch
---

Faster first render in Safari, and in every browser on iOS: the table now adds new cells in an order WebKit slots in linear time instead of quadratic time. A table of 10,000 rows renders its first rows about three times faster, and wide tables gain the most: with 200 columns and `virtualizeColumns` off, the first render goes from 14 s to 0.3 s, and turning `virtualizeColumns` off from 18 s to 0.8 s. Chromium and Firefox render as before. Removing thousands of cells at once (turning `virtualizeColumns` back on, hiding many columns) is still slow in Safari.
