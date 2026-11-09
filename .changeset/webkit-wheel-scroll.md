---
'argus-table': patch
---

Mouse-wheel scrolling from the top of a table no longer stalls in WebKit. Each wheel step moved only a few pixels until the table had rendered a full window of rows, because every new row's slots cancelled WebKit's scroll animation. The table now renders that full window from the start, with the overscan that has no room at either end on the other side, so scrolling only reuses rows.
