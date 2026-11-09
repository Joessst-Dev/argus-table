---
'argus-table': patch
---

Clicking a header, tabbing into the table, or moving focus through the header or pinned rows no longer scrolls the body in Chromium- and WebKit-based browsers. A header click, for example to sort, used to move the body by several rows. Focused body cells still scroll clear of the header, the pinned rows and the pinned columns.
