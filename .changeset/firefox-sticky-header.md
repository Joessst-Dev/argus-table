---
'argus-table': patch
---

In Firefox, the header and the rows pinned to the top stay in view deep in large tables. Firefox lets go of them once a table has scrolled more than about 8.95M px (about 220,000 rows of 40 px), so the table now keeps its scroll range under that there, as it already does past the browsers' maximum element height. Tables that tall scroll a little further per wheel step in Firefox.
