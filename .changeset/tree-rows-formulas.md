---
'@argus-table/formulas': patch
---

Whole columns (`[[name]]`) include the child rows of a tree (`getSubRows` or `getParentId`), whether their parents are expanded or not, and are computed again when `getSubRows` or `getParentId` changes.
